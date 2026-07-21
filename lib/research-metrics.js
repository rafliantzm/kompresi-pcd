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
  "quantization_status",
  "skipped_reason",
  "rle_result_category",
  "huffman_result_category",
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
    .map((row) => row.map(formatRawCell).join(","))
    .join("\n");
  return `\uFEFF${csv}`;
}

export function formatRawCell(value) {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "";
    if (!Number.isFinite(value)) return "Infinity";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const text = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ");
  return `"${text.replaceAll('"', '""')}"`;
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
