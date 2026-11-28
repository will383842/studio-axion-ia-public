/**
 * MESURES DES VISUELS (fiche L5-18a) : LECTURE DES DÉPÔTS SEULEMENT. Aucune requête chez le diffuseur, aucune écriture,
 * aucune notification, aucun réglage lu : les chiffres des carrousels arrivent par les relevés déjà enregistrés.
 */
import "server-only";
import { carrouselCommeVideoMesuree, classerCarrousels, estReseauMesureVisuel, etatMesurePublication, type ClassementCarrousels } from "@/domaine/mesures-visuels";
import { estMesuree, type VideoMesuree } from "@/domaine/mesures-rangs";
import type { Publication } from "@/domaine/types";
import { depots, filtreExemples } from "./_commun";
import { exigerSession } from "./auth";

export interface EtatsVisuels {
  mesure: number;
  pasEncore: number;
  nonDisponible: number;
}

export interface CeQuiMarcheVisuelsDonnees {
  classement: ClassementCarrousels;
  etats: EtatsVisuels;
}

/** Classement des carrousels et décompte des trois états, depuis les dépôts. Rien n'est écrit. */
export async function ceQuiMarcheVisuels(maintenant: Date = new Date()): Promise<CeQuiMarcheVisuelsDonnees> {
  await exigerSession();
  const d = depots();
  const ex = await filtreExemples<Publication>();
  const publications = await d.publications.lister((p) => ex(p) && !!p.visuelId && !p.videoId && p.via !== "simulation" && p.statut === "publiee");
  const etats: EtatsVisuels = { mesure: 0, pasEncore: 0, nonDisponible: 0 };
  const mesures: VideoMesuree[] = [];
  for (const p of publications) {
    const visuel = await d.visuels.obtenir(p.visuelId!);
    if (!visuel || visuel.corbeilleLe || !estReseauMesureVisuel(p.reseau)) continue;
    const etat = etatMesurePublication(p, maintenant);
    if (etat === "mesure") etats.mesure++;
    else if (etat === "pas-encore") etats.pasEncore++;
    else etats.nonDisponible++;
    const carrousel = carrouselCommeVideoMesuree({
      publicationId: p.id,
      visuelId: visuel.id,
      famille: visuel.famille,
      titre: visuel.titre,
      reseau: p.reseau,
      date: p.date,
      stats: p.stats,
    });
    if (etat === "mesure" && estMesuree(carrousel)) mesures.push(carrousel);
  }
  return { classement: classerCarrousels(mesures), etats };
}
