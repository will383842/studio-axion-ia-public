"use server";
/**
 * Z3-E · écran d'envoi « À publier » selon l'outil : données d'appui (outil effectif, état, « Aussi sur ») et envoi par l'outil
 * choisi POUR UN CONTENU. Rien n'est modifié dans `publications.ts` : on n'appelle que ses fonctions exportées.
 * Le nom de l'outil vient du catalogue (libelles.ts), jamais d'un bouton. Aucune clé, aucun identifiant réel ici.
 */
import { outilDe, outilPour, type OutilPublication } from "@/domaine/outil-publication";
import type { IdReseau, Publication } from "@/domaine/types";
import { fournisseurParId } from "@/fournisseurs";
import type { Resultat } from "./_commun";
import { depots, ErreurStudio, essayer } from "./_commun";
import { vueAPublier } from "./a-publier";
import { exigerSession } from "./auth";
import { canauxEnregistres, lireModeBuffer, marquerEnvoiVerifie } from "./buffer";
import { envoyerReel, envoyerVersBuffer, obtenirKit, videoEnEssai } from "./publications";
import { journaliserEnvoi } from "./journal-envoi";
import { lireRoutage } from "./routage-publication";
import { envoiZernioAutorise, publicationEditorialeAutorisee } from "./zernio";
import { traduireSelectionVersZernio } from "./zernio-cibles";

export type EtatComplement = "aucun" | "brouillon" | "programmee" | "publiee" | "echec";

/** Ce que l'écran d'envoi sait d'une ligne (vidéo + réseau), en plus de `LigneAPublier`. */
export interface ComplementLigne {
  outil: OutilPublication;
  etat: EtatComplement;
  /** Date prévue de l'envoi (programmée ou brouillon). */
  dateEnvoi?: string;
  /** Création de la publication (âge du brouillon). */
  creeLe?: string;
  /** Moment de l'échec, et sa cause en une phrase. */
  echecLe?: string;
  cause?: string;
  lien?: string;
  /** Identifiant de la publication dont l'envoi est « à vérifier » : l'écran propose alors « Marquer comme vérifié ». */
  aVerifierId?: string;
  /** Le réseau est en mode brouillon (essais) : il reçoit d'abord un brouillon. */
  essai: boolean;
  /** Buffer reste un choix possible pour ce contenu (masqué quand le réseau est configuré sans Buffer). */
  bufferDisponible: boolean;
  /** Les mêmes contenus sur les autres réseaux. */
  aussiSur: { reseau: IdReseau; nom: string }[];
}

function etatDe(p: Publication | undefined): EtatComplement {
  if (!p || p.via === "simulation") return "aucun";
  if (p.etatEnvoi === "refuse" || p.etatEnvoi === "absent" || p.statut === "echec") return "echec";
  if (p.statut === "publiee") return "publiee";
  if (p.statut === "programmee") return "programmee";
  return "brouillon";
}

function bufferRelie(): boolean {
  try {
    return fournisseurParId("publication", "buffer").mode !== "simulation";
  } catch {
    return false;
  }
}

/** Les compléments de toutes les lignes de la page, par clé de ligne. Aucun appel à un outil externe. */
export async function complementsAPublier(): Promise<Record<string, ComplementLigne>> {
  await exigerSession();
  const vue = await vueAPublier();
  const routage = await lireRoutage();
  const modeBuffer = await lireModeBuffer();
  const relie = bufferRelie();
  const sortie: Record<string, ComplementLigne> = {};
  for (const l of vue.lignes) {
    const pubs = (await depots().publications.lister((p) => p.videoId === l.videoId && p.reseau === l.reseau)).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
    const derniere = pubs[0];
    const outil = (derniere && outilDe(derniere)) || outilPour(routage, l.reseau);
    const etat = etatDe(derniere);
    sortie[l.cle] = {
      outil,
      etat,
      ...(derniere && etat !== "aucun" ? { dateEnvoi: derniere.date, creeLe: derniere.creeLe } : {}),
      ...(etat === "echec" && derniere ? { echecLe: derniere.modifieLe, ...(derniere.erreur ? { cause: derniere.erreur } : {}) } : {}),
      ...(derniere?.etatEnvoi === "a-verifier" ? { aVerifierId: derniere.id } : {}),
      ...(etat === "publiee" && derniere?.urlPubliee ? { lien: derniere.urlPubliee } : {}),
      essai: outil === "zernio" || modeBuffer === "brouillon",
      bufferDisponible: relie && outilPour(routage, l.reseau) === "buffer",
      aussiSur: vue.lignes.filter((x) => x.videoId === l.videoId && x.reseau !== l.reseau).map((x) => ({ reseau: x.reseau, nom: x.reseauNom })),
    };
  }
  return sortie;
}

