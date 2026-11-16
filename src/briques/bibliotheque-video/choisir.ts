/**
 * Choix pur et déterministe d'une capacité (C1-U4) : filtres, plafond, anti-répétition, refus motivé.
 * Aucun service, aucune date, aucun hasard, aucun réglage. Ne lève jamais.
 * Module côté Studio seulement : jamais importé par `studio-rendu/**`.
 */
import { rangGraine } from "./graine";
import { familleDe } from "./noms";
import type { Candidat, Choix, IdCapacite, ProfilVideo, UsageMemoire } from "./types";

export interface Besoin { capacite: IdCapacite; nombre?: number; graine: string }

/** Même forme que `EntreeBibliotheque.recents` : la plus récente d'abord. */
export type Historique = readonly Pick<UsageMemoire, "capacite" | "cle" | "videoId">[];

export type RaisonRefus = "capacite-non-permise" | "aucun-candidat" | "plafond-atteint";

export type ResultatChoix<C extends Candidat> =
  | { ok: true; choisis: C[]; repli?: true }
  | { ok: false; raison: RaisonRefus; phrase: string };

const PHRASES: Record<RaisonRefus, string> = {
  "capacite-non-permise": "Cette capacité n'est pas permise pour ce format.",
  "aucun-candidat": "Aucun candidat ne convient pour cette capacité.",
  "plafond-atteint": "Le nombre maximum pour cette capacité dans la vidéo est déjà atteint.",
};
const refus = <C extends Candidat>(raison: RaisonRefus): ResultatChoix<C> => ({ ok: false, raison, phrase: PHRASES[raison] });

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function choisir<C extends Candidat>(
  profil: ProfilVideo,
  besoin: Besoin,
  candidats: readonly C[],
  historique: Historique,
  dejaChoisis: readonly Choix[],
): ResultatChoix<C> {
  try {
    const cap = besoin.capacite;
    // Filtre 1 : règle absente ou non permise, ou verrou (capacité entière ou famille).
    const regle = profil.capacites[cap];
    if (!regle || regle.permis !== true) return refus("capacite-non-permise");
    if (profil.verrous.includes(cap) || profil.verrous.includes(familleDe(cap))) return refus("capacite-non-permise");

    // Plafond.
    const pris = dejaChoisis.filter((d) => d.capacite === cap);
    let reste = Infinity;
    if (typeof regle.maxParVideo === "number") {
      reste = regle.maxParVideo - pris.length;
      if (!(reste > 0)) return refus("plafond-atteint");
    }
    const demande = Number.isFinite(besoin.nombre) ? Math.max(1, Math.floor(besoin.nombre as number)) : 1;
    const nombre = Math.min(demande, reste);

    // Filtre 2 (A1-4) : la capacité du candidat doit être celle du besoin, avec une règle présente et permise.
    const dejaCles = new Set(pris.map((d) => d.cle));
    const uniques = new Map<string, C>();
    for (const c of candidats) {
      if (!c || typeof c !== "object" || typeof c.cle !== "string" || c.cle === "") continue;
      if (c.capacite !== cap) continue;
      const r = profil.capacites[c.capacite];
      if (!r || r.permis !== true) continue;
      if (dejaCles.has(c.cle)) continue;
      const vu = uniques.get(c.cle);
      if (!vu || cmp(c.id, vu.id) < 0) uniques.set(c.cle, c);
    }
    if (uniques.size === 0) return refus("aucun-candidat");

    // Anti-répétition : rang de la dernière utilisation (0 = la plus récente) dans l'historique de la capacité.
    const dernier = new Map<string, number>();
    let i = 0;
    for (const h of historique) {
      if (h.capacite !== cap) continue;
      if (!dernier.has(h.cle)) dernier.set(h.cle, i);
      i++;
    }
    const rang = new Map<string, string>();
    for (const cle of uniques.keys()) rang.set(cle, rangGraine(besoin.graine, cle));
    const parGraine = (a: C, b: C) => cmp(rang.get(a.cle)!, rang.get(b.cle)!) || cmp(a.cle, b.cle);

    const tous = [...uniques.values()];
    const neufs = tous.filter((c) => !dernier.has(c.cle)).sort(parGraine);
    const choisis = neufs.slice(0, nombre);
    let repli = false;
    if (choisis.length < nombre) {
      const vieux = tous
        .filter((c) => dernier.has(c.cle))
        .sort((a, b) => dernier.get(b.cle)! - dernier.get(a.cle)! || parGraine(a, b));
      choisis.push(...vieux.slice(0, nombre - choisis.length));
      repli = true;
    }
    return repli ? { ok: true, choisis, repli: true } : { ok: true, choisis };
  } catch {
    return refus("aucun-candidat");
  }
}
