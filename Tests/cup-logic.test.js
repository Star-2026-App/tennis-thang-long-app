const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const serviceCode = fs.readFileSync(path.join(root, "Backend/CupService.gs.txt"), "utf8");

const context = {
  console,
  Math,
  JSON,
  Date,
  isFinite,
  parseInt,
  Number,
  String,
  Object,
  Array,
  Error,
  Utilities: {
    formatDate(date) {
      return date.toISOString().slice(0, 10);
    }
  },
  nowDisplayTime_: () => "27/08/2026 09:00:00",
  generateServerId_: () => "TEST_ID",
  sanitizeForSheet_: value => value,
  appendAuthAudit_: () => {},
  getMembersData: () => [],
  getOrCreateSheet: () => { throw new Error("Sheet access is not expected in pure logic tests"); }
};
vm.createContext(context);
vm.runInContext(serviceCode, context, { filename: "CupService.gs.txt" });

function createCup(groupCount, pairsPerGroup, courtCount = 4) {
  const cup = context.getDefaultCupData_();
  cup.enabled = true;
  cup.status = "active";
  cup.date = "2026-09-05";
  cup.startTime = "06:00";
  cup.matchDuration = 45;
  cup.courtCount = courtCount;
  cup.groupCount = groupCount;
  cup.pairsPerGroup = pairsPerGroup;
  cup.participantsLocked = true;
  cup.pairsLocked = true;

  const pairCount = groupCount * pairsPerGroup;
  for (let i = 0; i < pairCount; i++) {
    const group = context.cupSnakeGroup_ ? context.cupSnakeGroup_(i, groupCount) : null;
    const groupName = group || String.fromCharCode(65 + (i % groupCount));
    const p1 = { stt: i * 2 + 1, name: `Người ${i * 2 + 1}`, rating: 6.4 - i * 0.01 };
    const p2 = { stt: i * 2 + 2, name: `Người ${i * 2 + 2}`, rating: 6.0 + i * 0.005 };
    cup.participants.push(p1, p2);
    cup.pairs.push({
      id: `P${i + 1}`,
      seed: i + 1,
      group: groupName,
      player1Stt: p1.stt,
      player1Name: p1.name,
      player1Rating: p1.rating,
      player2Stt: p2.stt,
      player2Name: p2.name,
      player2Rating: p2.rating,
      totalRating: p1.rating + p2.rating
    });
  }

  return cup;
}

function fillDecisiveGroupResults(cup) {
  const seedById = Object.fromEntries(cup.pairs.map(pair => [pair.id, pair.seed]));
  cup.matches.filter(match => match.stage === "group").forEach(match => {
    const aWins = seedById[match.pairAId] < seedById[match.pairBId];
    match.scoreA = aWins ? 6 : 2;
    match.scoreB = aWins ? 2 : 6;
    match.status = "completed";
    match.winnerPairId = aWins ? match.pairAId : match.pairBId;
  });
}

function completeStage(cup, stage) {
  cup.matches.filter(match => match.stage === stage && match.pairAId && match.pairBId).forEach(match => {
    match.scoreA = 6;
    match.scoreB = 3;
    match.status = "completed";
    match.winnerPairId = match.pairAId;
  });
  context.rebuildCupAdvancement_(cup);
}

function testFourGroups() {
  const cup = createCup(4, 4, 4);
  context.ensureCupGroupMatches_(cup);
  assert.strictEqual(cup.matches.length, 24, "4 bảng x 4 cặp phải tạo 24 trận vòng bảng");
  assert.ok(cup.matches.every(match => match.stage === "group"));

  fillDecisiveGroupResults(cup);
  context.rebuildCupAdvancement_(cup);
  assert.strictEqual(cup.matches.filter(m => m.stage === "QF").length, 4);
  assert.strictEqual(cup.matches.filter(m => m.stage === "SF").length, 2);
  assert.strictEqual(cup.matches.filter(m => m.stage === "F").length, 1);

  completeStage(cup, "QF");
  assert.ok(cup.matches.filter(m => m.stage === "SF").every(m => m.pairAId && m.pairBId));
  completeStage(cup, "SF");
  assert.ok(cup.matches.find(m => m.stage === "F").pairAId);
  completeStage(cup, "F");
  assert.strictEqual(cup.status, "completed");
  assert.ok(context.cupClientView_(cup).championPairId);
  assert.ok(JSON.stringify(cup).length < context.CUP_MAX_JSON_CHARS_);
}

