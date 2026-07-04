"use client";

import React, { useState, useEffect } from "react";
import { Plus, Menu, X, MoreVertical } from "lucide-react";
import { DbSession } from "@/contexts/ChatContext";

interface SidebarProps {
  sessions: DbSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onNewChat: () => void;
  isExpanded: boolean;
  onSetExpanded: (val: boolean) => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onNewChat,
  isExpanded,
  onSetExpanded,
}: Readonly<SidebarProps>) {
  // Mobile drawer overlay backdrop open state (defaults to closed)
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Inline rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const handleSelect = (id: string) => {
    onSelectSession(id);
    setIsMobileOpen(false); // Close mobile drawer overlay on selection
  };

  const handleRenameClick = (e: React.MouseEvent, session: DbSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title || "New Chat");
    
    // Close active dropdown
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      saveRename(id);
    } else if (e.key === "Escape") {
      setEditingSessionId(null);
    }
  };

  const saveRename = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed !== "") {
      onRenameSession(id, trimmed);
    }
    setEditingSessionId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteSession(id);
    
    // Close active dropdown
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Sync mobile drawer state with window sizing
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Floating Toggle Button (visible when sidebar is collapsed/closed on either screen width) */}
      {(!isExpanded || isMobileOpen) ? (
        <button
          onClick={() => {
            if (window.innerWidth >= 1024) {
              onSetExpanded(true);
            } else {
              setIsMobileOpen(true);
            }
          }}
          className="fixed top-4 left-4 z-40 btn btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
          title="Expand sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      ) : (
        /* Expand button visible only on mobile when drawer is closed */
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-40 btn btn-ghost btn-circle text-base-content/60 hover:text-base-content hover:bg-base-200"
          title="Expand sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Backdrop overlay for mobile screen drawer */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-40 animate-fade-in"
        ></div>
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 bg-base-200 border-r border-base-content/10 flex flex-col h-full transition-all duration-300 select-none ${
          isMobileOpen 
            ? "w-64 translate-x-0" 
            : isExpanded 
              ? "w-64 translate-x-0 lg:translate-x-0" 
              : "w-0 -translate-x-full lg:translate-x-0 lg:w-0 overflow-hidden"
        }`}
      >
        {/* Header section (collapse button) */}
        <div className="p-4 border-b border-base-content/5 flex items-center justify-end shrink-0 h-14">
          <button
            onClick={() => {
              if (window.innerWidth >= 1024) {
                onSetExpanded(false);
              } else {
                setIsMobileOpen(false);
              }
            }}
            className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content"
            title="Collapse sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Action (Outlined Button) */}
        <div className="p-3 shrink-0">
          <button
            onClick={() => {
              onNewChat();
              setIsMobileOpen(false);
            }}
            className="btn btn-sm btn-outline border-user-accent/50 text-user-accent hover:bg-user-accent hover:border-user-accent hover:text-base-100 w-full flex items-center justify-center gap-1.5 rounded-xl uppercase tracking-wider font-bold text-[11px]"
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
                const isEditing = editingSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => !isEditing && handleSelect(session.id)}
                    className={`group w-full flex items-center justify-between p-2 rounded-xl border border-transparent transition-all cursor-pointer h-10 ${
                      isActive
                        ? "text-user-accent font-bold"
                        : "hover:bg-base-content/5 text-base-content/85 hover:text-base-content"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                          onBlur={() => saveRename(session.id)}
                          autoFocus
                          className="input input-xs input-bordered w-full text-xs bg-base-300 border-user-accent/30 focus:border-user-accent focus:outline-hidden h-7 px-2 font-sans"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-xs truncate text-left leading-none">
                          {session.title || "New Chat"}
                        </span>
                      )}
                    </div>

                    {/* 3-dots Dropdown Option Menu */}
                    {!isEditing && (
                      <div 
                        className="dropdown dropdown-bottom dropdown-end shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          tabIndex={0}
                          role="button"
                          className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content m-0 h-6 w-6 min-h-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </div>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-1.5 shadow-lg bg-base-300 border border-base-content/10 rounded-xl w-28 text-sm font-sans font-semibold text-base-content/85 z-50 mt-1"
                        >
                          <li>
                            <button
                              type="button"
                              onClick={(e) => handleRenameClick(e, session)}
                              className="px-3 py-2 rounded-lg text-left w-full hover:bg-base-content/10 hover:text-base-content"
                            >
                              Rename
                            </button>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(e, session.id)}
                              className="px-3 py-2 rounded-lg text-left w-full text-error hover:bg-error/15 hover:text-error"
                            >
                              Delete
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}
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
