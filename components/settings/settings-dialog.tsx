"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import AppearanceTab from "./appearance-tab";
import ModelManagerTab from "./model-manager-tab";
import PersonalTab from "./personal-tab";

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "apperence" | "model" | "personal";

export default function SettingsDialog({ isOpen, onClose }: Readonly<SettingsDialogProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("model");
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Listen to Escape key to close modal
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "apperence", label: "Apperence" },
    { id: "model", label: "Model" },
    { id: "personal", label: "Personal" },
  ];

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
    >
      <div
        ref={modalRef}
        className="glass-card text-base-content rounded-2xl w-full max-w-4xl h-110 max-h-[90vh] shadow-2xl p-6 overflow-hidden flex flex-col select-none relative"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-base-200) 80%, transparent)" }}
      >
        {/* Header: Title is always left-aligned, close button is on the right */}
        <div className="flex items-center justify-between border-b border-base-content/10 pb-4 mb-5 shrink-0">
          <h3 className="text-lg font-bold uppercase tracking-wider text-base-content">
            {activeTab === "apperence"
              ? "Appearance Settings"
              : activeTab === "model"
              ? "Model Settings"
              : "Personal Settings"}
          </h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-content/10 focus:outline-hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content: Split Pane */}
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Left Navigation Bar */}
          <div className="w-40 shrink-0 flex flex-col border-r border-base-content/10 pr-4 select-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-3 text-left text-base rounded-xl font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab.id
                    ? "bg-user-accent/10 text-user-accent border-l-3 border-user-accent pl-2.5"
                    : "text-base-content/65 hover:text-base-content hover:bg-base-content/5"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right Content Pane: Scrollable internally on overflow */}
          <div className="flex-1 h-full overflow-y-auto pr-1 select-text">
            {activeTab === "apperence" && <AppearanceTab />}
            {activeTab === "model" && <ModelManagerTab />}
            {activeTab === "personal" && <PersonalTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
