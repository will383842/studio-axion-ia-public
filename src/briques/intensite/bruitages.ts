/**
 * BRUITAGES MODERNES — placement (lot du 02/10, D1 ; consigne `INTENSITE-ET-BRUITAGES.md` §2). Brique commune, PURE.
 *
 * Un son ne se pose que s'il CORRESPOND À CE QU'ON VOIT : « tic » sur un chiffre, papier sur un document, vibration sur
 * un téléphone, souffle court à l'entrée d'une illustration forte, « pop » grave sous un Impact. Jamais à chaque coupe.
 * Règles (`REGLES_BRUITAGES`) : 18-24 dB sous la voix (le mixage vise 21), passe-haut 120 Hz, légèrement AVANT le mot
 * clé (jamais pendant), au plus un toutes les 10 s, jamais sur la même coupe qu'un zoom, aucun dans la dernière seconde,
 * variantes sans répétition consécutive. Seuls les sons ÉCOUTÉS ET VALIDÉS par Will arrivent ici (le service filtre).
 * Choix par plan : « retirer le son » (aucun son dans ce plan) ou « ajouter un son » (posé au début du plan, passe
 * toujours, compte dans la courbe).
 */
import type { BruitageDisponible, ChoixBruitagePlan, DeclencheurBruitage, ReglageBruitages } from "@/domaine/types";
import { REGLES_BRUITAGES, type BruitagePlace, type DemandeEffet } from "./types";

/** Gain visé sous la voix (dB) : le milieu de 18-24 dB. Le mixage le mesure sur la voix réelle (studio-rendu). */
export const GAIN_SOUS_VOIX_DB = -(REGLES_BRUITAGES.sousVoixDb[0] + REGLES_BRUITAGES.sousVoixDb[1]) / 2;

/** Ce qui, à l'image, peut appeler un son (fourni par l'orchestration du montage, effets RETENUS seulement). */
export interface DeclencheurVu {
  declencheur: DeclencheurBruitage;
  /** Instant où la chose apparaît (le son tombe juste avant). */
  instantSec: number;
  planId?: string;
}

export interface EntreePlacementBruitages {
  reglage: ReglageBruitages;
  disponibles: BruitageDisponible[];
  vus: DeclencheurVu[];
  dureeSec: number;
  /** Débuts des zooms lents retenus : jamais un son sur la même coupe. */
  zoomsSec: number[];
  /** Plans et leur choix « retirer / ajouter » (Aperçu ou après fabrication). */
  plans: { id: string; debutSec: number; finSec: number; choix?: ChoixBruitagePlan }[];
  /** Graine stable de la vidéo (variantes différentes d'une vidéo à l'autre, identiques à chaque recalcul). */
  graine: number;
}

/** Ce qu'une intention d'illustration montre : document, téléphone, ou une image forte. */
export function declencheurIllustration(requete: string | undefined): DeclencheurBruitage {
  const t = (requete ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\b(telephone|smartphone|portable|sms|texto|notification|message)s?\b/.test(t)) return "telephone";
  if (/\b(document|papier|contrat|lettre|avis|courrier|dossier|formulaire|facture|feuille|bulletin|attestation|convocation|proces-verbal|pv)s?\b/.test(t)) return "document";
  return "illustration-forte";
}

/** Durée posée d'un son : la sienne, plafonnée par la règle de son déclencheur. */
export function dureePosee(declencheur: DeclencheurBruitage, dureeSec: number): number {
  return Math.min(dureeSec, REGLES_BRUITAGES.dureeMaxMs[declencheur] / 1000);
}

/**
 * Variante d'un son : tour à tour, depuis un départ tiré de la graine, sans jamais la même deux fois de suite pour un
 * même déclencheur (`derniere`). PUR.
 */
export function choisirVariante(sons: BruitageDisponible[], rang: number, graine: number, derniere?: string): BruitageDisponible | undefined {
  const tries = [...sons].sort((a, b) => a.variante - b.variante || a.elementId.localeCompare(b.elementId));
  if (!tries.length) return undefined;
  const n = tries.length;
  let k = (rang + (graine % n)) % n;
  if (n > 1 && tries[k].elementId === derniere) k = (k + 1) % n;
  return tries[k];
}

