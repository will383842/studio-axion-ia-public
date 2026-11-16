/**
 * YouTube Shorts par Zernio (lot B) : constantes, types et fonctions PURES (aucune lecture, aucune horloge).
 *
 * Les valeurs sensibles (visibilité, catégorie, mention « contenu synthétique », « conçu pour les enfants », source du
 * titre) sont des PROPOSITIONS en attente d'accord du fondateur : `PROPOSITION_YOUTUBE` ne sert qu'à l'affichage.
 * L'envoi lit UNIQUEMENT les réglages enregistrés (`zernio.youtube_reglages`), jamais la proposition.
 */

export const CLE_YOUTUBE_ACTIF = "zernio.youtube_actif";
export const CLE_REGLAGES_YOUTUBE = "zernio.youtube_reglages";

/** Titre : 100 signes au plus (schéma Zernio YouTubePlatformData). */
export const TITRE_YOUTUBE_MAX = 100;
/** Description (= `content`) : 5 000 octets au plus (API YouTube). */
export const DESCRIPTION_YOUTUBE_OCTETS_MAX = 5000;
/** Un Short dure 3 minutes au plus. */
export const SHORT_DUREE_MAX_SEC = 180;
/** Un Short est une vidéo verticale. */
export const SHORT_FORMATS: readonly string[] = ["9:16"];

export type VisibiliteYoutube = "public" | "unlisted" | "private";
export type SourceTitreYoutube = "studio" | "premiere-ligne";
export type SynthetiqueYoutube = "oui" | "non" | "selon-la-video";

export interface ReglagesYoutube {
  visibilite: VisibiliteYoutube;
  categorieId: string;
  synthetique: SynthetiqueYoutube;
  pourEnfants: boolean;
  titre: SourceTitreYoutube;
}

/** Propositions en attente d'accord du fondateur : jamais lues par l'envoi. */
export const PROPOSITION_YOUTUBE: Readonly<ReglagesYoutube> = Object.freeze({
  visibilite: "public",
  categorieId: "27",
  synthetique: "oui",
  pourEnfants: false,
  titre: "studio",
});

const VISIBILITES: readonly string[] = ["public", "unlisted", "private"];
const SOURCES_TITRE: readonly string[] = ["studio", "premiere-ligne"];
const SYNTHETIQUES: readonly string[] = ["oui", "non", "selon-la-video"];

/** Réglages enregistrés : les 5 champs EXACTS, sinon `null`. Clés en trop ignorées ; jamais de complément par la proposition. */
export function lireReglagesYoutube(brut: unknown): ReglagesYoutube | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const { visibilite, categorieId, synthetique, pourEnfants, titre } = o;
  if (typeof visibilite !== "string" || !VISIBILITES.includes(visibilite)) return null;
  if (typeof categorieId !== "string" || !/^\d{1,3}$/.test(categorieId)) return null;
  if (typeof synthetique !== "string" || !SYNTHETIQUES.includes(synthetique)) return null;
  if (typeof pourEnfants !== "boolean") return null;
  if (typeof titre !== "string" || !SOURCES_TITRE.includes(titre)) return null;
  return { visibilite: visibilite as VisibiliteYoutube, categorieId, synthetique: synthetique as SynthetiqueYoutube, pourEnfants, titre: titre as SourceTitreYoutube };
}

/** Titre du kit, sinon première ligne non vide du texte ; espaces ramenés à un ; au-delà de 100 signes : 99 + « … » ; rien : « ». */
export function titreYoutubeDepuisStudio(titre: string | undefined, texte: string): string {
  const net = (s: string) => s.replace(/\s+/g, " ").trim();
  const duKit = net(titre ?? "");
  const premiere = texte.split(/\r?\n/).map(net).find((l) => l.length > 0) ?? "";
  const t = duKit || premiere;
  return t.length > TITRE_YOUTUBE_MAX ? `${t.slice(0, TITRE_YOUTUBE_MAX - 1)}…` : t;
}

/** Seul le booléen `true` allume. */
export function youtubeActifBrut(brut: unknown): boolean {
  return brut === true;
}
