import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: "/piggy-bank.svg",
  },
};

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
