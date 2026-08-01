import Link from "next/link";

/** Shared frame for the signed-out pages (login, register, password reset). */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-lg">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-sm mb-2xl justify-center">
          <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
            <span
              className="material-symbols-outlined text-on-primary-container text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
          </div>
          <div>
            <div className="font-bold text-primary text-headline-sm leading-none">A1 Intelligence</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
              Command Center
            </div>
          </div>
        </Link>

        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-2xl ai-glow">
          <h1 className="text-headline-md font-bold text-on-surface mb-xs">{title}</h1>
          {subtitle && <p className="text-body-sm text-on-surface-variant mb-xl">{subtitle}</p>}
          {children}
        </div>

        {footer && (
          <p className="text-center font-mono text-label-sm text-on-surface-variant mt-lg">{footer}</p>
        )}
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant";

export const authButtonClass =
  "w-full bg-primary-container text-on-primary-container py-sm font-mono text-label-md font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-sm active:scale-95 transition-transform hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed";
