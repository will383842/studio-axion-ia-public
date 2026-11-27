/**
 * HSH-01a · PLACEMENT DES HASHTAGS : à la fin du texte ou dans le premier commentaire, par réseau. PUR.
 *
 * Défaut « texte » partout (comportement d'avant). Le premier commentaire n'est pris que si l'outil de publication le
 * transmet pour ce réseau (fonctions des deux outils IMPORTÉES, jamais recopiées ; TikTok : jamais) ; sinon les
 * hashtags restent dans le texte et `repli` le dit en français. Nombre et interdits sont contrôlés quel que soit
 * l'emplacement ; un dépassement rend un message, jamais une exception.
 */
import type { IdReseau } from "@/domaine/types";
import { ecritureReseau } from "./ecriture";
import { definitionAffichage } from "./hors-video";
import { estInterdit, limiteMotsDieses } from "./hashtags";
import { premierCommentaireTransmissible } from "@/fournisseurs/publication/buffer";
import { premierCommentaireTransmissibleZernio } from "@/fournisseurs/publication/zernio-corps";

export const PLACEMENTS = ["texte", "premier-commentaire"] as const;
export type PlacementHashtags = (typeof PLACEMENTS)[number];

export type ReseauPlacement = "linkedin" | "instagram" | "facebook" | "tiktok";
export const RESEAUX_PLACEMENT: readonly ReseauPlacement[] = ["linkedin", "instagram", "facebook", "tiktok"];

export type OutilPlacement = "buffer" | "zernio";

/** Défaut du réglage `hashtags.placement` : « texte » partout. */
export const PLACEMENT_PAR_DEFAUT: Readonly<Record<ReseauPlacement, PlacementHashtags>> = {
  linkedin: "texte",
  instagram: "texte",
  facebook: "texte",
  tiktok: "texte",
};

/** Règle sourcée (source et date du relevé L8-01) ou, faute de source, marquée « hypothèse ». */
export type RegleSourcee =
  | { niveau: "sourcé"; source: string; date: string }
  | { niveau: "hypothèse"; source: null; date: null };

/** Source neutre (affichée à l'écran) : schéma de l'outil daté du 03/10/2026, pas encore le relevé L8-01. */
const SOURCE_SCHEMA = "Schéma de l'outil de publication, relevé du 03/10/2026 (hors relevé L8-01) : premier commentaire (Instagram, Facebook, LinkedIn)";

const HYPOTHESE: RegleSourcee = { niveau: "hypothèse", source: null, date: null };

/**
 * Règle de transmission du premier commentaire, par réseau et par outil. Seules les règles que le code cite déjà avec
 * une date portent une source ; les autres restent des hypothèses jusqu'à un relevé.
 */
export const REGLES_PLACEMENT: Readonly<Record<ReseauPlacement, Readonly<Record<OutilPlacement, RegleSourcee>>>> = {
  linkedin: {
    buffer: { niveau: "sourcé", source: SOURCE_SCHEMA, date: "2026-10-03" },
    zernio: HYPOTHESE,
  },
  instagram: {
    buffer: { niveau: "sourcé", source: SOURCE_SCHEMA, date: "2026-10-03" },
    zernio: HYPOTHESE,
  },
  facebook: {
    buffer: { niveau: "sourcé", source: SOURCE_SCHEMA, date: "2026-10-03" },
    zernio: HYPOTHESE,
  },
  tiktok: { buffer: HYPOTHESE, zernio: HYPOTHESE },
};

export interface EntreePlacement {
  reseau: IdReseau;
  outil: OutilPlacement;
  placement: PlacementHashtags;
  texte: string;
  motsDiese: readonly string[];
  /** Premier commentaire déjà prévu (conservé). */
  commentaire?: string;
}

export interface SortiePlacement {
  texte: string;
  premierCommentaire?: string;
  /** Phrase française : pourquoi les hashtags sont restés dans le texte. */
  repli?: string;
  /** Phrase française : interdits écartés, nombre hors bornes. Jamais bloquant. */
  message?: string;
}

/** Ce réseau reçoit-il le premier commentaire par cet outil ? TikTok : jamais. */
export function premierCommentairePossible(reseau: IdReseau, outil: OutilPlacement): boolean {
  if (reseau === "tiktok") return false;
  return outil === "buffer" ? premierCommentaireTransmissible(reseau) : premierCommentaireTransmissibleZernio(reseau);
}

function bornes(reseau: IdReseau): [number, number] {
  // Pinterest : pas de règle d'écriture datée (`ecritureReseau` ne décrit que les réseaux de déclinaison) ; bornes d'affichage.
  if (reseau === "pinterest") {
    const { motsDieseConseilles, motsDieseMax } = definitionAffichage(reseau).legende;
    return [motsDieseConseilles, motsDieseMax];
  }
  const hors = reseau === "youtube" ? "youtube-shorts" : reseau;
  const [min, max] = ecritureReseau(hors).motsDiese.valeur;
  const limite = limiteMotsDieses(reseau);
  return [min, typeof limite === "number" ? Math.min(max, limite) : max];
}

const NOMS: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

export function placerHashtags(e: EntreePlacement): SortiePlacement {
  const messages: string[] = [];
  const [min, max] = bornes(e.reseau);

  const interdits = e.motsDiese.filter((m) => estInterdit(m));
  if (interdits.length) messages.push(
      interdits.length > 1
        ? `${interdits.join(", ")} écartés : ces mots-dièse n'aident pas à comprendre votre sujet.`
        : `${interdits[0]} écarté : ce mot-dièse n'aide pas à comprendre votre sujet.`,
    );
  const mots = e.motsDiese.filter((m) => !estInterdit(m));

  if (mots.length > max) {
    // Jamais de coupe silencieuse : le texte de la personne garde tous ses mots-dièse, seul le message avertit.
    messages.push(`${mots.length} mots-dièse : ${max} au plus pour ce réseau, tous sont gardés, à vous de les réduire.`);
  } else if (mots.length < min) {
    messages.push(`${mots.length} mot${mots.length > 1 ? "s" : ""}-dièse : ${min} au moins pour ce réseau.`);
  }

  const sortie: SortiePlacement = { texte: e.texte };
  const commentaire = e.commentaire?.trim() ? e.commentaire : undefined;
  if (commentaire) sortie.premierCommentaire = commentaire;
  if (messages.length) sortie.message = messages.join(" ");
  if (!mots.length) return sortie;

  const ligne = mots.join(" ");
  const ailleurs = e.placement === "premier-commentaire" && premierCommentairePossible(e.reseau, e.outil);
  if (ailleurs) {
    sortie.premierCommentaire = commentaire ? `${commentaire}\n\n${ligne}` : ligne;
    return sortie;
  }
  sortie.texte = e.texte ? `${e.texte}\n\n${ligne}` : ligne;
  if (e.placement === "premier-commentaire") {
    const nom = NOMS[e.reseau] ?? e.reseau;
    sortie.repli =
      e.reseau === "tiktok"
        ? "TikTok n'accepte pas de premier commentaire : vos hashtags restent à la fin du texte."
        : `Le premier commentaire n'est pas transmis sur ${nom} par cet outil : vos hashtags restent à la fin du texte.`;
  }
  return sortie;
}
