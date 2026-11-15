/**
 * Mémoire commune (C1-U5) : fusion pure des mémoires et lecture des choix figés des versions prêtes.
 * Module pur côté Studio : aucune lecture de base, aucun service, aucune horloge.
 */
import type { VersionVideo } from "@/domaine/types";
import type { EntreeBibliotheque, IdCapacite, ProfilVideo, UsageMemoire } from "./types";

export type VersionPourMemoire = Pick<VersionVideo, "videoId" | "statut" | "commande" | "projetMontage" | "creeLe">;

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Lecture tolérante d'un `Choix` (la lecture stricte de l'entrée entière est C1-U2). */
function lireChoix(x: unknown): { capacite: IdCapacite; cle: string } | null {
  if (!estObjet(x)) return null;
  const { capacite, cle, signature } = x;
  if (typeof capacite !== "string" || !/^[^.]+\..+$/.test(capacite)) return null;
  if (typeof cle !== "string" || cle === "") return null;
  if (signature !== undefined && typeof signature !== "string") return null;
  return { capacite: capacite as IdCapacite, cle };
}

function choixDe(conteneur: unknown): unknown[] {
  if (!estObjet(conteneur)) return [];
  const bv = conteneur.bibliothequeVideo;
  if (!estObjet(bv) || !Array.isArray(bv.choix)) return [];
  return bv.choix;
}

/** Choix figés des versions prêtes (commande et projet de montage). Ne lève jamais. */
export function choixFigesDesVersions(versions: readonly VersionPourMemoire[]): UsageMemoire[] {
  const sortie: UsageMemoire[] = [];
  const vus = new Set<string>();
  for (const version of versions) {
    try {
      if (version.statut !== "prete") continue;
      const commande: unknown = version.commande;
      const entrees = estObjet(commande) ? commande.entrees : undefined;
      const bruts = [...choixDe({ bibliothequeVideo: estObjet(entrees) ? entrees.bibliothequeVideo : undefined }), ...choixDe(version.projetMontage)];
      for (const brut of bruts) {
        const c = lireChoix(brut);
        if (!c) continue;
        const k = JSON.stringify([c.capacite, c.cle, version.videoId]);
        if (vus.has(k)) continue;
        vus.add(k);
        sortie.push({ capacite: c.capacite, cle: c.cle, videoId: version.videoId, source: "bibliotheque-video", le: version.creeLe });
      }
    } catch {
      /* version illisible : ignorée seule */
    }
  }
  return sortie;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Réunit les sources, sans doublon exact, ordre total, fenêtre en vidéos récentes.
 * `portee` n'est pas filtrée ici : la portée `format` est appliquée par le lecteur des mémoires (C1-U6a),
 * qui ne lit que les vidéos du format.
 */
export function fusionnerMemoires(
  sources: readonly (readonly UsageMemoire[])[],
  fenetre: ProfilVideo["memoire"],
): UsageMemoire[] {
  if (!(fenetre.fenetreVideos > 0)) return [];
  const uniques = new Map<string, UsageMemoire>();
  for (const s of sources) for (const x of s) uniques.set(JSON.stringify([x.capacite, x.cle, x.videoId, x.source]), x);
  const tries = [...uniques.values()].sort(
    (a, b) => cmp(b.le, a.le) || cmp(a.videoId, b.videoId) || cmp(a.capacite, b.capacite) || cmp(a.cle, b.cle) || cmp(a.source, b.source),
  );
  const recentes = new Map<string, string>();
  for (const x of tries) if (!recentes.has(x.videoId)) recentes.set(x.videoId, x.le);
  const gardees = new Set(
    [...recentes.entries()]
      .sort((a, b) => cmp(b[1], a[1]) || cmp(a[0], b[0]))
      .slice(0, Math.floor(fenetre.fenetreVideos))
      .map(([id]) => id),
  );
  return tries.filter((x) => gardees.has(x.videoId));
}

/** Projection `{ capacite, cle, videoId }`, ordre conservé. */
export function versRecents(usages: readonly UsageMemoire[]): EntreeBibliotheque["recents"] {
  return usages.map(({ capacite, cle, videoId }) => ({ capacite, cle, videoId }));
}
