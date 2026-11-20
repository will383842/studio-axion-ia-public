import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { FormulaireTutorielOutil } from "@/components/formats/vitrines/FormulaireTutorielOutil";
import { lireInterrupteursTutoriel } from "@/services/tutoriel-depot";
import { deposerTutorielAction } from "./actions";

export const metadata: Metadata = { title: "Tutoriel d'outil" };
export const dynamic = "force-dynamic";

/**
 * Écran d'entrée du générateur « Tutoriel d'outil ». Les interrupteurs sont lus côté serveur (seul `true` exact allume) :
 * éteints, c'est la vitrine d'aujourd'hui ; allumés, le vrai formulaire (T-EXT-33).
 */
export default async function PageTutorielOutil() {
  const interrupteurs = await lireInterrupteursTutoriel();
  return (
    <GabaritCreation entete={{ titre: "Tutoriel d'outil", sousTitre: "Un outil montré en plein écran, sur une voix de synthèse. Pas de visage." }}>
      <FormulaireTutorielOutil interrupteurs={interrupteurs} deposer={deposerTutorielAction} />
    </GabaritCreation>
  );
}
