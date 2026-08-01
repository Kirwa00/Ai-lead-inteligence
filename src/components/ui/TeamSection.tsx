"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Member = { id: string; name: string | null; email: string; role: string; createdAt: string };
type Invite = { id: string; email: string; role: string; createdAt: string; expiresAt: string };

export default function TeamSection({
  members,
  invites,
  isOwner,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyMemberId, setBusyMemberId] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInviteLink("");
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send invite.");
      if (!data.emailSent) setInviteLink(data.inviteUrl);
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invite.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invite? The link will stop working immediately.")) return;
    await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function act(memberId: string, run: () => Promise<Response>, failMsg: string) {
    setBusyMemberId(memberId);
    setError("");
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? failMsg);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : failMsg);
    } finally {
      setBusyMemberId("");
    }
  }

  function removeMember(m: Member) {
    if (!confirm(`Remove ${m.name ?? m.email} from this workspace? They'll lose access immediately.`)) return;
    act(
      m.id,
      () => fetch(`/api/team/members/${m.id}`, { method: "DELETE" }),
      "Could not remove this member."
    );
  }

  function transferOwnership(m: Member) {
    if (
      !confirm(
        `Make ${m.name ?? m.email} the owner of this workspace?\n\nYou'll become a regular member and lose the ability to manage the team or billing.`
      )
    )
      return;
    act(
      m.id,
      () =>
        fetch("/api/team/transfer-ownership", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: m.id }),
        }),
      "Could not transfer ownership."
    );
  }

  return (
    <div className="space-y-lg">
      <div>
        <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mb-sm">
          Members ({members.length})
        </div>
        <div className="divide-y divide-outline-variant border border-outline-variant rounded-xl overflow-hidden">
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            const busy = busyMemberId === m.id;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-sm px-md py-sm bg-surface-container-high"
              >
                <div className="min-w-0">
                  <div className="text-body-sm text-on-surface">
                    {m.name ?? m.email}
                    {isSelf && <span className="text-on-surface-variant"> (you)</span>}
                  </div>
                  <div className="font-mono text-label-sm text-on-surface-variant truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-sm shrink-0">
                  <span className="font-mono text-label-sm text-on-surface-variant capitalize px-sm py-xs rounded border border-outline-variant">
                    {m.role}
                  </span>
                  {isOwner && !isSelf && (
                    <>
                      {m.role !== "owner" && (
                        <button
                          onClick={() => transferOwnership(m)}
                          disabled={busy}
                          className="font-mono text-label-sm text-primary hover:underline disabled:opacity-50"
                          title="Make this person the workspace owner"
                        >
                          Make owner
                        </button>
                      )}
                      <button
                        onClick={() => removeMember(m)}
                        disabled={busy}
                        className="font-mono text-label-sm text-error hover:underline disabled:opacity-50"
                      >
                        {busy ? "Working…" : "Remove"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {invites.length > 0 && (
        <div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mb-sm">
            Pending Invites
          </div>
          <div className="divide-y divide-outline-variant border border-outline-variant rounded-xl overflow-hidden">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-md py-sm bg-surface-container-high">
                <div>
                  <div className="text-body-sm text-on-surface">{inv.email}</div>
                  <div className="font-mono text-label-sm text-on-surface-variant">
                    Invited as {inv.role} · expires {new Date(inv.expiresAt).toISOString().split("T")[0]}
                  </div>
                </div>
                {isOwner && (
                  <button
                    onClick={() => revoke(inv.id)}
                    className="font-mono text-label-sm text-error hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="font-mono text-label-sm text-error">{error}</p>}

      {isOwner ? (
        <form onSubmit={sendInvite} className="space-y-sm">
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
            Invite a teammate
          </div>
          <div className="flex gap-sm flex-wrap">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="flex-1 min-w-[200px] bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send Invite"}
            </button>
          </div>
          {inviteLink && (
            <p className="font-mono text-label-sm text-on-surface-variant break-all">
              Email delivery isn&apos;t configured — share this link directly: <br />
              <span className="text-primary">{inviteLink}</span>
            </p>
          )}
        </form>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Only the workspace owner can invite or remove teammates.
        </p>
      )}
    </div>
  );
}
