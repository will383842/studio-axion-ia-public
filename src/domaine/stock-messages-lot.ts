/**
 * RC-32 : ajout de plusieurs messages d'un coup au stock. Pur : aucune écriture, aucun appel réel.
 * Rien n'est écrasé ni supprimé ; les doublons exacts sont signalés, pas retirés du stock.
 */
import { creerEntreeStock, type MessageStock, type PrioriteStock, verifierSaisieStock } from "./stock-messages";
import type { IdReseau } from "./types";

const LIGNE_TIRETS = /^\s*-{3,}\s*$/;

/** Sépare un collage en blocs : ligne vide ou ligne de tirets (3 au moins). Blocs vides ignorés. */
export function decouperEnBlocs(texte: string): string[] {
  const blocs: string[] = [];
  let courant: string[] = [];
  const clore = () => {
    const b = courant.join("\n").trim();
    if (b) blocs.push(b);
    courant = [];
  };
  for (const ligne of texte.replace(/\r\n?/g, "\n").split("\n")) {
    if (!ligne.trim() || LIGNE_TIRETS.test(ligne)) clore();
    else courant.push(ligne.replace(/\s+$/, ""));
  }
  clore();
  return blocs;
}

/** Signature d'un bloc (espaces normalisés, casse conservée) : sert à repérer les doublons sans exposer le texte. */
export function signatureBloc(texte: string): string {
  const n = texte.replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < n.length; i++) {
    h ^= n.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${n.length.toString(16)}-${h.toString(16).padStart(8, "0")}`;
}

export interface DoublonLot {
  /** Rang du bloc dans le collage, à partir de 1. */
  position: number;
  texte: string;
  /** Id de l'entrée existante, ou « saisie:N » pour un bloc déjà présent plus haut dans le collage. */
  avec: string;
}

export interface PreparationLot {
  aCreer: MessageStock[];
  doublons: DoublonLot[];
  erreur: string | null;
}

export function preparerAjoutEnLot(e: {
  texte: string;
  reseaux: IdReseau[];
  priorite: PrioriteStock;
  /** Tout le stock, archivé compris. */
  existantes: MessageStock[];
  idDe: (index: number) => string;
  creeLe: string;
}): PreparationLot {
  const blocs = decouperEnBlocs(typeof e.texte === "string" ? e.texte : "");
  if (blocs.length === 0) return { aCreer: [], doublons: [], erreur: "Collez au moins un message." };
  const erreur = verifierSaisieStock({ texte: blocs[0], reseaux: e.reseaux, priorite: e.priorite });
  if (erreur) return { aCreer: [], doublons: [], erreur };

  const vus = new Map<string, string>();
  for (const m of e.existantes) {
    const s = signatureBloc(m.texte);
    if (!vus.has(s)) vus.set(s, m.id);
  }
  const aCreer: MessageStock[] = [];
  const doublons: DoublonLot[] = [];
  blocs.forEach((texte, i) => {
    const s = signatureBloc(texte);
    const avec = vus.get(s);
    if (avec) {
      doublons.push({ position: i + 1, texte, avec });
      return;
    }
    vus.set(s, `saisie:${i + 1}`);
    aCreer.push(creerEntreeStock({ id: e.idDe(aCreer.length), texte, reseaux: [...e.reseaux], priorite: e.priorite }, e.creeLe));
  });
  return { aCreer, doublons, erreur: null };
}
