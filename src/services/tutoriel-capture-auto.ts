import "server-only";
/**
 * POSTE-4 : orchestrateur de la CAPTURE AUTOMATIQUE du film du tutoriel d'outil (plan « poste relié » du 25/11, sections 2, 5 et 9).
 *
 * À chaque tour de la boucle, SI `tutoriel.captureAuto` vaut exactement `true` : pour une vidéo en pause `TO_FILM_A_CAPTURER` dont
 * l'entrée est un dossier .zip (type de demande `film-zip`), le Studio écrit UNE demande dans la boîte aux lettres
 * (`tutoriel-capture-boite.ts`), relit la réponse du veilleur de l'hôte, la range par le MÊME chemin que le dépôt manuel
 * (`deposerFilmNavigation`) et transforme toute panne en phrase claire (journal + cloche, dédoublonnés).
 *
 * ÉTEINT par défaut : réglage absent, `false`, `"true"`, `1` ou lecture en échec = retour immédiat, AVANT tout import du module de la boîte
 * et de tout autre module lourd : aucun accès disque, aucune écriture, aucun `fetch`.
 *
 * POSTE-1b (REPORTÉ, décision du chef) : le mode `construire` du poste n'existe pas encore. Les vidéos en pause `TO_PIECE_A_CONSTRUIRE` et
 * les vidéos parties d'une phrase (types `apercu` et `film-description`) ne reçoivent AUCUNE demande : comportement actuel inchangé.
 *
 * Sécurité : tout ce qui revient de la boîte est hostile (relu par `lireReponse`, puis revérifié ici : signature, relevé ffprobe contre le
 * calage ET le scénario DE LA DEMANDE, navigation.json, empreinte au dépôt). Zéro appel HeyGen, ElevenLabs ou Claude : ce module ne lit ni
 * voix ni plan, seulement l'état déjà rangé dans le travail. Aucune donnée du client ni texte du script dans le journal ou la cloche :
 * le titre de la vidéo et une phrase fixe seulement.
 * Importé par `boucle.ts` (import dynamique) et par les tests seulement.
 */
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { join } from "node:path";
import type { Fichier, Id, Notification, Travail, TypeNotification, Video } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import type { EtatTutoriel } from "@/moteurs/montage-tutoriel-outil";
import {
  BORNES,
  PHRASES_CODE,
  PHRASE_BOITE_NON_PRETE,
  PHRASE_POSTE_ETEINT,
  PHRASE_SANS_REPONSE,
  RACINE_BOITE_STUDIO,
  calageDepuis,
  dimensionsFilm,
  dureeFilmAttendueMs,
  idFilm,
  jugerFfprobe,
  lireNomDossier,
  nomDossier,
  signatureMp4,
  type AttenduFilm,
  type CalageContrat,
  type CodeReponse,
} from "@/moteurs/montage-tutoriel-outil/capture-auto/contrat";
import type { ScenarioMaquette } from "@/moteurs/montage-tutoriel-outil/scenario-maquette";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre, sousVerrou } from "./_commun";
import type { ReponseBoite, SystemeFichiers } from "./tutoriel-capture-boite";

export const PARAM_CAPTURE_AUTO = "tutoriel.captureAuto";

/** Interrupteur : seul `true` exact allume ; une lecture qui lève = éteint. */
export async function captureAutoAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_CAPTURE_AUTO, false)) === true;
  } catch {
    return false;
  }
}

const MOTEUR_TUTORIEL = "montage-tutoriel-outil";
const CODE_FILM_A_CAPTURER = "TO_FILM_A_CAPTURER";
/** Délais du plan §5. */
export const DELAI_PRISE_MS = 60 * 60 * 1000;
/**
 * Délai « en cours » : la demande a disparu de `demandes/` (le veilleur l'a prise) et aucune réponse n'est arrivée. 70 min : DOIT dépasser le
 * `TimeoutStartSec=3300` s (55 min) du veilleur, sinon le Studio déclarerait en panne une capture que le veilleur finit encore de filmer.
 */
export const DELAI_REPONSE_MS = 70 * 60 * 1000;
const VALIDITE_LECTURE_SEC = 300;
const VALIDITE_DEPOT_SEC = 600;
/** Délais des appels au stockage (sans eux, un stockage qui cale garderait l'annexe en vol pour toujours : un seul passage à la fois). */
export const DELAI_LECTURE_ZIP_MS = 120_000;
export const DELAI_DEPOT_FILM_MS = 600_000;

