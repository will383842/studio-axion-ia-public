/**
 * N-13 : garde pure de « changer un son » (règle 6, sons). À appeler par l'opération changer-son (G14-02).
 * Source unique : le registre des sons existants (`@/briques/sons`). Aucun son neuf, aucun fichier lu.
 */
import { SONS, trouverSon, type EntreeSon } from "@/briques/sons";

export type SonPermis = { ok: true; son: EntreeSon } | { ok: false; phrase: string };

const PHRASE_INCONNU = "Ce son n'est pas dans la liste des sons déjà validés : le chat ne peut pas l'ajouter.";
const PHRASE_NON_PREVU = "Ce son n'est pas prévu pour cette vidéo.";

function validePourLeChat(s: EntreeSon): boolean {
  return s.ecoute === "valide-par-decision" || s.ecoute === "porte-en-base";
}

function posablePourGenerateur(s: EntreeSon, generateur?: string): boolean {
  if (s.posablePar.includes("*")) return true;
  return generateur === "facecam-animee" && s.posablePar.includes("facecam-animee-v4");
}

export function sonPermisDansLeChat(sonId: string, generateur?: string): SonPermis {
  const son = trouverSon(sonId);
  if (!son || !validePourLeChat(son)) return { ok: false, phrase: PHRASE_INCONNU };
  if (!posablePourGenerateur(son, generateur)) return { ok: false, phrase: PHRASE_NON_PREVU };
  return { ok: true, son };
}

export function sonsPermisDansLeChat(generateur?: string): string[] {
  return SONS.filter((s) => validePourLeChat(s) && posablePourGenerateur(s, generateur)).map((s) => s.id);
}
