import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono, Outfit } from "next/font/google";
import GlobalSettings from "@/components/chat/global-settings";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { OllamaProvider } from "@/contexts/OllamaContext";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ollie - Local ollama chat",
  description: "A self-hosted web UI for Ollama local LLMs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value || "mocha";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${outfit.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ colorScheme: theme === "latte" ? "light" : "dark" }}
    >
      <body className="min-h-full flex flex-col">
        <SettingsProvider>
          <OllamaProvider>
            {children}
            <GlobalSettings />
          </OllamaProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}