const PHRASE_SANS_VOIX = "La capture automatique est impossible sans voix mesurée : déposez le film à la main.";
const PHRASE_DOSSIER_ILLISIBLE = "Le dossier de la vidéo n'a pas pu être relu pour la capture automatique : déposez le film à la main.";
const PHRASE_STOCKAGE_LENT = "Le stockage n'a pas répondu à temps : déposez le film à la main.";
const PHRASE_RANGEMENT = "Le film capturé n'a pas pu être rangé : déposez le film à la main.";

/** Lien du suivi de la vidéo (le même que `lienSuivi` de tutoriel-suivi.ts, recopié ici pour ne pas charger cet écran ; un test l'égale). */
export const lienCapture = (videoId: string): string => `/tutoriel-outil/suivi/${videoId}`;

export type CreerNotification = (n: { type: TypeNotification; titre: string; message: string; lien: string }, options: { cloche: true }) => Promise<unknown>;

export interface DependancesCaptureAuto {
  /** Racine de la boîte (défaut : `/var/studio-capture`). */
  racine?: string;
  fs?: SystemeFichiers;
  maintenant?: () => number;
  /** Remplace la lecture de l'interrupteur (tests). */
  allumee?: () => Promise<boolean>;
  stockage?: () => Promise<StockageFichiers>;
  /** Remplace la cloche réelle (tests). */
  cloche?: CreerNotification;
}

// --- mémoire du processus ---------------------------------------------------------------------------------------------------

interface SuiviDemande {
  /** Date à laquelle on a vu la demande disparaître de `demandes/` (le veilleur l'a prise). */
  priseLe?: number;
  dansDemandes?: boolean;
}
const cleMemoire = Symbol.for("studio-axion-ia.capture-auto");
function memoire(): Map<string, SuiviDemande> {
  const g = globalThis as typeof globalThis & { [cleMemoire]?: Map<string, SuiviDemande> };
  g[cleMemoire] ??= new Map();
  return g[cleMemoire];
}

const sha256Octets = (o: Uint8Array): string => createHash("sha256").update(o).digest("hex");

// --- journal : traces de la demande (survivent à un redémarrage) -----------------------------------------------------------------

const PREFIXE_JOURNAL = "Capture automatique : demande ";
const messageDemandee = (id: string): string => `${PREFIXE_JOURNAL}envoyée au poste de capture (${id}).`;
const messageClose = (id: string): string => `${PREFIXE_JOURNAL}terminée (${id}).`;

/** Dernière trace du journal d'une demande : « envoyée » (en vol) ou « terminée » (close). */
interface Marqueur {
  actif: boolean;
  date: number;
  videoId: Id;
}

/**
 * Toutes les demandes tracées au journal (TOUTES vidéos), par id : une seule demande en vol AU TOTAL côté Studio (le Studio ne voit pas
 * `.veilleur/`, donc il ne sait pas si le veilleur a pris ou fini : c'est son journal qui dit « en vol » jusqu'au rangement, à l'effacement
 * ou à l'expiration). Survit à un redémarrage.
 */
async function marqueurs(): Promise<Map<string, Marqueur>> {
  const evs = await depots().evenements.lister((e) => e.entite === "video" && typeof e.message === "string" && e.message.startsWith(PREFIXE_JOURNAL));
  const sortie = new Map<string, Marqueur>();
  for (const e of evs) {
    const date = Date.parse(e.date);
    const id = /\(([a-z0-9-]{8,64})\)\.$/.exec(e.message)?.[1];
    if (!id || !Number.isFinite(date)) continue;
    const avant = sortie.get(id);
    if (!avant || date >= avant.date) sortie.set(id, { actif: e.message.startsWith(`${PREFIXE_JOURNAL}envoyée`), date, videoId: e.entiteId as Id });
  }
  return sortie;
}

// --- cloche + journal, dédoublonnés -------------------------------------------------------------------------------------------

async function creerClocheReelle(n: Parameters<CreerNotification>[0], options: { cloche: true }): Promise<unknown> {
  const { creerNotification } = await import("./notifications");
  return creerNotification(n, options);
}

/**
 * Une cloche (et un journal) par (lien, titre) : une seconde fois, rien. Rend vrai si la cloche a été posée.
 * `episode` (id de la demande en panne) : CHAQUE panne est journalisée, même si la cloche existe déjà (le dédoublonnage ne vaut que pour la
 * cloche) ; et le lien de la cloche porte l'épisode, donc une nouvelle panne de la même vidéo (autre id : nouvelle voix, nouvelle fabrication)
 * sonne de nouveau au lieu de passer sans nouvelle.
 */
