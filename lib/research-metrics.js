import { arraysEqual, checksum as dataChecksum, metricSet } from "./compression-core.js";

export const COMPRESSION_EPSILON = 1e-9;
export const SINGLE_RUN_TIMING_MODE = "SINGLE_RUN_PER_IMAGE_LEVEL";

export const CONTENT_CATEGORY_MAP = {
  "abstrak.png": "SMOOTH_GRADIENT",
  "air2.bmp": "NATURAL_PHOTO",
  "air3.png": "TEXTURE_PATTERN",
  "air4.png": "NATURAL_PHOTO",
  "air5.jpg": "TEXTURE_PATTERN",
  "dataran.jpg": "NATURAL_PHOTO",
  "gedung.tiff": "COMPLEX_DETAIL",
  "gerhana.bmp": "COMPLEX_DETAIL",
  "jalan.tiff": "NATURAL_PHOTO",
  "kucing.bmp": "COMPLEX_DETAIL",
  "langit3.jpg": "SMOOTH_GRADIENT",
  "logo.bmp": "HOMOGENEOUS_GRAPHIC",
  "nikkon.tiff": "COMPLEX_DETAIL",
  "pegunungan.tiff": "NATURAL_PHOTO",
  "pemandangan.tiff": "NATURAL_PHOTO",
  "pemandangan1.jpg": "COMPLEX_DETAIL",
  "pemandangan2.jpg": "COMPLEX_DETAIL",
  "pola.png": "TEXTURE_PATTERN",
  "ruangan.bmp": "COMPLEX_DETAIL",
  "taman.png": "COMPLEX_DETAIL",
};

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
  "unique_symbol_count",
  "rle_pair_count",
  "mean_run_length",
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
  "timing_measurement_mode",
  "benchmark_enabled",
  "benchmark_warmup_runs",
  "benchmark_measured_runs",
  "benchmark_quantization_mean_ms",
  "benchmark_quantization_min_ms",
  "benchmark_quantization_max_ms",
  "benchmark_quantization_std_ms",
  "benchmark_rle_encode_mean_ms",
  "benchmark_rle_encode_min_ms",
  "benchmark_rle_encode_max_ms",
  "benchmark_rle_encode_std_ms",
  "benchmark_rle_decode_mean_ms",
  "benchmark_rle_decode_min_ms",
  "benchmark_rle_decode_max_ms",
  "benchmark_rle_decode_std_ms",
  "benchmark_rle_total_mean_ms",
  "benchmark_rle_total_min_ms",
  "benchmark_rle_total_max_ms",
  "benchmark_rle_total_std_ms",
  "benchmark_huffman_frequency_mean_ms",
  "benchmark_huffman_frequency_min_ms",
  "benchmark_huffman_frequency_max_ms",
  "benchmark_huffman_frequency_std_ms",
  "benchmark_huffman_tree_mean_ms",
  "benchmark_huffman_tree_min_ms",
  "benchmark_huffman_tree_max_ms",
  "benchmark_huffman_tree_std_ms",
  "benchmark_huffman_codebook_mean_ms",
  "benchmark_huffman_codebook_min_ms",
  "benchmark_huffman_codebook_max_ms",
  "benchmark_huffman_codebook_std_ms",
  "benchmark_huffman_encode_mean_ms",
  "benchmark_huffman_encode_min_ms",
  "benchmark_huffman_encode_max_ms",
  "benchmark_huffman_encode_std_ms",
  "benchmark_huffman_decode_mean_ms",
  "benchmark_huffman_decode_min_ms",
  "benchmark_huffman_decode_max_ms",
  "benchmark_huffman_decode_std_ms",
  "benchmark_huffman_total_mean_ms",
  "benchmark_huffman_total_min_ms",
  "benchmark_huffman_total_max_ms",
  "benchmark_huffman_total_std_ms",
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
  "mean_single_run_quantization_time_ms",
  "mean_single_run_rle_total_time_ms",
  "mean_single_run_huffman_total_time_ms",
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
  "image_count",
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
  "mean_single_run_quantization_time_ms",
  "mean_single_run_rle_total_time_ms",
  "mean_single_run_huffman_total_time_ms",
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
  "method",
  "anomaly_type",
  "input_bits",
  "output_bits",
  "compression_ratio",
  "space_saving_percent",
  "skipped_reason",
  "explanation",
  "byte_identical",
  "different_pixel_count",
  "max_absolute_difference",
];

