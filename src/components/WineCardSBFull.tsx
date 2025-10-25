import React from "react";
import { ChevronDown, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type WineData = {
  vin?: string;
  land_region?: string;
  producent?: string;
  druvor?: string;
  årgång?: string;
  typ?: string;
  färgtyp?: string;
  klassificering?: string;
  alkoholhalt?: string;
  volym?: string;
  sockerhalt?: string;
  syra?: string;
  karaktär?: string;
  smak?: string;
  passar_till?: string[];
  servering?: string;
  källa?: string;
  meters?: {
    sötma?: number | null;
    fyllighet?: number | null;
    fruktighet?: number | null;
    fruktsyra?: number | null;
  };
  evidence?: {
    etiketttext?: string;
    webbträffar?: string[];
  };
};

const isNonEmpty = (value?: string | null) => Boolean(value && value.trim().length);

const getDomain = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch (error) {
    return url;
  }
};

export const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  const display = isNonEmpty(value) ? value!.trim() : "–";
  const valueClass = display === "–" ? "text-slate-400" : "text-white";

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">{label}</span>
      <span className={`text-base font-semibold ${valueClass}`}>{display}</span>
    </div>
  );
};

const useClampToggle = (text?: string | null) => {
  const [expanded, setExpanded] = React.useState(false);
  const toggle = React.useCallback(() => setExpanded((prev) => !prev), []);
  const showToggle = isNonEmpty(text) && text!.trim().length > 140;

  return { expanded, toggle, showToggle } as const;
};

export const SectionCard = ({ title, text }: { title: string; text?: string | null }) => {
  const display = isNonEmpty(text) ? text!.trim() : "–";
  const { expanded, toggle, showToggle } = useClampToggle(text);
  const textClass = display === "–" ? "text-slate-400" : "text-slate-200";

  return (
    <section className="rounded-3xl border border-white/10 bg-[#141022] p-6">
      <header className="mb-3 flex items-center gap-2">
        <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{title}</h2>
      </header>
      <p className={`text-sm leading-relaxed ${expanded ? "" : "clamp-3"} ${textClass}`}>{display}</p>
      {showToggle && (
        <button
          type="button"
          onClick={toggle}
          className="mt-3 text-sm font-medium text-sky-300 hover:text-sky-200"
        >
          {expanded ? "Visa mindre" : "Visa mer"}
        </button>
      )}
    </section>
  );
};

const formatGaugeValue = (val: number) => (Number.isInteger(val) ? val.toString() : val.toFixed(1));

const GaugeRing = ({ label, value }: { label: string; value?: number | null }) => {
  const size = 72;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const isValid = typeof value === "number" && Number.isFinite(value);
  const clampedValue = isValid ? Math.min(5, Math.max(0, value ?? 0)) : null;
  const progress = clampedValue !== null ? (clampedValue / 5) * circumference : 0;
  const dashArray = `${progress} ${circumference - progress}`;
  const gaugeLabel = clampedValue === null ? "saknas" : `${formatGaugeValue(clampedValue)} av 5`;
  const valueText = clampedValue === null ? "–" : formatGaugeValue(clampedValue);

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${label}: ${gaugeLabel}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="text-slate-700"
            stroke="currentColor"
            fill="none"
          />
          {clampedValue !== null && (
            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={stroke}
                className="text-[#8B5CF6]"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={dashArray}
              />
            </g>
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
          <span className={clampedValue === null ? "text-slate-500" : "text-white"}>{valueText}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-[0.3em] text-slate-300">{label}</span>
    </div>
  );
};

export const GaugeRingsSB = ({
  meters,
}: {
  meters?: { sötma?: number | null; fyllighet?: number | null; fruktighet?: number | null; fruktsyra?: number | null };
}) => {
  const gaugeConfig: { key: keyof NonNullable<typeof meters>; label: string }[] = [
    { key: "sötma", label: "Sötma" },
    { key: "fyllighet", label: "Fyllighet" },
    { key: "fruktighet", label: "Fruktighet" },
    { key: "fruktsyra", label: "Fruktsyra" },
  ];

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
      {gaugeConfig.map(({ key, label }) => (
        <GaugeRing key={key} label={label} value={meters?.[key] ?? null} />
      ))}
    </div>
  );
};

export const SourceLink = ({ href }: { href: string }) => {
  const domain = getDomain(href);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
    >
      {domain}
      <span aria-hidden="true" className="text-xs text-slate-400">
        ↗︎
      </span>
    </a>
  );
};

