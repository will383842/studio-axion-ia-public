/**
 * Lecture (sans rien écrire) des mémoires existantes (C1-U6a) : cartes avocat, familles et extraits v4, illustrations,
 * choix déjà figés. Chaque source est dans son `try/catch` : en échec, liste vide et `console.warn`. Ne lève jamais.
 * Les filtres des lectures existantes sont RECOPIÉS (avec le `videoId` en plus) : aucun import de leurs services.
 */
import "server-only";
import { choixFigesDesVersions, fusionnerMemoires } from "@/briques/bibliotheque-video/memoire";
import { ID } from "@/briques/bibliotheque-video/noms";
import type { ProfilVideo, SourceMemoire, UsageMemoire } from "@/briques/bibliotheque-video/types";
import type { Travail } from "@/domaine/types";
import { ID_MOTEUR_FACECAM_ANIMEE } from "@/moteurs/montage-facecam-animee";
import { lireEtatV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { historiqueDuPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { depots } from "./_commun";

export interface UsageHorsCatalogue { source: SourceMemoire; cle: string; videoId: string; rang: number /* 0 = le plus récent */ }
export interface MemoiresLues {
  usages: UsageMemoire[];
  horsCatalogue: UsageHorsCatalogue[];
  /** Vidéos réellement lues, par source. */
  profondeurs: Partial<Record<SourceMemoire, number>>;
}
export interface DemandeMemoiresA { formatId: string; videoIdEnCours?: string; fenetre: ProfilVideo["memoire"] }

const FORMAT_AVOCAT = "avocat";
const FORMAT_FACECAM_ANIMEE = "facecam-animee";
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

async function protege<T>(nom: string, vide: T, lire: () => Promise<T>): Promise<T> {
  try {
    return await lire();
  } catch (e) {
    console.warn(`[studio] mémoire « ${nom} » illisible :`, e instanceof Error ? e.message : e);
    return vide;
  }
}

async function cartesAvocat(videoIdEnCours: string | undefined): Promise<{ usages: UsageMemoire[]; videos: number }> {
  const versions = await depots().versions.lister((v) => v.statut === "prete" && (v.projetMontage as { moteur?: unknown } | undefined)?.moteur === "montage-avocat" && v.videoId !== videoIdEnCours);
  const vus = new Set<string>();
  const retenues = [...versions]
    .sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""))
    .filter((v) => (vus.has(v.videoId) ? false : (vus.add(v.videoId), true)))
    .slice(0, 5);
  const usages: UsageMemoire[] = [];
  for (const v of retenues) {
    const cartes = (v.projetMontage as { motionCommune?: { cartes?: { ratio?: unknown; modele?: unknown; statut?: unknown; debutSec?: unknown }[] } } | undefined)?.motionCommune?.cartes;
    const valides = (Array.isArray(cartes) ? cartes : []).filter((x) => x.statut !== "echec" && typeof x.ratio === "string" && typeof x.modele === "string" && typeof x.debutSec === "number");
    const premierRatio = valides[0]?.ratio;
    for (const x of valides.filter((c) => c.ratio === premierRatio).sort((a, b) => (a.debutSec as number) - (b.debutSec as number)))
      usages.push({ capacite: ID.motionCartesCommunes, cle: `carte:${x.modele as string}`, videoId: v.videoId, source: "avocat-cartes", le: v.creeLe });
  }
  return { usages, videos: retenues.length };
}

/** Les 5 dernières vidéos qui ont un plan v4 (un travail par vidéo, le plus récent), hors la vidéo en cours. */
async function travauxV4(videoIdEnCours: string | undefined) {
  const travaux = (await depots().travaux.lister((t) => t.fournisseurUtilise === ID_MOTEUR_FACECAM_ANIMEE && t.cibleId !== videoIdEnCours)) as Travail[];
  const vus = new Set<string>();
  const lus: { videoId: string; le: string; etat: NonNullable<ReturnType<typeof lireEtatV4>> }[] = [];
  for (const t of travaux) {
    try {
      const etat = lireEtatV4(t.parametres?.facecamAnimeeV4);
      if (etat) lus.push({ videoId: t.cibleId ?? t.id, le: t.creeLe ?? "", etat });
    } catch { /* état illisible : ignoré seul */ }
  }
  return lus.sort((a, b) => b.le.localeCompare(a.le)).filter((x) => (vus.has(x.videoId) ? false : (vus.add(x.videoId), true)));
}

