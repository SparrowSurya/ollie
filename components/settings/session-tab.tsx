"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Trash2, Pencil } from "lucide-react";
import { useOllama } from "@/contexts/OllamaContext";
import { useSettings } from "@/contexts/SettingsContext";

interface McpServerInfo {
  id: string;
  name: string;
  url: string;
}

export default function SessionTab() {
  const params = useParams();
  const sessionId = params?.sessionId as string | undefined;

  const { activeModel, setActiveModel, runnableModels, disabledModels } = useOllama();
  const { customInstructions, setCustomInstructions } = useSettings();

  const [mcpServers, setMcpServers] = useState<McpServerInfo[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editServerName, setEditServerName] = useState("");
  const [editServerUrl, setEditServerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMcpServers = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/mcp?sessionId=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data.servers || []);
      }
    } catch (e) {
      console.error("Failed to fetch MCP servers:", e);
    }
  };

  useEffect(() => {
    let active = true;
    if (!sessionId) return;

    const loadMcpServers = async () => {
      try {
        const res = await fetch(`/api/sessions/mcp?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok && active) {
          const data = await res.json();
          setMcpServers(data.servers || []);
        }
      } catch (e) {
        console.error("Failed to fetch MCP servers:", e);
      }
    };

    loadMcpServers();

    return () => {
      active = false;
    };
  }, [sessionId]);

  const handleAddMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;

    const name = newServerName.trim();
    const url = newServerUrl.trim();

    if (!name || !url) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/sessions/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, name, url }),
      });

      if (res.ok) {
        setNewServerName("");
        setNewServerUrl("");
        await fetchMcpServers();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to add MCP server");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add MCP server");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMcpServer = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/mcp?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchMcpServers();
      }
    } catch (e) {
      console.error("Failed to delete MCP server:", e);
    }
  };

  const handleEditMcpServer = async (id: string) => {
    const name = editServerName.trim();
    const url = editServerUrl.trim();
    if (!name || !url) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/sessions/mcp", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, name, url }),
      });

      if (res.ok) {
        setEditingServerId(null);
        await fetchMcpServers();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update MCP server");
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update MCP server");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (srv: McpServerInfo) => {
    setEditingServerId(srv.id);
    setEditServerName(srv.name);
    setEditServerUrl(srv.url);
  };

  return (
    <div className="flex flex-col gap-1 pb-4">
      {/* Active Model Select Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 py-3 border-b border-base-content/5">
        <div className="flex flex-col text-left gap-0.5 max-w-xs shrink-0">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Active Model:
          </span>
          <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
            The model currently processing responses in this chat thread.
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
          <select
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
            disabled={runnableModels.length === 0}
            className="select select-bordered select-sm w-full sm:w-48 bg-base-200 font-sans cursor-pointer focus:outline-hidden text-base h-9 px-3"
          >
            {runnableModels.length === 0 ? (
              <option value="" className="bg-base-200 text-base-content">No models installed</option>
            ) : (
              runnableModels.map((m) => {
                const isDisabled = disabledModels?.includes(m);
                const isRemote = m.includes("/");
                const [provider, rawName] = isRemote ? m.split("/") : ["ollama", m];
                const displayName = isRemote ? `${rawName.replace(/-/g, " ").toUpperCase()} (${provider.toUpperCase()})` : m;

                return (
                  <option key={m} value={m} disabled={isDisabled} className="bg-base-200 text-base-content">
                    {displayName} {isDisabled ? " (API Key Missing)" : ""}
                  </option>
                );
              })
            )}
          </select>
          {runnableModels.length === 0 && (
            <span className="text-[10px] text-error/85 font-mono italic text-right leading-tight max-w-48 select-none">
              No models are installed.
            </span>
          )}
        </div>
      </div>

      {/* MCP Servers Config Row */}
      <div className="flex flex-col gap-3 py-3 border-b border-base-content/5">
        <div className="flex flex-col text-left gap-0.5">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            MCP Servers (SSE):
          </span>
          <span className="text-sm text-base-content/80 leading-relaxed font-sans select-none">
            Connect Model Context Protocol (MCP) servers to enable additional external tools.
          </span>
        </div>

        {!sessionId ? (
          <span className="text-xs text-base-content/40 italic py-2 text-left">
            Please select or start a chat session to configure MCP servers.
          </span>
        ) : (
          <div className="flex flex-col gap-3 mt-1 text-left">
            {/* List of current servers */}
            {mcpServers.length > 0 && (
              <div className="flex flex-col gap-2 max-w-xl">
                {mcpServers.map((srv) => {
                  const isEditing = editingServerId === srv.id;
                  return (
                    <div
                      key={srv.id}
                      className="flex flex-col p-2 px-3 bg-base-content/5 backdrop-blur-xs rounded-xl border border-base-content/5 gap-2"
                    >
                      {!isEditing ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col min-w-0 select-all font-sans">
                            <span className="text-xs font-bold text-base-content truncate">
                              {srv.name}
                            </span>
                            <span className="text-[10px] text-base-content/65 font-mono truncate">
                              {srv.url}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 select-none">
                            <button
                              type="button"
                              onClick={() => startEditing(srv)}
                              className="btn btn-xs btn-ghost text-base-content/60 hover:text-user-accent hover:bg-user-accent/10 rounded-full p-1 h-6 w-6 min-h-0 shrink-0"
                              title="Edit MCP Server"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMcpServer(srv.id)}
                              className="btn btn-xs btn-ghost text-error hover:bg-error/15 hover:text-error rounded-full p-1 h-6 w-6 min-h-0 shrink-0"
                              title="Delete MCP Server"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 p-1 bg-base-100/50 rounded-lg">
                          <input
                            type="text"
                            value={editServerName}
                            onChange={(e) => setEditServerName(e.target.value)}
                            placeholder="Edit name..."
                            required
                            className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                          />
                          <input
                            type="url"
                            value={editServerUrl}
                            onChange={(e) => setEditServerUrl(e.target.value)}
                            placeholder="Edit URL..."
                            required
                            className="input input-bordered input-xs bg-base-200 w-full text-xs font-sans rounded-md px-2 h-7"
                          />
                          <div className="flex justify-end gap-1.5 mt-0.5 select-none">
                            <button
                              type="button"
                              onClick={() => setEditingServerId(null)}
                              className="btn btn-xs btn-ghost text-base-content/60 px-2 text-[10px] uppercase font-bold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditMcpServer(srv.id)}
                              disabled={loading || !editServerName.trim() || !editServerUrl.trim()}
                              className="btn btn-xs bg-user-accent hover:bg-user-accent/85 border-none text-base-100 px-2.5 text-[10px] uppercase font-bold"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Form to add a new server */}
            <form onSubmit={handleAddMcpServer} className="flex flex-col gap-2.5 max-w-xl border border-base-content/10 rounded-xl p-3 bg-base-content/5">
              <span className="text-xs font-bold text-base-content select-none">
                Add New Server
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g. Github Tools"
                  required
                  className="input input-bordered input-sm bg-base-200 w-full text-xs font-sans rounded-lg"
                />
                <input
                  type="url"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="e.g. http://localhost:3001/sse"
                  required
                  className="input input-bordered input-sm bg-base-200 w-full text-xs font-sans rounded-lg"
                />
              </div>
              {errorMsg && (
                <span className="text-[10px] text-error font-mono leading-none">
                  {errorMsg}
                </span>
              )}
              <div className="flex justify-end mt-1 select-none">
                <button
                  type="submit"
                  disabled={loading || !newServerName || !newServerUrl}
                  className="btn btn-xs border-user-accent/40 text-user-accent hover:bg-user-accent/15 hover:border-user-accent bg-transparent rounded-full px-3 text-[10px] font-bold uppercase h-6 min-h-0 cursor-pointer"
                >
                  {loading ? "Adding..." : "Add Server"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Custom Instructions Row */}
      <div className="flex flex-col gap-2 py-3 text-left">
        <div className="flex flex-col gap-1 select-none">
          <span className="text-base font-bold uppercase tracking-wider text-base-content">
            Custom Instructions:
          </span>
          <span className="text-sm text-base-content/75 leading-relaxed font-sans select-none">
            What would you like Ollie to know about this session to provide better responses?
            These guidelines are injected automatically as system prompts on every query in this chat.
          </span>
          <span className="text-xs text-user-accent font-bold mt-1 select-none italic block">
            Note: You only see and edit the instructions for the current chat session.
          </span>
        </div>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Adidtional behaviour, style and tone preferences."
          className="textarea textarea-bordered bg-base-content/5 backdrop-blur-sm w-full h-44 text-sm font-sans focus:outline-hidden rounded-xl p-3 border-base-content/15 resize-none leading-relaxed mt-1 select-text"
        />
      </div>
    </div>
  );
}
