import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { exigerSession } from "@/services/auth";
import { CarteManqueMatiere } from "../_composants/CarteManqueMatiere";
import { MANQUE_DEMO } from "../_demo";

export const metadata: Metadata = { title: "Il manque une matière (maquette)" };

/** MAQUETTE GM : la carte « Il manque une matière », telle qu'elle s'affiche après « Écrire ». */
export default async function PageMaquetteManque() {
  await exigerSession();
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage
        retour={{ href: "/maquettes-generateur/scripts", libelle: "Scripts" }}
        surTitre="Sujet sans numéro"
        titre={MANQUE_DEMO.idee}
        className="mb-4 [&_h1]:text-2xl"
      />
      <CarteManqueMatiere />
    </div>
  );
}
