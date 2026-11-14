"use client";

import type { IdReseau } from "@/domaine/types";

/** Ajout d'un créneau dans la vue Jour (pont CAL-14P0 : rien n'est rendu, la fiche CAL-14C y met le bouton). */
export function AjouterDuJour({ jour, aujourdhui, reseaux, comptes }: { jour: string; aujourdhui: string; reseaux: IdReseau[]; comptes: Partial<Record<IdReseau, string>> }) {
  void jour;
  void aujourdhui;
  void reseaux;
  void comptes;
  return null;
}
