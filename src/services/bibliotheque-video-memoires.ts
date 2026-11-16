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
import { lireHistorique } from "@/moteurs/montage-cas-concret/variete";
import { HISTORIQUE_VARIETE_IV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { lireHistoriqueStyles } from "@/moteurs/montage-tableau/tirage-style";
import { AXES_VARIETE, codeDe } from "@/briques/schema-motion/variete";
import { depots, lireParametre } from "./_commun";

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

type EtatV4 = NonNullable<ReturnType<typeof lireEtatV4>>;
interface TravailV4Lu { videoId: string; le: string; etat: EtatV4 }

/** Travaux v4 lisibles, hors la vidéo en cours (état illisible : ignoré seul). */
async function travauxV4(videoIdEnCours: string | undefined): Promise<TravailV4Lu[]> {
  const travaux = (await depots().travaux.lister((t) => t.fournisseurUtilise === ID_MOTEUR_FACECAM_ANIMEE && t.cibleId !== videoIdEnCours)) as Travail[];
  const lus: TravailV4Lu[] = [];
  for (const t of travaux) {
    try {
      const etat = lireEtatV4(t.parametres?.facecamAnimeeV4);
      if (etat) lus.push({ videoId: t.cibleId ?? t.id, le: t.creeLe ?? "", etat });
    } catch { /* état illisible : ignoré seul */ }
  }
  return lus;
}

/** Ordre exact de `historique()` (facecam-animee.ts:243-253) : FILTRE d'abord, puis tri `creeLe` décroissant, un travail par vidéo (le plus récent), 5 au plus. */
function cinqDernieres(lus: TravailV4Lu[], garde: (e: EtatV4) => boolean): TravailV4Lu[] {
  const vus = new Set<string>();
  return lus
    .filter((x) => garde(x.etat))
    .sort((a, b) => b.le.localeCompare(a.le))
    .filter((x) => (vus.has(x.videoId) ? false : (vus.add(x.videoId), true)))
    .slice(0, 5);
}

async function lectureV4(videoIdEnCours: string | undefined): Promise<{ familles: UsageMemoire[]; extraits: UsageMemoire[]; videosFamilles: number; videosExtraits: number }> {
  const tous = await travauxV4(videoIdEnCours);
  const avecPlan = cinqDernieres(tous, (e) => !!e.realisation?.plan?.elementsV4?.length);
  const familles: UsageMemoire[] = [];
  for (const x of avecPlan) {
    const plan = x.etat.realisation?.plan;
    if (!plan) continue;
    for (const f of historiqueDuPlan(plan).familles ?? []) familles.push({ capacite: ID.motionPlaquettesV4, cle: `famille:${f}`, videoId: x.videoId, source: "v4-familles", le: x.le });
  }
  // Extraits : même règle (filtre « avec choix » avant tri et déduplication, 5 au plus). `source` : « pexels », « pixabay » ; la valeur « axion » n'existe pas encore sur master (rien n'est filtré dessus).
  const avecChoix = cinqDernieres(tous, (e) => !!e.videos?.choix?.length);
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

/* ------------------------------------------------------------------ */
/* C1-U6b : cas concret, tableau animé, image→vidéo (tout en horsCatalogue)   */
/* ------------------------------------------------------------------ */

export interface DemandeMemoiresB { formatId: string; videoIdEnCours?: string; fenetre: ProfilVideo["memoire"] }

const FORMAT_CAS_CONCRET = "cas-concret";
const FORMAT_TABLEAU = "tableau-anime";
const FORMAT_IMAGE_VIDEO = "image-video";
// Clés de réglage recopiées (les services de variété ne sont pas importés) ; un test les compare aux constantes.
export const CLE_TIRAGES_CAS_CONCRET = "casConcret.historiqueTirages";
export const CLE_STYLES_TABLEAU = "tableau.historiqueStyles";

/** Une ligne par vidéo, de la plus ancienne à la plus récente : on exclut la vidéo en cours, rang 0 = la plus récente. */
function enRangs<T extends { videoId: string }>(lignes: readonly T[], videoIdEnCours: string | undefined, source: SourceMemoire, cle: (l: T) => string): UsageHorsCatalogue[] {
  return lignes.filter((l) => l.videoId !== videoIdEnCours).reverse().map((l, rang) => ({ source, cle: cle(l), videoId: l.videoId, rang }));
}

async function casConcretTirages(videoIdEnCours: string | undefined): Promise<UsageHorsCatalogue[]> {
  const lignes = lireHistorique(await lireParametre<unknown>(CLE_TIRAGES_CAS_CONCRET, []));
  return enRangs(lignes, videoIdEnCours, "cas-concret-tirages", (l) => `tirage:${[...l.canaux].sort(cmp).join(",")}`);
}

async function tableauStyles(videoIdEnCours: string | undefined): Promise<UsageHorsCatalogue[]> {
  const lignes = lireHistoriqueStyles(await lireParametre<unknown>(CLE_STYLES_TABLEAU, []));
  return enRangs(lignes, videoIdEnCours, "tableau-styles", (l) => `style:${l.style}`);
}

/** Filtre recopié de `src/services/image-video.ts` (historiqueVariete) ; le tri de `historiqueVarieteIV` est celui du moteur, importé. */
async function imageVideoVariete(videoIdEnCours: string | undefined): Promise<UsageHorsCatalogue[]> {
  const travaux = await depots().travaux.lister((t) => !!(t.parametres as { imageVideo?: { variete?: unknown } } | undefined)?.imageVideo?.variete);
  travaux.sort((a, b) => (b.termineLe ?? b.creeLe).localeCompare(a.termineLe ?? a.creeLe));
  const etats = travaux.map((t) => (t.parametres as { imageVideo: EtatFabricationIV }).imageVideo);
  // Même filtre que `historiqueVarieteIV` (hors refusées, recette présente, hors vidéo en cours, 10 au plus), en gardant `demande.videoId`.
  const retenus = etats.filter((e) => e.etape !== "refusee" && e.variete && e.demande.videoId !== videoIdEnCours).slice(0, HISTORIQUE_VARIETE_IV);
  return retenus.map((e, rang) => {
    const r = e.variete!.effective ?? e.variete!.recette;
    return { source: "image-video-variete" as const, cle: `recette:${[...AXES_VARIETE].sort(cmp).map((a) => `${a}=${String(codeDe(r, a))}`).join(",")}`, videoId: String(e.demande.videoId), rang };
  });
}

export async function lireMemoiresB(d: DemandeMemoiresB): Promise<Pick<MemoiresLues, "horsCatalogue" | "profondeurs">> {
  const globale = d.fenetre.portee === "globale";
  const horsCatalogue: UsageHorsCatalogue[] = [];
  const profondeurs: Partial<Record<SourceMemoire, number>> = {};
  const lire = async (actif: boolean, source: SourceMemoire, nom: string, f: () => Promise<UsageHorsCatalogue[]>) => {
    if (!actif) return;
    const r = await protege(nom, [] as UsageHorsCatalogue[], f);
    horsCatalogue.push(...r);
    profondeurs[source] = new Set(r.map((x) => x.videoId)).size;
  };
  await lire(globale || d.formatId === FORMAT_CAS_CONCRET, "cas-concret-tirages", "cas concret", () => casConcretTirages(d.videoIdEnCours));
  await lire(globale || d.formatId === FORMAT_TABLEAU, "tableau-styles", "tableau", () => tableauStyles(d.videoIdEnCours));
  await lire(globale || d.formatId === FORMAT_IMAGE_VIDEO, "image-video-variete", "image→vidéo", () => imageVideoVariete(d.videoIdEnCours));
  horsCatalogue.sort((a, b) => cmp(a.source, b.source) || a.rang - b.rang);
  return { horsCatalogue, profondeurs };
}
