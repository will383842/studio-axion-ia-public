/**
 * T-EXT-33 · DÉPÔT DU TUTORIEL D'OUTIL : Williams donne un dossier (zip) OU une phrase, choisit la fin et, s'il le veut, le
 * parcours ; la fabrication est lancée SANS dépense (format sans prix : montant nul). Rien ne se dépense avant son accord
 * sur le devis (écran de validation, T-EXT-24 / T-EXT-42).
 *
 * ÉTEINT PAR DÉFAUT : seul le booléen exact `true` du réglage `tutoriel.formulaire` ouvre ; clé absente, `"true"`, `1` :
 * refus, rien n'est créé. `tutoriel.entreeZip` ouvre le dossier, `tutoriel.entreePhrase` ouvre la phrase (même règle).
 * Aucun code n'écrit ces réglages. Le zip n'est ouvert QUE par `extraireZipSur` (T-EXT-41) : rien d'extrait n'est gardé
 * ici, seules la référence du fichier et l'attestation entrent dans la commande ; la chaîne ré-extrait le même fichier.
 * Aucun appel payant, aucun montant écrit ni montré.
 */
import "server-only";
import type { Distribution, Fichier, Id, Ratio, Video } from "@/domaine/types";
import { ENTREE_TUTORIEL, PHRASE_DEPOT_MAX, PHRASE_DEPOT_MIN, type DepotTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import type { IdGabarit } from "@/moteurs/montage-tutoriel-outil/sortie-usine";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { entreeModeVoix, lireModeVoix, MODE_SANS_VOIX, type ModeVoixTutoriel } from "@/formats/tutoriel-outil/mode-sans-voix";
import { depots, ErreurStudio, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import type { IssueLancement } from "./creation-format";
import { MESSAGE_ZIP_FERME, PARAM_ENTREE_ZIP, extraireZipSur, type RapportEntree, type ResultatZip } from "./zip-tutoriel";

export const PARAM_FORMULAIRE = "tutoriel.formulaire";
export const PARAM_ENTREE_PHRASE = "tutoriel.entreePhrase";
export const ID_FORMAT_TUTORIEL = "tutoriel-outil";

export const PHRASE_TUTORIEL_FERME = "Le tutoriel n'est pas encore ouvert : votre demande n'est pas envoyée.";
export const PHRASE_PHRASE_FERMEE = "L'entrée par une phrase n'est pas ouverte pour le moment.";
export const PHRASE_PERSONNE_ABSENTE = "Aucune personne n'est disponible pour parler dans la vidéo : ajoutez d'abord votre double dans Personnages, puis recommencez.";
export const PHRASE_EQUIPE_FERMEE = "L'équipe qui écrit le script n'est pas ouverte pour le moment : collez votre propre script pour lancer la vidéo.";
export const SCRIPT_COLLE_MAX = 8000;
export const PHRASE_AUCUNE_ENTREE = "Aucune entrée n'est ouverte pour le moment.";

/** Fin de la vidéo (mêmes valeurs que `FinChoisie` du chef de projet, recopiées : ce fichier n'importe pas l'équipe). */
export type FinChoisie = "aucune" | "prendre-rendez-vous";
export const FINS_PROPOSEES: readonly FinChoisie[] = ["aucune", "prendre-rendez-vous"];
export const GABARITS_PROPOSES: readonly IdGabarit[] = ["G-Journee", "G-Decision", "G-Reponse", "G-Flux"];
export const RATIOS_PROPOSES: readonly Ratio[] = ["4:5", "9:16", "1:1"];
export const RATIO_PRINCIPAL: Ratio = "4:5";

export interface InterrupteursTutoriel {
  formulaire: boolean;
  dossier: boolean;
  phrase: boolean;
}

/** Seul `true` exact allume ; une lecture qui lève éteint. */
export async function lireInterrupteursTutoriel(lire: (id: string, defaut: unknown) => Promise<unknown> = (id, d) => lireParametre<unknown>(id, d)): Promise<InterrupteursTutoriel> {
  const un = async (cle: string): Promise<boolean> => {
    try {
      return (await lire(cle, false)) === true;
    } catch {
      return false;
    }
  };
  const [formulaire, dossier, phrase] = await Promise.all([un(PARAM_FORMULAIRE), un(PARAM_ENTREE_ZIP), un(PARAM_ENTREE_PHRASE)]);
  return { formulaire, dossier, phrase };
}

/** Garde de TOUTE action du tutoriel (dépôt ET validation) : éteint → refus, rien n'est écrit. */
export async function exigerTutorielAllume(lire?: (id: string, defaut: unknown) => Promise<unknown>): Promise<void> {
  if (!(await lireInterrupteursTutoriel(lire)).formulaire) throw new ErreurStudio("TUTORIEL_FERME", PHRASE_TUTORIEL_FERME);
}

export interface DemandeDepotTutoriel {
  mode: "dossier" | "phrase";
  /** Dossier : le fichier déjà envoyé (`typeEntite: "entree"`). */
  fichierId?: string;
  /** Dossier : la case « aucune donnée personnelle n'est visible ». Seul `true` exact compte. */
  attestationImages?: boolean;
  /** Phrase : 10 à 300 caractères. */
  phrase?: string;
  /** « aucune » (défaut) ou « prendre-rendez-vous ». */
  fin?: unknown;
  /** Facultatif ; un parcours inconnu est ignoré. */
  gabarit?: unknown;
  /** Défaut : les trois formats ; le format principal 4:5 doit en faire partie. */
  ratios?: unknown;
  /** « sans-voix » seulement si exact ; tout le reste = avec voix (le défaut). */
  modeVoix?: unknown;
  /** Script collé (facultatif) : texte tel quel, il fait foi (`scriptColle: true`). */
  script?: unknown;
}

export type IssueDepotTutoriel = { statut: "lancee"; videoId: Id } | { statut: "refusee"; phrase: string; rapport?: RapportEntree };

export interface DependancesDepotTutoriel {
  interrupteurs?: () => Promise<InterrupteursTutoriel>;
  fichier?: (fichierId: string) => Promise<Pick<Fichier, "id" | "nom" | "taille" | "cleStockage">>;
  /** Équipe ouverte = `equipeTutorielActive()` (réglages `tutoriel.equipe` ET `tutoriel.claude`, lecture seule : jamais allumés ici) ; absent = lu dans les réglages, éteint si la lecture échoue. */
  equipe?: () => Promise<boolean>;
  /** Octets du fichier envoyé (en mémoire, jamais écrits sur le disque). */
  octets?: (fichier: Pick<Fichier, "id" | "cleStockage" | "taille">) => Promise<Uint8Array>;
  extraire?: (octets: Uint8Array, options: { attestationImages: boolean }) => Promise<ResultatZip>;
  /** Distribution par défaut (le double de Williams) ; liste vide ou sans personne : le dépôt est refusé. */
  distribution?: (formatId: string) => Promise<Distribution[]>;
  brouillon?: (e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown> }) => Promise<Pick<Video, "id">>;
  ratios?: (videoId: Id, ratios: Ratio[]) => Promise<void>;
  /** Lancement commun (format sans prix : montant nul). */
  lancer?: (videoId: Id) => Promise<IssueLancement>;
  abandonner?: (videoId: Id) => Promise<void>;
}

const refus = (phrase: string, rapport?: RapportEntree): IssueDepotTutoriel => ({ statut: "refusee", phrase, ...(rapport ? { rapport } : {}) });

async function fichierParDefaut(fichierId: string) {
  const { fichierEnvoye } = await import("./fichiers");
  return fichierEnvoye(fichierId, "entree");
}

/** Lit le fichier envoyé EN ENTIER par une adresse de lecture du stockage du Studio (aucun appel payant). */
async function octetsParDefaut(fichier: Pick<Fichier, "cleStockage" | "taille">): Promise<Uint8Array> {
  const { fournisseur } = await import("./_commun");
  const stockage = await fournisseur("stockage");
  const cle = fichier.cleStockage ?? "";
  const adresse = stockage.urlLectureDuree ? await stockage.urlLectureDuree(cle, 300) : await stockage.urlLecture(cle);
  if (!adresse) throw new ErreurStudio("FICHIER_ILLISIBLE", "Le dossier n'a pas pu être lu. Envoyez-le à nouveau.");
  const r = await fetch(adresse);
  if (!r.ok) throw new ErreurStudio("FICHIER_ILLISIBLE", "Le dossier n'a pas pu être lu. Envoyez-le à nouveau.");
  const lu = new Uint8Array(await r.arrayBuffer());
  if (lu.length > TAILLE_ZIP_MAX) throw new ErreurStudio("FICHIER_TROP_GROS", phraseTropGros());
  return lu;
}

const phraseTropGros = (): string => `Le dossier dépasse ${Math.round(TAILLE_ZIP_MAX / (1024 * 1024))} Mo : réduisez-le puis renvoyez-le.`;

async function distributionParDefautDuTutoriel(formatId: string): Promise<Distribution[]> {
  const { distributionParDefaut } = await import("./videos");
  return distributionParDefaut(formatId);
}

async function equipeParDefaut(): Promise<boolean> {
  // Import DYNAMIQUE : l'équipe tire l'orchestre et le client Claude, qui n'ont rien à faire dans le dépôt. La règle est celle
  // de la chaîne (tutoriel.equipe ET tutoriel.claude) ; elle attrape elle-même une lecture en échec (éteint).
  try {
    return await (await import("./tutoriel-equipe")).equipeTutorielActive();
  } catch {
    return false;
  }
}

async function brouillonParDefaut(e: { titre: string; sujet: string; distribution: Distribution[]; entrees: Record<string, unknown>; script?: string }) {
  const [{ nouveauBrouillonFormat }, { enregistrerScriptDuBrouillon }] = await Promise.all([import("./creation-format"), import("./videos")]);
  const video = await nouveauBrouillonFormat({ formatId: ID_FORMAT_TUTORIEL, ...e });
  // Le lancement commun exige un script rattaché : un bloc vide (le moteur du tutoriel écrit le texte lui-même).
  await enregistrerScriptDuBrouillon(video.id, [{ id: `${video.id}-b1`, blocRecette: "corps", segments: [{ id: `${video.id}-s1`, texte: e.script ?? "" }] }]);
  return video;
}

async function ratiosParDefaut(videoId: Id, ratios: Ratio[]): Promise<void> {
  await depots().videos.modifier(videoId, { ratios });
}

async function lancerParDefaut(videoId: Id): Promise<IssueLancement> {
  const { lancerAvecAccord } = await import("./creation-format");
  // Format sans prix : montant nul. L'accord réel est celui du devis (T-EXT-42), donné sur l'écran de validation.
  return lancerAvecAccord(videoId, 0, 0);
}

async function abandonnerParDefaut(videoId: Id): Promise<void> {
  const { abandonnerBrouillon } = await import("./videos");
  await abandonnerBrouillon(videoId);
}

function titreDe(depot: DepotTutoriel, nomFichier?: string): string {
  const brut = depot.mode === "phrase" ? depot.phrase : (nomFichier ?? "").replace(/\.zip$/i, "").replace(/[-_]+/g, " ");
  const propre = brut.replace(/\s+/g, " ").trim();
  return (propre || "Tutoriel d'outil").slice(0, 80);
}

function ratiosChoisis(brut: unknown): Ratio[] | null {
  if (brut === undefined) return [...RATIOS_PROPOSES];
  if (!Array.isArray(brut)) return null;
  const liste = RATIOS_PROPOSES.filter((r) => brut.includes(r));
  if (brut.some((r) => !RATIOS_PROPOSES.includes(r as Ratio))) return null;
  return liste.includes(RATIO_PRINCIPAL) ? liste : null;
}

/**
 * Le dépôt. Session exigée, interrupteurs, champs validés, dossier ouvert par `extraireZipSur` (refus : rien n'est créé),
 * brouillon (même pour un format masqué), lancement sans dépense ; lancement refusé : brouillon abandonné.
 */
export async function deposerTutoriel(demande: DemandeDepotTutoriel, dep: DependancesDepotTutoriel = {}): Promise<IssueDepotTutoriel> {
  await exigerSession();
  const sw = await (dep.interrupteurs ?? (() => lireInterrupteursTutoriel()))();
  if (!sw.formulaire) return refus(PHRASE_TUTORIEL_FERME);
  if (demande?.mode !== "dossier" && demande?.mode !== "phrase") return refus("Choisissez ce que vous donnez : un dossier ou une phrase.");

  const fin: FinChoisie | null = demande.fin === undefined || demande.fin === null || demande.fin === "" ? "aucune" : FINS_PROPOSEES.find((f) => f === demande.fin) ?? null;
  if (!fin) return refus("Cette fin n'est pas proposée : choisissez « Aucune » ou « Prendre rendez-vous ».");
  const gabarit = GABARITS_PROPOSES.find((g) => g === demande.gabarit);
  const ratios = ratiosChoisis(demande.ratios);
  if (!ratios) return refus("Choisissez au moins le format 4:5, parmi 4:5, 9:16 et 1:1.");

  const modeVoix: ModeVoixTutoriel = lireModeVoix({ modeVoix: demande.modeVoix });
  let script: string | undefined;
  if (demande.script !== undefined && demande.script !== null) {
    if (typeof demande.script !== "string") return refus("Votre script n'a pas pu être lu : recollez-le.");
    const texte = demande.script.trim();
    if (texte.length > SCRIPT_COLLE_MAX) return refus(`Votre script dépasse ${SCRIPT_COLLE_MAX} caractères : raccourcissez-le.`);
    if (texte) script = texte;
  }
  // Sans script collé, c'est l'équipe qui l'écrit : éteinte, la vidéo resterait en pause pour toujours (TO_SCRIPT_ABSENT).
  if (!script && !(await (dep.equipe ?? equipeParDefaut)())) return refus(PHRASE_EQUIPE_FERMEE);

  let depot: DepotTutoriel;
  let nomFichier: string | undefined;
  if (demande.mode === "dossier") {
    if (!sw.dossier) return refus(MESSAGE_ZIP_FERME);
    const fichierId = typeof demande.fichierId === "string" ? demande.fichierId : "";
    if (!fichierId) return refus("Envoyez d'abord votre dossier.");
    let fichier: Awaited<ReturnType<NonNullable<DependancesDepotTutoriel["fichier"]>>>;
    try {
      fichier = await (dep.fichier ?? fichierParDefaut)(fichierId);
    } catch (e) {
      return refus(e instanceof ErreurStudio ? e.message : "Ce dossier n'est pas arrivé. Envoyez-le à nouveau.");
    }
    if (!(fichier.taille <= TAILLE_ZIP_MAX)) return refus(phraseTropGros());
    nomFichier = fichier.nom;
    const attestationImages = demande.attestationImages === true;
    let resultat: ResultatZip;
    try {
      const octets = await (dep.octets ?? octetsParDefaut)(fichier);
      resultat = await (dep.extraire ?? ((o, opts) => extraireZipSur(o, opts)))(octets, { attestationImages });
    } catch (e) {
      return refus(e instanceof ErreurStudio ? e.message : "Le dossier n'a pas pu être lu. Envoyez-le à nouveau.");
    }
    if (!resultat.ok) return refus("Votre dossier n'a pas pu être utilisé.", resultat.rapport);
    // Rien d'extrait n'est gardé : la chaîne ré-extrait le même fichier par la même fonction.
    depot = { mode: "dossier", fichierId: fichier.id, attestationImages };
  } else {
    if (!sw.phrase) return refus(PHRASE_PHRASE_FERMEE);
    const phrase = typeof demande.phrase === "string" ? demande.phrase.trim() : "";
    if (phrase.length < PHRASE_DEPOT_MIN || phrase.length > PHRASE_DEPOT_MAX) return refus(`Votre phrase doit faire de ${PHRASE_DEPOT_MIN} à ${PHRASE_DEPOT_MAX} caractères.`);
    depot = { mode: "phrase", phrase };
  }

  // Qui parle : le double par défaut. Personne de disponible : refus lisible, jamais un brouillon impossible à lancer.
  // Valable aussi sans voix : la garde de fabrication exige encore une personne (format tutoriel-outil, personnages.min = 1).
  let distribution: Distribution[] = [];
  try {
    distribution = await (dep.distribution ?? distributionParDefautDuTutoriel)(ID_FORMAT_TUTORIEL);
  } catch (e) {
    return refus(e instanceof ErreurStudio ? e.message : PHRASE_PERSONNE_ABSENTE);
  }
  if (modeVoix === MODE_SANS_VOIX) distribution = distribution.filter((d) => d?.personnageId).slice(0, 1);
  if (distribution.length === 0 || !distribution[0]?.personnageId) return refus(PHRASE_PERSONNE_ABSENTE);

  const titre = titreDe(depot, nomFichier);
  const video = await (dep.brouillon ?? brouillonParDefaut)({ titre, sujet: titre, distribution, entrees: { [ENTREE_TUTORIEL]: { depot, fin, ...(gabarit ? { gabarit } : {}), ...entreeModeVoix(modeVoix), ...(script ? { scriptColle: true } : {}) } }, ...(script ? { script } : {}) });
  const abandonner = () => (dep.abandonner ?? abandonnerParDefaut)(video.id).catch(() => undefined);
  try {
    await (dep.ratios ?? ratiosParDefaut)(video.id, ratios);
    const issue = await (dep.lancer ?? lancerParDefaut)(video.id);
    if (issue.statut !== "lancee") {
      await abandonner();
      return refus("Le lancement n'a pas pu se faire : votre demande n'est pas envoyée.");
    }
    return { statut: "lancee", videoId: video.id };
  } catch (e) {
    await abandonner();
    if (e instanceof ErreurStudio) return refus(e.message);
    throw e;
  }
}
