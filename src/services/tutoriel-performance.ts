/**
 * T-EXT-48a · BOUCLE DE PERFORMANCE DU TUTORIEL D'OUTIL : lecture seule, branchée nulle part.
 *
 * Range les vidéos tutoriel réellement parties avec les règles communes de `mesures-rangs.ts`. N'écrit aucune statistique
 * (l'import des chiffres reste à `importerMesures`), ne touche pas aux « versions du générateur » de `mesures-completes.ts`
 * (autre famille, comparée dans sa propre fenêtre). Une donnée absente reste absente : jamais un zéro.
 * En production AUCUN lecteur n'est injecté : `stats` est déjà remplie par `importerMesures`. Le lecteur injecté ne sert
 * qu'aux tests.
 */
import "server-only";
import {
  estMesuree,
  resultatsDepuisStats,
  tousLesRangs,
  visitesParCode,
  type LigneLien,
  type ResultatsVideo,
  type VideoMesuree,
} from "@/domaine/mesures-rangs";
import { videoIdSure, type Publication, type ReseauDeclinaison, type VersionVideo } from "@/domaine/types";
import {
  FORMAT_TUTORIEL,
  GABARITS_TUTORIEL,
  lecturePerformance,
  traitsTutoriel,
  type CasTutoriel,
  type IdGabarit,
  type LecturePerformance,
} from "@/moteurs/montage-tutoriel-outil/performance";
import { depots, filtreExemples } from "./_commun";
import type { StatistiquesLues } from "./lecteur-statistiques";

export interface DependancesPerformance {
  depots: typeof depots;
  /** Lit la ligne de statistiques d'une publication (client injecté, tests seulement). Une erreur = pas de chiffres. */
  lireStats?: (idExterne: string) => Promise<Pick<StatistiquesLues, "vues" | "portee" | "partages" | "commentaires"> | null>;
  /** Lignes de liens suivis déjà lues ailleurs (statistiques du site). Absentes : pas de rendez-vous. */
  liensSuivis?: readonly LigneLien[];
}

const GABARITS: readonly string[] = GABARITS_TUTORIEL;
const objet = (x: unknown): Record<string, unknown> | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);

/** Gabarit, cas et ouverture gardés dans le projet de la version (cahier T-EXT-18, fiche de valeur T-EXT-20). Absent : absent. */
export function traitsDuProjet(projet: Record<string, unknown> | undefined): { gabarit?: IdGabarit; cas?: CasTutoriel; devient?: string } {
  const t = objet(projet?.tutoriel);
  const cahier = objet(t?.cahier);
  const fiche = objet(t?.ficheValeur);
  const g = Array.isArray(cahier?.gabarits) ? cahier.gabarits[0] : undefined;
  const cas = cahier?.cas;
  const devient = objet(fiche?.gainEntreprise)?.devient;
  return {
    ...(typeof g === "string" && GABARITS.includes(g) ? { gabarit: g as IdGabarit } : {}),
    ...(typeof cas === "number" && Number.isInteger(cas) && cas >= 1 && cas <= 5 ? { cas: cas as CasTutoriel } : {}),
    ...(typeof devient === "string" && devient ? { devient } : {}),
  };
}

function campagne(lien: string | undefined): string | undefined {
  if (!lien) return undefined;
  try {
    return new URL(lien).searchParams.get("utm_campaign")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function chiffres(p: Publication, dep: DependancesPerformance): Promise<ResultatsVideo> {
  let r = resultatsDepuisStats(p.stats);
  const vide = !p.stats || Object.keys(r).every((k) => r[k as keyof ResultatsVideo] === undefined);
  if (vide && dep.lireStats && p.idExterne) {
    try {
      const l = await dep.lireStats(p.idExterne);
      const vues = typeof l?.vues === "number" && Number.isFinite(l.vues) && l.vues > 0 ? l.vues : undefined;
      if (vues !== undefined) r = { ...r, vues };
    } catch {
      /* lecture en échec : la vidéo reste sans chiffres */
    }
  }
  const code = campagne(p.lienSuivi);
  if (code && dep.liensSuivis) {
    const ligne = visitesParCode(dep.liensSuivis).get(code);
    if (ligne) r = { ...r, visites: ligne.visites, rendezVous: ligne.rendezVous };
  }
  return r;
}

/** Vidéos tutoriel réellement parties et mesurées (au moins un chiffre). Aucune écriture. */
export async function collecterTutorielsMesures(dep: DependancesPerformance = { depots }): Promise<VideoMesuree[]> {
  const d = dep.depots();
  const ex = await filtreExemples<Publication>();
  const archivees = new Set((await d.videos.lister((v) => v.statut === "archivee")).map((v) => v.id));
  const pubs = await d.publications.lister((p) => ex(p) && p.via !== "simulation" && p.statut === "publiee" && !!videoIdSure(p) && !archivees.has(videoIdSure(p)!));
  const r: VideoMesuree[] = [];
  for (const p of pubs) {
    const videoId = videoIdSure(p)!;
    const video = await d.videos.obtenir(videoId);
    if (!video || video.formatId !== FORMAT_TUTORIEL) continue;
    const versions = (await d.versions.lister((v: VersionVideo) => v.videoId === videoId && v.statut === "prete")).sort((a, b) => Number(b.choisie) - Number(a.choisie) || b.numero - a.numero);
    const t = traitsDuProjet(versions[0]?.projetMontage);
    const mesuree: VideoMesuree = {
      ...traitsTutoriel({ reseau: p.reseau as ReseauDeclinaison, dureeSec: video.dureeCibleSec, ...t }),
      publicationId: p.id,
      varianteId: videoId,
      code: campagne(p.lienSuivi) ?? videoId,
      titre: video.titre,
      date: p.date,
      resultats: await chiffres(p, dep),
      ...(p.estDemo ? { exemple: true } : {}),
    };
    if (estMesuree(mesuree)) r.push(mesuree);
  }
  return r;
}

/** Lecture des performances du tutoriel : rangs par réseau (20 dernières vidéos), puis gabarits et ouvertures. */
export async function lirePerformanceTutoriel(dep: DependancesPerformance = { depots }): Promise<LecturePerformance> {
  return lecturePerformance(tousLesRangs(await collecterTutorielsMesures(dep)));
}
