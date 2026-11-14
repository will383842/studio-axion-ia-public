/**
 * RC-14 : l'UNIQUE fonction de seuil du registre d'alertes. Pure, sans réseau, sans horloge.
 * Toute alerte chiffrée du registre passe par ici ; aucune autre comparaison de seuil n'existe.
 * Une valeur absente ou non finie ne peut pas être jugée : « non-evalue », jamais « ok » (pas de faux vert).
 */
export type Niveau = "ok" | "alerte" | "non-evalue";

export interface RegleSeuil {
  seuil: number;
  /** « au-moins » : alerte quand valeur >= seuil. « au-plus » : alerte quand valeur <= seuil. */
  sens: "au-moins" | "au-plus";
}

export function evaluerSeuil(valeur: number | null | undefined, regle: RegleSeuil): Niveau {
  if (typeof valeur !== "number" || !Number.isFinite(valeur)) return "non-evalue";
  const atteint = regle.sens === "au-moins" ? valeur >= regle.seuil : valeur <= regle.seuil;
  return atteint ? "alerte" : "ok";
}
