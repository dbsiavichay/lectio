import type { Metadata, Viewport } from "next";
import { Geist, Literata } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Lectio", template: "%s · Lectio" },
  description: "Estudio guiado de libros: sesiones, repasos espaciados y compromisos.",
  applicationName: "Lectio",
  appleWebApp: { capable: true, title: "Lectio", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#16191f" },
  ],
};

// The reading size is applied before the first paint, so text doesn't jump.
const textSizeScript = `try{var s=localStorage.getItem("lectio:text-size");if(s)document.documentElement.dataset.textSize=s}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geist.variable} ${literata.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: textSizeScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          themes={["light", "dark", "sepia"]}
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
