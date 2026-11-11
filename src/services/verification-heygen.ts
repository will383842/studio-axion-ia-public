/**
 * VÉRIFICATION GRATUITE DU DOUBLE HEYGEN AVANT TOUTE DÉPENSE (11/11/2026). Juste avant l'estimation et la réservation,
 * on relit (lecture seule) la liste des doubles / looks / voix du compte HeyGen :
 *  - double ou look de décor ABSENT : refus clair, rien n'est dépensé ;
 *  - double présent mais pas prêt : refus clair ;
 *  - voix absente : seulement journalisée (jamais bloquante) ;
 *  - HeyGen injoignable, liste vide ou peut-être tronquée : on laisse passer (journal), rien de concluant.
 * Un double disparu pour lequel un remplaçant prêt du MÊME angle existe est rangé automatiquement.
 * Le cache de 60 s ne dit JAMAIS « absent » : un absent est toujours relu à neuf.
 */
import "server-only";
import type { AngleVisage, Id } from "@/domaine/types";
import { resoudreFournisseur } from "@/fournisseurs";
import type { AVerifierHeygen } from "@/moteurs/types";
import { depots, ErreurStudio, journaliser, ressourceActive } from "./_commun";
import { doublesAbsents, fournisseurHeygen, rangerDoublesAbsents } from "./doubles-heygen";

export const DUREE_CACHE_HEYGEN_MS = 60_000;
/** 20 pages de 50 (doubles, looks) ou de 100 (voix) : une liste de cette taille est peut-être tronquée. */
const PLAFOND_DOUBLES = 20 * 50;
const PLAFOND_VOIX = 20 * 100;

type Liste<T> = { quand: number; items: T[] };
type Cle = "doubles" | "looks" | "voix";
const cache: Partial<Record<Cle, Liste<never>>> = {};

export function oublierCacheVerificationHeygen(): void {
  delete cache.doubles;
  delete cache.looks;
  delete cache.voix;
}

/** Lit une liste (cache 60 s). `null` : non concluant (injoignable, vide, peut-être tronquée). */
async function lire<T>(cle: Cle, lecteur: () => Promise<T[]>, plafond: number): Promise<{ items: T[]; frais: boolean } | null> {
  const c = cache[cle] as Liste<T> | undefined;
  if (c && Date.now() - c.quand < DUREE_CACHE_HEYGEN_MS) return { items: c.items, frais: false };
  let items: T[];
  try {
    items = await lecteur();
  } catch (e) {
    await journaliser("fabrication", `Vérification HeyGen non concluante (${cle}) : ${(e as Error).name}. La vidéo part quand même.`);
    return null;
  }
  if (items.length === 0 || items.length >= plafond) {
    await journaliser("fabrication", `Vérification HeyGen non concluante (${cle}) : liste ${items.length === 0 ? "vide" : "peut-être tronquée"}. La vidéo part quand même.`);
    return null;
  }
  cache[cle] = { quand: Date.now(), items } as Liste<never>;
  return { items, frais: true };
}

const MESSAGE_DOUBLE_ABSENT = "Votre double HeyGen n'existe plus. Dans Personnages, « Choisir mon double HeyGen », reliez-le de nouveau. Rien n'a été dépensé.";
const MESSAGE_DECOR_ABSENT = "Le look HeyGen de votre décor n'existe plus. Dans Bibliothèque, Décors, reliez-en un autre. Rien n'a été dépensé.";