export interface OptionsEnvoiParOutil {
  outil: OutilPublication;
  comptes?: string[];
  premierCommentaire?: string;
  /** TikTok : la case cochée à CET envoi, jamais mémorisée. */
  accordTiktok?: boolean;
  contenuIA?: boolean;
}

/**
 * Envoi d'un réseau par l'outil choisi POUR CE CONTENU. Buffer : le chemin habituel. Zernio : mêmes gardes (session, vidéo
 * prête, ni exemple ni essai) puis `envoyerReel("zernio", …)` ; le serveur refuse TikTok sans accord et une date passée.
 */
export async function envoyerParOutilAction(videoId: string, reseau: IdReseau, dateIso: string, options: OptionsEnvoiParOutil): Promise<Resultat<{ nombre: number; problemes: string[] }>> {
  await exigerSession();
  const nbChoisis = options.comptes?.length ?? 0;
  const journal = { action: "envoyerParOutilAction", outil: options.outil, reseau, contenuId: videoId };
  const r = await essayer(async () => {
    if (options.outil === "buffer") {
      const r = await envoyerVersBuffer(videoId, [reseau], dateIso, { comptes: options.comptes ? { [reseau]: options.comptes } : {}, premiersCommentaires: { [reseau]: options.premierCommentaire ?? "" }, avecPremierCommentaire: true });
      return { nombre: r.publications.length, problemes: (r.problemes ?? []).map((p) => p.message) };
    }
    // « Tout arrêter » (ancien réglage fermé) garde son chemin et son message d'avant (refus du fournisseur, ligne « refusé ») ;
    // le nouveau refus ne vise que « ancien ouvert, calendrier pas encore ouvert ».
    if ((await envoiZernioAutorise()) && !(await publicationEditorialeAutorisee())) throw new ErreurStudio("ENVOI_CALENDRIER_FERME", "L'envoi du calendrier est fermé (réglage à ouvrir, publication éditoriale comprise) : rien n'est parti.");
    const kit = await obtenirKit(videoId);
    if (!kit) throw new ErreurStudio("PAS_PRETE", "La vidéo n'est pas prête.");
    if (!kit.publiable) throw new ErreurStudio("AVANT_DE_PUBLIER", "Cochez d'abord « J'ai regardé la vidéo, tout est en règle ».");
    const video = await depots().videos.obtenir(videoId);
    if (video?.estDemo) throw new ErreurStudio("VIDEO_EXEMPLE", "C'est une vidéo d'exemple : elle ne part pas sur vos réseaux.");
    if (video && (await videoEnEssai(video))) throw new ErreurStudio("VIDEO_ESSAI", "C'est une vidéo d'essai : elle ne part pas sur vos réseaux.");
    let service;
    try {
      service = fournisseurParId("publication", "zernio");
    } catch {
      throw new ErreurStudio("OUTIL_NON_RELIE", "L'outil de publication n'est pas relié : l'envoi est refusé.");
    }
    // Les comptes que l'écran envoie sont ceux de Buffer : on les traduit en comptes Zernio (par le nom), sans jamais les passer tels quels.
    const traduits = options.comptes ? await traduireSelectionVersZernio(service, reseau, options.comptes, (await canauxEnregistres())?.canaux ?? []) : undefined;
    const r = await envoyerReel("zernio", service, kit, [reseau], dateIso, traduits ? { [reseau]: traduits } : {}, { [reseau]: options.premierCommentaire ?? "" }, true, {
      ...(reseau === "tiktok" ? { consentementTiktok: options.accordTiktok === true } : {}),
      ...(options.contenuIA !== undefined ? { contenuIA: options.contenuIA } : {}),
    });
    return { nombre: r.publications.length, problemes: (r.problemes ?? []).map((p) => p.message) };
  });
  // Trace sans texte ni compte (voir journal-envoi.ts) : le code du refus, ou « OK » si quelque chose est parti.
  journaliserEnvoi(r.ok ? { ...journal, code: r.donnees.nombre > 0 ? "OK" : "AUCUN_ENVOI", nbComptes: r.donnees.nombre, ...(options.outil === "zernio" ? { brouillon: true } : {}) } : { ...journal, code: r.code ?? "ERREUR", nbComptes: nbChoisis });
  return r;
}

/** « Marquer comme vérifié » : l'opérateur a regardé dans l'outil. N'écrit que dans le studio (voir `marquerEnvoiVerifie`). */
export async function marquerEnvoiVerifieAction(publicationId: string): Promise<Resultat<{ ok: true }>> {
  await exigerSession();
  return essayer(async () => {
    await marquerEnvoiVerifie(publicationId);
    return { ok: true as const };
  });
}
