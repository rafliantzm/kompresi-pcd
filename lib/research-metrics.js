import { arraysEqual, checksum as dataChecksum, metricSet } from "./compression-core.js";

export const COMPRESSION_EPSILON = 1e-9;

export const RAW_NUMERIC_COLUMNS = [
  "image_name",
  "source_file_size_bytes",
  "source_width",
  "source_height",
  "source_pixel_count",
  "working_width",
  "working_height",
  "working_pixel_count",
  "was_resized",
  "resize_scale",
  "processing_mode",
  "quantization_level",
  "raw_source_grayscale_size_bits",
  "raw_working_grayscale_size_bits",
  "quantized_size_bits",
  "rle_payload_bits",
  "huffman_payload_bits",
  "rle_estimated_export_bytes",
  "huffman_estimated_export_bytes",
  "rle_compression_ratio",
  "huffman_compression_ratio",
  "rle_space_saving_percent",
  "huffman_space_saving_percent",
  "reconstruction_mse",
  "reconstruction_psnr_db",
  "checksum_before",
  "checksum_after",
  "different_pixel_count",
  "max_absolute_difference",
  "byte_identical",
  "rle_roundtrip_mse",
  "rle_roundtrip_psnr_db",
  "rle_pixel_difference_count",
  "rle_max_absolute_difference",
  "rle_checksum_before",
  "rle_checksum_after",
  "rle_byte_identical",
  "huffman_roundtrip_mse",
  "huffman_roundtrip_psnr_db",
  "huffman_pixel_difference_count",
  "huffman_max_absolute_difference",
  "huffman_checksum_before",
  "huffman_checksum_after",
  "huffman_byte_identical",
  "quantization_time_ms",
  "rle_encode_ms",
  "rle_decode_ms",
  "rle_inverse_quantization_ms",
  "rle_validation_ms",
  "rle_total_ms",
  "huffman_frequency_ms",
  "huffman_tree_build_ms",
  "huffman_codebook_ms",
  "huffman_bitstream_encode_ms",
  "huffman_pack_ms",
  "huffman_decode_ms",
  "huffman_inverse_quantization_ms",
  "huffman_validation_ms",
  "huffman_total_ms",
  "benchmark_enabled",
  "benchmark_warmup_runs",
  "benchmark_measured_runs",
  "benchmark_total_mean_ms",
  "benchmark_total_min_ms",
  "benchmark_total_max_ms",
  "benchmark_total_std_ms",
  "benchmark_quantization_mean_ms",
  "benchmark_rle_total_mean_ms",
  "benchmark_huffman_total_mean_ms",
  "quantization_status",
  "skipped_reason",
  "rle_result_category",
  "huffman_result_category",
];

export const RESEARCH_SUMMARY_COLUMNS = [
  "quantization_level",
  "row_count",
  "reduced_count",
  "unchanged_count",
  "expanded_count",
  "skipped_count",
  "rle_mean_compression_ratio",
  "huffman_mean_compression_ratio",
  "rle_mean_space_saving_percent",
  "huffman_mean_space_saving_percent",
  "mean_reconstruction_mse",
  "mean_reconstruction_psnr_db",
  "mean_total_time_ms",
  "best_case_image",
  "best_case_method",
  "best_case_compression_ratio",
  "worst_case_image",
  "worst_case_method",
  "worst_case_compression_ratio",
];

export function buildCompressionMetrics({ inputBits, compressedBits, baselineType, baselineLabel }) {
  return {
    inputBits,
    compressedBits,
    compressionRatio: compressedBits > 0 ? inputBits / compressedBits : 0,
    spaceSavingPercent: compressedBits > 0 ? (1 - compressedBits / inputBits) * 100 : 0,
    baselineType,
    baselineLabel,
  };
}

export function buildReconstructionMetrics(reference, targetData, target) {
  const metrics = metricSet(reference, targetData, reference.length * 8, targetData.length * 8);
  return {
    mse: metrics.mse,
    psnr: metrics.psnr,
    source: "working-grayscale",
    target,
  };
}

export function buildRoundTripMetrics(beforeCodes, afterCodes, checksumBefore = dataChecksum(beforeCodes)) {
  const metrics = metricSet(beforeCodes, afterCodes, beforeCodes.length * 8, afterCodes.length * 8);
  const differentPixelCount = countDifferences(beforeCodes, afterCodes);
  const checksumAfter = dataChecksum(afterCodes);
  return {
    mse: metrics.mse,
    psnr: metrics.psnr,
    differentPixelCount,
    maxAbsoluteDifference: maxAbsoluteDifference(beforeCodes, afterCodes),
    checksumBefore,
    checksumAfter,
    isByteIdentical: arraysEqual(beforeCodes, afterCodes),
  };
}

export function classifyCompression(compressionRatio, epsilon = COMPRESSION_EPSILON) {
  if (!Number.isFinite(compressionRatio) || compressionRatio <= 0) return "SKIPPED";
  if (compressionRatio > 1 + epsilon) return "REDUCED";
  if (compressionRatio < 1 - epsilon) return "EXPANDED";
  return "UNCHANGED";
}

export function buildSkippedReason() {
  return "Requested quantization level is not below the detected source level, so no level reduction would occur.";
}