export const TIMING_SUMMARY_COLUMNS = [
  "quantization_level",
  "row_count",
  "processed_row_count",
  "benchmark_enabled_count",
  "mean_single_run_quantization_time_ms",
  "mean_single_run_rle_total_time_ms",
  "mean_single_run_huffman_total_time_ms",
  "mean_combined_experiment_time_ms",
  "timing_measurement_mode",
  "timing_explanation",
  "benchmark_quantization_mean_ms",
  "benchmark_quantization_min_ms",
  "benchmark_quantization_max_ms",
  "benchmark_quantization_std_ms",
  "benchmark_rle_total_mean_ms",
  "benchmark_rle_total_min_ms",
  "benchmark_rle_total_max_ms",
  "benchmark_rle_total_std_ms",
  "benchmark_huffman_total_mean_ms",
  "benchmark_huffman_total_min_ms",
  "benchmark_huffman_total_max_ms",
  "benchmark_huffman_total_std_ms",
];

export const SUMMARY_BY_CONTENT_CATEGORY_COLUMNS = [
  "content_category",
  "image_count",
  "processed_row_count",
  "skipped_count",
  "rle_reduced_count",
  "rle_unchanged_count",
  "rle_expanded_count",
  "huffman_reduced_count",
  "huffman_unchanged_count",
  "huffman_expanded_count",
  "mean_rle_compression_ratio",
  "mean_huffman_compression_ratio",
  "mean_rle_space_saving_percent",
  "mean_huffman_space_saving_percent",
  "mean_reconstruction_mse",
  "mean_reconstruction_psnr_db",
  "mean_rle_total_time_ms",
  "mean_huffman_total_time_ms",
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

export function classifyContentCategory(fileName) {
  return CONTENT_CATEGORY_MAP[String(fileName || "").trim().toLowerCase()] ?? "UNCLASSIFIED";
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

export function serializeSummaryByContentCategoryCsv(rows) {
  return serializeCsvRows(rows, SUMMARY_BY_CONTENT_CATEGORY_COLUMNS);
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
  const variance = clean.length > 1
    ? clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (clean.length - 1)
    : 0;
  return {
    mean,
    min: Math.min(...clean),
    max: Math.max(...clean),
    std: Math.sqrt(variance),
    count: clean.length,
  };
}

export function buildBenchmarkSummary(measuredRuns) {
  const quantization = benchmarkStats(measuredRuns.map((run) => run.quantizationMs));
  const rleEncode = benchmarkStats(measuredRuns.map((run) => run.rleEncodeMs));
  const rleDecode = benchmarkStats(measuredRuns.map((run) => run.rleDecodeMs));
  const rleTotal = benchmarkStats(measuredRuns.map((run) => run.rleTotalMs));
  const huffmanFrequency = benchmarkStats(measuredRuns.map((run) => run.huffmanFrequencyMs));
  const huffmanTree = benchmarkStats(measuredRuns.map((run) => run.huffmanTreeMs));
  const huffmanCodebook = benchmarkStats(measuredRuns.map((run) => run.huffmanCodebookMs));
  const huffmanEncode = benchmarkStats(measuredRuns.map((run) => run.huffmanEncodeMs));
  const huffmanDecode = benchmarkStats(measuredRuns.map((run) => run.huffmanDecodeMs));
  const huffmanTotal = benchmarkStats(measuredRuns.map((run) => run.huffmanTotalMs));
  return {
    warmupRuns: 1,
    measuredRuns: measuredRuns.length,
    quantizationMeanMs: quantization.mean,
    quantizationMinMs: quantization.min,
    quantizationMaxMs: quantization.max,
    quantizationStdMs: quantization.std,
    rleEncodeMeanMs: rleEncode.mean,
    rleEncodeMinMs: rleEncode.min,
    rleEncodeMaxMs: rleEncode.max,
    rleEncodeStdMs: rleEncode.std,
    rleDecodeMeanMs: rleDecode.mean,
    rleDecodeMinMs: rleDecode.min,
    rleDecodeMaxMs: rleDecode.max,
    rleDecodeStdMs: rleDecode.std,
    rleTotalMeanMs: rleTotal.mean,
    rleTotalMinMs: rleTotal.min,
    rleTotalMaxMs: rleTotal.max,
    rleTotalStdMs: rleTotal.std,
    huffmanFrequencyMeanMs: huffmanFrequency.mean,
    huffmanFrequencyMinMs: huffmanFrequency.min,
    huffmanFrequencyMaxMs: huffmanFrequency.max,
    huffmanFrequencyStdMs: huffmanFrequency.std,
    huffmanTreeMeanMs: huffmanTree.mean,
    huffmanTreeMinMs: huffmanTree.min,
    huffmanTreeMaxMs: huffmanTree.max,
    huffmanTreeStdMs: huffmanTree.std,
    huffmanCodebookMeanMs: huffmanCodebook.mean,
    huffmanCodebookMinMs: huffmanCodebook.min,
    huffmanCodebookMaxMs: huffmanCodebook.max,
    huffmanCodebookStdMs: huffmanCodebook.std,
    huffmanEncodeMeanMs: huffmanEncode.mean,
    huffmanEncodeMinMs: huffmanEncode.min,
    huffmanEncodeMaxMs: huffmanEncode.max,
    huffmanEncodeStdMs: huffmanEncode.std,
    huffmanDecodeMeanMs: huffmanDecode.mean,
    huffmanDecodeMinMs: huffmanDecode.min,
    huffmanDecodeMaxMs: huffmanDecode.max,
    huffmanDecodeStdMs: huffmanDecode.std,
    huffmanTotalMeanMs: huffmanTotal.mean,
    huffmanTotalMinMs: huffmanTotal.min,
    huffmanTotalMaxMs: huffmanTotal.max,
    huffmanTotalStdMs: huffmanTotal.std,
  };
}

export function summarizeResearchRows(rows) {
  return summarizeRowsBy(rows, (row) => row.quantization_level ?? row.requested_level ?? "unknown", "quantization_level");
}

export function summarizeResearchRowsByFormat(rows) {
  return summarizeRowsBy(rows, (row) => row.source_format || "UNKNOWN", "source_format").map((row) => ({
    ...row,
    image_count: new Set(rows
      .filter((item) => (item.source_format || "UNKNOWN") === row.source_format)
      .map((item) => item.image_name)).size,
  }));
}

export function summarizeResearchRowsByContentCategory(rows) {
  const grouped = summarizeRowsBy(rows, (row) => row.content_category || "UNCLASSIFIED", "content_category");
  return grouped.map((row) => {
    const matchingRows = rows.filter((item) => (item.content_category || "UNCLASSIFIED") === row.content_category);
    const processed = matchingRows.filter((item) => item.quantization_status !== "SKIPPED");
    return {
      content_category: row.content_category,
      image_count: new Set(matchingRows.map((item) => item.image_name)).size,
      processed_row_count: row.processed_row_count,
      skipped_count: row.skipped_count,
      rle_reduced_count: row.rle_reduced_count,
      rle_unchanged_count: row.rle_unchanged_count,
      rle_expanded_count: row.rle_expanded_count,
      huffman_reduced_count: row.huffman_reduced_count,
      huffman_unchanged_count: row.huffman_unchanged_count,
      huffman_expanded_count: row.huffman_expanded_count,
      mean_rle_compression_ratio: row.rle_mean_compression_ratio,
      mean_huffman_compression_ratio: row.huffman_mean_compression_ratio,
      mean_rle_space_saving_percent: row.rle_mean_space_saving_percent,
      mean_huffman_space_saving_percent: row.huffman_mean_space_saving_percent,
      mean_reconstruction_mse: row.mean_reconstruction_mse,
      mean_reconstruction_psnr_db: row.mean_reconstruction_psnr_db,
      mean_rle_total_time_ms: mean(processed.map((item) => item.rle_total_ms)),
      mean_huffman_total_time_ms: mean(processed.map((item) => item.huffman_total_ms)),
    };
  });
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
    mean_single_run_quantization_time_ms: mean(processed.map((row) => row.quantization_time_ms)),
    mean_single_run_rle_total_time_ms: mean(processed.map((row) => row.rle_total_ms)),
    mean_single_run_huffman_total_time_ms: mean(processed.map((row) => row.huffman_total_ms)),
    mean_combined_experiment_time_ms: mean(processed.map((row) => sumFinite(row.quantization_time_ms, row.rle_total_ms, row.huffman_total_ms))),
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
      anomalies.push(buildAnomalyRow(row, "Quantization", "SKIPPED_LEVEL"));
      continue;
    }
    if (row.rle_result_category === "EXPANDED") anomalies.push(buildAnomalyRow(row, "RLE", "RLE_EXPANDED"));
    if (row.rle_result_category === "UNCHANGED") anomalies.push(buildAnomalyRow(row, "RLE", "RLE_UNCHANGED"));
    if (row.huffman_result_category === "EXPANDED") anomalies.push(buildAnomalyRow(row, "Huffman", "HUFFMAN_EXPANDED"));
    if (row.huffman_result_category === "UNCHANGED" || Math.abs(Number(row.huffman_compression_ratio) - 1) <= COMPRESSION_EPSILON) {
      anomalies.push(buildAnomalyRow(row, "Huffman", "HUFFMAN_UNCHANGED"));
    }
    if (row.byte_identical === false || Number(row.different_pixel_count) > 0 || Number(row.max_absolute_difference) > 0) {
      anomalies.push(buildAnomalyRow(row, "RoundTrip", "ROUND_TRIP_MISMATCH"));
    }
    if (Number(row.rle_estimated_export_bytes) * 8 > Number(row.quantized_size_bits)) {
      anomalies.push(buildAnomalyRow(row, "RLE Export", "ESTIMATED_EXPORT_EXPANDED"));
    }
    if (Number(row.huffman_estimated_export_bytes) * 8 > Number(row.quantized_size_bits)) {
      anomalies.push(buildAnomalyRow(row, "Huffman Export", "ESTIMATED_EXPORT_EXPANDED"));
    }
  }
  return anomalies;
}

