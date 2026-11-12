/**
 * CAL-08 · Liste de contrôle « Prêt à partir ? », PAR RÉSEAU. Fonction PURE : aucun appel réseau, aucun fichier lu.
 * La même liste vaut pour un contenu venu du Studio et pour un contenu apporté à la main. Une ligne est une INFORMATION :
 * `bloquant` vaut toujours false, rien n'empêche l'ajout ni (sauf fichier absent ou refusé par le réseau) la validation.
 * Les mots actifs sont fournis par l'appelant (lecture de src/services/mots-lecture.ts) ; sans eux : « à vérifier à la main ».
 */
import { verifierFormat, type MediaDecrit } from "@/domaine/calendrier/formats-media";
import type { IdReseau } from "@/domaine/types";

export type CodeControle = "texte" | "hashtags" | "premier-commentaire" | "mot" | "fichier" | "date";

export interface LigneControle {
  code: CodeControle;
  reseau: IdReseau;
  /** Français simple, vouvoiement. */
  message: string;
  /** Texte que le bouton « Copier » met dans le presse-papiers, quand la ligne le propose. */
  copier?: string;
  bloquant: false;
}

export interface PublicationAControler {
  reseau: IdReseau;
  texte?: string;
  hashtags?: readonly string[];
  premierCommentaire?: string;
  /** Mot à commenter, tel qu'au registre des mots (majuscules). */
  motAssocie?: string;
  /** Vrai si la publication doit porter un mot du parcours. */
  motRequis?: boolean;
  media?: MediaDecrit | null;
  /** Instant de publication (ISO) ; absent : la date manque. */
  instant?: string | null;
  typeContenu?: "video" | "carrousel" | "infographie" | "image";
}

export interface MotActifLu {
  mot: string;
  reponse: "auto" | "manuel";
}
export interface OptionsControle {
  /** Mots actifs du réseau ; absent ou null : la lecture n'est pas encore fournie. */
  mots?: readonly MotActifLu[] | null;
}

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "YouTube Shorts" };
const DE_TYPE = { video: "la vidéo", carrousel: "le carrousel", infographie: "l'infographie", image: "l'image" } as const;
/** Règle de départ des hashtags (HSH-01, à confirmer) : au moins un sur ces réseaux. */
const HASHTAGS_ATTENDUS = new Set<string>(["linkedin", "instagram", "facebook", "tiktok"]);
const REPONSE_A_LA_MAIN = new Set<string>(["linkedin", "tiktok"]);
const vide = (v: unknown): boolean => typeof v !== "string" || v.trim() === "";

export function controlerPretAPartir(p: PublicationAControler, options: OptionsControle = {}): LigneControle[] {
  const reseau = p.reseau;
  const nom = NOMS[reseau] ?? String(reseau);
  const out: LigneControle[] = [];
  const ligne = (code: CodeControle, message: string, copier?: string) => out.push({ code, reseau, message, ...(copier ? { copier } : {}), bloquant: false });

  if (vide(p.texte)) ligne("texte", `Il manque le texte : décrivez ${DE_TYPE[p.typeContenu ?? "video"]} en une phrase, puis Proposer`);
  if (HASHTAGS_ATTENDUS.has(reseau) && !(p.hashtags ?? []).some((h) => h.trim() !== "")) ligne("hashtags", `Il manque les hashtags pour ${nom}.`);
  if (reseau !== "tiktok") {
    if (vide(p.premierCommentaire)) ligne("premier-commentaire", `Il manque le premier commentaire pour ${nom}.`);
    else if (reseau === "instagram") ligne("premier-commentaire", "Le premier commentaire est à poser à la main sur Instagram.", p.premierCommentaire);
  }
  if (p.motRequis) {
    const mot = (p.motAssocie ?? "").trim();
    if (!mot) ligne("mot", "Il manque le mot à commenter.");
    else if (!options.mots) ligne("mot", "mot : à vérifier à la main");
    else {
      const actif = options.mots.find((m) => m.mot === mot);
      if (!actif) ligne("mot", "mot inactif sur ce réseau");
      else if (actif.reponse === "manuel" || REPONSE_A_LA_MAIN.has(reseau)) ligne("mot", `Sur ${nom}, la réponse au mot se fait à la main.`);
    }
  }
  if (!p.media) ligne("fichier", "Il manque le fichier (vidéo, image ou PDF).");
  else {
    const f = verifierFormat(reseau, p.media);
    if (!f.ok) ligne("fichier", f.raison);
  }
  if (vide(p.instant)) ligne("date", "Il manque la date et l'heure de publication.");
  return out;
}

/** Le premier manque, en une phrase (infobulle de la carte) ; null si rien ne manque. */
export function premierManque(p: PublicationAControler, options?: OptionsControle): string | null {
  return controlerPretAPartir(p, options)[0]?.message ?? null;
}

/** Filtre « À compléter » : garde les cartes qui ont une alerte. Ne modifie pas la liste reçue. */
export function filtrerACompleter<T extends { cle: string }>(entrees: readonly T[], alertes: ReadonlyMap<string, string>): T[] {
  return entrees.filter((e) => alertes.has(e.cle));
}
