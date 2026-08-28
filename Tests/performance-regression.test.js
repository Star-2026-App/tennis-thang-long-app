const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const auth = read("Backend/AuthService.gs.txt");
const code = read("Backend/Code.gs.txt");
const router = read("Backend/Router.gs.txt");
const idempotency = read("Backend/IdempotencyService.gs.txt");
const matches = read("Backend/MatchService.txt");
const stats = read("Backend/MemberStatsService.txt");
const api = read("Frontend/js/api.js");
const cup = read("Frontend/js/modules/cup.js");
const dataRoute = read("Frontend/api/data/[type].js");
const writeRoute = read("Frontend/api/actions/write.js");
const serviceWorker = read("Frontend/service-worker.js");
const packageJson = JSON.parse(read("Frontend/package.json"));

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `Thiếu hàm ${name}`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  return source.slice(start, end >= 0 ? end : source.length);
}

const getSession = functionBody(auth, "getAuthSession_", "revokeAuthSession_");
assert.match(getSession, /CacheService\.getScriptCache/);
assert.doesNotMatch(getSession, /setValue\s*\(/, "Đọc session không được ghi LastUsedAt");
assert.doesNotMatch(functionBody(auth, "createAuthSession_", "getAuthSession_"), /cleanupExpiredAuthSessions_/);

assert.doesNotMatch(code, /Math\.random\(\)\s*<\s*0\.05/);
assert.match(code, /function runDailyMaintenance/);
assert.match(code, /function installDailyMaintenanceTrigger/);
assert.match(code, /readCompressedJsonCache_/);
assert.match(code, /getInitialDataIfChanged_/);
assert.match(router, /bootstrapData/);
assert.match(router, /syncData/);
assert.match(router, /bumpDataRevision_/);
assert.match(idempotency, /createTextFinder/);

assert.doesNotMatch(functionBody(matches, "getMatchesData", "addMatchData"), /ensureMatchGocFeeColumn_/);
assert.match(stats, /MEMBER_STATS_READY_CACHE_KEY_/);
assert.match(stats, /statsBlock/);

assert.match(api, /new AbortController\(\)/);
assert.match(api, /isRetryableHttpStatus_/);
assert.match(api, /__nextAttemptAt/);
assert.match(api, /initialDataPromise_/);
assert.match(api, /\/api\/data\/sync/);

assert.match(cup, /\/api\/data\/cup-version/);
assert.match(cup, /}, 60000\);/);
assert.match(dataRoute, /case "bootstrap"/);
assert.match(dataRoute, /case "sync"/);
assert.match(dataRoute, /case "cup-version"/);

assert.match(writeRoute, /waitUntil\s*\(/);
assert.doesNotMatch(writeRoute, /await\s+pushSender\.notifyAfterCommit/);
assert.ok(packageJson.dependencies["@vercel/functions"]);

assert.match(serviceWorker, /requestUrl\.pathname\.indexOf\('\/api\/'\)/);
assert.match(serviceWorker, /APP_SHELL_CACHE/);

console.log("PERFORMANCE_REGRESSION_TEST_PASS");
