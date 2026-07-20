# Audit Akademik Aplikasi Kompresi Citra

Dokumen ini mencatat audit implementasi untuk aplikasi kompresi citra digital di project `Project Akhir Update`.

## Matriks Audit Sebelum Perubahan Terbaru

| Requirement | File/Fungsi Implementasi | Status Awal | Bukti Unit/Integration Test | Bukti UI | Masalah Ditemukan |
|---|---|---:|---|---|---|
| Upload JPG/JPEG, PNG, BMP, TIFF | `app/page.jsx` `decodeImageFile`, `decodeBrowserImage`, `decodeTiff` | Implemented | UI static + build | Input file accept multi format | TIFF/BMP bergantung dukungan browser/library |
| Preview dan metadata citra | `ImagePanel`, `decodeBrowserImage`, `decodeTiff` | Implemented | Browser QA | Preview asli, grayscale, kuantisasi, dekompresi | Sebelum revisi awal pernah terlalu banyak placeholder |
| Konversi grayscale | `toGrayscale` | Implemented | `test/compression.test.js` integration | Tahap Grayscale | Perlu penjelasan cara baca lebih eksplisit |
| Histogram grayscale | `quantizeEqualPopulation`, `buildHistogram` | Implemented | Fixture kuantisasi materi | Tahap Kuantisasi | Histogram harus tetap dalam panel besar |
| Level kuantisasi 256,128,64,32,16,8 | `LEVELS`, validasi `highestValidTargetLevel` | Implemented | UI static | Dropdown level | Level >= sumber dinonaktifkan |
| Equal-population quantization | `partitionHistogramEqualPopulation` | Implemented | Fixture materi lulus persis | Tabel Kuantisasi | Perlu label teoritis jelas |
| Tabel kelompok, mapping, representative intensity | `QuantizationTable`, `formatQuantizationGroups` | Implemented | UI static | Tabel Kuantisasi | Sudah diberi pagination |
| Inverse quantization | `inverseQuantization` | Implemented | Unit + integration | Preview Kuantisasi/Dekompresi | Lossy dijelaskan |
| RLE per baris dan pasangan p,q | `encodeRLEMatrix`, `RlePairsTable` | Implemented | Fixture RLE 31 pasangan | Tab RLE | Tidak lagi berupa string panjang |
| RLE decode benar | `decodeRLEMatrix` | Implemented | Unit + integration | Status round-trip | Validasi checksum ditampilkan |
| Huffman frequency, merge history, tree, code, bitstream | `encodeHuffman`, `HuffmanTable`, `HuffmanMergeTable`, `HuffmanTreeSvg` | Implemented | Fixture Huffman 11053 bit | Tab Huffman | Tree perlu zoom/export/simplified, sudah ditambah |
| Huffman decode benar | `decodeHuffman` | Implemented | Unit + integration | Status round-trip | Validasi checksum ditampilkan |
| Rekonstruksi RLE/Huffman | `inverseQuantization`, `DecompressionCard` | Implemented | Integration | Tahap Dekompresi | Validasi byte equality ditampilkan |
| Checksum dan byte-by-byte | `arraysEqual`, `checksum`, `differenceCount` | Implemented | Integration | Tahap Dekompresi/Evaluasi | Ditampilkan per metode |
| Ukuran asli, teoritis, payload, overhead, actual export | `runPipeline`, `estimateActualBytes`, `ActualEvaluation` | Implemented | UI static + build | Tab Evaluasi | Teoritis dan aktual dipisahkan |
| CR, SS, MSE, PSNR, waktu encode/decode | `metricSet`, `runPipeline` | Implemented | Unit + integration | Ringkasan/Evaluasi/Multi-level | PSNR Infinity ditangani |
| Export data kompresi, PNG dekompresi, CSV | `downloadRleData`, `downloadHuffmanData`, `downloadDataUrl`, `downloadCsv` | Implemented | Build | Tombol export | Download manual perlu dicoba di browser user |
| Empty/loading/error state | `onPickFile`, `processImage`, status UI | Implemented | Browser QA | Empty-state dan status proses | Error dibuat ramah pengguna |
| Dataset recap multi-format | `DatasetRecap`, `buildDatasetRecap` | Implemented | UI static | Tabel Dataset Recap | Status 5/format otomatis |
| Multi-level quantization test | `runMultiLevelTest`, `MultiLevelResults` | Implemented | UI static + build | Tabel Multi-Level | Level invalid diberi status, bukan crash |

## Matriks Requirement Sesudah Perubahan

| Area | Status | Bukti |
|---|---:|---|
| Alur 7 tahap pembelajaran | Implemented | `WORKFLOW_STEPS`, browser QA 7 step |
| Setiap tahap punya tujuan, kontrol input, hasil utama, proses, cara membaca, validasi, tindakan berikutnya | Implemented | `StageSection` |
| Tooltip istilah teknis | Implemented | `TERM_HELP`, `.term:hover::after`, `.term:focus::after` |
| RLE tab ringkasan/pasangan/dekompresi/penjelasan | Implemented | `AnalysisPanels`, `RlePairsTable` |
| Huffman tab frekuensi/merge/tree/kode/bitstream/dekompresi | Implemented | `AnalysisPanels`, `HuffmanTreeSvg` |
| Tree Huffman zoom, pan, fit, reset, export SVG/PNG, simplified view | Implemented | `HuffmanTreeSvg` |
| Dekompresi side-by-side dengan checksum, byte equality, decode time, download PNG | Implemented | `DecompressionCard` |
| Evaluasi teoritis vs aktual terpisah | Implemented | `TheoreticalEvaluation`, `ActualEvaluation` |
| Kesimpulan otomatis berbasis metrik | Implemented | `buildAutoConclusion`, `buildMethodConclusions` |
| Tabel lebar scrollable, sticky header, zebra row, pencarian/pagination relevan | Implemented | CSS table rules, pager components |
| Responsive 375/768/1024/1366/1920 tanpa overflow halaman | Implemented | Browser QA manual dengan in-app browser |
| Unit, integration, UI static, lint, typecheck, production build | Implemented | `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` |

## Keterbatasan

- TIFF dibaca lewat `utif`; BMP bergantung kemampuan `createImageBitmap` browser.
- Screenshot otomatis setelah upload file lokal belum dibuat sebagai test npm karena browser connector tidak menyediakan file chooser automation yang stabil pada thread ini.
- Ukuran aktual export adalah estimasi struktur JSON/payload aplikasi, sedangkan ukuran file disk asli tetap berasal dari file upload.
