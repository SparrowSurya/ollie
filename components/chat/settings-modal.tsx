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
  const [runnableModels, setRunnableModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModelState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-default-model") || "";
    }
    return "";
  });
  const [activeModel, setActiveModelState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("olly-active-model") || "";
    }
    return "";
  });
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Fetch runnable models when settings modal opens
  useEffect(() => {
    const fetchRunnable = async () => {
      try {
        const response = await fetch("/api/models?downloaded=true");
        if (response.ok) {
          const data = await response.json();
          const list = data.models || [];
          setRunnableModels(list);

          if (typeof window !== "undefined") {
            const savedDefault = localStorage.getItem("olly-default-model") || "";
            if (savedDefault && list.includes(savedDefault)) {
              setDefaultModelState(savedDefault);
            } else if (list.length > 0) {
              setDefaultModelState(list[0]);
              localStorage.setItem("olly-default-model", list[0]);
            }

            const savedActive = localStorage.getItem("olly-active-model") || "";
            if (savedActive && list.includes(savedActive)) {
              setActiveModelState(savedActive);
            } else if (list.length > 0) {
              setActiveModelState(list[0]);
            }
          }
        }
      } catch (error) {
        console.error("Settings: Failed to load runnable models:", error);
      }
    };

    if (isOpen) {
      fetchRunnable();
    }
  }, [isOpen]);

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

  const handleDefaultModelChange = (val: string) => {
    setDefaultModelState(val);
    localStorage.setItem("olly-default-model", val);
  };

  const handleActiveModelChange = (val: string) => {
    setActiveModelState(val);
    localStorage.setItem("olly-active-model", val);
    // Dispatch custom event to notify useChat hook
    window.dispatchEvent(new Event("olly-active-model-changed"));
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
        className="bg-base-200 text-base-content rounded-2xl border border-base-content/10 w-full max-w-4xl h-[440px] max-h-[90vh] shadow-2xl p-6 overflow-hidden flex flex-col select-none"
      >
        {/* Header: Title is always left-aligned, close button is on the right */}
        <div className="flex items-center justify-between border-b border-base-content/10 pb-4 mb-5 shrink-0">
          <h3 className="text-lg font-bold uppercase tracking-wider text-base-content">
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
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Fixed-height flex wrapper */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          {/* Tabs Navigation: Horizontal scrollable on mobile, vertical sidebar on desktop */}
          <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto md:overflow-x-visible pb-3 md:pb-0 border-b md:border-b-0 md:border-r border-base-content/10 pr-0 md:pr-4 shrink-0 justify-start md:justify-start w-full md:w-36 no-scrollbar h-auto md:h-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-base font-semibold uppercase tracking-wider transition-colors text-center md:text-left whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-base-content/10 text-user-accent"
                    : "text-base-content/60 hover:bg-base-content/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Content Pane: Scrollable internally on overflow */}
          <div className="flex-1 h-full overflow-y-auto pr-1 select-text">
            {activeTab === "apperence" && (
              <div className="flex flex-col gap-1">
                {/* Theme Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Theme:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      Customize the global background theme (Latte, Frappé, Macchiato, Mocha).
                    </span>
                  </div>
                  <select
                    value={activeTheme}
                    onChange={(e) => handleThemeChange(e.target.value)}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    <option value="latte">Latte (Light)</option>
                    <option value="frappe">Frappé (Dark)</option>
                    <option value="macchiato">Macchiato (Dark)</option>
                    <option value="mocha">Mocha (Default Dark)</option>
                  </select>
                </div>

                {/* Accent Selector Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 mt-1">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Accent:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      Select your highlight color preference applied to buttons, borders, and active tabs.
                    </span>
                  </div>
                  <select
                    value={activeAccent}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
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
              <div className="flex flex-col gap-1">
                {/* Default Model Select Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Default Model:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      The model used automatically when starting a new chat session.
                    </span>
                  </div>
                  <select
                    value={defaultModel}
                    onChange={(e) => handleDefaultModelChange(e.target.value)}
                    disabled={runnableModels.length === 0}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    {runnableModels.length === 0 ? (
                      <option value="">No models installed</option>
                    ) : (
                      runnableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Active Model Select Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 mt-1">
                  <div className="flex flex-col text-left gap-0.5 max-w-xs">
                    <span className="text-base font-bold uppercase tracking-wider text-base-content">
                      Active Model:
                    </span>
                    <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
                      The model currently processing responses in this chat thread.
                    </span>
                  </div>
                  <select
                    value={activeModel}
                    onChange={(e) => handleActiveModelChange(e.target.value)}
                    disabled={runnableModels.length === 0}
                    className="select select-bordered select-sm w-full sm:w-48 bg-base-300 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
                  >
                    {runnableModels.length === 0 ? (
                      <option value="">No models installed</option>
                    ) : (
                      runnableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )}

            {activeTab === "database" && (
              <div className="flex flex-col gap-3 py-2 text-left">
                <span className="text-base font-bold uppercase tracking-wider text-base-content">
                  Database History:
                </span>
                <p className="text-base text-base-content/80 italic bg-base-300 p-4 rounded-xl border border-base-content/5">
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
