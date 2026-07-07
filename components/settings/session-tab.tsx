"use client";

import React from "react";
import { useOllama } from "@/contexts/OllamaContext";
import { useSettings } from "@/contexts/SettingsContext";

export default function SessionTab() {
  const { activeModel, setActiveModel, runnableModels } = useOllama();
  const { customInstructions, setCustomInstructions } = useSettings();

  return (
    <div className="flex flex-col gap-1 pb-4">
      {/* Active Model Select Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
        <div className="flex flex-col text-left gap-0.5 max-w-xs shrink-0">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Active Model:
          </span>
          <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
            The model currently processing responses in this chat thread.
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            disabled={runnableModels.length === 0}
            className="select select-bordered select-sm w-full sm:w-48 bg-base-200 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
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
          {runnableModels.length === 0 && (
            <span className="text-[10px] text-error/85 font-mono italic text-right leading-tight max-w-48 select-none">
              No models are installed.
            </span>
          )}
        </div>
      </div>

      {/* Custom Instructions Row */}
      <div className="flex flex-col gap-2 py-3 text-left">
        <div className="flex flex-col gap-1 select-none">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Custom Instructions:
          </span>
          <span className="text-sm text-base-content/75 leading-relaxed font-sans select-none">
            What would you like Ollie to know about this session to provide better responses?
            These guidelines are injected automatically as system prompts on every query in this chat.
          </span>
          <span className="text-xs text-user-accent font-bold mt-1 select-none italic block">
            Note: You only see and edit the instructions for the current chat session.
          </span>
        </div>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="e.g. You are a senior software engineer. Reply with concise TypeScript code blocks, utilizing ESNext features. Keep prose explanation to an absolute minimum."
          className="textarea textarea-bordered bg-base-content/5 backdrop-blur-sm w-full h-44 text-sm font-sans focus:outline-hidden rounded-xl p-3 border-base-content/15 resize-none leading-relaxed mt-1 select-text"
        />
      </div>
    </div>
  );
}
