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

// ---- Player CRUD ----

export async function addPlayer(player: {
  name: string;
  displayName: string;
  gender: "male" | "female";
  imageUrl: string;
}): Promise<Player> {
  const id = player.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const prefix = player.gender === "male" ? "a" : "c";
  const playerId = `${prefix}-${id}`;

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("players")
    .select("sort_order")
    .eq("gender", player.gender)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from("players")
    .insert({
      id: playerId,
      name: player.name,
      display_name: player.displayName,
      gender: player.gender,
      image_url: player.imageUrl,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding player:", error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    displayName: data.display_name,
    image: data.image_url,
    gender: data.gender,
  };
}

export async function updatePlayer(
  id: string,
  updates: { name?: string; displayName?: string; imageUrl?: string }
): Promise<void> {
  const updateData: Record<string, string> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;

  const { error } = await supabase.from("players").update(updateData).eq("id", id);
  if (error) {
    console.error("Error updating player:", error);
    throw error;
  }
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) {
    console.error("Error deleting player:", error);
    throw error;
  }
}

export async function uploadPlayerImage(file: File, playerId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `players/${playerId}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("player-images")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    console.error("Error uploading image:", uploadError);
    throw uploadError;
  }

  // Get public URL
  const { data } = supabase.storage.from("player-images").getPublicUrl(filePath);
  return data.publicUrl;
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
