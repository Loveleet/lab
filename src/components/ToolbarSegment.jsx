import React from "react";

const TONE_STYLES = {
  cyan: {
    shell: "border-cyan-500/60 bg-gradient-to-br from-cyan-950/70 via-slate-900/90 to-cyan-900/40 shadow-[inset_0_0_24px_rgba(6,182,212,0.06)]",
    label: "text-cyan-300 border-cyan-600/50",
  },
  green: {
    shell: "border-green-500/60 bg-gradient-to-br from-green-950/70 via-slate-900/90 to-green-900/40 shadow-[inset_0_0_24px_rgba(34,197,94,0.06)]",
    label: "text-green-300 border-green-600/50",
  },
  rose: {
    shell: "border-rose-500/60 bg-gradient-to-br from-rose-950/70 via-slate-900/90 to-rose-900/40 shadow-[inset_0_0_24px_rgba(244,63,94,0.06)]",
    label: "text-rose-300 border-rose-600/50",
  },
  purple: {
    shell: "border-purple-500/60 bg-gradient-to-br from-purple-950/70 via-slate-900/90 to-purple-900/40 shadow-[inset_0_0_24px_rgba(168,85,247,0.06)]",
    label: "text-purple-300 border-purple-600/50",
  },
  orange: {
    shell: "border-orange-500/60 bg-gradient-to-br from-orange-950/70 via-slate-900/90 to-orange-900/40 shadow-[inset_0_0_24px_rgba(249,115,22,0.06)]",
    label: "text-orange-300 border-orange-600/50",
  },
  amber: {
    shell: "border-amber-500/60 bg-gradient-to-br from-amber-950/70 via-slate-900/90 to-amber-900/40 shadow-[inset_0_0_24px_rgba(245,158,11,0.08)]",
    label: "text-amber-300 border-amber-600/50",
  },
};

/** Labeled block inside the market toolbar — each group gets its own color. */
export default function ToolbarSegment({
  label,
  children,
  className = "",
  grow = false,
  tone = "cyan",
}) {
  const style = TONE_STYLES[tone] || TONE_STYLES.cyan;

  return (
    <div
      className={`rounded-xl border-2 px-3 py-2.5 ${style.shell} ${
        grow ? "flex-1 min-w-[10rem]" : "shrink-0"
      } ${className}`.trim()}
    >
      {label ? (
        <div
          className={`text-[10px] font-bold uppercase tracking-widest mb-2 pb-1 border-b ${style.label}`}
        >
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}
