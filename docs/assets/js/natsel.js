// natsel mini-SDK (POC).
//
// Gene contract (POC):
// - A gene is named "<locus>.<name>" and has 2+ alleles. The FIRST allele is the default.
// - dna is "<payload>.<signature>", payload is "gene=allele;gene=allele" (allele is a 0-based index).
// - Fail safe: no dna, gene missing from dna, unknown allele, bad signature or any other error
//   -> the default (first) allele. A broken experiment must never break the page.

const GENE_NAME = /^[a-z0-9-]+\.[a-z0-9-]+$/;

// Parse dna into a Map gene -> allele index. Never throws; returns an empty Map on any problem.
// `verify(payload, signature)` is optional; if given and it does not return true, dna is rejected.
export function parseDna(dna, verify) {
  const genotype = new Map();
  try {
    if (typeof dna !== "string" || dna === "") return genotype;
    const dot = dna.lastIndexOf(".");
    const payload = dot === -1 ? dna : dna.slice(0, dot);
    const signature = dot === -1 ? "" : dna.slice(dot + 1);
    if (verify && verify(payload, signature) !== true) return genotype;
    for (const part of payload.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      const raw = part.slice(eq + 1).trim();
      if (!GENE_NAME.test(name) || !/^\d+$/.test(raw)) continue;
      genotype.set(name, Number(raw));
    }
  } catch {
    genotype.clear();
  }
  return genotype;
}

// Index of the allele to express, always within [0, count). Anything unexpected -> 0.
export function alleleIndex(genotype, name, count) {
  try {
    const i = genotype instanceof Map ? genotype.get(name) : undefined;
    return Number.isInteger(i) && i >= 0 && i < count ? i : 0;
  } catch {
    return 0;
  }
}

// gene(name, [default, ...variants]) -> the expressed variant.
export function createGene(genotype) {
  return function gene(name, alleles) {
    if (!Array.isArray(alleles) || alleles.length === 0) {
      throw new TypeError(`natsel: gene "${name}" needs at least one allele`);
    }
    return alleles[alleleIndex(genotype, name, alleles.length)];
  };
}

// HTML genes: <div data-gene="locus.name"><div data-allele>default</div><div data-allele hidden>…</div></div>
// Shows the chosen allele and hides the others. A gene that cannot be handled keeps its default.
export function applyGenes(root, genotype) {
  for (const el of root.querySelectorAll("[data-gene]")) {
    try {
      const alleles = [...el.children].filter((c) => c.hasAttribute("data-allele"));
      if (alleles.length === 0) continue;
      const chosen = alleleIndex(genotype, el.getAttribute("data-gene"), alleles.length);
      alleles.forEach((a, i) => { a.hidden = i !== chosen; });
    } catch {
      // keep whatever the HTML shows by default (the first allele)
    }
  }
}

// dna source in the browser: window.natsel.dna (set by the Breeder, TASK-70.8);
// for previews, ?dna=... in the URL. The Breeder checks the signature before it writes window.natsel.
export function browserDna(win) {
  try {
    const preview = new URL(win.location.href).searchParams.get("dna");
    if (preview) return preview;
    return win.natsel && typeof win.natsel.dna === "string" ? win.natsel.dna : "";
  } catch {
    return "";
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  try {
    const genotype = parseDna(browserDna(window));
    window.natsel = Object.assign(window.natsel || {}, { gene: createGene(genotype), genotype });
    const run = () => applyGenes(document, genotype);
    run();
    // Material's instant navigation swaps the page without a reload.
    if (window.document$ && typeof window.document$.subscribe === "function") window.document$.subscribe(run);
  } catch {
    // defaults stay on the page
  }
}
