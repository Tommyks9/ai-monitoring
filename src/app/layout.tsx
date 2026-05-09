import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ศูนย์ Monitor ทีม AI Agents อุ่นใจ",
  description: "Virtual Workspace และ dashboard สำหรับติดตามทีม AI Software House ของ OunJai",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