export const CollapsibleBlock = ({
  title,
  primarySource,
  otherSources,
  ocrSnippet,
}: {
  title: string;
  primarySource?: string | null;
  otherSources?: string[];
  ocrSnippet?: string | null;
}) => {
  const [open, setOpen] = React.useState(false);
  const [ocrExpanded, setOcrExpanded] = React.useState(false);
  const primary = isNonEmpty(primarySource) ? primarySource!.trim() : "";
  const ocrText = isNonEmpty(ocrSnippet) ? ocrSnippet!.trim() : "";
  const extraSources = Array.isArray(otherSources)
    ? otherSources
        .filter((source): source is string => isNonEmpty(source))
        .map((source) => source.trim())
    : [];
  const hasOtherSources = extraSources.length > 0;
  const hasPrimary = Boolean(primary);
  const hasOcr = Boolean(ocrText);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-3xl border border-white/10 bg-[#141022]"
    >
      <CollapsibleTrigger
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        aria-label={`${open ? "Dölj" : "Visa"} ${title}`}
      >
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">{title}</span>
        <ChevronDown
          className={`h-5 w-5 text-slate-300 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-6 pb-6 pt-2 text-sm text-slate-200">
        <div className="space-y-4">
          {hasPrimary && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Primär källa</p>
              <p className="mt-1 text-sm font-semibold text-white">{primary}</p>
            </div>
          )}

          {hasOtherSources && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Övriga källor</p>
              <ul className="mt-2 space-y-1">
                {extraSources.slice(0, 10).map((href) => (
                  <li key={href}>
                    <SourceLink href={href} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasOcr && (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">OCR-utdrag</p>
              <p
                className={`mt-2 text-[12px] leading-relaxed text-slate-400 ${ocrExpanded ? "" : "clamp-3"}`}
              >
                {ocrText}
              </p>
              {ocrText.length > 140 && (
                <button
                  type="button"
                  onClick={() => setOcrExpanded((prev) => !prev)}
                  className="mt-2 text-xs font-medium text-sky-300 hover:text-sky-200"
                >
                  {ocrExpanded ? "Visa mindre" : "Visa mer"}
                </button>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const formatBadges = (landRegion?: string, vintage?: string) => {
  const badges: string[] = [];

  if (isNonEmpty(landRegion)) {
    const [country, region] = landRegion!.split(",").map((part) => part.trim()).filter(Boolean);
    if (country) badges.push(country);
    if (region) badges.push(region);
  }

  if (isNonEmpty(vintage)) {
    badges.push(`Årgång ${vintage!.trim()}`);
  }

  return badges;
};

const InfoGrid = ({ data }: { data: WineData }) => (
  <div className="rounded-3xl border border-white/10 bg-[#141022] p-6">
    <div className="mb-4 flex items-center gap-2 text-slate-200">
      <span className="text-sm font-semibold uppercase tracking-[0.2em]">Key Facts</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoRow label="Druvor" value={data.druvor} />
      <InfoRow label="Alkoholhalt" value={data.alkoholhalt} />
      <InfoRow label="Volym" value={data.volym} />
      <InfoRow label="Sockerhalt" value={data.sockerhalt} />
      <InfoRow label="Syra" value={data.syra} />
    </div>
  </div>
);

const PairingChips = ({ suggestions }: { suggestions?: string[] }) => {
  const list = Array.isArray(suggestions) ? suggestions.filter(isNonEmpty).slice(0, 5) : [];

  return (
    <div className="rounded-3xl border border-white/10 bg-[#141022] p-6">
      <div className="mb-4 flex items-center gap-2 text-slate-200">
        <span className="text-sm font-semibold uppercase tracking-[0.2em]">Matparning</span>
      </div>
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {list.map((item) => (
            <span
              key={item}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-medium text-white"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">–</p>
      )}
    </div>
  );
};

export default function WineCardSBFull({ data }: { data: WineData }) {
  const title = isNonEmpty(data?.vin) ? data!.vin!.trim() : "–";
  const badges = formatBadges(data?.land_region, data?.årgång);
  const producer = isNonEmpty(data?.producent) ? data!.producent!.trim() : "–";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 text-slate-100">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1C1732] via-[#171129] to-[#100B1B] p-6 shadow-lg shadow-purple-900/20">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {badges.length > 0 ? (
              badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-100"
                >
                  {badge}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                –
              </span>
            )}
          </div>
          <p className="text-sm text-slate-300">{producer}</p>
        </header>
        <div className="mt-6">
          <GaugeRingsSB meters={data?.meters} />
        </div>
      </section>

      <InfoGrid data={data} />

      <SectionCard title="Karaktär" text={data?.karaktär} />
      <SectionCard title="Smak" text={data?.smak} />
      <SectionCard title="Servering" text={data?.servering} />

      <PairingChips suggestions={data?.passar_till} />

      <CollapsibleBlock
        title="Källor & OCR"
        primarySource={data?.källa}
        otherSources={data?.evidence?.webbträffar}
        ocrSnippet={data?.evidence?.etiketttext}
      />
    </div>
  );
}
