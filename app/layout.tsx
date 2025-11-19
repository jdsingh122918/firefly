import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const roboto = Roboto({
  weight: ['300', '400', '500', '700', '900'], // Light, Regular, Medium, Bold, Black
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: "--font-roboto-sans",
  display: 'swap'
});

const robotoMono = Roboto_Mono({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: "--font-roboto-mono",
  display: 'swap'
});

export const metadata: Metadata = {
  title: "Firefly - End of Life Care Platform",
  description: "Supporting families through end of life care with compassion, resources, and community",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${roboto.variable} ${robotoMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem={true}
            disableTransitionOnChange={false}
          >
            {children}
            <Toaster position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
