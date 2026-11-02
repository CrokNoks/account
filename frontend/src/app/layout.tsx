import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/piggy-bank.svg",
  },
};

// viewport-fit=cover: required for env(safe-area-inset-bottom) (bottom bar on iPhone).
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
