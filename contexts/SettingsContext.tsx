"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
  const [theme, setThemeState] = useState<string>("mocha");
  const [accent, setAccentState] = useState<string>("lavender");
  const [customInstructions, setCustomInstructionsState] = useState<string>("");

  // Initialize preferences on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeTheme = document.documentElement.getAttribute("data-theme") || "mocha";
      const savedAccent = localStorage.getItem("ollie-accent") || "lavender";
      const savedInstructions = localStorage.getItem("ollie-custom-instructions") || "";

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThemeState(activeTheme);
      setAccentState(savedAccent);
      setCustomInstructionsState(savedInstructions);

      // Apply initial accent color
      applyAccentColor(savedAccent, activeTheme);
    }
  }, []);

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

  const setCustomInstructions = (instructions: string) => {
    setCustomInstructionsState(instructions);
    localStorage.setItem("ollie-custom-instructions", instructions);
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
