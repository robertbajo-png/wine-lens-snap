import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";

const MAX_PAYLOAD_LENGTH = 1200;

type EventRecord = {
  id: string;
  created_at: string;
  event_type: string;
  payload: unknown;
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
};

const formatPayload = (payload: unknown) => {
  const json = JSON.stringify(payload ?? {}, null, 2) ?? "{}";
  if (json.length <= MAX_PAYLOAD_LENGTH) {
    return json;
  }
  return `${json.slice(0, MAX_PAYLOAD_LENGTH)}\n…(trunkerad)`;
};

const DevEventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("id, created_at, event_type, payload")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<EventRecord[]>();

    if (error) {
      setError(error.message);
      setEvents([]);
    } else {
      setError(null);
      setEvents(data ?? []);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!import.meta.env.DEV || !user) {
      setLoading(false);
      return;
    }

    void fetchEvents();
  }, [fetchEvents, user]);

  const lastUpdated = useMemo(() => {
    if (events.length === 0) return null;
    return events[0]?.created_at ?? null;
  }, [events]);

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
            <h1 className="text-2xl font-semibold text-theme-primary">Senaste events</h1>
            <p className="text-sm text-theme-secondary">
              Visar de senaste 100 eventsen för {user.email ?? user.id}
            </p>
            {lastUpdated && (
              <p className="text-xs text-theme-secondary/80">
                Senast uppdaterad: {formatTimestamp(lastUpdated)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchEvents}
              disabled={loading}
              className="gap-2 rounded-full border-theme-card bg-theme-elevated text-theme-primary"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Uppdatera
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Kunde inte hämta events</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border border-theme-card bg-theme-elevated text-theme-primary">
          <CardHeader>
            <CardTitle>Eventlogg</CardTitle>
            <CardDescription>Endast tillgänglig i utvecklingsmiljö</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Skapad</TableHead>
                  <TableHead className="w-48">Typ</TableHead>
                  <TableHead>Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-theme-secondary">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Läser in events...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-theme-secondary">
                      Inga events hittades för den här användaren.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event.id} className="align-top">
                      <TableCell className="whitespace-nowrap text-sm text-theme-secondary">
                        {formatTimestamp(event.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-theme-primary">{event.event_type}</TableCell>
                      <TableCell>
                        <pre className="max-h-60 overflow-auto rounded-md bg-theme-canvas/60 p-3 font-mono text-xs text-theme-secondary">
                          {formatPayload(event.payload)}
                        </pre>
                      </TableCell>
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

export default DevEventsPage;
