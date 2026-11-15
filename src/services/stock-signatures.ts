/**
 * RC-34 : mémoire PROPRE AU STOCK des empreintes (L3-11) des messages planifiés ou publiés. Elle ne dépend ni de la mémoire
 * centrale (coupée par défaut, sans les textes du fondateur, 60 entrées) ni de son réglage : toujours active, jamais tronquée.
 * Seule l'empreinte HACHÉE (SHA-256 de chaque racine du sujet) est rangée : aucun mot en clair, aucun texte. Le filtre
 * s'applique côté Studio sur les sujets proposés par l'usine ; rien n'est envoyé à l'usine (ni texte, ni empreinte), aucun
 * fournisseur n'est appelé. Le stock est une donnée du fondateur : ce service n'efface jamais rien (ajout et mise à jour d'état
 * seulement) ; une valeur existante qui n'est pas une liste n'est jamais écrasée (écriture refusée). Une lecture illisible vaut « rien ».
 */
import "server-only";
import { createHash } from "node:crypto";
import { empreinteDe, proximite } from "@/domaine/proximite";
import { creerVerrou, ecrireParametre, lireParametre } from "./_commun";

export const CLE_SIGNATURES_STOCK = "stock.signatures";
/** Score de proximité (Jaccard) à partir duquel un sujet de l'usine est écarté. */
export const SEUIL_PROXIMITE_STOCK = 0.5;

export type EtatSignature = "planifie" | "publie";

/** Ce qui est rangé : des empreintes hachées, jamais le texte. */
export interface SignatureStock {
  id: string;
  /** SHA-256 hexadécimal de chaque racine du sujet, triées. */
  axes: string[];
  /** SHA-256 de la signature posée par l'usine, si elle existe. */
  signature?: string;
  etat: EtatSignature;
  date: string;
}

export interface SujetCandidat {
  id: string;
  sujet: string;
  signatureUsine?: string;
}

export interface SujetEcarte {
  id: string;
  /** Id de l'entrée du stock dont le sujet est proche. */
  procheDe: string;
  score: number;
}

const verrou = creerVerrou();
const hacher = (s: string): string => createHash("sha256").update(`rc34|${s}`).digest("hex");

/** Empreinte L3-11 dont chaque axe (et la signature) est haché ; vide si le texte n'a aucun mot plein. */
function empreinteHachee(sujet: string, signatureUsine?: string) {
  const e = empreinteDe({ sujet, signatureUsine });
  const axes = e.axes.map(hacher).sort();
  return { axes, signature: e.signature ? hacher(e.signature) : undefined };
}

const estHache = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const estSignature = (x: unknown): x is SignatureStock => {
  const s = x as SignatureStock | null;
  return !!s && typeof s === "object" && typeof s.id === "string" && Array.isArray(s.axes) && s.axes.every(estHache) && (s.signature === undefined || estHache(s.signature));
};

/** Toutes les signatures du stock (aucune fenêtre) ; illisible : vide. */
export async function signaturesDuStock(): Promise<SignatureStock[]> {
  try {
    const v = await lireParametre<unknown>(CLE_SIGNATURES_STOCK, []);
    return Array.isArray(v) ? v.filter(estSignature) : [];
  } catch {
    return [];
  }
}

/**
 * Range l'empreinte hachée d'un message planifié ou publié. Vrai si rangée ou déjà présente. Rejeu du même id : pas de
 * doublon, l'état est mis à jour (planifié → publié, jamais l'inverse). Faux : message encore en stock, sans mot plein,
 * ou base qui refuse (jamais d'exception vers l'appelant).
 */
export async function rangerSignatureStock(m: { id: string; texte: string; signatureUsine?: string; etat: string }): Promise<boolean> {
  if ((m.etat !== "planifie" && m.etat !== "publie") || !m.id.trim()) return false;
  const h = empreinteHachee(m.texte, m.signatureUsine);
  if (!h.axes.length && !h.signature) return false;
  try {
    return await verrou(async () => {
      const brut = await lireParametre<unknown>(CLE_SIGNATURES_STOCK, []);
      // jamais de suppression : une valeur existante qui n'est pas une liste n'est JAMAIS écrasée (refus signalé) ;
      // une liste garde TOUTES ses lignes, même non conformes
      if (brut !== undefined && brut !== null && !Array.isArray(brut)) {
        console.error("[studio] signatures du stock : valeur existante illisible (non liste), non écrasée");
        return false;
      }
      const liste: unknown[] = Array.isArray(brut) ? [...brut] : [];
      const rang = liste.findIndex((x) => estSignature(x) && x.id === m.id);
      if (rang >= 0) {
        const ancienne = liste[rang] as SignatureStock;
        if (ancienne.etat !== "publie" && m.etat === "publie") liste[rang] = { ...ancienne, etat: "publie" };
        else return true;
      } else {
        liste.push({ id: m.id, axes: h.axes, ...(h.signature ? { signature: h.signature } : {}), etat: m.etat as EtatSignature, date: new Date().toISOString() } satisfies SignatureStock);
      }
      await ecrireParametre(CLE_SIGNATURES_STOCK, liste);
      return true;
    });
  } catch (erreur) {
    console.error("[studio] signatures du stock : non rangée", erreur);
    return false;
  }
}

/** PUR : sépare les sujets gardés et écartés (proches d'une signature du stock au seuil donné). L'ordre est conservé. */
export function ecarterProches<T extends SujetCandidat>(
  sujets: readonly T[],
  signatures: readonly SignatureStock[],
  seuil = SEUIL_PROXIMITE_STOCK,
): { gardes: T[]; ecartes: SujetEcarte[] } {
  const gardes: T[] = [];
  const ecartes: SujetEcarte[] = [];
  for (const s of sujets) {
    const h = empreinteHachee(s.sujet, s.signatureUsine);
    const cible = { cle: "", axes: h.axes, ...(h.signature ? { signature: h.signature } : {}) };
    let meilleur: SujetEcarte | null = null;
    for (const sig of signatures) {
      const score = proximite(cible, { cle: "", axes: sig.axes, ...(sig.signature ? { signature: sig.signature } : {}) });
      if (score > 0 && score >= seuil && (!meilleur || score > meilleur.score)) meilleur = { id: s.id, procheDe: sig.id, score };
    }
    if (meilleur) ecartes.push(meilleur);
    else gardes.push(s);
  }
  return { gardes, ecartes };
}

/** Filtre les sujets proposés par l'usine avec le stock rangé. Aucun appel externe ; stock illisible : rien n'est écarté. */
export async function ecarterSujetsProches<T extends SujetCandidat>(sujets: readonly T[], seuil = SEUIL_PROXIMITE_STOCK) {
  return ecarterProches(sujets, await signaturesDuStock(), seuil);
}
