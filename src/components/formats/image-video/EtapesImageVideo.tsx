"use client";

/** Les 5 écrans de l'onglet « Image → vidéo », en barre d'étapes (l'écran courant allumé). */
import { BarreEtapes } from "@/components/ui/BarreEtapes";
import { ETAPES_ECRANS, type EcranIV } from "./vue";

export function EtapesImageVideo({ ecran }: { ecran: EcranIV | "depot" }) {
  return <BarreEtapes etapes={ETAPES_ECRANS.map((e) => ({ cle: e.ecran, libelle: e.nom }))} courante={Math.max(0, ETAPES_ECRANS.findIndex((e) => e.ecran === ecran))} />;
}
