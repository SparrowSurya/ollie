"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { applyAccentColor } from "@/lib/accent";

interface SettingsContextType {
  theme: string;
  accent: string;
  customInstructions: string;
  setTheme: (theme: string) => void;
  setAccent: (accent: string) => void;
  setCustomInstructions: (instructions: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  const [theme, setThemeState] = useState<string>("mocha");
  const [accent, setAccentState] = useState<string>("lavender");
  const [customInstructions, setCustomInstructionsState] = useState<string>("");

  // Initialize theme and accent on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeTheme = document.documentElement.getAttribute("data-theme") || "mocha";
      const savedAccent = localStorage.getItem("ollie-accent") || "lavender";

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(activeTheme);
      setAccentState(savedAccent);

      // Apply initial accent color
      applyAccentColor(savedAccent, activeTheme);
    }
  }, []);

  // Fetch custom instructions when sessionId changes
  useEffect(() => {
    const fetchInstructions = async () => {
      const url = sessionId
        ? `/api/settings/instructions?sessionId=${encodeURIComponent(sessionId)}`
        : "/api/settings/instructions";
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCustomInstructionsState(data.customInstructions || "");
        }
      } catch (e) {
        console.error("SettingsContext: Failed to fetch custom instructions:", e);
      }
    };
    fetchInstructions();
  }, [sessionId]);

  const setTheme = (newTheme: string) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.style.colorScheme = newTheme === "latte" ? "light" : "dark";

    // Persist theme choice in a cookie (expiring in 1 year) for server renders
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    applyAccentColor(accent, newTheme);
  };

  const setAccent = (newAccent: string) => {
    setAccentState(newAccent);
    localStorage.setItem("ollie-accent", newAccent);
    applyAccentColor(newAccent, theme);
  };

  const setCustomInstructions = async (instructions: string) => {
    setCustomInstructionsState(instructions);

    const body: { customInstructions: string; sessionId?: string } = { customInstructions: instructions };
    if (sessionId) {
      body.sessionId = sessionId;
    }

    try {
      await fetch("/api/settings/instructions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error("SettingsContext: Failed to save custom instructions:", e);
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        accent,
        customInstructions,
        setTheme,
        setAccent,
        setCustomInstructions,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
