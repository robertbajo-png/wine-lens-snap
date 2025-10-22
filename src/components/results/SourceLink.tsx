import { cn } from "@/lib/utils";

interface SourceLinkProps {
  href?: string | null;
  label?: string | null;
  className?: string;
}

function extractDomain(input: string): string {
  try {
    const url = new URL(input);
    return url.hostname.replace(/^www\./, "");
  } catch (error) {
    return input.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function SourceLink({ href, label, className }: SourceLinkProps) {
  if (!href) {
    return <span className="text-sm text-slate-400">–</span>;
  }

  const display = extractDomain(label && label.trim() ? label : href);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium text-white hover:text-purple-200",
        className
      )}
    >
      <span>{display}</span>
      <span aria-hidden="true" className="text-xs text-slate-300">
        ↗︎
      </span>
    </a>
  );
}
