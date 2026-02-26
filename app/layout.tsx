import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DenBoard",
  description: "Always-on family dashboard for wall-mounted displays."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-charcoal text-slate-100 font-body antialiased">
        {children}
        <footer className="fixed bottom-0 inset-x-0 h-6 text-[10px] tracking-wide text-slate-400/80 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <span>DenBoard © OkamiDesigns</span>
        </footer>
      </body>
    </html>
  );
}

