/**
 * Aperçu d'une publication façon réseau (RC-36) : tout ce que le panneau latéral du calendrier montre, calculé ici sans
 * écran, sans réseau, sans horloge (le jour d'aujourd'hui est fourni par l'appelant, en jour de Paris).
 * Aucune écriture : déplacer une entrée dans la liste rend une nouvelle liste.
 */
import type { TableLibelles } from "./PastilleStatutPlan";
import { etatDepuisStatut } from "./PastilleStatutPlan";
import { TYPES_CONTENU, heureLisible, jourLisible, nomReseau, reseauConnu, trierEntrees, type TypeContenu } from "./CarteEntreeCalendrier";
import { PHRASES_VERROU, lireCleFiche, phraseEtat, sansPremierCommentaire, verrouFiche, type EntreeFiche, type RaisonVerrou } from "./FicheEntree";
import { cleJour, heure as heureDeParis } from "@/lib/dates";
import { RESEAUX } from "@/reseaux";

export type GenreVisuel = "video" | "image";

export interface VisuelApercu {
  genre: GenreVisuel;
  /** Adresse du fichier ; absente ou vide : « Visuel à venir ». */
  url?: string | null;
  /** Image d'attente d'une vidéo. */
  poster?: string | null;
  /** « 9:16 », « 4:5 »… ; absent : le format préféré du réseau. */
  ratio?: string;
  /** Visuel (carrousel, infographie) : une adresse signée par page, dans l'ordre. */
  pages?: readonly string[];
}

/** Une entrée telle que le panneau la montre : la fiche (texte, premier commentaire), plus le visuel et la campagne. */
export interface EntreeApercu extends EntreeFiche {
  media?: VisuelApercu;
  /** Campagne d'origine ; absente ou vide : aucune ligne. */
  campagne?: string;
  /** Lien vers la vidéo d'origine (ouvre sa page ; ne publie rien). */
  lienSource?: string;
  /** Nom du compte visé (deux LinkedIn, deux Facebook) ; absent : aucune ligne. */
  canalNom?: string;
}

/** Un essai (rien n'est envoyé) n'est jamais montré comme programmé : il a son propre état et son propre mot. */
export const LIBELLES_ESSAI: TableLibelles = { essai: { libelle: "Essai", ton: "ambre" } };

/** Mots de l'envoi par Buffer (« Envoi en cours », « À vérifier », « Brouillon dans Buffer »), plus l'essai : un seul tableau pour la grille et l'Agenda. */
export const LIBELLES_ENVOI: TableLibelles = {
  ...LIBELLES_ESSAI,
  en_cours: { libelle: "Envoi en cours", ton: "neutre" },
  a_verifier: { libelle: "À vérifier", ton: "ambre" },
  brouillon_buffer: { libelle: "Brouillon dans Buffer", ton: "neutre" },
};

/** Où se place le texte par rapport au visuel, sur chaque réseau. */
export type Disposition = "texte-dessus" | "media-dessus" | "legende-sur-media";

const DISPOSITIONS: Readonly<Record<string, Disposition>> = {
  linkedin: "texte-dessus",
  facebook: "texte-dessus",
  instagram: "media-dessus",
  tiktok: "legende-sur-media",
};

export interface ApercuReseau {
  nomReseau: string;
  disposition: Disposition;
  /** « Vidéo · 9:16 ». */
  formatLibelle: string;
  texte: string;
  hashtags: string[];
  /** Le premier commentaire, ou null (aucun, ou réseau sans premier commentaire). */
  premierCommentaire: string | null;
  phrasePremierCommentaire: string;
  media: { genre: GenreVisuel | "absent"; url: string | null; poster: string | null; ratio: string };
  /** « jeudi 3 décembre 2026 à 09:00, heure de Paris ». */
  dateDite: string;
  heure: string | null;
  campagne: string | null;
  phraseEtat: string;
  verrou: RaisonVerrou | null;
  /** Faux : la date ne se change pas d'ici (publication reçue de sa vidéo) ; le champ est éteint d'emblée. */
  deplacable: boolean;
  phraseVerrou: string | null;
}

/** Phrase montrée d'emblée quand la date ne se change pas depuis l'aperçu. */
export const PHRASE_DEPUIS_LA_VIDEO = "Cette publication se déplace depuis sa vidéo : ouvrez-la pour changer sa date.";

