import assert from "node:assert/strict";
import test from "node:test";
import * as researchMetrics from "../lib/research-metrics.js";
import {
  RAW_NUMERIC_COLUMNS,
  RESEARCH_SUMMARY_COLUMNS,
  buildBenchmarkSummary,
  buildCompressionMetrics,
  buildDetectedFixedBitSizeBits,
  buildGrayscaleRawSizeBits,
  buildReconstructionMetrics,
  buildRoundTripMetrics,
  buildSkippedReason,
  classifyContentCategory,
  classifyCompression,
  serializeAnomalySummaryCsv,
  serializeResearchSummaryCsv,
  serializeRawNumericCsv,
  serializeSummaryByContentCategoryCsv,
  serializeSummaryByFormatCsv,
  serializeTimingSummaryCsv,
  summarizeAnomalyRows,
  summarizeResearchRows,
  summarizeResearchRowsByContentCategory,
  summarizeResearchRowsByFormat,
  summarizeTimingRows,
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
  "source_format",
  "content_category",
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
  "timing_measurement_mode",
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
    source_format: "PNG",
    content_category: "nature",
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
    timing_measurement_mode: "SINGLE_RUN_PER_IMAGE_LEVEL",
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
    source_format: "PNG",
    content_category: "nature",
    source_file_size_bytes: 1024,
    source_pixel_count: 12,
    working_pixel_count: 12,
    detected_source_level: 64,
    detected_source_bit_depth: 6,
    detected_source_fixed_bit_size_bits: 72,
    quantization_level: 64,
    raw_source_grayscale_size_bits: 96,
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
  assert.equal(values[headers.indexOf("source_format")], "PNG");
  assert.equal(values[headers.indexOf("huffman_space_saving_percent")], "-3.5");
  assert.equal(values[headers.indexOf("rle_byte_identical")], "true");
  assert.equal(values[headers.indexOf("huffman_byte_identical")], "false");
  assert.doesNotMatch(values[headers.indexOf("raw_working_grayscale_size_bits")], /bit|ms|%|,/);
  assert.equal(values[headers.indexOf("skipped_reason")], "line one line two");
  for (const column of ["source_file_size_bytes", "source_pixel_count", "working_pixel_count", "detected_source_level", "detected_source_bit_depth", "detected_source_fixed_bit_size_bits", "quantization_level", "rle_compression_ratio", "huffman_space_saving_percent", "different_pixel_count"]) {
    const value = values[headers.indexOf(column)];
    assert.ok(Number.isFinite(Number(value)), `${column} harus dapat dikonversi menjadi number`);
    assert.doesNotMatch(value, /[a-zA-Z%]/);
  }
});

test("grayscale raw size selalu pixel_count x 8 dan detected fixed-bit memakai detected bit depth", () => {
  assert.equal(buildGrayscaleRawSizeBits(12), 96);
  assert.equal(buildGrayscaleRawSizeBits(1200475), 9603800);
  assert.equal(buildDetectedFixedBitSizeBits(12, 6), 72);
  assert.notEqual(buildDetectedFixedBitSizeBits(12, 6), buildGrayscaleRawSizeBits(12));
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
  skipped.source_format = "PNG";
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
    { quantizationMs: 1, rleEncodeMs: 2, rleDecodeMs: 2, rleTotalMs: 4, huffmanFrequencyMs: 1, huffmanTreeMs: 1, huffmanCodebookMs: 1, huffmanEncodeMs: 2, huffmanDecodeMs: 3, huffmanTotalMs: 5 },
    { quantizationMs: 2, rleEncodeMs: 4, rleDecodeMs: 4, rleTotalMs: 8, huffmanFrequencyMs: 2, huffmanTreeMs: 2, huffmanCodebookMs: 2, huffmanEncodeMs: 4, huffmanDecodeMs: 6, huffmanTotalMs: 10 },
    { quantizationMs: 3, rleEncodeMs: 6, rleDecodeMs: 6, rleTotalMs: 12, huffmanFrequencyMs: 3, huffmanTreeMs: 3, huffmanCodebookMs: 3, huffmanEncodeMs: 6, huffmanDecodeMs: 9, huffmanTotalMs: 15 },
    { quantizationMs: 4, rleEncodeMs: 8, rleDecodeMs: 8, rleTotalMs: 16, huffmanFrequencyMs: 4, huffmanTreeMs: 4, huffmanCodebookMs: 4, huffmanEncodeMs: 8, huffmanDecodeMs: 12, huffmanTotalMs: 20 },
    { quantizationMs: 5, rleEncodeMs: 10, rleDecodeMs: 10, rleTotalMs: 20, huffmanFrequencyMs: 5, huffmanTreeMs: 5, huffmanCodebookMs: 5, huffmanEncodeMs: 10, huffmanDecodeMs: 15, huffmanTotalMs: 25 },
  ]);
  assert.equal(summary.warmupRuns, 1);
  assert.equal(summary.measuredRuns, 5);
  assert.equal(summary.quantizationMeanMs, 3);
  assert.equal(summary.quantizationMinMs, 1);
  assert.equal(summary.quantizationMaxMs, 5);
  assert.ok(Math.abs(summary.quantizationStdMs - Math.sqrt(2.5)) < 1e-12);
  assert.equal(summary.rleEncodeMeanMs, 6);
  assert.equal(summary.rleTotalMeanMs, 12);
  assert.equal(summary.huffmanFrequencyMeanMs, 3);
  assert.equal(summary.huffmanTotalMeanMs, 15);

  const row = Object.fromEntries(RAW_NUMERIC_COLUMNS.map((column) => [column, ""]));
  row.benchmark_quantization_mean_ms = summary.quantizationMeanMs;
  const csv = serializeRawNumericCsv([row]).slice(1);
  const [headerLine, dataLine] = csv.split("\n");
  const headers = parseCsvLine(headerLine);
  const values = parseCsvLine(dataLine);
  assert.equal(values[headers.indexOf("benchmark_quantization_mean_ms")], "3.0000");
});