async function signalerUneFois(video: Video, type: TypeNotification, titre: string, message: string, dep: DependancesCaptureAuto, episode?: string): Promise<boolean> {
  const lien = episode ? `${lienCapture(video.id)}?capture=${episode}` : lienCapture(video.id);
  const journalType = type === "echec" ? "echec" : "fabrication";
  const deja: Notification[] = await depots().notifications.lister((n) => n.lien === lien && n.titre === titre);
  if (deja.length > 0) {
    if (episode) await journaliser(journalType, message, { type: "video", id: video.id });
    return false;
  }
  await (dep.cloche ?? creerClocheReelle)({ type, titre, message, lien }, { cloche: true });
  await journaliser(journalType, message, { type: "video", id: video.id });
  return true;
}

// --- candidats ----------------------------------------------------------------------------------------------------------------

interface Candidat {
  travail: Travail;
  video: Video;
  fichierId: string;
  etat: EtatTutoriel;
}

const pauseDe = (t: Travail): string | undefined => {
  const p = t.parametres?.pause;
  return p && typeof p === "object" ? ((p as { code?: unknown }).code as string | undefined) : undefined;
};

/**
 * Vidéos en pause `TO_FILM_A_CAPTURER` dont l'entrée est un dossier .zip (`film-zip`), la plus ancienne d'abord.
 * POSTE-1b : `TO_PIECE_A_CONSTRUIRE` et les vidéos parties d'une phrase (`entrees.depot.mode !== "dossier"`) sont ignorées ici.
 */
async function candidats(): Promise<Candidat[]> {
  const { lireEntreesTutoriel } = await import("@/moteurs/montage-tutoriel-outil/entrees");
  const d = depots();
  const enPause = await d.travaux.lister((t) => t.type === "fabrication" && (t.statut === "en_file" || t.statut === "en_cours") && pauseDe(t) === CODE_FILM_A_CAPTURER);
  enPause.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const sortie: Candidat[] = [];
  for (const travail of enPause) {
    // Seule la dernière fabrication de la vidéo compte (comme `deposerFilmNavigation`).
    const memes = await d.travaux.lister((t) => t.cibleId === travail.cibleId && t.type === "fabrication");
    if (memes.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0]?.id !== travail.id) continue;
    const version = travail.versionId ? await d.versions.obtenir(travail.versionId) : null;
    if (!version || version.commande.moteurId !== MOTEUR_TUTORIEL) continue;
    const depot = lireEntreesTutoriel(version.commande.entrees as Record<string, unknown> | undefined).depot;
    if (depot?.mode !== "dossier") continue; // POSTE-1b : phrase / pièce à construire, comportement actuel inchangé
    const video = await d.videos.obtenir(travail.cibleId);
    const etat = travail.parametres?.tutoriel as EtatTutoriel | undefined;
    if (!video || !etat || typeof etat !== "object") continue;
    sortie.push({ travail, video, fichierId: depot.fichierId, etat });
  }
  return sortie;
}

// --- identité de la demande ----------------------------------------------------------------------------------------------------

interface Identite {
  id: string;
  scenario: ScenarioMaquette;
  /** Les octets EXACTS écrits dans la demande (`scenario.json`, `calage.json`) : l'id est calculé sur eux, jamais sur une copie. */
  scenarioOctets: Buffer;
  calage: CalageContrat;
  calageOctets: Buffer;
}

/**
 * Scénario et calage tirés de l'ÉTAT du travail (équipe + voix déjà mesurée), jamais d'un appel : même état = même id.
 * `null` : pas de voix mesurée, ou calage en échec.
 */
async function identiteDe(c: Candidat): Promise<Identite | null> {
  const scenarioBrut = c.etat.equipe?.parcours?.scenario;
  const audio = c.etat.audio;
  if (!scenarioBrut || !audio || !Array.isArray(audio.mots) || !(audio.dureeSec > 0)) return null;
  try {
    const [{ lireScenarioMaquette }, { calerScenario }] = await Promise.all([import("@/moteurs/montage-tutoriel-outil/scenario-maquette"), import("@/moteurs/montage-tutoriel-outil/calage-scenario")]);
    const scenarioOctets = Buffer.from(JSON.stringify(scenarioBrut), "utf8");
    const lu = lireScenarioMaquette(JSON.parse(scenarioOctets.toString("utf8")));
    if (!lu.ok) return null;
    const dureeMs = Math.round(audio.dureeSec * 1000);
    const cal = calerScenario(lu.scenario, audio.mots, dureeMs);
    if (!cal.ok) return null;
    const calage = calageDepuis(cal.etapes, dureeMs);
    const calageOctets = Buffer.from(JSON.stringify(calage), "utf8");
    return { id: idFilm(c.video.id, scenarioOctets, calageOctets, sha256Octets), scenario: lu.scenario, scenarioOctets, calage, calageOctets };
  } catch {
    return null;
  }
}

