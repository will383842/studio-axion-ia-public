/**
 * VIDÉOS SUR LE SITE (lot S1) : passeport web de la vidéo, rangé dans le kit de publication (aucune collection de plus).
 * Le passeport d'essai est gratuit (aucun fournisseur) ; Claude ne l'écrit que sur un geste de Will, derrière un réglage éteint.
 */
import "server-only";
import type { KitPublication, Montant, Sortie, Video } from "@/domaine/types";
import { centimesUsd } from "@/fournisseurs/claude/tarifs";
import { ESSAIS_PASSEPORT_WEB, entreePasseportWeb, evaluerPasseportWeb, rolePasseportWeb, type SortiePasseportWeb } from "@/generateur/roles/passeport-web";
import { pireCasRole } from "@/generateur/roles/types";
import { usdVersEur } from "@/lib/montants";
import { passeportDEssai } from "@/domaine/site-videos/passeport";
import { TITRE_WEB_MAX } from "@/domaine/site-videos/passeport";
import type { EtatSite, LigneReglageSite, OrigineChampWeb, PasseportWeb, VueFeuilleSurLeSite } from "@/domaine/site-videos/types";
import { conseilSite, listerFormatsActifs, mentionIAActive, nomCourtFormat, trouverFormat } from "@/formats";
import { dimensionsMiniature } from "@/domaine/miniatures";
import { controlerAvantSite, type EntreeControlesSite, type ResultatControlesSite } from "@/domaine/site-videos/controles";
import { REGLAGES_SITE_INCONNUS, type ReglagesDuSite } from "@/domaine/site-videos/reglages-site";
import type { EcrivainInterdits } from "@/domaine/qualite-script/types";
import { dureeDeLaVideo } from "@/domaine/duree-video";
import { adressePublique, clesPubliques, corpsPasseport } from "@/domaine/site-videos/contrat";
import { lectureImmediate, type LectureImmediate } from "@/domaine/site-videos/mp4";
import { exporterVtt } from "@/briques/sous-titres/export";
import { sha256Hex } from "@/fournisseurs/site/signature";
import { stockagePublicFacticeCourant } from "@/fournisseurs/site/simulation";
import type { StockageFichiers } from "@/fournisseurs/types";
import { slugWeb } from "@/domaine/site-videos/passeport";
import { ErreurSite, type StockagePublic } from "@/fournisseurs/site/types";
import { depots, ecrireParametre, ErreurStudio, fournisseur, fournisseurSimule, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { sousTitresDepuisTexte, sousTitresUtilisables } from "./telechargements-sous-titres";
import { obtenirVideo, sousTitresCourants } from "./videos";
import { sousVerrouKit } from "./verrou-kit";
import { claudeTextesActif, executerRolePourVideo } from "./depense-claude-video";
import { taux } from "./generation-claude";
import { creerNotification } from "./notifications";
import { sousTitresDeLaVideo } from "./telechargements";
import { texteScript } from "@/domaine/derivations";

/**
 * Sortie à publier par défaut : ratio maître, sans réseau, la plus grande ; à défaut, la plus grande sans réseau.
 * Formats par réseau T4 : à format ÉGAL seulement, la fin décide avant la taille : fin propre (`appelAuMot: false`),
 * puis fin inconnue (fichiers d'avant), puis fin au mot en dernier (celui des Reels, « Écrivez MOT en commentaire », ne
 * va pas au site quand un autre fichier du format existe ; décision de Will du 18/10 16 h 55). Le repli entre formats
 * différents reste à la taille.
 */
export function sortiePrincipale(video: Pick<Video, "ratios">, sorties: Sortie[]): Sortie | undefined {
  const plusGrande = (l: Sortie[]) => {
    const ratio = [...l].sort((a, b) => b.taille - a.taille)[0]?.ratio;
    const rangFin = (s: Sortie): number => (s.appelAuMot === false ? 0 : s.appelAuMot === undefined ? 1 : 2);
    return l.filter((s) => s.ratio === ratio).sort((a, b) => rangFin(a) - rangFin(b) || b.taille - a.taille)[0];
  };
  const sansReseau = sorties.filter((s) => !s.reseau);
  return plusGrande(sansReseau.filter((s) => s.ratio === video.ratios[0])) ?? plusGrande(sansReseau) ?? plusGrande(sorties);
}

/** Passeport d'essai d'une vidéo prête (lecture seule, aucun fournisseur) ; `null` si la vidéo n'est pas prête ou sans script. */
export async function construirePasseportDEssai(video: Video, credits: string[]): Promise<PasseportWeb | null> {
  if (video.statut !== "prete" || !video.scriptId) return null;
  const d = depots();
  const script = await d.scripts.obtenir(video.scriptId);
  if (!script) return null;
  const versionId = video.versionChoisieId ?? (await d.versions.lister((v) => v.videoId === video.id && v.statut !== "maquette")).sort((a, b) => b.numero - a.numero)[0]?.id;
  const sorties = versionId ? await d.sorties.lister((s) => s.versionId === versionId) : [];
  const sortie = sortiePrincipale(video, sorties);
  const alignes = versionId ? (await sousTitresCourants(versionId))?.segments : undefined;
  const segments = sousTitresUtilisables(alignes) ? alignes : sousTitresDepuisTexte(texteScript(script.blocs), sortie?.dureeSec ?? video.dureeCibleSec);
  const format = trouverFormat(video.formatId);
  if (!format) return null;
  return passeportDEssai({ video, blocs: script.blocs, segments, format, sortie, credits, contenuGenere: mentionIAActive(format, video), maintenant: maintenant() });
}

/**
 * Passeport de la vidéo : celui du kit ; un ancien kit sans passeport le reçoit ici (même verrou, gratuit).
 * `null` : vidéo pas prête, ou sans kit encore (le kit se crée à l'affichage du kit).
 */
export async function passeportDeLaVideo(videoId: string): Promise<PasseportWeb | null> {
  const d = depots();
  const kit = await d.kits.trouver((k) => k.videoId === videoId);
  if (kit?.passeportWeb) return kit.passeportWeb;
  const video = await d.videos.obtenir(videoId);
  if (!video || video.statut !== "prete") return null;
  return sousVerrouKit(async () => {
    const frais: KitPublication | null = await d.kits.trouver((k) => k.videoId === videoId);
    if (frais?.passeportWeb) return frais.passeportWeb;
    const passeport = await construirePasseportDEssai(video, frais?.credits ?? []);
    if (passeport && frais) await d.kits.modifier(frais.id, { passeportWeb: passeport });
    return passeport;
  });
}

/** Champs que Will peut retoucher dans la feuille « Sur le site ». */
export type RetouchePasseport = Partial<Pick<PasseportWeb, "titreWeb" | "resume" | "aRetenir" | "questions" | "rubrique" | "motsCles" | "chapitres" | "lienService" | "sortieId">>;

const CHAMPS_AVEC_ORIGINE = ["titreWeb", "resume", "aRetenir", "questions", "rubrique", "motsCles", "chapitres"] as const;
/** Seuls champs qu'une retouche écrit : l'action serveur reçoit un objet quelconque (jamais la transcription ni la mention IA). */
const CHAMPS_RETOUCHABLES: readonly (keyof RetouchePasseport)[] = [...CHAMPS_AVEC_ORIGINE, "lienService", "sortieId"];
/** Lien conseillé : une adresse relative du site (« /fr/… »), jamais un autre domaine. */
const LIEN_SITE = /^\/(?![/\\])[^\s]*$/;

/**
 * Retouche du passeport par Will : sa retouche gagne (origine « will »), la `version` monte de 1 seulement si quelque
 * chose change. Écrit sous le verrou du kit (deux retouches simultanées gardent leurs deux champs).
 */
export async function modifierPasseport(videoId: string, retouche: RetouchePasseport): Promise<PasseportWeb> {
  await exigerSession();
  if (retouche.titreWeb !== undefined && retouche.titreWeb.trim().length > TITRE_WEB_MAX) {
    throw new ErreurStudio("TITRE_TROP_LONG", `Le titre fait ${retouche.titreWeb.trim().length} caractères : ${TITRE_WEB_MAX} au plus.`);
  }
  if (retouche.lienService !== undefined && retouche.lienService !== "" && !LIEN_SITE.test(retouche.lienService)) {
    throw new ErreurStudio("LIEN_INVALIDE", "Le lien doit être une page du site, par exemple « /fr/formations/… ».");
  }
  const actuel = await passeportDeLaVideo(videoId);
  if (!actuel) throw new ErreurStudio("PASSEPORT_INTROUVABLE", "Cette vidéo n'a pas encore de page pour le site.");
  const d = depots();
  return sousVerrouKit(async () => {
    const kit = await d.kits.trouver((k) => k.videoId === videoId);
    const avant = kit?.passeportWeb;
    if (!kit || !avant) throw new ErreurStudio("PASSEPORT_INTROUVABLE", "Cette vidéo n'a pas encore de page pour le site.");
    const suivant: PasseportWeb = { ...avant, origines: { ...avant.origines } };
    let change = false;
    for (const cle of CHAMPS_RETOUCHABLES) {
      let valeur = retouche[cle];
      if (valeur === undefined) continue;
      if (cle === "titreWeb" || cle === "resume" || cle === "rubrique") valeur = (valeur as string).trim();
      if (JSON.stringify(valeur) === JSON.stringify(avant[cle])) continue;
      (suivant as unknown as Record<string, unknown>)[cle] = valeur;
      if ((CHAMPS_AVEC_ORIGINE as readonly string[]).includes(cle)) suivant.origines[cle as (typeof CHAMPS_AVEC_ORIGINE)[number]] = "will" satisfies OrigineChampWeb;
      change = true;
    }
    if (!change) return avant;
    suivant.version = avant.version + 1;
    suivant.modifieLe = maintenant();
    await d.kits.modifier(kit.id, { passeportWeb: suivant });
    return suivant;
  });
}

/* ------------------------------------------------------------------ */
/* Réglages → Sur le site : un interrupteur par générateur, tous éteints */
/* ------------------------------------------------------------------ */

export const cleSiteGenerateur = (formatId: string) => `siteGenerateurs.${formatId}`;
export const cleSiteAuto = (formatId: string) => `siteAuto.${formatId}`;

/** Un générateur peut-il envoyer ses vidéos sur le site ? (interrupteur `siteGenerateurs.<id>`, éteint par défaut). */
export async function generateurSiteAllume(formatId: string): Promise<boolean> {
  return (await lireParametre<boolean>(cleSiteGenerateur(formatId), false)) === true;
}

/** Une ligne par format actif, avec le conseil du plan et les deux interrupteurs. Lecture seule. */
export async function lireReglagesSite(): Promise<LigneReglageSite[]> {
  const lignes: LigneReglageSite[] = [];
  for (const f of listerFormatsActifs()) {
    const generateur = await generateurSiteAllume(f.id);
    lignes.push({ formatId: f.id, nom: nomCourtFormat(f), conseil: conseilSite(f), generateur, auto: generateur && (await lireParametre<boolean>(cleSiteAuto(f.id), false)) === true });
  }
  return lignes;
}

function formatPourSite(formatId: string) {
  const format = trouverFormat(formatId);
  if (!format || format.statut === "masque") throw new ErreurStudio("FORMAT_INCONNU", "Ce type de vidéo n'existe pas.");
  return format;
}

/** Ce qu'a fait l'interrupteur d'un générateur sur ses vidéos déjà sur le site. */
export interface ResumeGenerateur {
  /** Éteint : vidéos retirées du site. */
  retirees: number;
  /** Éteint : vidéos qui n'ont pas pu être retirées (restent « échec », listées avec « Réessayer »). */
  echecs: { videoId: string; message: string }[];
  /** Rallumé : vidéos republiées. */
  republiees: number;
  /** Rallumé : vidéos laissées hors ligne (un contrôle refuse, ou le site ne répond pas), avec leur raison. */
  refusees: { videoId: string; message: string }[];
}

/**
 * Autorise ou coupe l'envoi des vidéos d'un générateur sur le site. Éteindre coupe aussi l'envoi automatique et RETIRE
 * du site chaque vidéo du générateur qui y est (rien n'est effacé dans le studio) ; rallumer republie celles que
 * l'extinction avait retirées (contrôles refaits).
 */
export async function definirSiteGenerateur(formatId: string, allume: boolean): Promise<ResumeGenerateur> {
  await exigerSession();
  const format = formatPourSite(formatId);
  await ecrireParametre(cleSiteGenerateur(formatId), allume === true);
  if (allume !== true) await ecrireParametre(cleSiteAuto(formatId), false);
  await journaliser("reglage", `Sur le site (${nomCourtFormat(format)}) : ${allume ? "autorisé" : "coupé"}`);
  return allume === true ? republierTout(formatId) : retirerTout(formatId);
}

/** Les vidéos d'un générateur qui ont un état sur le site (kit et vidéo). */
async function videosDuGenerateur(formatId: string) {
  const d = depots();
  const sortie: { videoId: string; site: EtatSite }[] = [];
  for (const kit of await d.kits.lister((k) => !!k.site)) {
    const video = await d.videos.obtenir(kit.videoId);
    if (video?.formatId === formatId) sortie.push({ videoId: video.id, site: kit.site! });
  }
  return sortie;
}

const resumeVide = (): ResumeGenerateur => ({ retirees: 0, echecs: [], republiees: 0, refusees: [] });

/** Retire du site chaque vidéo en ligne du générateur, marquée « retirée par le générateur ». Les échecs restent « échec ». */
export async function retirerTout(formatId: string): Promise<ResumeGenerateur> {
  const resume = resumeVide();
  for (const { videoId, site: e } of await videosDuGenerateur(formatId)) {
    const enLigne = e.etat === "en-ligne" || e.etat === "envoi-en-cours" || e.etat === "retrait-en-cours" || (e.etat === "echec" && e.versionEnLigne !== undefined);
    if (!enLigne) continue;
    try {
      await retirerDuSite(videoId);
      await majEtatSite(videoId, (x) => ({ ...x, retireeParGenerateur: true }));
      resume.retirees++;
    } catch (err) {
      resume.echecs.push({ videoId, message: err instanceof Error ? err.message : "Le retrait n'a pas abouti." });
    }
  }
  return resume;
}

/** Republie les vidéos que l'extinction du générateur avait retirées (contrôles refaits ; un refus la laisse hors ligne avec sa raison). */
export async function republierTout(formatId: string): Promise<ResumeGenerateur> {
  const resume = resumeVide();
  for (const { videoId, site: e } of await videosDuGenerateur(formatId)) {
    if (e.retireeParGenerateur !== true || e.etat !== "retiree") continue;
    try {
      const apres = await publierSurLeSite(videoId);
      if (apres.etat === "en-ligne") resume.republiees++;
      else resume.refusees.push({ videoId, message: apres.derniereErreur ?? "L'envoi n'a pas abouti." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "La vidéo n'a pas pu être republiée.";
      await majEtatSite(videoId, (x) => ({ ...x, derniereErreur: message }));
      resume.refusees.push({ videoId, message });
    }
  }
  return resume;
}

/** Publication automatique après les finitions : refusée tant que le générateur est éteint. */
export async function definirSiteAuto(formatId: string, allume: boolean): Promise<void> {
  await exigerSession();
  const format = formatPourSite(formatId);
  if (allume === true && !(await generateurSiteAllume(formatId))) throw new ErreurStudio("GENERATEUR_ETEINT", "Autorisez d'abord ce type de vidéo sur le site.");
  await ecrireParametre(cleSiteAuto(formatId), allume === true);
  await journaliser("reglage", `Sur le site, envoi automatique (${nomCourtFormat(format)}) : ${allume ? "allumé" : "coupé"}`);
}

/* ------------------------------------------------------------------ */
/* « Réécrire avec Claude » : seulement sur un geste de Will, réglage éteint par défaut */
/* ------------------------------------------------------------------ */

export const PARAM_PASSEPORT_PAR_CLAUDE = "site.passeportParClaude";

/** Claude peut-il écrire le passeport ? (réglage `site.passeportParClaude`, éteint par défaut). */
export async function passeportParClaudeAllume(): Promise<boolean> {
  return (await lireParametre<boolean>(PARAM_PASSEPORT_PAR_CLAUDE, false)) === true;
}

/**
 * Prix d'une réécriture, dit AVANT le geste (même calcul que « Réécrire » des textes : tous les essais, au pire cas).
 * `null` : réglage éteint ou Claude non relié (le bouton n'est pas montré). Aucun appel.
 */
export async function prixReecriturePasseport(videoId: string): Promise<Montant | null> {
  if (!(await passeportParClaudeAllume()) || !(await claudeTextesActif())) return null;
  const passeport = await passeportDeLaVideo(videoId);
  if (!passeport) return null;
  const t = await taux();
  return usdVersEur(centimesUsd(ESSAIS_PASSEPORT_WEB * pireCasRole(rolePasseportWeb, entreePasseportWeb({ titre: passeport.titreWeb, texteValide: passeport.transcription }))), t);
}

const CHAMPS_CLAUDE = ["titreWeb", "resume", "aRetenir", "questions", "rubrique", "motsCles"] as const;

/** Pose la sortie de Claude sous le verrou du kit : un champ retouché par Will n'est jamais écrasé. */
async function poserSortieClaude(videoId: string, sortie: SortiePasseportWeb): Promise<PasseportWeb> {
  const d = depots();
  return sousVerrouKit(async () => {
    const kit = await d.kits.trouver((k) => k.videoId === videoId);
    const avant = kit?.passeportWeb;
    if (!kit || !avant) throw new ErreurStudio("PASSEPORT_INTROUVABLE", "Cette vidéo n'a pas encore de page pour le site.");
    const suivant: PasseportWeb = { ...avant, origines: { ...avant.origines } };
    let change = false;
    for (const cle of CHAMPS_CLAUDE) {
      if (avant.origines[cle] === "will") continue;
      const valeur = typeof sortie[cle] === "string" ? (sortie[cle] as string).trim() : sortie[cle];
      (suivant as unknown as Record<string, unknown>)[cle] = valeur;
      suivant.origines[cle] = "claude";
      if (JSON.stringify(valeur) !== JSON.stringify(avant[cle])) change = true;
    }
    suivant.version = change ? avant.version + 1 : avant.version;
    suivant.modifieLe = maintenant();
    await d.kits.modifier(kit.id, { passeportWeb: suivant });
    return suivant;
  });
}

/**
 * Geste « Réécrire avec Claude » : titre, résumé, « À retenir », questions, rubrique, mots-clés. Jamais appelé à
 * l'affichage. Réglage éteint → aucun appel. Une reprise ciblée si la réponse est refusée, puis échec propre (le
 * passeport reste tel quel). Les champs retouchés par Will sont gardés.
 */
export async function reecrirePasseport(videoId: string): Promise<PasseportWeb> {
  await exigerSession();
  if (!(await passeportParClaudeAllume())) throw new ErreurStudio("REGLAGE_ETEINT", "L'écriture par Claude est coupée (Réglages › Sur le site).");
  const passeport = await passeportDeLaVideo(videoId);
  if (!passeport) throw new ErreurStudio("PASSEPORT_INTROUVABLE", "Cette vidéo n'a pas encore de page pour le site.");
  let donnees = { titre: passeport.titreWeb, texteValide: passeport.transcription, corrections: undefined as string[] | undefined };
  for (let tour = 1; tour <= ESSAIS_PASSEPORT_WEB; tour++) {
    const r = await executerRolePourVideo(videoId, rolePasseportWeb, entreePasseportWeb(donnees), { etape: "Passeport du site", parWill: true });
    if (!r.ok) throw new ErreurStudio("CLAUDE_ARRET", r.message);
    if (r.simule) throw new ErreurStudio("CLAUDE_NON_RELIE", "Claude n'est pas relié : rien n'a été écrit.");
    if (r.marqueur) throw new ErreurStudio("PASSEPORT_REFUSE", "Claude n'a pas trouvé de quoi écrire cette page sans rien inventer : le texte actuel est gardé.");
    const echecs = r.donnees ? evaluerPasseportWeb(r.donnees) : [`sortie illisible (${r.invalide ?? "vide"})`];
    if (r.donnees && !echecs.length) {
      await journaliser("publication", "Page du site écrite par Claude", { type: "video", id: videoId });
      return poserSortieClaude(videoId, r.donnees);
    }
    await journaliser("publication", `Page du site refusée (essai ${tour} sur ${ESSAIS_PASSEPORT_WEB})`, { type: "video", id: videoId });
    donnees = { ...donnees, corrections: echecs };
  }
  throw new ErreurStudio("PASSEPORT_REFUSE", "Claude n'a pas écrit une page utilisable : le texte actuel est gardé.");
}

/* ------------------------------------------------------------------ */
/* Contrôles avant publication (lot S2) : l'entrée est assemblée en LECTURE SEULE */
/* ------------------------------------------------------------------ */

/**
 * Écrivain dont les interdits s'appliquent à un générateur. Table ICI, jamais dans le code d'un format (un format ne
 * publie pas lui-même). Inconnu : aucun interdit propre (les interdits communs et ceux du site restent appliqués).
 */
const ECRIVAIN_DU_FORMAT: Record<string, EcrivainInterdits> = {
  avocat: "ecrire",
  facecam: "ecrire",
  "facecam-animee": "ecrire",
  podcast: "ecrire",
  "tableau-anime": "tableau",
  "cas-concret": "cas-concret",
  "image-video": "image-video",
};

export function ecrivainDuFormat(formatId: string): EcrivainInterdits | null {
  return Object.hasOwn(ECRIVAIN_DU_FORMAT, formatId) ? ECRIVAIN_DU_FORMAT[formatId] : null;
}

/** Lecteur des réglages du site (certification, avis) : posé par un essai ; sinon le fournisseur « site » est interrogé. */
type LecteurReglagesSite = () => Promise<ReglagesDuSite>;
const cleLecteur = Symbol.for("studio-axion-ia.site.lecteur-reglages");
type AvecLecteur = typeof globalThis & { [cleLecteur]?: LecteurReglagesSite | null };

/** Essais seulement : comment lire les réglages chez le site. `null` : retour au fournisseur « site ». */
export function injecterLecteurReglagesSite(lecteur: LecteurReglagesSite | null): void {
  (globalThis as AvecLecteur)[cleLecteur] = lecteur;
}

/**
 * Réglages du site : lus par le lecteur injecté (essais), sinon chez le fournisseur « site » (simulation : le site
 * factice). Injoignable ou illisible = inconnu (les contrôles sont alors stricts).
 */
async function lireReglagesDuSite(): Promise<ReglagesDuSite> {
  const lecteur = (globalThis as AvecLecteur)[cleLecteur] ?? (async () => (await fournisseur("site")).lireReglages());
  try {
    const r = await lecteur();
    const bool = (x: unknown) => (typeof x === "boolean" ? x : null);
    return { certifexempleCertificationObtenue: bool(r.certifexempleCertificationObtenue), avisPublies: bool(r.avisPublies) };
  } catch {
    return REGLAGES_SITE_INCONNUS;
  }
}

const ETATS_EN_LIGNE = new Set(["en-ligne", "envoi-en-cours", "retrait-en-cours"]);

/** Une autre vidéo du même sujet (même `scriptMaitreId`) ou de la même lignée (`sourceVideoId`) est-elle sur le site ? */
async function autreVersionEnLigne(video: Video): Promise<boolean> {
  const d = depots();
  const script = video.scriptId ? await d.scripts.obtenir(video.scriptId) : null;
  const memeSujet = async (autre: Video) => {
    if (autre.id === video.id) return false;
    if (autre.sourceVideoId === video.id || video.sourceVideoId === autre.id) return true;
    if (video.sourceVideoId && autre.sourceVideoId === video.sourceVideoId) return true;
    if (!script?.scriptMaitreId || !autre.scriptId) return false;
    return (await d.scripts.obtenir(autre.scriptId))?.scriptMaitreId === script.scriptMaitreId;
  };
  for (const autre of await d.videos.lister()) {
    if (!(await memeSujet(autre))) continue;
    const kit = await d.kits.trouver((k) => k.videoId === autre.id);
    if (kit?.site && ETATS_EN_LIGNE.has(kit.site.etat)) return true;
  }
  return false;
}

/**
 * Entrée des contrôles d'une vidéo (LECTURE SEULE : un ancien kit sans passeport reçoit un passeport d'essai calculé,
 * pas écrit). `options.reglagesSite` : réglages déjà lus chez le site (sinon lus par le lecteur, une fois).
 */
export async function entreeControlesDeLaVideo(videoId: string, options: { reglagesSite?: ReglagesDuSite } = {}): Promise<EntreeControlesSite> {
  const d = depots();
  const detail = await obtenirVideo(videoId);
  if (!detail) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  const { video } = detail;
  const kit = await d.kits.trouver((k) => k.videoId === videoId);
  const format = trouverFormat(video.formatId);
  const passeport = kit?.passeportWeb ?? (await construirePasseportDEssai(video, kit?.credits ?? []));
  if (!passeport) throw new ErreurStudio("PASSEPORT_INTROUVABLE", "Cette vidéo n'est pas prête pour le site.");
  const sortie = sortiePrincipale(video, detail.sorties);
  const miniature = detail.miniatures.find((m) => m.id === video.miniatureChoisieId) ?? detail.miniatures.find((m) => m.choisie);
  return {
    formatId: video.formatId,
    ecrivain: ecrivainDuFormat(video.formatId),
    passeport,
    generateurAllume: await generateurSiteAllume(video.formatId),
    videoPrete: video.statut === "prete",
    typeDerive: video.typeDerive,
    autreVersionEnLigne: await autreVersionEnLigne(video),
    dureeSec: dureeDeLaVideo(video.dureeCibleSec, sortie).sec,
    sousTitres: !!passeport.transcription.trim() && (detail.sousTitres ? detail.sousTitres.segments.length > 0 : true),
    vignette: miniature ? dimensionsMiniature(miniature.ratio) : null,
    entreeLogoClient: !!video.entrees["logo-client"],
    licencesABloquer: detail.licencesABloquer.length,
    avantDePublier: kit?.avantDePublier ?? { image: false, son: false, sousTitres: false, mentionIA: false, droits: false },
    mentionIAActive: format ? mentionIAActive(format, video) : true,
    caseAucunClient: kit?.site?.aucunClient === true,
    reglagesSite: options.reglagesSite ?? (await lireReglagesDuSite()),
  };
}

/** Les contrôles S2 d'une vidéo (lecture seule). */
export async function controlesDeLaVideo(videoId: string, options: { reglagesSite?: ReglagesDuSite } = {}): Promise<ResultatControlesSite> {
  return controlerAvantSite(await entreeControlesDeLaVideo(videoId, options));
}

/* ------------------------------------------------------------------ */
/* Bloc « Sur le site » de la fiche vidéo (lot S3)                      */
/* ------------------------------------------------------------------ */

export type VueSurLeSite =
  | { visible: false }
  | {
      visible: true;
      videoId: string;
      /** Case « Sur le site » cochée. */
      choisie: boolean;
      /** `null` : jamais envoyée. */
      etat: EtatSite["etat"] | null;
      enLigne: boolean;
      url?: string;
      versionEnLigne?: number;
      /** Version du passeport d'aujourd'hui. */
      versionPasseport: number;
      /** Le passeport a changé depuis la version en ligne : « Mettre à jour ». */
      aMettreAJour: boolean;
      derniereErreur?: string;
      /** Envoi vers le site factice : pastille « Essai ». */
      simulation: boolean;
      aucunClient: boolean;
    };


/** Un kit existe pour cette vidéo (créé au besoin : gratuit). */
async function kitDe(videoId: string): Promise<KitPublication> {
  const { genererKit } = await import("./publications");
  return genererKit(videoId);
}

/** Modifie l'état sur le site sous le verrou du kit. `f` reçoit l'état actuel (ou un état neuf) et rend le suivant. */
async function majEtatSite(videoId: string, f: (actuel: EtatSite) => EtatSite): Promise<EtatSite> {
  const kit = await kitDe(videoId);
  return sousVerrouKit(async () => {
    const frais = (await depots().kits.obtenir(kit.id)) ?? kit;
    const suivant = f(frais.site ?? { choisie: false, etat: "hors-ligne", fichiersPublics: [], modifieLe: maintenant() });
    const pose: EtatSite = { ...suivant, modifieLe: maintenant() };
    await depots().kits.modifier(kit.id, { site: pose });
    return pose;
  });
}

/** Ce que voit Will dans le bloc « Sur le site » de la fiche. Lecture seule, aucun appel au site. */
export async function vueSurLeSite(videoId: string): Promise<VueSurLeSite> {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || video.statut !== "prete" || !(await generateurSiteAllume(video.formatId))) return { visible: false };
  const kit = await d.kits.trouver((k) => k.videoId === videoId);
  const e = kit?.site;
  const versionPasseport = kit?.passeportWeb?.version ?? (await construirePasseportDEssai(video, kit?.credits ?? []))?.version ?? 1;
  const enLigne = !!e && e.etat === "en-ligne";
  return {
    visible: true,
    videoId,
    choisie: e?.choisie === true,
    etat: e?.etat ?? null,
    enLigne,
    ...(e?.url ? { url: e.url } : {}),
    ...(e?.versionEnLigne !== undefined ? { versionEnLigne: e.versionEnLigne } : {}),
    versionPasseport,
    aMettreAJour: enLigne && e.versionEnLigne !== undefined && versionPasseport > e.versionEnLigne,
    ...(e?.derniereErreur ? { derniereErreur: e.derniereErreur } : {}),
    simulation: await fournisseurSimule("site"),
    aucunClient: e?.aucunClient === true,
  };
}

/** Refuse tant que le générateur de la vidéo n'est pas autorisé sur le site, ou que la vidéo n'est pas prête. */
async function exigerSelectionnable(videoId: string): Promise<Video> {
  const video = await depots().videos.obtenir(videoId);
  if (!video) throw new ErreurStudio("INTROUVABLE", "Cette vidéo n'existe plus.");
  if (!(await generateurSiteAllume(video.formatId))) throw new ErreurStudio("GENERATEUR_ETEINT", `Les vidéos « ${nomCourtFormat(video)} » ne vont pas sur le site (Réglages › Sur le site).`);
  if (video.statut !== "prete") throw new ErreurStudio("NON_PRETE", "La vidéo n'est pas prête.");
  return video;
}

/** Case « Sur le site » d'une vidéo (décochée par défaut). Aucun envoi. */
export async function cocherSurLeSite(videoId: string, choisie: boolean): Promise<EtatSite> {
  await exigerSession();
  await exigerSelectionnable(videoId);
  return majEtatSite(videoId, (e) => ({ ...e, choisie: choisie === true }));
}

/** Case « Aucun client nommé, aucun logo » de la feuille de relecture. */
export async function cocherAucunClient(videoId: string, coche: boolean): Promise<EtatSite> {
  await exigerSession();
  await exigerSelectionnable(videoId);
  return majEtatSite(videoId, (e) => ({ ...e, aucunClient: coche === true }));
}

/** Phrase des contrôles bloquants en échec (les deux premiers, pour un refus lisible). */
function phraseControles(r: ResultatControlesSite): string {
  const rouges = r.controles.filter((c) => !c.ok && c.gravite === "bloquant");
  return rouges.slice(0, 2).map((c) => c.message).join(" ") + (rouges.length > 2 ? ` (et ${rouges.length - 2} autre${rouges.length > 3 ? "s" : ""})` : "");
}

/** Un envoi « en cours » plus vieux que cela est un envoi interrompu (studio arrêté) : il ne bloque plus. */
const ENVOI_PERIME_MS = 5 * 60 * 1000;
/** Noms versionnés par le contenu : le navigateur peut garder ces fichiers un an, jamais de purge. */
const CACHE_PUBLIC = "public, max-age=31536000, immutable";
/** Octets lus au début du fichier privé pour vérifier la lecture immédiate. */
const OCTETS_LECTURE_IMMEDIATE = 64 * 1024;

const phraseSite = (e: unknown): string => (e instanceof ErreurSite ? e.message : "L'envoi au site n'a pas abouti : réessayez dans quelques minutes.");

/** Dimensions de la sortie (« 1080x1920 »), sinon celles du ratio. */
function dimensionsSortie(resolution: string | undefined, ratio: string): { largeur: number; hauteur: number } {
  const m = /^(\d+)x(\d+)$/.exec(resolution ?? "");
  if (m) return { largeur: Number(m[1]), hauteur: Number(m[2]) };
  const [l, h] = ratio.split(":").map(Number);
  return l && h ? { largeur: 1080, hauteur: Math.round((1080 * h) / l) } : { largeur: 1080, hauteur: 1920 };
}

/* --- Stockages (privé du studio, public des fichiers du site) : injectables pour les essais --- */

interface StockagesSite {
  prive?: Pick<StockageFichiers, "lireDebut">;
  public?: StockagePublic;
}
const cleStockages = Symbol.for("studio-axion-ia.site.stockages");
type AvecStockages = typeof globalThis & { [cleStockages]?: StockagesSite | null };

/** Essais seulement : remplace le stockage privé lu et le stockage public écrit. `null` : retour au registre. */
export function injecterStockagesSite(s: StockagesSite | null): void {
  (globalThis as AvecStockages)[cleStockages] = s;
}

/** Stockage public des fichiers du site : le stockage factice tant que le vrai seau n'est pas branché (décision de Will). */
function stockagePublic(): StockagePublic {
  return (globalThis as AvecStockages)[cleStockages]?.public ?? stockagePublicFacticeCourant();
}

async function stockagePrive(): Promise<Pick<StockageFichiers, "lireDebut">> {
  return (globalThis as AvecStockages)[cleStockages]?.prive ?? (await fournisseur("stockage"));
}

interface FichiersAPublier {
  video: { cle: string; taille: number; sha256: string };
  vignette: { cle: string; taille: number; sha256: string; mime: string };
  vtt: { texte: string; sha256: string };
  sortie: Sortie | undefined;
}

/** Les trois fichiers à rendre publics : la sortie choisie, la miniature choisie, le .vtt fabriqué à la demande. */
async function fichiersAPublier(video: Video, passeport: PasseportWeb): Promise<FichiersAPublier> {
  const detail = await obtenirVideo(video.id);
  const d = depots();
  const sortie = detail?.sorties.find((x) => x.id === passeport.sortieId) ?? (detail ? sortiePrincipale(video, detail.sorties) : undefined);
  const miniature = detail?.miniatures.find((m) => m.id === video.miniatureChoisieId) ?? detail?.miniatures.find((m) => m.choisie);
  const fMp4 = sortie ? await d.fichiers.obtenir(sortie.fichierId) : null;
  const fJpg = miniature ? await d.fichiers.obtenir(miniature.fichierId) : null;
  if (!fMp4 || !fJpg) throw new ErreurStudio("FICHIER_INTROUVABLE", "Un fichier de la vidéo est introuvable : refaites l'export.");
  const segments = await sousTitresDeLaVideo(video, detail?.sousTitres?.segments, detail?.sorties ?? []);
  const texte = exporterVtt(segments);
  // L'empreinte vient du dépôt (`Fichier.sha256`) ; sans elle, de la clé de stockage et de la taille (stables pour un fichier donné).
  const empreinte = (f: { sha256?: string; cleStockage: string; taille: number }) => f.sha256 ?? sha256Hex(`${f.cleStockage}:${f.taille}`);
  return {
    video: { cle: fMp4.cleStockage, taille: fMp4.taille, sha256: empreinte(fMp4) },
    vignette: { cle: fJpg.cleStockage, taille: fJpg.taille, sha256: empreinte(fJpg), mime: fJpg.mime },
    vtt: { texte, sha256: sha256Hex(texte) },
    sortie,
  };
}

/** Version du passeport inscrite dans une clé publique (`…-v3-1a2b3c4d.mp4`). */
const versionDeLaCle = (cle: string): number | null => {
  const m = /-v(\d+)-[0-9a-f]{8}\.[a-z0-9]+$/.exec(cle);
  return m ? Number(m[1]) : null;
};

/** Efface des fichiers publics ; renvoie ceux qui n'ont pas pu l'être (ils restent notés pour être effacés plus tard). */
async function effacerFichiersPublics(cles: string[]): Promise<string[]> {
  const restent: string[] = [];
  for (const cle of cles) {
    try {
      await stockagePublic().supprimer(cle);
    } catch {
      restent.push(cle);
    }
  }
  return restent;
}

/**
 * Publie la vidéo sur le site (ou la met à jour). Refus (ErreurStudio) : générateur éteint, case non cochée, contrôle
 * bloquant en échec, fichier qui ne se lit pas tout de suite, envoi déjà en cours ; rien n'est alors envoyé ni copié.
 * Ordre (plan § 6.2) : fichiers publics déposés et vérifiés, PUIS l'envoi signé. Une panne n'est pas un refus : l'état
 * passe à « échec » avec sa phrase, les fichiers de CETTE version sont effacés (aucun orphelin), sans exception.
 */
export async function publierSurLeSite(videoId: string): Promise<EtatSite> {
  await exigerSession();
  return publierSansSession(videoId);
}

/** Le même envoi, sans session : pour la boucle de fond (finitions), qui n'a pas de cookie. */
async function publierSansSession(videoId: string): Promise<EtatSite> {
  const video = await exigerSelectionnable(videoId);
  const kit0 = await depots().kits.trouver((k) => k.videoId === videoId);
  if (kit0?.site?.choisie !== true) throw new ErreurStudio("NON_CHOISIE", "Cochez d'abord « Sur le site » pour cette vidéo.");
  // Le vrai site ne reçoit jamais une page dont les fichiers ne seraient qu'en mémoire (seau public pas branché, décision D7).
  if (!(globalThis as AvecStockages)[cleStockages]?.public && !(await fournisseurSimule("site"))) {
    throw new ErreurStudio("STOCKAGE_PUBLIC_A_RELIER", "Le dépôt public des vidéos n'est pas encore relié : rien n'est envoyé au site.");
  }
  const entree = await entreeControlesDeLaVideo(videoId);
  const controles = controlerAvantSite(entree);
  if (!controles.publiable) throw new ErreurStudio("CONTROLES", phraseControles(controles));
  const passeport = entree.passeport;

  // Le fichier de la vidéo se lit-il tout de suite en ligne ? (début du fichier : « moov » avant « mdat »)
  const fichiers = await fichiersAPublier(video, passeport);
  let lecture: LectureImmediate = "inconnu";
  try {
    const prive = await stockagePrive();
    if (prive.lireDebut) lecture = lectureImmediate(await prive.lireDebut(fichiers.video.cle, OCTETS_LECTURE_IMMEDIATE));
  } catch {
    lecture = "inconnu";
  }
  if (lecture === "non") throw new ErreurStudio("LECTURE_IMMEDIATE", "Le fichier ne se lit pas tout de suite en ligne : refaites l'export.");
  if (lecture === "inconnu") await journaliser("publication", "Vidéo sur le site : lecture immédiate du fichier non vérifiée (stockage sans lecture partielle)", { type: "video", id: videoId });

  // Sous le verrou du kit : un seul envoi à la fois (deux onglets, deux gestes).
  const kit = await kitDe(videoId);
  const avant = await sousVerrouKit(async () => {
    const frais = (await depots().kits.obtenir(kit.id)) ?? kit;
    const e = frais.site;
    if (e?.etat === "envoi-en-cours" && Date.now() - new Date(e.modifieLe).getTime() < ENVOI_PERIME_MS) throw new ErreurStudio("ENVOI_EN_COURS", "Un envoi est déjà en cours pour cette vidéo.");
    await depots().kits.modifier(kit.id, { site: { ...(e ?? { choisie: true, fichiersPublics: [] }), etat: "envoi-en-cours", modifieLe: maintenant() } });
    return { fichiersPublics: e?.fichiersPublics ?? [], versionEnLigne: e?.versionEnLigne };
  });

  let nouvelles: string[] = [];
  try {
    const slug = slugWeb(passeport.titreWeb);
    const cles = clesPubliques({ idStudio: videoId, slug, version: passeport.version, sha256: { video: fichiers.video.sha256, vignette: fichiers.vignette.sha256, vtt: fichiers.vtt.sha256 } });
    const toutes = [cles.video, cles.vignette, cles.vtt];
    nouvelles = toutes.filter((c) => !avant.fichiersPublics.includes(c));
    // Les clés sont notées AVANT le dépôt : un envoi interrompu laisse une trace, jamais un fichier orphelin invisible.
    await majEtatSite(videoId, (e) => ({ ...e, fichiersPublics: [...new Set([...e.fichiersPublics, ...toutes])] }));
    const publics = stockagePublic();
    await publics.copierDepuisPrive({ cle: fichiers.video.cle, taille: fichiers.video.taille }, cles.video, { contentType: "video/mp4", cacheControl: CACHE_PUBLIC });
    await publics.copierDepuisPrive({ cle: fichiers.vignette.cle, taille: fichiers.vignette.taille }, cles.vignette, { contentType: "image/jpeg", cacheControl: CACHE_PUBLIC });
    await publics.deposerTexte(cles.vtt, fichiers.vtt.texte, { contentType: "text/vtt; charset=utf-8", cacheControl: CACHE_PUBLIC });
    for (const cle of toutes) {
      const present = await publics.existe(cle);
      if (!present.existe || !(present.taille && present.taille > 0)) throw new ErreurSite("serveur", "Un fichier n'est pas arrivé en ligne : réessayez dans quelques minutes.");
    }
    const { largeur, hauteur } = dimensionsSortie(fichiers.sortie?.resolution, passeport.ratio);
    const corps = corpsPasseport({
      idStudio: videoId,
      passeport,
      slugPropose: slug,
      generateur: video.formatId,
      langue: video.langue.slice(0, 2).toLowerCase() || "fr",
      dureeSec: entree.dureeSec,
      largeur,
      hauteur,
      publieLe: maintenant(),
      urls: { video: adressePublique(cles.video), vignette: adressePublique(cles.vignette), vtt: adressePublique(cles.vtt) },
      vignette: entree.vignette ?? { largeur: 0, hauteur: 0 },
    });
    const reponse = await (await fournisseur("site")).publier(corps);
    await journaliser("publication", `Vidéo sur le site : « ${passeport.titreWeb} » en ligne (version ${reponse.versionPasseport})`, { type: "video", id: videoId });
    // On garde la version qui vient de partir et la précédente (le cache du site peut encore la servir) ; le reste s'efface.
    const gardees = new Set<number>([passeport.version, ...(avant.versionEnLigne !== undefined ? [avant.versionEnLigne] : [])]);
    const aEffacer = [...new Set([...avant.fichiersPublics, ...toutes])].filter((c) => {
      const v = versionDeLaCle(c);
      return v !== null && !gardees.has(v);
    });
    const restent = await effacerFichiersPublics(aEffacer);
    return await majEtatSite(videoId, (e) => ({
      ...e,
      etat: "en-ligne",
      versionEnLigne: reponse.versionPasseport,
      url: reponse.url,
      fichiersPublics: e.fichiersPublics.filter((c) => !aEffacer.includes(c) || restent.includes(c)),
      derniereErreur: undefined,
      retireeParGenerateur: undefined,
    }));
  } catch (e) {
    if (!(e instanceof ErreurSite)) console.error("[studio] envoi au site", e);
    await journaliser("publication", `Vidéo sur le site : envoi en échec (${phraseSite(e)})`, { type: "video", id: videoId });
    // Aucun orphelin : les fichiers de CETTE version sont effacés (ceux de la page déjà en ligne, jamais).
    const restent = await effacerFichiersPublics(nouvelles);
    return majEtatSite(videoId, (actuel) => ({ ...actuel, etat: "echec", derniereErreur: phraseSite(e), fichiersPublics: actuel.fichiersPublics.filter((c) => !nouvelles.includes(c) || restent.includes(c)) }));
  }
}

/* --- Attente entre deux essais (injectable : les essais n'attendent pas vraiment) --- */

const cleAttente = Symbol.for("studio-axion-ia.site.attente");
type AvecAttente = typeof globalThis & { [cleAttente]?: ((ms: number) => Promise<void>) | null };

/** Essais seulement : remplace l'attente entre deux nouveaux essais. `null` : la vraie attente. */
export function injecterAttenteSite(f: ((ms: number) => Promise<void>) | null): void {
  (globalThis as AvecAttente)[cleAttente] = f;
}

const attendreSite = (ms: number): Promise<void> => ((globalThis as AvecAttente)[cleAttente] ?? ((n: number) => new Promise<void>((ok) => setTimeout(ok, n))))(ms);

/** Attentes avant chacun des trois nouveaux essais d'un retrait (plan § 6.3) : 1 s, 2 s, 4 s. */
export const ATTENTES_RETRAIT_MS = [1000, 2000, 4000] as const;

/**
 * Retire la page du site, avec les nouveaux essais d'un site qui ne répond pas (injoignable ou 5xx) : le premier appel,
 * puis jusqu'à 3 nouveaux essais après 1 s, 2 s, 4 s. Un refus qui ne se répare pas en réessayant (signature…) n'est
 * jamais répété. Lève l'erreur du dernier essai.
 */
export async function retirerPageAvecEssais(videoId: string): Promise<void> {
  const site = await fournisseur("site");
  for (let essai = 0; ; essai++) {
    try {
      await site.retirer(videoId);
      return;
    } catch (e) {
      const reessayable = e instanceof ErreurSite && (e.code === "injoignable" || e.code === "serveur");
      if (!reessayable || essai >= ATTENTES_RETRAIT_MS.length) throw e;
      await attendreSite(ATTENTES_RETRAIT_MS[essai]);
    }
  }
}

/**
 * Retire la vidéo du site (la vidéo reste dans le studio). Ordre (plan § 6.3) : `DELETE` signé (200 ou 404 = succès),
 * PUIS tous les fichiers publics (le site ne touche jamais aux fichiers). Une vidéo qui n'est pas sur le site : aucun
 * appel. Site injoignable après les essais : état « échec », SITE_INJOIGNABLE, rien n'est effacé.
 */
export async function retirerDuSite(videoId: string): Promise<EtatSite> {
  await exigerSession();
  const kit = await depots().kits.trouver((k) => k.videoId === videoId);
  const e = kit?.site;
  if (!e || !(e.etat === "en-ligne" || e.etat === "envoi-en-cours" || e.etat === "retrait-en-cours" || (e.etat === "echec" && e.versionEnLigne !== undefined))) {
    return e ?? (await majEtatSite(videoId, (x) => x));
  }
  await majEtatSite(videoId, (x) => ({ ...x, etat: "retrait-en-cours" }));
  try {
    await retirerPageAvecEssais(videoId);
  } catch (err) {
    await journaliser("publication", `Vidéo sur le site : retrait en échec (${phraseSite(err)})`, { type: "video", id: videoId });
    await majEtatSite(videoId, (x) => ({ ...x, etat: "echec", derniereErreur: phraseSite(err) }));
    throw new ErreurStudio("SITE_INJOIGNABLE", phraseSite(err));
  }
  await journaliser("publication", "Vidéo sur le site : retirée du site", { type: "video", id: videoId });
  const aEffacer = (await depots().kits.trouver((k) => k.videoId === videoId))?.site?.fichiersPublics ?? [];
  const restent = await effacerFichiersPublics(aEffacer);
  return majEtatSite(videoId, (x) => ({ ...x, etat: "retiree", versionEnLigne: undefined, url: undefined, derniereErreur: undefined, fichiersPublics: restent }));
}

/** La feuille de relecture : passeport, contrôles (lus chez le site) et prix du geste « Réécrire ». Aucune écriture, aucune dépense. */
export async function feuilleSurLeSite(videoId: string): Promise<VueFeuilleSurLeSite> {
  await exigerSession();
  await exigerSelectionnable(videoId);
  const entree = await entreeControlesDeLaVideo(videoId);
  const kit = await depots().kits.trouver((k) => k.videoId === videoId);
  return {
    videoId,
    passeport: entree.passeport,
    controles: controlerAvantSite(entree),
    aucunClient: entree.caseAucunClient,
    prixClaude: await prixReecriturePasseport(videoId),
    simulation: await fournisseurSimule("site"),
    enLigne: kit?.site?.etat === "en-ligne",
  };
}

/**
 * Avant la suppression définitive (`supprimerVideosDefinitivement`) : chaque vidéo qui est (ou a pu être) sur le site en
 * est retirée, fichiers publics compris. Une vidéo jamais publiée : aucun appel au site. Le site ne répond pas :
 * SITE_INJOIGNABLE, et rien n'est effacé dans le studio.
 */
export async function retirerAvantSuppression(ids: string[]): Promise<void> {
  const d = depots();
  for (const id of ids) {
    const kit = await d.kits.trouver((k) => k.videoId === id);
    const e = kit?.site;
    if (!e) continue;
    const enLigne = e.etat === "en-ligne" || e.etat === "envoi-en-cours" || e.etat === "retrait-en-cours" || (e.etat === "echec" && e.versionEnLigne !== undefined);
    if (enLigne) {
      const video = await d.videos.obtenir(id);
      try {
        await retirerDuSite(id);
      } catch (err) {
        if (err instanceof ErreurStudio && err.code === "SITE_INJOIGNABLE") throw new ErreurStudio("SITE_INJOIGNABLE", `« ${video?.titre ?? "Cette vidéo"} » est encore sur le site, qui ne répond pas : réessayez dans quelques minutes.`);
        throw err;
      }
    } else if (e.fichiersPublics.length) {
      // Retirée ou jamais en ligne, mais des fichiers publics restent notés (effacement raté) : ils partent avec la vidéo.
      await effacerFichiersPublics(e.fichiersPublics);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Envoi automatique après les finitions (lot S4)                        */
/* ------------------------------------------------------------------ */

const TITRE_A_RELIRE = "À relire avant le site";

/**
 * Appelée après les finitions d'une NOUVELLE vidéo (`travaux.ts`). Seulement si le générateur est autorisé ET son envoi
 * automatique allumé (tous deux éteints par défaut) : la case « Sur le site » est cochée, puis la vidéo part SI tous les
 * contrôles bloquants passent ; sinon une notification « À relire avant le site » et AUCUN envoi. Le passeport d'essai
 * échoue toujours à la page pauvre (SITE-10) : rien ne part tant que Claude (réglage éteint) ou Will n'a pas écrit la
 * page, et la case « Aucun client » reste à cocher par Will. Ne lève jamais : les finitions ne doivent pas en souffrir.
 */
export async function publicationAuto(videoId: string): Promise<"rien" | "a-relire" | "publiee"> {
  try {
    const d = depots();
    const video = await d.videos.obtenir(videoId);
    if (!video || video.statut !== "prete") return "rien";
    if (!(await generateurSiteAllume(video.formatId)) || (await lireParametre<boolean>(cleSiteAuto(video.formatId), false)) !== true) return "rien";
    const existant = (await d.kits.trouver((k) => k.videoId === videoId))?.site;
    if (existant && (existant.etat === "en-ligne" || existant.etat === "envoi-en-cours" || existant.etat === "retrait-en-cours")) return "rien";
    await majEtatSite(videoId, (e) => ({ ...e, choisie: true }));
    const controles = await controlesDeLaVideo(videoId);
    let raison = "relisez la page avant de la publier sur le site.";
    if (controles.publiable) {
      try {
        await publierSansSession(videoId);
        return "publiee";
      } catch (e) {
        // Un refus au dernier moment (fichier qui ne se lit pas tout de suite…) : Will le lit, rien n'est parti.
        if (!(e instanceof ErreurStudio)) throw e;
        raison = e.message;
      }
    }
    const lien = `/videos/${videoId}`;
    if (!(await d.notifications.compter((n) => n.lien === lien && n.titre === TITRE_A_RELIRE && !n.lue))) {
      await creerNotification({ type: "info", titre: TITRE_A_RELIRE, message: `${video.titre} : ${raison}`, lien, estDemo: video.estDemo });
    }
    return "a-relire";
  } catch (e) {
    console.error("[studio] envoi automatique sur le site", e);
    return "rien";
  }
}

/**
 * Page de la vidéo à citer dans la description YouTube : seulement si le réglage `site.lienDansYoutube` (éteint) est
 * allumé ET que la vidéo est en ligne. Lecture seule ; `null` : la description reste telle quelle.
 */
export async function pagePourYoutube(videoId: string): Promise<{ url: string; chapitres: PasseportWeb["chapitres"] } | null> {
  if ((await lireParametre<boolean>("site.lienDansYoutube", false)) !== true) return null;
  const kit = await depots().kits.trouver((k) => k.videoId === videoId);
  if (kit?.site?.etat !== "en-ligne" || !kit.site.url) return null;
  return { url: kit.site.url, chapitres: kit.passeportWeb?.chapitres ?? [] };
}

/* ------------------------------------------------------------------ */
/* Page « Sur le site » et entrée de menu (lot S3)                      */
/* ------------------------------------------------------------------ */

/** Au moins un type de vidéo est-il autorisé sur le site ? (sinon ni page, ni entrée de menu). */
export async function surLeSiteVisible(): Promise<boolean> {
  for (const f of listerFormatsActifs()) if (await generateurSiteAllume(f.id)) return true;
  return false;
}

export interface LigneEnLigne {
  videoId: string;
  titre: string;
  etat: EtatSite["etat"];
  versionEnLigne?: number;
  url?: string;
  /** Dernière mise à jour de l'état. */
  modifieLe: string;
  derniereErreur?: string;
}

export interface GroupeEnLigne {
  formatId: string;
  nom: string;
  videos: LigneEnLigne[];
}

const ETATS_LISTES = new Set<EtatSite["etat"]>(["en-ligne", "envoi-en-cours", "retrait-en-cours", "echec"]);

/** Ce qui est sur le site, par générateur (lecture seule). Une vidéo retirée ou jamais publiée n'y est pas. */
export async function listerEnLigne(): Promise<GroupeEnLigne[]> {
  await exigerSession();
  const d = depots();
  const groupes = new Map<string, GroupeEnLigne>();
  for (const kit of await d.kits.lister((k) => !!k.site && ETATS_LISTES.has(k.site.etat))) {
    const e = kit.site!;
    const video = await d.videos.obtenir(kit.videoId);
    if (!video) continue;
    const groupe = groupes.get(video.formatId) ?? { formatId: video.formatId, nom: nomCourtFormat({ id: video.formatId }), videos: [] };
    groupe.videos.push({ videoId: video.id, titre: video.titre, etat: e.etat, ...(e.versionEnLigne !== undefined ? { versionEnLigne: e.versionEnLigne } : {}), ...(e.url ? { url: e.url } : {}), modifieLe: e.modifieLe, ...(e.derniereErreur ? { derniereErreur: e.derniereErreur } : {}) });
    groupes.set(video.formatId, groupe);
  }
  for (const g of groupes.values()) g.videos.sort((a, b) => b.modifieLe.localeCompare(a.modifieLe));
  return [...groupes.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}