const MOT_DIESE = /(?<![\p{L}\p{N}_&#])#([\p{L}\p{N}_]{2,40})/gu;

/** Les mots-dièse d'un texte, sans doublon (casse ignorée), dans l'ordre d'écriture. */
export function extraireHashtags(texte: string): string[] {
  if (typeof texte !== "string") return [];
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const m of texte.matchAll(MOT_DIESE)) {
    const cle = m[1].toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(`#${m[1]}`);
  }
  return sortie;
}

const JOUR_DIT = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function ratioDuReseau(reseau: string): string {
  return RESEAUX.find((r) => r.id === reseau)?.ratioPrefere ?? "";
}

/** Tout ce qu'il faut pour dessiner l'aperçu d'une entrée. `aujourdhui` : jour de Paris, AAAA-MM-JJ. */
export function apercuReseau(entree: EntreeApercu, aujourdhui: string): ApercuReseau {
  const heure = heureLisible(entree.heure);
  const jourOk = jourLisible(entree.jour);
  const jourDit = jourOk ? JOUR_DIT.format(new Date(`${entree.jour}T12:00:00Z`)) : "";
  const dateDite = !jourOk ? "Date illisible" : heure ? `${jourDit} à ${heure}, heure de Paris` : jourDit;
  const verrou = verrouFiche(entree, aujourdhui);
  const deplacable = lireCleFiche(entree.cle)?.origine === "creneau";
  const texte = typeof entree.texte === "string" ? entree.texte : "";
  const commentaire = typeof entree.premierCommentaire === "string" ? entree.premierCommentaire.trim() : "";
  const sans = sansPremierCommentaire(entree.reseau);
  const premierCommentaire = sans || !commentaire ? null : commentaire;
  const url = entree.media?.url ? entree.media.url : null;
  const type = TYPES_CONTENU[entree.type as TypeContenu];
  const ratio = entree.media?.ratio || ratioDuReseau(entree.reseau);
  return {
    nomReseau: reseauConnu(entree.reseau) ? nomReseau(entree.reseau) : "Réseau",
    disposition: DISPOSITIONS[entree.reseau] ?? "texte-dessus",
    formatLibelle: [type?.libelle ?? "Publication", ratio].filter(Boolean).join(" · "),
    texte,
    hashtags: extraireHashtags(texte),
    premierCommentaire,
    phrasePremierCommentaire: sans ? "Pas de premier commentaire sur TikTok." : premierCommentaire ? "" : "Aucun premier commentaire prévu.",
    media: { genre: entree.media && url ? entree.media.genre : "absent", url, poster: entree.media?.poster ?? null, ratio },
    dateDite,
    heure,
    campagne: entree.campagne?.trim() ? entree.campagne.trim() : null,
    phraseEtat: entree.etat === "essai" ? "Essai : rien n'est parti vers le réseau." : phraseEtat(entree),
    verrou,
    deplacable,
    phraseVerrou: verrou ? PHRASES_VERROU[verrou] : deplacable ? null : PHRASE_DEPUIS_LA_VIDEO,
  };
}

/** L'entrée d'à côté dans l'ordre de la grille (jour, heure) : `sens` 1 = suivante, -1 = précédente, avec retour au bout. */
export function entreeVoisine<T extends EntreeApercu>(entrees: readonly T[], cle: string, sens: 1 | -1): T | null {
  if (typeof cle !== "string") return null;
  const ordre = trierEntrees(entrees);
  const i = ordre.findIndex((e) => e.cle === cle);
  if (i < 0) return null;
  return ordre[(i + sens + ordre.length) % ordre.length];
}

/** Même liste, avec le jour d'une entrée changé. Clé inconnue, jour illisible ou inchangé : la liste reçue, telle quelle. */
export function deplacerEntree<T extends EntreeApercu>(entrees: readonly T[], cle: string, jour: string): readonly T[] {
  if (!jourLisible(jour)) return entrees;
  const i = entrees.findIndex((e) => e.cle === cle);
  if (i < 0 || entrees[i].jour === jour) return entrees;
  return entrees.map((e, k) => (k === i ? { ...e, jour } : e));
}

/** Ce qu'il faut savoir d'une publication du calendrier (forme des données de la page, sans importer le service). */
export interface PublicationApercu {
  id: string;
  reseau: string;
  statut: string;
  via?: string;
  date: string;
  texte: string;
  videoId?: string;
  visuelId?: string;
  video?: { titre: string; vignette: string | null; video: string | null } | null;
  /** Nom du compte visé (lot R1b). */
  canalNom?: string;
  /** État de l'envoi par Buffer (« refuse », « absent », « a-verifier », « en-cours »…), s'il y en a un. */
  etatEnvoi?: string;
}

/** Une publication du calendrier → l'entrée de l'aperçu. Jour et heure sont ceux de Paris. */
export function entreeDepuisPublication(p: PublicationApercu): EntreeApercu {
  const estVideo = Boolean(p.videoId);
  return {
    cle: `publication:${p.id}|${p.reseau}`,
    jour: cleJour(p.date),
    reseau: p.reseau as EntreeApercu["reseau"],
    type: estVideo ? "video" : "image",
    etat: etatAffiche(p),
    envoiAbsent: p.via !== "simulation" && p.etatEnvoi === "absent" ? true : undefined,
    heure: heureDeParis(p.date),
    titre: p.video?.titre,
    texte: p.texte,
    media: estVideo ? { genre: "video", url: p.video?.video ?? null, poster: p.video?.vignette ?? null } : { genre: "image", url: p.video?.vignette ?? null },
    lienSource: estVideo ? `/videos/${p.videoId}` : undefined,
    canalNom: p.canalNom || undefined,
  };
}

/**
 * L'état affiché d'une publication, le même sur téléphone, en semaine et en mois : l'envoi par Buffer d'abord (refusé, absent ou
 * échec = « à corriger » ; à vérifier ; en cours ; brouillon dans Buffer), puis le statut. Un essai garde son état « essai ».
 */
export function etatAffiche(p: Pick<PublicationApercu, "statut" | "via" | "etatEnvoi">): string {
  if (p.via === "simulation") return "essai";
  const base = etatDepuisStatut(p.statut) ?? "inconnu";
  if (p.etatEnvoi === "refuse" || p.etatEnvoi === "absent" || p.statut === "echec") return "a_corriger";
  if (p.etatEnvoi === "a-verifier") return "a_verifier";
  if (p.etatEnvoi === "en-cours") return "en_cours";
  if (p.via === "buffer" && p.statut === "brouillon") return "brouillon_buffer";
  return base;
}
