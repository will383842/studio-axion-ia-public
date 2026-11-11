import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { FormulaireDemoFacecam } from "@/components/formats/vitrines/FormulaireDemoFacecam";

export const metadata: Metadata = { title: "Démo face caméra" };

/** Écran d'entrée du générateur « Démo facecam » (vitrine, lot G) : le rendu sera branché par un lot suivant. */
export default function PageDemoFacecam() {
  return (
    <GabaritCreation entete={{ titre: "Démo face caméra", sousTitre: "Vous et votre écran côte à côte, sous-titres calés." }}>
      <FormulaireDemoFacecam />
    </GabaritCreation>
  );
}
