"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export default function DeleteWorkspace({ orgName }: { orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function destroy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/organization", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete the workspace.");
      // The account was deleted along with the org, so the session is now
      // pointing at a user that no longer exists.
      await signOut({ callbackUrl: "/register" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the workspace.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-md">
        <p className="text-body-sm text-on-surface-variant">
          Permanently delete <span className="font-semibold text-on-surface">{orgName}</span> and
          everything in it — campaigns, leads, emails, and all member accounts.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 px-md py-sm border border-error/40 text-error font-mono text-label-sm font-bold rounded-lg hover:bg-error/10 transition-colors"
        >
          Delete workspace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-md">
      <p className="text-body-sm text-on-surface">
        This cannot be undone. Any remaining credit balance is forfeited. Type{" "}
        <span className="font-mono text-error">{orgName}</span> to confirm.
      </p>
      <input
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        placeholder={orgName}
        aria-label="Type the workspace name to confirm"
        className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-error"
      />
      {error && <p className="font-mono text-label-sm text-error">{error}</p>}
      <div className="flex gap-sm">
        <button
          onClick={destroy}
          disabled={loading || confirmName.trim() !== orgName}
          className="px-md py-sm bg-error text-on-error font-mono text-label-sm font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          {loading ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirmName("");
            setError("");
          }}
          className="px-md py-sm border border-outline-variant text-on-surface-variant font-mono text-label-sm rounded-lg hover:border-primary hover:text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
