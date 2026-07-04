import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-base-100 font-sans px-4">
      <div className="bg-base-200 border border-base-content/10 rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center text-center gap-5 select-none">

        {/* 404 Number */}
        <span className="font-mono font-black text-8xl leading-none text-user-accent opacity-90">
          404
        </span>

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-bold uppercase tracking-wider text-base-content">
            Page Not Found
          </h1>
          <p className="text-sm text-base-content/60 leading-relaxed">
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
