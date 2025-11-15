import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { Camera, LogOut } from "lucide-react";

const getDisplayName = (metadata: Record<string, unknown> | undefined, email: string | null) => {
  const candidate =
    typeof metadata?.full_name === "string"
      ? metadata.full_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : typeof metadata?.display_name === "string"
          ? metadata.display_name
          : null;

  if (candidate && candidate.trim().length > 0) {
    return candidate;
  }

  if (email) {
    return email.split("@")[0];
  }

  return "WineSnap-användare";
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
};

const Me = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const email = user?.email ?? (typeof user?.user_metadata?.email === "string" ? user.user_metadata.email : null);
  const displayName = useMemo(
    () => getDisplayName(user?.user_metadata ?? undefined, email),
    [email, user?.user_metadata],
  );
  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to sign out", error);
      toast({
        title: "Kunde inte logga ut",
        description: "Försök igen om en liten stund.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-8">
      <header className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-theme-card bg-theme-elevated">
            <AvatarFallback className="bg-theme-elevated text-xl font-semibold text-theme-primary">
              {initials || "WS"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">{displayName}</h1>
            {email ? <p className="text-sm text-theme-secondary">{email}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
            onClick={() => navigate("/scan")}
            aria-label="Starta ny skanning"
          >
            <Camera className="h-4 w-4" />
            Ny skanning
          </Button>
          <Button
            variant="outline"
            className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
            onClick={() => navigate("/me/wines")}
            aria-label="Visa sparade viner"
          >
            Mina viner
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">Din profil</CardTitle>
            <CardDescription className="text-theme-secondary">
              Här ser du uppgifterna vi använder för att anpassa din upplevelse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-theme-secondary">
            <div>
              <p className="font-medium text-theme-primary">Namn</p>
              <p>{displayName}</p>
            </div>
            {email ? (
              <div>
                <p className="font-medium text-theme-primary">E-post</p>
                <p>{email}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">Hantera konto</CardTitle>
            <CardDescription className="text-theme-secondary">
              Behöver du ändra något? Kontakta supporten eller uppdatera dina uppgifter via Google/Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Logga ut
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Me;
