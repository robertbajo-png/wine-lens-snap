import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useLocalSetting } from "@/hooks/useLocalSetting";
import { applyThemeByName, type ThemeName } from "@/ui/theme";
import { trackEvent } from "@/lib/telemetry";

const MOCK_NAME = "Alex Vinälskare";
const MOCK_EMAIL = "alex.vinalskare@example.com";

const languages = [
  { value: "sv", label: "Svenska" },
  { value: "en", label: "English" },
] as const;

type LanguageValue = (typeof languages)[number]["value"];

const Profile = () => {
  const navigate = useNavigate();
  const [language, setLanguage] = useLocalSetting<LanguageValue>("winesnap.language", "sv");
  const [theme, setTheme] = useLocalSetting<ThemeName>("winesnap.theme", "dark");
  const [notificationsEnabled, setNotificationsEnabled] = useLocalSetting<boolean>(
    "winesnap.notifications",
    true,
  );
  const openLoggedRef = useRef(false);

  useEffect(() => {
    applyThemeByName(theme);
  }, [theme]);

  useEffect(() => {
    if (openLoggedRef.current) {
      return;
    }

    trackEvent("profile_open", {
      language,
      theme,
      notificationsEnabled,
    });
    openLoggedRef.current = true;
  }, [language, notificationsEnabled, theme]);

  const initials = useMemo(() => {
    return MOCK_NAME
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-12 sm:px-8">
      <header className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-theme-card bg-theme-elevated">
            <AvatarFallback className="bg-theme-elevated text-xl font-semibold text-theme-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">{MOCK_NAME}</h1>
            <p className="text-sm text-theme-secondary">{MOCK_EMAIL}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
            onClick={() => navigate("/me/wines")}
            aria-label="Visa sparade viner"
          >
            Mina viner
          </Button>
          <Button
            variant="ghost"
            className="text-theme-secondary underline-offset-4 hover:text-theme-primary hover:underline"
            onClick={() => navigate("/om")}
            aria-label="Läs mer om WineSnap"
          >
            Om WineSnap
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">Inställningar</CardTitle>
            <CardDescription className="text-theme-secondary">
              Justera språk, tema och aviseringar för din upplevelse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-theme-primary">Språk</Label>
                <p className="text-sm text-theme-secondary">Välj språk för gränssnittet.</p>
              </div>
              <Select value={language} onValueChange={(value) => setLanguage(value as LanguageValue)}>
                <SelectTrigger className="w-full min-w-[160px] border-theme-card bg-theme-surface text-theme-primary sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-theme-card bg-theme-elevated text-theme-primary">
                  {languages.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-theme-card/60" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-theme-primary">Mörkt läge</Label>
                <p className="text-sm text-theme-secondary">
                  Växla mellan WineSnaps natt- och dagläge.
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>

            <Separator className="bg-theme-card/60" />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-theme-primary">Pushnotiser</Label>
                <p className="text-sm text-theme-secondary">
                  Få pingar när nya vintips eller sparade etiketter finns.
                </p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(checked) => setNotificationsEnabled(checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">Dataskydd</CardTitle>
            <CardDescription className="text-theme-secondary">
              Hantera hur WineSnap tar hand om dina uppgifter.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1 border-theme-card bg-theme-surface text-theme-primary hover:bg-theme-surface/80"
                >
                  Exportera data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-theme-card bg-theme-elevated text-theme-primary">
                <AlertDialogHeader>
                  <AlertDialogTitle>Exportera dina data</AlertDialogTitle>
                  <AlertDialogDescription className="text-theme-secondary">
                    Snart kan du ladda ned en komplett export av din vinsamling. Under tiden sparas
                    inställningen lokalt hos dig.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-theme-card bg-theme-surface text-theme-primary hover:bg-theme-surface/80">
                    Stäng
                  </AlertDialogCancel>
                  <AlertDialogAction disabled className="bg-theme-accent text-white opacity-70">
                    Starta export
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  Radera konto
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-theme-card bg-theme-elevated text-theme-primary">
                <AlertDialogHeader>
                  <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                  <AlertDialogDescription className="text-theme-secondary">
                    Detta är en mockfunktion – men när den väl finns raderar vi allt från våra servrar.
                    Bekräfta bara om du verkligen vill fortsätta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-theme-card bg-theme-surface text-theme-primary hover:bg-theme-surface/80">
                    Avbryt
                  </AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
                    Radera ändå
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-theme-primary">Kontrollera kontot</CardTitle>
            <CardDescription className="text-theme-secondary">
              Snabba genvägar till de viktigaste delarna av ditt konto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-theme-card bg-theme-surface text-theme-primary hover:bg-theme-surface/80"
              onClick={() => navigate("/me/wines")}
            >
              Gå till historik
            </Button>
            <Button
              variant="ghost"
              className="text-theme-secondary underline-offset-4 hover:text-theme-primary hover:underline"
              onClick={() => navigate("/om")}
            >
              Om WineSnap
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="ghost" className="text-theme-secondary hover:text-theme-primary">
            Logga ut
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
