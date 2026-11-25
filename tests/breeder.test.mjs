// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  ensureSalt,
  modeOf,
  pick,
  readCookie,
  rendezvous,
  saltExpiration,
  sign,
  speciesOf,
  utcDay,
  verify,
  visitorKey,
} from "../src/breeder-core.js";
import breeder, { assign } from "../src/breeder.js";

const secret = "test-secret";
const cookieMode = { mode: "cookie" };
const snapshot = {
  population: "default",
  version: 3,
  species: [
    { id: "sp-a", share_bp: 9000, dna: "hero.cta=0;hero.headline=0" },
    { id: "sp-b", share_bp: 1000, dna: "hero.cta=1;hero.headline=1" },
  ],
};

test("pick follows share_bp", () => {
  assert.equal(pick(snapshot, 0).id, "sp-a");
  assert.equal(pick(snapshot, 0.8999).id, "sp-a");
  assert.equal(pick(snapshot, 0.9).id, "sp-b");
  assert.equal(pick(snapshot, 0.99999).id, "sp-b");
  assert.equal(pick({ species: [] }, 0.5), null);
});

test("sign / verify", async () => {
  const dna = await sign("sp=sp-a;hero.cta=0", secret);
  assert.equal(await verify(dna, secret), "sp=sp-a;hero.cta=0");
  assert.equal(await verify(dna, "other"), null);
  assert.equal(await verify(dna.replace("cta=0", "cta=1"), secret), null);
  assert.equal(await verify("garbage", secret), null);
  assert.equal(speciesOf("sp=sp-a;hero.cta=0"), "sp-a");
});

test("cookie mode: new visitor gets a species by distribution and a signed cookie", async () => {
  const d = await decide({ snapshot, cookie: "", secret, random: () => 0.95 , ...cookieMode });
  assert.equal(d.species.id, "sp-b");
  assert.equal(d.genotype.get("hero.cta"), 1);
  assert.equal(d.setCookie, d.dna);
  assert.equal(await verify(d.dna, secret), "sp=sp-b;hero.cta=1;hero.headline=1");
});

test("cookie mode: returning visitor keeps the species without a new cookie", async () => {
  const cookie = await sign("sp=sp-b;hero.cta=1;hero.headline=1", secret);
  const d = await decide({ snapshot, cookie, secret, random: () => 0 , ...cookieMode });
  assert.equal(d.species.id, "sp-b");
  assert.equal(d.setCookie, null);
});

test("cookie mode: returning visitor gets the species' current genotype (new gene)", async () => {
  const cookie = await sign("sp=sp-b;hero.cta=1", secret);
  const d = await decide({ snapshot, cookie, secret , ...cookieMode });
  assert.equal(d.genotype.get("hero.headline"), 1);
  assert.ok(d.setCookie);
});

test("cookie mode: extinct species is reassigned", async () => {
  const cookie = await sign("sp=sp-dead;hero.cta=1", secret);
  const d = await decide({ snapshot, cookie, secret, random: () => 0 , ...cookieMode });
  assert.equal(d.species.id, "sp-a");
  assert.ok(d.setCookie);
});

test("cookie mode: bad signature is reassigned", async () => {
  const d = await decide({ snapshot, cookie: "sp=sp-b;hero.cta=1.forged", secret, random: () => 0 , ...cookieMode });
  assert.equal(d.species.id, "sp-a");
  assert.ok(d.setCookie);
});

test("?dna= preview: species id or raw dna, never a cookie", async () => {
  const byId = await decide({ snapshot, preview: "sp-b", secret });
  assert.equal(byId.species.id, "sp-b");
  assert.equal(byId.setCookie, null);
  const raw = await decide({ snapshot, preview: "hero.cta=1.x", secret });
  assert.equal(raw.genotype.get("hero.cta"), 1);
  assert.equal(raw.setCookie, null);
});

test("cookie mode: bots without a cookie see the control", async () => {
  const d = await decide({ snapshot, cookie: "", userAgent: "Googlebot/2.1", secret , ...cookieMode });
  assert.equal(d.species, null);
  assert.equal(d.setCookie, null);
});

test("cookie mode: fail safe: no snapshot or no secret -> control, cookie untouched", async () => {
  for (const args of [{ snapshot: null, secret }, { snapshot, secret: undefined }, { snapshot: { species: "x" }, secret }]) {
    const d = await decide({ cookie: "whatever", ...args , ...cookieMode });
    assert.equal(d.species, null);
    assert.equal(d.genotype.size, 0);
    assert.equal(d.setCookie, null);
  }
});

