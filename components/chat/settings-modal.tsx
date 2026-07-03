"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ACCENT_COLORS, applyAccentColor } from "@/lib/accent";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "apperence" | "model" | "database";

export default function SettingsModal({ isOpen, onClose }: Readonly<SettingsModalProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("apperence");
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.getAttribute("data-theme") || "mocha";
    }
    return "mocha";
  });
  const [activeAccent, setActiveAccent] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-accent") || "lavender";
    }
    return "lavender";
  });
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleThemeChange = (newTheme: string) => {
    setActiveTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.style.colorScheme = newTheme === "latte" ? "light" : "dark";

    // Set cookie to persist theme on server-side renders (expiring in 1 year)
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    // Re-apply the accent color for the new theme flavor
    applyAccentColor(activeAccent, newTheme);
  };

  const handleAccentChange = (newAccent: string) => {
    setActiveAccent(newAccent);
    localStorage.setItem("olly-accent", newAccent);
    applyAccentColor(newAccent, activeTheme);
  };

  // Close modal if user clicks the backdrop overlay outside the card
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "apperence", label: "Apperence" },
    { id: "model", label: "Model" },
    { id: "database", label: "Database" },
  ];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/15 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <div
        ref={modalRef}
        className="bg-base-200 text-base-content rounded-2xl border border-base-content/10 w-full max-w-xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[90vh] select-none"
      >
        {/* Header: Title is always left-aligned with same margins, close button is on the right */}
        <div className="flex items-center justify-between border-b border-base-content/10 pb-3 mb-4 shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50">
            {activeTab === "apperence"
              ? "Appearance Settings"
              : activeTab === "model"
              ? "Model Configuration"
              : "Database Settings"}
          </h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-300"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Column flow on mobile, Row flow on desktop */}
        <div className="flex flex-col md:flex-row gap-5 overflow-y-auto md:overflow-visible">
          {/* Tabs Navigation: Horizontal scrollable on mobile, vertical sidebar on desktop */}
          <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-base-content/10 pr-0 md:pr-4 shrink-0 justify-start md:justify-start w-full md:w-32 no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors text-center md:text-left whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-base-content/10 text-user-accent"
                    : "text-base-content/60 hover:bg-base-content/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Content Pane */}
          <div className="flex-1 min-h-35 select-text">
            {activeTab === "apperence" && (
              <div className="flex flex-col">
                {/* Theme Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-2 border-b border-base-content/5">
                  <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                    Theme:
                  </span>
                  <select
                    value={activeTheme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="select select-bordered select-xs sm:select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden"
                  >
                    <option value="latte">Latte (Light)</option>
                    <option value="frappe">Frappé (Dark)</option>
                    <option value="macchiato">Macchiato (Dark)</option>
                    <option value="mocha">Mocha (Default Dark)</option>
                  </select>
                </div>

                {/* Accent Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-2 mt-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                    Accent:
                  </span>
                  <select
                    value={activeAccent}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="select select-bordered select-xs sm:select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden"
                  >
                    {Object.entries(ACCENT_COLORS).map(([key, color]) => (
                      <option key={key} value={key}>
                        {color.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeTab === "model" && (
              <div className="flex flex-col gap-2 py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                  Model Selection:
                </span>
                <p className="text-xs text-base-content/50 italic bg-base-300 p-3 rounded-lg border border-base-content/5">
                  Currently running: gemma4:e2b (Local Ollama Host)
                </p>
              </div>
            )}

            {activeTab === "database" && (
              <div className="flex flex-col gap-2 py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                  Database History:
                </span>
                <p className="text-xs text-base-content/50 italic bg-base-300 p-3 rounded-lg border border-base-content/5">
                  Currently running: SQLite (No active sessions saved)
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
