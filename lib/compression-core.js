export function bitsForLevel(level) {
  if (!Number.isFinite(level) || level <= 1) return 1;
  return Math.max(1, Math.ceil(Math.log2(level)));
}

export function buildHistogram(pixels) {
  if (!pixels || pixels.length === 0) throw new Error("Input histogram kosong.");
  const histogram = Array(256).fill(0);
  for (const value of pixels) {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`Nilai piksel tidak valid: ${value}.`);
    }
    histogram[value] += 1;
  }
  return histogram;
}

export function partitionHistogramEqualPopulation(histogram, groupCount) {
  if (!Array.isArray(histogram) || histogram.length !== 256) {
    throw new Error("Histogram harus array 256 bin.");
  }
  if (!Number.isInteger(groupCount) || groupCount < 1 || groupCount > 256) {
    throw new Error("Jumlah kelompok kuantisasi harus 1 sampai 256.");
  }

  const totalPixels = histogram.reduce((sum, count) => sum + count, 0);
  if (totalPixels <= 0) throw new Error("Histogram tidak memiliki piksel.");

  let minActive = histogram.findIndex((count) => count > 0);
  let maxActive = histogram.length - 1;
  while (maxActive >= 0 && histogram[maxActive] === 0) maxActive -= 1;

  if (minActive < 0) {
    minActive = 0;
    maxActive = 255;
  }

  if (maxActive - minActive + 1 < groupCount) {
    minActive = 0;
    maxActive = 255;
  }

  const bins = [];
  for (let intensity = minActive; intensity <= maxActive; intensity += 1) {
    bins.push({ intensity, count: histogram[intensity] });
  }

  const n = bins.length;
  const target = totalPixels / groupCount;
  const prefixCount = [0];
  const prefixWeighted = [0];
  for (const bin of bins) {
    prefixCount.push(prefixCount[prefixCount.length - 1] + bin.count);
    prefixWeighted.push(prefixWeighted[prefixWeighted.length - 1] + bin.intensity * bin.count);
  }

  const cost = (start, end) => {
    const count = prefixCount[end] - prefixCount[start];
    const diff = count - target;
    return diff * diff;
  };

  const dp = Array.from({ length: groupCount + 1 }, () => Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: groupCount + 1 }, () => Array(n + 1).fill(-1));
  dp[0][0] = 0;

  for (let g = 1; g <= groupCount; g += 1) {
    for (let end = g; end <= n; end += 1) {
      for (let prev = g - 1; prev < end; prev += 1) {
        const candidate = dp[g - 1][prev] + cost(prev, end);
        if (candidate < dp[g][end] - Number.EPSILON) {
          dp[g][end] = candidate;
          cut[g][end] = prev;
        }
      }
    }
  }

  const ranges = [];
  let end = n;
  for (let g = groupCount; g >= 1; g -= 1) {
    const start = cut[g][end];
    if (start < 0) throw new Error("Partisi histogram gagal dibuat.");
    ranges.push([start, end]);
    end = start;
  }
  ranges.reverse();

  return ranges.map(([start, endExclusive], code) => {
    const minIntensity = bins[start].intensity;
    const maxIntensity = bins[endExclusive - 1].intensity;
    const pixelCount = prefixCount[endExclusive] - prefixCount[start];
    const weightedSum = prefixWeighted[endExclusive] - prefixWeighted[start];
    const midpoint = Math.round((minIntensity + maxIntensity) / 2);
    const representativeIntensity = pixelCount > 0
      ? Math.round(weightedSum / pixelCount)
      : midpoint;
    const includedIntensities = [];
    for (let intensity = minIntensity; intensity <= maxIntensity; intensity += 1) {
      includedIntensities.push(intensity);
    }
    return {
      code,
      minIntensity,
      maxIntensity,
      includedIntensities,
      pixelCount,
      targetCount: target,
      differenceFromTarget: pixelCount - target,
      representativeIntensity,
      outputBitCode: code.toString(2).padStart(bitsForLevel(groupCount), "0"),
    };
  });
}