// --- panne ----------------------------------------------------------------------------------------------------------------------

interface Panne {
  code: CodeReponse | null;
  phrase: string;
}

/** Erreur qui porte sa phrase (déjà sûre : fixe, aucune donnée du client). */
class ErreurCapture extends Error {
  constructor(
    readonly code: CodeReponse | null,
    readonly phrase: string,
  ) {
    super(phrase);
    this.name = "ErreurCapture";
  }
}

/** La phrase rendue par `deposerFilmNavigation` est reprise si elle est fixe ; celle qui cite les erreurs de navigation.json (variable) est remplacée. */
const phraseDuRefus = (phrase: string): string => (phrase.startsWith("Le fichier navigation.json n'est pas valable") ? PHRASES_CODE.FILM_INVALIDE : phrase);

const estDelai = (e: unknown): boolean => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

const panneDe = (e: unknown): Panne => {
  if (e instanceof ErreurCapture) return { code: e.code, phrase: e.phrase };
  const code = (e as { code?: unknown } | null)?.code;
  if (e instanceof Error && e.name === "ErreurBoite" && typeof code === "string" && code in PHRASES_CODE) return { code: code as CodeReponse, phrase: PHRASES_CODE[code as CodeReponse] };
  return { code: null, phrase: PHRASE_RANGEMENT };
};

/** Remplace le message de la pause (code gardé), sous verrou. La chaîne le réécrit à son prochain tour : le journal et la cloche restent la trace. */
async function poserMessagePause(travailId: Id, phrase: string): Promise<void> {
  await sousVerrou(async () => {
    const courant = await depots().travaux.obtenir(travailId);
    if (!courant || (courant.statut !== "en_file" && courant.statut !== "en_cours") || pauseDe(courant) !== CODE_FILM_A_CAPTURER) return;
    const pause = courant.parametres?.pause as Record<string, unknown>;
    await depots().travaux.modifier(travailId, { parametres: { ...courant.parametres, pause: { ...pause, message: phrase } } });
  });
}

// --- lecture du zip (borne 50 Mo, sans tout charger) -------------------------------------------------------------------------------

async function lireZipBorne(url: string): Promise<Uint8Array> {
  let reponse: Response;
  try {
    reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_LECTURE_ZIP_MS) });
  } catch (e) {
    if (estDelai(e)) throw new ErreurCapture(null, PHRASE_STOCKAGE_LENT);
    throw e;
  }
  if (!reponse.ok) throw new ErreurStudio("CAPTURE_ZIP", "Le dossier n'a pas pu être relu.");
  const annonce = Number(reponse.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > BORNES.zip) {
    void reponse.body?.cancel();
    throw erreurBoite("TROP_GROS", "Le dossier dépasse la taille permise.");
  }
  const lecteur = reponse.body?.getReader();
  if (!lecteur) throw new ErreurStudio("CAPTURE_ZIP", "Le dossier n'a pas pu être relu.");
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let lu: ReadableStreamReadResult<Uint8Array>;
    try {
      lu = await lecteur.read(); // le signal du `fetch` couvre aussi la lecture du corps
    } catch (e) {
      if (estDelai(e)) throw new ErreurCapture(null, PHRASE_STOCKAGE_LENT);
      throw e;
    }
    const { done, value } = lu;
    if (done) break;
    total += value.length;
    if (total > BORNES.zip) {
      void lecteur.cancel();
      throw erreurBoite("TROP_GROS", "Le dossier dépasse la taille permise.");
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux, total);
}

function erreurBoite(code: CodeReponse, message: string): Error {
  const e = new Error(message) as Error & { code: CodeReponse };
  e.name = "ErreurBoite";
  e.code = code;
  return e;
}

// --- écriture d'une demande ------------------------------------------------------------------------------------------------------

async function ecrireLaDemande(c: Candidat, ident: Identite, racine: string, fs: SystemeFichiers, dep: DependancesCaptureAuto): Promise<void> {
  const [{ ecrireDemande }, { fichierDepotSansSession }] = await Promise.all([import("./tutoriel-capture-boite"), import("./tutoriel-dossier-fond")]);
  const fichier = await fichierDepotSansSession(c.fichierId, "entree");
  if (fichier.taille > BORNES.zip) throw erreurBoite("TROP_GROS", "Le dossier dépasse la taille permise.");
  const stockage = await (dep.stockage ?? (() => fournisseur("stockage")))();
  if (!stockage.urlLectureDuree) throw new ErreurStudio("CAPTURE_STOCKAGE", "Le stockage ne sait pas relire le dossier.");
  const zip = await lireZipBorne(await stockage.urlLectureDuree(fichier.cleStockage, VALIDITE_LECTURE_SEC));
  ecrireDemande(racine, "film-zip", ident.id, { "dossier.zip": zip, "scenario.json": ident.scenarioOctets, "calage.json": ident.calageOctets }, fs);
  memoire().set(ident.id, { dansDemandes: true });
  await journaliser("fabrication", messageDemandee(ident.id), { type: "video", id: c.video.id });
}

