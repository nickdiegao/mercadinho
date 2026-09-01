import type { Metadata, Viewport } from "next";
import { EstadoProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distribuidora — Sistema de Estoque",
  description:
    "Mockup de demonstração: controle de estoque, vendas, caixa e lucro para distribuidora de bebidas.",
};

export const viewport: Viewport = {
  themeColor: "#16233f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <EstadoProvider>{children}</EstadoProvider>
      </body>
    </html>
  );
}
