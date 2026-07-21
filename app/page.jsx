"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  arraysEqual,
  buildFrequencyTable,
  buildHuffmanCodebook,
  buildHuffmanTree,
  checksum as dataChecksum,
  decodeHuffman as decodeHuffmanCore,
  decodeRLEMatrix,
  encodeRLEMatrix,
  estimateActualBytes,
  inverseQuantization,
  packBits,
  quantizeEqualPopulation,
} from "../lib/compression-core.js";
import {
  buildCompressionMetrics,
  buildDetectedFixedBitSizeBits,
  buildGrayscaleRawSizeBits,
  buildReconstructionMetrics,
  buildRoundTripMetrics,
  buildSkippedReason,
  buildBenchmarkSummary,
  classifyCompression,
  serializeAnomalySummaryCsv,
  serializeRawNumericCsv,
  serializeResearchSummaryCsv,
  serializeSummaryByFormatCsv,
  serializeTimingSummaryCsv,
  summarizeAnomalyRows,
  summarizeResearchRows,
  summarizeResearchRowsByFormat,
  summarizeTimingRows,
} from "../lib/research-metrics.js";

const LEVELS = [256, 128, 64, 32, 16, 8];
const METHODS = ["RLE", "Huffman", "Kuantisasi + RLE", "Kuantisasi + Huffman", "Kuantisasi + Perbandingan RLE dan Huffman"];
const OUTPUT_MODES = ["1. Alur Lengkap", "2. Per Citra/Tahap"];
const MAX_PIXELS = 1200000;
const WORKFLOW_STEPS = ["Input Citra", "Grayscale", "Kuantisasi", "RLE", "Huffman", "Dekompresi", "Evaluasi"];
const RLE_PAGE_SIZE = 60;
const TABLE_PAGE_SIZE = 40;
const DATASET_FORMATS = ["JPG/JPEG", "PNG", "BMP", "TIFF"];
const MULTI_LEVEL_COLUMNS = [
  "No",
  "Image Name",
  "Format",
  "Resolusi Sumber",
  "Resolusi Kerja",
  "Quantization Level",
  "Bit per Piksel",
  "Raw Working Grayscale Size",
  "Quantized Fixed-bit Size",
  "RLE Theoretical Payload",
  "Huffman Theoretical Payload",
  "RLE Estimated Export Size",
  "Huffman Estimated Export Size",
  "Compression Ratio RLE",
  "Compression Ratio Huffman",
  "Space Saving RLE",
  "Space Saving Huffman",
  "Reconstruction MSE Kuantisasi",
  "Reconstruction PSNR Kuantisasi",
  "Reconstruction MSE RLE",
  "Reconstruction PSNR RLE",
  "Reconstruction MSE Huffman",
  "Reconstruction PSNR Huffman",
  "Round-trip MSE RLE",
  "Round-trip PSNR RLE",
  "Round-trip MSE Huffman",
  "Round-trip PSNR Huffman",
  "Waktu Kuantisasi",
  "Waktu RLE Encode",
  "Waktu RLE Decode",
  "Waktu RLE Inverse Quantization",
  "Waktu RLE Validasi",
  "Waktu Huffman Encode",
  "Waktu Huffman Frequency",
  "Waktu Huffman Tree",
  "Waktu Huffman Codebook",
  "Waktu Huffman Bitstream",
  "Waktu Huffman Packing",
  "Waktu Huffman Decode",
  "Waktu Huffman Inverse Quantization",
  "Waktu Huffman Validasi",
  "Total Waktu RLE",
  "Total Waktu Huffman",
  "Best Method",
  "Status",
];
const MULTI_LEVEL_TABS = ["Ukuran & Efisiensi", "Kualitas Citra", "Performa"];

