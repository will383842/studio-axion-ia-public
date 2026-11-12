"use client";

/** Les 3 étapes d'un lot d'images : les images déposées, la fabrication, ce qu'il reste à relire. */
import { BarreEtapesCommune } from "@/components/ui/BarreEtapesCommune";
import { etapesLot } from "./vues-gabarit";

export function EtapesLot({ courante }: { courante: 0 | 1 | 2 }) {
  const e = etapesLot(courante);
  return <BarreEtapesCommune etapes={e.etapes} courante={e.courante} />;
}
