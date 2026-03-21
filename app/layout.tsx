import type { Metadata } from "next";
import "./globals.css";
import { EmbedChrome } from "@/components/EmbedChrome";
import { FooterBar } from "@/components/FooterBar";
import { FloatingNav } from "@/components/FloatingNav";
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
      <body
        className="flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-charcoal font-body antialiased"
        style={{ color: "var(--denboard-text-primary)" }}
      >
        <style dangerouslySetInnerHTML={{ __html: toCssVars() }} />
        <EmbedChrome>
          <FloatingNav />
          <div className="denboard-viewport-shell flex min-h-0 flex-1 flex-col">{children}</div>
          <footer className="fixed bottom-0 inset-x-0 denboard-footer-scrim backdrop-blur-sm">
            <FooterBar />
          </footer>
        </EmbedChrome>
      </body>
    </html>
  );
}

