"use client";

import React from "react";
import { ChatProvider } from "@/contexts/ChatContext";

export default function ChatLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ChatProvider>{children}</ChatProvider>;
}