const TERM_HELP = {
  histogram: "Histogram menunjukkan jumlah piksel pada setiap nilai intensitas grayscale.",
  intensitas: "Intensitas adalah nilai terang-gelap piksel grayscale, dari 0 hitam sampai 255 putih.",
  simbol: "Simbol adalah kode kuantisasi yang diproses oleh RLE atau Huffman.",
  run: "Run adalah deretan piksel bernilai sama yang muncul berurutan pada satu baris.",
  "bit depth": "Bit depth adalah jumlah bit yang diperlukan untuk menyimpan satu piksel atau satu simbol.",
  payload: "Payload adalah data inti hasil kompresi tanpa metadata pembantu.",
  overhead: "Overhead adalah metadata seperti ukuran citra, tabel frekuensi, padding, dan mapping kuantisasi.",
  codebook: "Codebook adalah daftar pasangan simbol dan kode Huffman binernya.",
  bitstream: "Bitstream adalah rangkaian bit 0 dan 1 hasil encoding Huffman.",
  "round-trip": "Round-trip berarti data dikompresi lalu didekode kembali dan dibandingkan dengan data sebelum kompresi.",
  MSE: "MSE mengukur rata-rata kesalahan piksel. Nilai lebih kecil lebih baik.",
  PSNR: "PSNR mengukur kemiripan kualitas citra. Nilai lebih besar lebih baik.",
};

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
  "Source File Size (Disk)",
  "Raw Source Grayscale Size",
  "Raw Working Grayscale Size",
  "Quantized Fixed-bit Size",
  "RLE Theoretical Payload",
  "Huffman Theoretical Payload",
  "Estimated Export Size",
  "Nilai Unik",
  "Jumlah Run",
  "Waktu Encode",
  "Waktu Decode",
  "Waktu Total",
  "Compression Ratio",
  "Space Saving (%)",
  "Reconstruction MSE",
  "Reconstruction PSNR",
  "Round-trip MSE",
  "Round-trip PSNR",
  "Piksel Berbeda",
  "Max Absolute Difference",
  "Checksum Sebelum",
  "Checksum Sesudah",
  "Status Validasi",
  "Analisis",
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [decoded, setDecoded] = useState(null);
  const [datasetItems, setDatasetItems] = useState([]);
  const [sourceProfile, setSourceProfile] = useState(null);
  const [level, setLevel] = useState(64);
  const [method, setMethod] = useState("Kuantisasi + Perbandingan RLE dan Huffman");
  const [processingMode, setProcessingMode] = useState("optimized");
  const [contentCategory, setContentCategory] = useState("unlabeled");
  const [benchmarkMode, setBenchmarkMode] = useState(false);
  const [outputMode, setOutputMode] = useState("1. Alur Lengkap");
  const [showDetailAfterEval, setShowDetailAfterEval] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMultiTesting, setIsMultiTesting] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [multiProgress, setMultiProgress] = useState("");
  const [multiLevelRows, setMultiLevelRows] = useState([]);
  const [analysisTableView, setAnalysisTableView] = useState("Ringkas");
  const [error, setError] = useState("");
  const [rlePage, setRlePage] = useState(0);

  const detailLines = useMemo(() => {
    if (!result) return [];
    return buildDetailReport(result, outputMode);
  }, [result, outputMode]);
  const summaryStats = useMemo(() => buildSummaryStats(result), [result]);
  const researchSummaryRows = useMemo(() => summarizeResearchRows(getResearchRawRows(result, multiLevelRows)), [result, multiLevelRows]);

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
    const files = Array.from(event.target.files ?? []);
    setError("");
    setResult(null);
    setSourceProfile(null);
    setDatasetItems([]);
    setMultiLevelRows([]);
    setShowDetail(false);
    if (!files.length) return;

    try {
      setIsProcessing(true);
      const items = [];
      for (const [index, file] of files.entries()) {
        setProcessingStage(`Membaca citra ${index + 1}/${files.length}`);
        try {
          const image = await decodeImageFile(file, processingMode);
          setProcessingStage(`Menganalisis level sumber ${index + 1}/${files.length}`);
          const grayPreview = toGrayscale(image.rgba, image.width, image.height);
          const profile = analyzeSourceQuantization(grayPreview);
          items.push({
            id: `${file.name}-${file.size}-${index}`,
            fileInfo: {
              name: file.name,
              type: file.type || extensionOf(file.name).toUpperCase(),
              size: file.size,
              format: extensionOf(file.name).toUpperCase(),
            },
            decoded: image,
            sourceProfile: profile,
            error: "",
          });
        } catch (err) {
          items.push({
            id: `${file.name}-${file.size}-${index}`,
            fileInfo: {
              name: file.name,
              type: file.type || extensionOf(file.name).toUpperCase(),
              size: file.size,
              format: extensionOf(file.name).toUpperCase(),
            },
            decoded: null,
            sourceProfile: null,
            error: err instanceof Error ? err.message : "Format tidak dapat dibaca browser.",
          });
        }
        await yieldToBrowser();
      }

      setDatasetItems(items);
      const firstValid = items.find((item) => item.decoded);
      if (!firstValid) throw new Error("Tidak ada citra yang berhasil dibaca. Coba gunakan JPG, PNG, BMP, atau TIFF yang valid.");
      const nextValidLevel = highestValidTargetLevel(firstValid.sourceProfile.estimatedLevel);
      setDecoded(firstValid.decoded);
      setSourceProfile(firstValid.sourceProfile);
      setLevel((current) => current < firstValid.sourceProfile.estimatedLevel ? current : nextValidLevel);
      setFileInfo(firstValid.fileInfo);
    } catch (err) {
      setError(`Tahap upload gagal: ${err instanceof Error ? err.message : "Citra gagal dibaca."}`);
      setDecoded(null);
      setSourceProfile(null);
      setFileInfo(null);
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
    }
  }

  function processImage() {
    if (!decoded || !fileInfo) {
      setError("Pilih citra terlebih dahulu.");
      return;
    }

    if (sourceProfile && level >= sourceProfile.estimatedLevel) {
      setError(`SKIPPED: level kuantisasi ${level} tidak diproses karena level sumber terdeteksi sekitar ${sourceProfile.estimatedLevel}. ${buildSkippedReason()}`);
      return;
    }

    setError("");
    setIsProcessing(true);
    setProcessingStage("Menjalankan pipeline kompresi");
    try {
      const next = benchmarkMode
        ? runBenchmarkPipeline(decoded, fileInfo, level, method, outputMode, sourceProfile, contentCategory)
        : runPipeline(decoded, fileInfo, level, method, outputMode, sourceProfile, contentCategory);
      setResult(next);
      setShowDetail(showDetailAfterEval);
      setRlePage(0);
    } catch (err) {
      setError(`Tahap evaluasi gagal: ${err instanceof Error ? err.message : "Pemrosesan gagal."}`);
    } finally {
      setIsProcessing(false);
      setProcessingStage("");
    }
  }

  function downloadCsv() {
    if (!result) return;
    const csv = toCsv([TABLE_COLUMNS, ...result.rows.map((row) => TABLE_COLUMNS.map((column) => row[column] ?? "-"))]);
    downloadText(csv, `${withoutExtension(result.file.name)}_evaluasi.csv`, "text/csv;charset=utf-8");
  }

  function downloadResearchCsv() {
    const rawRows = getResearchRawRows(result, multiLevelRows);
    if (!rawRows.length) return;
    const name = multiLevelRows.length ? "multi_level_research_raw_numeric.csv" : `${withoutExtension(result.file.name)}_research_raw_numeric.csv`;
    downloadText(serializeRawNumericCsv(rawRows), name, "text/csv;charset=utf-8");
  }

  function downloadResearchSummaryCsv() {
    const rawRows = getResearchRawRows(result, multiLevelRows);
    if (!rawRows.length) return;
    downloadText(serializeResearchSummaryCsv(summarizeResearchRows(rawRows)), "summary_by_level.csv", "text/csv;charset=utf-8");
  }

  function downloadSummaryByFormatCsv() {
    const rawRows = getResearchRawRows(result, multiLevelRows);
    if (!rawRows.length) return;
    downloadText(serializeSummaryByFormatCsv(summarizeResearchRowsByFormat(rawRows)), "summary_by_format.csv", "text/csv;charset=utf-8");
  }

  function downloadAnomalySummaryCsv() {
    const rawRows = getResearchRawRows(result, multiLevelRows);
    if (!rawRows.length) return;
    downloadText(serializeAnomalySummaryCsv(summarizeAnomalyRows(rawRows)), "anomaly_summary.csv", "text/csv;charset=utf-8");
  }

  function downloadTimingSummaryCsv() {
    const rawRows = getResearchRawRows(result, multiLevelRows);
    if (!rawRows.length) return;
    downloadText(serializeTimingSummaryCsv(summarizeTimingRows(rawRows)), "timing_summary.csv", "text/csv;charset=utf-8");
  }

  function downloadDetail() {
    if (!result) return;
    downloadText(detailLines.join("\n"), `${withoutExtension(result.file.name)}_detail_perhitungan.txt`, "text/plain;charset=utf-8");
  }

  async function runMultiLevelTest() {
    const validItems = datasetItems.filter((item) => item.decoded);
    if (!validItems.length) {
      setError("Upload minimal satu citra yang berhasil dibaca sebelum menjalankan multi-level test.");
      return;
    }

    setError("");
    setIsMultiTesting(true);
    setMultiLevelRows([]);
    const rows = [];
    let no = 1;
    try {
      for (const [imageIndex, item] of validItems.entries()) {
        for (const levelValue of LEVELS) {
          setMultiProgress(`${imageIndex + 1}/${validItems.length} citra, level ${levelValue}`);
          await yieldToBrowser();
          if (levelValue >= item.sourceProfile.estimatedLevel) {
            rows.push(buildInvalidMultiLevelRow(no++, item, levelValue, contentCategory));
            continue;
          }
          const testResult = (benchmarkMode ? runBenchmarkPipeline : runPipeline)(
            item.decoded,
            item.fileInfo,
            levelValue,
            "Kuantisasi + Perbandingan RLE dan Huffman",
            "1. Alur Lengkap",
            item.sourceProfile,
            contentCategory,
          );
          rows.push(buildMultiLevelRow(no++, item, levelValue, testResult));
          setMultiLevelRows([...rows]);
        }
      }
      setMultiLevelRows(rows);
    } catch (err) {
      setError(`Tahap multi-level test gagal: ${err instanceof Error ? err.message : "Pengujian tidak dapat diselesaikan."}`);
    } finally {
      setIsMultiTesting(false);
      setMultiProgress("");
    }
  }

  function downloadMultiLevelCsv() {
    if (!multiLevelRows.length) return;
    const csv = toCsv([MULTI_LEVEL_COLUMNS, ...multiLevelRows.map((row) => MULTI_LEVEL_COLUMNS.map((column) => row[column] ?? "-"))]);
    downloadText(csv, "multi_level_quantization_test.csv", "text/csv;charset=utf-8");
  }

  function resetApp() {
    setFileInputKey((value) => value + 1);
    setFileInfo(null);
    setDecoded(null);
    setDatasetItems([]);
    setSourceProfile(null);
    setLevel(64);
    setMethod("Kuantisasi + Perbandingan RLE dan Huffman");
    setProcessingMode("optimized");
    setContentCategory("unlabeled");
    setBenchmarkMode(false);
    setOutputMode("1. Alur Lengkap");
    setShowDetailAfterEval(false);
    setShowDetail(false);
    setResult(null);
    setIsProcessing(false);
    setProcessingStage("");
    setMultiProgress("");
    setMultiLevelRows([]);
    setIsMultiTesting(false);
    setAnalysisTableView("Ringkas");
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
            {isProcessing ? processingStage || "Memproses..." : result ? "Evaluasi siap" : decoded ? "Citra siap" : "Siap"}
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
            <input key={fileInputKey} type="file" accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,image/*" multiple onChange={onPickFile} />
            <small className="help">Format: JPG/JPEG, PNG, BMP, TIFF. Bisa pilih banyak citra; file pertama yang valid dipakai untuk flow utama.</small>
          </label>

          <label className="field">
            <span>Level Kuantisasi</span>
            <select value={level} onChange={(event) => setLevel(Number(event.target.value))}>
              {LEVELS.map((value) => (
                <option key={value} value={value} disabled={sourceProfile ? value >= sourceProfile.estimatedLevel : false}>
                  {value} level{sourceProfile && value >= sourceProfile.estimatedLevel ? " (SKIPPED)" : ""}
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
            <span>Mode Resolusi</span>
            <select value={processingMode} onChange={(event) => setProcessingMode(event.target.value)} disabled={isProcessing || isMultiTesting}>
              <option value="optimized">Optimalkan untuk Browser</option>
              <option value="original">Proses dengan Resolusi Asli</option>
            </select>
            <small className="help">Mode optimasi dapat mengecilkan citra besar. Mode asli lebih akurat terhadap file sumber, tetapi bisa lebih lambat.</small>
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

          <label className="field">
            <span>Kategori Konten</span>
            <input
              type="text"
              value={contentCategory}
              onChange={(event) => setContentCategory(event.target.value)}
              placeholder="mis. nature, portrait, document"
            />
            <small className="help">Metadata penelitian opsional; gunakan unlabeled jika belum diklasifikasi.</small>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={showDetailAfterEval}
              onChange={(event) => setShowDetailAfterEval(event.target.checked)}
            />
            <span>Tampilkan detail perhitungan setelah evaluasi</span>
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={benchmarkMode}
              onChange={(event) => setBenchmarkMode(event.target.checked)}
            />
            <span>Benchmark mode: 1 warm-up + 5 measured runs</span>
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
            <button type="button" className="secondary" onClick={processImage} disabled={!decoded || isProcessing}>Kompres RLE</button>
            <button type="button" className="secondary" onClick={() => setShowDetail(true)} disabled={!result}>Dekompresi RLE</button>
            <button type="button" className="secondary" onClick={downloadRleData} disabled={!result}>Unduh Data RLE</button>
            <button type="button" className="secondary" onClick={downloadRleReconstruction} disabled={!result}>Unduh Citra RLE</button>
            <button type="button" className="secondary" onClick={processImage} disabled={!decoded || isProcessing}>Kompres Huffman</button>
            <button type="button" className="secondary" onClick={() => setShowDetail(true)} disabled={!result}>Dekompresi Huffman</button>
            <button type="button" className="secondary" onClick={downloadHuffmanData} disabled={!result}>Unduh Data Huffman</button>
            <button type="button" className="secondary" onClick={downloadHuffmanReconstruction} disabled={!result}>Unduh Citra Huffman</button>
            <button type="button" className="secondary" onClick={runMultiLevelTest} disabled={!datasetItems.some((item) => item.decoded) || isProcessing || isMultiTesting}>
              {isMultiTesting ? "Menjalankan Multi-Level..." : "Run Multi-Level Test"}
            </button>
            <button type="button" className="secondary" onClick={downloadMultiLevelCsv} disabled={!multiLevelRows.length}>Unduh CSV Multi-Level</button>
            <button type="button" className="secondary" onClick={downloadCsv} disabled={!result}>Unduh CSV</button>
            <button type="button" className="secondary" onClick={downloadResearchCsv} disabled={!result && !multiLevelRows.length}>Unduh CSV Penelitian - Raw Numeric</button>
            <button type="button" className="secondary" onClick={downloadResearchSummaryCsv} disabled={!result && !multiLevelRows.length}>summary_by_level.csv</button>
            <button type="button" className="secondary" onClick={downloadSummaryByFormatCsv} disabled={!result && !multiLevelRows.length}>summary_by_format.csv</button>
            <button type="button" className="secondary" onClick={downloadAnomalySummaryCsv} disabled={!result && !multiLevelRows.length}>anomaly_summary.csv</button>
            <button type="button" className="secondary" onClick={downloadTimingSummaryCsv} disabled={!result && !multiLevelRows.length}>timing_summary.csv</button>
            <button type="button" className="secondary" onClick={downloadDetail} disabled={!result}>Unduh Detail</button>
            <button type="button" className="secondary reset" onClick={resetApp}>Reset</button>
          </div>
        </section>

        <PipelineExplanation />

        <DatasetRecap items={datasetItems} />

        {decoded && <ResolutionPanel decoded={decoded} />}

        {(multiLevelRows.length > 0 || isMultiTesting) && (
          <MultiLevelResults rows={multiLevelRows} progress={multiProgress} isRunning={isMultiTesting} onDownload={downloadMultiLevelCsv} />
        )}

        {researchSummaryRows.length > 0 && (
          <ResearchSummary rows={researchSummaryRows} onDownload={downloadResearchSummaryCsv} />
        )}

        {error && <div className="alert">{error}</div>}

        {!decoded && (
          <section className="empty-state" aria-label="Status awal">
            <p className="eyebrow">Mulai Analisis</p>
            <h2>Unggah citra untuk memulai analisis.</h2>
            <p>Setelah file dipilih, aplikasi akan membaca metadata, menghitung grayscale, mendeteksi level sumber, lalu mengaktifkan pilihan kuantisasi yang valid.</p>
          </section>
        )}

        {decoded && !result && (
          <section className="preview-section" aria-label="Preview citra awal">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Input Citra</p>
                <h2>Citra Siap Diproses</h2>
              </div>
              <span>{fileInfo?.name}</span>
            </div>
            <div className="preview-grid single">
              <ImagePanel title="Asli" src={decoded.previewUrl} meta={`${decoded.originalWidth} x ${decoded.originalHeight}`} />
              <article className="meaning-panel">
                <h3>Apa arti hasil ini?</h3>
                <p>Citra sudah berhasil dibaca. Pilih level kuantisasi di bawah level sumber, lalu klik Proses & Evaluasi untuk melihat grayscale, kuantisasi, RLE, Huffman, dekompresi, dan metrik kualitas.</p>
              </article>
            </div>
          </section>
        )}

        {result && (
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
            <ImagePanel title="RLE Dekompresi" src={result?.images.rleDecompressed} meta={result ? (result.rle.roundTripValidation.isByteIdentical ? "Round-trip valid" : "Round-trip gagal") : "-"} />
            <ImagePanel title="Huffman Dekompresi" src={result?.images.huffmanDecompressed} meta={result ? (result.huffman.roundTripValidation.isByteIdentical ? "Round-trip valid" : "Round-trip gagal") : "-"} />
          </div>
        </section>
        )}

        {result && (
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
        )}

        {result && (
          <AnalysisPanels result={result} rlePage={rlePage} setRlePage={setRlePage} />
        )}

        {result && (
        <details className="table-section disclosure">
          <summary>
            <div>
              <p className="eyebrow">Output Evaluasi</p>
              <h2>Tabel Analisis</h2>
            </div>
            <span>{result.rows.length} baris, klik untuk membuka tabel lengkap</span>
          </summary>
          <div className="table-toolbar">
            <div className="tabs small" role="tablist" aria-label="Mode tampilan tabel analisis">
              {["Ringkas", "Detail"].map((view) => (
                <button key={view} type="button" className={analysisTableView === view ? "tab-button active" : "tab-button"} onClick={() => setAnalysisTableView(view)}>
                  {view} View
                </button>
              ))}
            </div>
            <p className="table-hint">Geser tabel ke kanan untuk melihat kolom lengkap. Kolom penting tetap berada di sisi kiri.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {columnsForAnalysisView(analysisTableView).map((column) => <th key={column}>{column}</th>)}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                    <tr key={row.No}>
                      {columnsForAnalysisView(analysisTableView).map((column) => <td key={column}>{row[column]}</td>)}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        )}

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

function PipelineExplanation() {
  return (
    <section className="pipeline-panel" aria-label="Penjelasan pipeline kompresi">
      <div>
        <p className="eyebrow">Penjelasan Pipeline</p>
        <h2>Cara Membaca Pipeline</h2>
      </div>
      <div className="pipeline-grid">
        <p><strong>Kuantisasi</strong> mengurangi level grayscale dan dapat menimbulkan loss karena beberapa intensitas diganti oleh nilai representatif.</p>
        <p><strong>RLE</strong> mengevaluasi kode kuantisasi sebagai pasangan (p,q). Metode ini kuat pada citra sederhana, tetapi bisa membesar pada citra tekstur karena jumlah run tinggi.</p>
        <p><strong>Huffman</strong> juga mengevaluasi kode kuantisasi secara langsung. Simbol yang sering muncul mendapat kode lebih pendek berdasarkan distribusi frekuensi.</p>
        <p><strong>Mode perbandingan</strong> berarti RLE dan Huffman dibandingkan sebagai dua metode setelah kuantisasi, bukan Huffman diterapkan setelah RLE.</p>
      </div>
    </section>
  );
}

function DatasetRecap({ items }) {
  const recap = buildDatasetRecap(items);
  return (
    <section className="dataset-section" aria-label="Rekap dataset multi format">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Dataset Recap</p>
          <h2>Rekap Format Citra</h2>
        </div>
        <span>Minimum rekomendasi 5 citra per format</span>
      </div>
      <div className="format-progress">
        {recap.map((row) => (
          <article key={row.format} className={`format-card ${row.statusClass}`}>
            <span>{row.format}</span>
            <strong>{row.count}/5</strong>
            <small>{row.status}</small>
          </article>
        ))}
      </div>
      <div className="mini-table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Format</th>
              <th>Jumlah Citra</th>
              <th>Nama File</th>
              <th>Dimensi</th>
              <th>Ukuran File Asli</th>
              <th>Status</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {recap.map((row) => (
              <tr key={row.format}>
                <td>{row.format}</td>
                <td>{row.count}</td>
                <td>{row.names || "-"}</td>
                <td>{row.dimensions || "-"}</td>
                <td>{row.sizes || "-"}</td>
                <td>{row.status}</td>
                <td>{row.notes || "Belum ada citra pada format ini."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResolutionPanel({ decoded }) {
  const info = decoded.resolutionInfo;
  return (
    <section className="resolution-panel" aria-label="Resolusi pemrosesan">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resolusi Pemrosesan</p>
          <h2>Sumber vs Resolusi Kerja</h2>
        </div>
        <span>{info.processingMode === "optimized" ? "Optimasi Browser" : "Resolusi Asli"}</span>
      </div>
      {info.wasResized && (
        <div className="warning-note">
          Citra diperkecil dari {info.sourceWidth} x {info.sourceHeight} menjadi {info.workingWidth} x {info.workingHeight} agar pemrosesan tetap stabil di browser. Semua ukuran algoritmik dan evaluasi kualitas dihitung berdasarkan resolusi kerja.
        </div>
      )}
      {info.processingMode === "optimized" && (
        <div className="warning-note">
          Seluruh ukuran algoritmik, MSE, PSNR, dan waktu proses dihitung berdasarkan resolusi kerja.
        </div>
      )}
      <div className="mini-table-wrap">
        <table className="mini-table">
          <tbody>
            <tr><th>Resolusi sumber</th><td>{info.sourceWidth} x {info.sourceHeight} px</td></tr>
            <tr><th>Jumlah piksel sumber</th><td>{number(info.sourcePixelCount)} piksel</td></tr>
            <tr><th>Resolusi kerja</th><td>{info.workingWidth} x {info.workingHeight} px</td></tr>
            <tr><th>Jumlah piksel kerja</th><td>{number(info.workingPixelCount)} piksel</td></tr>
            <tr><th>Skala pemrosesan</th><td>{percent(info.resizeScale * 100)}</td></tr>
            <tr><th>Mode</th><td>{info.processingMode === "optimized" ? "Optimasi Browser" : "Resolusi Asli"}</td></tr>
            <tr><th>Alasan resize</th><td>{info.resizeReason ?? "Tidak ada resize; algoritma memakai resolusi sumber."}</td></tr>
          </tbody>
        </table>
      </div>
      <Meaning>Resolusi sumber adalah ukuran asli file yang diunggah. Resolusi kerja adalah ukuran citra yang digunakan oleh algoritma grayscale, kuantisasi, RLE, Huffman, MSE, dan PSNR.</Meaning>
    </section>
  );
}

function MultiLevelResults({ rows, progress, isRunning, onDownload }) {
  const [query, setQuery] = useState("");
  const [activeTable, setActiveTable] = useState("Ukuran & Efisiensi");
  const filtered = filterRows(rows, query, ["Image Name", "Format", "Quantization Level", "Best Method", "Status"]);
  const grouped = groupRowsByImage(filtered);
  const columns = multiLevelColumnsFor(activeTable);
  const downloadTable = () => {
    const csv = toCsv([["Image Name", "Format", "Resolusi Sumber", "Resolusi Kerja", ...columns], ...filtered.map((row) => [
      row["Image Name"],
      row.Format,
      row["Resolusi Sumber"],
      row["Resolusi Kerja"],
      ...columns.map((column) => row[column] ?? "-"),
    ])]);
    downloadText(csv, `multi_level_${activeTable.toLowerCase().replaceAll(" ", "_").replaceAll("&", "dan")}.csv`, "text/csv;charset=utf-8");
  };
  return (
    <section className="table-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Multi-Level Quantization Test</p>
          <h2>Pengujian Level 256, 128, 64, 32, 16, dan 8</h2>
        </div>
        <span>{isRunning ? progress || "Memproses..." : `${rows.length} baris`}</span>
      </div>
      <div className="table-toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Cari nama citra, format, level, metode terbaik, atau status" />
        <Tabs tabs={MULTI_LEVEL_TABS} active={activeTable} onChange={setActiveTable} />
        <button type="button" className="secondary" onClick={downloadTable} disabled={!rows.length}>Unduh CSV Tabel Ini</button>
        <button type="button" className="secondary" onClick={onDownload} disabled={!rows.length}>Unduh CSV Multi-Level</button>
      </div>
      {grouped.length ? grouped.map((group) => (
        <article key={group.key} className="multi-level-group">
          <div className="multi-level-meta">
            <span>Nama file: <strong>{group.rows[0]["Image Name"]}</strong></span>
            <span>Format: <strong>{group.rows[0].Format}</strong></span>
            <span>Resolusi sumber: <strong>{group.rows[0]["Resolusi Sumber"]}</strong></span>
            <span>Resolusi kerja: <strong>{group.rows[0]["Resolusi Kerja"]}</strong></span>
          </div>
          <MultiLevelTable rows={group.rows} columns={columns} />
        </article>
      )) : (
        <div className="empty">Belum ada hasil yang cocok dengan pencarian.</div>
      )}
    </section>
  );
}

function MultiLevelTable({ rows, columns }) {
  return (
    <div className="multi-level-table-wrapper">
      <table className="multi-level-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column} title={metricTooltip(column)}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.No}-${row["Quantization Level"]}`}>
              {columns.map((column) => <td key={column}>{row[column]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResearchSummary({ rows, onDownload }) {
  return (
    <section className="table-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Rekap Otomatis</p>
          <h2>Ringkasan Penelitian</h2>
        </div>
        <button type="button" className="secondary" onClick={onDownload}>Unduh CSV Ringkasan Penelitian</button>
      </div>
      <div className="mini-table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Level</th>
              <th>Rows</th>
              <th>Skipped</th>
              <th>RLE Reduced</th>
              <th>RLE Unchanged</th>
              <th>RLE Expanded</th>
              <th>Huffman Reduced</th>
              <th>Huffman Unchanged</th>
              <th>Huffman Expanded</th>
              <th>Mean CR RLE</th>
              <th>Mean CR Huffman</th>
              <th>Mean SS RLE</th>
              <th>Mean SS Huffman</th>
              <th>Mean MSE</th>
              <th>Mean PSNR</th>
              <th>Mean Quant Time</th>
              <th>Mean RLE Time</th>
              <th>Mean Huffman Time</th>
              <th>Mean Combined Time</th>
              <th>Best Case</th>
              <th>Worst Case</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quantization_level}>
                <td>{row.quantization_level}</td>
                <td>{row.processed_row_count}</td>
                <td>{row.skipped_count}</td>
                <td>{row.rle_reduced_count}</td>
                <td>{row.rle_unchanged_count}</td>
                <td>{row.rle_expanded_count}</td>
                <td>{row.huffman_reduced_count}</td>
                <td>{row.huffman_unchanged_count}</td>
                <td>{row.huffman_expanded_count}</td>
                <td>{displayDecimal(row.rle_mean_compression_ratio, 4)}</td>
                <td>{displayDecimal(row.huffman_mean_compression_ratio, 4)}</td>
                <td>{displayPercent(row.rle_mean_space_saving_percent)}</td>
                <td>{displayPercent(row.huffman_mean_space_saving_percent)}</td>
                <td>{displayDecimal(row.mean_reconstruction_mse, 6)}</td>
                <td>{displayPsnr(row.mean_reconstruction_psnr_db)}</td>
                <td>{displayMilliseconds(row.mean_quantization_time_ms)}</td>
                <td>{displayMilliseconds(row.mean_rle_total_time_ms)}</td>
                <td>{displayMilliseconds(row.mean_huffman_total_time_ms)}</td>
                <td>{displayMilliseconds(row.mean_combined_experiment_time_ms)}</td>
                <td>{row.best_case_image ? `${row.best_case_method} ${decimal(row.best_case_compression_ratio, 4)} - ${row.best_case_image}` : "-"}</td>
                <td>{row.worst_case_image ? `${row.worst_case_method} ${decimal(row.worst_case_compression_ratio, 4)} - ${row.worst_case_image}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
      { label: "Reconstruction MSE", value: "-", note: "Muncul setelah dekompresi" },
      { label: "Round-trip", value: "-", note: "Muncul setelah validasi decode" },
    ];
  }

  return [
    { label: "File", value: fileSize(result.file.size), note: result.file.name },
    { label: "Level Sumber", value: `${result.sourceProfile.estimatedLevel} level`, note: `${result.sourceProfile.uniqueCount} nilai unik` },
    { label: "RLE", value: bits(result.rle.theoreticalBits), note: result.rle.roundTripValidation.isByteIdentical ? "Round-trip valid" : "Round-trip gagal" },
    { label: "Huffman", value: bits(result.huffman.payloadBits), note: result.huffman.roundTripValidation.isByteIdentical ? "Round-trip valid" : "Round-trip gagal" },
    { label: "Compression Ratio", value: fixed(result.primaryCompressionMetrics.compressionRatio), note: result.primaryCompressionMetrics.baselineLabel },
    { label: "Kualitas", value: `MSE ${fixed(result.quantReconstructionQuality.mse, 6)}`, note: `PSNR ${psnrLabel(result.quantReconstructionQuality.psnr)}` },
  ];
}

function AnalysisPanels({ result, rlePage, setRlePage }) {
  const [rleTab, setRleTab] = useState("Ringkasan");
  const [huffmanTab, setHuffmanTab] = useState("Tabel Frekuensi");
  const [evaluationTab, setEvaluationTab] = useState("Mode Teoritis Materi");
  const [rleSearch, setRleSearch] = useState("");
  const [selectedRleRow, setSelectedRleRow] = useState(0);
  const [huffmanSearch, setHuffmanSearch] = useState("");

  const rlePairs = result.rle.rows.flatMap((row) => row.pairs.map((pair, index) => ({ row: row.rowIndex, run: index + 1, ...pair })));
  const rleRowsSummary = result.rle.rows.map((row) => buildRleRowSummary(row, result.rle));
  const filteredRleRows = filterRows(rleRowsSummary, rleSearch, ["row"]);
  const rlePageCount = Math.max(1, Math.ceil(filteredRleRows.length / 25));
  const safeRlePage = Math.min(rlePage, rlePageCount - 1);
  const visibleRleRows = filteredRleRows.slice(safeRlePage * 25, safeRlePage * 25 + 25);
  const selectedRleData = result.rle.rows.find((row) => row.rowIndex === selectedRleRow) ?? result.rle.rows[0];
  const selectedRlePairs = selectedRleData.pairs.map((pair, index) => ({ row: selectedRleData.rowIndex, run: index + 1, ...pair }));
  const filteredHuffmanEntries = filterRows(result.huffman.codeEntries, huffmanSearch, ["symbol", "frequency", "code", "codeLength"]);
  const huffmanMergeRows = result.huffman.mergeHistory.length
    ? result.huffman.mergeHistory
    : [{ step: 1, leftSymbols: [result.huffman.root.symbol], rightSymbols: [], leftFrequency: result.huffman.root.frequency, rightFrequency: 0, mergedFrequency: result.huffman.root.frequency }];

  return (
    <>
      <StageSection
        number="2"
        title="Grayscale"
        goal="Mengubah citra RGB menjadi satu kanal intensitas agar semua metode bekerja pada data piksel yang seragam."
        controls="Upload citra pada panel Input Citra, lalu jalankan Proses & Evaluasi."
        resultSummary={`Citra grayscale ${result.working.width} x ${result.working.height}, ${uniqueCount(result.gray)} nilai unik.`}
        process={<span>Setiap piksel dihitung dengan Gray = 0.299R + 0.587G + 0.114B, lalu nilai <Term name="intensitas" /> disimpan sebagai 0 sampai 255.</span>}
        howToRead="Bandingkan jumlah piksel, nilai unik, dan ukuran data mentah. PSNR Inf di tahap ini berarti data grayscale menjadi baseline evaluasi."
        status="Valid, citra berhasil dikonversi menjadi grayscale."
        nextAction="Baca histogram, lalu lihat pembentukan kelompok kuantisasi."
      >
        <div className="analysis-grid">
          <ImagePanel title="Grayscale" src={result.images.gray} meta={`${result.working.width} x ${result.working.height}`} />
          <MetricList items={[
            ["Dimensi kerja", `${result.working.width} x ${result.working.height}`],
            ["Jumlah piksel", result.working.pixels],
            ["Nilai unik", uniqueCount(result.gray)],
            ["Level sumber", `${result.sourceProfile.estimatedLevel} level`],
            ["Bit depth sumber", `${result.sourceProfile.bitsPerPixel} bit/piksel`],
            ["Waktu konversi", seconds(result.working.grayMs)],
          ]} />
        </div>
        <Meaning>Grayscale menyederhanakan citra menjadi satu kanal terang-gelap. Tahap ini belum melakukan kompresi, tetapi menjadi sumber data untuk kuantisasi, RLE, Huffman, dan evaluasi kualitas.</Meaning>
      </StageSection>

      <StageSection
        number="3"
        title="Kuantisasi"
        goal="Mengurangi banyaknya tingkat keabuan supaya jumlah bit per piksel lebih kecil."
        controls={`Level kuantisasi aktif dipilih dari dropdown; pilihan saat ini ${result.quantization.levelCount} level.`}
        resultSummary={`${result.quantization.groups.length} kelompok terbentuk, ukuran teoritis ${bits(result.quantization.theoreticalBits)}.`}
        process={<span><Term name="Histogram" /> dibagi menjadi {result.quantization.levelCount} kelompok equal-population. Setiap rentang <Term name="intensitas" /> mendapat kode dan nilai representatif.</span>}
        howToRead="Lihat kolom jumlah piksel dan selisih. Semakin kecil selisih dari target, semakin merata pembagian kelompoknya."
        status={`Valid, ${result.quantization.groups.length} kelompok dibuat dan semua piksel mempunyai mapping.`}
        nextAction="Gunakan kode kuantisasi sebagai input RLE dan Huffman."
      >
        <HistogramPanel result={result} />
        <QuantizationTable groups={result.quantization.groups} />
        <Meaning>Kuantisasi mengurangi banyaknya tingkat keabuan. Setiap rentang intensitas dipetakan ke kode baru agar jumlah bit per piksel berkurang, lalu inverse quantization memakai nilai representatif untuk membentuk citra kembali.</Meaning>
      </StageSection>

      <StageSection
        number="4"
        title="Run-Length Encoding (RLE)"
        goal="Menyimpan deretan simbol yang sama sebagai pasangan nilai dan panjang run."
        controls="Gunakan tab Ringkasan, Pasangan per Baris, Dekompresi, dan Penjelasan untuk melihat detail bertahap."
        resultSummary={`${result.rle.pairCount} run, ukuran teoritis ${bits(result.rle.theoreticalBits)}, CR ${fixed(result.rle.compressionMetrics.compressionRatio)}.`}
        process={<span>RLE diproses per baris. Pasangan (p,q) berarti <Term name="simbol" /> p muncul berurutan sebanyak q pada satu <Term name="run" />.</span>}
        howToRead="Jika jumlah run mendekati jumlah piksel, RLE biasanya tidak efisien. Jika run panjang banyak muncul, ukuran bit turun."
        status={result.rle.identical ? "Valid, decoded RLE identik dengan kode kuantisasi." : "Tidak valid, decoded RLE berbeda dari kode kuantisasi."}
        nextAction="Bandingkan payload RLE dengan Huffman."
      >
        <Tabs tabs={["Ringkasan", "Pasangan per Baris", "Dekompresi", "Penjelasan"]} active={rleTab} onChange={setRleTab} />
        {rleTab === "Ringkasan" && (
          <>
            <MetricList items={[
              ["Jumlah baris", result.rle.height],
              ["Total piksel", number(result.working.pixels)],
              ["Total pasangan", number(result.rle.pairCount)],
              ["Rata-rata pasangan/baris", decimal(result.rle.pairCount / result.rle.height, 2)],
              ["Rata-rata panjang run", decimal(result.rle.averageRunLength, 4)],
              ["Run terpanjang", number(result.rle.longestRun)],
              ["Baris run paling sedikit", rleRowsSummary.reduce((best, row) => row.runCount < best.runCount ? row : best, rleRowsSummary[0])?.row],
              ["Baris run paling banyak", rleRowsSummary.reduce((best, row) => row.runCount > best.runCount ? row : best, rleRowsSummary[0])?.row],
              ["Ukuran teoritis", bits(result.rle.theoreticalBits)],
              ["Compression Ratio", decimal(result.rle.compressionMetrics.compressionRatio, 4)],
              ["Space Saving", percent(result.rle.compressionMetrics.spaceSavingPercent)],
              ["Total waktu", milliseconds(result.rle.timing.totalMs)],
            ]} />
            <Meaning>Untuk menjaga halaman tetap ringan, tabel menampilkan pasangan RLE berdasarkan baris yang dipilih. Seluruh pasangan tetap tersedia melalui export data RLE.</Meaning>
          </>
        )}
        {rleTab === "Pasangan per Baris" && (
          <>
            <SearchBox value={rleSearch} onChange={(value) => { setRleSearch(value); setRlePage(0); }} placeholder="Cari nomor baris" />
            <TablePager page={safeRlePage} pageCount={rlePageCount} onPrev={() => setRlePage(Math.max(0, safeRlePage - 1))} onNext={() => setRlePage(Math.min(rlePageCount - 1, safeRlePage + 1))} total={filteredRleRows.length} />
            <RleRowSummaryTable rows={visibleRleRows} selectedRow={selectedRleRow} onSelect={setSelectedRleRow} />
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Detail Baris {selectedRleData.rowIndex}</p>
                <h2>Pasangan RLE Baris Terpilih</h2>
              </div>
              <span>{selectedRleData.pairs.length} pasangan, sampel awal dan akhir</span>
            </div>
            <RlePairsTable rows={sampleRlePairs(selectedRlePairs)} rle={result.rle} />
          </>
        )}
        {rleTab === "Dekompresi" && (
          <DecompressionCard
            title="Dekompresi RLE"
            src={result.images.rleDecompressed}
            checksum={result.rle.decodedChecksum}
            identical={result.rle.identical}
            difference={differenceCount(result.quantizedCodes, result.rleDecodedCodes)}
            decodeMs={result.rle.decodeMs}
            width={result.working.width}
            height={result.working.height}
            pixels={result.working.pixels}
            onDownload={() => downloadDataUrl(result.images.rleDecompressed, `${withoutExtension(result.file.name)}_rle_reconstruction.png`)}
          />
        )}
        {rleTab === "Penjelasan" && (
          <Meaning>Pasangan (p,q) menyimpan nilai piksel p dan banyaknya kemunculan berurutan q pada satu baris citra. Karena batas baris tidak digabung, hasil decode menjaga struktur dimensi citra.</Meaning>
        )}
      </StageSection>

      <StageSection
        number="5"
        title="Huffman Coding"
        goal="Memberi kode biner pendek untuk simbol yang sering muncul dan kode lebih panjang untuk simbol yang jarang muncul."
        controls="Gunakan tab frekuensi, penggabungan, pohon, kode biner, bitstream, dan dekompresi."
        resultSummary={`Payload Huffman ${bits(result.huffman.payloadBits)}, entropy ${fixed(result.huffman.entropy, 4)}, efisiensi ${fixed(result.huffman.efficiency)}%.`}
        process={<span>Frekuensi simbol diurutkan, dua frekuensi terkecil digabung berulang sampai menjadi pohon. Jalur 0/1 dari akar membentuk <Term name="codebook" /> dan <Term name="bitstream" />.</span>}
        howToRead="Perhatikan probabilitas dan panjang kode. Simbol dengan frekuensi tinggi seharusnya mendapat kode lebih pendek."
        status={result.huffman.identical ? "Valid, decoded Huffman identik dengan kode kuantisasi." : "Tidak valid, decoded Huffman berbeda dari kode kuantisasi."}
        nextAction="Lihat hasil dekompresi dan validasi round-trip."
      >
        <Tabs tabs={["Tabel Frekuensi", "Tahap Penggabungan", "Pohon Huffman", "Kode Biner", "Bitstream", "Dekompresi"]} active={huffmanTab} onChange={setHuffmanTab} />
        {huffmanTab === "Tabel Frekuensi" && (
          <>
            <SearchBox value={huffmanSearch} onChange={setHuffmanSearch} placeholder="Cari simbol, frekuensi, kode, atau panjang kode" />
            <HuffmanTable rows={filteredHuffmanEntries} mode="frequency" />
          </>
        )}
        {huffmanTab === "Tahap Penggabungan" && <HuffmanMergeTable rows={huffmanMergeRows} />}
        {huffmanTab === "Pohon Huffman" && (
          <>
            <HuffmanTreeSvg root={result.huffman.root} entries={result.huffman.codeEntries} fileName={withoutExtension(result.file.name)} />
            <HuffmanCodeAside rows={result.huffman.codeEntries.filter((entry) => entry.frequency > 0).slice(0, 16)} />
          </>
        )}
        {huffmanTab === "Kode Biner" && <HuffmanTable rows={filteredHuffmanEntries} mode="code" />}
        {huffmanTab === "Bitstream" && (
          <div className="bitstream-panel">
            <MetricList items={[
              ["Payload bits", bits(result.huffman.payloadBits)],
              ["Payload bytes", bytes(result.huffman.payloadBytes)],
              ["Padding", `${result.huffman.packed.bytes.length * 8 - result.huffman.packed.bitLength} bit`],
              ["Bitstream preview", "256 bit pertama"],
            ]} />
            <pre className="bitstream-preview">{result.huffman.bitString.slice(0, 256)}{result.huffman.bitString.length > 256 ? "\n... preview dipotong, bitstream lengkap tersimpan pada file export." : ""}</pre>
          </div>
        )}
        {huffmanTab === "Dekompresi" && (
          <DecompressionCard
            title="Dekompresi Huffman"
            src={result.images.huffmanDecompressed}
            checksum={result.huffman.decodedChecksum}
            identical={result.huffman.identical}
            difference={differenceCount(result.quantizedCodes, result.huffmanDecodedCodes)}
            decodeMs={result.huffman.decodeMs}
            width={result.working.width}
            height={result.working.height}
            pixels={result.working.pixels}
            onDownload={() => downloadDataUrl(result.images.huffmanDecompressed, `${withoutExtension(result.file.name)}_huffman_reconstruction.png`)}
          />
        )}
        <Meaning>Simbol yang sering muncul memperoleh kode biner lebih pendek. Kode diperoleh dari jalur akar pohon menuju simbol, dengan sisi kiri 0 dan sisi kanan 1.</Meaning>
      </StageSection>

      <StageSection
        number="6"
        title="Dekompresi"
        goal="Membuktikan bahwa data hasil kompresi dapat dikembalikan menjadi kode kuantisasi yang sama."
        controls="Gunakan tombol Unduh PNG pada setiap panel untuk menyimpan citra rekonstruksi."
        resultSummary={`RLE ${result.rle.roundTripValidation.isByteIdentical ? "valid" : "gagal"}; Huffman ${result.huffman.roundTripValidation.isByteIdentical ? "valid" : "gagal"}; checksum awal ${result.quantizedChecksum}.`}
        process={<span>Setiap decoder menjalani validasi <Term name="round-trip" />, checksum, dan byte equality terhadap kode kuantisasi.</span>}
        howToRead="Status valid berarti data hasil decode identik dengan kode kuantisasi. Perbedaan visual terhadap grayscale asli berasal dari kuantisasi."
        status={result.rle.identical && result.huffman.identical ? "Valid, RLE dan Huffman sama-sama lolos round-trip." : "Ada decoder yang belum identik."}
        nextAction="Baca tab evaluasi untuk membedakan ukuran teoritis dan aktual."
      >
        <div className="decompression-grid">
          <DecompressionCard
            title="Hasil Kuantisasi"
            src={result.images.quantized}
            checksum={result.quantizedChecksum}
            identical
            difference={0}
            decodeMs={0}
            width={result.working.width}
            height={result.working.height}
            pixels={result.working.pixels}
            onDownload={() => downloadDataUrl(result.images.quantized, `${withoutExtension(result.file.name)}_quantized.png`)}
          />
          <DecompressionCard
            title="Hasil Dekompresi RLE"
            src={result.images.rleDecompressed}
            checksum={result.rle.decodedChecksum}
            identical={result.rle.identical}
            difference={differenceCount(result.quantizedCodes, result.rleDecodedCodes)}
            decodeMs={result.rle.decodeMs}
            width={result.working.width}
            height={result.working.height}
            pixels={result.working.pixels}
            onDownload={() => downloadDataUrl(result.images.rleDecompressed, `${withoutExtension(result.file.name)}_rle_reconstruction.png`)}
          />
          <DecompressionCard
            title="Hasil Dekompresi Huffman"
            src={result.images.huffmanDecompressed}
            checksum={result.huffman.decodedChecksum}
            identical={result.huffman.identical}
            difference={differenceCount(result.quantizedCodes, result.huffmanDecodedCodes)}
            decodeMs={result.huffman.decodeMs}
            width={result.working.width}
            height={result.working.height}
            pixels={result.working.pixels}
            onDownload={() => downloadDataUrl(result.images.huffmanDecompressed, `${withoutExtension(result.file.name)}_huffman_reconstruction.png`)}
          />
        </div>
        <Meaning>Citra ini dibentuk kembali dari data terkompresi, bukan menggunakan kembali preview gambar sebelum kompresi.</Meaning>
      </StageSection>

      <StageSection
        number="7"
        title="Evaluasi"
        goal="Membandingkan efisiensi ukuran dan kualitas hasil rekonstruksi dengan baseline yang jelas."
        controls="Pilih tab Mode Teoritis Materi atau Ukuran Penyimpanan Aktual, lalu unduh CSV/detail jika perlu."
        resultSummary={`Metode final ${result.compression.primary}, CR ${fixed(result.primaryCompressionMetrics.compressionRatio)}, SS ${fixed(result.primaryCompressionMetrics.spaceSavingPercent)}%, Reconstruction MSE ${fixed(result.primaryReconstructionMetrics.mse, 6)}.`}
        process={<span>Mode teoritis memakai rumus kuliah berbasis bit. Mode aktual menambahkan <Term name="payload" />, padding, <Term name="overhead" />, tabel frekuensi, dan mapping kuantisasi.</span>}
        howToRead="Compression Ratio = original size / compressed size. Space Saving = (1 - compressed/original) x 100%."
        status="Evaluasi selesai dengan baseline teoritis dan aktual terpisah."
        nextAction="Unduh CSV atau detail perhitungan jika dibutuhkan untuk laporan."
      >
        <Tabs tabs={["Mode Teoritis Materi", "Ukuran Penyimpanan Aktual"]} active={evaluationTab} onChange={setEvaluationTab} />
        {evaluationTab === "Mode Teoritis Materi" ? <TheoreticalEvaluation result={result} /> : <ActualEvaluation result={result} />}
        <EvaluationMetricBlocks result={result} />
        <Meaning>MSE mengukur rata-rata kesalahan piksel. Nilai lebih kecil lebih baik. PSNR mengukur kemiripan kualitas; nilai lebih besar lebih baik. Payload teoritis tidak termasuk seluruh metadata dan struktur file. Estimasi ukuran export JSON, bukan format biner optimal.</Meaning>
        <PerMethodConclusions result={result} />
        <div className="conclusion-box">
          <h3>Kesimpulan Otomatis</h3>
          <p>{buildAutoConclusion(result, evaluationTab)}</p>
        </div>
      </StageSection>
    </>
  );
}

function StageSection({ number, title, goal, controls, resultSummary, process, howToRead, status, nextAction, children }) {
  return (
    <section className="stage-section" aria-labelledby={`stage-${number}`}>
      <div className="stage-header">
        <span className="stage-number">{number}</span>
        <div>
          <p className="eyebrow">Tahap {number}</p>
          <h2 id={`stage-${number}`}>{title}</h2>
        </div>
        <span className="validation-badge">{status}</span>
      </div>
      <div className="stage-info">
        <p><strong>Tujuan:</strong> {goal}</p>
        <p><strong>Kontrol input:</strong> {controls}</p>
        <p><strong>Hasil utama:</strong> {resultSummary}</p>
        <p><strong>Proses:</strong> {process}</p>
        <p><strong>Cara membaca hasil:</strong> {howToRead}</p>
        <p><strong>Tindakan berikutnya:</strong> {nextAction}</p>
      </div>
      <div className="stage-main">{children}</div>
    </section>
  );
}

function Term({ name }) {
  const key = name.toLowerCase();
  return <span className="term" tabIndex={0} data-tip={TERM_HELP[key] ?? TERM_HELP[name] ?? name}>{name}</span>;
}

function Meaning({ children }) {
  return (
    <article className="meaning-panel">
      <h3>Apa arti hasil ini?</h3>
      <p>{children}</p>
    </article>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Pilihan detail tahap">
      {tabs.map((tab) => (
        <button key={tab} type="button" role="tab" aria-selected={active === tab} className={active === tab ? "tab-button active" : "tab-button"} onClick={() => onChange(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="search-box">
      <span>Pencarian tabel</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TablePager({ page, pageCount, onPrev, onNext, total }) {
  return (
    <div className="pagination">
      <button type="button" className="secondary" onClick={onPrev} disabled={page === 0}>Sebelumnya</button>
      <span>Halaman {page + 1} / {pageCount} - {total} data</span>
      <button type="button" className="secondary" onClick={onNext} disabled={page >= pageCount - 1}>Berikutnya</button>
    </div>
  );
}

function QuantizationTable({ groups }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(groups.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleGroups = groups.slice(safePage * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);
  return (
    <article className="analysis-card full-width">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Tabel Kuantisasi</p>
          <h2>Kelompok, Mapping, dan Representatif</h2>
        </div>
        <span>{groups.length} kelompok</span>
      </div>
      <TablePager page={safePage} pageCount={pageCount} onPrev={() => setPage(Math.max(0, safePage - 1))} onNext={() => setPage(Math.min(pageCount - 1, safePage + 1))} total={groups.length} />
      <div className="mini-table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Kelompok</th>
              <th>Intensitas Minimum</th>
              <th>Intensitas Maksimum</th>
              <th>Jumlah Piksel</th>
              <th>Target</th>
              <th>Selisih</th>
              <th>Kode</th>
              <th>Nilai Representatif</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map((group) => (
              <tr key={group.code}>
                <td>{group.code}</td>
                <td>{group.minIntensity}</td>
                <td>{group.maxIntensity}</td>
                <td>{group.pixelCount}</td>
                <td>{fixed(group.targetCount, 2)}</td>
                <td>{fixed(group.differenceFromTarget, 2)}</td>
                <td>{group.outputBitCode}</td>
                <td>{group.representativeIntensity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function HistogramPanel({ result }) {
  const [mode, setMode] = useState("Histogram Grayscale");
  const [page, setPage] = useState(0);
  const histogram = mode === "Histogram Grayscale"
    ? result.quantization.histogram
    : buildHistogramFromCodes(result.quantizedCodes, result.quantization.levelCount);
  const maxCount = Math.max(...histogram);
  const rows = histogram.map((frequency, intensity) => {
    const group = mode === "Histogram Grayscale" ? findQuantizationGroup(result.quantization.groups, intensity) : result.quantization.groups[intensity];
    return {
      intensity,
      frequency,
      percentage: result.working.pixels ? (frequency / result.working.pixels) * 100 : 0,
      group: group?.code ?? "-",
      code: group?.outputBitCode ?? "-",
    };
  }).filter((row) => row.frequency > 0);
  const summary = buildHistogramSummary(histogram, result.working.pixels);
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);

  return (
    <article className="analysis-card full-width">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Histogram Ringkas</p>
          <h2>Grafik Distribusi Intensitas</h2>
        </div>
        <div className="tabs small">
          {["Histogram Grayscale", "Histogram Setelah Kuantisasi"].map((item) => (
            <button key={item} type="button" className={mode === item ? "tab-button active" : "tab-button"} onClick={() => { setMode(item); setPage(0); }}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="histogram-chart" role="img" aria-label="Grafik histogram ringkas">
        {histogram.map((count, index) => (
          <span
            key={index}
            title={`${mode === "Histogram Grayscale" ? "Intensitas" : "Kode"} ${index}: ${number(count)} piksel (${percent(result.working.pixels ? (count / result.working.pixels) * 100 : 0)})`}
            style={{ height: `${Math.max(1, maxCount ? (count / maxCount) * 100 : 1)}%` }}
          />
        ))}
      </div>
      <MetricList items={[
        ["Intensitas minimum", summary.min],
        ["Intensitas maksimum", summary.max],
        ["Nilai paling sering", summary.mode],
        ["Jumlah nilai unik", summary.unique],
        ["Mean", decimal(summary.mean, 3)],
        ["Median", decimal(summary.median, 3)],
        ["Mode", summary.mode],
        ["Total piksel", number(summary.total)],
      ]} />
      <details className="inline-disclosure">
        <summary>Lihat tabel lengkap histogram</summary>
        <TablePager page={safePage} pageCount={pageCount} onPrev={() => setPage(Math.max(0, safePage - 1))} onNext={() => setPage(Math.min(pageCount - 1, safePage + 1))} total={rows.length} />
        <div className="mini-table-wrap">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Intensitas/Kode</th>
                <th>Frekuensi</th>
                <th>Persentase</th>
                <th>Kelompok</th>
                <th>Kode Kuantisasi</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.intensity}>
                  <td>{row.intensity}</td>
                  <td>{number(row.frequency)}</td>
                  <td>{percent(row.percentage)}</td>
                  <td>{row.group}</td>
                  <td>{row.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}

function RlePairsTable({ rows, rle }) {
  return (
    <div className="mini-table-wrap">
      <table className="mini-table">
        <thead>
          <tr>
            <th>Baris</th>
            <th>Nomor Run</th>
            <th>p</th>
            <th>q</th>
            <th>Biner p</th>
            <th>Biner q</th>
            <th>Total Bit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((pair, index) => (
            <tr key={`${pair.row}-${pair.run}-${index}`}>
              <td>{pair.row}</td>
              <td>{pair.run}</td>
              <td>{pair.value}</td>
              <td>{pair.count}</td>
              <td>{formatPairBinary(pair.value, rle.symbolBitWidth)}</td>
              <td>{formatPairBinary(pair.count, rle.countBitWidth)}</td>
              <td>{pair.isSeparator ? "-" : `${rle.symbolBitWidth + rle.countBitWidth} bit`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RleRowSummaryTable({ rows, selectedRow, onSelect }) {
  return (
    <div className="mini-table-wrap">
      <table className="mini-table">
        <thead>
          <tr>
            <th>Baris</th>
            <th>Jumlah Piksel</th>
            <th>Jumlah Run</th>
            <th>Run Terpanjang</th>
            <th>Rata-rata Run</th>
            <th>Ukuran RLE</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.row} className={selectedRow === row.row ? "selected-row" : ""}>
              <td>{row.row}</td>
              <td>{number(row.pixelCount)}</td>
              <td>{number(row.runCount)}</td>
              <td>{number(row.longestRun)}</td>
              <td>{decimal(row.averageRun, 3)}</td>
              <td>{bits(row.sizeBits)}</td>
              <td><button type="button" className="secondary compact-button" onClick={() => onSelect(row.row)}>Pilih Baris</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HuffmanTable({ rows, mode }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);
  return (
    <>
      <TablePager page={safePage} pageCount={pageCount} onPrev={() => setPage(Math.max(0, safePage - 1))} onNext={() => setPage(Math.min(pageCount - 1, safePage + 1))} total={rows.length} />
      <div className="mini-table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Simbol</th>
              <th>Frekuensi</th>
              <th>Probabilitas</th>
              <th>Kode</th>
              <th>Panjang Kode</th>
              <th>Kontribusi Bit</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((entry) => (
              <tr key={`${mode}-${entry.symbol}`}>
                <td>{entry.symbol}</td>
                <td>{entry.frequency}</td>
                <td>{fixed(entry.probability, 6)}</td>
                <td>{entry.code ?? "-"}</td>
                <td>{entry.codeLength || "-"}</td>
                <td>{entry.totalBits} bit</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HuffmanMergeTable({ rows }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(safePage * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE);
  return (
    <>
      <TablePager page={safePage} pageCount={pageCount} onPrev={() => setPage(Math.max(0, safePage - 1))} onNext={() => setPage(Math.min(pageCount - 1, safePage + 1))} total={rows.length} />
      <div className="mini-table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>Tahap</th>
              <th>Node Kiri</th>
              <th>Frekuensi Kiri</th>
              <th>Node Kanan</th>
              <th>Frekuensi Kanan</th>
              <th>Frekuensi Gabungan</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((step) => (
              <tr key={step.step}>
                <td>{step.step}</td>
                <td>{step.leftSymbols.join(", ") || "-"}</td>
                <td>{step.leftFrequency}</td>
                <td>{step.rightSymbols.join(", ") || "-"}</td>
                <td>{step.rightFrequency || "-"}</td>
                <td>{step.mergedFrequency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HuffmanCodeAside({ rows }) {
  return (
    <article className="analysis-card full-width">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Codebook Ringkas</p>
          <h2>Kode Biner Simbol Teratas</h2>
        </div>
        <span>{rows.length} simbol teratas</span>
      </div>
      <HuffmanTable rows={rows} mode="tree-aside" />
    </article>
  );
}

function DecompressionCard({ title, src, checksum, identical, difference, decodeMs, width, height, pixels, onDownload }) {
  return (
    <article className="decompression-card">
      <ImagePanel title={title} src={src} meta={`${width} x ${height}`} />
      <MetricList items={[
        ["Resolusi", `${width} x ${height}`],
        ["Pixel count", pixels],
        ["Checksum", checksum],
        ["Byte equality", identical ? "Valid, identik dengan kode kuantisasi" : `Tidak valid, ditemukan ${difference} piksel berbeda`],
        ["Waktu decode", decodeMs > 0 ? seconds(decodeMs) : "-"],
      ]} />
      <button type="button" className="secondary" onClick={onDownload}>Unduh PNG</button>
    </article>
  );
}

function PerMethodConclusions({ result }) {
  const items = buildMethodConclusions(result);
  return (
    <div className="method-conclusion-grid">
      {items.map((item) => (
        <article key={item.title} className="conclusion-box">
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function TheoreticalEvaluation({ result }) {
  const rows = [
    ["Baseline", `grayscale resolusi kerja ${result.working.width} x ${result.working.height}`, `kode kuantisasi resolusi kerja ${result.working.width} x ${result.working.height}`, `kode kuantisasi resolusi kerja ${result.working.width} x ${result.working.height}`],
    ["Ukuran input algoritmik", bits(result.quantInputBits), bits(result.compression.sourceRawBits), bits(result.compression.sourceRawBits)],
    ["Ukuran hasil", bits(result.quantization.theoreticalBits), bits(result.rle.theoreticalBits), bits(result.huffman.payloadBits)],
    ["Compression Ratio", decimal(result.quantCompressionMetrics.compressionRatio, 4), decimal(result.rle.compressionMetrics.compressionRatio, 4), decimal(result.huffman.compressionMetrics.compressionRatio, 4)],
    ["Space Saving", percent(result.quantCompressionMetrics.spaceSavingPercent), percent(result.rle.compressionMetrics.spaceSavingPercent), percent(result.huffman.compressionMetrics.spaceSavingPercent)],
    ["Waktu encode", milliseconds(result.quantTiming.quantizationMs), milliseconds(result.rle.timing.encodeMs), milliseconds(result.huffman.timing.encodeMs)],
    ["Waktu decode", "-", milliseconds(result.rle.timing.decodeMs), milliseconds(result.huffman.timing.decodeMs)],
    ["Waktu frequency table", "-", "-", milliseconds(result.huffman.timing.frequencyTableMs)],
    ["Waktu build tree", "-", "-", milliseconds(result.huffman.timing.treeBuildMs)],
    ["Waktu build codebook", "-", "-", milliseconds(result.huffman.timing.codebookBuildMs)],
    ["Waktu encode bitstream", "-", "-", milliseconds(result.huffman.timing.bitstreamEncodeMs)],
    ["Waktu bit packing", "-", "-", milliseconds(result.huffman.timing.bitPackingMs)],
    ["Waktu inverse quantization", milliseconds(result.quantTiming.reconstructionMs), milliseconds(result.rle.timing.inverseQuantizationMs), milliseconds(result.huffman.timing.inverseQuantizationMs)],
    ["Waktu validasi", "-", milliseconds(result.rle.timing.validationMs), milliseconds(result.huffman.timing.validationMs)],
    ["Total waktu", milliseconds(result.quantTiming.totalMs), milliseconds(result.rle.timing.totalMs), milliseconds(result.huffman.timing.totalMs)],
    ["Reconstruction MSE", decimal(result.quantReconstructionQuality.mse, 6), decimal(result.rle.reconstructionQuality.mse, 6), decimal(result.huffman.reconstructionQuality.mse, 6)],
    ["Reconstruction PSNR", psnrLabel(result.quantReconstructionQuality.psnr), psnrLabel(result.rle.reconstructionQuality.psnr), psnrLabel(result.huffman.reconstructionQuality.psnr)],
    ["Round-trip MSE", "-", decimal(result.rle.roundTripValidation.mse, 6), decimal(result.huffman.roundTripValidation.mse, 6)],
    ["Round-trip PSNR", "-", psnrLabel(result.rle.roundTripValidation.psnr), psnrLabel(result.huffman.roundTripValidation.psnr)],
    ["Status validasi", "-", result.rle.roundTripValidation.isByteIdentical ? "Valid" : "Tidak valid", result.huffman.roundTripValidation.isByteIdentical ? "Valid" : "Tidak valid"],
  ];
  return (
    <div className="mini-table-wrap">
      <table className="mini-table">
        <thead>
          <tr>
            <th>Metrik</th>
            <th>Kuantisasi</th>
            <th>RLE</th>
            <th>Huffman</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) => <td key={`${row[0]}-${index}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">Waktu proses diukur pada browser dan perangkat yang digunakan. Hasil dapat berbeda pada perangkat lain.</p>
    </div>
  );
}

function ActualEvaluation({ result }) {
  const sourceBytes = Math.ceil(result.compression.sourceRawBits / 8);
  const huffmanPadding = result.huffman.packed.bytes.length * 8 - result.huffman.packed.bitLength;
  const rows = [
    {
      method: "RLE",
      payload: result.rle.payloadBytes,
      padding: 0,
      metadata: Math.max(0, result.rle.actualBytes - result.rle.payloadBytes),
      actual: result.rle.actualBytes,
    },
    {
      method: "Huffman",
      payload: result.huffman.payloadBytes,
      padding: huffmanPadding,
      metadata: Math.max(0, result.huffman.actualBytes - result.huffman.payloadBytes),
      actual: result.huffman.actualBytes,
    },
  ];
  return (
    <div className="mini-table-wrap">
      <table className="mini-table">
        <thead>
          <tr>
            <th>Metode</th>
            <th>Payload Bytes</th>
            <th>Padding</th>
            <th>Metadata/Overhead Bytes</th>
            <th>Estimated Export JSON Bytes</th>
            <th>Compression Ratio Export JSON</th>
            <th>Space Saving Export JSON</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.method}>
              <td>{row.method}</td>
              <td>{bytes(row.payload)}</td>
              <td>{row.padding} bit</td>
              <td>{bytes(row.metadata)}</td>
              <td>{bytes(row.actual)}</td>
              <td>{fixed(sourceBytes / row.actual)}</td>
              <td>{fixed((1 - row.actual / sourceBytes) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">
        Baseline ukuran aktual dihitung dari resolusi kerja {result.working.width} x {result.working.height}.
        Resolusi sumber file adalah {result.resolutionInfo.sourceWidth} x {result.resolutionInfo.sourceHeight}; {result.resolutionInfo.wasResized ? "citra diperkecil agar pemrosesan browser tetap stabil." : "tidak ada resize pada proses ini."}
      </p>
    </div>
  );
}

function EvaluationMetricBlocks({ result }) {
  const qualityRows = [
    ["Kuantisasi", result.quantReconstructionQuality.mse, result.quantReconstructionQuality.psnr, "Dampak langsung penurunan level grayscale."],
    ["RLE reconstruction", result.rle.reconstructionQuality.mse, result.rle.reconstructionQuality.psnr, "Seharusnya sama dengan kuantisasi jika decode RLE benar."],
    ["Huffman reconstruction", result.huffman.reconstructionQuality.mse, result.huffman.reconstructionQuality.psnr, "Seharusnya sama dengan kuantisasi jika decode Huffman benar."],
  ];
  const validationRows = [
    ["RLE", result.rle.roundTripValidation],
    ["Huffman", result.huffman.roundTripValidation],
  ];
  return (
    <div className="evaluation-blocks">
      <article className="analysis-card full-width">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Kualitas Rekonstruksi</p>
            <h2>Original Grayscale vs Citra Rekonstruksi</h2>
          </div>
        </div>
        <p className="table-note">Menilai kemiripan citra hasil dekompresi terhadap citra grayscale asli. Nilai ini memperlihatkan dampak kuantisasi terhadap kualitas citra.</p>
        <div className="mini-table-wrap">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Metode</th>
                <th>Reconstruction MSE</th>
                <th>Reconstruction PSNR</th>
                <th>Interpretasi kualitas</th>
              </tr>
            </thead>
            <tbody>
              {qualityRows.map(([methodName, mseValue, psnrValue, note]) => (
                <tr key={methodName}>
                  <td>{methodName}</td>
                  <td>{decimal(mseValue, 6)}</td>
                  <td>{psnrLabel(psnrValue)}</td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      <article className="analysis-card full-width">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Validasi Lossless / Round-trip</p>
            <h2>Kode Kuantisasi vs Kode Hasil Decode</h2>
          </div>
        </div>
        <p className="table-note">Memastikan RLE dan Huffman mengembalikan kode kuantisasi tanpa perubahan satu piksel pun.</p>
        <div className="mini-table-wrap">
          <table className="mini-table">
            <thead>
              <tr>
                <th>Metode</th>
                <th>Round-trip MSE</th>
                <th>Round-trip PSNR</th>
                <th>Piksel berbeda</th>
                <th>Max Absolute Difference</th>
                <th>Checksum</th>
                <th>Status identik</th>
              </tr>
            </thead>
            <tbody>
              {validationRows.map(([methodName, validation]) => (
                <tr key={methodName}>
                  <td>{methodName}</td>
                  <td>{decimal(validation.mse, 6)}</td>
                  <td>{psnrLabel(validation.psnr)}</td>
                  <td>{number(validation.differentPixelCount)}</td>
                  <td>{number(validation.maxAbsoluteDifference)}</td>
                  <td>{validation.checksumBefore} -&gt; {validation.checksumAfter}</td>
                  <td>{validation.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

function filterRows(rows, query, keys) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle)));
}

function differenceCount(a, b) {
  if (!a || !b) return 0;
  const length = Math.min(a.length, b.length);
  let count = Math.abs(a.length - b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) count += 1;
  }
  return count;
}

function buildReconstructionQualityMetrics(originalGrayscale, reconstructedGrayscale) {
  const metrics = buildReconstructionMetrics(originalGrayscale, reconstructedGrayscale, "quantized-reconstruction");
  return {
    ...metrics,
    isIdenticalToOriginalGrayscale: metrics.mse === 0,
  };
}

function buildReconstructionQualityForTarget(originalGrayscale, reconstructedGrayscale, target) {
  const metrics = buildReconstructionMetrics(originalGrayscale, reconstructedGrayscale, target);
  return {
    ...metrics,
    isIdenticalToOriginalGrayscale: metrics.mse === 0,
  };
}

function buildRoundTripValidationMetrics(beforeCodes, afterCodes, checksumBefore) {
  const metrics = buildRoundTripMetrics(beforeCodes, afterCodes, checksumBefore);
  return {
    ...metrics,
    status: metrics.differentPixelCount === 0 ? "Valid - data decoding identik dengan data kuantisasi" : `Tidak valid - ditemukan ${metrics.differentPixelCount} piksel berbeda`,
  };
}

function buildAutoConclusion(result, mode) {
  const sourceBytes = Math.ceil(result.compression.sourceRawBits / 8);
  const rleActualCr = sourceBytes / result.rle.actualBytes;
  const huffmanActualCr = sourceBytes / result.huffman.actualBytes;
  const rleDense = result.rle.pairCount / result.working.pixels > 0.65;
  const huffmanBetter = mode === "Ukuran Penyimpanan Aktual"
    ? huffmanActualCr > rleActualCr
    : result.huffman.compressionMetrics.compressionRatio > result.rle.compressionMetrics.compressionRatio;

  if (huffmanBetter && rleDense) {
    return "RLE kurang efektif pada citra ini karena jumlah run mendekati jumlah piksel. Huffman lebih efektif karena distribusi frekuensi simbol memberi kode lebih pendek untuk simbol yang sering muncul.";
  }
  if (huffmanBetter) {
    return "Huffman lebih efektif untuk citra ini karena ukuran kompresinya lebih kecil daripada RLE pada baseline yang sedang dipilih.";
  }
  if (result.rle.longestRun > result.rle.averageRunLength * 4) {
    return "RLE lebih efektif pada citra ini karena terdapat deretan simbol sama yang cukup panjang, sehingga pasangan (p,q) mampu memangkas penyimpanan.";
  }
  return "Kedua metode valid secara round-trip. Efisiensi utama tetap bergantung pada pola citra: RLE terbantu oleh run panjang, sedangkan Huffman terbantu oleh distribusi simbol yang tidak merata.";
}

function buildMethodConclusions(result) {
  const quantLower = result.quantization.levelCount < result.sourceProfile.estimatedLevel;
  const rleLargerThanQuant = result.rle.theoreticalBits > result.quantization.theoreticalBits;
  const huffmanLowSaving = result.huffman.compressionMetrics.spaceSavingPercent < 5;
  const best = result.rle.compressionMetrics.compressionRatio >= result.huffman.compressionMetrics.compressionRatio ? "RLE" : "Huffman";
  const qualityText = result.quantReconstructionQuality.mse === 0
    ? "Kualitas rekonstruksi identik pada ukuran grayscale yang diuji karena Reconstruction MSE bernilai 0 dan Reconstruction PSNR Inf."
    : `Kualitas rekonstruksi dipengaruhi kuantisasi dengan Reconstruction MSE ${fixed(result.quantReconstructionQuality.mse)} dan Reconstruction PSNR ${psnrLabel(result.quantReconstructionQuality.psnr)}.`;
  return [
    {
      title: "Kuantisasi",
      body: quantLower
        ? `Kuantisasi menurunkan bit depth dari ${result.sourceProfile.bitsPerPixel} bit/piksel menjadi ${result.quantization.quantizedBitDepth} bit/piksel. Ukuran teoritis turun dari ${bits(result.quantInputBits)} menjadi ${bits(result.quantization.theoreticalBits)}; semakin rendah level, kompresi biasanya meningkat tetapi risiko penurunan kualitas ikut naik. ${qualityText}`
        : "Level kuantisasi tidak menurunkan level sumber, sehingga tidak direkomendasikan sebagai proses kuantisasi akademik.",
    },
    {
      title: "RLE",
      body: rleLargerThanQuant
        ? `RLE menghasilkan ${result.rle.pairCount} run dan ukuran ${bits(result.rle.theoreticalBits)}, lebih besar daripada ukuran kuantisasi ${bits(result.quantization.theoreticalBits)}. Ini menunjukkan citra memiliki terlalu banyak run pendek, sehingga pasangan (p,q) menambah biaya penyimpanan.`
        : `RLE efektif pada citra ini karena ukuran turun menjadi ${bits(result.rle.theoreticalBits)} dengan compression ratio ${fixed(result.rle.compressionMetrics.compressionRatio)}. Rata-rata panjang run adalah ${fixed(result.rle.averageRunLength)} piksel/run.`,
    },
    {
      title: "Huffman",
      body: huffmanLowSaving
        ? `Huffman hanya memberi space saving ${fixed(result.huffman.compressionMetrics.spaceSavingPercent)}%. Hal ini mengindikasikan distribusi simbol relatif merata atau panjang kode rata-rata ${fixed(result.huffman.averageLength, 4)} mendekati fixed-length representation.`
        : `Huffman efektif karena memanfaatkan distribusi frekuensi simbol. Payload menjadi ${bits(result.huffman.payloadBits)} dengan entropy ${fixed(result.huffman.entropy, 4)} dan panjang kode rata-rata ${fixed(result.huffman.averageLength, 4)} bit/simbol.`,
    },
    {
      title: "Metode Terbaik",
      body: `Berdasarkan compression ratio dan space saving teoritis, metode terbaik untuk citra ini adalah ${best}. Untuk citra sederhana/logo/kartun, RLE dapat direkomendasikan; untuk citra natural, kompleks, atau bertekstur, kuantisasi dan Huffman biasanya lebih stabil. Untuk kebutuhan kualitas tinggi, gunakan level lebih besar seperti 128 atau 256 selama tetap valid terhadap level sumber.`,
    },
  ];
}

function buildDatasetRecap(items) {
  return DATASET_FORMATS.map((format) => {
    const groupItems = items.filter((item) => datasetFormatKey(item.fileInfo.format) === format);
    const notes = groupItems.map((item) => {
      if (item.error) return `${item.fileInfo.name}: ${item.error}`;
      if (item.decoded?.wasResized) return `${item.fileInfo.name}: diproses pada ukuran kerja agar browser tetap responsif`;
      return `${item.fileInfo.name}: terbaca`;
    }).join("; ");
    return {
      format,
      count: groupItems.length,
      names: groupItems.map((item) => item.fileInfo.name).join(", "),
      dimensions: groupItems.map((item) => item.decoded ? `${item.decoded.originalWidth} x ${item.decoded.originalHeight}` : "-").join(", "),
      sizes: groupItems.map((item) => fileSize(item.fileInfo.size)).join(", "),
      status: groupItems.length >= 5 ? "Sesuai" : groupItems.length > 0 ? "Kurang" : "Belum Ada",
      statusClass: groupItems.length >= 5 ? "ok" : groupItems.length > 0 ? "warn" : "empty",
      notes,
    };
  });
}

function buildInvalidMultiLevelRow(no, item, levelValue, contentCategory = "unlabeled") {
  const resolution = item.decoded?.resolutionInfo;
  const skippedReason = buildSkippedReason();
  const itemWithCategory = { ...item, contentCategory };
  return {
    No: no,
    __raw: buildSkippedRawNumericResearchRow(itemWithCategory, levelValue, skippedReason),
    "Image Name": item.fileInfo.name,
    Format: datasetFormatKey(item.fileInfo.format),
    "Resolusi Sumber": resolution ? `${resolution.sourceWidth} x ${resolution.sourceHeight}` : "-",
    "Resolusi Kerja": resolution ? `${resolution.workingWidth} x ${resolution.workingHeight}` : "-",
    "Quantization Level": levelValue,
    "Bit per Piksel": "-",
    "Raw Working Grayscale Size": "-",
    "Quantized Fixed-bit Size": "-",
    "RLE Theoretical Payload": "-",
    "Huffman Theoretical Payload": "-",
    "RLE Estimated Export Size": "-",
    "Huffman Estimated Export Size": "-",
    "Compression Ratio RLE": "-",
    "Compression Ratio Huffman": "-",
    "Space Saving RLE": "-",
    "Space Saving Huffman": "-",
    "Reconstruction MSE Kuantisasi": "-",
    "Reconstruction PSNR Kuantisasi": "-",
    "Reconstruction MSE RLE": "-",
    "Reconstruction PSNR RLE": "-",
    "Reconstruction MSE Huffman": "-",
    "Reconstruction PSNR Huffman": "-",
    "Round-trip MSE RLE": "-",
    "Round-trip PSNR RLE": "-",
    "Round-trip MSE Huffman": "-",
    "Round-trip PSNR Huffman": "-",
    "Waktu Kuantisasi": "-",
    "Waktu RLE Encode": "-",
    "Waktu RLE Decode": "-",
    "Waktu RLE Inverse Quantization": "-",
    "Waktu RLE Validasi": "-",
    "Waktu Huffman Encode": "-",
    "Waktu Huffman Frequency": "-",
    "Waktu Huffman Tree": "-",
    "Waktu Huffman Codebook": "-",
    "Waktu Huffman Bitstream": "-",
    "Waktu Huffman Packing": "-",
    "Waktu Huffman Decode": "-",
    "Waktu Huffman Inverse Quantization": "-",
    "Waktu Huffman Validasi": "-",
    "Total Waktu RLE": "-",
    "Total Waktu Huffman": "-",
    "Best Method": "-",
    Status: `SKIPPED: level ${levelValue} tidak lebih kecil dari level sumber ${item.sourceProfile.estimatedLevel}`,
  };
}

function buildMultiLevelRow(no, item, levelValue, result) {
  const bestMethod = result.rle.compressionMetrics.compressionRatio >= result.huffman.compressionMetrics.compressionRatio ? "RLE" : "Huffman";
  const resolution = result.resolutionInfo;
  return {
    No: no,
    __raw: buildRawNumericResearchRow(result),
    "Image Name": item.fileInfo.name,
    Format: datasetFormatKey(item.fileInfo.format),
    "Resolusi Sumber": `${resolution.sourceWidth} x ${resolution.sourceHeight}`,
    "Resolusi Kerja": `${resolution.workingWidth} x ${resolution.workingHeight}`,
    "Quantization Level": levelValue,
    "Bit per Piksel": result.quantization.quantizedBitDepth,
    "Raw Working Grayscale Size": bits(result.rawWorkingGrayscaleBits),
    "Quantized Fixed-bit Size": bits(result.quantization.theoreticalBits),
    "RLE Theoretical Payload": bits(result.rle.theoreticalBits),
    "Huffman Theoretical Payload": bits(result.huffman.payloadBits),
    "RLE Estimated Export Size": bytes(result.rle.actualBytes),
    "Huffman Estimated Export Size": bytes(result.huffman.actualBytes),
    "Compression Ratio RLE": decimal(result.rle.compressionMetrics.compressionRatio, 4),
    "Compression Ratio Huffman": decimal(result.huffman.compressionMetrics.compressionRatio, 4),
    "Space Saving RLE": percent(result.rle.compressionMetrics.spaceSavingPercent),
    "Space Saving Huffman": percent(result.huffman.compressionMetrics.spaceSavingPercent),
    "Reconstruction MSE Kuantisasi": decimal(result.quantReconstructionQuality.mse, 6),
    "Reconstruction PSNR Kuantisasi": psnrLabel(result.quantReconstructionQuality.psnr),
    "Reconstruction MSE RLE": decimal(result.rle.reconstructionQuality.mse, 6),
    "Reconstruction PSNR RLE": psnrLabel(result.rle.reconstructionQuality.psnr),
    "Reconstruction MSE Huffman": decimal(result.huffman.reconstructionQuality.mse, 6),
    "Reconstruction PSNR Huffman": psnrLabel(result.huffman.reconstructionQuality.psnr),
    "Round-trip MSE RLE": decimal(result.rle.roundTripValidation.mse, 6),
    "Round-trip PSNR RLE": psnrLabel(result.rle.roundTripValidation.psnr),
    "Round-trip MSE Huffman": decimal(result.huffman.roundTripValidation.mse, 6),
    "Round-trip PSNR Huffman": psnrLabel(result.huffman.roundTripValidation.psnr),
    "Waktu Kuantisasi": milliseconds(result.quantTiming.quantizationMs),
    "Waktu RLE Encode": milliseconds(result.rle.timing.encodeMs),
    "Waktu RLE Decode": milliseconds(result.rle.timing.decodeMs),
    "Waktu RLE Inverse Quantization": milliseconds(result.rle.timing.inverseQuantizationMs),
    "Waktu RLE Validasi": milliseconds(result.rle.timing.validationMs),
    "Waktu Huffman Encode": milliseconds(result.huffman.timing.encodeMs),
    "Waktu Huffman Frequency": milliseconds(result.huffman.timing.frequencyTableMs),
    "Waktu Huffman Tree": milliseconds(result.huffman.timing.treeBuildMs),
    "Waktu Huffman Codebook": milliseconds(result.huffman.timing.codebookBuildMs),
    "Waktu Huffman Bitstream": milliseconds(result.huffman.timing.bitstreamEncodeMs),
    "Waktu Huffman Packing": milliseconds(result.huffman.timing.bitPackingMs),
    "Waktu Huffman Decode": milliseconds(result.huffman.timing.decodeMs),
    "Waktu Huffman Inverse Quantization": milliseconds(result.huffman.timing.inverseQuantizationMs),
    "Waktu Huffman Validasi": milliseconds(result.huffman.timing.validationMs),
    "Total Waktu RLE": milliseconds(result.rle.timing.totalMs),
    "Total Waktu Huffman": milliseconds(result.huffman.timing.totalMs),
    "Best Method": bestMethod,
    Status: result.rle.identical && result.huffman.identical ? "Valid" : "Perlu cek decode",
  };
}

function buildRawNumericResearchRow(result) {
  const resolution = result.resolutionInfo;
  const primaryValidation = result.compression.primary === "RLE" ? result.rle.roundTripValidation : result.huffman.roundTripValidation;
  const benchmark = result.benchmarkSummary;
  return {
    image_name: result.file.name,
    source_format: datasetFormatKey(result.file.format),
    content_category: result.contentCategory,
    source_file_size_bytes: result.file.size,
    source_width: resolution.sourceWidth,
    source_height: resolution.sourceHeight,
    source_pixel_count: resolution.sourcePixelCount,
    working_width: resolution.workingWidth,
    working_height: resolution.workingHeight,
    working_pixel_count: resolution.workingPixelCount,
    was_resized: resolution.wasResized,
    resize_scale: resolution.resizeScale,
    processing_mode: resolution.processingMode,
    detected_source_level: result.sourceProfile.estimatedLevel,
    detected_source_bit_depth: result.sourceProfile.bitsPerPixel,
    detected_source_fixed_bit_size_bits: result.detectedSourceFixedBitSizeBits,
    quantization_level: result.quantization.levelCount,
    raw_source_grayscale_size_bits: result.rawSourceGrayscaleBits,
    raw_working_grayscale_size_bits: result.rawWorkingGrayscaleBits,
    quantized_size_bits: result.quantization.theoreticalBits,
    rle_payload_bits: result.rle.theoreticalBits,
    huffman_payload_bits: result.huffman.payloadBits,
    rle_estimated_export_bytes: result.rle.actualBytes,
    huffman_estimated_export_bytes: result.huffman.actualBytes,
    rle_compression_ratio: result.rle.compressionMetrics.compressionRatio,
    huffman_compression_ratio: result.huffman.compressionMetrics.compressionRatio,
    rle_space_saving_percent: result.rle.compressionMetrics.spaceSavingPercent,
    huffman_space_saving_percent: result.huffman.compressionMetrics.spaceSavingPercent,
    reconstruction_mse: result.primaryReconstructionMetrics.mse,
    reconstruction_psnr_db: result.primaryReconstructionMetrics.psnr,
    checksum_before: primaryValidation.checksumBefore,
    checksum_after: primaryValidation.checksumAfter,
    different_pixel_count: primaryValidation.differentPixelCount,
    max_absolute_difference: primaryValidation.maxAbsoluteDifference,
    byte_identical: primaryValidation.isByteIdentical,
    rle_roundtrip_mse: result.rle.roundTripValidation.mse,
    rle_roundtrip_psnr_db: result.rle.roundTripValidation.psnr,
    rle_pixel_difference_count: result.rle.roundTripValidation.differentPixelCount,
    rle_max_absolute_difference: result.rle.roundTripValidation.maxAbsoluteDifference,
    rle_checksum_before: result.rle.roundTripValidation.checksumBefore,
    rle_checksum_after: result.rle.roundTripValidation.checksumAfter,
    rle_byte_identical: result.rle.roundTripValidation.isByteIdentical,
    huffman_roundtrip_mse: result.huffman.roundTripValidation.mse,
    huffman_roundtrip_psnr_db: result.huffman.roundTripValidation.psnr,
    huffman_pixel_difference_count: result.huffman.roundTripValidation.differentPixelCount,
    huffman_max_absolute_difference: result.huffman.roundTripValidation.maxAbsoluteDifference,
    huffman_checksum_before: result.huffman.roundTripValidation.checksumBefore,
    huffman_checksum_after: result.huffman.roundTripValidation.checksumAfter,
    huffman_byte_identical: result.huffman.roundTripValidation.isByteIdentical,
    quantization_time_ms: result.quantTiming.quantizationMs,
    rle_encode_ms: result.rle.timing.encodeMs,
    rle_decode_ms: result.rle.timing.decodeMs,
    rle_inverse_quantization_ms: result.rle.timing.inverseQuantizationMs,
    rle_validation_ms: result.rle.timing.validationMs,
    rle_total_ms: result.rle.timing.totalMs,
    huffman_frequency_ms: result.huffman.timing.frequencyTableMs,
    huffman_tree_build_ms: result.huffman.timing.treeBuildMs,
    huffman_codebook_ms: result.huffman.timing.codebookBuildMs,
    huffman_bitstream_encode_ms: result.huffman.timing.bitstreamEncodeMs,
    huffman_pack_ms: result.huffman.timing.bitPackingMs,
    huffman_decode_ms: result.huffman.timing.decodeMs,
    huffman_inverse_quantization_ms: result.huffman.timing.inverseQuantizationMs,
    huffman_validation_ms: result.huffman.timing.validationMs,
    huffman_total_ms: result.huffman.timing.totalMs,
    benchmark_enabled: Boolean(benchmark),
    benchmark_warmup_runs: benchmark?.warmupRuns ?? 0,
    benchmark_measured_runs: benchmark?.measuredRuns ?? 0,
    benchmark_total_mean_ms: benchmark?.totalMeanMs ?? "",
    benchmark_total_min_ms: benchmark?.totalMinMs ?? "",
    benchmark_total_max_ms: benchmark?.totalMaxMs ?? "",
    benchmark_total_std_ms: benchmark?.totalStdMs ?? "",
    benchmark_quantization_mean_ms: benchmark?.quantizationMeanMs ?? "",
    benchmark_rle_total_mean_ms: benchmark?.rleTotalMeanMs ?? "",
    benchmark_huffman_total_mean_ms: benchmark?.huffmanTotalMeanMs ?? "",
    quantization_status: "PROCESSED",
    skipped_reason: "",
    rle_result_category: classifyCompression(result.rle.compressionMetrics.compressionRatio),
    huffman_result_category: classifyCompression(result.huffman.compressionMetrics.compressionRatio),
  };
}

function buildSkippedRawNumericResearchRow(item, levelValue, skippedReason = buildSkippedReason()) {
  const resolution = item.decoded?.resolutionInfo ?? {};
  const sourceProfile = item.sourceProfile ?? {};
  const sourcePixelCount = resolution.sourcePixelCount ?? ((resolution.sourceWidth ?? 0) * (resolution.sourceHeight ?? 0));
  const workingPixelCount = resolution.workingPixelCount ?? ((resolution.workingWidth ?? 0) * (resolution.workingHeight ?? 0));
  return {
    image_name: item.fileInfo.name,
    source_format: datasetFormatKey(item.fileInfo.format),
    content_category: normalizeContentCategory(item.contentCategory),
    source_file_size_bytes: item.fileInfo.size,
    source_width: resolution.sourceWidth ?? "",
    source_height: resolution.sourceHeight ?? "",
    source_pixel_count: sourcePixelCount || "",
    working_width: resolution.workingWidth ?? "",
    working_height: resolution.workingHeight ?? "",
    working_pixel_count: workingPixelCount || "",
    was_resized: Boolean(resolution.wasResized),
    resize_scale: resolution.resizeScale ?? "",
    processing_mode: resolution.processingMode ?? "",
    detected_source_level: sourceProfile.estimatedLevel ?? "",
    detected_source_bit_depth: sourceProfile.bitsPerPixel ?? "",
    detected_source_fixed_bit_size_bits: sourcePixelCount && sourceProfile.bitsPerPixel ? buildDetectedFixedBitSizeBits(sourcePixelCount, sourceProfile.bitsPerPixel) : "",
    quantization_level: levelValue,
    raw_source_grayscale_size_bits: sourcePixelCount ? buildGrayscaleRawSizeBits(sourcePixelCount) : "",
    raw_working_grayscale_size_bits: workingPixelCount ? buildGrayscaleRawSizeBits(workingPixelCount) : "",
    quantized_size_bits: "",
    rle_payload_bits: "",
    huffman_payload_bits: "",
    rle_estimated_export_bytes: "",
    huffman_estimated_export_bytes: "",
    rle_compression_ratio: "",
    huffman_compression_ratio: "",
    rle_space_saving_percent: "",
    huffman_space_saving_percent: "",
    reconstruction_mse: "",
    reconstruction_psnr_db: "",
    checksum_before: "",
    checksum_after: "",
    different_pixel_count: "",
    max_absolute_difference: "",
    byte_identical: false,
    rle_roundtrip_mse: "",
    rle_roundtrip_psnr_db: "",
    rle_pixel_difference_count: "",
    rle_max_absolute_difference: "",
    rle_checksum_before: "",
    rle_checksum_after: "",
    rle_byte_identical: false,
    huffman_roundtrip_mse: "",
    huffman_roundtrip_psnr_db: "",
    huffman_pixel_difference_count: "",
    huffman_max_absolute_difference: "",
    huffman_checksum_before: "",
    huffman_checksum_after: "",
    huffman_byte_identical: false,
    quantization_time_ms: "",
    rle_encode_ms: "",
    rle_decode_ms: "",
    rle_inverse_quantization_ms: "",
    rle_validation_ms: "",
    rle_total_ms: "",
    huffman_frequency_ms: "",
    huffman_tree_build_ms: "",
    huffman_codebook_ms: "",
    huffman_bitstream_encode_ms: "",
    huffman_pack_ms: "",
    huffman_decode_ms: "",
    huffman_inverse_quantization_ms: "",
    huffman_validation_ms: "",
    huffman_total_ms: "",
    benchmark_enabled: false,
    benchmark_warmup_runs: 0,
    benchmark_measured_runs: 0,
    benchmark_total_mean_ms: "",
    benchmark_total_min_ms: "",
    benchmark_total_max_ms: "",
    benchmark_total_std_ms: "",
    benchmark_quantization_mean_ms: "",
    benchmark_rle_total_mean_ms: "",
    benchmark_huffman_total_mean_ms: "",
    quantization_status: "SKIPPED",
    skipped_reason: skippedReason,
    rle_result_category: "SKIPPED",
    huffman_result_category: "SKIPPED",
  };
}

function getResearchRawRows(result, multiLevelRows) {
  if (multiLevelRows.length) return multiLevelRows.map((row) => row.__raw).filter(Boolean);
  return result ? [buildRawNumericResearchRow(result)] : [];
}

function columnsForAnalysisView(view) {
  if (view === "Detail") return TABLE_COLUMNS;
  return [
    "No",
    "Nama Citra",
    "Tahap",
    "Level Kuantisasi",
    "Quantized Fixed-bit Size",
    "RLE Theoretical Payload",
    "Huffman Theoretical Payload",
    "Estimated Export Size",
    "Waktu Encode",
    "Waktu Decode",
    "Waktu Total",
    "Compression Ratio",
    "Space Saving (%)",
    "Reconstruction MSE",
    "Reconstruction PSNR",
    "Round-trip MSE",
    "Round-trip PSNR",
    "Status Validasi",
    "Analisis",
  ];
}

function multiLevelColumnsFor(tab) {
  if (tab === "Kualitas Citra") {
    return [
      "Quantization Level",
      "Reconstruction MSE Kuantisasi",
      "Reconstruction PSNR Kuantisasi",
      "Reconstruction MSE RLE",
      "Reconstruction PSNR RLE",
      "Reconstruction MSE Huffman",
      "Reconstruction PSNR Huffman",
      "Round-trip MSE RLE",
      "Round-trip PSNR RLE",
      "Round-trip MSE Huffman",
      "Round-trip PSNR Huffman",
      "Status",
    ];
  }
  if (tab === "Performa") {
    return [
      "Quantization Level",
      "Waktu Kuantisasi",
      "Waktu RLE Encode",
      "Waktu RLE Decode",
      "Waktu RLE Inverse Quantization",
      "Waktu RLE Validasi",
      "Waktu Huffman Encode",
      "Waktu Huffman Frequency",
      "Waktu Huffman Tree",
      "Waktu Huffman Codebook",
      "Waktu Huffman Bitstream",
      "Waktu Huffman Packing",
      "Waktu Huffman Decode",
      "Waktu Huffman Inverse Quantization",
      "Waktu Huffman Validasi",
      "Total Waktu RLE",
      "Total Waktu Huffman",
      "Best Method",
    ];
  }
  return [
    "Quantization Level",
    "Bit per Piksel",
    "Raw Working Grayscale Size",
    "Quantized Fixed-bit Size",
    "RLE Theoretical Payload",
    "Huffman Theoretical Payload",
    "RLE Estimated Export Size",
    "Huffman Estimated Export Size",
    "Compression Ratio RLE",
    "Compression Ratio Huffman",
    "Space Saving RLE",
    "Space Saving Huffman",
    "Best Method",
    "Status",
  ];
}

function groupRowsByImage(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row["Image Name"]}-${row.Format}-${row["Resolusi Kerja"]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, groupRows]) => ({ key, rows: groupRows }));
}

function metricTooltip(column) {
  const hints = {
    "Quantization Level": "Jumlah level grayscale target yang diuji.",
    "Bit per Piksel": "ceil(log2(level)) untuk kode kuantisasi.",
    "Raw Working Grayscale Size": "Ukuran grayscale mentah 8-bit pada resolusi kerja.",
    "Quantized Fixed-bit Size": "Ukuran teoritis hasil kuantisasi pada resolusi kerja.",
    "RLE Theoretical Payload": "Payload teoritis RLE, tidak termasuk seluruh metadata dan struktur file.",
    "Huffman Theoretical Payload": "Payload teoritis Huffman, tidak termasuk seluruh metadata dan struktur file.",
    "RLE Estimated Export Size": "Estimasi ukuran export JSON, bukan format biner optimal.",
    "Huffman Estimated Export Size": "Estimasi ukuran export JSON, bukan format biner optimal.",
    "Compression Ratio RLE": "Ukuran input algoritmik dibagi ukuran RLE.",
    "Compression Ratio Huffman": "Ukuran input algoritmik dibagi ukuran Huffman.",
    "Space Saving RLE": "(1 - RLE/input) x 100%.",
    "Space Saving Huffman": "(1 - Huffman/input) x 100%.",
    "Reconstruction MSE RLE": "Grayscale asli resolusi kerja dibanding citra rekonstruksi RLE.",
    "Round-trip MSE RLE": "Kode kuantisasi sebelum RLE dibanding kode hasil decode RLE.",
    "Waktu Huffman Encode": "Mencakup frekuensi, tree, codebook, dan payload encoding.",
  };
  return hints[column] ?? column;
}

function datasetFormatKey(format) {
  const value = String(format || "").replace(".", "").toUpperCase();
  if (value === "JPG" || value === "JPEG") return "JPG/JPEG";
  if (value === "PNG") return "PNG";
  if (value === "BMP") return "BMP";
  if (value === "TIF" || value === "TIFF") return "TIFF";
  return value || "UNKNOWN";
}

function normalizeContentCategory(value) {
  const clean = String(value || "").trim();
  return clean || "unlabeled";
}

function buildHistogramFromCodes(codes, levelCount) {
  const histogram = Array(levelCount).fill(0);
  for (const code of codes) histogram[code] += 1;
  return histogram;
}

function findQuantizationGroup(groups, intensity) {
  return groups.find((group) => intensity >= group.minIntensity && intensity <= group.maxIntensity);
}

function buildHistogramSummary(histogram, totalPixels) {
  const values = [];
  let weighted = 0;
  let maxFrequency = -1;
  let mode = 0;
  histogram.forEach((count, value) => {
    if (count > 0) {
      values.push({ value, count });
      weighted += value * count;
      if (count > maxFrequency) {
        maxFrequency = count;
        mode = value;
      }
    }
  });
  let cumulative = 0;
  const medianTarget = totalPixels / 2;
  let median = values[0]?.value ?? 0;
  for (const item of values) {
    cumulative += item.count;
    if (cumulative >= medianTarget) {
      median = item.value;
      break;
    }
  }
  return {
    min: values[0]?.value ?? "-",
    max: values[values.length - 1]?.value ?? "-",
    unique: values.length,
    total: totalPixels,
    mean: totalPixels ? weighted / totalPixels : 0,
    median,
    mode,
  };
}

function buildRleRowSummary(row, rle) {
  const runCount = row.pairs.length;
  const pixelCount = row.decodedPixelCount;
  const longestRun = row.pairs.reduce((max, pair) => Math.max(max, pair.count), 0);
  return {
    row: row.rowIndex,
    pixelCount,
    runCount,
    longestRun,
    averageRun: pixelCount / runCount,
    sizeBits: runCount * (rle.symbolBitWidth + rle.countBitWidth),
  };
}

function sampleRlePairs(pairs) {
  if (pairs.length <= 20) return pairs;
  const first = pairs.slice(0, 10);
  const last = pairs.slice(-10);
  return [...first, { row: "...", run: "...", value: "...", count: "...", isSeparator: true }, ...last];
}

function formatPairBinary(value, width) {
  return Number.isInteger(value) ? value.toString(2).padStart(width, "0") : "-";
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

function HuffmanTreeSvg({ root, entries = [], fileName = "huffman_tree" }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [treeMode, setTreeMode] = useState("Mode Sederhana");
  const [searchSymbol, setSearchSymbol] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const svgRef = useRef(null);
  const entryMap = new Map(entries.map((entry) => [entry.symbol, entry]));
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
    const symbols = collectTreeSymbols(node);
    const entry = entryMap.get(node.symbol);
    nodes.push({
      x,
      y,
      label: node.symbol === null ? `f=${number(node.frequency)}` : `Simbol ${node.symbol}`,
      detailLabel: node.symbol === null ? `${symbols.length} simbol` : `Kode ${entry?.code ?? "-"}`,
      frequency: node.frequency,
      leaf: node.symbol !== null,
      symbols,
    });
    return { x, y };
  };
  place(root, 0);
  const width = Math.max(360, leaves.length * 92 + 120);
  const height = Math.max(600, maxDepth * 88 + 120);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const fit = () => {
    setZoom(Math.max(0.45, Math.min(1.2, 1040 / width)));
    setPan({ x: 0, y: 0 });
  };
  const centerRoot = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const exportSvg = () => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    downloadText(source, `${fileName}_huffman_tree.svg`, "image/svg+xml;charset=utf-8");
  };
  const exportPng = () => {
    if (!svgRef.current) return;
    const source = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      downloadDataUrl(canvas.toDataURL("image/png"), `${fileName}_huffman_tree.png`);
    };
    image.src = url;
  };
  const topEntries = entries.filter((entry) => entry.frequency > 0).sort((a, b) => b.frequency - a.frequency).slice(0, 16);
  const requestedSymbol = searchSymbol.trim() === "" ? null : Number(searchSymbol);
  return (
    <div className={`tree-wrap ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="tree-controls" aria-label="Kontrol pohon Huffman">
        {["Mode Sederhana", "Mode Detail"].map((mode) => (
          <button key={mode} type="button" className={treeMode === mode ? "tab-button active" : "secondary"} onClick={() => setTreeMode(mode)}>{mode}</button>
        ))}
        <label className="tree-search">
          <span>Cari simbol</span>
          <input type="number" min="0" max="255" value={searchSymbol} onChange={(event) => setSearchSymbol(event.target.value)} placeholder="contoh 12" />
        </label>
        <button type="button" className="secondary" onClick={() => setZoom((value) => Math.min(2.6, value + 0.15))}>Zoom In</button>
        <button type="button" className="secondary" onClick={() => setZoom((value) => Math.max(0.35, value - 0.15))}>Zoom Out</button>
        <button type="button" className="secondary" onClick={() => setPan((value) => ({ ...value, x: value.x - 60 }))}>Geser Kiri</button>
        <button type="button" className="secondary" onClick={() => setPan((value) => ({ ...value, x: value.x + 60 }))}>Geser Kanan</button>
        <button type="button" className="secondary" onClick={() => setPan((value) => ({ ...value, y: value.y - 60 }))}>Geser Atas</button>
        <button type="button" className="secondary" onClick={() => setPan((value) => ({ ...value, y: value.y + 60 }))}>Geser Bawah</button>
        <button type="button" className="secondary" onClick={fit}>Fit to Screen</button>
        <button type="button" className="secondary" onClick={centerRoot}>Center Root</button>
        <button type="button" className="secondary" onClick={() => setIsFullscreen((value) => !value)}>{isFullscreen ? "Keluar Fullscreen" : "Expand Fullscreen"}</button>
        <button type="button" className="secondary" onClick={reset}>Reset</button>
        <button type="button" className="secondary" onClick={exportSvg}>Export SVG</button>
        <button type="button" className="secondary" onClick={exportPng}>Export PNG</button>
      </div>
      {treeMode === "Mode Sederhana" ? (
        <div className="top-symbols">
          {topEntries.map((entry) => (
            <article key={entry.symbol}>
              <span>Simbol {entry.symbol}</span>
              <strong>{entry.frequency}</strong>
              <small>{entry.code ?? "-"} - panjang {entry.codeLength}</small>
            </article>
          ))}
        </div>
      ) : null}
      <p className="tree-legend">
        Mode sederhana menampilkan node sebagai frekuensi dan daun sebagai simbol. Mode detail tetap tersedia untuk menelusuri penempatan kode 0/1 dari akar ke daun.
      </p>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Visualisasi pohon Huffman dengan edge 0 dan 1" className={treeMode === "Mode Detail" ? "" : "visually-soft"}>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map((edge, index) => (
            <g key={index}>
              <line x1={edge.from.x} y1={edge.from.y + 18} x2={edge.to.x} y2={edge.to.y - 18} />
              <text x={(edge.from.x + edge.to.x) / 2} y={(edge.from.y + edge.to.y) / 2 - 4}>{edge.label}</text>
            </g>
          ))}
          {nodes.map((node, index) => (
            <g key={index} className={requestedSymbol !== null && node.symbols.includes(requestedSymbol) ? "matched" : ""}>
              <rect x={node.x - 48} y={node.y - 24} width="96" height="48" rx="8" className={node.leaf ? "leaf" : ""} />
              <text x={node.x} y={node.y - 4}>{treeMode === "Mode Detail" ? node.detailLabel : node.label}</text>
              <text x={node.x} y={node.y + 13}>{treeMode === "Mode Detail" ? `f=${number(node.frequency)}` : symbolListLabel(node.symbols)}</text>
            </g>
          ))}
        </g>
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

function symbolListLabel(symbols) {
  if (symbols.length === 1) return `s=${symbols[0]}`;
  if (symbols.length <= 4) return `{${symbols.join(",")}}`;
  return `{${symbols.slice(0, 2).join(",")} ... ${symbols.slice(-1)[0]}}`;
}

function compactIntensities(values) {
  if (values.length <= 12) return values.join(", ");
  return `${values.slice(0, 6).join(", ")} ... ${values.slice(-4).join(", ")}`;
}

async function decodeImageFile(file, processingMode = "optimized") {
  const extension = extensionOf(file.name).toLowerCase();
  if (extension === "tif" || extension === "tiff") {
    return decodeTiff(file, processingMode);
  }
  return decodeBrowserImage(file, processingMode);
}

async function decodeBrowserImage(file, processingMode = "optimized") {
  const bitmap = await createImageBitmap(file);
  const resized = resizeBox(bitmap.width, bitmap.height, MAX_PIXELS, processingMode);
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
    resolutionInfo: buildResolutionInfo(bitmap.width, bitmap.height, resized, processingMode),
    previewUrl: previewCanvas.toDataURL("image/png"),
  };
}

async function decodeTiff(file, processingMode = "optimized") {
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

  const resized = resizeBox(ifds[0].width, ifds[0].height, MAX_PIXELS, processingMode);
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
    resolutionInfo: buildResolutionInfo(ifds[0].width, ifds[0].height, resized, processingMode),
    previewUrl: sourceCanvas.toDataURL("image/png"),
  };
}

function encodeHuffmanWithTiming(codes, symbolCount) {
  const frequencyStart = performance.now();
  const frequencies = buildFrequencyTable(codes, symbolCount);
  const frequencyTableMs = performance.now() - frequencyStart;

  const treeStart = performance.now();
  const { root, mergeHistory } = buildHuffmanTree(frequencies);
  const treeBuildMs = performance.now() - treeStart;

  const codebookStart = performance.now();
  const codebook = buildHuffmanCodebook(root);
  const codebookBuildMs = performance.now() - codebookStart;

  const bitstreamStart = performance.now();
  let bitString = "";
  for (const code of codes) bitString += codebook.get(code);
  const bitstreamEncodeMs = performance.now() - bitstreamStart;

  const packStart = performance.now();
  const packed = packBits(bitString);
  const bitPackingMs = performance.now() - packStart;

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
    timing: {
      frequencyTableMs,
      treeBuildMs,
      codebookBuildMs,
      bitstreamEncodeMs,
      bitPackingMs,
      encodeMs: frequencyTableMs + treeBuildMs + codebookBuildMs + bitstreamEncodeMs + bitPackingMs,
    },
  };
}

function runBenchmarkPipeline(decoded, file, level, method, outputMode, sourceProfile, contentCategory = "unlabeled") {
  runPipeline(decoded, file, level, method, outputMode, sourceProfile, contentCategory);
  const measuredRuns = [];
  let finalResult = null;
  for (let run = 0; run < 5; run += 1) {
    const totalStart = performance.now();
    const result = runPipeline(decoded, file, level, method, outputMode, sourceProfile, contentCategory);
    const totalMs = performance.now() - totalStart;
    measuredRuns.push({
      totalMs,
      quantizationMs: result.quantTiming.quantizationMs,
      rleTotalMs: result.rle.timing.totalMs,
      huffmanTotalMs: result.huffman.timing.totalMs,
    });
    finalResult = result;
  }
  const benchmarkSummary = buildBenchmarkSummary(measuredRuns);
  return {
    ...finalResult,
    benchmarkSummary,
    rows: buildRows({ ...finalResult, benchmarkSummary }, outputMode),
  };
}

function runPipeline(decoded, file, level, method, outputMode, sourceProfile, contentCategory = "unlabeled") {
  const grayStart = performance.now();
  const gray = toGrayscale(decoded.rgba, decoded.width, decoded.height);
  const grayMs = performance.now() - grayStart;

  const detectedProfile = sourceProfile ?? analyzeSourceQuantization(gray);
  if (level >= detectedProfile.estimatedLevel) {
    throw new Error(`SKIPPED: level kuantisasi ${level} tidak diproses. ${buildSkippedReason()}`);
  }

  const quantStart = performance.now();
  const quantization = quantizeEqualPopulation(gray, level, detectedProfile.estimatedLevel);
  const quantMs = performance.now() - quantStart;
  const quantizedCodes = quantization.codes;
  const sourceRawBits = quantizedCodes.length * quantization.quantizedBitDepth;
  const quantInputBits = gray.length * detectedProfile.bitsPerPixel;
  const rawSourceGrayscaleBits = buildGrayscaleRawSizeBits(decoded.originalWidth * decoded.originalHeight);
  const rawWorkingGrayscaleBits = buildGrayscaleRawSizeBits(gray.length);
  const detectedSourceFixedBitSizeBits = buildDetectedFixedBitSizeBits(decoded.originalWidth * decoded.originalHeight, detectedProfile.bitsPerPixel);
  const quantCompressionMetrics = buildCompressionMetrics({
    inputBits: quantInputBits,
    compressedBits: quantization.theoreticalBits,
    baselineType: "working-grayscale",
    baselineLabel: "Working grayscale effective bit-depth vs quantized fixed-bit data",
  });
  const quantReconstructionQuality = buildReconstructionQualityMetrics(gray, quantization.reconstructed);
  const quantizedChecksum = dataChecksum(quantizedCodes);

  const rleEncodeStart = performance.now();
  const rleEncoded = encodeRLEMatrix(quantizedCodes, decoded.width, decoded.height, level);
  const rleEncodeMs = performance.now() - rleEncodeStart;
  const rleDecodeStart = performance.now();
  const rleDecodedCodes = decodeRLEMatrix(rleEncoded);
  const rleDecodeMs = performance.now() - rleDecodeStart;
  const rleInverseStart = performance.now();
  const rleReconstructed = inverseQuantization(rleDecodedCodes, quantization.groups);
  const rleInverseQuantizationMs = performance.now() - rleInverseStart;
  const rleValidationStart = performance.now();
  const rleReconstructionQuality = buildReconstructionQualityForTarget(gray, rleReconstructed, "rle-reconstruction");
  const rleRoundTripValidation = buildRoundTripValidationMetrics(quantizedCodes, rleDecodedCodes, quantizedChecksum);
  const rleValidationMs = performance.now() - rleValidationStart;
  const rleCompressionMetrics = buildCompressionMetrics({
    inputBits: sourceRawBits,
    compressedBits: rleEncoded.theoreticalBits,
    baselineType: "quantized-fixed-bit",
    baselineLabel: "Quantized fixed-bit data vs RLE theoretical payload",
  });
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
    compressionMetrics: rleCompressionMetrics,
    reconstructionQuality: rleReconstructionQuality,
    roundTripValidation: rleRoundTripValidation,
    timing: {
      encodeMs: rleEncodeMs,
      decodeMs: rleDecodeMs,
      inverseQuantizationMs: rleInverseQuantizationMs,
      reconstructionMs: rleInverseQuantizationMs,
      validationMs: rleValidationMs,
      totalMs: rleEncodeMs + rleDecodeMs + rleInverseQuantizationMs + rleValidationMs,
    },
    actualBytes: rleActualBytes,
  };

  const huffmanEncoded = encodeHuffmanWithTiming(quantizedCodes, level);
  const huffmanEncodeMs = huffmanEncoded.timing.encodeMs;
  const huffmanDecodeStart = performance.now();
  const huffmanDecodedCodes = decodeHuffmanCore(huffmanEncoded, quantizedCodes.length);
  const huffmanDecodeMs = performance.now() - huffmanDecodeStart;
  const huffmanInverseStart = performance.now();
  const huffmanReconstructed = inverseQuantization(huffmanDecodedCodes, quantization.groups);
  const huffmanInverseQuantizationMs = performance.now() - huffmanInverseStart;
  const huffmanValidationStart = performance.now();
  const huffmanReconstructionQuality = buildReconstructionQualityForTarget(gray, huffmanReconstructed, "huffman-reconstruction");
  const huffmanRoundTripValidation = buildRoundTripValidationMetrics(quantizedCodes, huffmanDecodedCodes, quantizedChecksum);
  const huffmanValidationMs = performance.now() - huffmanValidationStart;
  const huffmanCompressionMetrics = buildCompressionMetrics({
    inputBits: sourceRawBits,
    compressedBits: huffmanEncoded.payloadBits,
    baselineType: "quantized-fixed-bit",
    baselineLabel: "Quantized fixed-bit data vs Huffman theoretical payload",
  });
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
    compressionMetrics: huffmanCompressionMetrics,
    reconstructionQuality: huffmanReconstructionQuality,
    roundTripValidation: huffmanRoundTripValidation,
    timing: {
      frequencyTableMs: huffmanEncoded.timing.frequencyTableMs,
      treeBuildMs: huffmanEncoded.timing.treeBuildMs,
      codebookBuildMs: huffmanEncoded.timing.codebookBuildMs,
      bitstreamEncodeMs: huffmanEncoded.timing.bitstreamEncodeMs,
      bitPackingMs: huffmanEncoded.timing.bitPackingMs,
      encodeMs: huffmanEncodeMs,
      decodeMs: huffmanDecodeMs,
      inverseQuantizationMs: huffmanInverseQuantizationMs,
      reconstructionMs: huffmanInverseQuantizationMs,
      validationMs: huffmanValidationMs,
      totalMs: huffmanEncodeMs + huffmanDecodeMs + huffmanInverseQuantizationMs + huffmanValidationMs,
    },
    actualBytes: huffmanActualBytes,
  };

  const primary = pickPrimaryCompression(method, rle, huffman);
  const decompressed = primary === "RLE" ? rleReconstructed : huffmanReconstructed;
  const compressedBits = primary === "RLE" ? rle.theoreticalBits : huffman.payloadBits;
  const isComparisonMode = method === "Kuantisasi + Perbandingan RLE dan Huffman";
  const encodeMs = isComparisonMode ? rle.encodeMs + huffman.encodeMs : (primary === "RLE" ? rle.encodeMs : huffman.encodeMs);
  const decodeMs = isComparisonMode ? rle.decodeMs + huffman.decodeMs : (primary === "RLE" ? rle.decodeMs : huffman.decodeMs);
  const primaryCompressionMetrics = primary === "RLE" ? rleCompressionMetrics : huffmanCompressionMetrics;
  const primaryReconstructionMetrics = primary === "RLE" ? rleReconstructionQuality : huffmanReconstructionQuality;
  const images = {
    gray: grayToUrl(gray, decoded.width, decoded.height),
    quantized: grayToUrl(quantization.reconstructed, decoded.width, decoded.height),
    rleDecompressed: grayToUrl(rleReconstructed, decoded.width, decoded.height),
    huffmanDecompressed: grayToUrl(huffmanReconstructed, decoded.width, decoded.height),
    decompressed: grayToUrl(decompressed, decoded.width, decoded.height),
  };

  const context = {
    file,
    contentCategory: normalizeContentCategory(contentCategory),
    decoded,
    resolutionInfo: decoded.resolutionInfo,
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
    quantTiming: {
      quantizationMs: quantMs,
      reconstructionMs: 0,
      totalMs: quantMs,
    },
    quantReconstructionQuality,
    quantInputBits,
    rawSourceGrayscaleBits,
    rawWorkingGrayscaleBits,
    detectedSourceFixedBitSizeBits,
    quantCompressionMetrics,
    rle,
    huffman,
    compression: { method, primary, sourceLevel: level, sourceRawBits, compressedBits, encodeMs, decodeMs },
    decompressed,
    primaryCompressionMetrics,
    primaryReconstructionMetrics,
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
  const emptyMetrics = {
    "Source File Size (Disk)": "-",
    "Raw Source Grayscale Size": "-",
    "Raw Working Grayscale Size": "-",
    "Quantized Fixed-bit Size": "-",
    "RLE Theoretical Payload": "-",
    "Huffman Theoretical Payload": "-",
    "Estimated Export Size": "-",
    "Waktu Total": "-",
    "Reconstruction MSE": "-",
    "Reconstruction PSNR": "-",
    "Round-trip MSE": "-",
    "Round-trip PSNR": "-",
    "Piksel Berbeda": "-",
    "Max Absolute Difference": "-",
    "Checksum Sebelum": "-",
    "Checksum Sesudah": "-",
    "Status Validasi": "-",
  };

  const push = (stage) => rows.push({ No: no++, ...common, ...emptyMetrics, ...stage });
  const rawOriginalBits = ctx.decoded.originalWidth * ctx.decoded.originalHeight * 4 * 8;
  push({
    Tahap: "Citra Asli",
    "Dimensi Pixel": `${ctx.decoded.originalWidth} x ${ctx.decoded.originalHeight} x 4`,
    "Jumlah Pixel": ctx.decoded.originalWidth * ctx.decoded.originalHeight,
    "Level Kuantisasi": "-",
    "Source File Size (Disk)": diskSizeText,
    "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
    "Nilai Unik": uniqueCountRgba(ctx.decoded.rgba),
    "Jumlah Run": "-",
    "Waktu Encode": "-",
    "Waktu Decode": "-",
    "Compression Ratio": "1.0000",
    "Space Saving (%)": "0.0000",
    Analisis: "Ukuran file disk dipengaruhi format dan metadata; ukuran mentah dihitung dari piksel RGBA.",
  });

  push({
    Tahap: "Grayscale",
    "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
    "Jumlah Pixel": ctx.working.pixels,
    "Level Kuantisasi": ctx.sourceProfile.estimatedLevel,
    "Source File Size (Disk)": diskSizeText,
    "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
    "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
    "Nilai Unik": uniqueCount(ctx.gray),
    "Jumlah Run": "-",
    "Waktu Encode": seconds(ctx.working.grayMs),
    "Waktu Decode": "-",
    "Waktu Total": seconds(ctx.working.grayMs),
    "Compression Ratio": fixed(rawOriginalBits / (ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel))),
    "Space Saving (%)": fixed((1 - (ctx.gray.length * bitsForLevel(ctx.sourceProfile.estimatedLevel)) / rawOriginalBits) * 100),
    "Reconstruction MSE": "0.000000",
    "Reconstruction PSNR": psnrLabel(Infinity),
    "Status Validasi": "Baseline grayscale",
    Analisis: `RGB dikonversi menjadi satu kanal intensitas. Terdeteksi ${ctx.sourceProfile.uniqueCount} nilai unik, dipetakan sebagai sumber sekitar ${ctx.sourceProfile.estimatedLevel} level.`,
  });

  const includeFull = outputMode.startsWith("1.");
  if (includeFull || ctx.compression.method.includes("Kuantisasi")) {
    push({
      Tahap: includeFull ? "Kuantisasi" : "Citra Kuantisasi",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.quantization.levelCount,
      "Source File Size (Disk)": diskSizeText,
      "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
      "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
      "Quantized Fixed-bit Size": bits(ctx.quantization.theoreticalBits),
      "Nilai Unik": uniqueCount(ctx.quantization.codes),
      "Jumlah Run": "-",
      "Waktu Encode": seconds(ctx.quantTiming.quantizationMs),
      "Waktu Decode": "-",
      "Waktu Total": seconds(ctx.quantTiming.totalMs),
      "Compression Ratio": fixed(ctx.quantCompressionMetrics.compressionRatio),
      "Space Saving (%)": fixed(ctx.quantCompressionMetrics.spaceSavingPercent),
      "Reconstruction MSE": fixed(ctx.quantReconstructionQuality.mse, 6),
      "Reconstruction PSNR": psnrLabel(ctx.quantReconstructionQuality.psnr),
      "Status Validasi": "Lossy tahap kuantisasi",
      Analisis: "Level intensitas dikurangi; reconstruction MSE/PSNR membandingkan grayscale asli dengan hasil inverse quantization.",
    });
  }

  if (includeFull && ctx.rle) {
    push({
      Tahap: "RLE",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Source File Size (Disk)": diskSizeText,
      "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
      "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
      "Quantized Fixed-bit Size": bits(ctx.compression.sourceRawBits),
      "RLE Theoretical Payload": bits(ctx.rle.theoreticalBits),
      "Estimated Export Size": bytes(ctx.rle.actualBytes),
      "Nilai Unik": uniqueCount(ctx.quantizedCodes),
      "Jumlah Run": ctx.rle.pairCount,
      "Waktu Encode": seconds(ctx.rle.encodeMs),
      "Waktu Decode": seconds(ctx.rle.decodeMs),
      "Waktu Total": seconds(ctx.rle.timing.totalMs),
      "Compression Ratio": fixed(ctx.rle.compressionMetrics.compressionRatio),
      "Space Saving (%)": fixed(ctx.rle.compressionMetrics.spaceSavingPercent),
      "Reconstruction MSE": fixed(ctx.rle.reconstructionQuality.mse, 6),
      "Reconstruction PSNR": psnrLabel(ctx.rle.reconstructionQuality.psnr),
      "Round-trip MSE": fixed(ctx.rle.roundTripValidation.mse, 6),
      "Round-trip PSNR": psnrLabel(ctx.rle.roundTripValidation.psnr),
      "Piksel Berbeda": number(ctx.rle.roundTripValidation.differentPixelCount),
      "Max Absolute Difference": number(ctx.rle.roundTripValidation.maxAbsoluteDifference),
      "Checksum Sebelum": ctx.rle.roundTripValidation.checksumBefore,
      "Checksum Sesudah": ctx.rle.roundTripValidation.checksumAfter,
      "Status Validasi": ctx.rle.roundTripValidation.status,
      Analisis: "RLE diproses per baris dan lossless terhadap matriks kode kuantisasi; kualitas citra tetap mengikuti hasil kuantisasi.",
    });
  }

  if (includeFull && ctx.huffman) {
    push({
      Tahap: "Huffman",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Source File Size (Disk)": diskSizeText,
      "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
      "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
      "Quantized Fixed-bit Size": bits(ctx.compression.sourceRawBits),
      "Huffman Theoretical Payload": bits(ctx.huffman.payloadBits),
      "Estimated Export Size": bytes(ctx.huffman.actualBytes),
      "Nilai Unik": ctx.huffman.codeEntries.filter((entry) => entry.frequency > 0).length,
      "Jumlah Run": "-",
      "Waktu Encode": seconds(ctx.huffman.encodeMs),
      "Waktu Decode": seconds(ctx.huffman.decodeMs),
      "Waktu Total": seconds(ctx.huffman.timing.totalMs),
      "Compression Ratio": fixed(ctx.huffman.compressionMetrics.compressionRatio),
      "Space Saving (%)": fixed(ctx.huffman.compressionMetrics.spaceSavingPercent),
      "Reconstruction MSE": fixed(ctx.huffman.reconstructionQuality.mse, 6),
      "Reconstruction PSNR": psnrLabel(ctx.huffman.reconstructionQuality.psnr),
      "Round-trip MSE": fixed(ctx.huffman.roundTripValidation.mse, 6),
      "Round-trip PSNR": psnrLabel(ctx.huffman.roundTripValidation.psnr),
      "Piksel Berbeda": number(ctx.huffman.roundTripValidation.differentPixelCount),
      "Max Absolute Difference": number(ctx.huffman.roundTripValidation.maxAbsoluteDifference),
      "Checksum Sebelum": ctx.huffman.roundTripValidation.checksumBefore,
      "Checksum Sesudah": ctx.huffman.roundTripValidation.checksumAfter,
      "Status Validasi": ctx.huffman.roundTripValidation.status,
      Analisis: "Huffman dibangun dari frekuensi aktual kode kuantisasi dan lossless terhadap matriks kode.",
    });
  }

  const primaryValidation = ctx.compression.primary === "RLE" ? ctx.rle.roundTripValidation : ctx.huffman.roundTripValidation;
  const primaryQuality = ctx.compression.primary === "RLE" ? ctx.rle.reconstructionQuality : ctx.huffman.reconstructionQuality;
  const primaryTiming = ctx.compression.primary === "RLE" ? ctx.rle.timing : ctx.huffman.timing;
  push({
    Tahap: includeFull ? "Dekompresi" : `Citra Dekompresi ${ctx.compression.method}`,
    "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
    "Jumlah Pixel": ctx.working.pixels,
    "Level Kuantisasi": ctx.compression.sourceLevel,
    "Source File Size (Disk)": diskSizeText,
    "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
    "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
    "Quantized Fixed-bit Size": bits(ctx.compression.sourceRawBits),
    [ctx.compression.primary === "RLE" ? "RLE Theoretical Payload" : "Huffman Theoretical Payload"]: bits(ctx.compression.compressedBits),
    "Estimated Export Size": bytes(ctx.compression.primary === "RLE" ? ctx.rle.actualBytes : ctx.huffman.actualBytes),
    "Nilai Unik": uniqueCount(ctx.decompressed),
    "Jumlah Run": ctx.rle?.pairCount ?? "-",
    "Waktu Encode": includeFull ? "-" : seconds(ctx.compression.encodeMs),
    "Waktu Decode": seconds(ctx.compression.decodeMs),
    "Waktu Total": includeFull ? seconds(primaryTiming.decodeMs + primaryTiming.reconstructionMs + primaryTiming.validationMs) : seconds(primaryTiming.totalMs),
    "Compression Ratio": fixed(ctx.primaryCompressionMetrics.compressionRatio),
    "Space Saving (%)": fixed(ctx.primaryCompressionMetrics.spaceSavingPercent),
    "Reconstruction MSE": fixed(primaryQuality.mse, 6),
    "Reconstruction PSNR": psnrLabel(primaryQuality.psnr),
    "Round-trip MSE": fixed(primaryValidation.mse, 6),
    "Round-trip PSNR": psnrLabel(primaryValidation.psnr),
    "Piksel Berbeda": number(primaryValidation.differentPixelCount),
    "Max Absolute Difference": number(primaryValidation.maxAbsoluteDifference),
    "Checksum Sebelum": primaryValidation.checksumBefore,
    "Checksum Sesudah": primaryValidation.checksumAfter,
    "Status Validasi": primaryValidation.status,
    Analisis: `Data ${ctx.compression.primary} dikembalikan menjadi kode kuantisasi, divalidasi checksum, lalu inverse quantization.`,
  });

  if (includeFull) {
    push({
      Tahap: "Evaluasi Akhir",
      "Dimensi Pixel": `${ctx.working.width} x ${ctx.working.height}`,
      "Jumlah Pixel": ctx.working.pixels,
      "Level Kuantisasi": ctx.compression.sourceLevel,
      "Source File Size (Disk)": diskSizeText,
      "Raw Source Grayscale Size": bits(ctx.rawSourceGrayscaleBits),
      "Raw Working Grayscale Size": bits(ctx.rawWorkingGrayscaleBits),
      "Quantized Fixed-bit Size": bits(ctx.compression.sourceRawBits),
      [ctx.compression.primary === "RLE" ? "RLE Theoretical Payload" : "Huffman Theoretical Payload"]: bits(ctx.compression.compressedBits),
      "Estimated Export Size": bytes(ctx.compression.primary === "RLE" ? ctx.rle.actualBytes : ctx.huffman.actualBytes),
      "Nilai Unik": uniqueCount(ctx.decompressed),
      "Jumlah Run": ctx.rle?.pairCount ?? "-",
      "Waktu Encode": seconds(ctx.compression.encodeMs),
      "Waktu Decode": seconds(ctx.compression.decodeMs),
      "Waktu Total": seconds((ctx.compression.primary === "RLE" ? ctx.rle.timing.totalMs : ctx.huffman.timing.totalMs)),
      "Compression Ratio": fixed(ctx.primaryCompressionMetrics.compressionRatio),
      "Space Saving (%)": fixed(ctx.primaryCompressionMetrics.spaceSavingPercent),
      "Reconstruction MSE": fixed(primaryQuality.mse, 6),
      "Reconstruction PSNR": psnrLabel(primaryQuality.psnr),
      "Round-trip MSE": fixed(primaryValidation.mse, 6),
      "Round-trip PSNR": psnrLabel(primaryValidation.psnr),
      "Piksel Berbeda": number(primaryValidation.differentPixelCount),
      "Max Absolute Difference": number(primaryValidation.maxAbsoluteDifference),
      "Checksum Sebelum": primaryValidation.checksumBefore,
      "Checksum Sesudah": primaryValidation.checksumAfter,
      "Status Validasi": primaryValidation.status,
      Analisis: `Ringkasan final memakai metode terpilih ${ctx.compression.primary}; RLE dan Huffman tetap dihitung independen.`,
    });
  }

  return rows;
}

function buildDetailReport(ctx, outputMode) {
  const lines = [];
  const rawOriginalBits = ctx.decoded.originalWidth * ctx.decoded.originalHeight * 4 * 8;
  const q = ctx.quantization;
  const qMetrics = ctx.quantCompressionMetrics;
  const finalCompression = ctx.primaryCompressionMetrics;
  const finalReconstruction = ctx.primaryReconstructionMetrics;
  const huffmanInputBits = ctx.compression.sourceRawBits;

  lines.push("DETAIL RUMUS DAN PERHITUNGAN KOMPRESI CITRA");
  lines.push("================================================");
  lines.push(`Nama citra       : ${ctx.file.name}`);
  lines.push(`Format           : ${ctx.file.format}`);
  lines.push(`Metode           : ${ctx.compression.method}`);
  lines.push(`Mode output      : ${outputMode}`);
  lines.push(`Level kuantisasi : ${ctx.compression.sourceLevel}`);
  lines.push(`Resolusi sumber  : ${ctx.resolutionInfo.sourceWidth} x ${ctx.resolutionInfo.sourceHeight}`);
  lines.push(`Resolusi kerja   : ${ctx.resolutionInfo.workingWidth} x ${ctx.resolutionInfo.workingHeight}`);
  lines.push(`Mode resolusi    : ${ctx.resolutionInfo.processingMode === "optimized" ? "Optimasi Browser" : "Resolusi Asli"}`);
  lines.push(`Catatan resolusi : ${ctx.resolutionInfo.wasResized ? ctx.resolutionInfo.resizeReason : "Citra diproses pada resolusi sumber."}`);
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
  lines.push(`CR_q = ${qMetrics.inputBits}/${qMetrics.compressedBits} = ${fixed(qMetrics.compressionRatio)}`);
  lines.push(`SS_q = (1 - ${qMetrics.compressedBits}/${qMetrics.inputBits}) x 100% = ${fixed(qMetrics.spaceSavingPercent)}%`);
  lines.push(`Reconstruction MSE_q = ${fixed(ctx.quantReconstructionQuality.mse, 6)}`);
  lines.push(`Reconstruction PSNR_q = ${psnrLabel(ctx.quantReconstructionQuality.psnr)}`);
  lines.push(`Waktu kuantisasi = ${seconds(ctx.quantTiming.quantizationMs)}`);
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
    lines.push(`Round-trip MSE_RLE = ${fixed(ctx.rle.roundTripValidation.mse, 6)}`);
    lines.push(`Round-trip PSNR_RLE = ${psnrLabel(ctx.rle.roundTripValidation.psnr)}`);
    lines.push(`Reconstruction MSE_RLE = ${fixed(ctx.rle.reconstructionQuality.mse, 6)}`);
    lines.push(`Reconstruction PSNR_RLE = ${psnrLabel(ctx.rle.reconstructionQuality.psnr)}`);
    lines.push(`Round-trip RLE = ${ctx.rle.roundTripValidation.status}`);
    lines.push(`Waktu encode RLE = ${seconds(ctx.rle.timing.encodeMs)}`);
    lines.push(`Waktu decode RLE = ${seconds(ctx.rle.timing.decodeMs)}`);
    lines.push(`Total waktu RLE = ${seconds(ctx.rle.timing.totalMs)}`);
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
    lines.push(`Round-trip MSE_H = ${fixed(ctx.huffman.roundTripValidation.mse, 6)}`);
    lines.push(`Round-trip PSNR_H = ${psnrLabel(ctx.huffman.roundTripValidation.psnr)}`);
    lines.push(`Reconstruction MSE_H = ${fixed(ctx.huffman.reconstructionQuality.mse, 6)}`);
    lines.push(`Reconstruction PSNR_H = ${psnrLabel(ctx.huffman.reconstructionQuality.psnr)}`);
    lines.push(`Round-trip Huffman = ${ctx.huffman.roundTripValidation.status}`);
    lines.push(`Waktu encode Huffman = ${seconds(ctx.huffman.timing.encodeMs)}`);
    lines.push(`Waktu decode Huffman = ${seconds(ctx.huffman.timing.decodeMs)}`);
    lines.push(`Total waktu Huffman = ${seconds(ctx.huffman.timing.totalMs)}`);
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
  lines.push(`Baseline evaluasi = ${finalCompression.baselineLabel}`);
  lines.push(`S_input evaluasi = ${finalCompression.inputBits} bit`);
  lines.push(`S_kompresi final = ${finalCompression.compressedBits} bit`);
  lines.push(`CR = ${finalCompression.inputBits}/${finalCompression.compressedBits} = ${fixed(finalCompression.compressionRatio)}`);
  lines.push(`SS = (1 - ${finalCompression.compressedBits}/${finalCompression.inputBits}) x 100% = ${fixed(finalCompression.spaceSavingPercent)}%`);
  lines.push(`Reconstruction MSE final = ${fixed(finalReconstruction.mse, 6)}`);
  lines.push(`Reconstruction PSNR final = ${psnrLabel(finalReconstruction.psnr)}`);
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

function resizeBox(width, height, maxPixels, processingMode = "optimized") {
  if (processingMode === "original") {
    return { width, height, wasResized: false, scale: 1, resizeReason: null };
  }
  const pixels = width * height;
  if (pixels <= maxPixels) return { width, height, wasResized: false, scale: 1, resizeReason: null };
  const scale = Math.sqrt(maxPixels / pixels);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    wasResized: true,
    scale,
    resizeReason: `Jumlah piksel sumber ${number(pixels)} melebihi batas kerja ${number(maxPixels)} piksel.`,
  };
}

function buildResolutionInfo(sourceWidth, sourceHeight, resized, processingMode) {
  return {
    sourceWidth,
    sourceHeight,
    sourcePixelCount: sourceWidth * sourceHeight,
    workingWidth: resized.width,
    workingHeight: resized.height,
    workingPixelCount: resized.width * resized.height,
    wasResized: resized.wasResized,
    resizeScale: resized.scale ?? resized.width / sourceWidth,
    resizeReason: resized.resizeReason,
    processingMode: processingMode === "original" ? "original" : "optimized",
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

function psnrLabel(value) {
  return Number.isFinite(value) ? `${value.toFixed(4)} dB` : "Inf dB - identik";
}

function number(value) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("id-ID") : "-";
}

function decimal(value, digits = 4) {
  return Number.isFinite(value) ? value.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "Inf";
}

function displayDecimal(value, digits = 4) {
  return Number.isFinite(value) ? decimal(value, digits) : "-";
}

function percent(value, digits = 4) {
  return Number.isFinite(value) ? `${decimal(value, digits)}%` : "Inf%";
}

function displayPercent(value, digits = 4) {
  return Number.isFinite(value) ? percent(value, digits) : "-";
}

function milliseconds(ms) {
  return Number.isFinite(ms) ? `${ms.toLocaleString("id-ID", { maximumFractionDigits: 3 })} ms` : "-";
}

function displayMilliseconds(ms) {
  return Number.isFinite(ms) ? milliseconds(ms) : "-";
}

function displayPsnr(value) {
  return Number.isFinite(value) || value === Infinity ? psnrLabel(value) : "-";
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(4)} s`;
}

function bits(value) {
  return `${number(value)} bit`;
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
    resolutionInfo: result.resolutionInfo,
    sourceFileSizeBytes: result.file.size,
    rawSourceGrayscaleBits: result.rawSourceGrayscaleBits,
    rawWorkingGrayscaleBits: result.rawWorkingGrayscaleBits,
    quantizedFixedBitSizeBits: result.quantization.theoreticalBits,
    symbolBitWidth: result.rle.symbolBitWidth,
    countBitWidth: result.rle.countBitWidth,
    pairCount: result.rle.pairCount,
    theoreticalBits: result.rle.theoreticalBits,
    payloadBytes: result.rle.payloadBytes,
    actualBytes: result.rle.actualBytes,
    checksumBefore: result.quantizedChecksum,
    checksumAfter: result.rle.decodedChecksum,
    roundTripStatus: result.rle.roundTripStatus,
    compressionMetrics: result.rle.compressionMetrics,
    reconstructionQuality: result.rle.reconstructionQuality,
    roundTripValidation: result.rle.roundTripValidation,
    timing: result.rle.timing,
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
    resolutionInfo: result.resolutionInfo,
    sourceFileSizeBytes: result.file.size,
    rawSourceGrayscaleBits: result.rawSourceGrayscaleBits,
    rawWorkingGrayscaleBits: result.rawWorkingGrayscaleBits,
    quantizedFixedBitSizeBits: result.quantization.theoreticalBits,
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
    compressionMetrics: result.huffman.compressionMetrics,
    reconstructionQuality: result.huffman.reconstructionQuality,
    roundTripValidation: result.huffman.roundTripValidation,
    timing: result.huffman.timing,
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
