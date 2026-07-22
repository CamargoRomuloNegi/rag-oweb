import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Source_Serif_4({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Plataforma RAG RTC — IBS/CBS",
  description: "Consulta técnico-jurídica ao corpus normativo da Reforma Tributária do Consumo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
