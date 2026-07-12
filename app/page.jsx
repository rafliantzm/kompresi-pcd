"use client";

import { useEffect, useMemo, useState } from "react";

const LEVELS = [256, 128, 64, 32, 16, 8];
const METHODS = ["RLE", "Huffman", "Kuantisasi + RLE", "Kuantisasi + Huffman", "Kuantisasi + RLE + Huffman"];
const OUTPUT_MODES = ["1. Alur Lengkap", "2. Per Citra/Tahap"];
const MAX_PIXELS = 1200000;
const WORKFLOW_STEPS = ["Upload", "Grayscale", "Kuantisasi", "Kompresi", "Dekompresi", "Evaluasi"];

const TABLE_COLUMNS = [
  "No",
  "Mode Output",
  "Nama Citra",
  "Tahap",
  "Format",
  "Dimensi Pixel",
  "Jumlah Pixel",
  "Level Kuantisasi",
  "Metode",
  "Ukuran File (Disk)",
  "Ukuran Data Mentah",
  "Nilai Unik",
  "Ukuran Kompresi",
  "Jumlah Run",
  "Waktu Encode",
  "Waktu Decode",
  "Compression Ratio",
  "Space Saving (%)",
  "MSE",
  "PSNR",
  "Analisis",
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [decoded, setDecoded] = useState(null);
  const [sourceProfile, setSourceProfile] = useState(null);
  const [level, setLevel] = useState(64);
  const [method, setMethod] = useState("Kuantisasi + RLE + Huffman");
  const [outputMode, setOutputMode] = useState("1. Alur Lengkap");
  const [showDetailAfterEval, setShowDetailAfterEval] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const detailLines = useMemo(() => {
    if (!result) return [];
    return buildDetailReport(result, outputMode);
  }, [result, outputMode]);
  const summaryStats = useMemo(() => buildSummaryStats(result), [result]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="shell">
        <section className="workspace">
          <header className="topbar">
            <div>
              <p className="eyebrow">Pengolahan Citra Digital</p>
              <h1>Kompresi Citra Digital</h1>
            </div>
            <div className="status">Memuat aplikasi...</div>
          </header>
        </section>
      </main>
    );
  }

  async function onPickFile(event) {
    const file = event.target.files?.[0];
    setError("");
    setResult(null);
    setSourceProfile(null);
    setShowDetail(false);
    if (!file) return;

    try {
      setIsProcessing(true);
      const image = await decodeImageFile(file);
      const grayPreview = toGrayscale(image.rgba, image.width, image.height);
      const profile = analyzeSourceQuantization(grayPreview);
      const nextValidLevel = highestValidTargetLevel(profile.estimatedLevel);
      setDecoded(image);
      setSourceProfile(profile);
      setLevel((current) => current < profile.estimatedLevel ? current : nextValidLevel);
      setFileInfo({
        name: file.name,
        type: file.type || extensionOf(file.name).toUpperCase(),
        size: file.size,
        format: extensionOf(file.name).toUpperCase(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Citra gagal dibaca.");
      setDecoded(null);
      setSourceProfile(null);
      setFileInfo(null);
    } finally {
      setIsProcessing(false);
    }
  }

  function processImage() {
    if (!decoded || !fileInfo) {
      setError("Pilih citra terlebih dahulu.");
      return;
    }

    if (sourceProfile && level >= sourceProfile.estimatedLevel) {
      setError(`Level kuantisasi ${level} tidak valid karena level sumber terdeteksi sekitar ${sourceProfile.estimatedLevel}. Kuantisasi harus memilih level di bawah level sumber, bukan sama atau lebih besar.`);
      return;
    }

    setError("");
    setIsProcessing(true);
    try {
      const next = runPipeline(decoded, fileInfo, level, method, outputMode, sourceProfile);
      setResult(next);
      setShowDetail(showDetailAfterEval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pemrosesan gagal.");
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadCsv() {
    if (!result) return;
    const csv = toCsv([TABLE_COLUMNS, ...result.rows.map((row) => TABLE_COLUMNS.map((column) => row[column] ?? "-"))]);
    downloadText(csv, `${withoutExtension(result.file.name)}_evaluasi.csv`, "text/csv;charset=utf-8");
  }

  function downloadDetail() {
    if (!result) return;
    downloadText(detailLines.join("\n"), `${withoutExtension(result.file.name)}_detail_perhitungan.txt`, "text/plain;charset=utf-8");
  }

  function resetApp() {
    setFileInputKey((value) => value + 1);
    setFileInfo(null);
    setDecoded(null);
    setSourceProfile(null);
    setLevel(64);
    setMethod("Kuantisasi + RLE + Huffman");
    setOutputMode("1. Alur Lengkap");
    setShowDetailAfterEval(false);
    setShowDetail(false);
    setResult(null);
    setIsProcessing(false);
    setError("");
  }

  return (
    <main className="shell">
      <section className="workspace">
        <header className="topbar">
          <div className="title-block">
            <p className="eyebrow">Pengolahan Citra Digital</p>
            <h1>Kompresi Citra Digital</h1>
            <p className="subtitle">Analisis kuantisasi, RLE, Huffman, dekompresi, dan evaluasi kualitas citra dalam satu alur kerja.</p>
          </div>
          <div className="hero-side">
            <div className="signal-card" aria-hidden="true">
              <span>RAW</span>
              <span>GRAY</span>
              <span>RLE</span>
              <span>HUF</span>
            </div>
            <div className="status">
              {isProcessing ? "Memproses..." : result ? "Evaluasi siap" : "Siap"}
            </div>
          </div>
        </header>

        <section className="workflow-strip" aria-label="Alur proses aplikasi">
          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step} className="workflow-step">
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </section>

        <section className="controls" aria-label="Kontrol kompresi">
          <div className="control-header">
            <div>
              <p className="eyebrow">Panel Proses</p>
              <h2>Atur Citra dan Metode</h2>
            </div>
            <p>Pilih citra, tentukan level yang valid, lalu jalankan evaluasi. Level sumber akan dibaca otomatis setelah upload.</p>
          </div>

          <label className="field file-field">
            <span>Input Citra</span>
            <input key={fileInputKey} type="file" accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,image/*" onChange={onPickFile} />
            <small className="help">Format: JPG, PNG, BMP, TIFF. Citra besar diproses pada ukuran kerja agar aplikasi tetap responsif.</small>
          </label>

          <label className="field">
            <span>Level Kuantisasi</span>
            <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
              {LEVELS.map((value) => (
                <option key={value} value={value} disabled={sourceProfile ? value >= sourceProfile.estimatedLevel : false}>
                  {value} level{sourceProfile && value >= sourceProfile.estimatedLevel ? " (tidak valid)" : ""}
                </option>
              ))}
            </select>
            <small className="help">Pilihan sama atau lebih tinggi dari level sumber otomatis dimatikan.</small>
          </label>

          <label className="field wide">
            <span>Metode</span>
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <small className="help">Pilih kompresi langsung atau gabungan dengan kuantisasi.</small>
          </label>

          <label className="field wide">
            <span>Mode Output</span>
            <select value={outputMode} onChange={(event) => setOutputMode(event.target.value)}>
              {OUTPUT_MODES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <small className="help">Alur lengkap menampilkan setiap tahap, per citra memisahkan output utama.</small>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={showDetailAfterEval}
              onChange={(event) => setShowDetailAfterEval(event.target.checked)}
            />
            <span>Tampilkan detail perhitungan setelah evaluasi</span>
          </label>

          <div className="source-card">
            <span>Level sumber terdeteksi</span>
            <strong>{sourceProfile ? `${sourceProfile.estimatedLevel} level` : "-"}</strong>
            <small>
              {sourceProfile
                ? `${sourceProfile.uniqueCount} nilai grayscale unik; level ini dan level di atasnya dinonaktifkan.`
                : "Upload citra untuk membaca level efektifnya."}
            </small>
          </div>

          <div className="actions">
            <button type="button" onClick={processImage} disabled={!decoded || isProcessing}>Proses & Evaluasi</button>
            <button type="button" className="secondary" onClick={() => setShowDetail((value) => !value)} disabled={!result}>
              {showDetail ? "Sembunyikan Detail" : "Lihat Detail Perhitungan"}
            </button>
            <button type="button" className="secondary" onClick={downloadCsv} disabled={!result}>Unduh CSV</button>
            <button type="button" className="secondary" onClick={downloadDetail} disabled={!result}>Unduh Detail</button>
            <button type="button" className="secondary reset" onClick={resetApp}>Reset</button>
          </div>
        </section>

        {error && <div className="alert">{error}</div>}

        <section className="preview-section" aria-label="Preview citra">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Preview Tahap</p>
              <h2>Perbandingan Citra</h2>
            </div>
            <span>{decoded ? "Citra siap dianalisis" : "Belum ada citra"}</span>
          </div>
          <div className="preview-grid">
            <ImagePanel title="Asli" src={decoded?.previewUrl} meta={decoded ? `${decoded.originalWidth} x ${decoded.originalHeight}` : "-"} />
            <ImagePanel title="Grayscale" src={result?.images.gray} meta={result ? `${result.working.width} x ${result.working.height}` : "-"} />
            <ImagePanel title="Kuantisasi" src={result?.images.quantized} meta={result?.quantization ? `${result.quantization.level} level` : "-"} />
            <ImagePanel title="Dekompresi" src={result?.images.decompressed} meta={result?.compression.method ?? "-"} />
          </div>
        </section>

        <section className="summary-section" aria-label="Ringkasan hasil">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ringkasan</p>
              <h2>Metrik Utama</h2>
            </div>
            <span>{result ? "Berdasarkan evaluasi akhir" : "Menunggu proses"}</span>
          </div>
          <div className="summary-grid">
            {summaryStats.map((stat) => (
              <article key={stat.label} className="summary-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.note}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="table-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Output Evaluasi</p>
              <h2>Tabel Analisis</h2>
            </div>
            <span>{result ? `${result.rows.length} baris` : "Belum ada data"}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((column) => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {result ? (
                  result.rows.map((row) => (
                    <tr key={row.No}>
                      {TABLE_COLUMNS.map((column) => <td key={column}>{row[column]}</td>)}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={TABLE_COLUMNS.length} className="empty">Upload citra lalu klik Proses & Evaluasi.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showDetail && result && (
          <section className="detail-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Opsional</p>
                <h2>Detail Perhitungan dan Substitusi</h2>
              </div>
            </div>
            <pre>{detailLines.join("\n")}</pre>
          </section>
        )}

      </section>
    </main>
  );
}

function ImagePanel({ title, src, meta }) {
  return (
    <article className="image-panel">
      <div className="image-head">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      {src ? <img src={src} alt={`Citra ${title}`} /> : <div className="placeholder">Belum tersedia</div>}
    </article>
  );
}

function buildSummaryStats(result) {
  if (!result) {
    return [
      { label: "File", value: "-", note: "Upload citra terlebih dahulu" },
      { label: "Level Sumber", value: "-", note: "Dibaca otomatis dari nilai unik grayscale" },
      { label: "Compression Ratio", value: "-", note: "Muncul setelah evaluasi" },
      { label: "Space Saving", value: "-", note: "Muncul setelah evaluasi" },
      { label: "MSE", value: "-", note: "Muncul setelah dekompresi" },
      { label: "PSNR", value: "-", note: "Muncul setelah dekompresi" },
    ];
  }

  return [
    { label: "File", value: fileSize(result.file.size), note: result.file.name },
    { label: "Level Sumber", value: `${result.sourceProfile.estimatedLevel} level`, note: `${result.sourceProfile.uniqueCount} nilai unik` },
    { label: "Ukuran Kompresi", value: bits(result.compression.compressedBits), note: result.compression.method },
    { label: "Compression Ratio", value: fixed(result.finalMetrics.cr), note: "Semakin besar, semakin baik" },
    { label: "Space Saving", value: `${fixed(result.finalMetrics.ss)}%`, note: "Penghematan ukuran teoritis" },
    { label: "Kualitas", value: `MSE ${fixed(result.finalMetrics.mse)}`, note: `PSNR ${psnr(result.finalMetrics.psnr)} dB` },
  ];
}

async function decodeImageFile(file) {
  const extension = extensionOf(file.name).toLowerCase();
  if (extension === "tif" || extension === "tiff") {
    return decodeTiff(file);
  }
  return decodeBrowserImage(file);
}

async function decodeBrowserImage(file) {
  const bitmap = await createImageBitmap(file);
  const resized = resizeBox(bitmap.width, bitmap.height, MAX_PIXELS);
  const canvas = document.createElement("canvas");
  canvas.width = resized.width;
  canvas.height = resized.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, resized.width, resized.height);
  const imageData = ctx.getImageData(0, 0, resized.width, resized.height);
  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = bitmap.width;
  previewCanvas.height = bitmap.height;
  const previewCtx = previewCanvas.getContext("2d");
  previewCtx.drawImage(bitmap, 0, 0);
  return {
    rgba: imageData.data,
    width: resized.width,
    height: resized.height,
    originalWidth: bitmap.width,
    originalHeight: bitmap.height,
    channels: 4,
    wasResized: resized.wasResized,
    previewUrl: previewCanvas.toDataURL("image/png"),
  };
}

async function decodeTiff(file) {
  const mod = await import("utif");
  const UTIF = mod.default ?? mod;
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error("File TIFF tidak memiliki frame yang bisa dibaca.");
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = ifds[0].width;
  sourceCanvas.height = ifds[0].height;
  const sourceCtx = sourceCanvas.getContext("2d");
  sourceCtx.putImageData(new ImageData(new Uint8ClampedArray(rgba), ifds[0].width, ifds[0].height), 0, 0);

  const resized = resizeBox(ifds[0].width, ifds[0].height, MAX_PIXELS);
  const workCanvas = document.createElement("canvas");
  workCanvas.width = resized.width;
  workCanvas.height = resized.height;
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
  workCtx.drawImage(sourceCanvas, 0, 0, resized.width, resized.height);
  return {
    rgba: workCtx.getImageData(0, 0, resized.width, resized.height).data,
    width: resized.width,
    height: resized.height,
    originalWidth: ifds[0].width,
    originalHeight: ifds[0].height,
    channels: 4,
    wasResized: resized.wasResized,
    previewUrl: sourceCanvas.toDataURL("image/png"),
  };
}

function runPipeline(decoded, file, level, method, outputMode, sourceProfile) {
  const grayStart = performance.now();
  const gray = toGrayscale(decoded.rgba, decoded.width, decoded.height);
  const grayMs = performance.now() - grayStart;

  const detectedProfile = sourceProfile ?? analyzeSourceQuantization(gray);
  if (level >= detectedProfile.estimatedLevel) {
    throw new Error(`Level kuantisasi ${level} tidak valid. Citra sumber terdeteksi sekitar ${detectedProfile.estimatedLevel} level, sehingga kuantisasi harus memilih level yang lebih kecil.`);
  }

  const quantization = quantize(gray, level);
  const usesQuantization = method.includes("Kuantisasi");
  const source = usesQuantization ? quantization.indexes : gray;
  const sourceLevel = usesQuantization ? level : detectedProfile.estimatedLevel;
  const sourceRawBits = source.length * bitsForLevel(sourceLevel);

  let rle = null;
  let huffman = null;
  let decodedValues = null;
  let compressedBits = 0;
  let encodeMs = 0;
  let decodeMs = 0;

  const encodeStart = performance.now();
  if (method === "RLE" || method === "Kuantisasi + RLE") {
    rle = rleEncode(source, sourceLevel, decoded.width);
    compressedBits = rle.sizeBits;
    encodeMs = performance.now() - encodeStart;
    const decodeStart = performance.now();
    decodedValues = rleDecode(rle.pairs, source.length);
    decodeMs = performance.now() - decodeStart;
  } else if (method === "Huffman" || method === "Kuantisasi + Huffman") {
    huffman = huffmanEncode(source);
    compressedBits = huffman.sizeBits;
    encodeMs = performance.now() - encodeStart;
    const decodeStart = performance.now();
    decodedValues = huffmanDecode(huffman.bitstream, huffman.tree, source.length);
    decodeMs = performance.now() - decodeStart;
  } else {
    rle = rleEncode(source, sourceLevel, decoded.width);
    const flattenedPairs = flattenPairs(rle.pairs);
    huffman = huffmanEncode(flattenedPairs);
    compressedBits = huffman.sizeBits;
    encodeMs = performance.now() - encodeStart;
    const decodeStart = performance.now();
    const decodedPairsFlat = huffmanDecode(huffman.bitstream, huffman.tree, flattenedPairs.length);
    decodedValues = rleDecode(unflattenPairs(decodedPairsFlat), source.length);
    decodeMs = performance.now() - decodeStart;
  }

  const decompressed = usesQuantization ? reconstructQuantized(decodedValues, quantization.groups) : Uint8Array.from(decodedValues);
  const finalMetrics = metricSet(gray, decompressed, sourceRawBits, compressedBits);
  const quantInputBits = gray.length * bitsForLevel(detectedProfile.estimatedLevel);
  const quantMetrics = metricSet(gray, quantization.reconstructed, quantInputBits, quantization.sizeBits);
  const images = {
    gray: grayToUrl(gray, decoded.width, decoded.height),
    quantized: grayToUrl(quantization.reconstructed, decoded.width, decoded.height),
    decompressed: grayToUrl(decompressed, decoded.width, decoded.height),
  };

  const context = {
    file,
    decoded,
    working: { width: decoded.width, height: decoded.height, pixels: decoded.width * decoded.height, grayMs },
    sourceProfile: detectedProfile,
    gray,
    quantization,
    quantInputBits,
    quantMetrics,
    rle,
    huffman,
    compression: { method, sourceLevel, sourceRawBits, compressedBits, encodeMs, decodeMs },
    decompressed,
    finalMetrics,
    images,
  };

  return { ...context, rows: buildRows(context, outputMode) };
}

function buildRows(ctx, outputMode) {
  const rows = [];
  let no = 1;
  const diskSizeText = fileSize(ctx.file.size);
  const common = {
    "Mode Output": outputMode,
    "Nama Citra": ctx.file.name,
    Format: ctx.file.format,
    Metode: ctx.compression.method,
  };

  const push = (stage) => rows.push({ No: no++, ...common, ...stage });
  const rawOriginalBits = ctx.decoded.originalWidth * ctx.decoded.originalHeight * 4 * 8;
  push({
    Tahap: "Citra Asli",
    "Dimensi Pixel": `${ctx.decoded.originalWidth} x ${ctx.decoded.originalHeight} x 4`,
    "Jumlah Pixel": ctx.decoded.originalWidth * ctx.decoded.originalHeight,
    "Level Kuantisasi": "-",
    "Ukuran File (Disk)": diskSizeText,
    "Ukuran Data Mentah": bits(rawOriginalBits),
    "Nilai Unik": uniqueCountRgba(ctx.decoded.rgba),
    "Ukuran Kompresi": "-",
    "Jumlah Run": "-",
    "Waktu Encode": "-",
    "Waktu Decode": "-",
    "Compression Ratio": "1.0000",
    "Space Saving (%)": "0.0000",
    MSE: "-",
    PSNR: "-",
    Analisis: "Ukuran file disk dipengaruhi format dan metadata; ukuran mentah dihitung dari piksel RGBA.",
  });

  push({
    Tahap: "Grayscale",
    "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
    "Jumlah Pixel": ctx.working.pixels,
    "Level Kuantisasi": ctx.sourceProfile.estimatedLevel,
    "Ukuran File (Disk)": diskSizeText,
    "Ukuran Data Mentah": bits(ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel)),
    "Nilai Unik": uniqueCount(ctx.gray),
    "Ukuran Kompresi": bits(ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel)),
    "Jumlah Run": "-",
    "Waktu Encode": seconds(ctx.working.grayMs),
    "Waktu Decode": "-",
    "Compression Ratio": fixed(rawOriginalBits / (ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel))),
    "Space Saving (%)": fixed((1 - (ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel)) / rawOriginalBits) * 100),
    MSE: "0.0000",
    PSNR: "Inf",
    Analisis: `RGB dikonversi menjadi satu kanal intensitas. Terdeteksi ${ctx.sourceProfile.uniqueCount} nilai unik, dipetakan sebagai sumber sekitar ${ctx.sourceProfile.estimatedLevel} level.`,
  });

  const includeFull = outputMode.startsWith("1.");
  if (includeFull || ctx.compression.method.includes("Kuantisasi")) {
    push({
      Tahap: includeFull ? "Kuantisasi" : "Citra Kuantisasi",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.quantization.level,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.quantInputBits),
      "Nilai Unik": uniqueCount(ctx.quantization.indexes),
      "Ukuran Kompresi": bits(ctx.quantization.sizeBits),
      "Jumlah Run": "-",
      "Waktu Encode": "-",
      "Waktu Decode": "-",
      "Compression Ratio": fixed(ctx.quantMetrics.cr),
      "Space Saving (%)": fixed(ctx.quantMetrics.ss),
      MSE: fixed(ctx.quantMetrics.mse),
      PSNR: psnr(ctx.quantMetrics.psnr),
      Analisis: "Level intensitas dikurangi; ukuran teoritis turun tetapi kualitas dapat berubah.",
    });
  }

  if (includeFull && ctx.rle) {
    const metrics = metricSet(ctx.gray, ctx.decompressed, ctx.compression.sourceRawBits, ctx.rle.sizeBits);
    push({
      Tahap: "RLE",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.compression.sourceRawBits),
      "Nilai Unik": uniqueCount(ctx.rle.values),
      "Ukuran Kompresi": bits(ctx.rle.sizeBits),
      "Jumlah Run": ctx.rle.pairs.length,
      "Waktu Encode": seconds(ctx.compression.encodeMs),
      "Waktu Decode": ctx.compression.method.includes("Huffman") ? "-" : seconds(ctx.compression.decodeMs),
      "Compression Ratio": fixed(metrics.cr),
      "Space Saving (%)": fixed(metrics.ss),
      MSE: fixed(ctx.finalMetrics.mse),
      PSNR: psnr(ctx.finalMetrics.psnr),
      Analisis: "RLE menyimpan pasangan nilai dan panjang run; semakin panjang run, semakin efektif.",
    });
  }

  if (includeFull && ctx.huffman) {
    const inputBits = ctx.compression.method.includes("RLE + Huffman") && ctx.rle ? ctx.rle.sizeBits : ctx.compression.sourceRawBits;
    const metrics = metricSet(ctx.gray, ctx.decompressed, inputBits, ctx.huffman.sizeBits);
    push({
      Tahap: "Huffman",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(inputBits),
      "Nilai Unik": ctx.huffman.table.length,
      "Ukuran Kompresi": bits(ctx.huffman.sizeBits),
      "Jumlah Run": ctx.rle?.pairs.length ?? "-",
      "Waktu Encode": seconds(ctx.compression.encodeMs),
      "Waktu Decode": ctx.compression.method.includes("RLE + Huffman") ? "-" : seconds(ctx.compression.decodeMs),
      "Compression Ratio": fixed(metrics.cr),
      "Space Saving (%)": fixed(metrics.ss),
      MSE: fixed(ctx.finalMetrics.mse),
      PSNR: psnr(ctx.finalMetrics.psnr),
      Analisis: "Huffman memberi kode lebih pendek untuk simbol yang sering muncul.",
    });
  }

  push({
    Tahap: includeFull ? "Dekompresi" : `Citra Dekompresi ${ctx.compression.method}`,
    "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
    "Jumlah Pixel": ctx.working.pixels,
    "Level Kuantisasi": ctx.compression.sourceLevel,
    "Ukuran File (Disk)": diskSizeText,
    "Ukuran Data Mentah": bits(ctx.compression.sourceRawBits),
    "Nilai Unik": uniqueCount(ctx.decompressed),
    "Ukuran Kompresi": bits(ctx.compression.compressedBits),
    "Jumlah Run": ctx.rle?.pairs.length ?? "-",
    "Waktu Encode": includeFull ? "-" : seconds(ctx.compression.encodeMs),
    "Waktu Decode": seconds(ctx.compression.decodeMs),
    "Compression Ratio": fixed(ctx.finalMetrics.cr),
    "Space Saving (%)": fixed(ctx.finalMetrics.ss),
    MSE: fixed(ctx.finalMetrics.mse),
    PSNR: psnr(ctx.finalMetrics.psnr),
    Analisis: "Data terkompresi dikembalikan menjadi citra. Jika ada kuantisasi, kualitas akhir mengikuti rekonstruksi kuantisasi.",
  });

  if (includeFull) {
    push({
      Tahap: "Evaluasi Akhir",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.compression.sourceRawBits),
      "Nilai Unik": uniqueCount(ctx.decompressed),
      "Ukuran Kompresi": bits(ctx.compression.compressedBits),
      "Jumlah Run": ctx.rle?.pairs.length ?? "-",
      "Waktu Encode": seconds(ctx.compression.encodeMs),
      "Waktu Decode": seconds(ctx.compression.decodeMs),
      "Compression Ratio": fixed(ctx.finalMetrics.cr),
      "Space Saving (%)": fixed(ctx.finalMetrics.ss),
      MSE: fixed(ctx.finalMetrics.mse),
      PSNR: psnr(ctx.finalMetrics.psnr),
      Analisis: "Ringkasan final efisiensi ukuran, kualitas citra, dan waktu proses.",
    });
  }

  return rows;
}

function buildDetailReport(ctx, outputMode) {
  const lines = [];
  const rawOriginalBits = ctx.decoded.originalWidth * ctx.decoded.originalHeight * 4 * 8;
  const q = ctx.quantization;
  const qMetrics = ctx.quantMetrics;
  const final = ctx.finalMetrics;
  const huffmanInputBits = ctx.compression.method.includes("RLE + Huffman") && ctx.rle ? ctx.rle.sizeBits : ctx.compression.sourceRawBits;

  lines.push("DETAIL RUMUS DAN PERHITUNGAN KOMPRESI CITRA");
  lines.push("================================================");
  lines.push(`Nama citra       : ${ctx.file.name}`);
  lines.push(`Format           : ${ctx.file.format}`);
  lines.push(`Metode           : ${ctx.compression.method}`);
  lines.push(`Mode output      : ${outputMode}`);
  lines.push(`Level kuantisasi : ${ctx.compression.sourceLevel}`);
  lines.push("");
  lines.push("A. CITRA DIGITAL DAN UKURAN DATA");
  lines.push("Rumus: Np = M x N");
  lines.push("Rumus: S_raw = M x N x C x b");
  lines.push(`Substitusi asli: M=${ctx.decoded.originalHeight}, N=${ctx.decoded.originalWidth}, C=4, b=8`);
  lines.push(`Np = ${ctx.decoded.originalHeight} x ${ctx.decoded.originalWidth} = ${ctx.decoded.originalHeight * ctx.decoded.originalWidth} piksel`);
  lines.push(`S_raw_asli = ${ctx.decoded.originalHeight} x ${ctx.decoded.originalWidth} x 4 x 8 = ${rawOriginalBits} bit`);
  lines.push(`Ukuran file disk = ${fileSize(ctx.file.size)}`);
  lines.push("");
  lines.push("B. GRAYSCALE");
  lines.push("Rumus: Gray = 0.299R + 0.587G + 0.114B");
  lines.push(`Dimensi kerja = ${ctx.working.height} x ${ctx.working.width}`);
  lines.push(`Jumlah piksel kerja = ${ctx.working.pixels}`);
  lines.push(`S_gray = ${ctx.gray.length} x 8 = ${ctx.gray.length * 8} bit`);
  lines.push(`Nilai unik grayscale = ${uniqueCount(ctx.gray)}`);
  lines.push(`Level sumber efektif = ${ctx.sourceProfile.estimatedLevel} level`);
  lines.push(`Bit sumber efektif = ceil(log2(${ctx.sourceProfile.estimatedLevel})) = ${ctx.sourceProfile.bitsPerPixel} bit/piksel`);
  lines.push(`Aturan validasi kuantisasi: L_target < L_source`);
  lines.push(`Validasi pilihan: ${ctx.quantization.level} < ${ctx.sourceProfile.estimatedLevel} -> valid`);
  lines.push("Jika L_target sama atau lebih besar dari L_source, pilihan ditolak karena kuantisasi harus menurunkan level.");
  lines.push("");
  lines.push("C. KUANTISASI");
  lines.push("Rumus materi: buat histogram n_k untuk setiap derajat keabuan k.");
  lines.push("Rumus: n = M x N = sum(n_k)");
  lines.push("Rumus: T = n / L, dengan T adalah rata-rata piksel per kelompok.");
  lines.push("Rumus: kelompokkan derajat keabuan berurutan menjadi L kelompok berdasarkan akumulasi histogram.");
  lines.push("Rumus: Q(k) = g, dengan g nomor kelompok 0 sampai L-1.");
  lines.push("Rumus: I_recon(g) = round(sum(k x n_k) / sum(n_k)) untuk kelompok g.");
  lines.push("Rumus: bq = ceil(log2(L))");
  lines.push("Rumus: S_q = M x N x bq");
  lines.push("Rumus: e(x,y) = I(x,y) - I_recon(x,y)");
  lines.push(`Substitusi: n=${ctx.gray.length}, L=${q.level}, T=n/L=${ctx.gray.length}/${q.level}=${fixed(q.targetPerGroup)} piksel/kelompok`);
  lines.push(`bq = ceil(log2(${q.level})) = ${bitsForLevel(q.level)} bit`);
  lines.push(`S_q = ${q.indexes.length} x ${bitsForLevel(q.level)} = ${q.sizeBits} bit`);
  lines.push("Tabel pengelompokan kuantisasi:");
  lines.push(...formatQuantizationGroups(q.groups));
  lines.push(`CR_q = ${ctx.quantInputBits}/${q.sizeBits} = ${fixed(qMetrics.cr)}`);
  lines.push(`SS_q = (1 - ${q.sizeBits}/${ctx.quantInputBits}) x 100% = ${fixed(qMetrics.ss)}%`);
  lines.push(`MSE_q = ${fixed(qMetrics.mse)}`);
  lines.push(`PSNR_q = ${psnr(qMetrics.psnr)} dB`);
  lines.push("");
  lines.push("D. RUN-LENGTH ENCODING (RLE)");
  lines.push("Rumus materi: tiap baris citra diubah menjadi pasangan (p,q).");
  lines.push("p = nilai derajat keabuan, q = jumlah kemunculan berurutan dalam satu baris.");
  lines.push("Rumus: RLE = (p1,q1), (p2,q2), ..., (pk,qk)");
  lines.push("Rumus: n = q1 + q2 + ... + qk");
  lines.push("Rumus: b_p = ceil(log2(level))");
  lines.push("Rumus: b_q = ceil(log2(lebar_baris + 1))");
  lines.push("Rumus: S_RLE = (k x b_p) + (k x b_q) = k x (b_p + b_q)");
  lines.push("Rumus rasio materi/space saving: Rasio = 100% - (S_RLE / S_asli x 100%)");
  lines.push("Rumus compression ratio: CR = S_asli / S_RLE");
  if (ctx.rle) {
    const rleInputBits = ctx.compression.sourceRawBits;
    const rleSaving = (1 - ctx.rle.sizeBits / rleInputBits) * 100;
    lines.push(`n = ${ctx.gray.length}`);
    lines.push(`k = ${ctx.rle.pairs.length}`);
    lines.push(`b_p = ceil(log2(${ctx.compression.sourceLevel})) = ${ctx.rle.bitValue} bit`);
    lines.push(`b_q = ceil(log2(${ctx.rle.rowWidth} + 1)) = ${ctx.rle.bitCount} bit`);
    lines.push(`S_RLE = (${ctx.rle.pairs.length} x ${ctx.rle.bitValue}) + (${ctx.rle.pairs.length} x ${ctx.rle.bitCount}) = ${ctx.rle.sizeBits} bit`);
    lines.push(`Rasio materi = 100% - (${ctx.rle.sizeBits}/${rleInputBits} x 100%) = ${fixed(rleSaving)}%`);
    lines.push(`r = ${ctx.gray.length}/${ctx.rle.pairs.length} = ${fixed(ctx.gray.length / ctx.rle.pairs.length)} piksel/run`);
    lines.push("Contoh pasangan (p,q) awal sesuai urutan baris:");
    lines.push(...formatRlePairs(ctx.rle));
  } else {
    lines.push("RLE tidak dijalankan pada metode ini.");
  }
  lines.push("");
  lines.push("E. HUFFMAN CODING");
  lines.push("Metode Pemampatan/Penempatan Huffman sesuai materi:");
  lines.push("1. Urutkan nilai keabuan/simbol berdasarkan frekuensi atau peluang kemunculan secara menaik.");
  lines.push("2. Gabungkan dua pohon dengan frekuensi paling kecil pada sebuah akar baru.");
  lines.push("3. Ulangi sampai tersisa satu pohon biner.");
  lines.push("4. Beri label sisi kiri = 0 dan sisi kanan = 1.");
  lines.push("5. Telusuri akar ke daun; rangkaian 0/1 menjadi kode Huffman simbol tersebut.");
  lines.push("Rumus: f_i atau n_k = jumlah kemunculan simbol ke-i.");
  lines.push("Rumus: N = sum(f_i).");
  lines.push("Rumus: P(k) = n_k / N.");
  lines.push("Rumus: S_H = sum(n_k x panjang_kode_k).");
  lines.push("Rumus: L_avg = sum(P(k) x panjang_kode_k).");
  lines.push("Rumus: H = -sum(P(k) x log2(P(k))).");
  lines.push("Rumus: eta = H / L_avg x 100%.");
  lines.push("Rumus: R = 100% - eta.");
  lines.push("Rumus teori: H <= L_avg < H + 1");
  if (ctx.huffman) {
    lines.push(`Jumlah simbol unik = ${ctx.huffman.table.length}`);
    lines.push("Proses penggabungan pohon Huffman:");
    lines.push(...formatHuffmanMergeSteps(ctx.huffman.mergeSteps));
    lines.push("Tabel Metode Pemampatan Huffman:");
    lines.push(...formatHuffmanTable(ctx.huffman.table));
    lines.push(`S_H = ${ctx.huffman.sizeBits} bit`);
    lines.push(`L_avg = ${fixed(ctx.huffman.averageLength, 6)} bit/simbol`);
    lines.push(`H = ${fixed(ctx.huffman.entropy, 6)} bit/simbol`);
    lines.push(`eta = ${fixed(ctx.huffman.efficiency)}%`);
    lines.push(`Redundansi = ${fixed(100 - ctx.huffman.efficiency)}%`);
    lines.push(`CR_H = ${huffmanInputBits}/${ctx.huffman.sizeBits} = ${fixed(huffmanInputBits / ctx.huffman.sizeBits)}`);
    lines.push(`SS_H = (1 - ${ctx.huffman.sizeBits}/${huffmanInputBits}) x 100% = ${fixed((1 - ctx.huffman.sizeBits / huffmanInputBits) * 100)}%`);
  } else {
    lines.push("Huffman tidak dijalankan pada metode ini.");
  }
  lines.push("");
  lines.push("F. EVALUASI AKHIR");
  lines.push("Rumus: CR = S_asli / S_kompresi");
  lines.push("Rumus: SS = (1 - S_kompresi / S_asli) x 100%");
  lines.push("Rumus: MSE = (1/(M x N)) x sum_x sum_y [I(x,y) - K(x,y)]^2");
  lines.push("Rumus: PSNR = 10 x log10(255^2 / MSE)");
  lines.push("Rumus setara: PSNR = 20 x log10(255 / sqrt(MSE))");
  lines.push(`S_asli evaluasi = ${ctx.compression.sourceRawBits} bit`);
  lines.push(`S_kompresi final = ${ctx.compression.compressedBits} bit`);
  lines.push(`CR = ${ctx.compression.sourceRawBits}/${ctx.compression.compressedBits} = ${fixed(final.cr)}`);
  lines.push(`SS = (1 - ${ctx.compression.compressedBits}/${ctx.compression.sourceRawBits}) x 100% = ${fixed(final.ss)}%`);
  lines.push(`MSE = ${fixed(final.mse)}`);
  lines.push(`PSNR = ${psnr(final.psnr)} dB`);
  lines.push(`Waktu encode = ${seconds(ctx.compression.encodeMs)}`);
  lines.push(`Waktu decode = ${seconds(ctx.compression.decodeMs)}`);
  lines.push("");
  lines.push("G. INTERPRETASI");
  lines.push("- Kuantisasi mengurangi level intensitas dan dapat menyebabkan error visual.");
  lines.push("- RLE kuat pada area piksel berulang panjang.");
  lines.push("- Huffman kuat saat probabilitas simbol tidak merata.");
  lines.push("- RLE dan Huffman lossless terhadap data inputnya; kehilangan kualitas biasanya berasal dari kuantisasi.");
  return lines;
}

function formatQuantizationGroups(groups) {
  const lines = ["g | rentang k | jumlah piksel | I_recon(g)"];
  for (const group of groups) {
    lines.push(`${group.index} | ${group.min}-${group.max} | ${group.count} | ${group.representative}`);
  }
  return lines;
}

function formatRlePairs(rle) {
  const lines = [];
  const maxPairs = 200;
  const pairs = rle.pairs.slice(0, maxPairs).map(([p, q]) => `(${p},${q})`);
  lines.push(pairs.join(", "));
  if (rle.pairs.length > maxPairs) {
    lines.push(`... ditampilkan ${maxPairs} pasangan pertama dari total ${rle.pairs.length} pasangan agar detail tetap ringan dibaca.`);
  }
  lines.push(`Jumlah run per baris awal: ${rle.rowRunCounts.slice(0, 20).join(", ")}${rle.rowRunCounts.length > 20 ? ", ..." : ""}`);
  return lines;
}

function formatHuffmanMergeSteps(steps) {
  if (!steps.length) return ["Hanya ada satu simbol; kode Huffman langsung diberi 0."];
  return steps.map((step, index) => `${index + 1}. Gabung ${step.left} + ${step.right} = node:${step.sum}`);
}

function formatHuffmanTable(table) {
  const lines = ["k/simbol | n_k | P(k) | kode | panjang | n_k x panjang"];
  for (const row of table) {
    lines.push(`${row.symbol} | ${row.count} | ${fixed(row.probability, 6)} | ${row.code} | ${row.length} | ${row.count * row.length}`);
  }
  return lines;
}

function toGrayscale(rgba, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 1) {
    out[j] = clampByte(Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]));
  }
  return out;
}

function analyzeSourceQuantization(gray) {
  const uniqueValues = new Set(gray);
  const uniqueCount = uniqueValues.size;
  const ascendingLevels = [...LEVELS].sort((a, b) => a - b);
  const estimatedLevel = ascendingLevels.find((candidate) => uniqueCount <= candidate) ?? 256;
  return {
    uniqueCount,
    estimatedLevel,
    bitsPerPixel: bitsForLevel(estimatedLevel),
  };
}

function highestValidTargetLevel(sourceLevel) {
  const validLevels = LEVELS.filter((candidate) => candidate < sourceLevel);
  return validLevels.length ? Math.max(...validLevels) : LEVELS[LEVELS.length - 1];
}

function quantize(gray, level) {
  const histogram = new Map();
  for (const value of gray) histogram.set(value, (histogram.get(value) ?? 0) + 1);
  const sortedBins = [...histogram.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count }));
  const targetPerGroup = gray.length / level;
  const valueToGroup = new Map();
  const groups = [];
  let groupIndex = 0;
  let groupBins = [];
  let groupCount = 0;
  let groupWeightedSum = 0;

  for (let i = 0; i < sortedBins.length; i += 1) {
    const bin = sortedBins[i];
    groupBins.push(bin);
    groupCount += bin.count;
    groupWeightedSum += bin.value * bin.count;
    const remainingBins = sortedBins.length - i - 1;
    const remainingGroups = level - groupIndex - 1;
    const shouldClose = groupIndex < level - 1 && groupCount >= targetPerGroup && remainingBins >= remainingGroups;
    if (shouldClose) {
      closeQuantizationGroup(groups, valueToGroup, groupIndex, groupBins, groupCount, groupWeightedSum);
      groupIndex += 1;
      groupBins = [];
      groupCount = 0;
      groupWeightedSum = 0;
    }
  }

  if (groupBins.length) {
    closeQuantizationGroup(groups, valueToGroup, groupIndex, groupBins, groupCount, groupWeightedSum);
  }

  const indexes = new Uint16Array(gray.length);
  const reconstructed = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i += 1) {
    const q = valueToGroup.get(gray[i]) ?? 0;
    const representative = groups[q]?.representative ?? gray[i];
    indexes[i] = q;
    reconstructed[i] = clampByte(representative);
  }
  return {
    level,
    targetPerGroup,
    histogram: sortedBins,
    groups,
    indexes,
    reconstructed,
    sizeBits: gray.length * bitsForLevel(level),
  };
}

function closeQuantizationGroup(groups, valueToGroup, index, bins, count, weightedSum) {
  const min = bins[0].value;
  const max = bins[bins.length - 1].value;
  const representative = Math.round(weightedSum / count);
  for (const bin of bins) valueToGroup.set(bin.value, index);
  groups[index] = {
    index,
    min,
    max,
    count,
    representative,
    symbols: bins.map((bin) => bin.value),
  };
}

function rleEncode(data, level, rowWidth) {
  if (!data.length) throw new Error("Input RLE kosong.");
  const pairs = [];
  const values = [];
  const rowRunCounts = [];
  const width = Math.max(1, rowWidth ?? data.length);

  for (let rowStart = 0; rowStart < data.length; rowStart += width) {
    const rowEnd = Math.min(rowStart + width, data.length);
    let current = data[rowStart];
    let count = 1;
    let rowRuns = 0;
    for (let i = rowStart + 1; i < rowEnd; i += 1) {
      if (data[i] === current) {
        count += 1;
      } else {
        pairs.push([current, count]);
        values.push(current);
        rowRuns += 1;
        current = data[i];
        count = 1;
      }
    }
    pairs.push([current, count]);
    values.push(current);
    rowRuns += 1;
    rowRunCounts.push(rowRuns);
  }

  const bitValue = bitsForLevel(level);
  const bitCount = Math.max(1, Math.ceil(Math.log2(width + 1)));
  return { pairs, values, bitValue, bitCount, rowWidth: width, rowRunCounts, sizeBits: pairs.length * (bitValue + bitCount) };
}

function rleDecode(pairs, expectedLength) {
  const output = new Uint16Array(expectedLength);
  let index = 0;
  for (const [value, count] of pairs) {
    output.fill(value, index, index + count);
    index += count;
  }
  return output;
}

function huffmanEncode(data) {
  if (!data.length) throw new Error("Input Huffman kosong.");
  const freq = new Map();
  for (const value of data) freq.set(value, (freq.get(value) ?? 0) + 1);
  let nodes = [...freq.entries()].map(([symbol, count]) => ({ symbol, count, left: null, right: null }));
  const mergeSteps = [];
  if (nodes.length === 1) {
    nodes = [{ symbol: null, count: nodes[0].count, left: nodes[0], right: null }];
  }
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.count - b.count || String(a.symbol).localeCompare(String(b.symbol)));
    const left = nodes.shift();
    const right = nodes.shift();
    const parent = { symbol: null, count: left.count + right.count, left, right };
    mergeSteps.push({
      left: nodeLabel(left),
      right: nodeLabel(right),
      sum: parent.count,
    });
    nodes.push(parent);
  }
  const tree = nodes[0];
  const codes = new Map();
  assignCodes(tree, "", codes);
  const table = [...freq.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([symbol, count]) => {
      const code = codes.get(symbol) ?? "0";
      const probability = count / data.length;
      return { symbol, count, probability, code, length: code.length };
    });
  const bitstream = Array.from(data, (value) => codes.get(value) ?? "0").join("");
  const sizeBits = table.reduce((sum, item) => sum + item.count * item.length, 0);
  const averageLength = table.reduce((sum, item) => sum + item.probability * item.length, 0);
  const entropy = table.reduce((sum, item) => sum - item.probability * Math.log2(item.probability), 0);
  return {
    tree,
    table,
    mergeSteps,
    bitstream,
    sizeBits,
    averageLength,
    entropy,
    efficiency: averageLength > 0 ? (entropy / averageLength) * 100 : 0,
  };
}

function assignCodes(node, prefix, codes) {
  if (!node.left && !node.right) {
    codes.set(node.symbol, prefix || "0");
    return;
  }
  if (node.left) assignCodes(node.left, `${prefix}0`, codes);
  if (node.right) assignCodes(node.right, `${prefix}1`, codes);
}

function nodeLabel(node) {
  if (!node.left && !node.right) return `${node.symbol}:${node.count}`;
  return `node:${node.count}`;
}

function huffmanDecode(bitstream, tree, expectedLength) {
  const output = new Uint16Array(expectedLength);
  if (!tree.right && tree.left && !tree.left.left && !tree.left.right) {
    output.fill(tree.left.symbol);
    return output;
  }
  let node = tree;
  let index = 0;
  for (const bit of bitstream) {
    node = bit === "0" ? node.left : node.right;
    if (!node.left && !node.right) {
      output[index] = node.symbol;
      index += 1;
      node = tree;
      if (index >= expectedLength) break;
    }
  }
  return output;
}

function reconstructQuantized(indexes, groups) {
  const out = new Uint8Array(indexes.length);
  for (let i = 0; i < indexes.length; i += 1) {
    out[i] = clampByte(groups[indexes[i]]?.representative ?? 0);
  }
  return out;
}

function metricSet(reference, test, originalBits, compressedBits) {
  let sum = 0;
  for (let i = 0; i < reference.length; i += 1) {
    const diff = reference[i] - test[i];
    sum += diff * diff;
  }
  const mse = sum / reference.length;
  const psnrValue = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  return {
    cr: compressedBits > 0 ? originalBits / compressedBits : 0,
    ss: compressedBits > 0 ? (1 - compressedBits / originalBits) * 100 : 0,
    mse,
    psnr: psnrValue,
  };
}

function grayToUrl(gray, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  for (let i = 0, j = 0; i < gray.length; i += 1, j += 4) {
    imageData.data[j] = gray[i];
    imageData.data[j + 1] = gray[i];
    imageData.data[j + 2] = gray[i];
    imageData.data[j + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

function flattenPairs(pairs) {
  const out = new Uint32Array(pairs.length * 2);
  pairs.forEach(([value, count], index) => {
    out[index * 2] = value;
    out[index * 2 + 1] = count;
  });
  return out;
}

function unflattenPairs(flat) {
  const pairs = [];
  for (let i = 0; i < flat.length; i += 2) pairs.push([flat[i], flat[i + 1]]);
  return pairs;
}

function resizeBox(width, height, maxPixels) {
  const pixels = width * height;
  if (pixels <= maxPixels) return { width, height, wasResized: false };
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    wasResized: true,
  };
}

function uniqueCount(data) {
  return new Set(data).size;
}

function uniqueCountRgba(data) {
  const seen = new Set();
  for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
  return seen.size;
}

function bitsForLevel(level) {
  return Math.max(1, Math.ceil(Math.log2(level)));
}

function clampByte(value) {
  return Math.min(255, Math.max(0, value));
}

function extensionOf(name) {
  return name.includes(".") ? name.split(".").pop() ?? "" : "";
}

function withoutExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}

function fixed(value, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : "Inf";
}

function psnr(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "Inf";
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(4)} s`;
}

function bits(value) {
  return `${Math.round(value)} bit`;
}

function bytes(value) {
  return `${value} byte`;
}

function fileSize(value) {
  if (value < 1024) return `${value} byte`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(2)} ${units[unitIndex]} (${value} byte)`;
}

function toCsv(rows) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