test("readCookie", () => {
  assert.equal(readCookie("a=1; dna=sp%3Dx.y; b=2", "dna"), "sp=x.y");
  assert.equal(readCookie(undefined, "dna"), "");
});

// ---------- hash mode (TASK-70.17) ----------

const keys = async (n, salt = "salt-1") =>
  Promise.all(Array.from({ length: n }, (_, i) => visitorKey(salt, `10.0.${i >> 8}.${i & 255}`, "Mozilla/5.0")));

const assignAll = async (snap, ks) => Promise.all(ks.map((k) => rendezvous(snap, k).then((s) => s?.id ?? null)));

test("modeOf: hash by default, cookie on request", () => {
  assert.equal(modeOf(undefined), "hash");
  assert.equal(modeOf("nonsense"), "hash");
  assert.equal(modeOf("cookie"), "cookie");
});

test("visitorKey: same salt + IP + UA -> same key; any change -> another; no salt or IP -> null", async () => {
  const k = await visitorKey("s", "1.2.3.4", "UA");
  assert.equal(k, await visitorKey("s", "1.2.3.4", "UA"));
  assert.notEqual(k, await visitorKey("s2", "1.2.3.4", "UA"));
  assert.notEqual(k, await visitorKey("s", "1.2.3.5", "UA"));
  assert.notEqual(k, await visitorKey("s", "1.2.3.4", "UA2"));
  assert.equal(await visitorKey(null, "1.2.3.4", "UA"), null);
  assert.equal(await visitorKey("s", null, "UA"), null);
});

test("hash mode: shares follow the distribution", async () => {
  const got = await assignAll(snapshot, await keys(4000));
  const b = got.filter((x) => x === "sp-b").length / got.length;
  assert.ok(b > 0.08 && b < 0.12, `sp-b share ${b}`);
});

test("hash mode: a new day (new salt) reshuffles visitors", async () => {
  const day1 = await assignAll(snapshot, await keys(2000, "salt-day-1"));
  const day2 = await assignAll(snapshot, await keys(2000, "salt-day-2"));
  const moved = day1.filter((x, i) => x !== day2[i]).length;
  assert.ok(moved > 100, `moved ${moved}`); // ~18% expected for a 90/10 split
});

test("hash mode: changing shares moves only the visitors that must move", async () => {
  const ks = await keys(4000);
  const before = await assignAll(snapshot, ks);
  const grown = { species: [{ ...snapshot.species[0], share_bp: 7000 }, { ...snapshot.species[1], share_bp: 3000 }] };
  const after = await assignAll(grown, ks);
  // sp-b grew: nobody leaves sp-b, some sp-a visitors join it
  assert.ok(before.every((x, i) => x !== "sp-b" || after[i] === "sp-b"));
  const moved = before.filter((x, i) => x !== after[i]).length / ks.length;
  assert.ok(moved > 0.15 && moved < 0.25, `moved ${moved}`); // 20% is the minimum for 10% -> 30%
});

test("hash mode: extinction moves only the extinct species' visitors", async () => {
  const three = {
    species: [...snapshot.species, { id: "sp-c", share_bp: 2000, dna: "hero.cta=1;hero.headline=0" }],
  };
  const ks = await keys(3000);
  const before = await assignAll(three, ks);
  const after = await assignAll({ species: three.species.filter((s) => s.id !== "sp-c") }, ks);
  before.forEach((x, i) => {
    if (x !== "sp-c") assert.equal(after[i], x);
  });
});

test("hash mode: species by visitor key, signed dna, no cookie; an old cookie is cleared", async () => {
  const visitor = await visitorKey("salt", "1.2.3.4", "Mozilla/5.0");
  const d = await decide({ snapshot, visitor, secret });
  assert.equal(d.species.id, (await rendezvous(snapshot, visitor)).id);
  assert.equal(d.setCookie, null);
  assert.equal(d.clearCookie, false);
  assert.equal(await verify(d.dna, secret), `sp=${d.species.id};${d.species.dna}`);
  const old = await sign("sp=sp-b;hero.cta=1;hero.headline=1", secret);
  const withOld = await decide({ snapshot, visitor, secret, cookie: old });
  assert.equal(withOld.species.id, d.species.id); // the cookie does not decide in hash mode
  assert.equal(withOld.setCookie, null);
  assert.equal(withOld.clearCookie, true);
});

