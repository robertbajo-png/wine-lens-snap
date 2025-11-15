import React from "react";

export default function ResultSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-3/4 rounded bg-theme-elevated" />
      <div className="h-4 w-1/3 rounded bg-theme-elevated" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl border border-theme-card bg-theme-elevated" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-2xl border border-theme-card bg-theme-elevated" />
        <div className="h-28 rounded-2xl border border-theme-card bg-theme-elevated" />
      </div>
    </div>
  );
}

