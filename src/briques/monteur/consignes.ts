/**
 * BRIQUE MONTEUR — repérage des consignes « Monteur, … » et messages du fil (mission H, extrait des lots A et D). PUR.
 *
 * Seule une phrase qui COMMENCE par « Monteur » est une consigne (règles de la brique `coupes`, communes à tous les
 * formats). Un message du fil « Discuter avec mon monteur » est une consigne écrite. Le format décide ensuite de ce
 * qu'il sait faire (adaptateur) ; ce qu'il ne sait pas faire reçoit une réponse claire, jamais un silence.
 */
import { reperesConsignes, type ConsigneReperee } from "@/briques/coupes/consignes";
import type { MotHorodate } from "@/domaine/types";
import { ID_FIL } from "./operations";

export type OrigineConsigne = "voix" | "ecrite" | "fil";

/** Une consigne à interpréter, quel que soit le format. */
export interface ConsigneMonteur {
  id: string;
  origine: OrigineConsigne;
  /** Ce que Will demande, sans le mot d'appel. */
  texte: string;
  /** Instant dans la prise où elle a été dite (consigne dite seulement). */
  dansPriseSec?: number;
}

/** Les consignes dites dans une prise (« Monteur, fais-le en 3 caméras »), au format commun. */
export function consignesDites(mots: MotHorodate[]): ConsigneMonteur[] {
  return reperesConsignes(mots).map((c: ConsigneReperee) => ({ id: `voix-${Math.round(c.debutSec * 100)}`, origine: "voix" as const, texte: c.texte, dansPriseSec: +c.debutSec.toFixed(2) }));
}

/** Un message du fil « Discuter avec mon monteur ». */
export function consigneDuFil(message: string, id = ID_FIL): ConsigneMonteur | null {
  const texte = message.replace(/\s+/g, " ").trim().slice(0, 1000);
  return texte ? { id, origine: "fil", texte } : null;
}

/** Lecture tolérante d'une liste de consignes gardée dans une commande ou un réglage. */
export function lireConsignes(brut: unknown): ConsigneMonteur[] {
  if (!Array.isArray(brut)) return [];
  const sortie: ConsigneMonteur[] = [];
  for (const x of brut.slice(0, 50)) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.texte !== "string" || !o.texte.trim()) continue;
    const origine: OrigineConsigne = o.origine === "voix" || o.origine === "fil" ? o.origine : "ecrite";
    sortie.push({ id: typeof o.id === "string" && o.id ? o.id.slice(0, 80) : `c-${sortie.length + 1}`, origine, texte: o.texte.trim().slice(0, 1000), ...(typeof o.dansPriseSec === "number" && Number.isFinite(o.dansPriseSec) ? { dansPriseSec: o.dansPriseSec } : {}) });
  }
  return sortie;
}