test("hash mode: preview, bots and fail safe", async () => {
  const visitor = await visitorKey("salt", "1.2.3.4", "Mozilla/5.0");
  const pv = await decide({ snapshot, visitor, secret, preview: "sp-b" });
  assert.equal(pv.species.id, "sp-b");
  assert.equal(pv.setCookie, null);
  const bot = await decide({ snapshot, visitor, secret, userAgent: "Googlebot/2.1" });
  assert.equal(bot.species, null);
  for (const args of [{ visitor: null }, { secret: undefined }, { snapshot: null }]) {
    const d = await decide({ snapshot, visitor, secret, ...args });
    assert.equal(d.species, null);
    assert.equal(d.setCookie, null);
  }
});

// ---------- daily salt ----------

function fakeKV() {
  const m = new Map();
  return {
    m,
    async get(k) {
      return m.get(k)?.value ?? null;
    },
    async put(k, value, opts) {
      m.set(k, { value, ...opts });
    },
  };
}

test("utcDay and saltExpiration: a salt lives until an hour after its UTC day", () => {
  assert.equal(utcDay(Date.parse("2026-11-25T23:59:59Z")), "2026-11-25");
  assert.equal(utcDay(Date.parse("2026-11-26T00:00:00Z")), "2026-11-26");
  assert.equal(saltExpiration("2026-11-25"), Date.parse("2026-11-26T01:00:00Z") / 1000);
});

test("ensureSalt: creates a random salt once per day, with expiration", async () => {
  const kv = fakeKV();
  const a = await ensureSalt(kv, "2026-11-25");
  assert.equal(await ensureSalt(kv, "2026-11-25"), a);
  const b = await ensureSalt(kv, "2026-11-26");
  assert.notEqual(a, b);
  assert.ok(a.length >= 40);
  assert.equal(kv.m.get("salt:2026-11-25").expiration, saltExpiration("2026-11-25"));
});

test("cron creates today's and tomorrow's salts", async () => {
  const kv = fakeKV();
  await breeder.scheduled({}, { DISTRIBUTIONS: kv });
  const now = Date.now();
  assert.ok(kv.m.has(`salt:${utcDay(now)}`));
  assert.ok(kv.m.has(`salt:${utcDay(now + 24 * 3600 * 1000)}`));
});

// ---------- assign(): one decision for pages and events ----------

function fakeEnv(mode) {
  const kv = fakeKV();
  kv.m.set("population:default", { value: snapshot }); // get(..., { type: "json" }) returns the object as is
  return { DISTRIBUTIONS: kv, DNA_SECRET: secret, POPULATION: "default", ASSIGNMENT: mode };
}

const req = (headers = {}, path = "/") =>
  new Request(`https://natsel.test${path}`, {
    headers: { "User-Agent": "Mozilla/5.0", "CF-Connecting-IP": "1.2.3.4", ...headers },
  });

test("assign: hash mode is the default, stable for a visitor, and creates the day's salt", async () => {
  const env = fakeEnv(undefined);
  const a = await assign(req(), env);
  assert.equal(a.mode, "hash");
  assert.ok(a.decision.species);
  assert.equal(a.decision.setCookie, null);
  assert.ok(env.DISTRIBUTIONS.m.has(`salt:${utcDay(Date.now())}`));
  const again = await assign(req({}, "/concept/"), env); // e.g. the events endpoint of TASK-70.9
  assert.equal(again.decision.species.id, a.decision.species.id);
  const bot = await assign(req({ "User-Agent": "Googlebot/2.1" }), env);
  assert.equal(bot.decision.species, null);
});

test("assign: cookie mode sets the cookie, and the cookie decides next time", async () => {
  const env = fakeEnv("cookie");
  const first = await assign(req(), env);
  assert.equal(first.mode, "cookie");
  assert.ok(first.decision.setCookie);
  const next = await assign(req({ Cookie: `dna=${encodeURIComponent(first.decision.setCookie)}`, "CF-Connecting-IP": "9.9.9.9" }), env);
  assert.equal(next.decision.species.id, first.decision.species.id);
  assert.equal(next.decision.setCookie, null);
});
