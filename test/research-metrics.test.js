import assert from "node:assert/strict";
import test from "node:test";
import {
  RAW_NUMERIC_COLUMNS,
  RESEARCH_SUMMARY_COLUMNS,
  buildBenchmarkSummary,
  buildCompressionMetrics,
  buildReconstructionMetrics,
  buildRoundTripMetrics,
  buildSkippedReason,
  classifyCompression,
  serializeResearchSummaryCsv,
  serializeRawNumericCsv,
  summarizeResearchRows,
} from "../lib/research-metrics.js";

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

const NON_NUMERIC_RAW_COLUMNS = new Set([
  "image_name",
  "was_resized",
  "processing_mode",
  "checksum_before",
  "checksum_after",
  "byte_identical",
  "rle_checksum_before",
  "rle_checksum_after",
  "rle_byte_identical",
  "huffman_checksum_before",
  "huffman_checksum_after",
  "huffman_byte_identical",
  "benchmark_enabled",
  "quantization_status",
  "skipped_reason",
  "rle_result_category",
  "huffman_result_category",
]);

const NUMERIC_RAW_COLUMNS = RAW_NUMERIC_COLUMNS.filter((column) => !NON_NUMERIC_RAW_COLUMNS.has(column));

function filledRawNumericRow() {
  const row = Object.fromEntries(RAW_NUMERIC_COLUMNS.map((column) => [column, ""]));
  Object.assign(row, {
    image_name: "sample.png",
    was_resized: true,
    processing_mode: "optimized",
    checksum_before: "abc",
    checksum_after: "abc",
    byte_identical: true,
    rle_checksum_before: "abc",
    rle_checksum_after: "abc",
    rle_byte_identical: true,
    huffman_checksum_before: "abc",
    huffman_checksum_after: "abc",
    huffman_byte_identical: true,
    benchmark_enabled: true,
    quantization_status: "PROCESSED",
    skipped_reason: "",
    rle_result_category: "EXPANDED",
    huffman_result_category: "REDUCED",
  });
  NUMERIC_RAW_COLUMNS.forEach((column, index) => {
    row[column] = index + 0.125;
  });
  return row;
}

test("CompressionMetrics terpisah dari ReconstructionMetrics dan memiliki baseline", () => {
  const compression = buildCompressionMetrics({
    inputBits: 100,
    compressedBits: 40,
    baselineType: "quantized-fixed-bit",
    baselineLabel: "Quantized fixed-bit data vs RLE theoretical payload",
  });
  const reconstruction = buildReconstructionMetrics(Uint8Array.from([10, 20]), Uint8Array.from([10, 18]), "rle-reconstruction");

  assert.equal(compression.compressionRatio, 2.5);
  assert.equal(compression.spaceSavingPercent, 60);
  assert.equal(compression.baselineType, "quantized-fixed-bit");
  assert.equal(compression.baselineLabel, "Quantized fixed-bit data vs RLE theoretical payload");
  assert.equal("mse" in compression, false);
  assert.equal(reconstruction.source, "working-grayscale");
  assert.equal(reconstruction.target, "rle-reconstruction");
  assert.equal("compressionRatio" in reconstruction, false);
});

test("RoundTripMetrics terpisah dan MSE nol hanya saat array identik", () => {
  const identical = buildRoundTripMetrics(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 3]));
  const changed = buildRoundTripMetrics(Uint8Array.from([1, 2, 3]), Uint8Array.from([1, 2, 4]));

  assert.equal(identical.mse, 0);
  assert.equal(identical.psnr, Infinity);
  assert.equal(identical.differentPixelCount, 0);
  assert.equal(identical.isByteIdentical, true);
  assert.ok(changed.mse > 0);
  assert.equal(changed.differentPixelCount, 1);
  assert.equal(changed.maxAbsoluteDifference, 1);
  assert.equal(changed.isByteIdentical, false);
});

test("classification REDUCED, UNCHANGED, EXPANDED, SKIPPED memakai epsilon", () => {
  assert.equal(classifyCompression(1.2), "REDUCED");
  assert.equal(classifyCompression(1), "UNCHANGED");
  assert.equal(classifyCompression(0.8), "EXPANDED");
  assert.equal(classifyCompression(0), "SKIPPED");
});

