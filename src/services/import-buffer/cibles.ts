/**
 * IMP-2 — TABLE DES CIBLES (canal Buffer → cible du Studio). Aucun identifiant réel dans le dépôt : la table vit en
 * base sur le serveur (document jsonb), construite avec la sonde des comptes (outils/zernio/comptes.mts), montrée à
 * Will et marquée confirmée seulement après son « C'est juste ». Sans confirmation : aucune création.
 *
 * Cible du Studio : « accountId », « accountId:fb:<pageId> », « accountId:li:<n°> » (D9). Facebook et LinkedIn page
 * exigent une cible explicite ; la page par défaut n'est jamais utilisée. TikTok : aucun post.
 */
import { createHash } from "node:crypto";
import { analyserCible } from "../../fournisseurs/publication/zernio-corps";
import type { CanalBuffer } from "./types";

export const PHRASE_CONFIRMATION = "C'est juste";
export const RESEAUX_IMPORTES = ["instagram", "facebook", "linkedin"] as const;
export type ReseauImporte = (typeof RESEAUX_IMPORTES)[number];

export interface LigneCible {
  canalId: string;
  reseau: ReseauImporte;
  /** Cible du Studio (voir plus haut). */
  cible: string;
}

export interface TableCibles {
  lignes: LigneCible[];
  /** Empreinte des lignes au moment de la confirmation : toute modification ensuite annule la confirmation. */
  confirmeeEmpreinte?: string;
  confirmeeLe?: string;
  confirmation?: string;
}

export class ErreurCibles extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurCibles";
  }
}

export const empreinteTable = (lignes: LigneCible[]): string =>
  createHash("sha256")
    .update(JSON.stringify([...lignes].sort((a, b) => a.canalId.localeCompare(b.canalId)).map((l) => [l.canalId, l.reseau, l.cible])))
    .digest("hex");

/** Valide une ligne : cible lisible, adaptée au réseau (page Facebook explicite, jamais de page par défaut). */
export function validerLigne(l: LigneCible): void {
  if (!(RESEAUX_IMPORTES as readonly string[]).includes(l.reseau)) throw new ErreurCibles("Réseau non importé (TikTok : aucun post).");
  const c = analyserCible(l.cible);
  if (l.reseau === "facebook" && !c.pageId) throw new ErreurCibles("Facebook : la cible doit nommer la page (jamais la page par défaut).");
  if (l.reseau !== "facebook" && c.pageId) throw new ErreurCibles("Une page Facebook n'a de sens que sur Facebook.");
  if (l.reseau !== "linkedin" && c.organizationUrn) throw new ErreurCibles("Une page LinkedIn n'a de sens que sur LinkedIn.");
}

/** Réseau Studio d'un canal Buffer (service Buffer → réseau), ou undefined s'il n'est pas importé. */
export function reseauDuCanal(c: CanalBuffer): ReseauImporte | undefined {
  const s = c.service.toLowerCase();
  return (RESEAUX_IMPORTES as readonly string[]).includes(s) ? (s as ReseauImporte) : undefined;
}

/** Propose une table à partir des choix (canal → cible) ; non confirmée. Les canaux TikTok sont ignorés. */
export function proposerTable(canaux: CanalBuffer[], choix: Record<string, string>): { table: TableCibles; sansCible: string[] } {
  const lignes: LigneCible[] = [];
  const sansCible: string[] = [];
  for (const c of canaux) {
    const reseau = reseauDuCanal(c);
    if (!reseau) continue;
    const cible = choix[c.id];
    if (!cible) {
      sansCible.push(c.id);
      continue;
    }
    const ligne = { canalId: c.id, reseau, cible };
    validerLigne(ligne);
    lignes.push(ligne);
  }
  return { table: { lignes }, sansCible };
}

/** Marque la table confirmée : seule la phrase « C'est juste » de Will la valide. */
export function confirmerTable(table: TableCibles, phrase: string, maintenant: Date): TableCibles {
  if (phrase.trim() !== PHRASE_CONFIRMATION) throw new ErreurCibles(`La table n'est confirmée que par « ${PHRASE_CONFIRMATION} ».`);
  if (table.lignes.length === 0) throw new ErreurCibles("La table des cibles est vide.");
  table.lignes.forEach(validerLigne);
  return { ...table, confirmeeEmpreinte: empreinteTable(table.lignes), confirmeeLe: maintenant.toISOString(), confirmation: PHRASE_CONFIRMATION };
}

export const estConfirmee = (t: TableCibles | undefined): t is TableCibles =>
  !!t && !!t.confirmeeEmpreinte && t.confirmation === PHRASE_CONFIRMATION && t.confirmeeEmpreinte === empreinteTable(t.lignes);

/** Refuse tout si la table n'est pas confirmée (ou a changé depuis). */
export function exigerTableConfirmee(t: TableCibles | undefined): TableCibles {
  if (!estConfirmee(t)) throw new ErreurCibles("La table des cibles n'est pas confirmée par Will : aucune création.");
  return t;
}

/** Relit une table lue en base ou en fichier (forme inconnue → refus). */
export function lireTable(brut: unknown): TableCibles {
  const o = brut as Partial<TableCibles> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.lignes)) throw new ErreurCibles("Table des cibles illisible.");
  const lignes = o.lignes.map((l) => {
    const x = l as Partial<LigneCible>;
    if (typeof x?.canalId !== "string" || typeof x.reseau !== "string" || typeof x.cible !== "string") throw new ErreurCibles("Table des cibles illisible.");
    const ligne = { canalId: x.canalId, reseau: x.reseau as ReseauImporte, cible: x.cible };
    validerLigne(ligne);
    return ligne;
  });
  return { lignes, confirmeeEmpreinte: o.confirmeeEmpreinte, confirmeeLe: o.confirmeeLe, confirmation: o.confirmation };
}

export function cibleDuCanal(t: TableCibles, canalId: string): LigneCible | undefined {
  return t.lignes.find((l) => l.canalId === canalId);
}
