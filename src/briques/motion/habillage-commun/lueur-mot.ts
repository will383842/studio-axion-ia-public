/**
 * Lueur du mot-clé et halo de carte, aux teintes de la charte (C10-06, TXT-06 / LUM-02).
 * Module PUR : imports relatifs seulement, aucun hasard. Éteint par défaut ; rien n'est branché ici
 * (le branchement est C7-T9 / C11-C1, derrière la capacité `texte.lueur`).
 * Jamais de flou par filtre CSS, et pas sur le visage : c'est l'appelant qui garantit la zone, au branchement.
 */
import { PALETTE } from "../../charte/axion-2026";
import { halo, lueurTexte } from "./lumiere";

/** Seul `true` allume (lu par l'appelant via `lireParametre`). */
export const LUEUR_MOT_ACTIF = false;

export type TeinteLueur = "terracotta" | "ivoire" | "orange";

/** Ombre de texte lumineuse (au plus 3 ombres, force bornée dans [0, 1]) ; force 0 : `"none"`. */
export function lueurMotCle(teinte: TeinteLueur, force = 0.5): string {
  return lueurTexte(PALETTE[teinte], force);
}

/** Halo doux autour d'une carte (box-shadow multiples) ; force 0 : `{ boxShadow: "none" }`. */
export function haloCarte(boite: { largeur: number; hauteur: number }, teinte: TeinteLueur, force = 0.4): { boxShadow: string } {
  return { boxShadow: String(halo(boite, PALETTE[teinte], force).boxShadow) };
}
