// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDna, alleleIndex, createGene, applyGenes, browserDna } from "../docs/assets/js/natsel.js";

const ok = () => true;
const bad = () => false;

test("valid dna expresses the chosen allele", () => {
  const gene = createGene(parseDna("hero.headline=1;hero.cta=0.sig", ok));
  assert.equal(gene("hero.headline", ["A", "B"]), "B");
  assert.equal(gene("hero.cta", ["A", "B"]), "A");
});

const failures = {
  "no dna": [undefined, undefined],
  "empty dna": ["", undefined],
  "dna is not a string": [{ "hero.headline": 1 }, undefined],
  "gene missing from dna": ["hero.cta=1.sig", ok],
  "unknown allele": ["hero.headline=7.sig", ok],
  "negative / non-numeric allele": ["hero.headline=-1;hero.headline=x.sig", ok],
  "bad signature": ["hero.headline=1.sig", bad],
  "verify throws": ["hero.headline=1.sig", () => { throw new Error("boom"); }],
  "garbage": [";;==.=.", ok],
};

for (const [name, [dna, verify]] of Object.entries(failures)) {
  test(`fail safe: ${name} -> first allele`, () => {
    const gene = createGene(parseDna(dna, verify));
    assert.equal(gene("hero.headline", ["default", "variant"]), "default");
  });
}

test("alleleIndex survives a broken genotype", () => {
  assert.equal(alleleIndex(null, "hero.headline", 2), 0);
  assert.equal(alleleIndex(new Map([["hero.headline", 1.5]]), "hero.headline", 2), 0);
});

test("gene without alleles is a programming error", () => {
  assert.throws(() => createGene(new Map())("hero.headline", []), TypeError);
});

function fakeGene(name, count) {
  const alleles = Array.from({ length: count }, (_, i) => ({
    hidden: i !== 0,
    hasAttribute: (a) => a === "data-allele",
  }));
  return { el: { children: alleles, getAttribute: () => name }, alleles };
}

test("applyGenes shows the chosen allele, defaults otherwise", () => {
  const a = fakeGene("hero.headline", 2);
  const b = fakeGene("hero.cta", 2);
  const root = { querySelectorAll: () => [a.el, b.el] };
  applyGenes(root, parseDna("hero.headline=1;hero.cta=9.sig", ok));
  assert.deepEqual(a.alleles.map((x) => x.hidden), [true, false]);
  assert.deepEqual(b.alleles.map((x) => x.hidden), [false, true]);
});

test("browserDna: preview param, window.natsel, broken window", () => {
  assert.equal(browserDna({ location: { href: "https://x/?dna=a=1.s" } }), "a=1.s");
  assert.equal(browserDna({ location: { href: "https://x/" }, natsel: { dna: "b=1.s" } }), "b=1.s");
  assert.equal(browserDna({}), "");
});
