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
  // Always default to true to match server render, then sync from localStorage after mount
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const handleSetExpanded = (val: boolean) => {
    setIsExpanded(val);
    localStorage.setItem("sidebar_expanded", String(val));
  };

  // Sync from localStorage after mount (client-only, avoids SSR hydration mismatch)
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
