import "./globals.css";

export const metadata = {
  title: "Kompresi Citra Digital",
  description: "Kuantisasi, RLE, Huffman Coding, dekompresi, evaluasi, dan detail rumus.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
