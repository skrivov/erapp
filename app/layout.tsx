import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Reimbursement Agent",
  description: "Demo app for deterministic policy routing with LLM-assisted extraction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen text-[color:var(--foreground)]`}>
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-8">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-0 pb-3">
            <Link href="/home/upload" className="text-lg font-semibold text-slate-800">
              Expense Reimbursement App Demo
            </Link>
            <nav className="flex items-center gap-3 text-sm text-slate-600">
              <Link href="/home/upload" className="px-2 py-1 transition hover:text-emerald-600">
                Home
              </Link>
              <Link href="/policies" className="px-2 py-1 transition hover:text-emerald-600">
                Policies
              </Link>
            </nav>
          </header>
          <main className="flex-1 pb-12">{children}</main>
          <footer className="text-xs text-slate-500">
            Built for the SPEC-driven expense routing demo. Policies and rules live in /policies.
          </footer>
        </div>
      </body>
    </html>
  );
}