// --- rangement d'une réponse « ok » -------------------------------------------------------------------------------------------------

/**
 * Revérifie la réponse contre la DEMANDE (calage, scénario), dépose le film au stockage, enregistre le Fichier, puis passe par
 * `deposerFilmNavigation` : le même chemin que le dépôt manuel. Lève (`ErreurBoite`, `ErreurCapture`) à la moindre anomalie.
 * HONNÊTETÉ : après le PUT, seule la TAILLE est comparée en production (`confirmerDepot` de R2 ne rend que la taille, pas le sha256) ;
 * le sha256 n'est comparé que si le stockage en rend un. Les octets envoyés sont ceux qui viennent d'être vérifiés (un seul tampon), et
 * `deposerFilmNavigation` relit la signature du film AU STOCKAGE.
 */
async function rangerFilm(c: Candidat, ident: Identite, rep: ReponseBoite, dep: DependancesCaptureAuto): Promise<void> {
  const film = rep.fichiers["navigation.mp4"];
  const navigationBrute = rep.fichiers["navigation.json"];
  const ffprobe = rep.fichiers["ffprobe.json"];
  if (!film || !navigationBrute || !ffprobe) throw erreurBoite("FILM_INVALIDE", "La réponse est incomplète.");
  if (!signatureMp4(film.subarray(0, 16))) throw erreurBoite("FILM_INVALIDE", "Le film n'est pas un MP4.");
  const { TAILLE_MAX_ENVOI } = await import("@/formats");
  if (film.length === 0 || film.length > TAILLE_MAX_ENVOI) throw erreurBoite("FILM_INVALIDE", "Le film est vide ou trop gros.");

  const attendu: AttenduFilm = { dureeMs: dureeFilmAttendueMs(ident.calage.dureeVoixMs), ...dimensionsFilm(ident.scenario.largeur, ident.scenario.hauteur) };
  const verdict = jugerFfprobe(ffprobe.toString("utf8"), attendu);
  if (!verdict.ok) throw erreurBoite("FILM_INVALIDE", "Le relevé du film ne correspond pas à la demande.");

  const navigationTexte = navigationBrute.toString("utf8");
  let navigation: Record<string, unknown>;
  try {
    navigation = JSON.parse(navigationTexte) as Record<string, unknown>;
  } catch {
    throw erreurBoite("FILM_INVALIDE", "navigation.json est illisible.");
  }
  const { lireNavigationFilmee } = await import("@/briques/plan-scenes/tutoriel/navigation-filmee");
  const lue = lireNavigationFilmee({ ...navigation, videoCle: "controle.mp4" });
  if (!lue.ok) throw erreurBoite("FILM_INVALIDE", "navigation.json n'est pas valable.");
  // Le film doit être celui de CETTE demande : mêmes dimensions de page, même durée de voix.
  if (navigation.largeur !== ident.scenario.largeur || navigation.hauteur !== ident.scenario.hauteur || navigation.dureeVoixMs !== ident.calage.dureeVoixMs) {
    throw erreurBoite("FILM_INVALIDE", "navigation.json ne correspond pas à la demande.");
  }

  const sha256 = createHash("sha256").update(film).digest("hex");
  const stockage = await (dep.stockage ?? (() => fournisseur("stockage")))();
  if (!stockage.urlDepotDuree) throw new ErreurStudio("CAPTURE_STOCKAGE", "Le stockage ne sait pas recevoir le film.");
  const { nouvelId } = await import("@/lib/ids");
  const fichierId = nouvelId("f");
  const { cleStockage } = await stockage.preparerDepot({ fichierId, nom: "navigation.mp4", mime: "video/mp4", taille: film.length, typeEntite: "entree", entiteId: c.video.id });
  let confirme = false;
  let enregistre = false;
  try {
    const adresse = await stockage.urlDepotDuree(cleStockage, VALIDITE_DEPOT_SEC, "video/mp4");
    let r: Response;
    try {
      r = await fetch(adresse, { method: "PUT", headers: { "content-type": "video/mp4" }, body: film as unknown as BodyInit, signal: AbortSignal.timeout(DELAI_DEPOT_FILM_MS) });
    } catch (e) {
      if (estDelai(e)) throw new ErreurCapture(null, PHRASE_STOCKAGE_LENT);
      throw e;
    }
    if (!r.ok) throw new ErreurStudio("CAPTURE_STOCKAGE", "Le film n'a pas pu être déposé au stockage.");
    const confirmation = await stockage.confirmerDepot(cleStockage);
    if (!confirmation.ok) throw new ErreurStudio("CAPTURE_STOCKAGE", "Le film n'est pas arrivé au stockage.");
    if (confirmation.taille !== undefined && confirmation.taille !== film.length) throw erreurBoite("FILM_INVALIDE", "Le film déposé ne correspond pas à celui reçu.");
    if (confirmation.sha256 !== undefined && confirmation.sha256 !== sha256) throw erreurBoite("FILM_INVALIDE", "Le film déposé ne correspond pas à celui reçu.");
    const fichier: Fichier = { id: fichierId, cleStockage, nom: "navigation.mp4", mime: "video/mp4", taille: film.length, sha256: confirmation.sha256 ?? sha256, origine: "depot", statut: "pret", ...horodatage() };
    await depots().fichiers.enregistrer(fichier);
    enregistre = true;
    const { deposerFilmNavigation } = await import("./tutoriel-film");
    const issue = await deposerFilmNavigation(c.video.id, { fichierId, navigation: navigationTexte }, { session: async () => undefined, fichier: async () => fichier });
    if (issue.statut !== "ok") throw new ErreurCapture("FILM_INVALIDE", phraseDuRefus(issue.phrase));
    confirme = true;
  } finally {
    if (!confirme) {
      // Film non gardé : aucun objet orphelin au stockage, et le Fichier « pret » enregistré passe en « refuse » (au mieux).
      if (enregistre) await depots().fichiers.modifier(fichierId, { statut: "refuse" }).catch(() => undefined);
      await stockage.supprimer?.(cleStockage).catch(() => undefined);
    }
  }
}

