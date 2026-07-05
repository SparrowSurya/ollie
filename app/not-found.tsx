import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center font-sans px-4 relative z-10">
      <div className="glass-card rounded-2xl shadow-2xl px-8 py-10 sm:px-12 sm:py-14 w-full max-w-sm sm:max-w-md flex flex-col items-center text-center gap-6 select-none animate-fade-in">

        {/* 404 with animated glow halo */}
        <div className="relative flex items-center justify-center">
          {/* Animated ambient glow behind number */}
          <div
            className="absolute w-44 h-44 sm:w-52 sm:h-52 rounded-full"
            style={{
              background: `radial-gradient(circle, var(--user-accent) 0%, transparent 70%)`,
              filter: "blur(28px)",
              opacity: 0.45,
              animation: "pulse-glow 4s ease-in-out infinite",
            }}
          />
          {/* Thin accent ring */}
          <div
            className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border opacity-20"
            style={{ borderColor: "var(--user-accent)" }}
          />
          {/* 404 Number */}
          <span
            className="relative font-mono font-black leading-none text-[5.5rem] sm:text-[7rem]"
            style={{
              background: "linear-gradient(135deg, var(--user-accent) 0%, #a5b4fc 60%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </span>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold uppercase tracking-wider text-base-content">
            Page Not Found
          </h1>
          <p className="text-sm text-base-content/55 leading-relaxed max-w-xs mx-auto">
            The route you&apos;re looking for doesn&apos;t exist or was moved.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full mt-1">
          <Link
            href="/chat"
            className="btn btn-sm w-full sm:flex-1 uppercase tracking-wider font-bold text-[11px] bg-user-accent border-user-accent text-base-100 hover:opacity-90"
          >
            Go to Chat
          </Link>
          <Link
            href="/"
            className="btn btn-sm btn-outline w-full sm:flex-1 uppercase tracking-wider font-bold text-[11px] border-user-accent/50 text-user-accent hover:bg-user-accent hover:border-user-accent hover:text-base-100"
          >
            Go Home
          </Link>
        </div>

      </div>
    </main>
  );
}
