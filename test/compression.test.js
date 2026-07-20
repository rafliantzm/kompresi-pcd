import assert from "node:assert/strict";
import test from "node:test";
import {
  applyQuantization,
  arraysEqual,
  buildFrequencyTable,
  buildHistogram,
  buildHuffmanCodebook,
  buildHuffmanTree,
  decodeHuffman,
  decodeRLEMatrix,
  decodeRLERow,
  encodeHuffman,
  encodeRLEMatrix,
  inverseQuantization,
  metricSet,
  packBits,
  partitionHistogramEqualPopulation,
  quantizeEqualPopulation,
  readPackedBit,
} from "../lib/compression-core.js";

const flatten = (matrix) => Uint8Array.from(matrix.flat());

test("quantization fixture dari materi lulus persis", () => {
  const input = [
    [2, 9, 6, 4, 8, 2, 6, 3, 8, 5, 9, 3, 7],
    [3, 8, 5, 4, 7, 6, 3, 8, 2, 8, 4, 7, 3],
    [3, 8, 4, 7, 4, 9, 2, 3, 8, 2, 7, 4, 9],
    [3, 9, 4, 7, 2, 7, 6, 2, 1, 6, 5, 3, 0],
    [2, 0, 4, 3, 8, 9, 5, 4, 7, 1, 2, 8, 3],
  ];
  const expected = [
    [0, 3, 2, 1, 3, 0, 2, 1, 3, 2, 3, 1, 2],
    [1, 3, 2, 1, 2, 2, 1, 3, 0, 3, 1, 2, 1],
    [1, 3, 1, 2, 1, 3, 0, 1, 3, 0, 2, 1, 3],
    [1, 3, 1, 2, 0, 2, 2, 0, 0, 2, 2, 1, 0],
    [0, 0, 1, 1, 3, 3, 2, 1, 2, 0, 0, 3, 1],
  ];
  const pixels = flatten(input);
  const histogram = buildHistogram(pixels);
  assert.deepEqual(histogram.slice(0, 10), [2, 2, 9, 11, 9, 4, 5, 8, 9, 6]);
  const result = quantizeEqualPopulation(pixels, 4, 10);
  assert.deepEqual(result.groups.map((group) => [group.minIntensity, group.maxIntensity, group.pixelCount]), [
    [0, 2, 13],
    [3, 4, 20],
    [5, 7, 17],
    [8, 9, 15],
  ]);
  assert.deepEqual(Array.from(result.codes), Array.from(flatten(expected)));
  assert.equal(result.originalBitDepth, 4);
  assert.equal(result.quantizedBitDepth, 2);
  assert.equal(pixels.length * result.originalBitDepth, 260);
  assert.equal(result.theoreticalBits, 130);
  assert.equal(metricSet(pixels, result.reconstructed, 260, 130).cr, 2);
  assert.equal(metricSet(pixels, result.reconstructed, 260, 130).ss, 50);
});

test("quantization boundaries tetap kontigu dan inverse quantization valid", () => {
  const pixels = Uint8Array.from([0, 0, 3, 9, 10, 10, 200, 201, 255]);
  const histogram = buildHistogram(pixels);
  const groups = partitionHistogramEqualPopulation(histogram, 3);
  groups.forEach((group, index) => {
    assert.equal(group.code, index);
    if (index > 0) assert.equal(group.minIntensity, groups[index - 1].maxIntensity + 1);
  });
  const codes = applyQuantization(pixels, groups);
  const reconstructed = inverseQuantization(codes, groups);
  assert.equal(codes.length, pixels.length);
  assert.equal(reconstructed.length, pixels.length);
});

test("quantization menangani level umum, uniform image, sparse histogram, dan empty input", () => {
  const pixels = Uint8Array.from(Array.from({ length: 512 }, (_, index) => index % 256));
  for (const level of [256, 128, 64, 32, 16, 8]) {
    const result = quantizeEqualPopulation(pixels, level, 256);
    assert.equal(result.levelCount, level);
    assert.equal(result.codes.length, pixels.length);
  }
  const uniform = quantizeEqualPopulation(Uint8Array.from([128, 128, 128, 128]), 8, 256);
  assert.equal(uniform.codes.length, 4);
  assert.throws(() => buildHistogram(new Uint8Array()), /kosong/);
});

test("RLE fixture materi diproses per baris dan menghasilkan 31 pasangan", () => {
  const input = [
    [0, 0, 0, 0, 0, 2, 2, 2, 2, 2],
    [0, 0, 0, 1, 1, 1, 1, 2, 2, 2],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [4, 4, 4, 4, 3, 3, 3, 3, 2, 2],
    [3, 3, 3, 5, 5, 7, 7, 7, 7, 6],
    [2, 2, 6, 0, 0, 0, 0, 1, 1, 0],
    [3, 3, 4, 4, 3, 2, 2, 2, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 2, 2, 2],
    [3, 3, 3, 2, 2, 2, 1, 1, 1, 1],
  ];
  const expectedRows = [
    [[0, 5], [2, 5]],
    [[0, 3], [1, 4], [2, 3]],
    [[1, 10]],
    [[4, 4], [3, 4], [2, 2]],
    [[3, 3], [5, 2], [7, 4], [6, 1]],
    [[2, 2], [6, 1], [0, 4], [1, 2], [0, 1]],
    [[3, 2], [4, 2], [3, 1], [2, 3], [1, 2]],
    [[0, 8], [1, 2]],
    [[1, 4], [0, 3], [2, 3]],
    [[3, 3], [2, 3], [1, 4]],
  ];
  const encoded = encodeRLEMatrix(flatten(input), 10, 10, 8);
  assert.equal(encoded.pairCount, 31);
  assert.equal(encoded.symbolBitWidth, 3);
  assert.equal(encoded.countBitWidth, 4);
  assert.equal(encoded.theoreticalBits, 217);
  assert.deepEqual(encoded.rows.map((row) => row.pairs.map((pair) => [pair.value, pair.count])), expectedRows);
  for (const row of encoded.rows) {
    assert.deepEqual(Array.from(decodeRLERow(row.pairs, 10, 8)), input[row.rowIndex]);
  }
  assert.ok(arraysEqual(decodeRLEMatrix(encoded), flatten(input)));
});

