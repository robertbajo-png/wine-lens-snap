import React from "react";
import { Button } from "@/components/ui/button";

export default function ActionBar({ onNewScan }: { onNewScan?: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="flex items-center justify-between rounded-2xl border border-theme-card bg-[hsl(var(--bg-surface)/0.85)] px-4 py-3 shadow-xl backdrop-blur">
          <span className="text-xs text-theme-secondary">Klar med denna?</span>
          <Button
            type="button"
            onClick={onNewScan}
            size="sm"
            aria-label="Starta en ny skanning"
          >
            Fota ny flaska
          </Button>
        </div>
      </div>
    </div>
  );
}
