import type { Metadata } from "next";
import { CeQuiMarche } from "@/components/generateur/CeQuiMarche";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { apprentissageActif } from "@/services/apprentissage";
import { exigerSession } from "@/services/auth";
import { ceQuiMarche, modesLecture } from "@/services/mesures-completes";

export const metadata: Metadata = { title: "Ce qui marche" };
export const dynamic = "force-dynamic";

/**
 * CE QUI MARCHE (plan v5 B.8 §3 et §8, lot G7b) : rangs par réseau, ce qui revient devant (format, structure, ouverture),
 * et les 5 vidéos les plus proches d'une version prête. Des rangs mesurés, jamais une prévision.
 */
export default async function PageCeQuiMarche() {
  await exigerSession();
  const donnees = await ceQuiMarche();
  const apprentissage = await apprentissageActif();
  const modes = modesLecture();
  return (
    <div className="mx-auto max-w-2xl">
      <EnTetePage retour={{ href: "/mesures", libelle: "Mesures" }} titre="Ce qui marche" sousTitre={donnees.nombre ? `${donnees.nombre} vidéos mesurées` : undefined} className="mb-4" />
      <CeQuiMarche donnees={donnees} apprentissage={apprentissage} essai={modes.buffer === "simulation" && modes.visites === "simulation"} />
    </div>
  );
}
