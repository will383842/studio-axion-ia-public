/**
 * SERVICE « CAS CONCRET MD » (tâche S1a, plan cas concret § 4-b, § 4-d, § 7) : quels cas sont utilisables, le prix du
 * bouton, la préparation et le lancement d'une vidéo.
 *
 * - Un cas est VALIDE s'il porte `valideParWill`, ou si le réglage `casConcret.validations` garde son empreinte courante
 *   et une date de moins de `VALIDITE_CAS_JOURS` jours. Valider un cas n'écrit que ce réglage et une ligne au journal :
 *   aucune Matière, aucune Preuve n'est créée.
 * - `preparerEtLancer` tient un verrou : deux appels simultanés donnent une seule vidéo. Un brouillon du même cas resté
 *   sans travail est repris (pas recréé). Le lancement passe par `lancerAvecAccord` : sans montant confirmé, rien ne part.
 * - La voix est la voix effective du format `avocat` (désignée, sinon la voix habituelle), prête et de HeyGen ; le lancement
 *   l'inscrit par son identifiant dans la distribution.
 * - Ce fichier ne publie rien : il n'importe ni `publications` ni `buffer`.
 */
import type { EntreeRole } from "@/generateur/roles/types";
import "server-only";
import { empreinteCas, type CasConcret } from "@/formats/cas-concret/cas";
import { CATALOGUE, trouverCas } from "@/formats/cas-concret/catalogue";
import { FORMAT_VOIX_DE_REFERENCE, fournisseurVoixPermis, VALIDITE_CAS_JOURS, type ReseauCas } from "@/formats/cas-concret";
import { reseauxDuMot } from "@/formats/cas-concret/mots-branches";
import { recettePour, type IdBloc } from "@/formats/cas-concret/recette";
import { casDesEntrees, ENTREE_CAS_CONCRET, estimerDepuisCas, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { lecturesVoixMaxDuReglage } from "./voix-ressemblance";
import { refusAvantPrix } from "@/moteurs/montage-cas-concret/avant-prix";
import { motValide } from "@/moteurs/montage-cas-concret/fins";
import { blocsScriptDesEcrans, problemesScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import type { AccordPrix } from "@/domaine/accord";
import { voixPourFormat } from "@/domaine/voix-format";
import type { BlocScript, Distribution, Id, Video } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre";
import { creerVerrou, depots, ecrireParametre, journaliser, lireParametre, ressourceActive, ErreurStudio } from "./_commun";
import { REGLAGES_CAS_CONCRET, reglageAllume } from "./cas-concret-reglages";
import { trouverCasAutorise } from "./cas-concret-stock-acces";
import { ecransFournisPourFabrication } from "@/components/formats/cas-concret/ecran-fourni/service";
import { exigerSession } from "./auth";
import { lecteurMotsBranches } from "./cas-concret-mots";
import { lancerAvecAccord, nouveauBrouillonFormat, type DependancesLancement } from "./creation-format";
import { trouverMoi } from "./moi";
import { cleCas, marquerAttentes, statutEffectif, type Confirmation, type NiveauSujet, type Precedent, type ResultatVerification, type Suggestion } from "@/domaine/sujets-traites";
import { verifierSujet as verifierSujetTraite } from "./sujets-traites";
import { estCasTraite, PHRASE_CAS_TRAITE } from "./cas-concret-traites";
import { lireCasRetires, PHRASE_CAS_RETIRE } from "./cas-concret-retires";
import { lireCasAjoutes } from "./cas-concret-ajoutes-lecture";


/**
 * Le socle de Will (charte, style, preuves, ton de la v4) part avec chaque écriture quand Claude est relié : il est
 * compté dans le prix affiché (le même à la feuille et au lancement). Illisible ou Claude non relié : rien de plus.
 */
async function socleEstime(): Promise<{ socle?: EntreeRole["contexte"] }> {
  try {
    const { claudeTextesActif } = await import("./depense-claude-video");
    if (!(await claudeTextesActif())) return {};
    return { socle: await (await import("./cas-concret-socle")).socleCasConcretSansV4() };
  } catch {
    return {};
  }
}
export const FORMAT_CAS_CONCRET_ID = "cas-concret";
const CLE_VALIDATIONS = "casConcret.validations";
const RESEAUX_CAS: readonly ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const MS_PAR_JOUR = 86_400_000;

type Validations = Record<string, { empreinte: string; valideLe: string }>;

/* ------------------------------------------------------------------ */
/* Cas valides et à valider                                              */
/* ------------------------------------------------------------------ */

/** Un cas, avec l'empreinte qu'un geste de validation fixerait. */
export interface CasListe {
  cas: CasConcret;
  empreinte: string;
}

export interface ListeCas {
  valides: CasListe[];
  aValider: CasListe[];
}

const jourDe = (iso: string): number => Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

function estValide(cas: CasConcret, empreinte: string, validations: Validations, maintenant: number): boolean {
  if (cas.valideParWill) return true;
  const v = validations[cas.id];
  if (!v || v.empreinte !== empreinte) return false;
  const le = jourDe(v.valideLe);
  return Number.isFinite(le) && maintenant - le < VALIDITE_CAS_JOURS * MS_PAR_JOUR && le <= maintenant + MS_PAR_JOUR;
}

/** Les cas du catalogue, séparés en « valides » et « à valider ». Session exigée. */
export async function listerCas(dependances: { maintenant?: number } = {}): Promise<ListeCas> {
  await exigerSession();
  const validations = await lireParametre<Validations>(CLE_VALIDATIONS, {});
  const maintenant = dependances.maintenant ?? Date.now();
  const sortie: ListeCas = { valides: [], aValider: [] };
  // Les cas ajoutés à la main suivent ceux du catalogue (à valider tant que Will ne les a pas validés).
  for (const cas of [...CATALOGUE, ...(await lireCasAjoutes())]) {
    const empreinte = empreinteCas(cas);
    (estValide(cas, empreinte, validations, maintenant) ? sortie.valides : sortie.aValider).push({ cas, empreinte });
  }
  return sortie;
}

/** Will valide un cas : l'empreinte courante et la date sont gardées dans le réglage, une ligne va au journal. */
export async function confirmerCas(casId: string, dependances: { maintenant?: number } = {}): Promise<{ casId: string; valideLe: string }> {
  await exigerSession();
  const cas = await trouverCasAutorise(casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  if ((await lireCasRetires()).has(cas.id)) throw new ErreurStudio("CAS_RETIRE", PHRASE_CAS_RETIRE);
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString();
  const validations = await lireParametre<Validations>(CLE_VALIDATIONS, {});
  await ecrireParametre(CLE_VALIDATIONS, { ...validations, [cas.id]: { empreinte: empreinteCas(cas), valideLe } });
  await journaliser("cas-concret", `Cas validé : ${cas.titre}`);
  return { casId: cas.id, valideLe };
}

/* ------------------------------------------------------------------ */
/* Voix et estimation                                                    */
/* ------------------------------------------------------------------ */

/**
 * La voix du format : la voix EFFECTIVE de « Moi » pour le format de référence (`voixPourFormat` : celle désignée pour le
 * format si elle est prête, sinon la voix habituelle, sinon la première prête), parmi ses voix de HeyGen (la voix simulée des essais aussi). X8 :
 * aucune désignation explicite n'est exigée ; `null` seulement si aucune voix prête de HeyGen n'est disponible. SEULE
 * règle du format, lue par le lancement, l'estimation et la feuille « Votre vidéo ».
 */
export async function voixDeReference(): Promise<{ voixId: Id; personnageId: Id; fournisseur: string } | null> {
  const moi = await trouverMoi();
  if (!moi) return null;
  // Toujours HeyGen : une voix d'un autre fournisseur n'est jamais choisie, même désignée ou habituelle. L1-05 : une voix
  // HeyGen n'est retenue que si sa ressource active porte la voix maître (jamais le doublon « Ma voix HeyGen »).
  const candidates = await depots().voix.lister((v) => v.personnageId === moi.id && fournisseurVoixPermis(v.fournisseur));
  const voix: typeof candidates = [];
  for (const v of candidates) {
    if (v.fournisseur === "simulation" || (await ressourceActive(v.id))?.idExterne === VOIX_MAITRE_HEYGEN_ID) voix.push(v);
  }
  const choisie = voixPourFormat(voix, moi, FORMAT_VOIX_DE_REFERENCE);
  if (!choisie) return null;
  return { voixId: choisie.id, personnageId: moi.id, fournisseur: choisie.fournisseur };
}

const reseauxPropres = (reseaux: readonly string[]): ReseauCas[] => RESEAUX_CAS.filter((r) => reseaux.includes(r));

/** Sujet déjà traité (lot L3) : de quoi afficher les trois choix (jeton, précédents avec liens, suggestions). */
export interface DejaTraiteCas {
  niveau: NiveauSujet;
  precedents: Precedent[];
  suggestions: Suggestion[];
  jeton: string;
  /** La confirmation reçue ne correspond plus aux vidéos d'aujourd'hui : choisir de nouveau. */
  jetonPerime?: boolean;
  phrase: string;
}

/** Le même cas existe déjà dans un AUTRE générateur : on prévient, sans bloquer (règle D1). */
export interface AvertissementSujet {
  niveau: NiveauSujet;
  precedents: Precedent[];
}

export interface EstimationCas {
  centimes: number;
  /** « environ 0,60 € » prêt à afficher. */
  phrase: string;
  /** X7 : ce qui empêcherait la fabrication sans dépense (même phrase que le lancement) ; absent : rien. */
  refus?: string;
  /** Lot L3 : le cas est déjà traité par une vidéo comptée (le prix n'est confirmé qu'après le choix de Will). */
  dejaTraite?: DejaTraiteCas;
  /** Lot L3 : le cas existe dans un autre générateur (avertissement non bloquant). */
  avertissement?: AvertissementSujet;
}

/** Ce que la feuille montre et ce que le lancement envoie : le choix de Will, sans l'accord. */
export interface ChoixAvantPrix {
  reseaux: readonly string[];
  mot?: string;
  avecMot: boolean;
  essai?: boolean;
  empreinteVue?: string;
  /** P2S · porte B : le brouillon qui porte le cas construit depuis la description (le cas n'est pas au catalogue). */
  porteB?: Id;
  /** LOT F · « Nouveau script (autre structure) » : le prix compte l'écriture d'un script neuf (cas à script validé). */
  nouveauScript?: boolean;
  /** Lot L3 : le choix de Will devant un cas déjà traité (confirmation : choix + jeton reçus du refus). */
  sujet?: Confirmation;
}

const motNormalise = (m: string): string => m.trim().toUpperCase();

const entreesDe = (video: Pick<Video, "entrees">): Record<string, unknown> => ((video.entrees as Record<string, unknown> | undefined)?.[ENTREE_CAS_CONCRET] as Record<string, unknown> | undefined) ?? {};

interface Controle {
  cas: CasConcret | undefined;
  /** Porte B : la description et les faits confirmés, repris tels quels au lancement. */
  porteB?: { description: string; faitsConfirmes: string[] };
  reseaux: ReseauCas[];
  mot: string;
  motSur: ReseauCas[];
  voix: Awaited<ReturnType<typeof voixDeReference>>;
  videos: Video[];
  reprise: Video | undefined;
  /** Première pause (gardée par compatibilité ; le contrôle de sujet lit `pauses`). */
  pause: Video | undefined;
  /** Toutes les pauses « script à valider » du même cas (la première est aussi `pause`). */
  pauses: Video[];
  refus: string | null;
}

/**
 * X7 · LE contrôle avant le prix : tout refus possible sans appel payant (cas absent, invalide ou changé, cas non validé
 * hors essai, voix pas prête, mot invalide ou déjà pris, phrase de conformité absente, réseau sans fin utilisable), par
 * `refusAvantPrix`. Appelé par `estimerCas` (la feuille, avant le prix) ET par `preparerEtLancer` (avant de créer quoi
 * que ce soit) : la même phrase des deux côtés.
 */
async function controleAvantPrix(casId: string, choix: ChoixAvantPrix, maintenant: number): Promise<Controle> {
  const videos = await depots().videos.lister((v) => v.formatId === FORMAT_CAS_CONCRET_ID && v.statut !== "archivee");
  // P2S · porte B : le cas est celui gardé par son brouillon (jamais au catalogue) ; sans brouillon, ou réglage éteint : il n'existe plus.
  const brouillonB = choix.porteB && (await reglageAllume(REGLAGES_CAS_CONCRET.porteB)) ? videos.find((v) => v.id === choix.porteB && v.statut === "brouillon") : undefined;
  const lusB = brouillonB ? lireEntreesCasConcret(brouillonB.entrees) : undefined;
  const porteB = lusB?.porte === "porte-b" ? { description: lusB.description ?? "", faitsConfirmes: lusB.faitsConfirmes ?? [] } : undefined;
  const cas = choix.porteB ? (porteB && lusB ? casDesEntrees(lusB) : undefined) : await trouverCasAutorise(casId);
  const reseaux = reseauxPropres(choix.reseaux);
  const mot = (choix.mot ?? cas?.mot ?? "").trim();
  const voix = await voixDeReference();
  const validations = await lireParametre<Validations>(CLE_VALIDATIONS, {});
  // Un brouillon du même cas resté sans travail est repris ; le contrôle du mot l'ignore.
  const reprise = porteB ? brouillonB : cas ? videos.find((v) => v.statut === "brouillon" && entreesDe(v).casId === cas.id) : undefined;
  // Une vidéo du même cas en pause « script à valider » (statut échec, corbeille comprise) : elle n'est pas un doublon de son propre cas.
  const enEchec = cas ? await depots().videos.lister((v) => v.formatId === FORMAT_CAS_CONCRET_ID && statutEffectif(v) === "echec" && entreesDe(v).casId === cas.id) : [];
  const pauses = enEchec.length
    ? marquerAttentes(enEchec, await depots().travaux.lister((t) => enEchec.some((v) => v.id === t.cibleId) && t.type !== "reexport", (t) => ({ ...t, parametres: undefined, etapes: (t.etapes ?? []).map((e) => ({ ...e, sortieFichierIds: [] })) }) as typeof t)).filter((v) => v.enAttenteValidation)
    : [];
  const pause = pauses[0];
  // X6 : le mot n'est dit que pour les comptes où il est branché ; ailleurs, la fin « diagnostic ».
  const motSur = choix.avecMot && motValide(mot) ? reseauxDuMot(mot, reseaux, await lecteurMotsBranches()) : [];
  const motPris = motSur.length > 0 && videos.some((v) => v.id !== reprise?.id && entreesDe(v).avecMot !== false && (!Array.isArray(entreesDe(v).motSur) || (entreesDe(v).motSur as unknown[]).length > 0) && typeof entreesDe(v).mot === "string" && motNormalise(entreesDe(v).mot as string) === motNormalise(mot));
  // Cas déjà traité (vidéo allée au bout) : refus net, AVANT le prix et avant toute création, même avec un brouillon repris, un
  // jeton « refaire » / « nouvel angle » ou le réglage `sujets.garde` éteint. Jamais la porte B (cas construit à chaque description).
  const dejaTraite = cas && !porteB ? await estCasTraite(cas.id) : false;
  // Cas retiré par Will : refus net, avant le prix et avant toute création (jamais la porte B).
  const retire = cas && !porteB ? (await lireCasRetires()).has(cas.id) : false;
  const refus = dejaTraite ? PHRASE_CAS_TRAITE : retire ? PHRASE_CAS_RETIRE : refusAvantPrix({
    cas,
    ...(choix.empreinteVue ? { empreinteVue: choix.empreinteVue } : {}),
    reseaux,
    mot,
    avecMot: choix.avecMot,
    motSur,
    essai: choix.essai === true,
    // Porte B : jamais au catalogue, jamais « validé » ; la garde d'honnêteté et les faits à confirmer en tiennent lieu.
    ...(porteB ? { description: porteB.description, faitsConfirmes: porteB.faitsConfirmes } : { valide: cas ? estValide(cas, empreinteCas(cas), validations, maintenant) : false }),
    voixPrete: !!voix,
    motPris,
    // P2C : les images déposées (réglage éteint : aucune) ; une image sans attestation ou hors écran réel refuse avant le prix.
    ecransFournis: cas ? await ecransFournisPourFabrication(cas.id) : [],
  });
  return { cas, ...(porteB ? { porteB } : {}), reseaux, mot, motSur, voix, videos, reprise, pause, pauses, refus };
}

/** Générateur du contrôle « sujet déjà traité » : clé exacte `cas:<casId>`, le texte ne sert pas au « proche ». */
const GENERATEUR_SUJET = "cas-concret";

/**
 * Lot L3 : le cas est-il déjà traité par une vidéo comptée ? SEULEMENT pour un cas du catalogue (jamais la porte B, dont le
 * cas est construit à chaque description). « Nouveau script » ne contourne PAS le contrôle : sur un cas déjà traité, il exige la
 * confirmation « nouvel angle » (le texte du script neuf n'est pas encore comparé aux scripts précédents : lot suivant).
 * Réglage `sujets.garde` « eteint » : toujours libre. Les trois suggestions viennent du catalogue visible.
 */
async function controleSujetCas(cas: CasConcret, c: Pick<Controle, "reprise" | "pauses" | "porteB">, confirmation: Confirmation | undefined): Promise<Awaited<ReturnType<typeof verifierSujetTraite>> | null> {
  if (c.porteB) return null;
  return verifierSujetTraite({ generateur: GENERATEUR_SUJET, cles: [cleCas(cas.id)], texte: cas.titre, ...(c.reprise || c.pauses.length ? { ignorerVideoIds: [...(c.reprise ? [c.reprise.id] : []), ...c.pauses.map((v) => v.id)] } : {}) }, confirmation);
}

const versDejaTraite = (v: Extract<ResultatVerification, { ok: false }>): DejaTraiteCas => ({
  niveau: v.niveau,
  precedents: v.precedents,
  suggestions: v.suggestions,
  jeton: v.jeton,
  ...(v.jetonPerime ? { jetonPerime: true } : {}),
  phrase: v.jetonPerime ? "Les vidéos ont changé. Choisissez de nouveau." : "Ce cas est déjà traité.",
});

/** Le montant du bouton « Fabriquer la vidéo », et le refus éventuel avant le prix (aucune vidéo n'est créée). */
export async function estimerCas(casId: string, reseaux: readonly string[], avecMot: boolean, choix: Omit<ChoixAvantPrix, "reseaux" | "avecMot"> = {}, dependances: { maintenant?: number } = {}): Promise<EstimationCas> {
  await exigerSession();
  const c = await controleAvantPrix(casId, { ...choix, reseaux, avecMot }, dependances.maintenant ?? Date.now());
  if (!c.cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  // 14/10 : contrôle de ressemblance de la voix : le prix affiché couvre toutes les lectures possibles.
  const forcer = choix.sujet?.choix === "nouvel-angle" || choix.nouveauScript === true;
  const e = estimerDepuisCas(c.cas, c.reseaux, avecMot, { voix: c.voix ? { fournisseur: c.voix.fournisseur } : {}, motSur: c.motSur, lecturesVoixMax: await lecturesVoixMaxDuReglage(), ...(await socleEstime()), ...(forcer ? { nouveauScript: true } : {}) });
  // Lot L3 : annonce du sujet déjà traité pour la fiche de prix (rien n'est créé, rien n'est payé).
  const sujet = c.refus ? null : await controleSujetCas(c.cas, c, choix.sujet);
  return {
    centimes: e.total.centimes,
    phrase: `environ ${formaterMontant(e.total)}`,
    ...(c.refus ? { refus: c.refus } : {}),
    ...(sujet && !sujet.ok ? { dejaTraite: versDejaTraite(sujet) } : {}),
    ...(sujet?.ok && sujet.avertissement ? { avertissement: sujet.avertissement } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Préparer et lancer                                                    */
/* ------------------------------------------------------------------ */

export interface DemandeCasConcret {
  casId: string;
  reseaux: readonly string[];
  mot: string;
  avecMot: boolean;
  /** Montant confirmé par Will (centimes). */
  accordCentimes?: AccordPrix | unknown;
  /** Vidéo d'essai : permise pour un cas pas encore validé. */
  essai?: boolean;
  /** Empreinte du cas telle que l'écran l'a montrée ; différente de l'actuelle : refus. */
  empreinteVue?: string;
  /** Brique 3 : empreinte du script relu par Will (`relecture-script`), exigée quand le cas a un script validé. */
  empreinteScriptRelu?: string;
  /** P2S · porte B : le brouillon qui porte le cas construit depuis la description. */
  porteB?: Id;
  /**
   * LOT F · « Nouveau script (autre structure) » : cette vidéo ne rejoue PAS le script validé du cas ; Claude en écrit un
   * neuf (une écriture) et la vidéo s'arrête à « Script à valider ». L'ancien script validé n'est ni modifié ni retiré
   * tant que Will ne valide pas le nouveau (alors une version de plus entre à l'historique et devient celle du cas).
   * Sans script validé pour ce cas : ignoré (rien ne change).
   */
  nouveauScript?: boolean;
  /**
   * Lot L3 · cas déjà traité : « Refaire quand même » ou « Nouvel angle » + le jeton reçu avec le refus. « Nouvel angle »
   * force `nouveauScript` pour CETTE vidéo. Jamais lu pour une reprise du script validé de la vidéo, une retouche ou un
   * « Réessayer » (autres services).
   */
  sujet?: Confirmation;
}

export type IssueCasConcret =
  | { statut: "lancee"; videoId: Id; travailId: Id; avertissement?: AvertissementSujet }
  | { statut: "accord-requis"; videoId: Id; centimes: number; phrase: string }
  | ({ statut: "sujet-deja-traite" } & DejaTraiteCas)
  | { statut: "refusee"; phrase: string };

export interface DependancesCasConcret extends DependancesLancement {
  maintenant?: number;
}

const refus = (phrase: string): IssueCasConcret => ({ statut: "refusee", phrase });

/** Bloc de la recette du format correspondant à un bloc de la recette du cas. */
const BLOC_RECETTE: Record<IdBloc, string> = {
  accroche: "accroche",
  "resultat-tete": "resultat",
  chiffre: "etape",
  avant: "etape",
  bascule: "etape",
  etapes: "etape",
  "reste-humain": "etape",
  conformite: "etape",
  resultat: "resultat",
  question: "question",
};

/** Texte « trame » d'un bloc : de quoi remplir le script du brouillon, l'écriture réelle vient ensuite. */
function trameDuBloc(id: IdBloc, cas: CasConcret): string {
  switch (id) {
    case "accroche":
      return cas.promesse;
    case "resultat-tete":
      return cas.resultat;
    case "chiffre":
      return cas.faits[0]?.enonce ?? cas.promesse;
    case "avant":
      return cas.avant.taches.join(", ");
    case "bascule":
      return cas.promesse;
    case "etapes":
      return cas.etapes.map((e) => e.ligne).join(" ");
    case "reste-humain":
      return cas.resteHumain;
    case "conformite":
      return cas.conformite?.rgpd?.phrase ?? cas.resteHumain;
    case "resultat":
      return cas.resultat;
    case "question":
      return cas.cible;
  }
}

function blocsTrame(cas: CasConcret, videoId: Id): BlocScript[] {
  return recettePour(cas)
    .filter((b) => !b.facultatif || (b.id === "conformite" && !!cas.conformite?.rgpd))
    .map((b, i) => ({ id: `${videoId}-b${i + 1}`, blocRecette: BLOC_RECETTE[b.id], segments: [{ id: `${videoId}-s${i + 1}`, texte: trameDuBloc(b.id, cas) }] }));
}

/** Un identifiant fait de minuscules, de chiffres et de tirets : les six derniers caractères de la vidéo. */
const codeSuiviDe = (casId: string, videoId: Id): string => `cc-${casId}-${videoId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6)}`;

const verrou = creerVerrou();

/**
 * Prépare la vidéo d'un cas puis la lance. Refus en phrases (rien n'est créé tant qu'un refus est possible, sauf le
 * brouillon quand seul l'accord manque : le prochain essai le reprend).
 */
export async function preparerEtLancer(demande: DemandeCasConcret, dependances: DependancesCasConcret = {}): Promise<IssueCasConcret> {
  await exigerSession();
  return verrou(() => preparerSousVerrou(demande, dependances));
}

async function preparerSousVerrou(demande: DemandeCasConcret, dependances: DependancesCasConcret): Promise<IssueCasConcret> {
  // X7 : le même contrôle que la feuille, avant de créer quoi que ce soit.
  const essai = demande.essai === true;
  const c = await controleAvantPrix(demande.casId, { reseaux: demande.reseaux, mot: demande.mot, avecMot: demande.avecMot, essai, ...(demande.empreinteVue ? { empreinteVue: demande.empreinteVue } : {}), ...(demande.porteB ? { porteB: demande.porteB } : {}) }, dependances.maintenant ?? Date.now());
  if (c.refus) return refus(c.refus);
  const { cas, reseaux, mot, motSur, voix, reprise } = c;
  if (!cas || !voix) return refus("Ce cas n'existe plus.");
  // Brique 3 : un script validé ne part que relu, tel que Will l'a lu (empreinte du texte) ; gardé dans les entrées.
  // LOT F : « Nouveau script » écarte le script validé (s'il y en a un utilisable) : rien à relire, Claude écrira.
  const { scriptValideDuStudio } = await import("./cas-concret-scripts");
  // Lot L3 · cas déjà traité : contrôle AVANT toute création, avant le relu, avant le prix. « Nouvel angle » force « Nouveau script ».
  const sujet = await controleSujetCas(cas, c, demande.sujet);
  if (sujet && !sujet.ok) return { statut: "sujet-deja-traite", ...versDejaTraite(sujet) };
  const nouveauScript = demande.nouveauScript === true || (sujet?.ok === true && sujet.confirme === "nouvel-angle");
  const courant = nouveauScript ? await scriptValideDuStudio(cas.id) : null;
  const ecarte = courant && !problemesScriptValide(courant, cas).length ? courant : null;
  if (!ecarte) {
    const refusRelu = await (await import("./cas-concret-scripts")).refusScriptRelu(cas, demande.empreinteScriptRelu);
    if (refusRelu) return refus(refusRelu);
  }
  const empreinte = empreinteCas(cas);

  const estimation = estimerDepuisCas(cas, reseaux, demande.avecMot, { voix: { fournisseur: voix.fournisseur }, motSur, lecturesVoixMax: await lecturesVoixMaxDuReglage(), ...(await socleEstime()), ...(ecarte ? { nouveauScript: true } : {}) });

  const motDit = motNormalise(mot) === motNormalise(cas.mot) ? cas.motDit : undefined;
  const distribution: Distribution[] = [{ role: "voix", source: "double", personnageId: voix.personnageId, voixId: voix.voixId }];
  const entreesBase = {
    casId: cas.id,
    empreinteCas: empreinte,
    // P2S · porte B : le cas, la description et les faits confirmés partent avec la vidéo (le moteur les relit).
    ...(c.porteB ? { porte: "porte-b", cas, description: c.porteB.description, faitsConfirmes: c.porteB.faitsConfirmes } : { porte: "A" }),
    // Le mot écrit est gardé même s'il n'est pas dit (X6 : il n'est dit que là où il est branché).
    mot: motValide(mot) ? mot : cas.mot,
    ...(demande.avecMot && motDit ? { motDit } : !demande.avecMot && cas.motDit ? { motDit: cas.motDit } : {}),
    avecMot: demande.avecMot,
    motSur,
    reseaux,
    essai,
    ...(demande.empreinteScriptRelu && !ecarte ? { scriptRelu: demande.empreinteScriptRelu } : {}),
    // LOT F : le numéro du script validé écarté ; un script plus récent (validé ensuite par Will) est, lui, rejoué.
    ...(ecarte ? { nouveauScript: ecarte.numero ?? 1 } : {}),
    // AJOUTER UN CAS : un cas ajouté à la main (hors catalogue) part FIGÉ avec la vidéo : le moteur, pur et synchrone, ne lit pas la
    // base ; moteur, boucle et relance relisent donc le même cas, même après un redémarrage ou pendant une mise en ligne.
    ...(!c.porteB && !trouverCas(cas.id) ? { casFige: structuredClone(cas) } : {}),
  };

  let videoId: Id;
  if (reprise) {
    videoId = reprise.id;
    const codeSuivi = typeof entreesDe(reprise).codeSuivi === "string" ? (entreesDe(reprise).codeSuivi as string) : codeSuiviDe(cas.id, reprise.id);
    await depots().videos.modifier(videoId, { distribution, ...(c.porteB ? { titre: cas.titre.slice(0, 80) } : {}), entrees: { ...reprise.entrees, [ENTREE_CAS_CONCRET]: { ...entreesBase, codeSuivi } } });
  } else {
    const video = await nouveauBrouillonFormat({ formatId: FORMAT_CAS_CONCRET_ID, titre: cas.titre, sujet: cas.promesse, distribution, entrees: {} });
    videoId = video.id;
    await depots().videos.modifier(videoId, { entrees: { [ENTREE_CAS_CONCRET]: { ...entreesBase, codeSuivi: codeSuiviDe(cas.id, videoId) } } });
  }

  // L0a (15/10) : un cas qui a un script validé (studio, sinon catalogue) donne SON texte au script de la vidéo, un bloc
  // par écran : la fiche du studio montre ce que la voix dira. Sans script validé, la trame reste (Claude écrit, puis
  // « Valider ce script » la remplace).
  const { enregistrerScriptDuBrouillon } = await import("./videos");
  const valide = ecarte ? null : await scriptValideDuStudio(cas.id);
  const blocs = valide && !problemesScriptValide(valide, cas).length ?blocsScriptDesEcrans(valide.ecrans, videoId) : blocsTrame(cas, videoId);
  await enregistrerScriptDuBrouillon(videoId, blocs);

  // X9 : le montant à confirmer est celui que le lancement commun réservera et que la fiche vidéo affichera (« Coût ≈ ») :
  // la même estimation, ligne « Textes des réseaux » comprise quand elle s'ajoute (premier essai réel : 0,89 € confirmé,
  // 0,94 € affiché). Un montant plus haut que l'accord est redemandé avant tout lancement. X11 : ce format écrit lui-même
  // ses textes (`publication: "aucune"`), la ligne ne s'y ajoute plus ; l'appel reste pour garder un seul calcul.
  const { avecTextesDesReseaux } = await import("./publications");
  const montant = (await avecTextesDesReseaux(videoId, estimation, { essai })).total.centimes;

  const issue = await lancerAvecAccord(videoId, demande.accordCentimes, montant, { lancer: dependances.lancer });
  // Lot L3 : un choix forcé sur un cas déjà traité laisse sa trace au journal.
  if (issue.statut === "lancee" && sujet?.ok && sujet.confirme) await journaliser("cas-concret", `Cas déjà traité, vidéo voulue quand même (choix « ${sujet.confirme} ») : ${cas.titre}`, { type: "video", id: videoId });
  return issue.statut === "lancee" ? { statut: "lancee", videoId, travailId: issue.travailId, ...(sujet?.ok && sujet.avertissement ? { avertissement: sujet.avertissement } : {}) } : { statut: "accord-requis", videoId, centimes: issue.centimes, phrase: issue.phrase };
}
