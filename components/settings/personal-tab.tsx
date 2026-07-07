"use client";

import React, { useState } from "react";

export default function PersonalTab() {
  const [nickname, setNicknameState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ollie-nickname") || "";
    }
    return "";
  });

  const [aboutMe, setAboutMeState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ollie-about-me") || "";
    }
    return "";
  });

  const handleNicknameChange = (val: string) => {
    setNicknameState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ollie-nickname", val);
    }
  };

  const handleAboutMeChange = (val: string) => {
    setAboutMeState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ollie-about-me", val);
    }
  };

  return (
    <div className="flex flex-col gap-5 py-2 text-left">
      {/* Nickname Section */}
      <div className="flex flex-col gap-2 pb-4 border-b border-base-content/5">
        <div className="flex flex-col gap-0.5 select-none">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Nickname:
          </span>
          <span className="text-sm text-base-content/75 leading-relaxed font-sans">
            The model will refer to you with this name.
          </span>
        </div>
        <input
          type="text"
          value={nickname}
          onChange={(e) => handleNicknameChange(e.target.value)}
          placeholder="e.g. Alex"
          className="input input-bordered bg-base-content/5 backdrop-blur-sm w-full max-w-md text-sm font-sans focus:outline-hidden rounded-xl px-3 py-2 border-base-content/15 select-text h-9 leading-none"
        />
      </div>

      {/* About Me Section */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5 select-none">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            About me:
          </span>
          <span className="text-sm text-base-content/75 leading-relaxed font-sans">
            Details about yourself that you want to provide to the model.
          </span>
        </div>
        <textarea
          value={aboutMe}
          onChange={(e) => handleAboutMeChange(e.target.value)}
          placeholder="e.g. I am a web developer specializing in Next.js and TypeScript. I prefer modular architectures and clean style conventions."
          className="textarea textarea-bordered bg-base-content/5 backdrop-blur-sm w-full h-44 text-sm font-sans focus:outline-hidden rounded-xl p-3 border-base-content/15 resize-none leading-relaxed mt-1 select-text"
        />
      </div>
    </div>
  );
}
