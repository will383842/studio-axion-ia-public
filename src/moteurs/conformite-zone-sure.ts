/**
 * N-07 : conformité « zone sûre » des objets visibles neufs, dans les 4 formats. Aide de TEST, jamais importée par la
 * production ni par `studio-rendu`. Branchée sur `controlesEnPlus` de `testerGenerateur` (G1-02, `conformite.ts`).
 * Réutilise `zoneSureDe` et `controleZoneSure` (controle-image/mise-en-page.ts) : rien n'est recopié.
 * Les zones complémentaires (`zonesComplementaires`, src/reseaux) ne sont pas essayées : `zoneSureDe` ne lit que
 * `zonesProtegees` (décision à reprendre avec UO-09/UO-10). La zone du visage est un autre contrôle (plan de scènes).
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { controleZoneSure, zoneSureDe } from "@/briques/controle-image/mise-en-page";
import type { Rectangle } from "@/briques/plan-scenes/zones";
import type { SortieProduite } from "./types";

export const RATIOS_ESSAI = ["9:16", "4:5", "1:1", "16:9"] as const;

/** Un objet visible neuf déclare sa boîte (en % de l'image) pour chaque format. */
export interface ObjetEssai {
  id: string;
  boite(ratio: Ratio): Rectangle;
}

/** Boîte en % : dans la zone sûre commune aux réseaux ? Ratio sans zone connue : `ok` faux (non-fait), jamais réussi. */
export function boiteDansZoneSure(boite: Rectangle, ratio: Ratio, reseaux: IdReseau[]): { ok: boolean; raison: string } {
  const r = controleZoneSure(
    { boites: [{ role: "marque", couleur: "#000000", fond: "#ffffff", x: boite.x / 100, y: boite.y / 100, largeur: boite.largeur / 100, hauteur: boite.hauteur / 100 }] } as Parameters<typeof controleZoneSure>[0],
    zoneSureDe(ratio, reseaux),
  );
  return { ok: r.etat === "reussi", raison: r.raison };
}

/** Contrôle au format de `controlesEnPlus` : pour la sortie (ratio, réseaux), la liste des objets hors zone. */
export function controleZoneSurePourGenerateur(objets: ObjetEssai[]): (sortie: SortieProduite) => string[] {
  return (sortie) =>
    objets.flatMap((o) => {
      const r = boiteDansZoneSure(o.boite(sortie.ratio), sortie.ratio, sortie.reseaux ?? []);
      return r.ok ? [] : [`objet « ${o.id} » (${sortie.ratio}) : ${r.raison}`];
    });
}
