import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { FormulaireTutorielOutil } from "@/components/formats/vitrines/FormulaireTutorielOutil";
import { lireInterrupteursTutoriel } from "@/services/tutoriel-depot";
import { lireParametre } from "@/services/_commun";
import { CLE_DEVIS_AVANT_DEPENSE } from "@/services/tutoriel-console";
import { deposerTutorielAction } from "./actions";

export const metadata: Metadata = { title: "Tutoriel d'outil" };
export const dynamic = "force-dynamic";

/** Réglage du devis avant dépense (seul `true` exact) ; lecture en échec = éteint. */
async function lireDevis(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(CLE_DEVIS_AVANT_DEPENSE, false)) === true;
  } catch {
    return false;
  }
}

/** Équipe ouverte = `equipeTutorielActive()` (lecture seule) ; si la lecture lève, l'équipe compte comme fermée. */
async function lireEquipeOuverte(): Promise<boolean> {
  try {
    return (await (await import("@/services/tutoriel-equipe")).equipeTutorielActive()) === true;
  } catch {
    return false;
  }
}

/**
 * Écran d'entrée du générateur « Tutoriel d'outil ». Les interrupteurs sont lus côté serveur (seul `true` exact allume) :
 * éteints, c'est la vitrine d'aujourd'hui ; allumés, le vrai formulaire (T-EXT-33).
 */
export default async function PageTutorielOutil() {
  const [base, devis, equipeOuverte] = await Promise.all([lireInterrupteursTutoriel(), lireDevis(), lireEquipeOuverte()]);
  const interrupteurs = { ...base, devis };
  return (
    <GabaritCreation entete={{ titre: "Tutoriel d'outil", sousTitre: "Un outil montré en plein écran, pas à pas. Pas de visage." }}>
      <FormulaireTutorielOutil interrupteurs={interrupteurs} deposer={deposerTutorielAction} equipeOuverte={equipeOuverte} />
    </GabaritCreation>
  );
}
