import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BetManager — Gerenciador de Apostas Esportivas",
  description:
    "Gerencie suas apostas esportivas, acompanhe seu bankroll e analise seu desempenho com estatísticas avançadas incluindo ROI, CLV e muito mais.",
  keywords: [
    "apostas esportivas",
    "bet manager",
    "bankroll",
    "ROI",
    "CLV",
    "gestão de apostas",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
