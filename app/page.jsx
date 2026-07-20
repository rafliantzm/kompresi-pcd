"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arraysEqual,
  checksum as dataChecksum,
  decodeHuffman as decodeHuffmanCore,
  decodeRLEMatrix,
  encodeHuffman as encodeHuffmanCore,
  encodeRLEMatrix,
  estimateActualBytes,
  inverseQuantization,
  metricSet as computeMetrics,
  quantizeEqualPopulation,
} from "../lib/compression-core.js";

const LEVELS = [256, 128, 64, 32, 16, 8];
const METHODS = ["RLE", "Huffman", "Kuantisasi + RLE", "Kuantisasi + Huffman", "Kuantisasi + RLE + Huffman"];
const OUTPUT_MODES = ["1. Alur Lengkap", "2. Per Citra/Tahap"];
const MAX_PIXELS = 1200000;
const WORKFLOW_STEPS = ["Input", "Grayscale", "Histogram", "Kuantisasi", "RLE", "Huffman", "Dekompresi", "Evaluasi"];
const RLE_PAGE_SIZE = 80;

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
  const [rlePage, setRlePage] = useState(0);

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
      setRlePage(0);
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
    setRlePage(0);
  }

  function downloadRleData() {
    if (!result) return;
    downloadText(JSON.stringify(buildRleExport(result), null, 2), `${withoutExtension(result.file.name)}_rle_data.json`, "application/json;charset=utf-8");
  }

  function downloadHuffmanData() {
    if (!result) return;
    downloadText(JSON.stringify(buildHuffmanExport(result), null, 2), `${withoutExtension(result.file.name)}_huffman_data.json`, "application/json;charset=utf-8");
  }

  function downloadRleReconstruction() {
    if (!result) return;
    downloadDataUrl(result.images.rleDecompressed, `${withoutExtension(result.file.name)}_rle_reconstruction.png`);
  }

  function downloadHuffmanReconstruction() {
    if (!result) return;
    downloadDataUrl(result.images.huffmanDecompressed, `${withoutExtension(result.file.name)}_huffman_reconstruction.png`);
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
          <div className="status">
            {isProcessing ? "Memproses..." : result ? "Evaluasi siap" : "Siap"}
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
            <button type="button" className="secondary" onClick={processImage} disabled={!decoded || isProcessing}>Compress RLE</button>
            <button type="button" className="secondary" onClick={() => setShowDetail(true)} disabled={!result}>Decompress RLE</button>
            <button type="button" className="secondary" onClick={downloadRleData} disabled={!result}>Download RLE Data</button>
            <button type="button" className="secondary" onClick={downloadRleReconstruction} disabled={!result}>Download RLE Reconstruction</button>
            <button type="button" className="secondary" onClick={processImage} disabled={!decoded || isProcessing}>Compress Huffman</button>
            <button type="button" className="secondary" onClick={() => setShowDetail(true)} disabled={!result}>Decompress Huffman</button>
            <button type="button" className="secondary" onClick={downloadHuffmanData} disabled={!result}>Download Huffman Data</button>
            <button type="button" className="secondary" onClick={downloadHuffmanReconstruction} disabled={!result}>Download Huffman Reconstruction</button>
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
            <ImagePanel title="Kuantisasi" src={result?.images.quantized} meta={result?.quantization ? `${result.quantization.levelCount} level` : "-"} />
            <ImagePanel title="RLE Dekompresi" src={result?.images.rleDecompressed} meta={result ? result.rle.roundTripStatus : "-"} />
            <ImagePanel title="Huffman Dekompresi" src={result?.images.huffmanDecompressed} meta={result ? result.huffman.roundTripStatus : "-"} />
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

        {result && (
          <AnalysisPanels result={result} rlePage={rlePage} setRlePage={setRlePage} />
        )}

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
    { label: "RLE", value: bits(result.rle.theoreticalBits), note: result.rle.roundTripStatus },
    { label: "Huffman", value: bits(result.huffman.payloadBits), note: result.huffman.roundTripStatus },
    { label: "Compression Ratio", value: fixed(result.finalMetrics.cr), note: "Semakin besar, semakin baik" },
    { label: "Kualitas", value: `MSE ${fixed(result.reconstructionMetrics.mse)}`, note: `PSNR ${psnr(result.reconstructionMetrics.psnr)} dB` },
  ];
}