function testThreeGroups() {
  const cup = createCup(3, 4, 4);
  context.ensureCupGroupMatches_(cup);
  assert.strictEqual(cup.matches.length, 18);
  fillDecisiveGroupResults(cup);
  context.rebuildCupAdvancement_(cup);
  const blocked = context.cupQualificationState_(cup).blocked.find(item => item.scope === "GLOBAL_THIRD");
  assert.ok(blocked, "Ba cặp hạng ba bằng chỉ số phải chờ bốc thăm liên bảng");
  blocked.pairIds.forEach((id, index) => {
    cup.tieBreakLots[context.cupLotKey_("GLOBAL_THIRD", id)] = blocked.pairIds.length - index;
  });
  context.rebuildCupAdvancement_(cup);
  assert.strictEqual(cup.matches.filter(m => m.stage === "QF").length, 4);
  assert.strictEqual(context.cupClientView_(cup).bestThirds.length, 3);
}

function testTwoGroups() {
  const cup = createCup(2, 4, 2);
  context.ensureCupGroupMatches_(cup);
  assert.strictEqual(cup.matches.length, 12);
  fillDecisiveGroupResults(cup);
  context.rebuildCupAdvancement_(cup);
  assert.strictEqual(cup.matches.filter(m => m.stage === "QF").length, 0);
  assert.strictEqual(cup.matches.filter(m => m.stage === "SF").length, 2);
  assert.strictEqual(cup.matches.filter(m => m.stage === "F").length, 1);
}

function testTieBlocksAdvancement() {
  const cup = createCup(2, 4, 4);
  context.ensureCupGroupMatches_(cup);
  cup.matches.forEach(match => {
    match.scoreA = 5;
    match.scoreB = 5;
    match.status = "completed";
  });
  context.rebuildCupAdvancement_(cup);
  assert.strictEqual(cup.matches.filter(m => m.stage !== "group").length, 0, "Chưa bốc thăm thì không được tạo vòng trong");
  const before = context.cupQualificationState_(cup);
  assert.strictEqual(before.blocked.length, 2);

  ["A", "B"].forEach(group => {
    const ids = cup.pairs.filter(pair => pair.group === group).map(pair => pair.id);
    ids.forEach((id, index) => {
      cup.tieBreakLots[context.cupLotKey_(`GROUP_${group}`, id)] = ids.length - index;
    });
  });
  context.rebuildCupAdvancement_(cup);
  assert.strictEqual(cup.matches.filter(m => m.stage === "SF").length, 2);
}

function testScheduleRestAndScores() {
  const cup = createCup(4, 4, 8);
  context.ensureCupGroupMatches_(cup);
  const round1 = cup.matches.filter(m => m.round === 1);
  const round2 = cup.matches.filter(m => m.round === 2);
  assert.ok(round1.every(m => m.scheduledTime === "06:00"));
  assert.ok(round2.every(m => m.scheduledTime === "07:30"), "Phải có một khung nghỉ 06:45 giữa hai lượt");

  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.validateCupScore_({ stage: "group" }, 5, 5))), { scoreA: 5, scoreB: 5 });
  assert.throws(() => context.validateCupScore_({ stage: "group" }, 6, 5));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(context.validateCupScore_({ stage: "QF" }, 6, 5))), { scoreA: 6, scoreB: 5 });
}

function testOptimisticConcurrency() {
  const cup = context.getDefaultCupData_();
  cup.version = 9;
  context.assertCupExpectedVersion_(cup, 9);
  assert.throws(() => context.assertCupExpectedVersion_(cup, 8), /vừa được người khác cập nhật/);
}

testFourGroups();
testThreeGroups();
testTwoGroups();
testTieBlocksAdvancement();
testScheduleRestAndScores();
testOptimisticConcurrency();

console.log("CUP_LOGIC_TEST_PASS");
