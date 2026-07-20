import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/page.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("UI workflow memakai 7 tahap pembelajaran utama", () => {
  assert.match(page, /Input Citra/);
  assert.match(page, /Grayscale/);
  assert.match(page, /Kuantisasi/);
  assert.match(page, /RLE/);
  assert.match(page, /Huffman/);
  assert.match(page, /Dekompresi/);
  assert.match(page, /Evaluasi/);
  assert.doesNotMatch(page, /"Histogram", "Kuantisasi"/);
  assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /position:\s*sticky/);
});

test("UI memakai progressive disclosure untuk detail akademik", () => {
  assert.match(page, /Tabs tabs=\{\["Ringkasan", "Pasangan per Baris", "Dekompresi", "Penjelasan"\]\}/);
  assert.match(page, /Tabs tabs=\{\["Tabel Frekuensi", "Tahap Penggabungan", "Pohon Huffman", "Kode Biner", "Bitstream", "Dekompresi"\]\}/);
  assert.match(page, /details className="table-section disclosure"/);
  assert.match(page, /Apa arti hasil ini\?/);
  assert.match(page, /Unggah citra untuk memulai analisis/);
});

test("UI menjelaskan istilah teknis dengan tooltip", () => {
  for (const term of ["histogram", "intensitas", "simbol", "run", "bit depth", "payload", "overhead", "codebook", "bitstream", "round-trip", "MSE", "PSNR"]) {
    assert.ok(page.includes(`${term}:`) || page.includes(`"${term}":`), `tooltip ${term} harus tersedia`);
  }
  assert.match(css, /\.term:hover::after/);
  assert.match(css, /\.term:focus::after/);
});

test("UI responsive tidak memakai grid hasil yang terlalu padat", () => {
  assert.doesNotMatch(css, /preview-grid[\s\S]*repeat\(5/);
  assert.match(css, /summary-grid[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /preview-grid[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /decompression-grid[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /button\s*\{[\s\S]*min-height:\s*44px/);
});

test("Pohon Huffman besar dan mempunyai kontrol navigasi", () => {
  assert.match(css, /tree-wrap[\s\S]*min-height:\s*600px/);
  for (const label of ["Zoom In", "Zoom Out", "Geser Kiri", "Geser Kanan", "Geser Atas", "Geser Bawah", "Fit to Screen", "Reset", "Export SVG", "Export PNG"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /Simplified Tree \/ Top Symbols View/);
});

test("Pipeline comparison mode tidak ambigu", () => {
  assert.match(page, /Kuantisasi \+ Perbandingan RLE dan Huffman/);
  assert.doesNotMatch(page, /Kuantisasi \+ RLE \+ Huffman/);
  assert.match(page, /RLE dan Huffman dibandingkan sebagai dua metode setelah kuantisasi/);
});

test("Dataset recap dan multi-level testing tersedia", () => {
  for (const format of ["JPG/JPEG", "PNG", "BMP", "TIFF"]) {
    assert.match(page, new RegExp(format.replace("/", "\\/")));
  }
  assert.match(page, /Run Multi-Level Test/);
  assert.match(page, /MULTI_LEVEL_COLUMNS/);
  assert.match(page, /Unduh CSV Multi-Level/);
  assert.match(page, /Minimum rekomendasi 5 citra per format/);
});

test("Wide table memiliki compact view dan kolom sticky penting", () => {
  assert.match(page, /analysisTableView/);
  assert.match(page, /\["Ringkas", "Detail"\]/);
  assert.match(css, /multi-table th:nth-child\(2\)/);
  assert.match(css, /position:\s*sticky/);
});
