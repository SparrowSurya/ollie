"use client";

import React from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { ACCENT_COLORS } from "@/lib/accent";

export default function AppearanceTab() {
  const { theme, accent, setTheme, setAccent } = useSettings();

  return (
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
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="select select-bordered select-sm w-full sm:w-48 bg-base-content/5 backdrop-blur-sm font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
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
            Select your highlight color preference applied to borders and active tabs.
          </span>
        </div>
        <select
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="select select-bordered select-sm w-full sm:w-48 bg-base-content/5 backdrop-blur-sm font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
        >
          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
            <option key={key} value={key}>
              {color.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
