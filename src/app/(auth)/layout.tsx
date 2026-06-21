import { Inter, JetBrains_Mono } from "next/font/google";
import "./login/login.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-login",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-login-mono",
});

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`login-shell ${inter.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