test("RLE menjaga batas baris, single run, alternating row, dan validasi error", () => {
  const matrix = flatten([[1, 1, 1], [1, 1, 2]]);
  const encoded = encodeRLEMatrix(matrix, 3, 2, 3);
  assert.equal(encoded.pairCount, 3);
  assert.deepEqual(encoded.rows.map((row) => row.pairs.map((pair) => [pair.value, pair.count])), [[[1, 3]], [[1, 2], [2, 1]]]);
  assert.deepEqual(encodeRLEMatrix(flatten([[0, 1, 0, 1]]), 4, 1, 2).rows[0].pairs.map((pair) => pair.count), [1, 1, 1, 1]);
  assert.throws(() => decodeRLERow([{ value: 1, count: 0 }], 1, 2), /positif/);
  assert.throws(() => decodeRLERow([{ value: 1, count: 1 }], 2, 2), /lebih pendek/);
  assert.throws(() => decodeRLERow([{ value: 3, count: 1 }], 1, 2), /rentang/);
});

test("Huffman fixture materi menghasilkan codebook dan 11053 payload bits", () => {
  const frequencies = [790, 1023, 850, 656, 329, 245, 122, 81];
  const codes = [];
  frequencies.forEach((frequency, symbol) => {
    for (let i = 0; i < frequency; i += 1) codes.push(symbol);
  });
  const encoded = encodeHuffman(Uint8Array.from(codes), 8);
  const table = Object.fromEntries(encoded.codeEntries.map((entry) => [entry.symbol, entry.code]));
  assert.deepEqual(table, {
    0: "00",
    1: "10",
    2: "01",
    3: "110",
    4: "1110",
    5: "11111",
    6: "111101",
    7: "111100",
  });
  assert.equal(encoded.pixelCount, 4096);
  assert.equal(encoded.payloadBits, 11053);
  assert.equal(4096 * 3, 12288);
  assert.ok(Math.abs((1 - encoded.payloadBits / 12288) * 100 - 10.05) < 0.01);
  assert.ok(arraysEqual(decodeHuffman(encoded, codes.length), Uint8Array.from(codes)));
});

test("Huffman menampilkan symbol nol frekuensi, single symbol, tie, padding, dan truncated stream", () => {
  const codes = Uint8Array.from([0, 0, 0, 2]);
  const encoded = encodeHuffman(codes, 4);
  assert.deepEqual(buildFrequencyTable(codes, 4), [3, 0, 1, 0]);
  assert.equal(encoded.codeEntries.length, 4);
  assert.equal(encoded.codeEntries[1].code, null);
  assert.ok(arraysEqual(decodeHuffman(encoded, codes.length), codes));

  const single = encodeHuffman(Uint8Array.from([5, 5, 5]), 6);
  assert.equal(single.codeEntries[5].code, "0");
  assert.ok(arraysEqual(decodeHuffman(single, 3), Uint8Array.from([5, 5, 5])));

  const { root } = buildHuffmanTree([1, 1]);
  const codebook = buildHuffmanCodebook(root);
  assert.equal(codebook.get(0), "0");
  assert.equal(codebook.get(1), "1");

  const packed = packBits("101");
  assert.equal(packed.bytes.length, 1);
  assert.equal(readPackedBit(packed.bytes, 0), 1);
  assert.equal(readPackedBit(packed.bytes, 1), 0);
  assert.equal(readPackedBit(packed.bytes, 2), 1);
  assert.throws(() => decodeHuffman({ ...encoded, packed: { bytes: encoded.packed.bytes, bitLength: encoded.packed.bitLength - 1 } }, codes.length), /terpotong|menghasilkan/);
});

test("integration: quantization, RLE, Huffman, inverse, MSE/PSNR", () => {
  const pixels = Uint8Array.from([0, 0, 20, 20, 120, 130, 250, 255]);
  const q = quantizeEqualPopulation(pixels, 4, 256);
  const rle = encodeRLEMatrix(q.codes, 4, 2, 4);
  const rleDecodedCodes = decodeRLEMatrix(rle);
  const huffman = encodeHuffman(q.codes, 4);
  const huffmanDecodedCodes = decodeHuffman(huffman, q.codes.length);
  assert.ok(arraysEqual(q.codes, rleDecodedCodes));
  assert.ok(arraysEqual(q.codes, huffmanDecodedCodes));
  const reconstructed = inverseQuantization(huffmanDecodedCodes, q.groups);
  const codeMetrics = metricSet(q.codes, huffmanDecodedCodes, q.codes.length * 2, huffman.payloadBits);
  const imageMetrics = metricSet(pixels, reconstructed, pixels.length * 8, huffman.payloadBits);
  assert.equal(codeMetrics.mse, 0);
  assert.equal(codeMetrics.psnr, Infinity);
  assert.ok(imageMetrics.mse >= 0);
});