// --- nettoyage de la boîte (sans suivre un seul lien) ------------------------------------------------------------------------------

/** Retire une entrée sans la suivre : `lstat` d'abord, `rmSync` ne suit jamais un lien (un lien est retiré, jamais sa cible). Au mieux. */
function retirerSur(fs: SystemeFichiers, chemin: string): void {
  try {
    fs.lstatSync(chemin);
    fs.rmSync(chemin, { recursive: true, force: true });
  } catch {
    /* absent, ou non retirable : le prochain tour réessaie */
  }
}

const listerSur = (fs: SystemeFichiers, dossier: string): string[] => {
  try {
    return fs.readdirSync(dossier);
  } catch {
    return [];
  }
};

/** Âge (ms) d'une entrée de la boîte d'après son `mtime` (`lstat`), `null` si elle n'existe pas. */
function ageSur(fs: SystemeFichiers, chemin: string, maintenant: number): number | null {
  try {
    return maintenant - fs.lstatSync(chemin).mtimeMs;
  } catch {
    return null;
  }
}

interface ContexteNettoyage {
  racine: string;
  fs: SystemeFichiers;
  maintenant: () => number;
  /** Ids des demandes que les vidéos candidates réclament AUJOURD'HUI. */
  ids: Set<string>;
  marq: Map<string, Marqueur>;
  fermer: (id: string) => Promise<void>;
}

/**
 * Libère la boîte de ce qu'aucune vidéo candidate ne réclame plus (film déposé à la main, vidéo arrêtée ou supprimée, nouveau calage, veilleur
 * arrêté, Studio tué pendant l'écriture) : sans cela, 4 réponses de 500 Mo rempliraient la boîte de 2 Gio et une demande oubliée bloquerait
 * toutes les vidéos suivantes sans un mot.
 *  - réponse `film-zip--<id>` dont l'id n'est celui d'aucun candidat : effacée tout de suite (nom hors motif : après 60 min) ;
 *  - entrée de `demandes/` (y compris `.prep-*`) de plus de 60 min que personne ne réclame : retirée (la demande d'un candidat garde son
 *    propre délai, plus bas) ;
 *  - trace « envoyée » du journal dont ni la demande ni la réponse n'existent plus, qu'aucun candidat ne réclame, et vieille de 60 + 70 min : close.
 * Toute demande retirée ou toute réponse effacée est close au journal : elle ne compte plus comme envoyée.
 */