/**
 * Ordre de préférence quand deux sons sont à moins de 10 s : ce qui RACONTE quelque chose à l'image d'abord
 * (téléphone, document, chiffre), puis l'entrée d'une image forte, puis le « pop » d'un Impact.
 */
export const PREFERENCE_DECLENCHEURS: Record<DeclencheurBruitage, number> = { telephone: 0, document: 1, chiffre: 2, "illustration-forte": 3, impact: 4 };

/** Candidats triés : les « ajouter » de Will d'abord (ils passent toujours), puis la préférence, puis l'ordre du temps. */
export function candidatsBruitages(e: EntreePlacementBruitages): { demande: DemandeEffet; declencheur: DeclencheurBruitage; elementId?: string; force: boolean }[] {
  const sortie: { demande: DemandeEffet; declencheur: DeclencheurBruitage; elementId?: string; force: boolean }[] = [];
  const planA = (t: number) => e.plans.find((p) => t >= p.debutSec - 1e-6 && t < p.finSec - 1e-6);
  // Choix « ajouter » : posé au début du plan (choix explicite de Will). En « Aucun », aucun son n'est disponible.
  for (const p of e.plans) {
    if (p.choix?.mode !== "ajoute") continue;
    const debut = Math.max(0, p.debutSec);
    sortie.push({ declencheur: p.choix.declencheur, elementId: p.choix.elementId, force: true, demande: { id: `bruitage:plan:${p.id}`, type: "bruitage", debutSec: +debut.toFixed(3), finSec: +(debut + REGLES_BRUITAGES.dureeMaxMs[p.choix.declencheur] / 1000).toFixed(3), priorite: "verrouille", origine: "bruitages", planId: p.id } });
  }
  if (e.reglage !== "aucun") {
    const avant = REGLES_BRUITAGES.ecartMotCleSec;
    for (const v of [...e.vus].sort((a, b) => PREFERENCE_DECLENCHEURS[a.declencheur] - PREFERENCE_DECLENCHEURS[b.declencheur] || a.instantSec - b.instantSec)) {
      const debut = +Math.max(0, v.instantSec - avant).toFixed(3);
      const plan = planA(v.instantSec);
      if (plan?.choix) continue; // « retirer » : aucun son ; « ajouter » : déjà posé ci-dessus.
      const duree = REGLES_BRUITAGES.dureeMaxMs[v.declencheur] / 1000;
      sortie.push({ declencheur: v.declencheur, force: false, demande: { id: `bruitage:${v.declencheur}:${debut.toFixed(2)}`, type: "bruitage", debutSec: debut, finSec: +(debut + duree).toFixed(3), priorite: "normale", origine: "bruitages", planId: plan?.id, decalageMaxSec: 0 } });
    }
  }
  return sortie;
}

/**
 * Règles propres aux sons (avant l'arbitrage de la courbe) : dernière seconde, intervalle de 10 s, coupe d'un zoom,
 * un son disponible pour ce déclencheur. Les « ajouter » de Will passent toujours. Renvoie la raison d'un refus.
 */
export function refusBruitage(c: { demande: DemandeEffet; declencheur: DeclencheurBruitage; force: boolean }, poses: BruitagePlace[], e: Pick<EntreePlacementBruitages, "dureeSec" | "zoomsSec" | "disponibles">): string | null {
  const R = REGLES_BRUITAGES;
  if (!e.disponibles.some((s) => s.declencheur === c.declencheur)) return "aucun son validé pour ce déclencheur";
  if (c.force) return null;
  if (c.demande.finSec > e.dureeSec - R.pasDansDerniereSec + 1e-6) return "dernière seconde";
  if (poses.some((p) => Math.abs(p.debutSec - c.demande.debutSec) < R.intervalleMinSec - 1e-6)) return "moins de 10 s après un autre son";
  if (e.zoomsSec.some((z) => Math.abs(z - c.demande.debutSec) < 0.3)) return "même coupe qu'un zoom";
  return null;
}
