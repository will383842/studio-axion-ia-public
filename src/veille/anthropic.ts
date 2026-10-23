/**
 * Source « modèles Claude » : la liste des modèles d'Anthropic n'est lisible qu'avec une clé (`ANTHROPIC_API_KEY`).
 * Sans clé : carte grise « impossible de vérifier » (jamais « à jour »). Lister les modèles ne coûte rien.
 */
import { lireJson, SourceMuette } from "./http";
import type { ContexteLecture, Lecture } from "./types";

interface ListeModeles {
  data: { id: string; display_name?: string; created_at?: string }[];
}

export async function lireAnthropic(c: ContexteLecture): Promise<Lecture> {
  const cle = c.env.ANTHROPIC_API_KEY?.trim();
  if (!cle) return { ok: false, raison: "Impossible de vérifier : Claude n'est pas encore relié." };
  try {
    const r = await lireJson<ListeModeles>(c.appeler, "https://api.anthropic.com/v1/models?limit=20", c.delaiMs, { "x-api-key": cle, "anthropic-version": "2023-06-01" });
    const tries = [...(r.data ?? [])].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    if (!tries.length) return { ok: false, raison: "Liste des modèles vide." };
    const m = tries[0];
    return { ok: true, version: m.id, date: m.created_at, lien: "https://docs.anthropic.com/en/docs/about-claude/models/overview", notes: tries.slice(0, 5).map((x) => `${x.display_name ?? x.id} (${x.created_at ?? ""})`).join("\n") };
  } catch (e) {
    return { ok: false, raison: e instanceof SourceMuette ? e.raison : "La source ne répond pas." };
  }
}
