import type { Metadata } from "next";
import "./globals.css";
import { BrandingProvider } from "@/src/components/factory/branding-provider";

export const metadata: Metadata = {
  title: { default: "Ionflow Factory", template: "%s | Ionflow Factory" },
  description: "Reusable factory interface · fictional demo data only",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <BrandingProvider>{children}</BrandingProvider>
      </body>
    </html>
  );
}
