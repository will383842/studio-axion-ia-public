/**
 * PROPRIÉTÉS DE LA COMPOSITION « TutorielOutil » (lot I) — PUR, imports de TYPES seulement, sans alias « @/ » : lu tel
 * quel par `studio-rendu/compositions/plan-scenes/TutorielOutil.tsx`.
 * La vidéo = le plan de scènes validé (outil en plein écran, pas de visage) + la voix + les sous-titres, puis la carte de
 * fin Axion (une légende « titre » aux couleurs de la charte, sans voix ni sous-titres).
 */
import type { DonneesCalque } from "../../briques/sous-titres/scene";
import type { FormatPlan, HabillagePlan, PlanValide } from "../../briques/plan-scenes/schema";

export const COMPOSITION_TUTORIEL = "TutorielOutil";

/** Format maître du tutoriel (décision du lot I) : 4:5, puis les autres formats demandés. */
export const RATIO_MAITRE_TUTORIEL = "4:5" as const;

type RatioTutoriel = "9:16" | "1:1" | "4:5" | "16:9";
const TAILLES: Record<RatioTutoriel, { largeur: number; hauteur: number }> = { "9:16": { largeur: 1080, hauteur: 1920 }, "4:5": { largeur: 1080, hauteur: 1350 }, "1:1": { largeur: 1080, hauteur: 1080 }, "16:9": { largeur: 1920, hauteur: 1080 } };

export function formatDuRatio(ratio: RatioTutoriel): FormatPlan {
  return { ...TAILLES[ratio], fps: 25 };
}

/** Habillage du tutoriel : fond ivoire, accent terracotta (l'orange n'existe que sur noir). */
export const HABILLAGE_TUTORIEL: HabillagePlan = { fond: "ivoire", accent: "terracotta" };

export const DUREE_CARTE_FIN_MS = 2500;
export const CARTE_FIN_AXION = { titre: "Axion IA", sousTitre: "axion-ia.com" } as const;

export interface ProprietesTutorielOutil {
  plan: PlanValide;
  /** Adresse signée de la voix (entrée « audio » de la demande de rendu) ; absente : vidéo muette. */
  audio?: string;
  /** Calque des sous-titres (brique coupée : absent). */
  sousTitres?: DonneesCalque;
  fin: { titre: string; sousTitre: string };
  finMs: number;
}

/** La carte de fin, dessinée par la pièce « légende » (style titre) du catalogue, au format et à l'habillage du plan. */
export function planCarteFin(p: Pick<ProprietesTutorielOutil, "plan" | "fin" | "finMs">): PlanValide {
  return {
    version: p.plan.version,
    format: p.plan.format,
    facecam: false,
    dureeMs: p.finMs,
    habillage: p.plan.habillage,
    mots: [],
    scenes: [
      {
        id: "fin",
        version: 1,
        empreinte: "0000000000000000",
        mots: { premier: 0, dernier: 0 },
        debutMs: 0,
        finMs: p.finMs,
        niveau: 1,
        position: "centre",
        transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
        piece: "legende",
        parametres: { texte: p.fin.titre, sousTexte: p.fin.sousTitre, style: "titre" },
      },
    ],
  };
}

export function imagesDe(ms: number, fps: number): number {
  return Math.max(1, Math.ceil((ms * fps) / 1000));
}

/** Durée totale en images : le plan, puis la carte de fin. */
export function dureeImagesTutoriel(p: Pick<ProprietesTutorielOutil, "plan" | "finMs">): number {
  return imagesDe(p.plan.dureeMs, p.plan.format.fps) + imagesDe(p.finMs, p.plan.format.fps);
}
