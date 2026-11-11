import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { FormulaireTutorielOutil } from "@/components/formats/vitrines/FormulaireTutorielOutil";

export const metadata: Metadata = { title: "Tutoriel d'outil" };

/** Écran d'entrée du générateur « Tutoriel d'outil » (vitrine, lot G) : le rendu sera branché par un lot suivant. */
export default function PageTutorielOutil() {
  return (
    <GabaritCreation entete={{ titre: "Tutoriel d'outil", sousTitre: "Un outil montré en plein écran, sur une voix de synthèse. Pas de visage." }}>
      <FormulaireTutorielOutil />
    </GabaritCreation>
  );
}