async function nettoyerBoite(x: ContexteNettoyage): Promise<void> {
  const { racine, fs, ids, marq } = x;
  const now = x.maintenant();
  for (const nom of listerSur(fs, join(racine, "reponses"))) {
    const lu = lireNomDossier(nom);
    const chemin = join(racine, "reponses", nom);
    if (lu && lu.type === "film-zip" && ids.has(lu.id)) continue;
    if (!lu) {
      const age = ageSur(fs, chemin, now);
      if (age === null || age <= DELAI_PRISE_MS) continue;
    }
    retirerSur(fs, chemin);
    if (lu) await x.fermer(lu.id);
  }
  for (const nom of listerSur(fs, join(racine, "demandes"))) {
    const lu = lireNomDossier(nom);
    if (lu && lu.type === "film-zip" && ids.has(lu.id)) continue; // celle d'un candidat : son délai est traité dans le tour
    const chemin = join(racine, "demandes", nom);
    const age = ageSur(fs, chemin, now);
    if (age === null || age <= DELAI_PRISE_MS) continue;
    retirerSur(fs, chemin);
    const id = lu?.id ?? /^\.prep-([a-z0-9-]{8,64})$/.exec(nom)?.[1];
    if (id) await x.fermer(id);
  }
  for (const [id, m] of marq) {
    if (!m.actif || ids.has(id)) continue;
    const nom = nomDossier("film-zip", id);
    const presente = ageSur(fs, join(racine, "demandes", nom), now) !== null || ageSur(fs, join(racine, "reponses", nom), now) !== null;
    if (!presente && now - m.date > DELAI_PRISE_MS + DELAI_REPONSE_MS) await x.fermer(id);
  }
}

// --- le tour --------------------------------------------------------------------------------------------------------------------------

/**
 * Un tour de la capture automatique (appelé par la boucle). Éteint : `return` immédiat, rien d'importé, rien lu, rien écrit.
 * Ne lève jamais vers la boucle pour une panne de la boîte : elle devient une phrase (journal + cloche).
 * UNE SEULE demande en vol AU TOTAL : tant que le journal montre une demande « envoyée » non close (de n'importe quelle vidéo) ou que
 * `demandes/` n'est pas vide, aucune autre n'est écrite.
 */
