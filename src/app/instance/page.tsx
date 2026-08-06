"use client";

import React, { useCallback, useEffect, useState } from "react";

type ViewState =
  | "loading"
  | "unauthorized"
  | "no-instance"
  | "joined-member"
  | "member-active"
  | "admin-dashboard";

type PendingRequest = { id: string; name: string; email: string };
type ActiveUser = { id: string; name: string; role: string };

export default function InstancePage() {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [authMode, setAuthMode] = useState<"join" | "create">("join");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [inviteToken, setInviteToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [instanceLabel, setInstanceLabel] = useState<string | null>(null);
  const [inviteTokenDisplay, setInviteTokenDisplay] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    const state = data.state as ViewState | undefined;
    if (!state) return;

    if (state === "joined-member") {
      const membership = data.membership as { status?: string } | undefined;
      if (membership?.status === "approved") {
        setViewState("member-active");
      } else {
        setViewState("joined-member");
      }
    } else {
      setViewState(state);
    }

    const instance = data.instance as
      | { name?: string; invite_token?: string }
      | undefined;
    setInstanceLabel(instance?.name ?? null);
    setInviteTokenDisplay(instance?.invite_token ?? null);
    setPendingRequests((data.pendingRequests as PendingRequest[]) ?? []);
    setActiveUsers((data.activeUsers as ActiveUser[]) ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/instance");
      const data = (await res.json()) as Record<string, unknown>;
      if (res.status === 401) {
        setViewState("unauthorized");
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load");
        setViewState("no-instance");
        return;
      }
      applyPayload(data);
    } catch {
      setError("Failed to load instance status");
      setViewState("no-instance");
    }
  }, [applyPayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: instanceName }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Create failed");
        return;
      }
      await refresh();
    } catch {
      setError("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instance/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteToken,
          displayName: displayName || undefined,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Join failed");
        return;
      }
      await refresh();
    } catch {
      setError("Join failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCancelRequest = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instance/join", { method: "DELETE" });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Cancel failed");
        return;
      }
      await refresh();
    } catch {
      setError("Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestAction = async (id: string, action: "approve" | "reject") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/instance/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: id, action }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Action failed");
        return;
      }
      await refresh();
    } catch {
      setError("Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen transition-colors duration-200 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
      <header className="border-b pb-4 mb-6 border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight">Shared Instance Management</h1>
        <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
          Configure opt-in decentralized team collaboration environments.
        </p>
      </header>

      <div className="mb-6 p-4 rounded-lg border bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          Local-First & Privacy Notice
        </h4>
        <p className="text-xs mt-1 leading-relaxed opacity-90">
          Sharing is completely opt-in. Single-user standalone installations are never forced through
          instance routing and remain completely private locally. If setting up a shared instance,
          the administrator is responsible for exposing the instance server safely.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {viewState === "loading" && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-sm text-zinc-500">Checking instance status...</span>
        </div>
      )}

      {viewState === "unauthorized" && (
        <div className="p-6 border rounded-xl border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
          <h3 className="font-bold">Sign in required</h3>
          <p className="text-sm mt-1">
            Sign in to create or join a shared instance. Membership is tied to your account.
          </p>
        </div>
      )}

      {viewState === "no-instance" && (
        <div>
          <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 mb-6">
            <button
              onClick={() => setAuthMode("join")}
              className={`pb-2 font-medium text-sm transition-all ${authMode === "join" ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}
            >
              Join Existing Instance
            </button>
            <button
              onClick={() => setAuthMode("create")}
              className={`pb-2 font-medium text-sm transition-all ${authMode === "create" ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}
            >
              Create Admin Setup Flow
            </button>
          </div>

          {authMode === "join" ? (
            <div className="space-y-4 max-w-md p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div>
                <h3 className="text-lg font-medium">Join an Instance</h3>
                <p className="text-xs text-zinc-500">
                  Enter the invite token. Your signed-in account is used for the join request.
                </p>
              </div>
              <input
                type="text"
                placeholder="Invite Token"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
              <button
                onClick={() => void handleJoin()}
                disabled={busy || !inviteToken.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-sm w-full transition-colors"
              >
                Submit Join Request
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-w-md p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div>
                <h3 className="text-lg font-medium">Initialize Shared Instance</h3>
                <p className="text-xs text-zinc-500">
                  Creates a persisted instance and makes you the owner.
                </p>
              </div>
              <input
                type="text"
                placeholder="Instance Name (e.g., Core Engineering)"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
              />
              <button
                onClick={() => void handleCreate()}
                disabled={busy || instanceName.trim().length < 2}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-medium text-sm w-full transition-colors"
              >
                Confirm Setup Flow
              </button>
            </div>
          )}
        </div>
      )}

      {viewState === "joined-member" && (
        <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 text-center max-w-md mx-auto">
          <h3 className="text-xl font-bold">Request Pending</h3>
          <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
            {instanceLabel
              ? `Your request to join “${instanceLabel}” is waiting for admin approval.`
              : "Your request to join has been submitted. Wait for the instance admin to approve your account."}
          </p>
          <button
            onClick={() => void handleCancelRequest()}
            disabled={busy}
            className="mt-4 text-xs text-blue-500 underline disabled:opacity-50"
          >
            Cancel Request
          </button>
        </div>
      )}

      {viewState === "member-active" && (
        <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 text-center max-w-md mx-auto">
          <h3 className="text-xl font-bold">Member</h3>
          <p className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
            You are an approved member
            {instanceLabel ? ` of “${instanceLabel}”` : ""}.
          </p>
        </div>
      )}

      {viewState === "admin-dashboard" && (
        <div className="space-y-4">
          {inviteTokenDisplay && (
            <div className="p-4 border rounded-xl border-zinc-200 dark:border-zinc-800 text-sm">
              <span className="font-medium">Invite token: </span>
              <code className="text-xs break-all">{inviteTokenDisplay}</code>
              {instanceLabel && (
                <span className="ml-2 text-zinc-500">({instanceLabel})</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/10">
              <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
                <span>Pending Join Requests</span>
                <span className="px-2 py-0.5 text-xs bg-zinc-200 dark:bg-zinc-700 rounded-full">
                  {pendingRequests.length}
                </span>
              </h3>

              {pendingRequests.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center">
                  No pending requests found.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{req.name}</p>
                        <p className="text-xs text-zinc-400 font-mono truncate max-w-[180px]">
                          {req.email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleRequestAction(req.id, "approve")}
                          disabled={busy}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void handleRequestAction(req.id, "reject")}
                          disabled={busy}
                          className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50 text-xs font-medium rounded transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/10">
              <h3 className="text-lg font-semibold mb-4">Active User Directory</h3>
              <div className="space-y-3">
                {activeUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 border rounded-lg bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{user.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === "Owner" ? "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-300"}`}
                    >
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
