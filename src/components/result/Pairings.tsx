import React from "react";
import { Utensils, Beef, Fish, Salad, Cake, CircleDot } from "lucide-react";

const foodIcons: Record<string, React.ElementType> = {
  kött: Beef,
  biff: Beef,
  nöt: Beef,
  lamm: Beef,
  vilt: Beef,
  fisk: Fish,
  skaldjur: Fish,
  räkor: Fish,
  hummer: Fish,
  lax: Fish,
  sallad: Salad,
  grönsaker: Salad,
  vegetariskt: Salad,
  dessert: Cake,
  choklad: Cake,
  ost: CircleDot,
};

function getIconForFood(food: string): React.ElementType {
  const lower = food.toLowerCase();
  for (const [keyword, icon] of Object.entries(foodIcons)) {
    if (lower.includes(keyword)) return icon;
  }
  return Utensils;
}

export default function Pairings({ items }: { items?: string[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const chips = items.filter(Boolean).slice(0, 8);
  if (chips.length === 0) return null;

  return (
    <section className="rounded-2xl border border-theme-card bg-gradient-to-br from-theme-elevated via-theme-elevated/90 to-theme-elevated/70 p-4 animate-fade-in">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
          <Utensils className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-theme-primary">Passar till</h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {chips.map((item, index) => {
          const Icon = getIconForFood(item);
          return (
            <span
              key={`${item}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-theme-card bg-theme-elevated px-3 py-1.5 text-xs font-medium text-theme-primary transition-all duration-200 hover:border-accent-primary/30 hover:bg-accent-primary/5 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Icon className="h-3 w-3 text-accent-primary" />
              {item}
            </span>
          );
        })}
      </div>
    </section>
  );
}