test("raw numeric CSV memiliki BOM, banyak kolom, titik desimal, dan tanpa satuan numerik", () => {
  const row = Object.fromEntries(RAW_NUMERIC_COLUMNS.map((column) => [column, ""]));
  Object.assign(row, {
    image_name: "sample.png",
    source_file_size_bytes: 1024,
    source_pixel_count: 12,
    working_pixel_count: 12,
    quantization_level: 64,
    raw_working_grayscale_size_bits: 96,
    rle_compression_ratio: 1.25,
    huffman_space_saving_percent: -3.5,
    checksum_before: "abc",
    checksum_after: "abc",
    different_pixel_count: 0,
    max_absolute_difference: 0,
    byte_identical: true,
    rle_byte_identical: true,
    huffman_byte_identical: false,
    quantization_status: "PROCESSED",
    skipped_reason: "line one\nline two",
    rle_result_category: "REDUCED",
    huffman_result_category: "EXPANDED",
  });

  const csv = serializeRawNumericCsv([row]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [headerLine, dataLine] = csv.slice(1).split("\n");
  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(dataLine);
  assert.equal(headers.length, RAW_NUMERIC_COLUMNS.length);
  assert.equal(values.length, RAW_NUMERIC_COLUMNS.length);
  assert.equal(values[headers.indexOf("rle_compression_ratio")], "1.25");
  assert.equal(values[headers.indexOf("huffman_space_saving_percent")], "-3.5");
  assert.equal(values[headers.indexOf("rle_byte_identical")], "true");
  assert.equal(values[headers.indexOf("huffman_byte_identical")], "false");
  assert.doesNotMatch(values[headers.indexOf("raw_working_grayscale_size_bits")], /bit|ms|%|,/);
  assert.equal(values[headers.indexOf("skipped_reason")], "line one line two");
  for (const column of ["source_file_size_bytes", "source_pixel_count", "working_pixel_count", "quantization_level", "rle_compression_ratio", "huffman_space_saving_percent", "different_pixel_count"]) {
    const value = values[headers.indexOf(column)];
    assert.ok(Number.isFinite(Number(value)), `${column} harus dapat dikonversi menjadi number`);
    assert.doesNotMatch(value, /[a-zA-Z%]/);
  }
});

test("semua kolom numerik raw CSV dapat dikonversi tanpa unit dan memakai titik desimal", () => {
  const csv = serializeRawNumericCsv([filledRawNumericRow()]);
  const [headerLine, dataLine] = csv.slice(1).split("\n");
  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(dataLine);

  assert.equal(headers.length, RAW_NUMERIC_COLUMNS.length);
  assert.equal(values.length, RAW_NUMERIC_COLUMNS.length);
  for (const column of NUMERIC_RAW_COLUMNS) {
    const value = values[headers.indexOf(column)];
    assert.notEqual(value, "", `${column} harus terisi pada processed row`);
    assert.ok(!Number.isNaN(Number(value)), `${column} harus dapat dikonversi menjadi number`);
    assert.doesNotMatch(value, /[a-zA-Z%]/, `${column} tidak boleh punya unit`);
    assert.doesNotMatch(value, /,/, `${column} harus memakai titik desimal, bukan koma`);
  }
});

test("SKIPPED row tetap dapat diekspor untuk penelitian", () => {
  const skipped = Object.fromEntries(RAW_NUMERIC_COLUMNS.map((column) => [column, ""]));
  skipped.image_name = "skip.png";
  skipped.quantization_status = "SKIPPED";
  skipped.skipped_reason = buildSkippedReason();
  skipped.rle_result_category = "SKIPPED";
  skipped.huffman_result_category = "SKIPPED";

  const csv = serializeRawNumericCsv([skipped]);
  assert.match(csv, /SKIPPED/);
  assert.match(csv, /Requested quantization level is not below the detected source level/);
});

test("Reconstruction MSE RLE dan Huffman sama dengan kuantisasi ketika round-trip valid", () => {
  const gray = Uint8Array.from([0, 10, 20, 30]);
  const quantizedReconstruction = Uint8Array.from([0, 8, 22, 30]);
  const rleReconstruction = Uint8Array.from(quantizedReconstruction);
  const huffmanReconstruction = Uint8Array.from(quantizedReconstruction);

  const quant = buildReconstructionMetrics(gray, quantizedReconstruction, "quantized-reconstruction");
  const rle = buildReconstructionMetrics(gray, rleReconstruction, "rle-reconstruction");
  const huffman = buildReconstructionMetrics(gray, huffmanReconstruction, "huffman-reconstruction");

  assert.equal(rle.mse, quant.mse);
  assert.equal(huffman.mse, quant.mse);
  assert.equal(rle.psnr, quant.psnr);
  assert.equal(huffman.psnr, quant.psnr);
});

test("benchmark mean min max std benar dan waktu berpresisi 4 desimal di CSV", () => {
  const summary = buildBenchmarkSummary([
    { totalMs: 10, quantizationMs: 1, rleTotalMs: 4, huffmanTotalMs: 5 },
    { totalMs: 20, quantizationMs: 2, rleTotalMs: 8, huffmanTotalMs: 10 },
    { totalMs: 30, quantizationMs: 3, rleTotalMs: 12, huffmanTotalMs: 15 },
    { totalMs: 40, quantizationMs: 4, rleTotalMs: 16, huffmanTotalMs: 20 },
    { totalMs: 50, quantizationMs: 5, rleTotalMs: 20, huffmanTotalMs: 25 },
  ]);
  assert.equal(summary.warmupRuns, 1);
  assert.equal(summary.measuredRuns, 5);
  assert.equal(summary.totalMeanMs, 30);
  assert.equal(summary.totalMinMs, 10);
  assert.equal(summary.totalMaxMs, 50);
  assert.ok(Math.abs(summary.totalStdMs - Math.sqrt(200)) < 1e-12);
  assert.equal(summary.quantizationMeanMs, 3);

  const row = Object.fromEntries(RAW_NUMERIC_COLUMNS.map((column) => [column, ""]));
  row.benchmark_total_mean_ms = summary.totalMeanMs;
  const csv = serializeRawNumericCsv([row]).slice(1);
  const [headerLine, dataLine] = csv.split("\n");
  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(dataLine);
  assert.equal(values[headers.indexOf("benchmark_total_mean_ms")], "30.0000");
});

test("ringkasan penelitian menghitung kategori, rata-rata, best, dan worst", () => {
  const rows = [
    {
      image_name: "a.png",
      quantization_level: 64,
      quantization_status: "PROCESSED",
      rle_result_category: "REDUCED",
      huffman_result_category: "EXPANDED",
      rle_compression_ratio: 2,
      huffman_compression_ratio: 0.5,
      rle_space_saving_percent: 50,
      huffman_space_saving_percent: -100,
      reconstruction_mse: 4,
      reconstruction_psnr_db: 30,
      benchmark_total_mean_ms: 10,
    },
    {
      image_name: "b.png",
      quantization_level: 64,
      quantization_status: "SKIPPED",
      rle_result_category: "SKIPPED",
      huffman_result_category: "SKIPPED",
    },
    {
      image_name: "c.png",
      quantization_level: 64,
      quantization_status: "PROCESSED",
      rle_result_category: "UNCHANGED",
      huffman_result_category: "REDUCED",
      rle_compression_ratio: 1,
      huffman_compression_ratio: 3,
      rle_space_saving_percent: 0,
      huffman_space_saving_percent: 66.6667,
      reconstruction_mse: 2,
      reconstruction_psnr_db: 35,
      benchmark_total_mean_ms: 20,
    },
  ];
  const [summary] = summarizeResearchRows(rows);
  assert.equal(summary.reduced_count, 2);
  assert.equal(summary.unchanged_count, 1);
  assert.equal(summary.expanded_count, 1);
  assert.equal(summary.skipped_count, 1);
  assert.equal(summary.rle_mean_compression_ratio, 1.5);
  assert.equal(summary.mean_reconstruction_mse, 3);
  assert.equal(summary.mean_total_time_ms, 15);
  assert.equal(summary.best_case_image, "c.png");
  assert.equal(summary.best_case_method, "Huffman");
  assert.equal(summary.worst_case_image, "a.png");
  assert.equal(summary.worst_case_method, "Huffman");

  const csv = serializeResearchSummaryCsv([summary]);
  const [headerLine, dataLine] = csv.slice(1).split("\n");
  assert.equal(parseCsvLine(headerLine).length, RESEARCH_SUMMARY_COLUMNS.length);
  assert.equal(parseCsvLine(dataLine).length, RESEARCH_SUMMARY_COLUMNS.length);
});
