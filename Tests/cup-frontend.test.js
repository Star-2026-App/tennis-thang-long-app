const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Frontend/js/modules/cup.js"), "utf8");
function fakeElement(id, initialClasses = []) {
  const classes = new Set(initialClasses);
  return {
    id,
    innerHTML: "",
    className: initialClasses.join(" "),
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
        return classes.has(name);
      },
      contains(name) { return classes.has(name); }
    },
    setAttribute() {},
    insertAdjacentElement(position, element) {
      elements[element.id] = element;
    }
  };
}

const elements = {};
const rootElement = fakeElement("cupRoot");
elements.cupRoot = rootElement;
elements["bn-cashbook"] = fakeElement("bn-cashbook", ["bn-item"]);
elements["bn-more"] = fakeElement("bn-more", ["bn-item"]);
const cupMoreElement = fakeElement("cup-more", ["more-row", "cup-nav-entry", "hidden"]);

const documentStub = {
  getElementById(id) {
    return elements[id] || null;
  },
  querySelectorAll() { return []; },
  querySelector(selector) {
    return selector.indexOf("moreGo('cup'") !== -1 ? cupMoreElement : null;
  },
  createElement() { return fakeElement(""); }
};

const context = {
  console,
  JSON,
  Math,
  Date,
  Number,
  String,
  Object,
  Array,
  Error,
  parseInt,
  isFinite,
  document: Object.assign(documentStub, { visibilityState: "visible" }),
  navigator: { onLine: true },
  window: { crypto: null },
  setInterval: () => 1,
  clearInterval: () => {},
  currentUserRole: "owner",
  loggedInMemberStt: 2,
  currentUserName: "Owner",
  members: [],
  cupData: null,
  showToast: () => {},
  saveLocalData: () => {},
  callBackendRead_: () => Promise.reject(new Error("not used")),
  callBackendAction_: () => Promise.reject(new Error("not used")),
  callBackendActionWithRetry_: () => Promise.reject(new Error("not used")),
  generateIdempotencyKey_: () => "TEST",
  confirm: () => true,
  prompt: () => null
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "cup.js" });

function createParticipants(count) {
  return Array.from({ length: count }, (_, i) => ({
    stt: i + 1,
    name: `Người chơi ${i + 1}`,
    rating: 7 - i * 0.02
  }));
}

function baseCup() {
  return {
    version: 3,
    enabled: true,
    status: "registration",
    name: "CUP TEST 2026",
    date: "2026-09-05",
    startTime: "06:00",
    courtCount: 4,
    matchDuration: 45,
    groupCount: 4,
    pairsPerGroup: 4,
    pairingMode: "auto",
    participantsLocked: false,
    pairsLocked: false,
    participants: [],
    pairs: [],
    matches: [],
    tieBreakLots: {},
    rules: "Luật số 1\nLuật số 2",
    standings: {},
    qualifiers: [],
    bestThirds: [],
    qualificationBlocked: [],
    progress: { groupCompleted: 0, groupTotal: 0, allCompleted: 0, allTotal: 0 },
    championPairId: "",
    championName: ""
  };
}

function testRenderOwnerAndMember() {
  context.members = Array.from({ length: 40 }, (_, i) => ({ stt: i + 1, name: `Thành viên ${i + 1}`, base: 6.2, isActive: true }));
  context.cupData = baseCup();
  context.cupActiveSection_ = "overview";
  context.currentUserRole = "owner";
  context.renderCupTab();
  assert.match(rootElement.innerHTML, /CUP TEST 2026/);
  assert.match(rootElement.innerHTML, /Cài đặt/);

  context.cupActiveSection_ = "participants";
  context.cupParticipantDraft_ = null;
  context.renderCupTab();
  assert.match(rootElement.innerHTML, /40 đã chọn|Xác nhận danh sách/);
  assert.strictEqual((rootElement.innerHTML.match(/cup-member-item/g) || []).length, 40);

  context.currentUserRole = "member";
  context.cupActiveSection_ = "overview";
  context.renderCupTab();
  assert.doesNotMatch(rootElement.innerHTML, />Cài đặt</);
}

function testBalancedPairing() {
  const cup = baseCup();
  cup.status = "pairing";
  cup.participantsLocked = true;
  cup.participants = createParticipants(32);
  context.cupData = cup;
  context.currentUserRole = "owner";

  let saved = null;
  context.cupSaveSnapshot_ = next => { saved = next; return Promise.resolve(next); };
  context.drawCupPairsAuto();

  assert.ok(saved);
  assert.strictEqual(saved.pairs.length, 16);
  assert.strictEqual(new Set(saved.pairs.flatMap(pair => [pair.player1Stt, pair.player2Stt])).size, 32);
  const counts = saved.pairs.reduce((acc, pair) => {
    acc[pair.group] = (acc[pair.group] || 0) + 1;
    return acc;
  }, {});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(counts)), { A: 4, B: 4, C: 4, D: 4 });
  saved.pairs.forEach(pair => {
    assert.ok(pair.player1Stt <= 16, "Người thứ nhất phải thuộc nửa trình cao");
    assert.ok(pair.player2Stt > 16, "Người thứ hai phải thuộc nửa trình thấp");
  });
}

function testMemberCannotEditCompletedResult() {
  const cup = baseCup();
  const match = {
    id: "G_A_R1_M1",
    stage: "group",
    group: "A",
    round: 1,
    pairAId: "P1",
    pairBId: "P2",
    pairAName: "A / B",
    pairBName: "C / D",
    scoreA: 6,
    scoreB: 3,
    status: "completed"
  };
  context.currentUserRole = "member";
  assert.strictEqual(context.cupResultButtonHtml_(match), "");
  context.currentUserRole = "admin";
  assert.match(context.cupResultButtonHtml_(match), /Sửa kết quả/);
}

function testMobilePrioritySwap() {
  context.currentUserRole = "owner";
  context.cupData = baseCup();
  context.syncCupNavVisibility();
  assert.ok(elements["bn-cashbook"].classList.contains("hidden"));
  assert.ok(!elements["bn-cup"].classList.contains("hidden"));
  assert.ok(!elements["more-cashbook-cup-active"].classList.contains("hidden"));
  assert.ok(cupMoreElement.classList.contains("hidden"));

  context.cupData.enabled = false;
  context.syncCupNavVisibility();
  assert.ok(!elements["bn-cashbook"].classList.contains("hidden"));
  assert.ok(elements["bn-cup"].classList.contains("hidden"));
  assert.ok(elements["more-cashbook-cup-active"].classList.contains("hidden"));
  assert.ok(!cupMoreElement.classList.contains("hidden"));
}

testRenderOwnerAndMember();
testBalancedPairing();
testMemberCannotEditCompletedResult();
testMobilePrioritySwap();
console.log("CUP_FRONTEND_TEST_PASS");
