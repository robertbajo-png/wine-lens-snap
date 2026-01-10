import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type FeedbackRecord = {
  id: string;
  created_at: string;
  is_correct: boolean;
  comment: string | null;
  label_hash: string;
  scan_id: string;
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
};

const DevFeedbackPage = () => {
  const { user } = useAuth();
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("analysis_feedback" as "scans")
      .select("id, created_at, is_correct, comment, label_hash, scan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100) as unknown as { data: FeedbackRecord[] | null; error: { message: string } | null };

    if (error) {
      setError(error.message);
      setFeedbackRows([]);
    } else {
      setError(null);
      setFeedbackRows(data ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!import.meta.env.DEV || !user) {
      setLoading(false);
      return;
    }

    void fetchFeedback();
  }, [fetchFeedback, user]);

  const lastUpdated = useMemo(() => {
    if (feedbackRows.length === 0) return null;
    return feedbackRows[0]?.created_at ?? null;
  }, [feedbackRows]);

  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="min-h-screen bg-theme-canvas text-theme-secondary">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-purple-200/80">Dev</p>
            <h1 className="text-2xl font-semibold text-theme-primary">Senaste feedback</h1>
            <p className="text-sm text-theme-secondary">
              Visar de senaste 100 feedbackraderna för {user.email ?? user.id}
            </p>
            {lastUpdated && (
              <p className="text-xs text-theme-secondary/80">
                Senast uppdaterad: {formatTimestamp(lastUpdated)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={fetchFeedback}
              disabled={loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Uppdatera
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Kunde inte hämta feedback</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border border-theme-card bg-theme-elevated text-theme-primary">
          <CardHeader>
            <CardTitle>Feedback</CardTitle>
            <CardDescription>Endast tillgänglig i utvecklingsmiljö</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Skapad</TableHead>
                  <TableHead className="w-32">Stämmer?</TableHead>
                  <TableHead className="w-[30%]">Kommentar</TableHead>
                  <TableHead className="w-40">Label hash</TableHead>
                  <TableHead className="w-40">Scan ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-theme-secondary">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Läser in feedback...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : feedbackRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-theme-secondary">
                      Ingen feedback hittades för den här användaren.
                    </TableCell>
                  </TableRow>
                ) : (
                  feedbackRows.map((row) => (
                    <TableRow key={row.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-sm text-theme-secondary">
                        {formatTimestamp(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`inline-flex items-center gap-1 border-theme-card ${
                            row.is_correct ? "bg-emerald-100/10 text-emerald-400" : "bg-rose-100/10 text-rose-300"
                          }`}
                        >
                          {row.is_correct ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Stämmer
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4" />
                              Stämmer inte
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-theme-primary">
                        {row.comment?.trim() ? row.comment : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-theme-secondary">{row.label_hash}</TableCell>
                      <TableCell className="font-mono text-xs text-theme-secondary">{row.scan_id}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default DevFeedbackPage;
