/**
 * SUJETS DÉJÀ TRAITÉS (lot L2) : lecture du registre, vérification d'un nouveau sujet, suggestions. SERVEUR UNIQUEMENT.
 * Les règles sont dans `domaine/sujets-traites.ts` (pur) ; ce fichier ne fait que LIRE les vidéos, les sujets centraux et
 * les fichiers par les dépôts existants. Rien n'est écrit, aucune collection ni migration : le registre est recalculé à
 * chaque appel. Pas encore branché dans un écran ni une action (lots suivants) ; les actions qui l'appelleront
 * vérifient la session elles-mêmes.
 *
 * Réglage `sujets.garde` (Réglages du studio, lu comme les autres par `lireParametre`) : « bloquant » (défaut),
 * « avertissement » (prévient sans bloquer) ou « eteint » (la vérification répond toujours ok).
 */
import "server-only";
import { CATALOGUE, casVisibles } from "@/formats/cas-concret/catalogue";
import {
  construireRegistre,
  sujetDeLaVideo,
  type SourcesRegistre,
  filtrerSuggestions,
  lireGarde,
  marquerAttentes,
  statutEffectif,
  verifierSujet as verifierSurRegistre,
  type CandidatSuggestion,
  type CandidatSujet,
  type Confirmation,
  type EntreeRegistre,
  type FichierRegistre,
  type GardeSujets,
  type ResultatVerification,
  type SujetRegistre,
  type Suggestion,
  type VideoRegistre,
} from "@/domaine/sujets-traites";
import type { Travail } from "@/domaine/types";
import { depots, lireParametre, maintenant } from "./_commun";
import { lireCasRetires } from "./cas-concret-retires";
import { lireCasAjoutes } from "./cas-concret-ajoutes-lecture";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { lireCasTraites } from "./cas-concret-traites";

/** Clé du réglage dans les paramètres du studio. */
export const REGLAGE_GARDE_SUJETS = "sujets.garde";

/** Cas d'usage de l'Usine proposés au plus (par lecture) ; les trois premiers non traités sont gardés. */
const NB_SUGGESTIONS = 3;

/** Sources lues par le service : remplaçables dans les tests par de faux dépôts. */
export interface SourcesSujets {
  videos(): Promise<VideoRegistre[]>;
  /** Sujets centraux numérotés, avec la table « script ou version -> sujet central » qui les relie aux vidéos. */
  sujets(): Promise<{ sujets: SujetRegistre[]; sujetDuScript: Record<string, string> }>;
  fichiers(): Promise<FichierRegistre[]>;
  garde(): Promise<unknown>;
  catalogueEtendu(): Promise<boolean>;
  /** Réglage `casConcret.stockMetiers` ; absent (faux dépôt de test) : éteint. */
  stockMetiers?(): Promise<boolean>;
  /** Cas concrets déjà traités (vidéo allée au bout) : jamais suggérés. Absent (faux dépôt de test) : aucun écarté. */
  casTraites?(): Promise<ReadonlySet<string>>;
  /** Cas retirés par Will : jamais suggérés. Absent (faux dépôt de test) : aucun écarté. */
  casRetires?(): Promise<ReadonlySet<string>>;
  /** Les cas ajoutés à la main (proposés comme les autres) ; absent : aucun. */
  casAjoutes?(): Promise<readonly CasConcret[]>;
  /** Banque de l'Usine (cas d'usage `propose` et `valide`), pour un métier si donné. */
  banque(cible?: string): CandidatSuggestion[] | Promise<CandidatSuggestion[]>;
  maintenant(): string;
}

/* ------------------------------------------------------------------ */
/* Lecture par défaut (dépôts du studio)                                */
/* ------------------------------------------------------------------ */

/** Seules les entrées utiles au registre sont gardées : les brouillons de tableau, très gros, ne sont pas copiés. */
const ENTREES_UTILES = ["casConcret", "facecamAnimee", "imageVideo"] as const;

const objetOuVide = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texteOuNul = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

