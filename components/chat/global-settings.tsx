"use client";

import React, { useState, useEffect } from "react";
import { Settings, Download } from "lucide-react";
import SettingsModal from "./settings-modal";
import { applyAccentColor } from "@/lib/accent";

interface PullState {
  percent: number;
  status: string;
}

export default function GlobalSettings() {
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activePulls, setActivePulls] = useState<Record<string, PullState>>({});
  const [completeToast, setCompleteToast] = useState<string | null>(null);

  // Initialize accent color on mount and listen to runtime theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedAccent = localStorage.getItem("olly-accent") || "lavender";
      const activeTheme = document.documentElement.getAttribute("data-theme") || "mocha";
      applyAccentColor(savedAccent, activeTheme);

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

  // Listen to Ollama model download progress events
  useEffect(() => {
    const handlePullStart = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { model } = customEvent.detail;
      setActivePulls((prev) => ({
        ...prev,
        [model]: { percent: 0, status: "Starting..." },
      }));
    };

    const handlePullProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { model, percent, status } = customEvent.detail;
      setActivePulls((prev) => ({
        ...prev,
        [model]: { percent, status },
      }));
    };

    const handlePullComplete = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { model, success } = customEvent.detail;

      setActivePulls((prev) => {
        const next = { ...prev };
        delete next[model];
        return next;
      });

      if (success) {
        setCompleteToast(`Model "${model}" successfully downloaded!`);
      }
    };

    window.addEventListener("olly-pull-start", handlePullStart);
    window.addEventListener("olly-pull-progress", handlePullProgress);
    window.addEventListener("olly-pull-complete", handlePullComplete);

    return () => {
      window.removeEventListener("olly-pull-start", handlePullStart);
      window.removeEventListener("olly-pull-progress", handlePullProgress);
      window.removeEventListener("olly-pull-complete", handlePullComplete);
    };
  }, []);

  // Auto-dismiss the completed download toast after 4 seconds
  useEffect(() => {
    if (completeToast) {
      const timer = setTimeout(() => {
        setCompleteToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [completeToast]);

  const hasActivePulls = Object.keys(activePulls).length > 0;

  return (
    <>
      {/* Pulsing Downloader Notification Icon (Left of settings gear, only visible during pulls) */}
      {hasActivePulls && (
        <div className="fixed top-4 right-16 z-40 dropdown dropdown-end select-none">
          <div
            tabIndex={0}
            role="button"
            className="btn btn-ghost btn-circle text-user-accent animate-pulse relative hover:bg-base-200"
            title="View active model downloads"
          >
            <Download className="w-5 h-5 text-user-accent" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-user-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-user-accent"></span>
            </span>
          </div>
          <div
            tabIndex={0}
            className="dropdown-content card card-compact w-64 p-3.5 shadow-2xl bg-base-200 border border-base-content/10 text-base-content mt-2 rounded-xl"
          >
            <h4 className="font-bold text-xs uppercase tracking-wider mb-2 border-b border-base-content/5 pb-1">
              Active Downloads
            </h4>
            <div className="flex flex-col gap-3">
              {Object.entries(activePulls).map(([name, progress]) => (
                <div key={name} className="flex flex-col gap-1 text-left">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold text-base-content/80">
                    <span className="truncate max-w-40" title={name}>
                      {name}
                    </span>
                    <span>{progress.percent}%</span>
                  </div>
                  <progress
                    className="progress progress-primary w-full h-1.5 rounded-full"
                    value={progress.percent}
                    max="100"
                  ></progress>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[9px] text-base-content/50 italic truncate max-w-[170px]">
                      {progress.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("olly-pull-cancel-request", {
                            detail: { model: name },
                          })
                        );
                      }}
                      className="btn btn-xs btn-ghost hover:bg-error/15 hover:text-error text-base-content/60 rounded-md text-[8.5px] font-bold uppercase h-4 min-h-0 py-0 px-1.5 shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Global Completed Download Toast alert */}
      {completeToast && (
        <div className="toast toast-bottom toast-center z-50 pointer-events-none pb-4 animate-fade-in">
          <div className="alert alert-success shadow-lg text-xs rounded-xl py-2.5 px-5 text-success-content font-sans border-none select-text">
            <span>{completeToast}</span>
          </div>
        </div>
      )}
    </>
  );
}