function buildAnomalyRow(row, method, anomalyType) {
  const methodFields = anomalyMethodFields(row, method, anomalyType);
  return {
    image_name: row.image_name,
    source_format: row.source_format,
    content_category: row.content_category,
    quantization_level: row.quantization_level,
    quantization_status: row.quantization_status,
    method,
    anomaly_type: anomalyType,
    input_bits: methodFields.inputBits,
    output_bits: methodFields.outputBits,
    compression_ratio: methodFields.compressionRatio,
    space_saving_percent: methodFields.spaceSavingPercent,
    skipped_reason: row.skipped_reason,
    explanation: anomalyExplanation(anomalyType),
    byte_identical: row.byte_identical,
    different_pixel_count: row.different_pixel_count,
    max_absolute_difference: row.max_absolute_difference,
  };
}

function anomalyMethodFields(row, method, anomalyType) {
  if (method.startsWith("RLE")) {
    const outputBits = method === "RLE Export" ? Number(row.rle_estimated_export_bytes) * 8 : row.rle_payload_bits;
    return {
      inputBits: row.quantized_size_bits,
      outputBits,
      compressionRatio: method === "RLE Export" ? compressionRatio(row.quantized_size_bits, outputBits) : row.rle_compression_ratio,
      spaceSavingPercent: method === "RLE Export" ? spaceSavingPercent(row.quantized_size_bits, outputBits) : row.rle_space_saving_percent,
    };
  }
  if (method.startsWith("Huffman")) {
    const outputBits = method === "Huffman Export" ? Number(row.huffman_estimated_export_bytes) * 8 : row.huffman_payload_bits;
    return {
      inputBits: row.quantized_size_bits,
      outputBits,
      compressionRatio: method === "Huffman Export" ? compressionRatio(row.quantized_size_bits, outputBits) : row.huffman_compression_ratio,
      spaceSavingPercent: method === "Huffman Export" ? spaceSavingPercent(row.quantized_size_bits, outputBits) : row.huffman_space_saving_percent,
    };
  }
  if (anomalyType === "ROUND_TRIP_MISMATCH") {
    return {
      inputBits: row.quantized_size_bits,
      outputBits: row.quantized_size_bits,
      compressionRatio: "",
      spaceSavingPercent: "",
    };
  }
  return {
    inputBits: row.detected_source_fixed_bit_size_bits,
    outputBits: "",
    compressionRatio: "",
    spaceSavingPercent: "",
  };
}

