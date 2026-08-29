import type { Metadata } from "next";
import { Geist_Mono, Silkscreen, VT323 } from "next/font/google";
import "./globals.css";

const pixel = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
});

const display = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SignalGraph · Cala AI",
  description: "Tablón de investigación para recorrer el grafo de Cala AI.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${pixel.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
