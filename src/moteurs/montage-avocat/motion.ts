/**
 * ADAPTATEUR « MOTION DESIGN COMMUN » DU FORMAT AVOCAT (mission H). PUR.
 *
 * Option FACULTATIVE, figée au lancement depuis le réglage caché `avocat.motionCommune` (coupé par défaut) :
 * `commande.entrees.avocatMotionCommune`. Absente : `null` partout, l'avocat est monté EXACTEMENT comme avant.
 *
 * Allumée : aux endroits où l'avocat pose aujourd'hui ses illustrations et ses titres à l'écran (annotations
 * `illustration`, `titreEcran`, mots en `emphase`), l'avocat demande des cartes à la brique commune `motion` par SON
 * API UNIQUE (`cartesPourFormat`) : même choix de modèle d'après la phrase (`choisirModele`), même choix de style
 * (`choisirStyleMotion` : demande, habitude, intensité), même catalogue (6 modèles, puis 7 à 13 sans rien changer ici).
 * Une carte plein écran remplace l'illustration du plan (rien n'est fabriqué ni payé pour ce plan) ; une carte qui ne se
 * rend pas laisse le double à sa place (comme une illustration sans fichier). Jamais de bandeau nom ni de marque.
 */
import { cartesPourFormat, ratiosMotion, type CarteFormat, type PhraseMotion } from "@/briques/motion";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { PlanProduit } from "../types";

/** Clé de la commande (figée au lancement par le service, comme `facecamDecorIa`). */
export const ENTREE_MOTION_AVOCAT = "avocatMotionCommune";
/** Réglage caché (aucun écran), coupé par défaut. */
export const PARAM_MOTION_AVOCAT = "avocat.motionCommune";

export interface OptionMotionAvocat {
  actif: true;
  /** Phrases de Will pour toute la vidéo (style : « en spectaculaire »), consignes du monteur comprises. */
  demandes?: string[];
  /** « Mes habitudes » (style). */
  habitude?: string[];
}

/** Lecture tolérante : au moindre doute, l'option reste coupée. */
export function optionMotionAvocat(c: Pick<CommandeFabrication, "entrees">): OptionMotionAvocat | null {
  const brut = c.entrees?.[ENTREE_MOTION_AVOCAT];
  if (brut === true) return { actif: true };
  if (!brut || typeof brut !== "object" || (brut as { actif?: unknown }).actif !== true) return null;
  const o = brut as { demandes?: unknown; habitude?: unknown };
  const textes = (x: unknown) => (Array.isArray(x) ? x.filter((t): t is string => typeof t === "string" && t.length <= 500).slice(0, 20) : undefined);
  return { actif: true, ...(textes(o.demandes)?.length ? { demandes: textes(o.demandes) } : {}), ...(textes(o.habitude)?.length ? { habitude: textes(o.habitude) } : {}) };
}

/** Le strict nécessaire d'un segment du texte (annotations de la recette avocat). */
export interface SegmentMotionAvocat {
  id: string;
  texte: string;
  titreEcran?: string;
  emphase?: string[];
  intentionIllustration?: string;
}

/**
 * Les phrases où l'avocat accepte une carte : un plan d'illustration (ou un segment qui en demande une), un titre à
 * l'écran, ou des mots mis en valeur. Les autres plans ne sont jamais touchés.
 */
export function phrasesMotionAvocat(plans: readonly PlanProduit[], segments: readonly SegmentMotionAvocat[]): PhraseMotion[] {
  const parId = new Map(segments.map((s) => [s.id, s]));
  const phrases: PhraseMotion[] = [];
  for (const p of plans) {
    const s = parId.get(p.segmentId);
    const texte = (s?.texte ?? p.texte ?? "").trim();
    if (!texte) continue;
    const base = { id: `plan-${p.ordre}`, texte, debutSec: p.debutSec, finSec: p.finSec, ...(s?.emphase?.length ? { emphase: s.emphase } : {}) };
    if (s?.titreEcran?.trim()) phrases.push({ ...base, place: "titre", textes: [s.titreEcran.trim()] });
    else if (p.sourceImage === "illustration" || s?.intentionIllustration) phrases.push({ ...base, place: "illustration" });
    else if (s?.emphase?.length || p.motsEnValeur?.length) phrases.push({ ...base, place: "emphase" });
  }
  return phrases;
}

export interface PoseMotionAvocat {
  /** Plans de l'avocat : ceux qui reçoivent une carte perdent leur illustration (le double la remplace si la carte rate). */
  plans: PlanProduit[];
  /** Cartes à rendre (une par ratio de la vidéo). */
  cartes: CarteFormat[];
}

/**
 * Cartes de l'avocat pour toute la vidéo (tous ses ratios), par l'API unique de la brique. Au plus une carte toutes les
 * 12 s de vidéo (l'avocat reste un format de parole), jamais avant 1,5 s (l'accroche reste sur le visage).
 */
export function poserMotionAvocat(c: Pick<CommandeFabrication, "ratios" | "intensite">, option: OptionMotionAvocat, plans: PlanProduit[], segments: readonly SegmentMotionAvocat[], mots: readonly MotHorodate[], dureeSec: number): PoseMotionAvocat {
  const phrases = phrasesMotionAvocat(plans, segments).filter((p) => p.debutSec >= 1.5);
  const maxCartes = Math.max(1, Math.floor(dureeSec / 12));
  const cartes = ratiosMotion(c.ratios).flatMap((ratio) =>
    cartesPourFormat({
      format: "avocat",
      ratio,
      phrases,
      intensite: c.intensite?.niveau ?? null,
      demandes: option.demandes,
      habitude: option.habitude,
      mots: mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec })),
      maxCartes,
      dureeVideoSec: dureeSec,
    }),
  );
  const couverts = new Set(cartes.map((x) => x.phraseId));
  const suite = plans.map((p) => (couverts.has(`plan-${p.ordre}`) && p.sourceImage === "illustration" ? { ...p, sourceImage: "double" as const, illustration: undefined } : p));
  return { plans: suite, cartes };
}

/** Résumé gardé dans le projet de montage (léger : ni code ni paramètres de rendu). */
export function resumeMotionAvocat(cartes: readonly { id: string; ratio: string; debutSec: number; finSec: number; modele: string; statut?: string }[]): { id: string; ratio: string; debutSec: number; finSec: number; modele: string; statut: string }[] {
  return cartes.map((x) => ({ id: x.id, ratio: x.ratio, debutSec: x.debutSec, finSec: x.finSec, modele: x.modele, statut: x.statut ?? "prevue" }));
}