export async function avancerCapturesTutoriel(dep: DependancesCaptureAuto = {}): Promise<void> {
  if (!(await (dep.allumee ?? captureAutoAllumee)())) return;

  const boite = await import("./tutoriel-capture-boite");
  const racine = dep.racine ?? RACINE_BOITE_STUDIO;
  const fs: SystemeFichiers = dep.fs ?? nodeFs;
  const maintenant = dep.maintenant ?? Date.now;

  const liste = await candidats();
  const etat = boite.etatBoite(racine, fs, maintenant);
  // (a) boîte non prête : une cloche s'il y a une vidéo à servir, aucune écriture dans la boîte.
  if (etat === "non-prete") {
    if (liste.length > 0) await signalerUneFois(liste[0]!.video, "info", `Boîte du poste de capture non prête · ${liste[0]!.video.titre}`, PHRASE_BOITE_NON_PRETE, dep);
    return;
  }

  const identites = new Map<Candidat, Identite | null>();
  for (const c of liste) identites.set(c, await identiteDe(c));
  const ids = new Set([...identites.values()].flatMap((i) => (i ? [i.id] : [])));
  const marq = await marqueurs();
  /** Clôt la demande au journal (elle ne compte plus comme envoyée) et oublie la mémoire du processus. */
  const fermer = async (id: string): Promise<void> => {
    memoire().delete(id);
    const m = marq.get(id);
    if (!m?.actif) return;
    m.actif = false;
    await journaliser("fabrication", messageClose(id), { type: "video", id: m.videoId });
  };

  // (b) ce qu'aucun candidat ne réclame est retiré de la boîte (réponses orphelines, demandes et `.prep-*` anciens).
  await nettoyerBoite({ racine, fs, maintenant, ids, marq, fermer });
  if (liste.length === 0) return;

  // (c) poste éteint : une cloche, un journal, une fois par (vidéo, état) ; aucune écriture dans la boîte.
  if (etat === "eteinte") {
    await signalerUneFois(liste[0]!.video, "info", `Poste de capture éteint · ${liste[0]!.video.titre}`, PHRASE_POSTE_ETEINT, dep);
    return;
  }

  let aEchoue = false;
  const echouer = async (c: Candidat, id: string, p: Panne): Promise<void> => {
    aEchoue = true;
    let essais = 0;
    try {
      essais = boite.noterEchec(racine, id, fs);
    } catch {
      essais = boite.MAX_TENTATIVES;
    }
    const suite = essais >= boite.MAX_TENTATIVES ? " Plus aucun nouvel essai automatique." : "";
    const titre = `La capture automatique du film s'est arrêtée (essai ${essais}) · ${c.video.titre}`;
    await signalerUneFois(c.video, "echec", titre, p.phrase + suite, dep, id);
    await fermer(id);
    await poserMessagePause(c.travail.id, p.phrase);
  };

  // (d) relire d'abord les réponses présentes, et surveiller les délais des demandes déjà parties.
  const aDemander: { c: Candidat; ident: Identite }[] = [];
  for (const c of liste) {
    const ident = identites.get(c);
    if (!ident) {
      await signalerUneFois(c.video, "echec", `Capture automatique impossible · ${c.video.titre}`, PHRASE_SANS_VOIX, dep);
      continue;
    }
    const nom = nomDossier("film-zip", ident.id);
    let reponse: ReponseBoite | null = null;
    try {
      reponse = boite.lireReponse(racine, "film-zip", ident.id, fs);
    } catch (e) {
      await echouer(c, ident.id, panneDe(e));
      boite.effacerReponse(racine, "film-zip", ident.id, fs);
      continue;
    }
    if (reponse) {
      try {
        if (reponse.statut !== "ok") await echouer(c, ident.id, { code: reponse.code, phrase: PHRASES_CODE[reponse.code] });
        else {
          await rangerFilm(c, ident, reponse, dep);
          await fermer(ident.id); // clôture : la même vidéo remise en pause plus tard avec le même état recevra une NOUVELLE demande
          await journaliser("fabrication", "Le film a été capturé automatiquement et rangé : la vidéo reprend.", { type: "video", id: c.video.id });
        }
      } catch (e) {
        await echouer(c, ident.id, panneDe(e));
      } finally {
        boite.effacerReponse(racine, "film-zip", ident.id, fs);
      }
      continue;
    }

    // Pas de réponse : la demande attend-elle encore dans `demandes/`, ou le veilleur l'a-t-il prise ?
    const marqueur = marq.get(ident.id);
    const dossier = join(racine, "demandes", nom);
    let stat: nodeFs.Stats | null = null;
    try {
      stat = fs.lstatSync(dossier);
    } catch {
      stat = null;
    }
    const suivi = memoire().get(ident.id) ?? {};
    if (stat) {
      suivi.dansDemandes = true;
      memoire().set(ident.id, suivi);
      if (maintenant() - stat.mtimeMs > DELAI_PRISE_MS) {
        retirerSur(fs, dossier);
        await echouer(c, ident.id, { code: null, phrase: PHRASE_SANS_REPONSE });
      }
      continue;
    }
    if (marqueur?.actif) {
      // La demande a disparu sans réponse : prise par le veilleur. Début de l'attente : vue en mémoire, sinon date de la demande au journal (redémarrage).
      if (suivi.dansDemandes && suivi.priseLe === undefined) suivi.priseLe = maintenant();
      memoire().set(ident.id, suivi);
      const depuis = suivi.priseLe ?? marqueur.date;
      if (maintenant() - depuis > DELAI_REPONSE_MS) await echouer(c, ident.id, { code: null, phrase: PHRASE_SANS_REPONSE });
      continue;
    }
    aDemander.push({ c, ident });
  }

  // (e) aucune demande en vol AU TOTAL, aucun échec ce tour : la plus ancienne vidéo écrit sa demande (une seule par tour).
  if (aEchoue || aDemander.length === 0) return;
  const enVol = [...marq].filter(([, m]) => m.actif);
  if (enVol.length > 0 || boite.demandeEnVol(racine, fs)) {
    // Une demande que plus aucune vidéo ne réclame bloque depuis plus de 60 min : panne « sans nouvelle » interdite, une cloche (une fois).
    if (enVol.some(([id, m]) => !ids.has(id) && maintenant() - m.date > DELAI_PRISE_MS)) {
      await signalerUneFois(aDemander[0]!.c.video, "echec", `Le poste de capture ne répond plus · ${aDemander[0]!.c.video.titre}`, PHRASE_SANS_REPONSE, dep);
    }
    return;
  }
  for (const { c, ident } of aDemander) {
    if (boite.tentatives(racine, ident.id, fs) >= boite.MAX_TENTATIVES) continue; // plus rien d'automatique : le dépôt manuel reste
    try {
      await ecrireLaDemande(c, ident, racine, fs, dep);
    } catch (e) {
      const p = panneDe(e);
      await echouer(c, ident.id, p.code || e instanceof ErreurCapture ? p : { code: null, phrase: PHRASE_DOSSIER_ILLISIBLE });
    }
    return;
  }
}
