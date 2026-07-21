import assert from "node:assert/strict";
import test from "node:test";
import {
  RAW_NUMERIC_COLUMNS,
  buildCompressionMetrics,
  buildReconstructionMetrics,
  buildRoundTripMetrics,
  buildSkippedReason,
  classifyCompression,
  serializeRawNumericCsv,
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
    working_pixel_count: 12,
    raw_working_grayscale_size_bits: 96,
    rle_compression_ratio: 1.25,
    huffman_space_saving_percent: -3.5,
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
