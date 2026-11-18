/**
 * L8-04a : BILAN DE LA SEMAINE à l'accueil. LECTURE DES DÉPÔTS SEULEMENT : aucune requête, aucune IA, aucune écriture,
 * aucune notification, aucun e-mail. Derrière l'interrupteur « accueil.bilan_semaine », ÉTEINT par défaut : éteint, rien n'est lu.
 */
import "server-only";
import { calculerBilanSemaine, lignesBilan, type ContenuMesure } from "@/domaine/bilan-semaine";
import type { Publication } from "@/domaine/types";
import { depots, filtreExemples, lireParametre } from "./_commun";
import { collecterVideosMesurees } from "./mesures-completes";
import { ceQuiMarcheVisuels } from "./mesures-visuels";

export const INTERRUPTEUR_BILAN_SEMAINE = "accueil.bilan_semaine";

/** Les lignes de la carte « Votre semaine », ou `null` (interrupteur éteint : aucune autre lecture). */
export async function bilanSemaineAccueil(maintenant: Date = new Date()): Promise<string[] | null> {
  if ((await lireParametre<boolean>("accueil.bilan_semaine", false)) !== true) return null;
  const ex = await filtreExemples<Publication>();
  const publications = (await depots().publications.lister((p) => ex(p) && p.via !== "simulation")).map((p) => ({
    reseau: p.reseau,
    date: p.date,
    statut: p.statut,
    via: p.via,
    etatEnvoi: p.etatEnvoi,
  }));
  const videos = await collecterVideosMesurees();
  const visuels = await ceQuiMarcheVisuels(maintenant);
  const contenus: ContenuMesure[] = [
    ...videos.map((video) => ({ type: "video" as const, video })),
    ...visuels.classement.reseaux.flatMap((r) => r.rangs.map((x) => ({ type: "carrousel" as const, video: x.video }))),
  ];
  return lignesBilan(calculerBilanSemaine({ publications, contenus }, maintenant));
}
