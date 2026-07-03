"use client";

import React from "react";

export default function DatabaseTab() {
  return (
    <div className="flex flex-col gap-3 py-2 text-left">
      <span className="text-base font-bold uppercase tracking-wider text-base-content">
        Database History:
      </span>
      <p className="text-base text-base-content/80 italic bg-base-300 p-4 rounded-xl border border-base-content/5">
        Currently running: SQLite (No active sessions saved)
      </p>
    </div>
  );
}
