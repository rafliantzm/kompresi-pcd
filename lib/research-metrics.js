import { arraysEqual, checksum as dataChecksum, metricSet } from "./compression-core.js";

export const COMPRESSION_EPSILON = 1e-9;

export const RAW_NUMERIC_COLUMNS = [
  "image_name",
  "source_format",
  "content_category",
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
  "detected_source_level",
  "detected_source_bit_depth",
  "detected_source_fixed_bit_size_bits",
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
  "processed_row_count",
  "skipped_count",
  "rle_reduced_count",
  "rle_unchanged_count",
  "rle_expanded_count",
  "huffman_reduced_count",
  "huffman_unchanged_count",
  "huffman_expanded_count",
  "rle_mean_compression_ratio",
  "huffman_mean_compression_ratio",
  "rle_mean_space_saving_percent",
  "huffman_mean_space_saving_percent",
  "mean_reconstruction_mse",
  "mean_reconstruction_psnr_db",
  "mean_quantization_time_ms",
  "mean_rle_total_time_ms",
  "mean_huffman_total_time_ms",
  "mean_combined_experiment_time_ms",
  "best_case_image",
  "best_case_method",
  "best_case_compression_ratio",
  "worst_case_image",
  "worst_case_method",
  "worst_case_compression_ratio",
];

export const SUMMARY_BY_FORMAT_COLUMNS = [
  "source_format",
  "row_count",
  "processed_row_count",
  "skipped_count",
  "rle_reduced_count",
  "rle_unchanged_count",
  "rle_expanded_count",
  "huffman_reduced_count",
  "huffman_unchanged_count",
  "huffman_expanded_count",
  "rle_mean_compression_ratio",
  "huffman_mean_compression_ratio",
  "rle_mean_space_saving_percent",
  "huffman_mean_space_saving_percent",
  "mean_reconstruction_mse",
  "mean_reconstruction_psnr_db",
  "mean_quantization_time_ms",
  "mean_rle_total_time_ms",
  "mean_huffman_total_time_ms",
  "mean_combined_experiment_time_ms",
  "best_case_image",
  "best_case_method",
  "best_case_compression_ratio",
  "worst_case_image",
  "worst_case_method",
  "worst_case_compression_ratio",
];

export const ANOMALY_SUMMARY_COLUMNS = [
  "image_name",
  "source_format",
  "content_category",
  "quantization_level",
  "quantization_status",
  "anomaly_type",
  "skipped_reason",
  "rle_result_category",
  "huffman_result_category",
  "rle_compression_ratio",
  "huffman_compression_ratio",
  "byte_identical",
  "different_pixel_count",
  "max_absolute_difference",
];

export const TIMING_SUMMARY_COLUMNS = [
  "quantization_level",
  "row_count",
  "processed_row_count",
  "benchmark_enabled_count",
  "mean_quantization_time_ms",
  "mean_rle_total_time_ms",
  "mean_huffman_total_time_ms",
  "mean_combined_experiment_time_ms",
  "benchmark_total_mean_ms",
  "benchmark_total_min_ms",
  "benchmark_total_max_ms",
  "benchmark_total_std_ms",
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

export function buildGrayscaleRawSizeBits(pixelCount) {
  return pixelCount * 8;
}

export function buildDetectedFixedBitSizeBits(pixelCount, detectedBitDepth) {
  return pixelCount * detectedBitDepth;
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
  return serializeCsvRows(rows, RAW_NUMERIC_COLUMNS);
}

export function serializeResearchSummaryCsv(rows) {
  return serializeCsvRows(rows, RESEARCH_SUMMARY_COLUMNS);
}

export function serializeSummaryByFormatCsv(rows) {
  return serializeCsvRows(rows, SUMMARY_BY_FORMAT_COLUMNS);
}

export function serializeAnomalySummaryCsv(rows) {
  return serializeCsvRows(rows, ANOMALY_SUMMARY_COLUMNS);
}

export function serializeTimingSummaryCsv(rows) {
  return serializeCsvRows(rows, TIMING_SUMMARY_COLUMNS);
}

function serializeCsvRows(rows, columns) {
  const csv = [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row, rowIndex) => row.map((value, columnIndex) => formatRawCell(value, rowIndex === 0 ? null : columns[columnIndex])).join(","))
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
  return summarizeRowsBy(rows, (row) => row.quantization_level ?? row.requested_level ?? "unknown", "quantization_level");
}

export function summarizeResearchRowsByFormat(rows) {
  return summarizeRowsBy(rows, (row) => row.source_format || "UNKNOWN", "source_format");
}

function summarizeRowsBy(rows, keySelector, keyColumn) {
  const byLevel = new Map();
  for (const row of rows) {
    const key = keySelector(row);
    if (!byLevel.has(key)) byLevel.set(key, []);
    byLevel.get(key).push(row);
  }
  return [...byLevel.entries()].map(([key, groupedRows]) => summarizeGroupedRows(key, groupedRows, keyColumn));
}

