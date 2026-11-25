import type { Metadata } from "next";
import { GabaritCreation } from "@/components/creation/GabaritCreation";
import { FormulaireTableauDeBord } from "@/components/formats/vitrines/FormulaireTableauDeBord";
import { depots } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { tableauDeBordOuvert } from "./actions";

export const metadata: Metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

/** Écran d'entrée du format « Tableau de bord » (masqué, hors navigation). Fermé par constante : une phrase, aucun appel. */
export default async function PageTableauDeBord() {
  const ouverte = await tableauDeBordOuvert();
  let personnages: { id: string; nom: string }[] = [];
  if (ouverte) {
    await exigerSession();
    personnages = (await depots().personnages.lister()).map((p) => ({ id: p.id, nom: p.nom }));
  }
  return (
    <GabaritCreation entete={{ titre: "Tableau de bord", sousTitre: "Vos chiffres du mois, en vidéo." }}>
      {ouverte ? <FormulaireTableauDeBord personnages={personnages} /> : <p className="text-sm text-texte-doux">Cette page n&rsquo;est pas encore ouverte.</p>}
    </GabaritCreation>
  );
}
