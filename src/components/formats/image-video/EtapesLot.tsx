"use client";

/** Les 3 étapes d'un lot d'images : les images déposées, la fabrication, ce qu'il reste à relire. */
import { BarreEtapes } from "@/components/ui/BarreEtapes";
import { etapesLot } from "./vues-gabarit";

export function EtapesLot({ courante }: { courante: 0 | 1 | 2 }) {
  const e = etapesLot(courante);
  return <BarreEtapes etapes={e.etapes} courante={e.courante} />;
}
