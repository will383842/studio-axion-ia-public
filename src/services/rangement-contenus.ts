/**
 * « À ranger » pour les carrousels et images (D3-07) : un contenu sans réseau prend un réseau en un geste.
 * Principe de /videos/a-ranger, sans le modifier. Tout est injecté (dépôt, verrou) : aucun appel réel ici.
 * Rejouer le même rangement ne change rien ; un contenu déjà rangé sous un autre réseau n'est jamais écrasé.
 */
import type { Reseau } from "@/briques/visuels/reseaux";
import type { Depot } from "@/domaine/depots";
import type { Visuel } from "@/domaine/visuels/visuel";

export interface DependancesRangement {
  depot: Depot<Visuel>;
  /** Un seul rangement à la fois : deux gestes simultanés ne s'écrasent pas. */
  verrou: <T>(f: () => Promise<T>) => Promise<T>;
}

export interface ContenuARanger {
  id: string;
  titre: string;
  famille: Visuel["famille"];
  modifieLe: string;
}

export type ResultatRangement = { ok: true; deja: boolean } | { ok: false; code: "INTROUVABLE" | "RESEAU_INVALIDE" | "DEJA_RANGE"; message: string };

/** Réseaux d'un carrousel ou d'une image (les vidéos ont leur propre écran). */
export const RESEAUX_RANGEMENT: readonly Reseau[] = ["linkedin", "instagram", "facebook"];

const sansReseau = (v: Visuel) => !v.corbeilleLe && (v.reseaux ?? []).length === 0;

/** Contenus hors corbeille sans réseau (absent ou vide), le plus récent d'abord. */
export async function listerContenusARanger(deps: Pick<DependancesRangement, "depot">): Promise<ContenuARanger[]> {
  const visuels = (await deps.depot.lister(sansReseau)).sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return visuels.map((v) => ({ id: v.id, titre: v.titre, famille: v.famille, modifieLe: v.modifieLe }));
}

/** Range le contenu sous ce réseau. Déjà rangé sous le même réseau : « deja », rien n'est écrit. */
export async function rangerContenu(id: string, reseau: string, deps: DependancesRangement): Promise<ResultatRangement> {
  const choisi = RESEAUX_RANGEMENT.find((r) => r === reseau);
  if (!choisi) return { ok: false, code: "RESEAU_INVALIDE", message: "Ce réseau n'est pas proposé pour un carrousel ou une image." };
  if (!id) return { ok: false, code: "INTROUVABLE", message: "Ce contenu n'existe plus." };
  return deps.verrou(async () => {
    const v = await deps.depot.obtenir(id);
    if (!v || v.corbeilleLe) return { ok: false, code: "INTROUVABLE", message: "Ce contenu n'existe plus." } as const;
    const actuels = [...new Set(v.reseaux ?? [])];
    if (actuels.length === 1 && actuels[0] === choisi) return { ok: true, deja: true } as const;
    if (actuels.length > 0) return { ok: false, code: "DEJA_RANGE", message: "Ce contenu a déjà son réseau." } as const;
    await deps.depot.modifier(id, { reseaux: [choisi] });
    return { ok: true, deja: false } as const;
  });
}
