import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "./providers/query-provider";
import {Toaster} from "@/components/ui/sonner";
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import { ThemeProvider } from '../providers/theme-provider';

export const metadata: Metadata = {
  title: "Account V2",
  description: "Personal finance manager",
  manifest: "/manifest.json",
  icons: {
    icon: "/piggy-bank.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Account V2",
  },
};

export default async function LocalizedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <div>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            {children}
          </QueryProvider>
        </NextIntlClientProvider>
        <Toaster />
      </ThemeProvider>
    </div>
  );
}
