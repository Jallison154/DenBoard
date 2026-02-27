import type { Metadata } from "next";
import "./globals.css";
import { FooterBar } from "@/components/FooterBar";
import { toCssVars } from "@/lib/theme/tokens";

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
      <body className="min-h-screen bg-charcoal font-body antialiased" style={{ color: "var(--denboard-text-primary)" }}>
        <style dangerouslySetInnerHTML={{ __html: toCssVars() }} />
        {children}
        <footer className="fixed bottom-0 inset-x-0 denboard-footer-scrim backdrop-blur-sm">
          <FooterBar />
        </footer>
      </body>
    </html>
  );
}