function anomalyExplanation(anomalyType) {
  const explanations = {
    SKIPPED_LEVEL: "Level kuantisasi target tidak lebih kecil dari level sumber terdeteksi, sehingga tidak terjadi reduksi level.",
    RLE_EXPANDED: "Payload RLE lebih besar dari baseline fixed-bit data kuantisasi karena jumlah run terlalu banyak atau run terlalu pendek.",
    RLE_UNCHANGED: "Payload RLE sama dengan baseline fixed-bit data kuantisasi, sehingga encoding valid tetapi tidak mengurangi ukuran.",
    HUFFMAN_EXPANDED: "Payload Huffman lebih besar dari baseline fixed-bit data kuantisasi pada distribusi simbol citra-level tersebut.",
    HUFFMAN_UNCHANGED: "Payload Huffman sama dengan baseline fixed-bit data kuantisasi. Encoding dan decoding tetap valid, tetapi tidak terjadi pengurangan ukuran karena rata-rata panjang kode sama dengan panjang representasi fixed-bit.",
    ROUND_TRIP_MISMATCH: "Data setelah decode tidak identik dengan data sebelum kompresi, sehingga perlu audit round-trip.",
    ESTIMATED_EXPORT_EXPANDED: "Estimasi ukuran export termasuk metadata/struktur serialisasi lebih besar daripada baseline fixed-bit data kuantisasi.",
  };
  return explanations[anomalyType] ?? "";
}

