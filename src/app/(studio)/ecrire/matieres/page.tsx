import type { Metadata } from "next";
import { OngletMatieres } from "@/components/matieres/OngletMatieres";
import { EnTetePage } from "@/components/ui";
import { TYPES_MATIERE } from "@/domaine/matieres";
import type { TypeMatiere } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { claudeBranche } from "@/services/generation-claude";
import { lireJauge, lireRappelHebdo, listerMatieres } from "@/services/matieres";
import { listerPreuves } from "@/services/preuves";

export const metadata: Metadata = { title: "Matières" };
export const dynamic = "force-dynamic";

/**
 * MATIÈRES (générateur, lot G2) : le contenu de l'onglet « Matières » d'Écrire, aussi joignable seul.
 * ?type=<type>|preuves filtre ; ?ajout=matiere|vrac|preuve ouvre la saisie (bouton central, fiche sujet, raccourci).
 */
export default async function PageMatieres({ searchParams }: { searchParams: Promise<{ type?: string; ajout?: string }> }) {
  await exigerSession();
  const { type, ajout } = await searchParams;
  const [vues, preuves, jauge, rappel, claude] = await Promise.all([listerMatieres(), listerPreuves(), lireJauge(), lireRappelHebdo(), claudeBranche()]);
  const filtre = type === "preuves" || TYPES_MATIERE.includes(type as TypeMatiere) ? (type as TypeMatiere | "preuves") : "tout";
  const ajoutInitial = ajout === "matiere" || ajout === "vrac" || ajout === "preuve" ? ajout : undefined;
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/ecrire", libelle: "Écrire" }} titre="Matières" className="mb-4" />
      <OngletMatieres vues={vues} preuves={preuves} jauge={jauge} rappelHebdo={rappel.actif} filtreInitial={filtre} ajoutInitial={ajoutInitial} rangementEssai={!claude} />
    </div>
  );
}
