import type { Metadata } from "next";
import { Poppins } from 'next/font/google';
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { Toaster } from 'sonner';
import { ThemeProvider } from "@/lib/contexts/theme-context";
import { AuthProvider } from "@/lib/auth/auth-context";

// Force all pages to be dynamically rendered - reduces build time significantly

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "LOANZ 360 - Vendor Portal",
  description: "Professional loan management system for financial institutions, partners, and customers. Streamline your lending operations with LOANZ 360.",
  keywords: "loan management, financial services, lending platform, loan origination, fintech",
  authors: [{ name: "LOANZ 360" }],
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "LOANZ 360",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className={poppins.className}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster
          position="top-right"
          richColors
          duration={4000}
          theme="dark"
        />
      </body>
    </html>
  );
}