export function summarizeTimingRows(rows) {
  return summarizeRowsBy(rows, (row) => row.quantization_level ?? row.requested_level ?? "unknown", "quantization_level")
    .map((row) => ({
      quantization_level: row.quantization_level,
      row_count: row.row_count,
      processed_row_count: row.processed_row_count,
      benchmark_enabled_count: rows.filter((item) => item.quantization_level === row.quantization_level && item.benchmark_enabled === true).length,
      mean_single_run_quantization_time_ms: row.mean_single_run_quantization_time_ms,
      mean_single_run_rle_total_time_ms: row.mean_single_run_rle_total_time_ms,
      mean_single_run_huffman_total_time_ms: row.mean_single_run_huffman_total_time_ms,
      mean_combined_experiment_time_ms: row.mean_combined_experiment_time_ms,
      timing_measurement_mode: SINGLE_RUN_TIMING_MODE,
      timing_explanation: "Waktu diukur satu kali untuk setiap kombinasi citra dan level. Nilai mean per level adalah mean lintas citra, bukan mean pengulangan input yang sama.",
      benchmark_quantization_mean_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_quantization_mean_ms"),
      benchmark_quantization_min_ms: minBenchmarkRows(rows, row.quantization_level, "benchmark_quantization_min_ms"),
      benchmark_quantization_max_ms: maxBenchmarkRows(rows, row.quantization_level, "benchmark_quantization_max_ms"),
      benchmark_quantization_std_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_quantization_std_ms"),
      benchmark_rle_total_mean_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_rle_total_mean_ms"),
      benchmark_rle_total_min_ms: minBenchmarkRows(rows, row.quantization_level, "benchmark_rle_total_min_ms"),
      benchmark_rle_total_max_ms: maxBenchmarkRows(rows, row.quantization_level, "benchmark_rle_total_max_ms"),
      benchmark_rle_total_std_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_rle_total_std_ms"),
      benchmark_huffman_total_mean_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_huffman_total_mean_ms"),
      benchmark_huffman_total_min_ms: minBenchmarkRows(rows, row.quantization_level, "benchmark_huffman_total_min_ms"),
      benchmark_huffman_total_max_ms: maxBenchmarkRows(rows, row.quantization_level, "benchmark_huffman_total_max_ms"),
      benchmark_huffman_total_std_ms: meanBenchmarkRows(rows, row.quantization_level, "benchmark_huffman_total_std_ms"),
    }));
}

function benchmarkRows(rows, level) {
  return rows.filter((item) => item.quantization_level === level && item.benchmark_enabled === true);
}

function meanBenchmarkRows(rows, level, field) {
  return mean(benchmarkRows(rows, level).map((item) => item[field]));
}

function minBenchmarkRows(rows, level, field) {
  return min(benchmarkRows(rows, level).map((item) => item[field]));
}

function maxBenchmarkRows(rows, level, field) {
  return max(benchmarkRows(rows, level).map((item) => item[field]));
}

function countMethodCategory(rows, field, category) {
  return rows.reduce((sum, row) => sum + (row[field] === category ? 1 : 0), 0);
}

function compressionRatio(inputBits, outputBits) {
  return Number.isFinite(inputBits) && Number.isFinite(outputBits) && outputBits > 0 ? inputBits / outputBits : "";
}

function spaceSavingPercent(inputBits, outputBits) {
  return Number.isFinite(inputBits) && Number.isFinite(outputBits) && inputBits > 0 ? (1 - outputBits / inputBits) * 100 : "";
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