export function applyQuantization(pixels, groups) {
  if (!pixels || pixels.length === 0) throw new Error("Input kuantisasi kosong.");
  const lookup = Array(256).fill(-1);
  for (const group of groups) {
    for (let intensity = group.minIntensity; intensity <= group.maxIntensity; intensity += 1) {
      lookup[intensity] = group.code;
    }
  }

  const codes = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i += 1) {
    const code = lookup[pixels[i]];
    if (code < 0) throw new Error(`Intensitas ${pixels[i]} tidak tercakup kelompok kuantisasi.`);
    codes[i] = code;
  }
  return codes;
}

export function inverseQuantization(codes, groups) {
  if (!codes || codes.length === 0) throw new Error("Input inverse quantization kosong.");
  const representatives = groups.map((group) => group.representativeIntensity);
  const output = new Uint8Array(codes.length);
  for (let i = 0; i < codes.length; i += 1) {
    const representative = representatives[codes[i]];
    if (representative === undefined) throw new Error(`Kode kuantisasi tidak valid: ${codes[i]}.`);
    output[i] = clampByte(representative);
  }
  return output;
}

export function quantizeEqualPopulation(pixels, levelCount, originalLevelCount = 256) {
  const histogram = buildHistogram(pixels);
  const groups = partitionHistogramEqualPopulation(histogram, levelCount);
  const codes = applyQuantization(pixels, groups);
  const reconstructed = inverseQuantization(codes, groups);
  return {
    codes,
    groups,
    histogram,
    reconstructed,
    totalPixels: pixels.length,
    levelCount,
    originalBitDepth: bitsForLevel(originalLevelCount),
    quantizedBitDepth: bitsForLevel(levelCount),
    targetPerGroup: pixels.length / levelCount,
    theoreticalBits: pixels.length * bitsForLevel(levelCount),
  };
}

export function encodeRLERow(row) {
  if (!row || row.length === 0) throw new Error("Baris RLE kosong.");
  const pairs = [];
  let value = row[0];
  let count = 1;
  for (let i = 1; i < row.length; i += 1) {
    if (row[i] === value) {
      count += 1;
    } else {
      pairs.push({ value, count });
      value = row[i];
      count = 1;
    }
  }
  pairs.push({ value, count });
  return pairs;
}

export function encodeRLEMatrix(codes, width, height, symbolCount = inferSymbolCount(codes)) {
  validateMatrixShape(codes, width, height);
  const rows = [];
  let pairCount = 0;
  let longestRun = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const start = rowIndex * width;
    const row = codes.slice(start, start + width);
    const pairs = encodeRLERow(row);
    const decodedPixelCount = pairs.reduce((sum, pair) => {
      if (!Number.isInteger(pair.count) || pair.count <= 0) {
        throw new Error(`Run count tidak valid di baris ${rowIndex}.`);
      }
      if (!Number.isInteger(pair.value) || pair.value < 0 || pair.value >= symbolCount) {
        throw new Error(`Nilai run tidak valid di baris ${rowIndex}: ${pair.value}.`);
      }
      longestRun = Math.max(longestRun, pair.count);
      return sum + pair.count;
    }, 0);
    if (decodedPixelCount !== width) {
      throw new Error(`Jumlah count RLE baris ${rowIndex} tidak sama dengan width.`);
    }
    rows.push({ rowIndex, pairs, decodedPixelCount });
    pairCount += pairs.length;
  }

  const symbolBitWidth = bitsForLevel(symbolCount);
  const countBitWidth = Math.max(1, Math.ceil(Math.log2(width + 1)));
  return {
    width,
    height,
    symbolCount,
    symbolBitWidth,
    countBitWidth,
    rows,
    pairCount,
    longestRun,
    averageRunLength: codes.length / pairCount,
    theoreticalBits: pairCount * (symbolBitWidth + countBitWidth),
    payloadBytes: Math.ceil((pairCount * (symbolBitWidth + countBitWidth)) / 8),
  };
}

