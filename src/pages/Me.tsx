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
import { Badge } from "@/components/ui/badge";
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
import { trackEvent } from "@/lib/telemetry";
import { WineListsSection } from "@/components/profile/WineListsSection";
import { useTheme } from "@/ui/ThemeProvider";
import type { ThemePreference } from "@/ui/theme";
import { Camera, Globe, Laptop, Loader2, LogOut, Moon, PenLine, Sparkles, SunMedium, UploadCloud } from "lucide-react";
import { useIsPremium } from "@/hooks/useUserSettings";
import { createPremiumCheckoutSession } from "@/services/premiumCheckout";
import { useTranslation } from "@/hooks/useTranslation";
import { useSettings } from "@/settings/SettingsContext";
import { isPlayRC } from "@/lib/releaseChannel";

const Me = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { themePreference, setThemePreference } = useTheme();
  const { isPremium, premiumSince, isLoading: isPremiumLoading } = useIsPremium();
  const premiumFeaturesEnabled = !isPlayRC;
  const [profile, setProfile] = useState<{ displayName: string | null; avatarUrl: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStartingPremium, setIsStartingPremium] = useState(false);
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formNameError, setFormNameError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [langSaving, setLangSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);
  const { t, locale, dateLocale } = useTranslation();
  const { lang, setLang } = useSettings();

  const email = user?.email ?? (typeof user?.user_metadata?.email === "string" ? user.user_metadata.email : null);
  const metadataAvatarUrl =
    typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url.trim().length > 0
      ? user.user_metadata.avatar_url
      : null;

  const getDisplayName = useCallback((metadata: Record<string, unknown> | undefined, userEmail: string | null) => {
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

    if (userEmail) {
      return userEmail.split("@")[0];
    }

    return t("me.wineSnapUser");
  }, [t]);

  const displayName = useMemo(() => {
    const profileName = profile?.displayName?.trim();
    if (profileName && profileName.length > 0) {
      return profileName;
    }

    return getDisplayName(user?.user_metadata ?? undefined, email);
  }, [email, getDisplayName, profile?.displayName, user?.user_metadata]);

  const avatarUrl = useMemo(() => {
    const profileAvatar = profile?.avatarUrl?.trim();
    if (profileAvatar && profileAvatar.length > 0) {
      return profileAvatar;
    }

    return metadataAvatarUrl;
  }, [metadataAvatarUrl, profile?.avatarUrl]);

  const getInitials = useCallback((name: string) => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2);
  }, []);

  const initials = useMemo(() => getInitials(displayName), [displayName, getInitials]);
  const previewInitials = useMemo(
    () => getInitials((formDisplayName && formDisplayName.trim().length > 0 ? formDisplayName : displayName) ?? ""),
    [displayName, formDisplayName, getInitials],
  );
  const premiumDescription = useMemo(() => {
    if (isPremium) {
      if (premiumSince) {
        return t("me.premiumSince", { date: premiumSince.toLocaleDateString(dateLocale) });
      }

      return t("me.premiumActive");
    }

    return t("me.freeDescription");
  }, [dateLocale, isPremium, premiumSince, t]);
  const themeOptions = useMemo(
    () => [
      {
        value: "light" as const,
        title: t("me.lightMode"),
        description: t("me.lightModeDesc"),
        Icon: SunMedium,
      },
      {
        value: "dark" as const,
        title: t("me.darkMode"),
        description: t("me.darkModeDesc"),
        Icon: Moon,
      },
      {
        value: "system" as const,
        title: t("me.systemMode"),
        description: t("me.systemModeDesc"),
        Icon: Laptop,
      },
    ],
    [t],
  );

  const languageOptions = useMemo(
    () => [
      { value: "sv-SE", label: t("me.swedish"), flag: "🇸🇪" },
      { value: "en-US", label: t("me.english"), flag: "🇬🇧" },
    ],
    [t],
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
          title: t("me.couldNotReadProfile"),
          description: t("me.couldNotReadProfileDesc"),
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
  }, [t, toast, user?.id]);

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
          title: t("me.invalidFileType"),
          description: t("me.chooseImageFormat"),
          variant: "destructive",
        });
        event.target.value = "";
        setAvatarFile(null);
        resetAvatarPreview(avatarUrl ?? null);
        return;
      }

      if (file.size > 1024 * 1024) {
        toast({
          title: t("me.fileTooLarge"),
          description: t("me.maxFileSize"),
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
    [avatarUrl, clearAvatarObjectUrl, resetAvatarPreview, t, toast],
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
          title: t("me.themeUpdated"),
          description: t("me.choiceSaved"),
        });
      } catch (error) {
        console.error("Failed to update theme preference", error);
        toast({
          title: t("me.couldNotSaveTheme"),
          description: t("me.tryAgainSoon"),
          variant: "destructive",
        });
      } finally {
        setThemeSaving(false);
      }
    },
    [setThemePreference, t, themePreference, toast],
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

  const handleLanguageChange = useCallback(
    async (value: string) => {
      if (langSaving || value === lang) {
        return;
      }

      setLangSaving(true);
      try {
        await setLang(value);
        const langLabel = value.startsWith("en") ? "English" : "Svenska";
        toast({
          title: t("me.languageUpdated"),
          description: t("me.languageSaved", { lang: langLabel }),
        });
      } catch (error) {
        console.error("Failed to update language", error);
        toast({
          title: t("me.couldNotSaveTheme"),
          description: t("me.tryAgainSoon"),
          variant: "destructive",
        });
      } finally {
        setLangSaving(false);
      }
    },
    [lang, langSaving, setLang, t, toast],
  );

  const handlePremiumCtaClick = useCallback(async () => {
    if (!premiumFeaturesEnabled) {
      return;
    }

    trackEvent("premium_cta_clicked", { source: "profile" });

    if (!user) {
      navigate("/login?redirectTo=/me");
      return;
    }

    setIsStartingPremium(true);
    try {
      const origin = window.location.origin;
      const checkoutUrl = `${origin}/premium/checkout/session`;
      const cancelUrl = `${origin}/me?premium_cancelled=1`;
      const successUrl = `${origin}/me?premium=1`;

      const session = await createPremiumCheckoutSession(checkoutUrl, {
        cancelUrl,
        successUrl,
      });

      window.location.href = session.redirectUrl;
    } catch (error) {
      console.error("Failed to start premium checkout", error);
      trackEvent("premium_checkout_failed", { source: "profile", message: (error as Error)?.message });
      toast({
        title: t("me.couldNotStartPayment"),
        description: t("me.tryAgainSoon"),
        variant: "destructive",
      });
    } finally {
      setIsStartingPremium(false);
    }
  }, [navigate, premiumFeaturesEnabled, t, toast, user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to sign out", error);
      toast({
        title: t("me.couldNotSignOut"),
        description: t("me.tryAgainMoment"),
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
        setFormNameError(t("me.enterDisplayName"));
        return;
      }

      if (trimmedName.length > 60) {
        setFormNameError(t("me.nameTooLong"));
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
              title: t("me.couldNotUploadImage"),
              description: t("me.tryAgainOtherImage"),
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
            title: t("me.couldNotSaveProfile"),
            description: t("me.tryAgainSoon"),
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
            title: t("me.profileSavedWarning"),
            description: t("me.metadataNotSynced"),
          });
        } else {
          toast({
            title: t("me.profileUpdated"),
            description: t("me.profileUpdatedDesc"),
          });
        }

        handleDialogOpenChange(false);
      } finally {
        setSavingProfile(false);
      }
    },
    [avatarFile, avatarUrl, formDisplayName, handleDialogOpenChange, t, toast, user?.id],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-8">
      <header className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-[hsl(var(--color-border))] bg-theme-elevated">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={t("me.profileImage")} className="object-cover" /> : null}
            <AvatarFallback className="bg-theme-elevated text-xl font-semibold text-theme-primary">
              {initials || "WS"}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-theme-primary">{displayName}</h1>
            {email ? <p className="text-sm text-theme-secondary">{email}</p> : null}
            {/* Premium status temporarily hidden for RC */}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {premiumFeaturesEnabled && !isPremium ? (
              <Button
                className="gap-2 rounded-full bg-theme-accent text-theme-on-accent shadow-theme-card"
                onClick={handlePremiumCtaClick}
                aria-label={t("me.becomePremium")}
                disabled={isPremiumLoading || isStartingPremium}
              >
                {isStartingPremium ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isStartingPremium ? t("me.starting") : t("me.becomePremium")}
              </Button>
            ) : null}
            <Button
              className="gap-2 rounded-full bg-theme-accent text-theme-on-accent shadow-theme-card"
              onClick={() => navigate("/scan")}
              aria-label={t("me.newScan")}
            >
              <Camera className="h-4 w-4" />
              {t("me.newScan")}
            </Button>
            <Button
              variant="outline"
              className="border-[hsl(var(--color-border))] bg-theme-elevated text-theme-primary hover:bg-[hsl(var(--color-surface-alt)/0.8)]"
              onClick={() => navigate("/me/wines")}
              aria-label={t("me.myWines")}
            >
              {t("me.myWines")}
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {/* Premium section temporarily hidden for RC */}

        <Card className="border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] shadow-theme-card backdrop-blur">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-theme-primary">{t("me.yourProfile")}</CardTitle>
              <CardDescription className="text-theme-secondary">
                {t("me.profileSubtitle")}
              </CardDescription>
            </div>
            <Dialog open={isEditOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 border-[hsl(var(--color-border))] bg-theme-elevated text-theme-primary hover:bg-[hsl(var(--color-surface-alt)/0.8)]"
                  disabled={profileLoading}
                >
                  <PenLine className="h-4 w-4" />
                  {t("me.editProfile")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg border-[hsl(var(--color-border)/0.8)] bg-theme-elevated text-left text-theme-primary">
                <DialogHeader>
                  <DialogTitle>{t("me.editProfileTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("me.editProfileSubtitle")}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="display-name" className="text-theme-primary">
                      {t("me.displayName")}
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
                      placeholder={t("me.yourName")}
                      className="border-[hsl(var(--color-border))] bg-theme-elevated text-theme-primary"
                      maxLength={80}
                    />
                    {formNameError ? <p className="text-sm text-destructive">{formNameError}</p> : null}
                  </div>

                  <div className="space-y-3">
                    <Label className="text-theme-primary">{t("me.profileImage")}</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16 border border-[hsl(var(--color-border))] bg-theme-elevated">
                        {avatarPreview ? <AvatarImage src={avatarPreview} alt={t("me.profileImage")} className="object-cover" /> : null}
                        <AvatarFallback className="bg-theme-elevated text-xl font-semibold text-theme-primary">
                          {previewInitials || "WS"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-2 text-sm text-theme-secondary">
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2 border-dashed border-[hsl(var(--color-border))] bg-theme-elevated text-theme-primary hover:bg-[hsl(var(--color-surface-alt)/0.8)]"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={savingProfile}
                        >
                          <UploadCloud className="h-4 w-4" />
                          {t("me.chooseImage")}
                        </Button>
                        <p>{t("me.imageRequirements")}</p>
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
                      className="border-[hsl(var(--color-border))] bg-theme-elevated text-theme-primary hover:bg-[hsl(var(--color-surface-alt)/0.8)]"
                      disabled={savingProfile}
                    >
                      {t("me.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    className="gap-2 bg-theme-accent text-theme-on-accent shadow-theme-card"
                    disabled={savingProfile}
                  >
                      {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {t("me.saveChanges")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-theme-secondary">
            <div>
              <p className="font-medium text-theme-primary">{t("me.name")}</p>
              <p>{displayName}</p>
            </div>
            {email ? (
              <div>
                <p className="font-medium text-theme-primary">{t("me.email")}</p>
                <p>{email}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] shadow-theme-card backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">{t("me.appearance")}</CardTitle>
            <CardDescription className="text-theme-secondary">
              {t("me.appearanceSubtitle")}
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
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] p-3 transition hover:border-[hsl(var(--color-border))] ${themeSaving ? "opacity-70" : ""}`}
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
            {themeSaving ? <p className="text-sm text-theme-secondary">{t("me.savingTheme")}</p> : null}
          </CardContent>
        </Card>

        <Card className="border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] shadow-theme-card backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-theme-primary">
              <Globe className="h-5 w-5" />
              {t("me.language")}
            </CardTitle>
            <CardDescription className="text-theme-secondary">
              {t("me.languageSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={lang.startsWith("en") ? "en-US" : "sv-SE"}
              onValueChange={handleLanguageChange}
              className="grid gap-3 sm:grid-cols-2"
            >
              {languageOptions.map(({ value, label, flag }) => (
                <label
                  key={value}
                  htmlFor={`lang-${value}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] p-3 transition hover:border-[hsl(var(--color-border))] ${langSaving ? "opacity-70" : ""}`}
                >
                  <RadioGroupItem
                    id={`lang-${value}`}
                    value={value}
                    disabled={langSaving}
                    className="text-theme-primary"
                  />
                  <span className="text-xl">{flag}</span>
                  <span className="font-medium text-theme-primary">{label}</span>
                </label>
              ))}
            </RadioGroup>
            {langSaving ? <p className="text-sm text-theme-secondary">{t("me.savingTheme")}</p> : null}
          </CardContent>
        </Card>

        <WineListsSection />

        <Card className="border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.8)] shadow-theme-card backdrop-blur">
          <CardHeader>
            <CardTitle className="text-theme-primary">{t("me.manageAccount")}</CardTitle>
            <CardDescription className="text-theme-secondary">
              {t("me.manageAccountSubtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              {t("me.signOut")}
            </Button>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default Me;
