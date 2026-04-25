import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { Logo } from "@/components/Logo";

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { signInWithEmail, signInWithGoogle, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { t } = useTranslation();

  const redirectTo = params.get("redirectTo");

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo || "/me", { replace: true });
    }
  }, [loading, navigate, redirectTo, user]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      toast({
        title: t("login.enterEmail"),
        description: t("login.needEmail"),
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    setEmailSent(false);

    try {
      const { error } = await signInWithEmail(email);
      if (error) {
        throw error;
      }
      setEmailSent(true);
      toast({
        title: t("login.checkInbox"),
        description: t("login.magicLinkSent"),
      });
    } catch (error) {
      console.error("Magic link sign-in failed", error);
      toast({
        title: t("login.couldNotSendLink"),
        description: t("login.checkEmailRetry"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(redirectTo);
    } catch (error) {
      console.error("Google sign-in failed", error);
      toast({
        title: t("login.couldNotGoogle"),
        description: t("login.tryAgainLater"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />
      <Logo size="lg" className="mb-8" />
      <Card className="w-full max-w-md rounded-3xl border-border bg-card/70 shadow-elegant backdrop-blur">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="font-display text-3xl font-semibold">{t("login.title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="email" className="text-foreground">
                {t("login.emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder={t("login.emailPlaceholder")}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-2xl border-border bg-background"
              />
            </div>
            <Button
              type="submit"
              className="h-12 w-full rounded-2xl bg-gradient-luxe text-primary-foreground shadow-elegant hover:opacity-90"
              disabled={submitting}
            >
              {submitting ? t("login.sending") : t("login.sendMagicLink")}
            </Button>
            {emailSent ? (
              <p className="text-sm text-muted-foreground">
                {t("login.linkOnTheWay", { email })}
              </p>
            ) : null}
          </form>

          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>{t("login.or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-2xl border-border bg-card/60"
            onClick={handleGoogleSignIn}
          >
            {t("login.googleSignIn")}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t("login.exploreWithoutAccount")}{" "}
            <Link to="/scan" className="font-medium text-gold underline-offset-4 hover:underline">
              {t("login.scanNow")}
            </Link>
            .
          </p>

          <p className="text-center text-xs text-muted-foreground/70">
            Genom att logga in godkänner du att vi sparar din skanningshistorik och grundläggande profilinformation.{" "}
            <Link to="/om" className="underline">Läs mer</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