export function decodeRLERow(pairs, expectedWidth, symbolCount = Infinity) {
  const output = new Uint8Array(expectedWidth);
  let offset = 0;
  for (const pair of pairs) {
    const value = Array.isArray(pair) ? pair[0] : pair.value;
    const count = Array.isArray(pair) ? pair[1] : pair.count;
    if (!Number.isInteger(count) || count <= 0) throw new Error("Run count harus integer positif.");
    if (!Number.isInteger(value) || value < 0 || value >= symbolCount) throw new Error("Nilai run di luar rentang simbol.");
    if (offset + count > expectedWidth) throw new Error("Decoded row melebihi width.");
    output.fill(value, offset, offset + count);
    offset += count;
  }
  if (offset !== expectedWidth) throw new Error("Decoded row lebih pendek dari width.");
  return output;
}

export function decodeRLEMatrix(encoded) {
  if (encoded.rows.length !== encoded.height) throw new Error("Jumlah row RLE tidak sama dengan height.");
  const output = new Uint8Array(encoded.width * encoded.height);
  for (const row of encoded.rows) {
    const decoded = decodeRLERow(row.pairs, encoded.width, encoded.symbolCount);
    output.set(decoded, row.rowIndex * encoded.width);
  }
  return output;
}

export function buildFrequencyTable(codes, symbolCount = inferSymbolCount(codes)) {
  if (!codes || codes.length === 0) throw new Error("Input Huffman kosong.");
  const frequencies = Array(symbolCount).fill(0);
  for (const code of codes) {
    if (!Number.isInteger(code) || code < 0 || code >= symbolCount) {
      throw new Error(`Simbol Huffman tidak valid: ${code}.`);
    }
    frequencies[code] += 1;
  }
  return frequencies;
}

export function buildHuffmanTree(frequencies) {
  let creationOrder = 0;
  let queue = frequencies
    .map((frequency, symbol) => frequency > 0 ? {
      symbol,
      frequency,
      probability: 0,
      minSymbol: symbol,
      creationOrder: creationOrder++,
      left: null,
      right: null,
    } : null)
    .filter(Boolean);

  if (queue.length === 0) throw new Error("Tidak ada simbol Huffman dengan frekuensi > 0.");
  const total = queue.reduce((sum, node) => sum + node.frequency, 0);
  queue.forEach((node) => { node.probability = node.frequency / total; });

  const mergeHistory = [];
  if (queue.length === 1) return { root: queue[0], mergeHistory };

  while (queue.length > 1) {
    queue.sort(compareHuffmanNode);
    const left = queue.shift();
    const right = queue.shift();
    const parent = {
      symbol: null,
      frequency: left.frequency + right.frequency,
      probability: (left.frequency + right.frequency) / total,
      minSymbol: Math.min(left.minSymbol, right.minSymbol),
      creationOrder: creationOrder++,
      left,
      right,
    };
    queue.push(parent);
    queue.sort(compareHuffmanNode);
    mergeHistory.push({
      step: mergeHistory.length + 1,
      leftSymbols: collectSymbols(left),
      rightSymbols: collectSymbols(right),
      leftFrequency: left.frequency,
      rightFrequency: right.frequency,
      mergedFrequency: parent.frequency,
      remainingQueue: queue.map((node) => ({ symbols: collectSymbols(node), frequency: node.frequency })),
    });
  }
  return { root: queue[0], mergeHistory };
}

export function buildHuffmanCodebook(root) {
  const codebook = new Map();
  const walk = (node, prefix) => {
    if (!node.left && !node.right) {
      codebook.set(node.symbol, prefix || "0");
      return;
    }
    if (node.left) walk(node.left, `${prefix}0`);
    if (node.right) walk(node.right, `${prefix}1`);
  };
  walk(root, "");
  return codebook;
}

