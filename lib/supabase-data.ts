import { supabase } from "./supabase";
import type { Player, Pair } from "./players";

// ---- Players ----

export async function fetchPlayers(): Promise<{ males: Player[]; females: Player[] }> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching players:", error);
    throw error;
  }

  const males: Player[] = [];
  const females: Player[] = [];

  for (const row of data ?? []) {
    const player: Player = {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      image: row.image_url,
      gender: row.gender,
    };
    if (row.gender === "male") males.push(player);
    else females.push(player);
  }

  return { males, females };
}

// ---- Tournament Data (Pairs) ----

export async function fetchPairs(): Promise<Pair[]> {
  const { data, error } = await supabase
    .from("tournament_data")
    .select("data")
    .eq("key", "pairs")
    .single();

  if (error) {
    console.error("Error fetching pairs:", error);
    return [];
  }

  return (data?.data as Pair[]) ?? [];
}

export async function savePairs(pairs: Pair[]): Promise<void> {
  const { error } = await supabase
    .from("tournament_data")
    .upsert({ key: "pairs", data: pairs, updated_at: new Date().toISOString() });

  if (error) console.error("Error saving pairs:", error);
}

// ---- Tournament Data (Bracket) ----

export async function fetchBracket<T>(): Promise<T | null> {
  const { data, error } = await supabase
    .from("tournament_data")
    .select("data")
    .eq("key", "bracket")
    .single();

  if (error) {
    console.error("Error fetching bracket:", error);
    return null;
  }

  const bracketData = data?.data;
  if (!bracketData || Object.keys(bracketData).length === 0) return null;
  return bracketData as T;
}

export async function saveBracket<T>(bracket: T): Promise<void> {
  const { error } = await supabase
    .from("tournament_data")
    .upsert({ key: "bracket", data: bracket, updated_at: new Date().toISOString() });

  if (error) console.error("Error saving bracket:", error);
}

// ---- Reset ----

export async function resetTournament(): Promise<void> {
  await supabase.from("tournament_data").upsert([
    { key: "pairs", data: [], updated_at: new Date().toISOString() },
    { key: "bracket", data: {}, updated_at: new Date().toISOString() },
  ]);
}

// ---- Realtime subscription ----

export function subscribeTournamentData(
  onChange: (key: string, data: unknown) => void
) {
  const channel = supabase
    .channel("tournament-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tournament_data" },
      (payload) => {
        const row = payload.new as { key: string; data: unknown };
        if (row?.key) onChange(row.key, row.data);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
