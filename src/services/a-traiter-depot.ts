/**
 * À TRAITER · dépôt PERSISTANT des cartes (paramètre `a_traiter.cartes`). Aucune migration : le paramètre existe déjà comme
 * mécanisme de stockage. Une écriture ne fait JAMAIS disparaître une carte : fusion par `idEvenement` (la version écrite
 * l'emporte, les cartes absentes de l'écriture sont conservées). Rien n'est supprimé. Contenu illisible : on lève, on n'écrase pas.
 */
import "server-only";
import { ecrireParametre, lireParametre, sousVerrou } from "./_commun";
import type { CarteATraiter } from "./a-traiter-types";
import type { DepotATraiter } from "./a-traiter";

export const PARAM_CARTES_A_TRAITER = "a_traiter.cartes";

async function lireListe(): Promise<CarteATraiter[]> {
  const v: unknown = await lireParametre<unknown>(PARAM_CARTES_A_TRAITER, []);
  if (!Array.isArray(v)) throw new Error("cartes_illisibles");
  return v as CarteATraiter[];
}

export function creerDepotParametre(): DepotATraiter {
  return {
    lire: () => sousVerrou(lireListe),
    ecrire: (nouvelles) =>
      sousVerrou(async () => {
        const existantes = await lireListe();
        const parId = new Map(nouvelles.map((c) => [c.idEvenement, c] as const));
        const fusion = existantes.map((c) => parId.get(c.idEvenement) ?? c);
        const connus = new Set(existantes.map((c) => c.idEvenement));
        for (const c of nouvelles)
          if (!connus.has(c.idEvenement)) {
            connus.add(c.idEvenement);
            fusion.push(c);
          }
        await ecrireParametre(PARAM_CARTES_A_TRAITER, fusion);
      }),
  };
}
