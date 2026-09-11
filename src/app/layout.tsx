import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SGP-ANEEL",
  description: "Sistema Integrado de Gestão de Projetos ANEEL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
