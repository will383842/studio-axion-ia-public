/**
 * CHAMPS DE PUBLICATION À PRODUIRE PAR RÉSEAU (plan v5 B.5.2, B.5.3 / C36 ; lot G4). PUR, DONNÉES.
 * Le rôle « déclinaison » ne nomme aucun réseau : il reçoit cette liste pour le réseau qu'il décline.
 */
import type { IdReseau, ReseauDeclinaison } from "@/domaine/types";
import { estReseauDeclinaison } from "@/reseaux/codes";

export interface ChampsPublication {
  /** Consignes propres aux champs de ce réseau (une par ligne, avec leur règle datée). */
  consignes: string[];
  /** Post rédigé avec la vidéo (B.5.2). */
  post: boolean;
  titres: boolean;
  motsClesTiktok: boolean;
  commentaireEpingle: boolean;
}

export const CHAMPS_PUBLICATION: Readonly<Record<ReseauDeclinaison, ChampsPublication>> = {
  tiktok: {
    consignes: ["Commentaire épinglé = la source des faits (une question seulement si l'appel est une question d'expert) [hyp-ecriture-reseau].", "Mots-clés à déclarer et à bloquer, 3 à 5 chacun [tt-mots-cles-2026]."],
    post: false,
    titres: false,
    motsClesTiktok: true,
    commentaireEpingle: true,
  },
  instagram: { consignes: ["Mot-clé exact dans les 125 premiers caractères [hyp-ecriture-reseau]."], post: false, titres: false, motsClesTiktok: false, commentaireEpingle: false },
  facebook: { consignes: ["Première ligne : une question d'expert sur une pratique ou une quantité, jamais sur une personne, différente de celle d'Instagram [hyp-ecriture-reseau]."], post: false, titres: false, motsClesTiktok: false, commentaireEpingle: false },
  linkedin: {
    consignes: [
      "Post rédigé avec la vidéo : forme « texte » ; 1re ou 2e ligne = le détail vrai du sujet tiré de l'ancrage ; aucun tic d'écriture générée [li-ai-slop-2026].",
      "La fin du post reprend l'appel de la vidéo, sans second appel ; aucun lien sauf objectif « Rendez-vous » [li-lien-commentaire].",
      "`typePublication` : « video-native » [li-video-2026].",
    ],
    post: true,
    titres: false,
    motsClesTiktok: false,
    commentaireEpingle: false,
  },
  "youtube-shorts": { consignes: ["Deux titres de 100 caractères au plus avec le mot-clé exact, l'un en question, l'autre en affirmation ; sources dans la description [ys-titre-indexe]."], post: false, titres: true, motsClesTiktok: false, commentaireEpingle: false },
};

/**
 * Lot R2 (plan « outils réels » du 03/10) : ce que le TEXTE DE PUBLICATION d'un réseau demande en plus au rôle
 * « publication » (kit d'une vidéo, tous les réseaux du registre). `particularites` : identifiants des règles datées
 * de `reseaux/ecriture.ts` reprises pour ce texte ; `consignes` : consignes propres, sans règle datée ; `titres` :
 * SEULEMENT pour un réseau hors déclinaison (les autres le lisent dans `CHAMPS_PUBLICATION`).
 */
export interface TextePublicationReseau {
  titres?: boolean;
  particularites: string[];
  consignes: string[];
}

export const TEXTE_PUBLICATION: Readonly<Record<IdReseau, TextePublicationReseau>> = {
  linkedin: { particularites: ["li-ai-slop-2026", "li-lien-commentaire", "li-engagement-2026"], consignes: [] },
  instagram: { particularites: [], consignes: [] },
  facebook: { particularites: ["hyp-ecriture-reseau"], consignes: [] },
  tiktok: { particularites: [], consignes: [] },
  // YouTube (long) n'est pas un réseau de déclinaison : son champ titre est dit ici.
  youtube: { titres: true, particularites: [], consignes: ["Description : la première phrase dit ce que la vidéo répond ; titre de 100 caractères au plus, avec le sujet exact."] },
  "youtube-shorts": { particularites: [], consignes: [] },
};

/** Le texte de ce réseau a-t-il un champ titre ? (`CHAMPS_PUBLICATION`, sinon l'exception du réseau hors déclinaison.) */
export function titresDemandes(reseau: IdReseau): boolean {
  return estReseauDeclinaison(reseau) ? CHAMPS_PUBLICATION[reseau].titres : !!TEXTE_PUBLICATION[reseau].titres;
}