test("ringkasan penelitian menghitung kategori, rata-rata, best, dan worst", () => {
  const rows = [
    {
      image_name: "a.png",
      source_format: "PNG",
      content_category: "NATURAL_PHOTO",
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
      quantization_time_ms: 1,
      rle_total_ms: 4,
      huffman_total_ms: 5,
      timing_measurement_mode: "SINGLE_RUN_PER_IMAGE_LEVEL",
    },
    {
      image_name: "b.png",
      source_format: "PNG",
      content_category: "NATURAL_PHOTO",
      quantization_level: 64,
      quantization_status: "SKIPPED",
      rle_result_category: "SKIPPED",
      huffman_result_category: "SKIPPED",
      skipped_reason: buildSkippedReason(),
    },
    {
      image_name: "c.png",
      source_format: "JPG/JPEG",
      content_category: "TEXTURE_PATTERN",
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
      quantization_time_ms: 2,
      rle_total_ms: 8,
      huffman_total_ms: 10,
      timing_measurement_mode: "SINGLE_RUN_PER_IMAGE_LEVEL",
    },
  ];
  const [summary] = summarizeResearchRows(rows);
  assert.equal(summary.processed_row_count, 2);
  assert.equal(summary.skipped_count, 1);
  assert.equal(summary.rle_reduced_count, 1);
  assert.equal(summary.rle_unchanged_count, 1);
  assert.equal(summary.rle_expanded_count, 0);
  assert.equal(summary.huffman_reduced_count, 1);
  assert.equal(summary.huffman_unchanged_count, 0);
  assert.equal(summary.huffman_expanded_count, 1);
  assert.equal(summary.rle_reduced_count + summary.rle_unchanged_count + summary.rle_expanded_count, summary.processed_row_count);
  assert.equal(summary.huffman_reduced_count + summary.huffman_unchanged_count + summary.huffman_expanded_count, summary.processed_row_count);
  assert.equal(summary.rle_mean_compression_ratio, 1.5);
  assert.equal(summary.mean_reconstruction_mse, 3);
  assert.equal(summary.mean_combined_experiment_time_ms, 15);
  assert.equal(summary.mean_single_run_quantization_time_ms, 1.5);
  assert.equal(summary.mean_single_run_rle_total_time_ms, 6);
  assert.equal(summary.mean_single_run_huffman_total_time_ms, 7.5);
  assert.equal(summary.best_case_image, "c.png");
  assert.equal(summary.best_case_method, "Huffman");
  assert.equal(summary.worst_case_image, "a.png");
  assert.equal(summary.worst_case_method, "Huffman");

  const csv = serializeResearchSummaryCsv([summary]);
  const [headerLine, dataLine] = csv.slice(1).split("\n");
  assert.equal(parseCsvLine(headerLine).length, RESEARCH_SUMMARY_COLUMNS.length);
  assert.equal(parseCsvLine(dataLine).length, RESEARCH_SUMMARY_COLUMNS.length);

  const [formatSummary] = summarizeResearchRowsByFormat(rows);
  const formatCsv = serializeSummaryByFormatCsv([formatSummary]);
  assert.equal(parseCsvLine(formatCsv.slice(1).split("\n")[0]).includes("source_format"), true);

  const [contentSummary] = summarizeResearchRowsByContentCategory(rows);
  assert.equal(contentSummary.content_category, "NATURAL_PHOTO");
  assert.equal(contentSummary.image_count, 2);
  const contentCsv = serializeSummaryByContentCategoryCsv([contentSummary]);
  assert.equal(parseCsvLine(contentCsv.slice(1).split("\n")[0]).includes("content_category"), true);

  const anomalies = summarizeAnomalyRows(rows);
  assert.ok(anomalies.some((row) => row.anomaly_type === "SKIPPED_LEVEL"));
  assert.ok(anomalies.some((row) => row.anomaly_type === "HUFFMAN_EXPANDED"));
  const anomalyCsv = serializeAnomalySummaryCsv(anomalies);
  assert.equal(parseCsvLine(anomalyCsv.slice(1).split("\n")[0]).includes("anomaly_type"), true);

  const timing = summarizeTimingRows(rows);
  assert.equal(timing[0].mean_single_run_quantization_time_ms, 1.5);
  assert.equal(timing[0].timing_measurement_mode, "SINGLE_RUN_PER_IMAGE_LEVEL");
  assert.match(timing[0].timing_explanation, /mean lintas citra/);
  const timingCsv = serializeTimingSummaryCsv(timing);
  assert.equal(parseCsvLine(timingCsv.slice(1).split("\n")[0]).includes("mean_combined_experiment_time_ms"), true);
});

