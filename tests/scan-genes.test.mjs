import { test } from 'node:test';
import assert from 'node:assert/strict';
import { label, merge, scanHtml, scanJs } from '../scripts/scan-genes.mjs';

test('scanHtml: direct data-allele children are the alleles, in order', () => {
  const html = `<p>x</p><div data-gene="hero.headline"><div data-allele><h1>Evolve <a class="headerlink" href="#a">&para;</a></h1></div>
    <div data-allele hidden><p>Stop &amp; <em>go</em></p><div data-allele>nested, not an allele</div></div></div>
    <span data-gene="status.cta"><span data-allele><a href="#">Follow</a>.</span><span data-allele hidden>Star<br>it</span></span>`;
  assert.deepEqual(scanHtml(html), [
    { name: 'hero.headline', alleles: ['Evolve', 'Stop & go nested, not an allele'] },
    { name: 'status.cta', alleles: ['Follow.', 'Star it'] },
  ]);
});

test('scanHtml ignores comments and scripts', () => {
  assert.deepEqual(scanHtml('<!-- <div data-gene="a.b"></div> --><script>"<div data-gene=\'c.d\'>"</script>'), []);
});

test('scanJs: gene() and natsel.gene() calls with literal arrays', () => {
  const src = `const t = natsel.gene("hero.cta", ["Buy", 'Buy now, today', f(1, 2)]);
    gene('a.b', [{ x: [1, 2] }, \`t,\`]); gene(name, ["dynamic"]);`;
  assert.deepEqual(scanJs(src), [
    { name: 'hero.cta', alleles: ['Buy', 'Buy now, today', 'f(1, 2)'] },
    { name: 'a.b', alleles: ['{ x: [1, 2] }', 't,'] },
  ]);
});

test('merge checks the contract and dedupes genes across files', () => {
  const { genes, errors } = merge([
    { name: 'a.b', alleles: ['x', 'y'], source: 'index.html' },
    { name: 'a.b', alleles: ['x', 'y'], source: 'why/index.html' },
    { name: 'a.b', alleles: ['x', 'y', 'z'], source: 'app.js' },
    { name: 'Bad', alleles: ['x', 'y'], source: 'p.html' },
    { name: 'c.d', alleles: ['x'], source: 'p.html' },
  ]);
  assert.deepEqual(genes, [{ name: 'a.b', alleles: ['x', 'y'], sources: ['index.html', 'why/index.html'] }]);
  assert.equal(errors.length, 3);
});

test('label truncates long text', () => {
  assert.equal(label('a'.repeat(100)).length, 80);
});
