"use client";

import React, { useState, useEffect } from "react";

export default function ChatEmpty() {
  const [greeting, setGreeting] = useState<string>("Hello.");

  // Calculating the time of day during the initial render would cause a Next.js Hydration
  // Mismatch because the server compiling the HTML and the client browser rendering it
  // might be in different timezones or have slightly different system clocks. We must
  // resolve this on the client-side after mount.
  useEffect(() => {
    const hours = new Date().getHours();
    const nickname = typeof window !== "undefined" ? localStorage.getItem("ollie-nickname") : null;
    const nameSuffix = nickname && nickname.trim() ? `, ${nickname.trim()}` : "";
    let timeGreeting = `Hello${nameSuffix}.`;

    if (hours < 12) {
      timeGreeting = `Good morning${nameSuffix}.`;
    } else if (hours < 17) {
      timeGreeting = `Good afternoon${nameSuffix}.`;
    } else {
      timeGreeting = `Good evening${nameSuffix}.`;
    }

    const timer = setTimeout(() => {
      setGreeting(timeGreeting);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 select-none animate-fade-in">
      <h1 className="text-4xl md:text-5xl font-bold text-base-content/90 font-sans tracking-tight">
        {greeting}
      </h1>
    </div>
  );
}
