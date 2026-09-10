import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = { title: "Carreira — Painel pessoal", description: "Organizador local de busca de emprego" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><div className="appShell"><Nav /><main className="main">{children}</main></div></body></html>;
}
