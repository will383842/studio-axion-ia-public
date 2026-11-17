/**
 * G12-09a-a : lecture du projet gardé et refus motivé, purs. Rien ne l'importe.
 * Reste (G12-09a-b) : l'état de reprise au pas « rendu » (sans Opus, sans recherche de vidéos, sans IA du plan de scènes) ;
 * puis G12-09b (chef, `index.ts`).
 * Aucun `Date`, aucun hasard, aucun service ni fournisseur ; `chaine-v4` en types seulement.
 */
import { schemaPlanFacecamAnimee, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { FichierVideoV4, GardeV4, RecadrageV4 } from "./chaine-v4";
import type { MemoPlanVideo } from "@/briques/plan-scenes-generateurs/video";
import { plaquettesSansVideo } from "./videos-v4";

export interface ProjetGardeV4 {
  priseCle: string;
  renduCle?: string;
  vignetteCle?: string;
  masterCle?: string;
  plan: PlanFacecamAnimee;
  gardes: GardeV4[];
  cadrage?: RecadrageV4;
  transcription?: { mots: unknown[]; dureeSec: number };
  videos?: { fichiers: FichierVideoV4[]; choix?: unknown[] };
  planScenes?: MemoPlanVideo;
}

export type ManqueRetoucheGratuite = "projet" | "videos";

export const CODE_RETOUCHE_GRATUITE_IMPOSSIBLE = "RETOUCHE_GRATUITE_IMPOSSIBLE";

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const chaine = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const fini = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function gardeValide(g: unknown): boolean {
  return estObjet(g) && fini(g.debutSec) && fini(g.finSec) && g.debutSec >= 0 && g.debutSec < g.finSec;
}

function cadrageValide(c: unknown): boolean {
  return estObjet(c) && fini(c.x) && fini(c.largeur) && fini(c.hauteur) && typeof c.visage === "boolean" && fini(c.centreX);
}

function transcriptionValide(t: unknown): boolean {
  return estObjet(t) && Array.isArray(t.mots) && fini(t.dureeSec);
}

function fichiersValides(f: unknown): f is FichierVideoV4[] {
  return Array.isArray(f) && f.every((v) => estObjet(v) && chaine(v.nom) && chaine(v.cle));
}

function planScenesValide(m: unknown): boolean {
  return estObjet(m) && typeof m.entree === "string" && Array.isArray(m.remarques) && (m.plan === null || estObjet(m.plan));
}

/** Lit un `projetMontage` ; `null` s'il est inutilisable. Ne lève jamais. Sortie en copie profonde. */
export function lireProjetGardeV4(x: unknown): ProjetGardeV4 | null {
  try {
    if (!estObjet(x) || !chaine(x.priseCle)) return null;
    const plan = schemaPlanFacecamAnimee.safeParse(x.plan);
    if (!plan.success) return null;
    if (!Array.isArray(x.gardes) || x.gardes.length === 0 || !x.gardes.every(gardeValide)) return null;
    const sortie: ProjetGardeV4 = {
      priseCle: x.priseCle,
      plan: structuredClone(plan.data),
      gardes: structuredClone(x.gardes as GardeV4[]),
    };
    if (chaine(x.renduCle)) sortie.renduCle = x.renduCle;
    if (chaine(x.vignetteCle)) sortie.vignetteCle = x.vignetteCle;
    if (chaine(x.masterCle)) sortie.masterCle = x.masterCle;
    if (cadrageValide(x.cadrage)) sortie.cadrage = structuredClone(x.cadrage as RecadrageV4);
    if (transcriptionValide(x.transcription)) {
      const t = x.transcription as { mots: unknown[]; dureeSec: number };
      sortie.transcription = structuredClone({ mots: t.mots, dureeSec: t.dureeSec });
    }
    if (estObjet(x.videos) && fichiersValides(x.videos.fichiers)) {
      sortie.videos = structuredClone({ fichiers: x.videos.fichiers, ...(Array.isArray(x.videos.choix) ? { choix: x.videos.choix } : {}) });
    }
    if (planScenesValide(x.planScenes)) sortie.planScenes = structuredClone(x.planScenes as MemoPlanVideo);
    return sortie;
  } catch {
    return null;
  }
}

/** Ce qui manque pour re-rendre sans frais ; `[]` : rien ne manque. Ne lève jamais. */
export function manquesRetoucheGratuiteV4(projet: unknown): ManqueRetoucheGratuite[] {
  const p = lireProjetGardeV4(projet);
  if (!p) return ["projet"];
  const elements = p.plan.elementsV4 ?? [];
  const exigeVideos = plaquettesSansVideo(p.plan).length > 0 || elements.some((e) => (e.medias?.length ?? 0) > 0);
  if (!exigeVideos) return [];
  const noms = new Set((p.videos?.fichiers ?? []).map((f) => f.nom));
  const manque = elements.some((e) => (e.medias ?? []).some((m) => m.startsWith("broll/") && !noms.has(m.slice("broll/".length))));
  return manque ? ["videos"] : [];
}

const REPLI = "déposez la prise à nouveau pour une nouvelle mise en scène.";
const RAISONS: Record<ManqueRetoucheGratuite, string> = {
  projet: "Cette vidéo n'a pas gardé ce qu'il faut pour être refaite sans frais.",
  videos: "Les vidéos d'illustration de cette version n'ont pas été gardées.",
};

/** `null` : un re-rendu gratuit est possible ; sinon la raison simple puis la phrase de repli actuelle. */
export function refusRetoucheGratuiteV4(projet: unknown): { code: string; message: string } | null {
  const manques = manquesRetoucheGratuiteV4(projet);
  if (manques.length === 0) return null;
  return {
    code: CODE_RETOUCHE_GRATUITE_IMPOSSIBLE,
    message: `${RAISONS[manques[0]]} La retouche d'une vidéo face caméra animée viendra plus tard : ${REPLI}`,
  };
}
