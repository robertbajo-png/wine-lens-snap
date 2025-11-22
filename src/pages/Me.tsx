import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { WineListsSection } from "@/components/profile/WineListsSection";
import { useTheme } from "@/ui/ThemeProvider";
import type { ThemePreference } from "@/ui/theme";
import { Camera, Laptop, Loader2, LogOut, Moon, PenLine, SunMedium, UploadCloud } from "lucide-react";

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
  const { themePreference, setThemePreference } = useTheme();
  const [profile, setProfile] = useState<{ displayName: string | null; avatarUrl: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formNameError, setFormNameError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

  const email = user?.email ?? (typeof user?.user_metadata?.email === "string" ? user.user_metadata.email : null);
  const metadataAvatarUrl =
    typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url.trim().length > 0
      ? user.user_metadata.avatar_url
      : null;

  const displayName = useMemo(() => {
    const profileName = profile?.displayName?.trim();
    if (profileName && profileName.length > 0) {
      return profileName;
    }

    return getDisplayName(user?.user_metadata ?? undefined, email);
  }, [email, profile?.displayName, user?.user_metadata]);

  const avatarUrl = useMemo(() => {
    const profileAvatar = profile?.avatarUrl?.trim();
    if (profileAvatar && profileAvatar.length > 0) {
      return profileAvatar;
    }

    return metadataAvatarUrl;
  }, [metadataAvatarUrl, profile?.avatarUrl]);

  const initials = useMemo(() => getInitials(displayName), [displayName]);
  const previewInitials = useMemo(
    () => getInitials((formDisplayName && formDisplayName.trim().length > 0 ? formDisplayName : displayName) ?? ""),
    [displayName, formDisplayName],
  );
  const themeOptions = useMemo(
    () => [
      {
        value: "light" as const,
        title: "Ljust läge",
        description: "Ljus bakgrund och högsta kontrast för detaljer.",
        Icon: SunMedium,
      },
      {
        value: "dark" as const,
        title: "Mörkt läge",
        description: "Skonsamt för ögonen i dunkla miljöer.",
        Icon: Moon,
      },
      {
        value: "system" as const,
        title: "Följ systeminställning",
        description: "Använd samma tema som din enhet.",
        Icon: Laptop,
      },
    ],
    [],
  );

  const clearAvatarObjectUrl = useCallback(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    let ignore = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (ignore) {
        return;
      }

      if (error) {
        console.error("Failed to load profile", error);
        toast({
          title: "Kunde inte läsa profilen",
          description: "Vi kunde inte hämta dina profiluppgifter just nu.",
          variant: "destructive",
        });
        setProfile({ displayName: null, avatarUrl: null });
      } else {
        setProfile({
          displayName: data?.display_name ?? null,
          avatarUrl: data?.avatar_url ?? null,
        });
      }

      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [toast, user?.id]);

  useEffect(() => {
    return () => {
      clearAvatarObjectUrl();
    };
  }, [clearAvatarObjectUrl]);

  const resetAvatarPreview = useCallback(
    (nextPreview: string | null) => {
      clearAvatarObjectUrl();
      setAvatarPreview(nextPreview);
    },
    [clearAvatarObjectUrl],
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setFormDisplayName(displayName);
        setFormNameError(null);
        setAvatarFile(null);
        resetAvatarPreview(avatarUrl ?? null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setFormNameError(null);
        setAvatarFile(null);
        resetAvatarPreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }

      setIsEditOpen(open);
    },
    [avatarUrl, displayName, resetAvatarPreview],
  );

  const handleAvatarChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        setAvatarFile(null);
        resetAvatarPreview(avatarUrl ?? null);
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          title: "Ogiltig filtyp",
          description: "Välj en bild i formatet PNG, JPG eller WEBP.",
          variant: "destructive",
        });
        event.target.value = "";
        setAvatarFile(null);
        resetAvatarPreview(avatarUrl ?? null);
        return;
      }

      if (file.size > 1024 * 1024) {
        toast({
          title: "Filen är för stor",
          description: "Profilbilden får högst vara 1 MB.",
          variant: "destructive",
        });
        event.target.value = "";
        setAvatarFile(null);
        resetAvatarPreview(avatarUrl ?? null);
        return;
      }

      clearAvatarObjectUrl();
      const previewUrl = URL.createObjectURL(file);
      avatarObjectUrlRef.current = previewUrl;
      setAvatarFile(file);
      setAvatarPreview(previewUrl);
    },
    [avatarUrl, clearAvatarObjectUrl, resetAvatarPreview, toast],
  );

  const handleThemeChange = useCallback(
    async (nextPreference: ThemePreference) => {
      if (nextPreference === themePreference) {
        return;
      }

      setThemeSaving(true);
      try {
        await setThemePreference(nextPreference);
        toast({
          title: "Tema uppdaterat",
          description: "Ditt val sparades.",
        });
      } catch (error) {
        console.error("Failed to update theme preference", error);
        toast({
          title: "Kunde inte spara temat",
          description: "Försök igen om en stund.",
          variant: "destructive",
        });
      } finally {
        setThemeSaving(false);
      }
    },
    [setThemePreference, themePreference, toast],
  );

  const handleThemeValueChange = useCallback(
    (value: string) => {
      if (themeSaving) {
        return;
      }

      if (value === "light" || value === "dark" || value === "system") {
        void handleThemeChange(value);
      }
    },
    [handleThemeChange, themeSaving],
  );

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

  const handleProfileSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!user?.id) {
        return;
      }

      const trimmedName = formDisplayName.trim();
      if (trimmedName.length === 0) {
        setFormNameError("Ange ett visningsnamn.");
        return;
      }

      if (trimmedName.length > 60) {
        setFormNameError("Namnet får vara högst 60 tecken.");
        return;
      }

      setFormNameError(null);
      setSavingProfile(true);

      try {
        const bucket = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET ?? "profile-avatars";
        let uploadedAvatarUrl = avatarUrl ?? null;

        if (avatarFile) {
          const extensionFromName = avatarFile.name.split(".").pop()?.toLowerCase();
          const fallbackExtension = avatarFile.type.includes("png")
            ? "png"
            : avatarFile.type.includes("webp")
              ? "webp"
              : avatarFile.type.includes("jpeg") || avatarFile.type.includes("jpg")
                ? "jpg"
                : "png";
          const fileExtension = (extensionFromName && extensionFromName.length <= 5 ? extensionFromName : fallbackExtension) || "png";
          const fileName = `${user.id}-${Date.now()}.${fileExtension}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(filePath, avatarFile, { cacheControl: "3600", upsert: true, contentType: avatarFile.type });

          if (uploadError) {
            console.error("Failed to upload avatar", uploadError);
            toast({
              title: "Kunde inte ladda upp bilden",
              description: "Försök igen eller välj en annan bild.",
              variant: "destructive",
            });
            return;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from(bucket).getPublicUrl(filePath);
          uploadedAvatarUrl = publicUrl ?? null;
        }

        const { data: upsertedProfile, error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              display_name: trimmedName,
              avatar_url: uploadedAvatarUrl,
            },
            { onConflict: "id" },
          )
          .select("display_name, avatar_url")
          .single();

        if (upsertError) {
          console.error("Failed to update profile", upsertError);
          toast({
            title: "Kunde inte spara profilen",
            description: "Försök igen om en stund.",
            variant: "destructive",
          });
          return;
        }

        setProfile({
          displayName: upsertedProfile.display_name ?? trimmedName,
          avatarUrl: upsertedProfile.avatar_url ?? uploadedAvatarUrl ?? null,
        });

        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            display_name: trimmedName,
            full_name: trimmedName,
            avatar_url: uploadedAvatarUrl ?? null,
          },
        });

        if (metadataError) {
          console.error("Failed to sync auth metadata", metadataError);
          toast({
            title: "Profilen sparades med varning",
            description: "Namnet är uppdaterat men metadata kunde inte synkas helt.",
          });
        } else {
          toast({
            title: "Profilen uppdaterades",
            description: "Ditt namn och din bild visas nu i sociala ytor.",
          });
        }

        handleDialogOpenChange(false);
      } finally {
        setSavingProfile(false);
      }
    },
    [avatarFile, avatarUrl, formDisplayName, handleDialogOpenChange, toast, user?.id],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-8">
      <header className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-theme-card bg-theme-elevated">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="Profilbild" className="object-cover" /> : null}
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
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-theme-primary">Din profil</CardTitle>
              <CardDescription className="text-theme-secondary">
                Uppdatera namn och bild så visas de på följelistor och kommande sociala ytor.
              </CardDescription>
            </div>
            <Dialog open={isEditOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                  disabled={profileLoading}
                >
                  <PenLine className="h-4 w-4" />
                  Redigera profil
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg border-theme-card/80 bg-theme-elevated text-left text-theme-primary">
                <DialogHeader>
                  <DialogTitle>Redigera profil</DialogTitle>
                  <DialogDescription>
                    Ändra visningsnamn och profilbild. Bilden måste vara en PNG, JPG eller WEBP på högst 1 MB.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="display-name" className="text-theme-primary">
                      Visningsnamn
                    </Label>
                    <Input
                      id="display-name"
                      value={formDisplayName}
                      onChange={(event) => {
                        setFormDisplayName(event.target.value);
                        if (formNameError) {
                          setFormNameError(null);
                        }
                      }}
                      placeholder="Ditt namn"
                      className="border-theme-card bg-theme-elevated text-theme-primary"
                      maxLength={80}
                    />
                    {formNameError ? <p className="text-sm text-destructive">{formNameError}</p> : null}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-theme-primary">Profilbild</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border border-theme-card bg-theme-elevated">
                        {avatarPreview ? <AvatarImage src={avatarPreview} alt="Förhandsvisning" className="object-cover" /> : null}
                        <AvatarFallback className="bg-theme-elevated text-xl font-semibold text-theme-primary">
                          {previewInitials || "WS"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2 text-sm text-theme-secondary">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-dashed border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={savingProfile}
                        >
                          <UploadCloud className="h-4 w-4" />
                          Välj bild
                        </Button>
                        <p>PNG, JPG eller WEBP. Max 1 MB.</p>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                        disabled={savingProfile}
                      >
                        Avbryt
                      </Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      className="gap-2 bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
                      disabled={savingProfile}
                    >
                      {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Spara ändringar
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
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
            <CardTitle className="text-theme-primary">Utseende</CardTitle>
            <CardDescription className="text-theme-secondary">
              Välj hur WineSnap ska se ut. Ditt val sparas i profilen eller lokalt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={themePreference}
              onValueChange={handleThemeValueChange}
              className="grid gap-3 sm:grid-cols-3"
            >
              {themeOptions.map(({ value, title, description, Icon }) => (
                <label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-theme-card/80 bg-theme-elevated/80 p-3 transition hover:border-theme-card ${themeSaving ? "opacity-70" : ""}`}
                >
                  <RadioGroupItem
                    id={`theme-${value}`}
                    value={value}
                    disabled={themeSaving}
                    className="mt-1 text-theme-primary"
                  />
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 text-theme-primary">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{title}</span>
                    </div>
                    <p className="text-sm text-theme-secondary">{description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
            {themeSaving ? <p className="text-sm text-theme-secondary">Sparar temat...</p> : null}
          </CardContent>
        </Card>

        <WineListsSection />

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
