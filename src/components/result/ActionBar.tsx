import React from "react";

export default function ActionBar({ onNewScan }: { onNewScan?: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-4xl px-4 pb-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/60 px-4 py-3 shadow-xl backdrop-blur">
          <span className="text-xs text-slate-300">Klar med denna?</span>
          <button
            type="button"
            onClick={onNewScan}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            Fota ny flaska
          </button>
        </div>
      </div>
    </div>
  );
}

