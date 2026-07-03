"use client";

import React from "react";
import { useSettings } from "@/contexts/SettingsContext";

export default function PersonalTab() {
  const { customInstructions, setCustomInstructions } = useSettings();

  return (
    <div className="flex flex-col gap-3.5 py-2 text-left">
      <div className="flex flex-col gap-1">
        <span className="text-base font-bold uppercase tracking-wider text-base-content">
          Custom Instructions:
        </span>
        <span className="text-sm text-base-content/75 leading-relaxed font-sans select-none">
          What would you like Olly to know about you to provide better responses?
          These guidelines are injected automatically as system prompts on every query.
        </span>
      </div>
      <textarea
        value={customInstructions}
        onChange={(e) => setCustomInstructions(e.target.value)}
        placeholder="e.g. You are a senior software engineer. Reply with concise TypeScript code blocks, utilizing ESNext features. Keep prose explanation to a absolute minimum."
        className="textarea textarea-bordered bg-base-300 w-full h-55 text-sm font-sans focus:outline-hidden rounded-xl p-3 border-base-content/15 resize-none leading-relaxed mt-1 select-text"
      />
    </div>
  );
}