/** Un enregistrement abîmé (donnée ancienne : entrées nulles, champ absent) est ignoré, jamais une erreur. */
export function videoLisible(v: unknown): VideoRegistre | undefined {
  try {
    const x = objetOuVide(v);
    const id = texteOuNul(x.id);
    const formatId = texteOuNul(x.formatId);
    const statut = texteOuNul(x.statut) as VideoRegistre["statut"] | undefined;
    if (!id || !formatId || !statut) return undefined;
    const entrees = objetOuVide(x.entrees);
    return {
      id,
      titre: texteOuNul(x.titre) ?? "",
      ...(texteOuNul(x.sujet) ? { sujet: texteOuNul(x.sujet)! } : {}),
      formatId,
      statut,
      ...(texteOuNul(x.statutAvantArchive) ? { statutAvantArchive: x.statutAvantArchive as VideoRegistre["statutAvantArchive"] } : {}),
      ...(x.estDemo === true ? { estDemo: true } : {}),
      creeLe: texteOuNul(x.creeLe) ?? maintenant(),
      entrees: Object.fromEntries(ENTREES_UTILES.filter((k) => k in entrees).map((k) => [k, entrees[k]])),
      ...(texteOuNul(x.scriptId) ? { scriptId: texteOuNul(x.scriptId)! } : {}),
      ...(texteOuNul(x.varianteId) ? { varianteId: texteOuNul(x.varianteId)! } : {}),
      ...(texteOuNul(x.sourceVideoId) ? { sourceVideoId: texteOuNul(x.sourceVideoId)! } : {}),
      ...(texteOuNul(x.typeDerive) ? { typeDerive: texteOuNul(x.typeDerive)! } : {}),
    };
  } catch {
    return undefined;
  }
}

async function lireVideos(): Promise<VideoRegistre[]> {
  // Projection tolérante : une vidéo sans `entrees` ne fait pas tomber la lecture, et les gros brouillons ne sont pas copiés.
  const vues = await depots().videos.lister(undefined, (v) => ({ ...v, entrees: Object.fromEntries(ENTREES_UTILES.filter((k) => k in objetOuVide(v.entrees)).map((k) => [k, objetOuVide(v.entrees)[k]])) }));
  const videos = vues.map(videoLisible).filter((v): v is VideoRegistre => !!v);
  // Pauses « à valider » : une vidéo en échec dont le dernier travail attend Will garde son sujet. Seuls les travaux des
  // vidéos en échec sont lus, en projection légère (la table des travaux est lourde : paramètres et sorties ne sont pas copiés).
  const enEchec = new Set(videos.filter((v) => statutEffectif(v) === "echec").map((v) => v.id));
  if (!enEchec.size) return videos;
  const travaux = await depots().travaux.lister(
    (t) => enEchec.has(t.cibleId) && t.type !== "reexport",
    (t) => ({ ...t, parametres: undefined, etapes: (t.etapes ?? []).map((e) => ({ ...e, sortieFichierIds: [] })) }) as Travail,
  );
  return marquerAttentes(videos, travaux);
}

export function sujetLisible(m: unknown): SujetRegistre | undefined {
  try {
    const x = objetOuVide(m);
    const brief = objetOuVide(x.brief);
    const id = texteOuNul(x.id);
    const idee = texteOuNul(brief.idee);
    const formatId = texteOuNul(brief.formatId);
    if (!id || !idee || !formatId || typeof x.numero !== "number") return undefined;
    const code = objetOuVide(objetOuVide(x.origineUsine).parts).cas_usage;
    return {
      id,
      numero: x.numero,
      ...(typeof x.version === "number" ? { version: x.version } : {}),
      ...(x.estDemo === true ? { estDemo: true } : {}),
      ...(texteOuNul(x.archiveLe) ? { archiveLe: texteOuNul(x.archiveLe)! } : {}),
      creeLe: texteOuNul(x.creeLe) ?? maintenant(),
      idee,
      formatId,
      ...(typeof code === "string" && code.trim() ? { codeCasUsage: code.trim() } : {}),
    };
  } catch {
    return undefined;
  }
}

