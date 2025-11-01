import React from "react";

export default function ResultSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-3/4 rounded bg-white/10" />
      <div className="h-4 w-1/3 rounded bg-white/10" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />
        <div className="h-28 rounded-2xl border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}

