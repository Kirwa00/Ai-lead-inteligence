"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant";
const labelClass = "font-mono text-label-sm text-on-surface-variant uppercase tracking-widest";
const btnPrimary =
  "px-lg py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";

function Status({ ok, msg }: { ok: boolean; msg: string }) {
  if (!msg) return null;
  return (
    <p className={`flex items-center gap-xs font-mono text-label-sm ${ok ? "text-primary" : "text-error"}`}>
      <span className="material-symbols-outlined text-body-sm">{ok ? "check_circle" : "error"}</span>
      {msg}
    </p>
  );
}

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string }>({ ok: true, msg: "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus({ ok: true, msg: "" });
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update.");
      setStatus({ ok: true, msg: "Profile updated." });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Could not update." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-md">
      <div className="space-y-xs">
        <label className={labelClass}>Full name</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="flex items-center justify-between">
        <Status ok={status.ok} msg={status.msg} />
        <button type="submit" disabled={loading || !name.trim()} className={btnPrimary}>
          {loading ? "Saving…" : "Save name"}
        </button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string }>({ ok: true, msg: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ ok: true, msg: "" });
    if (next.length < 8) return setStatus({ ok: false, msg: "New password must be at least 8 characters." });
    if (next !== confirm) return setStatus({ ok: false, msg: "New passwords do not match." });
    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not change password.");
      setStatus({ ok: true, msg: "Password changed." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Could not change password." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-md">
      <div className="space-y-xs">
        <label className={labelClass}>Current password</label>
        <input type="password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </div>
      <div className="space-y-xs">
        <label className={labelClass}>New password</label>
        <input type="password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />
      </div>
      <div className="space-y-xs">
        <label className={labelClass}>Confirm new password</label>
        <input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </div>
      <div className="flex items-center justify-between">
        <Status ok={status.ok} msg={status.msg} />
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Updating…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
