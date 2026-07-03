"use client";

import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import SettingsModal from "./settings-modal";
import { applyAccentColor } from "@/lib/accent";

export default function GlobalSettings() {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Initialize accent color on mount and listen to runtime theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAccent = localStorage.getItem("olly-accent") || "lavender";
      const activeTheme = document.documentElement.getAttribute("data-theme") || "mocha";
      applyAccentColor(savedAccent, activeTheme);

      // Listen to theme switches in HTML attributes to update accent color in real-time
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === "data-theme") {
            const newTheme = document.documentElement.getAttribute("data-theme") || "mocha";
            const currentAccent = localStorage.getItem("olly-accent") || "lavender";
            applyAccentColor(currentAccent, newTheme);
          }
        });
      });

      observer.observe(document.documentElement, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  return (
    <>
      {/* Floating Settings Button in Top-Right Corner of screen */}
      <button
        onClick={() => setIsSettingsOpen(true)}
        className="fixed top-4 right-4 btn btn-ghost btn-circle z-40 text-base-content/60 hover:text-base-content hover:bg-base-200"
        title="Open settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Centered Floating Settings Modal Overlay */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
