/**
 * SERVICE DU DOCUMENT PROMIS (tâche P2-03, plan cas concret § 4-d) : lit le document d'une vidéo « Cas concret MD » et
 * enregistre la validation de Will (`entrees.casConcret.document = { valideLe }`). Ne rien envoyer : ce fichier
 * n'importe ni `publications`, ni `buffer`, ni aucun module d'envoi.
 */
import "server-only";
import { BUDGET_DEUX_PAGES, controlerTexteDocument } from "@/components/formats/cas-concret/document/texte";
import { codeDocument, documentDuCas, etatDocument, texteSource, type DocumentCasConcret, type EtatDocument } from "@/formats/cas-concret/document";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { casDesEntrees, ENTREE_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import type { Id, Video } from "@/domaine/types";
import { depots, ErreurStudio, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "./cas-concret-reglages";

const FORMAT_ID = "cas-concret";

export const PHRASE_DOCUMENT_FERME = "Le document promis n'est pas ouvert pour le moment.";

/** Réglage `casConcret.documentPromis` éteint (défaut) : ni lecture, ni validation, ni correction. */
async function exigerDocumentOuvert(): Promise<void> {
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.documentPromis))) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_DOCUMENT_FERME);
}

export interface VueDocument {
  videoId: Id;
  document: DocumentCasConcret;
  /** Code stable `structure-<code du cas>`. */
  code: string;
  /** `brouillon` jusqu'à la validation de Will, puis `valide`. */
  etat: EtatDocument;
  /** Date de validation par Will ; absente : à valider. */
  valideLe?: string;
  /** Le texte que Will relit : sa correction, sinon le premier jet du studio. */
  texte: string;
  /** Vrai quand Will a corrigé le premier jet (la page imprimable montre alors son texte). */
  corrige: boolean;
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function entreesDe(video: Pick<Video, "entrees">): Record<string, unknown> {
  return objet(objet(video.entrees)?.[ENTREE_CAS_CONCRET]) ?? {};
}

/**
 * La vidéo, ses entrées et son cas. P2C : le cas d'une vidéo de la porte B est celui gardé avec elle
 * (`entrees.casConcret.cas`, jamais au catalogue) ; sinon celui du catalogue. Introuvable : refus en clair.
 */
async function videoDuFormat(videoId: Id): Promise<{ video: Video; entrees: Record<string, unknown>; cas: CasConcret }> {
  const video = await depots().videos.obtenir(videoId);
  if (!video || video.formatId !== FORMAT_ID) throw new ErreurStudio("VIDEO_INCONNUE", "Cette vidéo n'existe pas.");
  const cas = casDesEntrees(lireEntreesCasConcret(video.entrees));
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Le cas de cette vidéo n'existe plus.");
  return { video, entrees: entreesDe(video), cas };
}

/** Le document de la vidéo, avec sa date de validation. */
export async function lireDocument(videoId: Id): Promise<VueDocument> {
  await exigerSession();
  await exigerDocumentOuvert();
  const { entrees, cas } = await videoDuFormat(videoId);
  const code = codeDocument(cas);
  // Une validation compte seulement pour le document qu'elle a validé : un autre code, ou aucun, redonne un brouillon.
  const pose = objet(entrees.document);
  const valideLe = pose?.code === code && typeof pose.valideLe === "string" ? pose.valideLe : undefined;
  const codeSuivi = typeof entrees.codeSuivi === "string" ? entrees.codeSuivi : undefined;
  const document = documentDuCas(cas, { codeSuivi });
  const corrige = pose?.code === code && typeof pose.texte === "string" && pose.texte.trim().length > 0;
  return { videoId, document, code, etat: etatDocument(valideLe), ...(valideLe ? { valideLe } : {}), texte: corrige ? (pose!.texte as string) : texteSource(document), corrige };
}

/** « Je valide ce document » : pose la date, une ligne au journal. Rien n'est envoyé. */
export async function validerDocument(videoId: Id, dependances: { maintenant?: number } = {}): Promise<{ valideLe: string }> {
  await exigerSession();
  await exigerDocumentOuvert();
  const { video, entrees, cas } = await videoDuFormat(videoId);
  const valideLe = new Date(dependances.maintenant ?? Date.now()).toISOString();
  const toutes = objet(video.entrees) ?? {};
  const pose = objet(entrees.document);
  const texte = pose?.code === codeDocument(cas) && typeof pose.texte === "string" ? { texte: pose.texte } : {};
  await depots().videos.modifier(videoId, { entrees: { ...toutes, [ENTREE_CAS_CONCRET]: { ...entrees, document: { code: codeDocument(cas), ...texte, valideLe } } } });
  await journaliser("cas-concret", `Document promis validé : ${cas.documentPromis.nom}`);
  return { valideLe };
}

/**
 * Enregistre la correction de Will. Le texte est contrôlé (chiffres, prix, mots interdits, noms, deux pages) ; une
 * correction annule la validation : le document redevient un brouillon. Texte identique au premier jet : plus de correction.
 */
export async function corrigerDocument(videoId: Id, texte: string): Promise<{ etat: EtatDocument }> {
  await exigerSession();
  await exigerDocumentOuvert();
  // Une action serveur reçoit ce que le client envoie : jamais une expression régulière sur autre chose qu'un texte de taille permise.
  if (typeof texte !== "string") throw new ErreurStudio("DOCUMENT_REFUSE", "Le texte du document est illisible : recommencez.");
  if (texte.length > 3 * BUDGET_DEUX_PAGES) throw new ErreurStudio("DOCUMENT_REFUSE", "Ce texte est beaucoup trop long : le document tient sur deux pages.");
  const { video, entrees, cas } = await videoDuFormat(videoId);
  const premierJet = texteSource(documentDuCas(cas, { codeSuivi: typeof entrees.codeSuivi === "string" ? entrees.codeSuivi : undefined }));
  const propre = texte.replace(/\r\n/g, "\n").trim();
  const problemes = controlerTexteDocument(propre, premierJet);
  if (problemes.length) throw new ErreurStudio("DOCUMENT_REFUSE", problemes[0]);
  const toutes = objet(video.entrees) ?? {};
  const document = propre === premierJet.trim() ? { code: codeDocument(cas) } : { code: codeDocument(cas), texte: propre };
  await depots().videos.modifier(videoId, { entrees: { ...toutes, [ENTREE_CAS_CONCRET]: { ...entrees, document } } });
  await journaliser("cas-concret", `Document promis corrigé : ${cas.documentPromis.nom}`);
  return { etat: "brouillon" };
}
