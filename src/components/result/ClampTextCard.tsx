import React from "react";

type ClampTextCardProps = {
  title: string;
  text?: string;
  lines?: 2 | 3 | 4 | 5 | 6;
};

const clampClassMap: Record<NonNullable<ClampTextCardProps["lines"]>, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export default function ClampTextCard({ title, text, lines = 4 }: ClampTextCardProps) {
  const [open, setOpen] = React.useState(false);

  if (!text || text === "–") return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className={`mt-2 text-sm text-slate-200 ${open ? "" : clampClassMap[lines] ?? clampClassMap[4]}`}>{text}</p>
      <button
        type="button"
        className="mt-2 text-xs text-purple-300 underline transition hover:text-purple-200"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Visa mindre" : "Visa mer"}
      </button>
    </section>
  );
}

