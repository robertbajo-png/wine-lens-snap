import { memo } from "react";
import { Users2, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Creator = Tables<"creators">;

type CreatorCardProps = {
  creator: Creator;
  isFollowing: boolean;
  disabled?: boolean;
  isProcessing?: boolean;
  onToggle: (creatorId: string, nextState: boolean) => void;
};

const numberFormatter = new Intl.NumberFormat("sv-SE");

const getInitials = (displayName: string) =>
  displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "WS";

const CreatorCardComponent = ({
  creator,
  isFollowing,
  disabled = false,
  isProcessing = false,
  onToggle,
}: CreatorCardProps) => {
  const followerCount = numberFormatter.format(creator.followers_count ?? 0);
  const bio = creator.bio?.trim() || "Fler listor och rekommendationer publiceras snart.";

  return (
    <Card className="h-full border-theme-card/70 bg-theme-elevated/80 backdrop-blur">
      <CardContent className="flex h-full flex-col gap-5 p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border border-theme-card/60 bg-theme-card/40 text-theme-primary">
            {creator.avatar_url ? (
              <AvatarImage src={creator.avatar_url} alt={creator.display_name} />
            ) : null}
            <AvatarFallback className="bg-theme-card/60 text-sm font-semibold uppercase tracking-wide text-theme-primary">
              {getInitials(creator.display_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-theme-primary">{creator.display_name}</p>
              <span className="rounded-full bg-theme-card/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.4em] text-theme-secondary/70">
                Kuraterad
              </span>
            </div>
            <div className="flex items-center gap-1 text-sm text-theme-secondary/70">
              <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
              {followerCount} följare
            </div>
          </div>
        </div>

        <p className="flex-1 text-sm leading-relaxed text-theme-secondary/80">{bio}</p>

        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-theme-secondary/60">
          <span>Listor & tips</span>
          <Button
            type="button"
            aria-pressed={isFollowing}
            disabled={disabled || isProcessing}
            onClick={() => onToggle(creator.id, !isFollowing)}
            variant={isFollowing ? "outline" : "default"}
            className={cn(
              "group flex items-center gap-2 rounded-full px-4 py-0 text-sm font-semibold",
              isFollowing
                ? "border-theme-card/60 bg-transparent text-theme-primary hover:bg-theme-card/20"
                : "bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_35px_-18px_rgba(123,63,228,1)]",
            )}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4 transition group-hover:scale-110" aria-hidden="true" />
            )}
            {isFollowing ? "Sluta följ" : "Följ"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const CreatorCard = memo(CreatorCardComponent);
CreatorCard.displayName = "CreatorCard";

export default CreatorCard;
