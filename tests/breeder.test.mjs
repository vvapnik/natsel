// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, pick, readCookie, sign, speciesOf, verify } from "../src/breeder-core.js";

const secret = "test-secret";
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

test("new visitor gets a species by distribution and a signed cookie", async () => {
  const d = await decide({ snapshot, cookie: "", secret, random: () => 0.95 });
  assert.equal(d.species.id, "sp-b");
  assert.equal(d.genotype.get("hero.cta"), 1);
  assert.equal(d.setCookie, d.dna);
  assert.equal(await verify(d.dna, secret), "sp=sp-b;hero.cta=1;hero.headline=1");
});

test("returning visitor keeps the species without a new cookie", async () => {
  const cookie = await sign("sp=sp-b;hero.cta=1;hero.headline=1", secret);
  const d = await decide({ snapshot, cookie, secret, random: () => 0 });
  assert.equal(d.species.id, "sp-b");
  assert.equal(d.setCookie, null);
});

test("returning visitor gets the species' current genotype (new gene)", async () => {
  const cookie = await sign("sp=sp-b;hero.cta=1", secret);
  const d = await decide({ snapshot, cookie, secret });
  assert.equal(d.genotype.get("hero.headline"), 1);
  assert.ok(d.setCookie);
});

test("extinct species is reassigned", async () => {
  const cookie = await sign("sp=sp-dead;hero.cta=1", secret);
  const d = await decide({ snapshot, cookie, secret, random: () => 0 });
  assert.equal(d.species.id, "sp-a");
  assert.ok(d.setCookie);
});

test("bad signature is reassigned", async () => {
  const d = await decide({ snapshot, cookie: "sp=sp-b;hero.cta=1.forged", secret, random: () => 0 });
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

test("bots without a cookie see the control", async () => {
  const d = await decide({ snapshot, cookie: "", userAgent: "Googlebot/2.1", secret });
  assert.equal(d.species, null);
  assert.equal(d.setCookie, null);
});

test("fail safe: no snapshot or no secret -> control, cookie untouched", async () => {
  for (const args of [{ snapshot: null, secret }, { snapshot, secret: undefined }, { snapshot: { species: "x" }, secret }]) {
    const d = await decide({ cookie: "whatever", ...args });
    assert.equal(d.species, null);
    assert.equal(d.genotype.size, 0);
    assert.equal(d.setCookie, null);
  }
});

test("readCookie", () => {
  assert.equal(readCookie("a=1; dna=sp%3Dx.y; b=2", "dna"), "sp=x.y");
  assert.equal(readCookie(undefined, "dna"), "");
});
