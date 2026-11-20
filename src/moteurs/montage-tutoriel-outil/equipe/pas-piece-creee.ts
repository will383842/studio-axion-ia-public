/**
 * T-EXT-V2-08 · LE PAS « PIÈCE CRÉÉE » de l'équipe — PUR : aucun appel, aucune horloge, aucun réseau, ne lève jamais.
 *
 * Quand une vidéo part d'une phrase (réglages allumés), le maquettiste PROPOSE une maquette (ou un flux) ; cette proposition est
 * relue par les contrôles des textes créés (V2-02, V2-06), construite sur le poste (aperçu, 0 €), puis montrée à l'utilisateur,
 * qui la garde, la corrige ou l'arrête. Rien n'est dit ni écrit à sa place : une pièce n'entre dans la chaîne qu'une fois GARDÉE,
 * avec l'empreinte exacte qu'il a vue. Les cartes, données et textes sont ensuite déduits SANS Claude.
 * Toutes les phrases : vouvoiement, sans montant, sans mot technique.
 */
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { DescriptionMaquette } from "../description-maquette";
import { carteDepuisFlux, controlerFluxCree, empreinteFlux, textesDuFlux } from "../flux-cree";
import type { FluxAutomatisation } from "../gabarit-flux";
import { carteDepuisDescription, controlerTextesCrees, empreinteDescription, tableauDepuisDescription, textesDeLaMaquette, type ApercuPiece } from "../maquette-creee";
import type { CarteZones } from "./analyste";

export type GenrePiece = "maquette" | "flux";
export type StatutPiece = "a-revoir" | "a-construire" | "a-valider" | "gardee" | "refusee";

export interface PieceCreee {
  genre: GenrePiece;
  proposition: 1 | 2;
  contenu: DescriptionMaquette | FluxAutomatisation;
  empreinte: string;
  statut: StatutPiece;
  erreurs?: string[];
  apercu?: ApercuPiece;
  gardee?: { empreinte: string; le: string };
}

/** Ce que ce pas lit et écrit dans l'état de l'équipe (champs facultatifs : un état d'avant reste valide). */
export interface EtatPiece {
  pieceCreee?: PieceCreee;
  carte?: CarteZones;
  donnees?: TableauDeBord;
  textesMaquette?: { etapeId: string; textes: string[]; creee: boolean }[];
  /** Interne à l'état (pas au schéma de la carte) : la carte vient d'une pièce gardée, l'analyste n'est pas appelé. */
  carteOrigine?: "piece-gardee";
}

export const CODE_PIECE_A_REVOIR = "TO_PIECE_A_REVOIR";
export const CODE_PIECE_A_CONSTRUIRE = "TO_PIECE_A_CONSTRUIRE";
export const CODE_PIECE_A_VALIDER = "TO_PIECE_A_VALIDER";
export const CODE_DEMANDE_ARRETEE = "TO_DEMANDE_ARRETEE";

export const MESSAGE_PIECE_A_REVOIR = "La maquette proposée ne respecte pas les règles (détail sur l'écran) : vous pouvez en demander une autre. Rien n'a échoué.";
export const MESSAGE_PIECE_A_CONSTRUIRE = "La maquette se prépare sur le poste de capture : son aperçu arrive, rien n'est dépensé.";
export const MESSAGE_PIECE_A_VALIDER = "Votre maquette attend votre choix : gardez-la, corrigez un texte ou demandez-en une autre.";
export const MESSAGE_DEMANDE_ARRETEE = "Vous avez arrêté cette demande : rien ne sera fabriqué.";
const MESSAGE_APERCU_A_REVOIR = "L'aperçu de la maquette a relevé des points à revoir (détail sur l'écran) : vous pouvez en demander une autre. Rien n'a échoué.";

/** Date fixe des chiffres d'exemple (l'orchestre n'a pas d'horloge) : données marquées « exemple », jamais un montant. */
const DATE_EXEMPLE = "2026-01-01";

export type PropositionPiece = { genre: "maquette"; proposition: 1 | 2; contenu: DescriptionMaquette } | { genre: "flux"; proposition: 1 | 2; contenu: FluxAutomatisation };

/**
 * Relit la proposition par les contrôles des textes créés. Erreurs : « à revoir » (rien n'est construit, aucune reprise
 * automatique). Sinon « à construire » avec l'empreinte. Ne lève jamais.
 */
