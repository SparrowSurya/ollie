"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { ACCENT_COLORS, AccentKey } from "@/lib/accent";

export default function AppearanceTab() {
  const { theme, accent, setTheme, setAccent } = useSettings();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const themeKey =
    theme === "latte"
      ? "latte"
      : theme === "frappe"
      ? "frappe"
      : theme === "macchiato"
      ? "macchiato"
      : "mocha";

  const selectedAccentObj = ACCENT_COLORS[accent as AccentKey] || ACCENT_COLORS.lavender;
  const selectedHexColor = selectedAccentObj[themeKey];

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
          className="select select-bordered select-sm w-full sm:w-48 bg-base-200 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
        >
          <option value="latte">Latte (Light)</option>
          <option value="frappe">Frappé (Dark)</option>
          <option value="macchiato">Macchiato (Dark)</option>
          <option value="mocha">Mocha (Default Dark)</option>
        </select>
      </div>

      {/* Accent Selector Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 py-3 mt-1">
        <div className="flex flex-col text-left gap-0.5 max-w-xs shrink-0">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Accent:
          </span>
          <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
            Select your highlight color preference applied to borders and active tabs.
          </span>
        </div>

        {/* Custom Dropdown Widget */}
        <div ref={dropdownRef} className="relative w-full sm:w-48">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-base-content/15 text-sm font-sans bg-base-200 hover:bg-base-content/5 transition-all text-left w-full h-9 cursor-pointer focus:outline-hidden"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: selectedHexColor }}
              />
              <span className="truncate">{selectedAccentObj.label}</span>
            </div>
            <span className="text-[8px] opacity-65">▼</span>
          </button>

          {isDropdownOpen && (
            <ul
              className="absolute left-0 mt-1.5 w-full max-h-56 overflow-y-auto p-1 shadow-2xl glass-card rounded-xl text-base-content z-50 border border-base-content/10 flex flex-col gap-0.5 animate-fade-in"
              style={{ backgroundColor: "color-mix(in srgb, var(--color-base-200) 95%, transparent)" }}
            >
              {Object.entries(ACCENT_COLORS).map(([key, color]) => {
                const hex = color[themeKey];
                const isSelected = accent === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setAccent(key);
                        setIsDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left w-full hover:bg-base-content/10 hover:text-base-content font-sanstext-xs cursor-pointer ${
                        isSelected ? "bg-user-accent/15 text-user-accent" : ""
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="truncate">{color.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
