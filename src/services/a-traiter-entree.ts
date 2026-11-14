/**
 * À TRAITER · ENTRÉE AUTOMATIQUE des commentaires LinkedIn (page) et TikTok (ATR-01). LECTURE SEULE.
 * Une seule fonction à brancher : `recevoirCommentaire`, appelée plus tard par le webhook (session parcours viral).
 * Ce module n'importe rien d'un réseau ni de zernio* / mots-* : la file durable (L7-26) et le registre d'opposition (RC-40)
 * arrivent par des interfaces injectées minimales (`PortsEntree`). Aucune écriture vers un réseau, aucune réponse publiée.
 * Aucune donnée de personne dans la carte : jamais d'identifiant ni de pseudo, seulement un extrait court échappé.
 */
import { estMotOpposition } from "@/domaine/guide-reseau/opposition";

export const RESEAUX_ENTREE = ["linkedin", "tiktok"] as const;
export type ReseauEntree = (typeof RESEAUX_ENTREE)[number];
const EXTRAIT_MAX = 140;

export interface CommentaireRecu {
  /** Identifiant unique de l'événement (sert au rejeu). */
  idEvenement: string;
  reseau: ReseauEntree;
  post: string;
  /** Lien direct vers le commentaire (https seulement, sinon omis). */
  lienCommentaire?: string | null;
  texte: string;
  /** Mot détecté en amont (majuscules) ou null. */
  mot: string | null;
  /** Identifiant opaque de l'auteur : sert seulement à vérifier l'opposition, jamais conservé. */
  idContact?: string | null;
}

export interface CarteEntree {
  idEvenement: string;
  reseau: ReseauEntree;
  post: string;
  mot: string;
  extrait: string;
  lienCommentaire: string | null;
  statut: "a_traiter";
}

/** Interfaces minimales : file durable (L7-26) et registre d'opposition (RC-40). */
export interface PortsEntree {
  file: {
    existe(idEvenement: string): Promise<boolean>;
    ajouter(carte: CarteEntree): Promise<void>;
  };
  oppositions: { estOpposee(idContact: string): Promise<boolean> };
}

export type ResultatEntree =
  | { issue: "carte_creee" }
  | { issue: "ignore"; raison: "reseau_non_gere" | "sans_mot" | "deja_recu" | "opposition" | "donnee_invalide" }
  | { issue: "reessai"; raison: "registre_illisible" };

const ECHAPPEMENTS: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const RE_ID = /^[A-Za-z0-9._:|-]{1,100}$/;
const RE_MOT = /^[A-Z0-9]{2,20}$/;

function extrait(texte: string): string {
  const net = String(texte ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^\s@]+@[^\s@]+/g, "…")
    .replace(/@[\p{L}\p{N}_.]+/gu, "…")
    .replace(/\s+/g, " ")
    .trim();
  let s = "";
  for (const c of net) {
    const e = ECHAPPEMENTS[c] ?? c;
    if (s.length + e.length > EXTRAIT_MAX) break;
    s += e;
  }
  return s;
}

const lienSur = (l: string | null | undefined): string | null => {
  if (!l) return null;
  try {
    return new URL(l).protocol === "https:" ? l : null;
  } catch {
    return null;
  }
};

export async function recevoirCommentaire(c: CommentaireRecu, ports: PortsEntree): Promise<ResultatEntree> {
  if (!(RESEAUX_ENTREE as readonly string[]).includes(c.reseau)) return { issue: "ignore", raison: "reseau_non_gere" };
  if (!RE_ID.test(c.idEvenement ?? "") || !RE_ID.test(c.post ?? "")) return { issue: "ignore", raison: "donnee_invalide" };
  // « stop » : silence, aucune carte (même sans identifiant de personne).
  if (estMotOpposition(c.mot) || estMotOpposition(c.texte)) return { issue: "ignore", raison: "opposition" };
  const mot = c.mot ? c.mot.trim().toUpperCase() : "";
  if (!mot) return { issue: "ignore", raison: "sans_mot" };
  if (!RE_MOT.test(mot)) return { issue: "ignore", raison: "donnee_invalide" };
  if (c.idContact) {
    try {
      if (await ports.oppositions.estOpposee(c.idContact)) return { issue: "ignore", raison: "opposition" };
    } catch {
      return { issue: "reessai", raison: "registre_illisible" }; // doute : rien d'écrit, l'événement sera rejoué
    }
  }
  if (await ports.file.existe(c.idEvenement)) return { issue: "ignore", raison: "deja_recu" };
  await ports.file.ajouter({
    idEvenement: c.idEvenement,
    reseau: c.reseau,
    post: c.post,
    mot,
    extrait: extrait(c.texte),
    lienCommentaire: lienSur(c.lienCommentaire),
    statut: "a_traiter",
  });
  return { issue: "carte_creee" };
}
