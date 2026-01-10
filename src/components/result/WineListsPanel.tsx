import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  addScanToList,
  createWineList,
  fetchMembershipForScan,
  fetchWineLists,
  removeScanFromList,
  type WineListSummary,
} from "@/services/wineLists";
import { useAuth } from "@/auth/AuthProvider";
import { Check, ListChecks, ListPlus, Loader2, Plus } from "lucide-react";

const RECOMMENDED_NAMES = ["Favoriter", "Köp igen", "Gästlista"];

interface WineListsPanelProps {
  scanId: string | null;
  ensureScanId: () => Promise<string>;
  isPersistingScan: boolean;
}

const emptySummary: WineListSummary[] = [];

export const WineListsPanel = ({ scanId, ensureScanId, isPersistingScan }: WineListsPanelProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [lists, setLists] = useState<WineListSummary[]>(emptySummary);
  const [memberships, setMemberships] = useState<Set<string>>(new Set());
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingMembership, setLoadingMembership] = useState(false);
  const [pendingListId, setPendingListId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  useEffect(() => {
    if (!dialogOpen && !creatingList) {
      setNewListName("");
    }
  }, [creatingList, dialogOpen]);

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const data = await fetchWineLists();
      setLists(data);
    } catch (error) {
      console.error("Failed to load lists", error);
      toast({
        title: "Kunde inte läsa listorna",
        description: "Försök igen om en liten stund.",
        variant: "destructive",
      });
    } finally {
      setLoadingLists(false);
    }
  }, [toast]);

  const refreshMembership = useCallback(
    async (targetScanId?: string | null) => {
      if (!targetScanId) {
        setMemberships(new Set());
        return;
      }

      setLoadingMembership(true);
      try {
        const data = await fetchMembershipForScan(targetScanId);
        setMemberships(new Set(data));
      } catch (error) {
        console.error("Failed to load memberships", error);
        toast({
          title: "Kunde inte läsa liststatus",
          description: "Försök igen.",
          variant: "destructive",
        });
      } finally {
        setLoadingMembership(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    void refreshMembership(scanId);
  }, [refreshMembership, scanId]);

  const hasLists = lists.length > 0;

  const handleToggle = useCallback(
    async (listId: string) => {
      setPendingListId(listId);
      try {
        const ensuredId = scanId ?? (await ensureScanId());
        if (!ensuredId) {
          throw new Error("Vinet saknar sparad skanning.");
        }

        if (memberships.has(listId)) {
          await removeScanFromList(listId, ensuredId);
          toast({
            title: "Borttagen",
            description: "Vinet togs bort från listan.",
          });
        } else {
          await addScanToList(listId, ensuredId);
          toast({
            title: "Sparat",
            description: "Vinet lades till i listan.",
          });
        }

        await refreshMembership(ensuredId);
        await refreshLists();
      } catch (error) {
        console.error("Failed to update list", error);
        toast({
          title: "Kunde inte uppdatera listan",
          description: error instanceof Error ? error.message : "Försök igen senare.",
          variant: "destructive",
        });
      } finally {
        setPendingListId(null);
      }
    },
    [ensureScanId, memberships, refreshLists, refreshMembership, scanId, toast],
  );

  const handleCreateList = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (creatingList) return;

      setCreatingList(true);
      try {
        const created = await createWineList(newListName, user?.id ?? "");
        setDialogOpen(false);
        setNewListName("");
        await refreshLists();
        const ensuredId = scanId ?? (await ensureScanId());
        if (!ensuredId) {
          throw new Error("Vinet saknar sparad skanning.");
        }
        await addScanToList(created.id, ensuredId);
        await refreshMembership(ensuredId);
        toast({
          title: "Listan är klar",
          description: `${created.name} skapades och vinet lades till automatiskt.`,
        });
      } catch (error) {
        console.error("Failed to create list", error);
        toast({
          title: "Kunde inte skapa listan",
          description: error instanceof Error ? error.message : "Försök igen senare.",
          variant: "destructive",
        });
      } finally {
        setCreatingList(false);
      }
    },
    [creatingList, ensureScanId, newListName, refreshLists, refreshMembership, scanId, toast],
  );

  const isBusy =
    loadingLists ||
    loadingMembership ||
    pendingListId !== null ||
    isPersistingScan ||
    creatingList;

  const dialogDescription = useMemo(() => {
    const suggestions = RECOMMENDED_NAMES.join(", ");
    return `Tips: ${suggestions}.`;
  }, []);

  return (
    <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-theme-primary">
            <ListChecks className="h-4 w-4" />
            Mina listor
          </CardTitle>
          <CardDescription className="text-theme-secondary">
            Spara vinet i Favoriter, Köp igen eller din egen lista.
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (!creatingList ? setDialogOpen(open) : null)}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
              disabled={isBusy}
            >
              <ListPlus className="h-4 w-4" />
              Ny lista
            </Button>
          </DialogTrigger>
          <DialogContent className="border-theme-card/80 bg-theme-elevated text-theme-primary">
            <DialogHeader>
              <DialogTitle>Skapa lista</DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateList} className="space-y-4">
              <Input
                autoFocus
                placeholder="T.ex. Favoriter"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                className="border-theme-card bg-theme-elevated text-theme-primary"
                maxLength={80}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => (creatingList ? null : setDialogOpen(false))}
                  className="text-theme-secondary hover:text-theme-primary"
                  disabled={creatingList}
                >
                  Avbryt
                </Button>
                <Button type="submit" className="gap-2" disabled={creatingList || newListName.trim().length === 0}>
                  {creatingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                  Skapa och spara vinet
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasLists && !loadingLists ? (
          <p className="text-sm text-theme-secondary">
            Du har inga listor ännu. Skapa en ny – vi lägger till det här vinet direkt.
          </p>
        ) : null}

        {loadingLists ? (
          <div className="flex flex-wrap gap-2">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-10 w-32 animate-pulse rounded-full bg-theme-card/60" />
            ))}
          </div>
        ) : null}

        {hasLists ? (
          <div className="flex flex-wrap gap-2">
            {lists.map((list) => {
              const isSelected = memberships.has(list.id);
              const disabled = isBusy || pendingListId === list.id;
              return (
                <Button
                  key={list.id}
                  variant={isSelected ? "primary" : "outline"}
                  className="gap-2"
                  onClick={() => (disabled ? null : void handleToggle(list.id))}
                  disabled={disabled}
                >
                  {pendingListId === list.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isSelected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{list.name}</span>
                </Button>
              );
            })}
          </div>
        ) : null}

        {loadingMembership ? (
          <p className="text-xs text-theme-secondary">Uppdaterar liststatus …</p>
        ) : null}
      </CardContent>
    </Card>
  );
};
