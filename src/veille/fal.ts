/**
 * Source « catalogue fal.ai » (lecture publique, sans clé : `GET https://api.fal.ai/v1/models?category=…`).
 * Version = le modèle le plus récent des catégories surveillées ; notes = les modèles parus depuis la dernière lecture.
 * Aucune fabrication, rien de payant.
 */
import { empreinte, lireJson, SourceMuette } from "./http";
import type { ContexteLecture, Lecture } from "./types";

/** Catégories utiles au studio : images et clips des illustrations. */
export const CATEGORIES_FAL = ["text-to-image", "image-to-video"];
const PAGES_MAX = 5;

export interface ModeleFal {
  endpoint_id: string;
  metadata?: { display_name?: string; category?: string; description?: string; status?: string; date?: string; license_type?: string };
}

interface PageFal {
  models: ModeleFal[];
  next_cursor?: string | null;
  has_more?: boolean;
}

export async function catalogueFal(categories: string[], c: ContexteLecture): Promise<ModeleFal[]> {
  const tous: ModeleFal[] = [];
  for (const categorie of categories) {
    let curseur: string | null | undefined;
    for (let p = 0; p < PAGES_MAX; p++) {
      const url = `https://api.fal.ai/v1/models?category=${encodeURIComponent(categorie)}&limit=100${curseur ? `&cursor=${encodeURIComponent(curseur)}` : ""}`;
      const page = await lireJson<PageFal>(c.appeler, url, c.delaiMs);
      tous.push(...(page.models ?? []));
      if (!page.has_more || !page.next_cursor) break;
      curseur = page.next_cursor;
    }
  }
  return tous.filter((m) => m.metadata?.status !== "deprecated");
}

/** Lecture du catalogue déjà téléchargé (PUR). */
export function lectureFal(modeles: ModeleFal[], precedenteLe?: string): Lecture {
  if (!modeles.length) return { ok: false, raison: "Catalogue vide." };
  const tries = [...modeles].sort((a, b) => (b.metadata?.date ?? "").localeCompare(a.metadata?.date ?? ""));
  const recent = tries[0];
  const nouveaux = precedenteLe ? tries.filter((m) => (m.metadata?.date ?? "") > precedenteLe) : [];
  const notes = (nouveaux.length ? nouveaux : tries.slice(0, 3))
    .slice(0, 8)
    .map((m) => `${m.metadata?.display_name ?? m.endpoint_id} (${m.metadata?.category ?? "?"}) : ${(m.metadata?.description ?? "").slice(0, 160)}`)
    .join("\n");
  return {
    ok: true,
    version: recent.metadata?.display_name ?? recent.endpoint_id,
    date: recent.metadata?.date,
    lien: `https://fal.ai/models/${recent.endpoint_id}`,
    notes,
    empreinte: empreinte(tries.map((m) => m.endpoint_id).sort().join("\n")),
  };
}

export async function lireFal(categorie: string | undefined, c: ContexteLecture): Promise<Lecture> {
  try {
    return lectureFal(await catalogueFal(categorie ? [categorie] : CATEGORIES_FAL, c), c.precedente?.derniereVersionLe);
  } catch (e) {
    return { ok: false, raison: e instanceof SourceMuette ? e.raison : "La source ne répond pas." };
  }
}
