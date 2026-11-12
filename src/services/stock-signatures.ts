/**
 * RC-34 : éviter la redite entre les messages du stock et les sujets de l'usine.
 * Mémoire PROPRE au stock (liste de signatures), indépendante de la mémoire centrale : pas coupée, pas plafonnée à 60.
 * Seules des empreintes hachées sont gardées (axes hachés un à un, signature hachée) ; le texte n'est jamais conservé.
 * Le filtre est local : aucun appel vers l'usine, rien n'est envoyé, rien n'est supprimé.
 */
import { createHash } from "node:crypto";
import { empreinte, type Empreinte } from "@/domaine/proximite/empreinte";
import { scoreProximite } from "@/domaine/proximite/score";
import { etatDe, type MessageStock } from "@/domaine/stock-messages";

/** Ce qui est rangé : l'identifiant du message et des empreintes hachées (SHA-256), rien d'autre. */
export interface SignatureStock {
  id: string;
  axes: string[];
  signature?: string;
}

export interface SujetUsine {
  id: string;
  sujet: string;
  signatureUsine?: string;
}

/** Seuil par défaut, aligné sur `voisines` (L3-11). */
export const SEUIL_REDITE = 0.5;

const hacher = (mot: string): string => createHash("sha256").update(mot).digest("hex");

function haché(e: Empreinte): Empreinte {
  const axes = [...new Set(e.axes.map(hacher))].sort();
  return { cle: axes.join(" "), axes, ...(e.signature ? { signature: hacher(e.signature) } : {}) };
}

const texte = (v: unknown): string => (typeof v === "string" ? v : "");

/** Signature hachée d'un message du stock (sans le texte). */
export function signatureDeMessage(m: MessageStock, signatureUsine?: string): SignatureStock {
  const h = haché(empreinte({ sujet: texte(m?.texte), signatureUsine: texte(signatureUsine) }));
  return { id: String(m?.id ?? ""), axes: h.axes, ...(h.signature ? { signature: h.signature } : {}) };
}

/** Signatures des messages planifiés ou publiés (archivés compris). Entrées illisibles ou sans mot plein ignorées. */
export function signaturesDuStock(messages: readonly MessageStock[]): SignatureStock[] {
  let liste: SignatureStock[] = [];
  for (const m of messages ?? []) {
    if (!m || typeof m.id !== "string" || !m.id || etatDe(m) === "en-stock") continue;
    const s = signatureDeMessage(m);
    if (s.axes.length) liste = rangerSignature(liste, s);
  }
  return liste;
}

/** Ajoute une signature (copie ; rejeu du même id sans effet ; rien n'est retiré). */
export function rangerSignature(liste: readonly SignatureStock[], s: SignatureStock): SignatureStock[] {
  return liste.some((x) => x.id === s.id) ? [...liste] : [...liste, s];
}

function versEmpreinte(s: SignatureStock): Empreinte {
  const axes = Array.isArray(s.axes) ? s.axes.filter((a): a is string => typeof a === "string") : [];
  return { cle: axes.join(" "), axes, ...(typeof s.signature === "string" && s.signature ? { signature: s.signature } : {}) };
}

/**
 * Sépare les sujets de l'usine : ceux dont l'empreinte est proche (score >= seuil) d'un message du stock sont écartés,
 * avec l'identifiant du message le plus proche. Un sujet sans mot plein ou illisible est gardé.
 */
export function ecarterSujetsProches(
  sujets: readonly SujetUsine[],
  stock: readonly SignatureStock[],
  seuil = SEUIL_REDITE,
): { gardes: SujetUsine[]; ecartes: (SujetUsine & { proche: string; score: number })[] } {
  const base = (stock ?? []).filter((s): s is SignatureStock => !!s && typeof s.id === "string").map((s) => ({ id: s.id, e: versEmpreinte(s) }));
  const gardes: SujetUsine[] = [];
  const ecartes: (SujetUsine & { proche: string; score: number })[] = [];
  for (const sujet of sujets ?? []) {
    const cible = haché(empreinte({ sujet: texte(sujet?.sujet), signatureUsine: texte(sujet?.signatureUsine) }));
    let meilleur: { id: string; score: number } | undefined;
    for (const b of base) {
      const score = scoreProximite(cible, b.e);
      if (score > 0 && score >= seuil && (!meilleur || score > meilleur.score)) meilleur = { id: b.id, score };
    }
    if (meilleur) ecartes.push({ ...sujet, proche: meilleur.id, score: meilleur.score });
    else gardes.push(sujet);
  }
  return { gardes, ecartes };
}
