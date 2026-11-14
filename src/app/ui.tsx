import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-5 py-8 ${wide ? "max-w-5xl" : "max-w-md"}`}>
      {children}
    </main>
  );
}

export function Mark() {
  return <p className="font-mono text-sm tracking-widest text-accent">0.08</p>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "plain" };

export function Btn({ tone = "plain", className = "", ...rest }: BtnProps) {
  const base =
    "min-h-12 rounded-lg px-4 py-3 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35";
  const look =
    tone === "primary"
      ? "bg-accent text-black active:bg-ink"
      : "border border-line bg-panel text-ink active:border-accent";
  return <button type="button" className={`${base} ${look} ${className}`} {...rest} />;
}

export const linkClass = "text-dim underline underline-offset-4";
