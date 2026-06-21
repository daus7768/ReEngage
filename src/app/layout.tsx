import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReEngage — win back students",
  description: "Bring back students who stopped coming, over WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
