/**
 * L3-09 : contrôleur du texte d'un post et de son commentaire. PUR : importable côté client, aucun appel réel.
 *
 * Il COMPOSE l'existant : la longueur maximale d'un post vient du registre des réseaux (`legende.longueurMax`), celle
 * d'un commentaire de la table d'écriture (`verifierLimitesTexte`, L3-03), les mots interdits de la liste unique
 * (`interditsDuPost`, portée « post », L3-04). S'y ajoute un seul contrôle propre : un commentaire porte un seul appel.
 *
 * Niveaux : « bloquant » est limité au FORMAT TECHNIQUE (une longueur que le réseau refuse). Un défaut de style
 * (appels multiples) ou un mot interdit avertit seulement quand l'auteur est une personne (toute valeur du type `Auteur` autre que « machine ») : un
 * ajout manuel n'est jamais bloqué. Pour un texte écrit par la machine, les trois défauts sont bloquants.
 * Le contrôleur ne cite aucun montant et ne porte aucune consigne d'un outil d'envoi.
 * Tout changement de texte d'une publication programmée repasse par `controlerTextePost` (CAL-23).
 */
import { obtenirReseau } from "@/reseaux";
import { verifierLimitesTexte } from "@/reseaux/ecriture";
import { interditsDuPost, type ZonePost } from "@/domaine/qualite-script/regles/interdits";
import type { Auteur, NiveauControle } from "./types";
import { normaliser, phrasesDe } from "./texte";

export type ReseauTextePost = Parameters<typeof verifierLimitesTexte>[0];
/** Qui a écrit le texte : le type `Auteur` existant (la machine, ou une personne pour un ajout manuel). */
export type AuteurTextePost = Auteur;
export type CodeTextePost = "texte-trop-long" | "commentaire-trop-long" | "appels-multiples" | "interdit";

export interface EntreeTextePost {
  reseau: ReseauTextePost;
  /** Le texte du post. */
  texte: string;
  /** La légende, si le réseau en porte une à part. */
  legende?: string | null;
  /** Le premier commentaire. */
  commentaire?: string | null;
  /** Défaut : « machine » (règles dures). Toute autre valeur du type `Auteur` : un ajout manuel, bloqué sur le format technique seulement. */
  auteur?: AuteurTextePost;
}

export interface ViolationTextePost {
  code: CodeTextePost;
  zone: ZonePost;
  niveau: NiveauControle;
  message: string;
}

export interface ResultatTextePost {
  passe: boolean;
  violations: ViolationTextePost[];
}

const MOTIF_IMPERATIF = /^(commentez|ecrivez|envoyez|dites|repondez|partagez|abonnez|cliquez|reservez|contactez|telechargez|rejoignez|inscrivez|gardez|enregistrez|sauvegardez|suivez|taguez|mentionnez|ecris|envoie|commente|reserve|contacte)(?=$|[^a-z])/;

/** Nombre d'appels d'un texte : une phrase qui pose une question ou qui commence par un verbe d'invitation. PUR. */
export function compterAppels(texte: string): number {
  return phrasesDe(texte).filter((p) => p.trim().endsWith("?") || MOTIF_IMPERATIF.test(normaliser(p).replace(/^[^a-z]+/, ""))).length;
}

export function controlerTextePost(e: EntreeTextePost): ResultatTextePost {
  const manuel = e.auteur !== undefined && e.auteur !== "machine";
  const violations: ViolationTextePost[] = [];
  const niveauStyle: NiveauControle = manuel ? "alerte" : "bloquant";

  const max = obtenirReseau(e.reseau).legende.longueurMax;
  if (e.texte.length > max) {
    violations.push({ code: "texte-trop-long", zone: "texte", niveau: "bloquant", message: `Texte trop long (${e.texte.length}/${max} signes).` });
  }
  if (e.commentaire) {
    for (const err of verifierLimitesTexte(e.reseau, { commentaire: e.commentaire }).filter((x) => x.code === "commentaire-trop-long")) {
      violations.push({ code: "commentaire-trop-long", zone: "premier-commentaire", niveau: "bloquant", message: err.message });
    }
    const n = compterAppels(e.commentaire);
    if (n > 1) violations.push({ code: "appels-multiples", zone: "premier-commentaire", niveau: niveauStyle, message: `${n} appels dans le commentaire : un seul est permis.` });
  }
  for (const i of interditsDuPost({ texte: e.texte, legende: e.legende, premierCommentaire: e.commentaire })) {
    violations.push({ code: "interdit", zone: i.zone, niveau: niveauStyle, message: `Expression interdite : « ${i.libelle} ».` });
  }
  return { passe: !violations.some((v) => v.niveau === "bloquant"), violations };
}