function AnalysisPanels({ result, rlePage, setRlePage }) {
  const rlePairs = result.rle.rows.flatMap((row) => row.pairs.map((pair, index) => ({ row: row.rowIndex, run: index + 1, ...pair })));
  const pageCount = Math.max(1, Math.ceil(rlePairs.length / RLE_PAGE_SIZE));
  const pageStart = rlePage * RLE_PAGE_SIZE;
  const visiblePairs = rlePairs.slice(pageStart, pageStart + RLE_PAGE_SIZE);

  return (
    <>
      <section className="analysis-grid" aria-label="Panel analisis algoritma">
        <article className="analysis-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Histogram</p>
              <h2>Distribusi Intensitas</h2>
            </div>
            <span>{result.quantization.totalPixels} piksel</span>
          </div>
          <div className="histogram-bars">
            {result.quantization.histogram.map((count, intensity) => count > 0 ? (
              <div key={intensity} className="histogram-row">
                <span>{intensity}</span>
                <div><i style={{ width: `${Math.max(4, (count / result.maxHistogramCount) * 100)}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ) : null)}
          </div>
        </article>

        <article className="analysis-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Kuantisasi</p>
              <h2>Equal-Population Groups</h2>
            </div>
            <span>Target {fixed(result.quantization.targetPerGroup, 2)}</span>
          </div>
          <div className="mini-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Min-Max</th>
                  <th>Intensitas</th>
                  <th>Count</th>
                  <th>Selisih</th>
                  <th>Representatif</th>
                  <th>Bit</th>
                </tr>
              </thead>
              <tbody>
                {result.quantization.groups.map((group) => (
                  <tr key={group.code}>
                    <td>{group.code}</td>
                    <td>{group.minIntensity}-{group.maxIntensity}</td>
                    <td>{compactIntensities(group.includedIntensities)}</td>
                    <td>{group.pixelCount}</td>
                    <td>{fixed(group.differenceFromTarget, 2)}</td>
                    <td>{group.representativeIntensity}</td>
                    <td>{group.outputBitCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="analysis-grid" aria-label="Panel RLE dan Huffman">
        <article className="analysis-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">RLE Per Baris</p>
              <h2>Pasangan (p, q)</h2>
            </div>
            <span>{result.rle.pairCount} run</span>
          </div>
          <MetricList items={[
            ["Total rows", result.rle.height],
            ["Longest run", result.rle.longestRun],
            ["Average run", fixed(result.rle.averageRunLength)],
            ["Symbol bit width", result.rle.symbolBitWidth],
            ["Count bit width", result.rle.countBitWidth],
            ["Original theoretical bits", bits(result.compression.sourceRawBits)],
            ["RLE theoretical bits", bits(result.rle.theoreticalBits)],
            ["Actual exported bytes", bytes(result.rle.actualBytes)],
            ["Compression Ratio", fixed(result.rle.metrics.cr)],
            ["Space Saving", `${fixed(result.rle.metrics.ss)}%`],
            ["Encode time", seconds(result.rle.encodeMs)],
            ["Decode time", seconds(result.rle.decodeMs)],
            ["Round-trip", result.rle.roundTripStatus],
          ]} />
          <div className="pagination">
            <button type="button" className="secondary" onClick={() => setRlePage(Math.max(0, rlePage - 1))} disabled={rlePage === 0}>Prev</button>
            <span>Halaman {rlePage + 1} / {pageCount}</span>
            <button type="button" className="secondary" onClick={() => setRlePage(Math.min(pageCount - 1, rlePage + 1))} disabled={rlePage >= pageCount - 1}>Next</button>
          </div>
          <div className="mini-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Run</th>
                  <th>p</th>
                  <th>q</th>
                  <th>p binary</th>
                  <th>q binary</th>
                  <th>Bit</th>
                </tr>
              </thead>
              <tbody>
                {visiblePairs.map((pair, index) => (
                  <tr key={`${pair.row}-${pair.run}-${index}`}>
                    <td>{pair.row}</td>
                    <td>{pair.run}</td>
                    <td>{pair.value}</td>
                    <td>{pair.count}</td>
                    <td>{pair.value.toString(2).padStart(result.rle.symbolBitWidth, "0")}</td>
                    <td>{pair.count.toString(2).padStart(result.rle.countBitWidth, "0")}</td>
                    <td>{result.rle.symbolBitWidth + result.rle.countBitWidth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="analysis-card">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Huffman Coding</p>
              <h2>Frekuensi, Kode, dan Tree</h2>
            </div>
            <span>{bits(result.huffman.payloadBits)}</span>
          </div>
          <MetricList items={[
            ["Payload bits", bits(result.huffman.payloadBits)],
            ["Payload bytes", bytes(result.huffman.payloadBytes)],
            ["Actual exported bytes", bytes(result.huffman.actualBytes)],
            ["Entropy", fixed(result.huffman.entropy, 6)],
            ["Average length", fixed(result.huffman.averageLength, 6)],
            ["Efficiency", `${fixed(result.huffman.efficiency)}%`],
            ["Compression Ratio", fixed(result.huffman.metrics.cr)],
            ["Space Saving", `${fixed(result.huffman.metrics.ss)}%`],
            ["Round-trip", result.huffman.roundTripStatus],
          ]} />
          <HuffmanTreeSvg root={result.huffman.root} />
          <div className="mini-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Frequency</th>
                  <th>Probability</th>
                  <th>Code</th>
                  <th>Length</th>
                  <th>Total Bits</th>
                </tr>
              </thead>
              <tbody>
                {result.huffman.codeEntries.map((entry) => (
                  <tr key={entry.symbol}>
                    <td>{entry.symbol}</td>
                    <td>{entry.frequency}</td>
                    <td>{fixed(entry.probability, 6)}</td>
                    <td>{entry.code ?? "-"}</td>
                    <td>{entry.codeLength || "-"}</td>
                    <td>{entry.totalBits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="analysis-card full-width">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Evaluasi</p>
            <h2>Perbandingan Teoritis dan Aktual</h2>
          </div>
          <span>Round-trip code harus identik</span>
        </div>
        <div className="mini-table-wrap">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Aspek</th>
                <th>RLE</th>
                <th>Huffman</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Code MSE</td><td>{fixed(result.rle.codeMetrics.mse)}</td><td>{fixed(result.huffman.codeMetrics.mse)}</td><td>Lossless terhadap quantized code matrix.</td></tr>
              <tr><td>Code PSNR</td><td>{psnr(result.rle.codeMetrics.psnr)}</td><td>{psnr(result.huffman.codeMetrics.psnr)}</td><td>Inf berarti decoded code identik.</td></tr>
              <tr><td>Checksum asli</td><td>{result.quantizedChecksum}</td><td>{result.quantizedChecksum}</td><td>Checksum kode kuantisasi sebelum kompresi.</td></tr>
              <tr><td>Checksum decode</td><td>{result.rle.decodedChecksum}</td><td>{result.huffman.decodedChecksum}</td><td>Harus sama dengan checksum asli.</td></tr>
              <tr><td>Reconstruction MSE</td><td>{fixed(result.rle.reconstructionMetrics.mse)}</td><td>{fixed(result.huffman.reconstructionMetrics.mse)}</td><td>Lossy karena inverse kuantisasi.</td></tr>
              <tr><td>Reconstruction PSNR</td><td>{psnr(result.rle.reconstructionMetrics.psnr)}</td><td>{psnr(result.huffman.reconstructionMetrics.psnr)}</td><td>Evaluasi terhadap grayscale asli.</td></tr>
              <tr><td>Nisbah Pemampatan Versi Materi / Space Saving</td><td>{fixed(result.rle.metrics.ss)}%</td><td>{fixed(result.huffman.metrics.ss)}%</td><td>Ini bukan Compression Ratio standar.</td></tr>
            </tbody>
          </table>
        </div>
        <div className="notes">
          <p>Kuantisasi bersifat lossy. RLE dan Huffman bersifat lossless terhadap quantized code matrix. Perbedaan citra rekonstruksi terhadap citra asli berasal dari tahap kuantisasi.</p>
          <p>Lecture/Theoretical Mode menghitung payload tanpa overhead metadata. Actual Storage Mode memasukkan estimasi payload, padding, dimensi, level, bit length, frequency table, dan mapping kuantisasi.</p>
        </div>
      </section>
    </>
  );
}

function MetricList({ items }) {
  return (
    <dl className="metric-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HuffmanTreeSvg({ root }) {
  const nodes = [];
  const edges = [];
  const leaves = [];
  const collectLeaves = (node) => {
    if (!node.left && !node.right) leaves.push(node);
    if (node.left) collectLeaves(node.left);
    if (node.right) collectLeaves(node.right);
  };
  collectLeaves(root);
  const leafX = new Map();
  leaves.forEach((leaf, index) => leafX.set(leaf, 60 + index * 92));
  const maxDepth = treeDepth(root);
  const place = (node, depth) => {
    const y = 36 + depth * 82;
    let x;
    if (!node.left && !node.right) {
      x = leafX.get(node);
    } else {
      const left = node.left ? place(node.left, depth + 1) : null;
      const right = node.right ? place(node.right, depth + 1) : null;
      x = ((left?.x ?? right.x) + (right?.x ?? left.x)) / 2;
      if (left) edges.push({ from: { x, y }, to: left, label: "0" });
      if (right) edges.push({ from: { x, y }, to: right, label: "1" });
    }
    const symbols = collectTreeSymbols(node).join(",");
    nodes.push({ x, y, label: node.symbol === null ? `{${symbols}}` : `${node.symbol}`, frequency: node.frequency, leaf: node.symbol !== null });
    return { x, y };
  };
  place(root, 0);
  const width = Math.max(360, leaves.length * 92 + 120);
  const height = Math.max(180, maxDepth * 82 + 96);
  return (
    <div className="tree-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Visualisasi pohon Huffman">
        {edges.map((edge, index) => (
          <g key={index}>
            <line x1={edge.from.x} y1={edge.from.y + 18} x2={edge.to.x} y2={edge.to.y - 18} />
            <text x={(edge.from.x + edge.to.x) / 2} y={(edge.from.y + edge.to.y) / 2 - 4}>{edge.label}</text>
          </g>
        ))}
        {nodes.map((node, index) => (
          <g key={index}>
            <circle cx={node.x} cy={node.y} r="22" className={node.leaf ? "leaf" : ""} />
            <text x={node.x} y={node.y - 3}>{node.label}</text>
            <text x={node.x} y={node.y + 13}>{node.frequency}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function treeDepth(node) {
  if (!node.left && !node.right) return 0;
  return 1 + Math.max(node.left ? treeDepth(node.left) : 0, node.right ? treeDepth(node.right) : 0);
}

function collectTreeSymbols(node) {
  if (!node.left && !node.right) return [node.symbol];
  return [...(node.left ? collectTreeSymbols(node.left) : []), ...(node.right ? collectTreeSymbols(node.right) : [])].sort((a, b) => a - b);
}

function compactIntensities(values) {
  if (values.length <= 12) return values.join(", ");
  return `${values.slice(0, 6).join(", ")} ... ${values.slice(-4).join(", ")}`;
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

  const quantization = quantizeEqualPopulation(gray, level, detectedProfile.estimatedLevel);
  const quantizedCodes = quantization.codes;
  const sourceRawBits = quantizedCodes.length * quantization.quantizedBitDepth;
  const quantInputBits = gray.length * detectedProfile.bitsPerPixel;
  const quantMetrics = computeMetrics(gray, quantization.reconstructed, quantInputBits, quantization.theoreticalBits);
  const quantizedChecksum = dataChecksum(quantizedCodes);

  const rleEncodeStart = performance.now();
  const rleEncoded = encodeRLEMatrix(quantizedCodes, decoded.width, decoded.height, level);
  const rleEncodeMs = performance.now() - rleEncodeStart;
  const rleDecodeStart = performance.now();
  const rleDecodedCodes = decodeRLEMatrix(rleEncoded);
  const rleDecodeMs = performance.now() - rleDecodeStart;
  const rleReconstructed = inverseQuantization(rleDecodedCodes, quantization.groups);
  const rleCodeMetrics = computeMetrics(quantizedCodes, rleDecodedCodes, sourceRawBits, rleEncoded.theoreticalBits);
  const rleReconstructionMetrics = computeMetrics(gray, rleReconstructed, sourceRawBits, rleEncoded.theoreticalBits);
  const rleActualBytes = estimateActualBytes({
    format: "RLE",
    width: decoded.width,
    height: decoded.height,
    levelCount: level,
    symbolBitWidth: rleEncoded.symbolBitWidth,
    countBitWidth: rleEncoded.countBitWidth,
    pairCount: rleEncoded.pairCount,
    payloadBytes: rleEncoded.payloadBytes,
    quantizationGroups: quantization.groups,
  }) + rleEncoded.payloadBytes;
  const rle = {
    ...rleEncoded,
    encodeMs: rleEncodeMs,
    decodeMs: rleDecodeMs,
    decodedCodes: rleDecodedCodes,
    reconstructed: rleReconstructed,
    decodedChecksum: dataChecksum(rleDecodedCodes),
    identical: arraysEqual(quantizedCodes, rleDecodedCodes),
    roundTripStatus: arraysEqual(quantizedCodes, rleDecodedCodes) ? "OK" : "Gagal",
    codeMetrics: rleCodeMetrics,
    reconstructionMetrics: rleReconstructionMetrics,
    metrics: computeMetrics(quantizedCodes, rleDecodedCodes, sourceRawBits, rleEncoded.theoreticalBits),
    actualBytes: rleActualBytes,
  };

  const huffmanEncodeStart = performance.now();
  const huffmanEncoded = encodeHuffmanCore(quantizedCodes, level);
  const huffmanEncodeMs = performance.now() - huffmanEncodeStart;
  const huffmanDecodeStart = performance.now();
  const huffmanDecodedCodes = decodeHuffmanCore(huffmanEncoded, quantizedCodes.length);
  const huffmanDecodeMs = performance.now() - huffmanDecodeStart;
  const huffmanReconstructed = inverseQuantization(huffmanDecodedCodes, quantization.groups);
  const huffmanCodeMetrics = computeMetrics(quantizedCodes, huffmanDecodedCodes, sourceRawBits, huffmanEncoded.payloadBits);
  const huffmanReconstructionMetrics = computeMetrics(gray, huffmanReconstructed, sourceRawBits, huffmanEncoded.payloadBits);
  const huffmanActualBytes = estimateActualBytes({
    format: "Huffman",
    width: decoded.width,
    height: decoded.height,
    levelCount: level,
    bitLength: huffmanEncoded.packed.bitLength,
    payloadBytes: huffmanEncoded.payloadBytes,
    frequencies: huffmanEncoded.frequencies,
    quantizationGroups: quantization.groups,
  }) + huffmanEncoded.payloadBytes;
  const huffman = {
    ...huffmanEncoded,
    encodeMs: huffmanEncodeMs,
    decodeMs: huffmanDecodeMs,
    decodedCodes: huffmanDecodedCodes,
    reconstructed: huffmanReconstructed,
    decodedChecksum: dataChecksum(huffmanDecodedCodes),
    identical: arraysEqual(quantizedCodes, huffmanDecodedCodes),
    roundTripStatus: arraysEqual(quantizedCodes, huffmanDecodedCodes) ? "OK" : "Gagal",
    codeMetrics: huffmanCodeMetrics,
    reconstructionMetrics: huffmanReconstructionMetrics,
    metrics: computeMetrics(quantizedCodes, huffmanDecodedCodes, sourceRawBits, huffmanEncoded.payloadBits),
    actualBytes: huffmanActualBytes,
  };

  const primary = pickPrimaryCompression(method, rle, huffman);
  const decompressed = primary === "RLE" ? rleReconstructed : huffmanReconstructed;
  const compressedBits = primary === "RLE" ? rle.theoreticalBits : huffman.payloadBits;
  const encodeMs = method === "Kuantisasi + RLE + Huffman" ? rle.encodeMs + huffman.encodeMs : (primary === "RLE" ? rle.encodeMs : huffman.encodeMs);
  const decodeMs = method === "Kuantisasi + RLE + Huffman" ? rle.decodeMs + huffman.decodeMs : (primary === "RLE" ? rle.decodeMs : huffman.decodeMs);
  const finalMetrics = computeMetrics(gray, decompressed, sourceRawBits, compressedBits);
  const reconstructionMetrics = computeMetrics(gray, quantization.reconstructed, sourceRawBits, quantization.theoreticalBits);
  const images = {
    gray: grayToUrl(gray, decoded.width, decoded.height),
    quantized: grayToUrl(quantization.reconstructed, decoded.width, decoded.height),
    rleDecompressed: grayToUrl(rleReconstructed, decoded.width, decoded.height),
    huffmanDecompressed: grayToUrl(huffmanReconstructed, decoded.width, decoded.height),
    decompressed: grayToUrl(decompressed, decoded.width, decoded.height),
  };

  const context = {
    file,
    decoded,
    working: { width: decoded.width, height: decoded.height, pixels: decoded.width * decoded.height, grayMs },
    sourceProfile: detectedProfile,
    gray,
    originalGrayscalePixels: gray,
    quantizedCodes,
    reconstructedGrayscalePixels: quantization.reconstructed,
    rleDecodedCodes,
    huffmanDecodedCodes,
    quantizedChecksum,
    maxHistogramCount: Math.max(...quantization.histogram),
    quantization,
    quantInputBits,
    quantMetrics,
    rle,
    huffman,
    compression: { method, primary, sourceLevel: level, sourceRawBits, compressedBits, encodeMs, decodeMs },
    decompressed,
    finalMetrics,
    reconstructionMetrics,
    images,
  };

  return { ...context, rows: buildRows(context, outputMode) };
}

function pickPrimaryCompression(method, rle, huffman) {
  if (method === "RLE" || method === "Kuantisasi + RLE") return "RLE";
  if (method === "Huffman" || method === "Kuantisasi + Huffman") return "Huffman";
  return rle.theoreticalBits <= huffman.payloadBits ? "RLE" : "Huffman";
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
      "Level Kuantisasi": ctx.quantization.levelCount,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.quantInputBits),
      "Nilai Unik": uniqueCount(ctx.quantization.codes),
      "Ukuran Kompresi": bits(ctx.quantization.theoreticalBits),
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
    push({
      Tahap: "RLE",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.compression.sourceRawBits),
      "Nilai Unik": uniqueCount(ctx.quantizedCodes),
      "Ukuran Kompresi": bits(ctx.rle.theoreticalBits),
      "Jumlah Run": ctx.rle.pairCount,
      "Waktu Encode": seconds(ctx.rle.encodeMs),
      "Waktu Decode": seconds(ctx.rle.decodeMs),
      "Compression Ratio": fixed(ctx.rle.metrics.cr),
      "Space Saving (%)": fixed(ctx.rle.metrics.ss),
      MSE: fixed(ctx.rle.codeMetrics.mse),
      PSNR: psnr(ctx.rle.codeMetrics.psnr),
      Analisis: "RLE diproses per baris dan lossless terhadap matrix kode kuantisasi.",
    });
  }

  if (includeFull && ctx.huffman) {
    push({
      Tahap: "Huffman",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Ukuran File (Disk)": diskSizeText,
      "Ukuran Data Mentah": bits(ctx.compression.sourceRawBits),
      "Nilai Unik": ctx.huffman.codeEntries.filter((entry) => entry.frequency > 0).length,
      "Ukuran Kompresi": bits(ctx.huffman.payloadBits),
      "Jumlah Run": "-",
      "Waktu Encode": seconds(ctx.huffman.encodeMs),
      "Waktu Decode": seconds(ctx.huffman.decodeMs),
      "Compression Ratio": fixed(ctx.huffman.metrics.cr),
      "Space Saving (%)": fixed(ctx.huffman.metrics.ss),
      MSE: fixed(ctx.huffman.codeMetrics.mse),
      PSNR: psnr(ctx.huffman.codeMetrics.psnr),
      Analisis: "Huffman dibangun dari frekuensi aktual kode kuantisasi dan lossless terhadap matrix kode.",
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
    "Jumlah Run": ctx.rle?.pairCount ?? "-",
    "Waktu Encode": includeFull ? "-" : seconds(ctx.compression.encodeMs),
    "Waktu Decode": seconds(ctx.compression.decodeMs),
    "Compression Ratio": fixed(ctx.finalMetrics.cr),
    "Space Saving (%)": fixed(ctx.finalMetrics.ss),
    MSE: fixed(ctx.finalMetrics.mse),
    PSNR: psnr(ctx.finalMetrics.psnr),
    Analisis: `Data ${ctx.compression.primary} dikembalikan menjadi kode kuantisasi, divalidasi checksum, lalu inverse quantization.`,
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
      "Jumlah Run": ctx.rle?.pairCount ?? "-",
      "Waktu Encode": seconds(ctx.compression.encodeMs),
      "Waktu Decode": seconds(ctx.compression.decodeMs),
      "Compression Ratio": fixed(ctx.finalMetrics.cr),
      "Space Saving (%)": fixed(ctx.finalMetrics.ss),
      MSE: fixed(ctx.finalMetrics.mse),
      PSNR: psnr(ctx.finalMetrics.psnr),
      Analisis: `Ringkasan final memakai metode terpilih ${ctx.compression.primary}; RLE dan Huffman tetap dihitung independen.`,
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
  const huffmanInputBits = ctx.compression.sourceRawBits;

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
  lines.push(`Validasi pilihan: ${ctx.quantization.levelCount} < ${ctx.sourceProfile.estimatedLevel} -> valid`);
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
  lines.push(`Substitusi: n=${ctx.gray.length}, L=${q.levelCount}, T=n/L=${ctx.gray.length}/${q.levelCount}=${fixed(q.targetPerGroup)} piksel/kelompok`);
  lines.push(`bq = ceil(log2(${q.levelCount})) = ${q.quantizedBitDepth} bit`);
  lines.push(`S_q = ${q.codes.length} x ${q.quantizedBitDepth} = ${q.theoreticalBits} bit`);
  lines.push("Tabel pengelompokan kuantisasi:");
  lines.push(...formatQuantizationGroups(q.groups));
  lines.push(`CR_q = ${ctx.quantInputBits}/${q.theoreticalBits} = ${fixed(qMetrics.cr)}`);
  lines.push(`SS_q = (1 - ${q.theoreticalBits}/${ctx.quantInputBits}) x 100% = ${fixed(qMetrics.ss)}%`);
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
    const rleSaving = (1 - ctx.rle.theoreticalBits / rleInputBits) * 100;
    lines.push(`n = ${ctx.quantizedCodes.length}`);
    lines.push(`k = ${ctx.rle.pairCount}`);
    lines.push(`b_p = ceil(log2(${ctx.compression.sourceLevel})) = ${ctx.rle.symbolBitWidth} bit`);
    lines.push(`b_q = ceil(log2(${ctx.rle.width} + 1)) = ${ctx.rle.countBitWidth} bit`);
    lines.push(`S_RLE = (${ctx.rle.pairCount} x ${ctx.rle.symbolBitWidth}) + (${ctx.rle.pairCount} x ${ctx.rle.countBitWidth}) = ${ctx.rle.theoreticalBits} bit`);
    lines.push(`Rasio materi = 100% - (${ctx.rle.theoreticalBits}/${rleInputBits} x 100%) = ${fixed(rleSaving)}%`);
    lines.push(`r = ${ctx.quantizedCodes.length}/${ctx.rle.pairCount} = ${fixed(ctx.quantizedCodes.length / ctx.rle.pairCount)} piksel/run`);
    lines.push(`Checksum kode asli = ${ctx.quantizedChecksum}`);
    lines.push(`Checksum hasil decode RLE = ${ctx.rle.decodedChecksum}`);
    lines.push(`Round-trip RLE = ${ctx.rle.roundTripStatus}`);
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
    lines.push(`Jumlah simbol unik = ${ctx.huffman.codeEntries.filter((entry) => entry.frequency > 0).length}`);
    lines.push("Proses penggabungan pohon Huffman:");
    lines.push(...formatHuffmanMergeSteps(ctx.huffman.mergeHistory));
    lines.push("Tabel Metode Pemampatan Huffman:");
    lines.push(...formatHuffmanTable(ctx.huffman.codeEntries));
    lines.push(`S_H = ${ctx.huffman.payloadBits} bit`);
    lines.push(`L_avg = ${fixed(ctx.huffman.averageLength, 6)} bit/simbol`);
    lines.push(`H = ${fixed(ctx.huffman.entropy, 6)} bit/simbol`);
    lines.push(`eta = ${fixed(ctx.huffman.efficiency)}%`);
    lines.push(`Redundansi = ${fixed(100 - ctx.huffman.efficiency)}%`);
    lines.push(`CR_H = ${huffmanInputBits}/${ctx.huffman.payloadBits} = ${fixed(huffmanInputBits / ctx.huffman.payloadBits)}`);
    lines.push(`SS_H = (1 - ${ctx.huffman.payloadBits}/${huffmanInputBits}) x 100% = ${fixed((1 - ctx.huffman.payloadBits / huffmanInputBits) * 100)}%`);
    lines.push(`Checksum kode asli = ${ctx.quantizedChecksum}`);
    lines.push(`Checksum hasil decode Huffman = ${ctx.huffman.decodedChecksum}`);
    lines.push(`Round-trip Huffman = ${ctx.huffman.roundTripStatus}`);
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
  const lines = ["g | rentang k | intensitas masuk | jumlah piksel | target | selisih | I_recon(g) | kode bit"];
  for (const group of groups) {
    lines.push(`${group.code} | ${group.minIntensity}-${group.maxIntensity} | ${compactIntensities(group.includedIntensities)} | ${group.pixelCount} | ${fixed(group.targetCount, 2)} | ${fixed(group.differenceFromTarget, 2)} | ${group.representativeIntensity} | ${group.outputBitCode}`);
  }
  return lines;
}

function formatRlePairs(rle) {
  const lines = [];
  const maxPairs = 200;
  const allPairs = rle.rows.flatMap((row) => row.pairs.map((pair) => [row.rowIndex, pair.value, pair.count]));
  const pairs = allPairs.slice(0, maxPairs).map(([row, p, q]) => `row ${row}:(${p},${q})`);
  lines.push(pairs.join(", "));
  if (allPairs.length > maxPairs) {
    lines.push(`... ditampilkan ${maxPairs} pasangan pertama dari total ${allPairs.length} pasangan agar detail tetap ringan dibaca.`);
  }
  const rowRunCounts = rle.rows.map((row) => row.pairs.length);
  lines.push(`Jumlah run per baris awal: ${rowRunCounts.slice(0, 20).join(", ")}${rowRunCounts.length > 20 ? ", ..." : ""}`);
  return lines;
}

function formatHuffmanMergeSteps(steps) {
  if (!steps.length) return ["Hanya ada satu simbol; kode Huffman langsung diberi 0."];
  return steps.map((step) => `${step.step}. Gabung ${step.leftSymbols.join("")} (${step.leftFrequency}) + ${step.rightSymbols.join("")} (${step.rightFrequency}) = ${step.mergedFrequency}`);
}

function formatHuffmanTable(table) {
  const lines = ["k/simbol | n_k | P(k) | kode | panjang | n_k x panjang"];
  for (const row of table) {
    lines.push(`${row.symbol} | ${row.frequency} | ${fixed(row.probability, 6)} | ${row.code ?? "-"} | ${row.codeLength || "-"} | ${row.totalBits}`);
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

function buildRleExport(result) {
  return {
    format: "RLE_PER_ROW",
    width: result.rle.width,
    height: result.rle.height,
    levelCount: result.quantization.levelCount,
    symbolBitWidth: result.rle.symbolBitWidth,
    countBitWidth: result.rle.countBitWidth,
    pairCount: result.rle.pairCount,
    theoreticalBits: result.rle.theoreticalBits,
    payloadBytes: result.rle.payloadBytes,
    actualBytes: result.rle.actualBytes,
    checksumBefore: result.quantizedChecksum,
    checksumAfter: result.rle.decodedChecksum,
    roundTripStatus: result.rle.roundTripStatus,
    quantizationGroups: result.quantization.groups,
    rows: result.rle.rows,
  };
}

function buildHuffmanExport(result) {
  return {
    format: "HUFFMAN_PACKED_BITS",
    width: result.working.width,
    height: result.working.height,
    levelCount: result.quantization.levelCount,
    bitLength: result.huffman.packed.bitLength,
    payloadBytes: result.huffman.payloadBytes,
    payloadBits: result.huffman.payloadBits,
    actualBytes: result.huffman.actualBytes,
    frequencies: result.huffman.frequencies,
    codeEntries: result.huffman.codeEntries,
    mergeHistory: result.huffman.mergeHistory,
    packedBytes: Array.from(result.huffman.packed.bytes),
    checksumBefore: result.quantizedChecksum,
    checksumAfter: result.huffman.decodedChecksum,
    roundTripStatus: result.huffman.roundTripStatus,
    quantizationGroups: result.quantization.groups,
  };
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

function downloadDataUrl(dataUrl, filename) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
