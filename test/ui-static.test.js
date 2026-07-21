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
  assert.match(page, /Kontrol input:/);
  assert.match(page, /Hasil utama:/);
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
  for (const label of ["Zoom In", "Zoom Out", "Geser Kiri", "Geser Kanan", "Geser Atas", "Geser Bawah", "Fit to Screen", "Center Root", "Expand Fullscreen", "Reset", "Export SVG", "Export PNG"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /Mode Sederhana/);
  assert.match(page, /Mode Detail/);
  assert.match(page, /Cari simbol/);
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
  assert.match(page, /multi-level-table-wrapper/);
  assert.match(page, /MULTI_LEVEL_TABS/);
  assert.match(css, /multi-level-table th/);
  assert.match(css, /position:\s*sticky/);
});

test("UI memisahkan kualitas rekonstruksi dan validasi round-trip", () => {
  for (const label of ["Reconstruction MSE", "Reconstruction PSNR", "Round-trip MSE", "Round-trip PSNR", "Status Validasi", "Waktu Total"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /Validasi Lossless \/ Round-trip/);
  assert.match(page, /buildReconstructionQualityMetrics/);
  assert.match(page, /buildRoundTripValidationMetrics/);
  assert.doesNotMatch(page, /finalMetrics/);
  assert.match(page, /primaryCompressionMetrics/);
  assert.match(page, /primaryReconstructionMetrics/);
});

test("UI menjelaskan resolusi sumber dan resolusi kerja", () => {
  assert.match(page, /Mode Resolusi/);
  assert.match(page, /Resolusi Pemrosesan/);
  assert.match(page, /Resolusi sumber/);
  assert.match(page, /Resolusi kerja/);
  assert.match(page, /Seluruh ukuran algoritmik, MSE, PSNR, dan waktu proses dihitung berdasarkan resolusi kerja/);
  assert.match(css, /resolution-panel/);
  assert.match(css, /warning-note/);
});

test("RLE dan histogram memakai ringkasan agar tabel besar tidak menumpuk", () => {
  assert.match(page, /RleRowSummaryTable/);
  assert.match(page, /sampleRlePairs/);
  assert.match(page, /Lihat tabel lengkap histogram/);
  assert.match(css, /histogram-chart/);
  assert.match(css, /inline-disclosure/);
});

test("Tabel pasangan RLE tidak mengakses state evaluasi global", () => {
  const match = page.match(/function RlePairsTable[\s\S]*?function RleRowSummaryTable/);
  assert.ok(match, "komponen RlePairsTable harus ditemukan");
  assert.doesNotMatch(match[0], /result\./);
});

test("UI menyediakan CSV penelitian raw numeric dan label ukuran eksplisit", () => {
  assert.match(page, /Unduh CSV Penelitian - Raw Numeric/);
  for (const label of [
    "Source File Size (Disk)",
    "Raw Source Grayscale Size",
    "Raw Working Grayscale Size",
    "Quantized Fixed-bit Size",
    "RLE Theoretical Payload",
    "Huffman Theoretical Payload",
    "Estimated Export Size",
  ]) {
    assert.match(page, new RegExp(label.replace(/[()]/g, "\\$&")));
  }
  assert.match(page, /Payload teoritis tidak termasuk seluruh metadata dan struktur file/);
  assert.match(page, /Estimasi ukuran export JSON, bukan format biner optimal/);
});

test("Timing detail Huffman dan RLE tersimpan di model", () => {
  for (const token of [
    "frequencyTableMs",
    "treeBuildMs",
    "codebookBuildMs",
    "bitstreamEncodeMs",
    "bitPackingMs",
    "inverseQuantizationMs",
    "validationMs",
  ]) {
    assert.match(page, new RegExp(token));
  }
});
