"use client";

import React, { useState, useEffect } from "react";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import Sidebar from "@/components/chat/sidebar";

function ChatLayoutInner({ children }: { children: React.ReactNode }) {
  const {
    sessions,
    activeSessionId,
    switchSession,
    deleteSession,
    renameSession,
    startNewChat,
  } = useChatContext();

  // Sidebar expanded state — owned here so it survives route changes between /chat and /chat/[sessionId]
  // Initialise from localStorage to survive page reloads too
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebar_expanded");
    return stored === null ? true : stored === "true";
  });

  const handleSetExpanded = (val: boolean) => {
    setIsExpanded(val);
    localStorage.setItem("sidebar_expanded", String(val));
  };

  // Hydration guard: sync from localStorage after mount on client
  useEffect(() => {
    const sync = async () => {
      const stored = localStorage.getItem("sidebar_expanded");
      if (stored !== null) {
        setIsExpanded(stored === "true");
      }
    };
    sync();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-base-100 font-sans">
      {/* Thread list sidebar on the left - stays mounted across dynamic page routes */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={switchSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onNewChat={startNewChat}
        isExpanded={isExpanded}
        onSetExpanded={handleSetExpanded}
      />

      {/* Main chat viewport on the right */}
      <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden py-6 relative">
        {children}
      </main>
    </div>
  );
}

export default function ChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ChatProvider>
      <ChatLayoutInner>{children}</ChatLayoutInner>
    </ChatProvider>
  );
}