test("seluruh status skipped memiliki alasan", () => {
  const rows = [
    { image_name: "a.png", source_format: "PNG", quantization_level: 256, quantization_status: "SKIPPED", skipped_reason: buildSkippedReason(), rle_result_category: "SKIPPED", huffman_result_category: "SKIPPED" },
    { image_name: "b.png", source_format: "PNG", quantization_level: 128, quantization_status: "PROCESSED", skipped_reason: "", rle_result_category: "REDUCED", huffman_result_category: "REDUCED" },
  ];
  assert.ok(rows.filter((row) => row.quantization_status === "SKIPPED").every((row) => row.skipped_reason));
});

test("kategori konten berasal dari mapping dan tidak pernah unlabeled", () => {
  assert.equal(classifyContentCategory("abstrak.png"), "SMOOTH_GRADIENT");
  assert.equal(classifyContentCategory("jalan.tiff"), "NATURAL_PHOTO");
  assert.equal(classifyContentCategory("unknown-file.png"), "UNCLASSIFIED");
  assert.notEqual(classifyContentCategory("unknown-file.png"), "unlabeled");
});

test("nama citra mendapat kategori konsisten di seluruh level", () => {
  const rows = [128, 64, 32, 16, 8].map((level) => ({
    image_name: "pola.png",
    quantization_level: level,
    content_category: classifyContentCategory("pola.png"),
  }));
  assert.equal(new Set(rows.map((row) => row.content_category)).size, 1);
  assert.equal(rows[0].content_category, "TEXTURE_PATTERN");
});

test("HUFFMAN_UNCHANGED masuk anomaly summary dan jumlahnya sama dengan raw numeric", () => {
  const rows = [
    {
      image_name: "logo.bmp",
      source_format: "BMP",
      content_category: "HOMOGENEOUS_GRAPHIC",
      quantization_level: 64,
      quantization_status: "PROCESSED",
      quantized_size_bits: 600,
      rle_payload_bits: 900,
      huffman_payload_bits: 600,
      rle_estimated_export_bytes: 100,
      huffman_estimated_export_bytes: 80,
      rle_result_category: "EXPANDED",
      huffman_result_category: "UNCHANGED",
      rle_compression_ratio: 600 / 900,
      huffman_compression_ratio: 1,
      rle_space_saving_percent: -50,
      huffman_space_saving_percent: 0,
      byte_identical: true,
      different_pixel_count: 0,
      max_absolute_difference: 0,
    },
    {
      image_name: "pola.png",
      source_format: "PNG",
      content_category: "TEXTURE_PATTERN",
      quantization_level: 64,
      quantization_status: "PROCESSED",
      quantized_size_bits: 600,
      rle_payload_bits: 300,
      huffman_payload_bits: 300,
      rle_estimated_export_bytes: 40,
      huffman_estimated_export_bytes: 40,
      rle_result_category: "REDUCED",
      huffman_result_category: "REDUCED",
      rle_compression_ratio: 2,
      huffman_compression_ratio: 2,
      byte_identical: true,
      different_pixel_count: 0,
      max_absolute_difference: 0,
    },
  ];
  const anomalies = summarizeAnomalyRows(rows);
  const rawUnchanged = rows.filter((row) => row.huffman_result_category === "UNCHANGED" || Math.abs(row.huffman_compression_ratio - 1) <= 1e-9).length;
  const anomalyUnchanged = anomalies.filter((row) => row.anomaly_type === "HUFFMAN_UNCHANGED");
  assert.equal(anomalyUnchanged.length, rawUnchanged);
  assert.match(anomalyUnchanged[0].explanation, /Payload Huffman sama dengan baseline fixed-bit/);

  const sameCombination = anomalies.filter((row) => row.image_name === "logo.bmp" && row.quantization_level === 64);
  assert.ok(sameCombination.length >= 2);
  assert.ok(sameCombination.some((row) => row.anomaly_type === "RLE_EXPANDED"));
  assert.ok(sameCombination.some((row) => row.anomaly_type === "HUFFMAN_UNCHANGED"));
});

test("export dan utility controlled resolution sudah dihapus dari library penelitian", () => {
  for (const removedExport of [
    "RESOLUTION_EXPERIMENT_CONTENT_IDS",
    "RESOLUTION_EXPERIMENT_LEVELS",
    "RESOLUTION_EXPERIMENT_RESOLUTIONS",
    "buildResolutionExperimentRows",
    "serializeResolutionExperimentRawCsv",
    "serializeSummaryByResolutionCsv",
    "summarizeResolutionExperimentRows",
    "validateControlledResolutionExperimentRows",
  ]) {
    assert.equal(removedExport in researchMetrics, false, `${removedExport} tidak boleh diekspor lagi`);
  }
});