async function lireSujets(): Promise<{ sujets: SujetRegistre[]; sujetDuScript: Record<string, string> }> {
  const d = depots();
  const maitres = await d.scriptsMaitres.lister((m) => m.numero !== undefined && !m.archiveLe);
  const sujets = maitres.map(sujetLisible).filter((s): s is SujetRegistre => !!s);
  const sujetDuScript: Record<string, string> = {};
  const ids = new Set(sujets.map((s) => s.id));
  for (const s of await d.scripts.lister((x) => !!x.scriptMaitreId && ids.has(x.scriptMaitreId), (x) => ({ ...x, blocs: [] }))) sujetDuScript[s.id] = s.scriptMaitreId!;
  for (const v of await d.variantes.lister((x) => ids.has(x.scriptMaitreId), (x) => ({ ...x, ouverture: [] }))) sujetDuScript[v.id] = v.scriptMaitreId;
  return { sujets, sujetDuScript };
}

async function lireFichiers(): Promise<FichierRegistre[]> {
  // Tous les fichiers, sans filtre d'origine : un dépôt, une fabrication ou un fournisseur peuvent porter la prise ou l'image.
  const fichiers = await depots().fichiers.lister();
  return fichiers.map((f) => ({ id: f.id, cleStockage: f.cleStockage, nom: f.nom, taille: f.taille, ...(f.sha256 ? { sha256: f.sha256 } : {}) }));
}

/** Cas d'usage de la banque de l'Usine, mémorisés après la première lecture (fichier de 2,8 Mo, lu côté serveur seulement). */
let banqueMemo: (CandidatSuggestion & { cible: string })[] | undefined;

export async function banqueUsine(cible?: string): Promise<(CandidatSuggestion & { cible: string })[]> {
  if (!banqueMemo) {
    // Import tardif : le fichier de 2,8 Mo ne se charge qu'au premier refus (jamais sur le chemin normal d'une création).
    const { casUsage, metiers } = await import("@/donnees/bases-usine");
    const etats = ["propose", "valide"] as const;
    const lignes = metiers({ etats }).flatMap((m) => casUsage(m.code, { etats }));
    // Validés d'abord, puis proposés ; à égalité, l'ordre de la banque.
    const rang = (e: string) => (e === "valide" ? 0 : 1);
    banqueMemo = lignes
      .map((l, i) => ({ l, i }))
      .sort((a, b) => rang(a.l.etat) - rang(b.l.etat) || a.i - b.i)
      .map(({ l }) => ({
        titre: l.titre,
        code: l.code,
        cible: l.cible,
        source: "usine" as const,
        textes: [l.probleme, l.ceQueCaChange, l.accroche, l.sujet],
      }));
  }
  return cible ? banqueMemo.filter((c) => c.cible === cible) : banqueMemo;
}

export const SOURCES_PAR_DEFAUT: SourcesSujets = {
  videos: lireVideos,
  sujets: lireSujets,
  fichiers: lireFichiers,
  garde: () => lireParametre<unknown>(REGLAGE_GARDE_SUJETS, "bloquant"),
  catalogueEtendu: async () => (await lireParametre<unknown>("casConcret.catalogueEtendu", false)) === true,
  stockMetiers: async () => (await lireParametre<unknown>("casConcret.stockMetiers", false)) === true,
  casTraites: async () => new Set((await lireCasTraites()).keys()),
  casRetires: lireCasRetires,
  casAjoutes: lireCasAjoutes,
  banque: banqueUsine,
  maintenant,
};

/* ------------------------------------------------------------------ */
/* Service                                                              */
/* ------------------------------------------------------------------ */

/** Le réglage `sujets.garde` : « bloquant » si absent ou inconnu. */
export async function lireGardeSujets(src: Pick<SourcesSujets, "garde"> = SOURCES_PAR_DEFAUT): Promise<GardeSujets> {
  return lireGarde(await src.garde());
}

async function lireSources(src: SourcesSujets): Promise<SourcesRegistre> {
  const [videos, { sujets, sujetDuScript }, fichiers] = await Promise.all([src.videos(), src.sujets(), src.fichiers()]);
  return { videos, sujets, sujetDuScript, fichiers };
}

