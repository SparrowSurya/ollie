"use client";

import React, { useState } from "react";
import { Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import { DbSession } from "@/contexts/ChatContext";

interface SidebarProps {
  sessions: DbSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}: Readonly<SidebarProps>) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleSelect = (id: string) => {
    onSelectSession(id);
    setIsOpen(false); // Close sidebar on mobile after selection
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteSession(id);
    setDeletingId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-40 btn btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
        title="Toggle sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop overlay for mobile screen */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 animate-fade-in"
        ></div>
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-64 bg-base-200 border-r border-base-content/10 flex flex-col h-full transition-transform duration-300 select-none ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header section */}
        <div className="p-4 border-b border-base-content/5 flex items-center justify-between shrink-0">
          <span className="text-base font-bold tracking-wider uppercase text-user-accent">
            Olly Chat History
          </span>
          <button
            onClick={toggleSidebar}
            className="lg:hidden btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Action */}
        <div className="p-3 shrink-0">
          <button
            onClick={() => {
              onNewChat();
              setIsOpen(false);
            }}
            className="btn btn-sm w-full border-user-accent bg-user-accent hover:bg-user-accent/85 hover:border-user-accent/85 text-base-100 flex items-center justify-center gap-1.5 rounded-xl uppercase tracking-wider font-bold text-[11px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-base-content/40 italic">
              No saved conversations
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isConfirmingDelete = deletingId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={`group w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isActive
                        ? "bg-user-accent/10 border-user-accent text-user-accent font-semibold"
                        : "bg-transparent border-transparent hover:bg-base-content/5 text-base-content/85 hover:text-base-content"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                      <span className="text-xs truncate text-left leading-none">
                        {session.title || "New Chat"}
                      </span>
                    </div>

                    {/* Delete controls */}
                    <div className="shrink-0 flex items-center ml-2">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 animate-fade-in select-none">
                          <button
                            onClick={(e) => handleConfirmDelete(e, session.id)}
                            className="btn btn-xs bg-error hover:bg-error/85 border-none text-error-content rounded-md text-[9px] py-0 px-1.5 h-5 min-h-0"
                          >
                            Del
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className="btn btn-xs bg-base-content/10 hover:bg-base-content/15 border-none text-base-content rounded-md text-[9px] py-0 px-1.5 h-5 min-h-0"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleDeleteClick(e, session.id)}
                          className="btn btn-xs btn-ghost text-error opacity-0 group-hover:opacity-100 hover:bg-error/15 rounded-md p-1 h-5 w-5 min-h-0"
                          title="Delete thread"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