export function encodeHuffman(codes, symbolCount = inferSymbolCount(codes)) {
  const frequencies = buildFrequencyTable(codes, symbolCount);
  const { root, mergeHistory } = buildHuffmanTree(frequencies);
  const codebook = buildHuffmanCodebook(root);
  let bitString = "";
  for (const code of codes) bitString += codebook.get(code);
  const packed = packBits(bitString);
  const total = codes.length;
  const codeEntries = frequencies.map((frequency, symbol) => {
    const code = codebook.get(symbol) ?? null;
    const codeLength = code ? code.length : 0;
    return {
      symbol,
      frequency,
      probability: frequency / total,
      code,
      codeLength,
      totalBits: frequency * codeLength,
    };
  });
  const payloadBits = codeEntries.reduce((sum, entry) => sum + entry.totalBits, 0);
  const averageLength = payloadBits / total;
  const entropy = codeEntries.reduce((sum, entry) => {
    if (entry.frequency === 0) return sum;
    return sum - entry.probability * Math.log2(entry.probability);
  }, 0);
  return {
    root,
    frequencies,
    codebook,
    codeEntries,
    mergeHistory,
    packed,
    bitString,
    payloadBits,
    payloadBytes: packed.bytes.length,
    averageLength,
    entropy,
    efficiency: averageLength > 0 ? (entropy / averageLength) * 100 : 0,
    symbolCount,
    pixelCount: codes.length,
  };
}

export function decodeHuffman(encoded, expectedSymbolCount = encoded.pixelCount) {
  const output = new Uint8Array(expectedSymbolCount);
  if (!encoded.root.left && !encoded.root.right) {
    output.fill(encoded.root.symbol);
    return output;
  }
  let node = encoded.root;
  let outIndex = 0;
  for (let bitIndex = 0; bitIndex < encoded.packed.bitLength; bitIndex += 1) {
    const bit = readPackedBit(encoded.packed.bytes, bitIndex);
    node = bit === 0 ? node.left : node.right;
    if (!node) throw new Error("Bitstream Huffman rusak.");
    if (!node.left && !node.right) {
      if (outIndex >= expectedSymbolCount) throw new Error("Bitstream Huffman menghasilkan simbol berlebih.");
      output[outIndex] = node.symbol;
      outIndex += 1;
      node = encoded.root;
    }
  }
  if (outIndex !== expectedSymbolCount) throw new Error("Bitstream Huffman terpotong.");
  return output;
}

export function packBits(bitString) {
  const bytes = new Uint8Array(Math.ceil(bitString.length / 8));
  for (let i = 0; i < bitString.length; i += 1) {
    if (bitString[i] !== "0" && bitString[i] !== "1") throw new Error("Bitstream hanya boleh berisi 0 dan 1.");
    if (bitString[i] === "1") bytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
  }
  return { bytes, bitLength: bitString.length };
}

export function readPackedBit(bytes, bitIndex) {
  return (bytes[Math.floor(bitIndex / 8)] >> (7 - (bitIndex % 8))) & 1;
}

export function metricSet(reference, test, originalBits, compressedBits) {
  if (reference.length !== test.length) throw new Error("Panjang data evaluasi tidak sama.");
  let sum = 0;
  for (let i = 0; i < reference.length; i += 1) {
    const diff = reference[i] - test[i];
    sum += diff * diff;
  }
  const mse = sum / reference.length;
  return {
    cr: compressedBits > 0 ? originalBits / compressedBits : 0,
    ss: compressedBits > 0 ? (1 - compressedBits / originalBits) * 100 : 0,
    mse,
    psnr: mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse),
  };
}

export function arraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

export function checksum(data) {
  let hash = 2166136261;
  for (const value of data) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function estimateActualBytes(parts) {
  const json = JSON.stringify(parts);
  return new TextEncoder().encode(json).length;
}

export function inferSymbolCount(data) {
  let max = 0;
  for (const value of data) max = Math.max(max, value);
  return Math.max(1, max + 1);
}

function validateMatrixShape(data, width, height) {
  if (!Number.isInteger(width) || width <= 0) throw new Error("Width matrix tidak valid.");
  if (!Number.isInteger(height) || height <= 0) throw new Error("Height matrix tidak valid.");
  if (!data || data.length !== width * height) throw new Error("Ukuran matrix tidak sesuai width x height.");
}

function compareHuffmanNode(a, b) {
  return a.frequency - b.frequency
    || a.minSymbol - b.minSymbol
    || a.creationOrder - b.creationOrder;
}

function collectSymbols(node) {
  if (!node.left && !node.right) return [node.symbol];
  return [...(node.left ? collectSymbols(node.left) : []), ...(node.right ? collectSymbols(node.right) : [])].sort((a, b) => a - b);
}

function clampByte(value) {
  return Math.min(255, Math.max(0, value));
}