export async function verifierHeygenAvantPaiement(a: AVerifierHeygen): Promise<void> {
  if (!a.doubles.length && !a.looksDecor.length && !a.voix) return;
  const { f, branche } = fournisseurHeygen();
  if (!branche) return;

  // 1. Doubles.
  if (a.doubles.length && f.listerDoubles) {
    const lister = f.listerDoubles.bind(f);
    let r = await lire("doubles", lister, PLAFOND_DOUBLES);
    const absentsDe = (items: { idExterne: string }[]) => a.doubles.filter((d) => !items.some((x) => x.idExterne === d.idExterne));
    // Un cache ne dit jamais « absent » : relecture à neuf.
    if (r && !r.frais && absentsDe(r.items).length) {
      oublierCacheVerificationHeygen();
      r = await lire("doubles", lister, PLAFOND_DOUBLES);
    }
    if (r) {
      for (const d of a.doubles) {
        const trouve = r.items.find((x) => x.idExterne === d.idExterne);
        if (trouve && !trouve.utilisable) throw new ErreurStudio("DOUBLE_PAS_PRET", `${trouve.raison ?? "Ce double n'est pas encore prêt chez HeyGen."} Rien n'a été dépensé.`);
      }
      const absents = absentsDe(r.items);
      if (absents.length) await signalerDoublesAbsents(a, r.items);
    }
  }

  // 2. Looks de décor (jamais contre la liste des doubles).
  if (a.looksDecor.length && f.listerLooks) {
    const lister = f.listerLooks.bind(f);
    let r = await lire("looks", lister, PLAFOND_DOUBLES);
    const manque = (items: { idExterne: string }[]) => a.looksDecor.some((l) => !items.some((x) => x.idExterne === l));
    if (r && !r.frais && manque(r.items)) {
      oublierCacheVerificationHeygen();
      r = await lire("looks", lister, PLAFOND_DOUBLES);
    }
    if (r && manque(r.items)) throw new ErreurStudio("DECOR_DISPARU", MESSAGE_DECOR_ABSENT);
  }

  // 3. Voix : seulement journalisée.
  if (a.voix) {
    const vf = resoudreFournisseur("voix", "heygen");
    if (vf.id === "heygen" && vf.mode === "reel" && vf.listerVoixExistantes) {
      const r = await lire("voix", () => vf.listerVoixExistantes(), PLAFOND_VOIX);
      if (r && !r.items.some((x) => x.idExterne === a.voix)) await journaliser("fabrication", "La voix HeyGen de cette vidéo n'apparaît plus dans votre compte HeyGen (non bloquant).");
    }
  }
}

async function signalerDoublesAbsents(a: AVerifierHeygen, presents: { idExterne: string }[]): Promise<never> {
  const personnageId = a.personnageId;
  if (personnageId) {
    const ids = new Set(presents.map((x) => x.idExterne));
    const aRanger = await doublesAbsents(personnageId, ids);
    const visages = await depots().visages.lister((v) => v.personnageId === personnageId);
    for (const ab of a.doubles.filter((d) => !ids.has(d.idExterne))) {
      const ancien = aRanger.find((x) => x.id === ab.visageId);
      if (!ancien) continue;
      const remplacant = await remplacantPret(visages, ab.angle, ids, ab.visageId);
      if (remplacant) {
        await rangerDoublesAbsents(personnageId, [ancien], remplacant);
        throw new ErreurStudio("DOUBLE_DISPARU", `Votre double HeyGen « ${ancien.nom} » n'existe plus : « ${remplacant.nom} » le remplace désormais. Relancez la vidéo. Rien n'a été dépensé.`);
      }
    }
  }
  throw new ErreurStudio("DOUBLE_DISPARU", MESSAGE_DOUBLE_ABSENT);
}

/** Un autre visage HeyGen prêt du même angle, dont la ressource active est présente dans le compte. */
async function remplacantPret(visages: { id: Id; nom: string; angle: AngleVisage; fournisseur?: string; statut: string }[], angle: AngleVisage, presents: Set<string>, sauf: Id): Promise<{ id: Id; nom: string } | null> {
  for (const v of visages) {
    if (v.id === sauf || v.fournisseur !== "heygen" || v.statut !== "pret" || v.angle !== angle) continue;
    const r = await ressourceActive(v.id);
    if (r?.fournisseur === "heygen" && presents.has(r.idExterne)) return { id: v.id, nom: v.nom };
  }
  return null;
}
