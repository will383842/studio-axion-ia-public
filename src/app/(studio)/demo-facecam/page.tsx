import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { demoFacecamOuverte } from "./actions";
import { FormulaireDemoFacecam } from "@/components/formats/vitrines/FormulaireDemoFacecam";

export const metadata: Metadata = { title: "Démo face caméra" };
export const dynamic = "force-dynamic";

/** Écran d'entrée du générateur « Démo facecam » (vitrine, lot G) : le rendu sera branché par un lot suivant. */
export default async function PageDemoFacecam() {
  const envoi = await demoFacecamOuverte();
  return (
    <GabaritCreation entete={{ titre: "Démo face caméra", sousTitre: "Vous et votre écran côte à côte, sous-titres calés." }}>
      <FormulaireDemoFacecam {...(envoi ? { envoi: true } : {})} />
    </GabaritCreation>
  );
}
