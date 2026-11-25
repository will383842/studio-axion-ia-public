/**
 * RÉSERVE DE TUTORIELS · dépôt (plan PLAN-RESERVE-TUTORIELS-21-11, § 4.3, fiche RES-2). Williams range UNE FOIS un .zip ou
 * une idée ; le tirage (RES-3) les reprend plus tard sans lui.
 *
 * SÉCURITÉ : le zip n'est ouvert QUE par `extraireZipSur` (taille, zip-slip, données personnelles), au dépôt ; refus : rien
 * n'est rangé. Rien d'extrait n'est gardé : seuls la référence du fichier et l'attestation (`true` exact) le sont. Aucun
 * appel payant, aucun montant. Réglages `tutoriel.formulaire` et `tutoriel.entreeZip` / `tutoriel.entreePhrase` : seul `true`
 * exact ouvre ; sinon refus, rien n'est écrit.
 */
import "server-only";
import { ID_ELEMENT_VALIDE, type ElementReserve, type EtatElementReserve, type FinReserve } from "@/domaine/tutoriel-reserve";
import type { Fichier } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { PHRASE_DEPOT_MAX, PHRASE_DEPOT_MIN } from "@/moteurs/montage-tutoriel-outil/entrees";
import { TAILLE_ZIP_MAX } from "@/moteurs/montage-tutoriel-outil/securite-entrees";
import { ErreurStudio, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { MAQUETTES_DEMO } from "./tutoriel-reserve-maquettes";
import { changerEtatReserve, ajouterElementReserve, lireElementReserve } from "./tutoriel-reserve";
import {
  FINS_PROPOSEES,
  PHRASE_PHRASE_FERMEE,
  PHRASE_TUTORIEL_FERME,
  lireInterrupteursTutoriel,
  type InterrupteursTutoriel,
} from "./tutoriel-depot";
import { MESSAGE_ZIP_FERME, extraireZipSur, type RapportEntree, type ResultatZip } from "./zip-tutoriel";

export type IssueReserve = { statut: "ok"; element: ElementReserve } | { statut: "refuse"; phrase: string; rapport?: RapportEntree };

export const SCRIPT_RESERVE_MAX = 8000;
const TITRE_MAX = 80;

export interface DependancesAjoutReserve {
  interrupteurs?: () => Promise<InterrupteursTutoriel>;
  fichier?: (fichierId: string) => Promise<Pick<Fichier, "id" | "nom" | "taille" | "cleStockage">>;
  /** Octets du fichier envoyé (en mémoire, jamais écrits sur le disque). */
  octets?: (fichier: Pick<Fichier, "id" | "cleStockage" | "taille">) => Promise<Uint8Array>;
  extraire?: (octets: Uint8Array, options: { attestationImages: boolean }) => Promise<ResultatZip>;
  /** Défaut : `nouvelId("res")`. */
  nouvelId?: () => string;
  maintenant?: () => string;
}

const refus = (phrase: string, rapport?: RapportEntree): IssueReserve => ({ statut: "refuse", phrase, ...(rapport ? { rapport } : {}) });

async function fichierParDefaut(fichierId: string) {
  const { fichierEnvoye } = await import("./fichiers");
  return fichierEnvoye(fichierId, "entree");
}

const phraseTropGros = (): string => `Le dossier dépasse ${Math.round(TAILLE_ZIP_MAX / (1024 * 1024))} Mo : réduisez-le puis renvoyez-le.`;

/** Lit le fichier envoyé EN ENTIER par une adresse de lecture du stockage (aucun appel payant). */
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

function titreDe(brut: string, defaut: string): string {
  const propre = brut.replace(/\s+/g, " ").trim();
  return (propre || defaut).slice(0, TITRE_MAX);
}

/** Script facultatif : texte retiré des espaces, 8000 caractères au plus ; vide = absent. `null` = invalide. */
function scriptChoisi(brut: unknown): { script?: string } | null {
  if (brut === undefined || brut === null) return {};
  if (typeof brut !== "string") return null;
  const t = brut.trim();
  if (t.length > SCRIPT_RESERVE_MAX) return null;
  return t ? { script: t } : {};
}

function finChoisie(brut: unknown): FinReserve | null {
  if (brut === undefined || brut === null || brut === "") return "aucune";
  return FINS_PROPOSEES.find((f) => f === brut) ?? null;
}

const PHRASE_SCRIPT_LONG = `Le script est trop long : ${SCRIPT_RESERVE_MAX} caractères au plus.`;
const PHRASE_FIN = "Cette fin n'est pas proposée : choisissez « Aucune » ou « Prendre rendez-vous ».";

/**
 * Range un dossier (.zip déjà envoyé) dans la réserve. Session exigée ; interrupteurs ouverts ; la garde du zip passe d'abord.
 * Refus (garde, taille, fichier absent) : rien n'est rangé.
 */
export async function ajouterDossierReserve(d: { fichierId: unknown; attestationImages: unknown; script?: unknown; fin?: unknown }, dep: DependancesAjoutReserve = {}): Promise<IssueReserve> {
  await exigerSession();
  const sw = await (dep.interrupteurs ?? (() => lireInterrupteursTutoriel()))();
  if (!sw.formulaire) return refus(PHRASE_TUTORIEL_FERME);
  if (!sw.dossier) return refus(MESSAGE_ZIP_FERME);
  const fin = finChoisie(d?.fin);
  if (!fin) return refus(PHRASE_FIN);
  const sc = scriptChoisi(d?.script);
  if (!sc) return refus(PHRASE_SCRIPT_LONG);
  const fichierId = typeof d?.fichierId === "string" ? d.fichierId : "";
  if (!fichierId) return refus("Envoyez d'abord votre dossier.");

  let fichier: Awaited<ReturnType<NonNullable<DependancesAjoutReserve["fichier"]>>>;
  try {
    fichier = await (dep.fichier ?? fichierParDefaut)(fichierId);
  } catch (e) {
    return refus(e instanceof ErreurStudio ? e.message : "Ce dossier n'est pas arrivé. Envoyez-le à nouveau.");
  }
  if (!(fichier.taille <= TAILLE_ZIP_MAX)) return refus(phraseTropGros());
  const attestationImages = d.attestationImages === true; // seul `true` exact compte
  let resultat: ResultatZip;
  try {
    const octets = await (dep.octets ?? octetsParDefaut)(fichier);
    resultat = await (dep.extraire ?? ((o, opts) => extraireZipSur(o, opts)))(octets, { attestationImages });
  } catch (e) {
    return refus(e instanceof ErreurStudio ? e.message : "Le dossier n'a pas pu être lu. Envoyez-le à nouveau.");
  }
  if (!resultat.ok) return refus("Votre dossier n'a pas pu être utilisé.", resultat.rapport);
  // Rien d'extrait n'est gardé : la chaîne ré-extrait le même fichier par la même garde.
  const element = await ajouterElementReserve({
    id: (dep.nouvelId ?? (() => nouvelId("res")))(),
    titre: titreDe(fichier.nom.replace(/\.zip$/i, "").replace(/[-_]+/g, " "), "Dossier"),
    source: { type: "dossier", fichierId: fichier.id, nomFichier: fichier.nom, attestationImages },
    ...sc,
    fin,
    ajouteLe: (dep.maintenant ?? maintenant)(),
    ajoutePar: "fondateur",
  });
  return { statut: "ok", element };
}

/** Range une idée (une phrase) dans la réserve. Session exigée ; `tutoriel.formulaire` et `tutoriel.entreePhrase` ouverts. */
export async function ajouterIdeeReserve(d: { phrase: unknown; script?: unknown; fin?: unknown }, dep: Pick<DependancesAjoutReserve, "interrupteurs" | "nouvelId" | "maintenant"> = {}): Promise<IssueReserve> {
  await exigerSession();
  const sw = await (dep.interrupteurs ?? (() => lireInterrupteursTutoriel()))();
  if (!sw.formulaire) return refus(PHRASE_TUTORIEL_FERME);
  if (!sw.phrase) return refus(PHRASE_PHRASE_FERMEE);
  const fin = finChoisie(d?.fin);
  if (!fin) return refus(PHRASE_FIN);
  const sc = scriptChoisi(d?.script);
  if (!sc) return refus(PHRASE_SCRIPT_LONG);
  const phrase = typeof d?.phrase === "string" ? d.phrase.trim() : "";
  if (phrase.length < PHRASE_DEPOT_MIN || phrase.length > PHRASE_DEPOT_MAX) return refus(`Votre phrase doit faire de ${PHRASE_DEPOT_MIN} à ${PHRASE_DEPOT_MAX} caractères.`);
  const element = await ajouterElementReserve({
    id: (dep.nouvelId ?? (() => nouvelId("res")))(),
    titre: titreDe(phrase, "Idée"),
    source: { type: "idee", phrase },
    ...sc,
    fin,
    ajouteLe: (dep.maintenant ?? maintenant)(),
    ajoutePar: "fondateur",
  });
  return { statut: "ok", element };
}

async function changer(id: unknown, depuis: readonly EtatElementReserve[], vers: EtatElementReserve): Promise<IssueReserve> {
  await exigerSession();
  if (typeof id !== "string" || !ID_ELEMENT_VALIDE.test(id)) return refus("Cet élément n'existe pas dans la réserve.");
  const e = await lireElementReserve(id);
  if (!e) return refus("Cet élément n'existe pas dans la réserve.");
  if (!depuis.includes(e.etat)) return refus("Ce changement n'est pas possible pour cet élément.");
  try {
    return { statut: "ok", element: await changerEtatReserve(id, vers) };
  } catch (err) {
    if (err instanceof ErreurStudio) return refus(err.message);
    throw err;
  }
}

/** en_reserve | a_revoir → retire (archivé, jamais effacé). */
export async function retirerDeLaReserve(id: unknown): Promise<IssueReserve> {
  return changer(id, ["en_reserve", "a_revoir"], "retire");
}

/** a_revoir | retire → en_reserve (tentatives remises à 0 par la transition). */
export async function remettreEnReserve(id: unknown): Promise<IssueReserve> {
  return changer(id, ["a_revoir", "retire"], "en_reserve");
}

/** Ajoute SEULEMENT les démos absentes (sans fichier ni copie) ; un id déjà connu, même retiré, n'est jamais réécrit. */
export async function amorcerMaquettesDemo(): Promise<{ ajoutes: number }> {
  await exigerSession();
  let ajoutes = 0;
  for (const m of MAQUETTES_DEMO) {
    if (await lireElementReserve(m.id)) continue;
    await ajouterElementReserve({ id: m.id, titre: m.titre, source: { type: "maquette-demo", dossier: m.dossier }, fin: "aucune", ajouteLe: maintenant(), ajoutePar: "amorcage" });
    ajoutes++;
  }
  return { ajoutes };
}