/** Le registre des sujets traités, recalculé maintenant à partir des vidéos et des sujets existants. */
export async function registreSujets(src: SourcesSujets = SOURCES_PAR_DEFAUT): Promise<EntreeRegistre[]> {
  return construireRegistre(await lireSources(src));
}

/**
 * Trois propositions de sujets pas encore traités. Cas concret : les cas visibles du catalogue sans vidéo comptée.
 * Autres générateurs : la banque de l'Usine (cas d'usage proposés ou validés), sans doublon de titre ni mot interdit.
 */
export async function suggestionsSujets(format: string, cible?: string, src: SourcesSujets = SOURCES_PAR_DEFAUT, registre?: EntreeRegistre[]): Promise<Suggestion[]> {
  const reg = registre ?? (await registreSujets(src));
  const quand = src.maintenant();
  if (format === "cas-concret") {
    const visibles = casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu: await src.catalogueEtendu(), stockMetiers: (await src.stockMetiers?.()) === true }).map((x) => x.cas);
    // AJOUTER UN CAS : les cas ajoutés à la main sont aussi proposés (jamais en lisant la base ici si la source est injectée).
    const ajoutes = src.casAjoutes ? await src.casAjoutes() : [];
    visibles.push(...ajoutes);
    const traites = (await src.casTraites?.()) ?? new Set<string>();
    const retires = (await src.casRetires?.()) ?? new Set<string>();
    const candidats: CandidatSuggestion[] = visibles.filter((c) => !traites.has(c.id) && !retires.has(c.id)).map((c) => ({ titre: c.titre, casId: c.id, source: "catalogue" as const }));
    return filtrerSuggestions(candidats, reg, format, quand, NB_SUGGESTIONS);
  }
  return filtrerSuggestions(await src.banque(cible), reg, format, quand, NB_SUGGESTIONS);
}

/**
 * Ce nouveau sujet a-t-il déjà été traité ? À appeler seulement pour une NOUVELLE vidéo / un nouveau sujet : pour une
 * reprise, une retouche, une autre accroche, un réexport ou « réessayer », passer `estReprise` (ou `ignorerVideoId`).
 * `ok: false` porte les précédents, trois suggestions et un jeton : la confirmation `{ choix, jeton }` n'est acceptée que
 * si les précédents n'ont pas changé depuis (sinon refus de nouveau, `jetonPerime`).
 */
export async function verifierSujet(candidat: CandidatSujet, confirmation?: Confirmation, src: SourcesSujets = SOURCES_PAR_DEFAUT): Promise<ResultatVerification> {
  const garde = await lireGardeSujets(src);
  if (garde === "eteint" || candidat.estReprise) return { ok: true };
  const sources = await lireSources(src);
  const registre = construireRegistre(sources);
  // Une relance (`ignorerVideoId`) ne doit pas être bloquée par son propre sujet central, même si sa vidéo (en échec) n'est pas au registre.
  // Plusieurs vidéos possibles (brouillon d'abord, puis pauses) : on prend le premier sujet numéroté trouvé, dans cet ordre.
  // Limite connue : `ignorerEntreeSujetNumero` n'accepte qu'UN numéro, donc un seul sujet central est écarté (celui de la 1re vidéo numérotée).
  const idsIgnores = [...(candidat.ignorerVideoId ? [candidat.ignorerVideoId] : []), ...(candidat.ignorerVideoIds ?? [])];
  const propres = idsIgnores.map((id) => sujetDeLaVideo(sources, id)).filter((x): x is NonNullable<typeof x> => !!x);
  const sujetPropre = propres.find((x) => x.numero !== undefined) ?? propres[0];
  const effectif: CandidatSujet = sujetPropre?.numero !== undefined ? { ...candidat, ignorerEntreeSujetNumero: sujetPropre.numero } : candidat;
  const premier = verifierSurRegistre(registre, effectif, { maintenant: src.maintenant(), garde, ...(confirmation ? { confirmation } : {}) });
  if (premier.ok) return premier;
  return { ...premier, suggestions: await suggestionsSujets(candidat.generateur, undefined, src, registre) };
}
