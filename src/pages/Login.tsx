import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { signInWithEmail, signInWithGoogle, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

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
        title: "Ange en e-postadress",
        description: "Vi behöver din e-post för att kunna skicka en magisk länk.",
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
        title: "Kolla din inkorg",
        description: "Vi har skickat en magisk länk som loggar in dig.",
      });
    } catch (error) {
      console.error("Magic link sign-in failed", error);
      toast({
        title: "Kunde inte skicka länk",
        description: "Kontrollera e-postadressen och försök igen.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in failed", error);
      toast({
        title: "Kunde inte logga in med Google",
        description: "Försök igen senare.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-theme-canvas px-4 py-12 text-theme-primary">
      <Card className="w-full max-w-md border-theme-card/60 bg-theme-elevated/80 backdrop-blur">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">Logga in i WineSnap</CardTitle>
          <CardDescription className="text-theme-secondary">
            Använd en magisk länk eller logga in med Google för att fortsätta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div className="space-y-2 text-left">
              <Label htmlFor="email" className="text-theme-primary">
                E-postadress
              </Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="alex@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="border-theme-card bg-theme-surface text-theme-primary"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Skickar..." : "Skicka magisk länk"}
            </Button>
            {emailSent ? (
              <p className="text-sm text-theme-secondary">
                Länken är på väg till {email}. Öppna den på samma enhet.
              </p>
            ) : null}
          </form>

          <div className="flex items-center gap-2 text-sm text-theme-secondary">
            <span className="h-px flex-1 bg-theme-card/60" />
            <span>eller</span>
            <span className="h-px flex-1 bg-theme-card/60" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Logga in med Google
          </Button>

          <p className="text-center text-sm text-theme-secondary">
            Vill du utforska utan konto? <Link to="/scan" className="underline">Skanna nu</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