async function lectureV4(videoIdEnCours: string | undefined): Promise<{ familles: UsageMemoire[]; extraits: UsageMemoire[]; videosFamilles: number; videosExtraits: number }> {
  const tous = await travauxV4(videoIdEnCours);
  const avecPlan = tous.filter((x) => x.etat.realisation?.plan?.elementsV4?.length).slice(0, 5);
  const familles: UsageMemoire[] = [];
  for (const x of avecPlan) {
    const plan = x.etat.realisation?.plan;
    if (!plan) continue;
    for (const f of historiqueDuPlan(plan).familles ?? []) familles.push({ capacite: ID.motionPlaquettesV4, cle: `famille:${f}`, videoId: x.videoId, source: "v4-familles", le: x.le });
  }
  // Même lecture que les familles : mêmes travaux, 5 au plus. `source` : « pexels », « pixabay » ; la valeur « axion » n'existe pas encore sur master (rien n'est filtré dessus).
  const avecChoix = tous.filter((x) => x.etat.videos?.choix?.length).slice(0, 5);
  const extraits: UsageMemoire[] = [];
  for (const x of avecChoix)
    for (const c of x.etat.videos?.choix ?? []) extraits.push({ capacite: ID.ecranClipV4, cle: `${c.source}:${c.id}`, videoId: x.videoId, source: "v4-extraits", le: x.le });
  return { familles, extraits, videosFamilles: avecPlan.length, videosExtraits: avecChoix.length };
}

async function illustrations(): Promise<UsageHorsCatalogue[]> {
  const elements = await depots().elements.lister((e) => (e.type === "illustration-image" || e.type === "illustration-video") && !!e.derniereVideoId);
  return [...elements]
    .sort((a, b) => (b.dernierRangVideo ?? 0) - (a.dernierRangVideo ?? 0))
    .map((e, rang) => ({ source: "illustrations" as const, cle: `illustration:${e.id}`, videoId: e.derniereVideoId as string, rang }));
}

export async function lireMemoiresA(d: DemandeMemoiresA): Promise<MemoiresLues> {
  const globale = d.fenetre.portee === "globale";
  const sources: UsageMemoire[][] = [];
  const profondeurs: Partial<Record<SourceMemoire, number>> = {};
  let horsCatalogue: UsageHorsCatalogue[] = [];

  if (globale || d.formatId === FORMAT_AVOCAT) {
    const r = await protege("cartes avocat", { usages: [] as UsageMemoire[], videos: 0 }, () => cartesAvocat(d.videoIdEnCours));
    sources.push(r.usages);
    profondeurs["avocat-cartes"] = r.videos;
  }
  if (globale || d.formatId === FORMAT_FACECAM_ANIMEE) {
    const r = await protege("v4", { familles: [], extraits: [], videosFamilles: 0, videosExtraits: 0 }, () => lectureV4(d.videoIdEnCours));
    sources.push(r.familles, r.extraits);
    profondeurs["v4-familles"] = r.videosFamilles;
    profondeurs["v4-extraits"] = r.videosExtraits;
  }
  // Illustrations : élément sans format, lu pour toutes les vidéos du format (ou globalement) ; jamais dans `usages`.
  horsCatalogue = await protege("illustrations", [] as UsageHorsCatalogue[], illustrations);
  profondeurs.illustrations = new Set(horsCatalogue.map((x) => x.videoId)).size;
  const figes = await protege("choix figés", [] as UsageMemoire[], async () => {
    const versions = await depots().versions.lister((v) => v.statut === "prete" && (globale || v.commande?.formatId === d.formatId));
    return choixFigesDesVersions(versions);
  });
  sources.push(figes);
  profondeurs["bibliotheque-video"] = new Set(figes.map((x) => x.videoId)).size;

  const usages = fusionnerMemoires(sources, d.fenetre);
  horsCatalogue.sort((a, b) => cmp(a.source, b.source) || a.rang - b.rang);
  return { usages, horsCatalogue, profondeurs };
}