export function recevoirProposition<E extends EtatPiece>(e: E, p: PropositionPiece, nomsPermis: readonly string[] = []): E & EtatPiece {
  let erreurs: string[];
  let empreinte = "";
  try {
    erreurs = p.genre === "maquette" ? controlerTextesCrees(p.contenu, nomsPermis) : controlerFluxCree(p.contenu, nomsPermis);
    empreinte = p.genre === "maquette" ? empreinteDescription(p.contenu) : empreinteFlux(p.contenu);
  } catch {
    erreurs = ["Proposition illisible."];
  }
  const piece: PieceCreee = { genre: p.genre, proposition: p.proposition, contenu: p.contenu, empreinte, statut: erreurs.length > 0 ? "a-revoir" : "a-construire", ...(erreurs.length > 0 ? { erreurs } : {}) };
  return { ...e, pieceCreee: piece };
}

export type PasPiece = { pause: { code: string; message: string }; etat?: PieceCreee } | { suite: true };

const apercuValide = (p: PieceCreee): boolean => p.apercu !== undefined && p.apercu.empreinteDescription === p.empreinte;

/** Ce que l'équipe doit faire d'une pièce proposée : attendre, ou continuer (pièce gardée, empreinte inchangée). Ne lève jamais. */
export function pasPieceCreee(p: PieceCreee | undefined): PasPiece {
  try {
    if (!p) return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_PIECE_A_REVOIR } };
    switch (p.statut) {
      case "a-revoir":
        return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_PIECE_A_REVOIR } };
      case "refusee":
        return { pause: { code: CODE_DEMANDE_ARRETEE, message: MESSAGE_DEMANDE_ARRETEE } };
      case "gardee":
        if (p.gardee?.empreinte === p.empreinte && apercuValide(p)) return { suite: true };
        // La pièce a changé depuis le oui (ou le oui est incomplet) : il est à refaire, rien n'est filmé.
        return { pause: { code: CODE_PIECE_A_CONSTRUIRE, message: MESSAGE_PIECE_A_CONSTRUIRE }, etat: { ...sansGarde(p), statut: "a-construire" } };
      case "a-construire":
      case "a-valider":
        if (!apercuValide(p)) return { pause: { code: CODE_PIECE_A_CONSTRUIRE, message: MESSAGE_PIECE_A_CONSTRUIRE } };
        if (!p.apercu!.controle.ok) return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_APERCU_A_REVOIR } };
        return { pause: { code: CODE_PIECE_A_VALIDER, message: MESSAGE_PIECE_A_VALIDER } };
      default:
        return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_PIECE_A_REVOIR } };
    }
  } catch {
    return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_PIECE_A_REVOIR } };
  }
}

function sansGarde(p: PieceCreee): PieceCreee {
  const { gardee: _g, ...reste } = p;
  void _g;
  return reste;
}

/**
 * La pièce est gardée : la carte des zones, les données (maquette seulement) et les textes sont DÉDUITS de la description, sans
 * Claude. Les textes entrent au registre comme « maquette créée » (`creee: true`). Si la déduction échoue, la pièce repasse
 * « à revoir » (rien n'est filmé). Ne lève jamais.
 */
export function appliquerPieceGardee<E extends EtatPiece>(e: E): E & EtatPiece {
  const p = e.pieceCreee;
  if (!p) return e;
  const revoir = (erreurs: string[]): E & EtatPiece => ({ ...e, pieceCreee: { ...p, statut: "a-revoir", erreurs: erreurs.slice(0, 6) } });
  try {
    if (p.genre === "maquette") {
      const d = p.contenu as DescriptionMaquette;
      const carte = carteDepuisDescription(d);
      if (!carte.ok) return revoir(carte.erreurs);
      const donnees = tableauDepuisDescription(d, DATE_EXEMPLE);
      if (!donnees.ok) return revoir(donnees.erreurs);
      return { ...e, carte: carte.carte, donnees: donnees.donnee, textesMaquette: textesDeLaMaquette(d).map((t) => ({ etapeId: t.ecranId, textes: t.textes, creee: true })), carteOrigine: "piece-gardee" };
    }
    const f = p.contenu as FluxAutomatisation;
    const carte = carteDepuisFlux(f);
    if (!carte.ok) return revoir(carte.erreurs);
    const { donnees: _d, ...sansDonnees } = e;
    void _d;
    return { ...sansDonnees, carte: carte.carte, textesMaquette: textesDuFlux(f).map((t) => ({ etapeId: t.etapeId, textes: t.textes, creee: true })), carteOrigine: "piece-gardee" } as E & EtatPiece;
  } catch {
    return revoir(["Déduction impossible."]);
  }
}