export function serializeRawNumericCsv(rows) {
  const csv = [RAW_NUMERIC_COLUMNS, ...rows.map((row) => RAW_NUMERIC_COLUMNS.map((column) => row[column] ?? ""))]
    .map((row, rowIndex) => row.map((value, columnIndex) => formatRawCell(value, rowIndex === 0 ? null : RAW_NUMERIC_COLUMNS[columnIndex])).join(","))
    .join("\n");
  return `\uFEFF${csv}`;
}

export function serializeResearchSummaryCsv(rows) {
  const csv = [RESEARCH_SUMMARY_COLUMNS, ...rows.map((row) => RESEARCH_SUMMARY_COLUMNS.map((column) => row[column] ?? ""))]
    .map((row, rowIndex) => row.map((value, columnIndex) => formatRawCell(value, rowIndex === 0 ? null : RESEARCH_SUMMARY_COLUMNS[columnIndex])).join(","))
    .join("\n");
  return `\uFEFF${csv}`;
}

export function formatRawCell(value, column = null) {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "";
    if (!Number.isFinite(value)) return "";
    if (column && /(^|_)time_ms$|_ms$/.test(column)) return value.toFixed(4);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ");
  return `"${text.replaceAll('"', '""')}"`;
}

export function benchmarkStats(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return { mean: 0, min: 0, max: 0, std: 0, count: 0 };
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  return {
    mean,
    min: Math.min(...clean),
    max: Math.max(...clean),
    std: Math.sqrt(variance),
    count: clean.length,
  };
}

export function buildBenchmarkSummary(measuredRuns) {
  const total = benchmarkStats(measuredRuns.map((run) => run.totalMs));
  return {
    warmupRuns: 1,
    measuredRuns: measuredRuns.length,
    totalMeanMs: total.mean,
    totalMinMs: total.min,
    totalMaxMs: total.max,
    totalStdMs: total.std,
    quantizationMeanMs: benchmarkStats(measuredRuns.map((run) => run.quantizationMs)).mean,
    rleTotalMeanMs: benchmarkStats(measuredRuns.map((run) => run.rleTotalMs)).mean,
    huffmanTotalMeanMs: benchmarkStats(measuredRuns.map((run) => run.huffmanTotalMs)).mean,
  };
}

export function summarizeResearchRows(rows) {
  const byLevel = new Map();
  for (const row of rows) {
    const level = row.quantization_level ?? row.requested_level ?? "unknown";
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(row);
  }
  return [...byLevel.entries()].map(([level, levelRows]) => summarizeLevelRows(level, levelRows));
}

function summarizeLevelRows(level, rows) {
  const processed = rows.filter((row) => row.quantization_status !== "SKIPPED");
  const methodCases = processed.flatMap((row) => [
    { image: row.image_name, method: "RLE", cr: row.rle_compression_ratio },
    { image: row.image_name, method: "Huffman", cr: row.huffman_compression_ratio },
  ]).filter((item) => Number.isFinite(item.cr));
  const best = methodCases.reduce((winner, item) => !winner || item.cr > winner.cr ? item : winner, null);
  const worst = methodCases.reduce((loser, item) => !loser || item.cr < loser.cr ? item : loser, null);
  return {
    quantization_level: level,
    row_count: rows.length,
    reduced_count: countCategories(rows, "REDUCED"),
    unchanged_count: countCategories(rows, "UNCHANGED"),
    expanded_count: countCategories(rows, "EXPANDED"),
    skipped_count: rows.filter((row) => row.quantization_status === "SKIPPED").length,
    rle_mean_compression_ratio: mean(processed.map((row) => row.rle_compression_ratio)),
    huffman_mean_compression_ratio: mean(processed.map((row) => row.huffman_compression_ratio)),
    rle_mean_space_saving_percent: mean(processed.map((row) => row.rle_space_saving_percent)),
    huffman_mean_space_saving_percent: mean(processed.map((row) => row.huffman_space_saving_percent)),
    mean_reconstruction_mse: mean(processed.map((row) => row.reconstruction_mse)),
    mean_reconstruction_psnr_db: mean(processed.map((row) => row.reconstruction_psnr_db).filter(Number.isFinite)),
    mean_total_time_ms: mean(processed.map((row) => row.benchmark_total_mean_ms || row.rle_total_ms + row.huffman_total_ms)),
    best_case_image: best?.image ?? "",
    best_case_method: best?.method ?? "",
    best_case_compression_ratio: best?.cr ?? "",
    worst_case_image: worst?.image ?? "",
    worst_case_method: worst?.method ?? "",
    worst_case_compression_ratio: worst?.cr ?? "",
  };
}

function countCategories(rows, category) {
  return rows.reduce((sum, row) => sum
    + (row.rle_result_category === category ? 1 : 0)
    + (row.huffman_result_category === category ? 1 : 0), 0);
}

function mean(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : "";
}

export function countDifferences(a, b) {
  if (!a || !b) return 0;
  const length = Math.min(a.length, b.length);
  let count = Math.abs(a.length - b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) count += 1;
  }
  return count;
}

export function maxAbsoluteDifference(a, b) {
  if (!a || !b) return 0;
  const length = Math.min(a.length, b.length);
  let max = 0;
  for (let i = 0; i < length; i += 1) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}
