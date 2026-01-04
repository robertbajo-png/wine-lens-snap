import React from "react";
import { Wine, MapPin, Building2 } from "lucide-react";
import { FieldEvidenceTooltip } from "@/components/result/FieldEvidenceTooltip";
import type { EvidenceItem } from "@/lib/wineCache";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  vin?: string;
  ar?: string;
  producent?: string;
  land_region?: string;
  typ?: string;
  evidenceItems?: EvidenceItem[] | null;
  sourceType?: "label" | "web";
}

export default function ResultHeader({ vin, ar, producent, land_region, typ, evidenceItems, sourceType }: Props) {
  const { t } = useTranslation();
  const hasVin = vin && vin !== "–";
  const hasYear = ar && ar !== "–";
  const hasProducent = producent && producent !== "–";
  const hasRegion = land_region && land_region !== "–";
  const hasTyp = typ && typ !== "–";
  const fallbackSource = sourceType ?? "label";

  return (
    <header className="space-y-3">
      <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
        {hasVin ? vin : t("wineDetail.unknownWine")}
        {hasYear && (
          <span className="ml-2 text-xl font-normal text-muted-foreground">
            {ar}
          </span>
        )}
      </h1>

      {(hasProducent || hasRegion) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {hasProducent && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              <span>{producent}</span>
            </div>
          )}
          {hasProducent && hasRegion && (
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          )}
          {hasRegion && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{land_region}</span>
              <FieldEvidenceTooltip
                field="land_region"
                label={t("resultHeader.region")}
                evidence={evidenceItems}
                fallbackSource={fallbackSource}
              />
            </div>
          )}
        </div>
      )}

      {hasTyp && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Wine className="h-3.5 w-3.5" />
            {typ}
          </span>
          <FieldEvidenceTooltip
            field="typ"
            label={t("resultHeader.style")}
            evidence={evidenceItems}
            fallbackSource={fallbackSource}
          />
        </div>
      )}
    </header>
  );
}