function summarizeGroupedRows(key, rows, keyColumn) {
  const processed = rows.filter((row) => row.quantization_status !== "SKIPPED");
  const methodCases = processed.flatMap((row) => [
    { image: row.image_name, method: "RLE", cr: row.rle_compression_ratio },
    { image: row.image_name, method: "Huffman", cr: row.huffman_compression_ratio },
  ]).filter((item) => Number.isFinite(item.cr));
  const best = methodCases.reduce((winner, item) => !winner || item.cr > winner.cr ? item : winner, null);
  const worst = methodCases.reduce((loser, item) => !loser || item.cr < loser.cr ? item : loser, null);
  return {
    [keyColumn]: key,
    row_count: rows.length,
    processed_row_count: processed.length,
    skipped_count: rows.filter((row) => row.quantization_status === "SKIPPED").length,
    rle_reduced_count: countMethodCategory(processed, "rle_result_category", "REDUCED"),
    rle_unchanged_count: countMethodCategory(processed, "rle_result_category", "UNCHANGED"),
    rle_expanded_count: countMethodCategory(processed, "rle_result_category", "EXPANDED"),
    huffman_reduced_count: countMethodCategory(processed, "huffman_result_category", "REDUCED"),
    huffman_unchanged_count: countMethodCategory(processed, "huffman_result_category", "UNCHANGED"),
    huffman_expanded_count: countMethodCategory(processed, "huffman_result_category", "EXPANDED"),
    rle_mean_compression_ratio: mean(processed.map((row) => row.rle_compression_ratio)),
    huffman_mean_compression_ratio: mean(processed.map((row) => row.huffman_compression_ratio)),
    rle_mean_space_saving_percent: mean(processed.map((row) => row.rle_space_saving_percent)),
    huffman_mean_space_saving_percent: mean(processed.map((row) => row.huffman_space_saving_percent)),
    mean_reconstruction_mse: mean(processed.map((row) => row.reconstruction_mse)),
    mean_reconstruction_psnr_db: mean(processed.map((row) => row.reconstruction_psnr_db).filter(Number.isFinite)),
    mean_quantization_time_ms: mean(processed.map((row) => row.benchmark_quantization_mean_ms || row.quantization_time_ms)),
    mean_rle_total_time_ms: mean(processed.map((row) => row.benchmark_rle_total_mean_ms || row.rle_total_ms)),
    mean_huffman_total_time_ms: mean(processed.map((row) => row.benchmark_huffman_total_mean_ms || row.huffman_total_ms)),
    mean_combined_experiment_time_ms: mean(processed.map((row) => row.benchmark_total_mean_ms || sumFinite(row.quantization_time_ms, row.rle_total_ms, row.huffman_total_ms))),
    best_case_image: best?.image ?? "",
    best_case_method: best?.method ?? "",
    best_case_compression_ratio: best?.cr ?? "",
    worst_case_image: worst?.image ?? "",
    worst_case_method: worst?.method ?? "",
    worst_case_compression_ratio: worst?.cr ?? "",
  };
}

export function summarizeAnomalyRows(rows) {
  const anomalies = [];
  for (const row of rows) {
    if (row.quantization_status === "SKIPPED") {
      anomalies.push(buildAnomalyRow(row, "SKIPPED_LEVEL"));
      continue;
    }
    if (row.rle_result_category === "EXPANDED") anomalies.push(buildAnomalyRow(row, "RLE_EXPANDED"));
    if (row.huffman_result_category === "EXPANDED") anomalies.push(buildAnomalyRow(row, "HUFFMAN_EXPANDED"));
    if (row.byte_identical === false || Number(row.different_pixel_count) > 0 || Number(row.max_absolute_difference) > 0) {
      anomalies.push(buildAnomalyRow(row, "ROUND_TRIP_MISMATCH"));
    }
  }
  return anomalies;
}

function buildAnomalyRow(row, anomalyType) {
  return {
    image_name: row.image_name,
    source_format: row.source_format,
    content_category: row.content_category,
    quantization_level: row.quantization_level,
    quantization_status: row.quantization_status,
    anomaly_type: anomalyType,
    skipped_reason: row.skipped_reason,
    rle_result_category: row.rle_result_category,
    huffman_result_category: row.huffman_result_category,
    rle_compression_ratio: row.rle_compression_ratio,
    huffman_compression_ratio: row.huffman_compression_ratio,
    byte_identical: row.byte_identical,
    different_pixel_count: row.different_pixel_count,
    max_absolute_difference: row.max_absolute_difference,
  };
}

export function summarizeTimingRows(rows) {
  return summarizeRowsBy(rows, (row) => row.quantization_level ?? row.requested_level ?? "unknown", "quantization_level")
    .map((row) => ({
      quantization_level: row.quantization_level,
      row_count: row.row_count,
      processed_row_count: row.processed_row_count,
      benchmark_enabled_count: rows.filter((item) => item.quantization_level === row.quantization_level && item.benchmark_enabled === true).length,
      mean_quantization_time_ms: row.mean_quantization_time_ms,
      mean_rle_total_time_ms: row.mean_rle_total_time_ms,
      mean_huffman_total_time_ms: row.mean_huffman_total_time_ms,
      mean_combined_experiment_time_ms: row.mean_combined_experiment_time_ms,
      benchmark_total_mean_ms: mean(rows.filter((item) => item.quantization_level === row.quantization_level).map((item) => item.benchmark_total_mean_ms)),
      benchmark_total_min_ms: min(rows.filter((item) => item.quantization_level === row.quantization_level).map((item) => item.benchmark_total_min_ms)),
      benchmark_total_max_ms: max(rows.filter((item) => item.quantization_level === row.quantization_level).map((item) => item.benchmark_total_max_ms)),
      benchmark_total_std_ms: mean(rows.filter((item) => item.quantization_level === row.quantization_level).map((item) => item.benchmark_total_std_ms)),
    }));
}

function countMethodCategory(rows, field, category) {
  return rows.reduce((sum, row) => sum + (row[field] === category ? 1 : 0), 0);
}

function mean(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : "";
}

function min(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? Math.min(...clean) : "";
}

function max(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? Math.max(...clean) : "";
}

function sumFinite(...values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) : "";
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
