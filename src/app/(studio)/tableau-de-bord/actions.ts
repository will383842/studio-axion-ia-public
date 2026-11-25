"use server";

/**
 * Tableau de bord : création du brouillon SEULE (G4-08-b3-a), derrière une porte FERMÉE par constante.
 * Fermée : rien n'est lu, rien n'est écrit. Ouverte : un brouillon du format, sans lancement ni prix lu (la lecture de la
 * capture, la voix et le rendu sont d'autres fiches). Un fichier « use server » n'exporte que des fonctions asynchrones :
 * la constante n'est donc pas exportée ; `tableauDeBordOuvert` la rend à la page. Ouvrir = changer cette ligne, par une fiche.
 */
import type { Distribution } from "@/domaine/types";
import { essayer, type Resultat } from "@/services/_commun";
import { nouveauBrouillonFormat } from "@/services/creation-format";

const PAGE_TABLEAU_DE_BORD_OUVERTE: boolean = false;

export async function tableauDeBordOuvert(): Promise<boolean> {
  return PAGE_TABLEAU_DE_BORD_OUVERTE === true;
}

export async function creerTableauDeBord(formulaire: { titre: string; distribution?: Distribution[] }): Promise<Resultat<{ videoId: string }>> {
  if (PAGE_TABLEAU_DE_BORD_OUVERTE !== true) return { ok: false, message: "Cette page n'est pas encore ouverte.", code: "TDB_FERME" };
  return essayer(async () => {
    const v = await nouveauBrouillonFormat({ formatId: "tableau-de-bord", titre: formulaire.titre, sujet: formulaire.titre, distribution: formulaire.distribution ?? [], entrees: {} });
    return { videoId: v.id };
  });
}
