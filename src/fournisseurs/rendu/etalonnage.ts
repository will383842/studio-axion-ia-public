/**
 * ÉTALONNAGE RÉEL « studio-rendu » (lot R5, 03/10) — gratuit, sur notre serveur (opération `etalonnage` : LUT `.cube`
 * appliquée par FFmpeg `lut3d` en interpolation tétraédrique, à l'intensité voulue, mélange exact avec l'identité).
 * `validerCube` : les mêmes règles que partout (navigateur, serveur). `appliquer` exige `source` (adresses signées
 * par le studio) et renvoie le NOUVEAU fichier ; l'original n'est jamais modifié.
 * Inscrit seulement si `STUDIO_RENDU_URL` existe (`rendu/inscription.ts`) ; actif par `FOURNISSEUR_ETALONNAGE=studio-rendu`
 * (ou le réglage « fournisseur.etalonnage »).
 */
import { validerCube } from "@/lib/qc-lut";
import type { FournisseurEtalonnage, ServiceRendu } from "../types";
import { executerRendu } from "./attente";
import { ErreurRendu } from "./client";
import { identifiantSur } from "./commun";

export interface DependancesOutilServeur {
  rendu: () => ServiceRendu;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
}

/** Attente maximale : une image (file courte) puis une vidéo (file longue, un montage peut passer devant). */
export const DELAI_ETALONNAGE_IMAGE_MS = 60_000;
export const DELAI_ETALONNAGE_VIDEO_MS = 20 * 60_000;

export function creerFournisseurEtalonnageStudioRendu(deps: DependancesOutilServeur): FournisseurEtalonnage {
  return {
    id: "studio-rendu",
    type: "etalonnage",
    nom: "Couleurs, sur le serveur",
    reelPrevu: "FFmpeg (lut3d)",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    async validerCube(contenu) {
      const v = validerCube(contenu);
      return v.ok ? { ok: true, taille: v.taille, avertissement: v.avertissement } : v;
    },
    async appliquer({ lutId, intensite, source }) {
      if (!source) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Rien à étalonner : le fichier n'est pas dans le stockage." });
      const marque = (deps.maintenant ?? Date.now)().toString(36);
      await executerRendu(
        deps.rendu(),
        {
          idRendu: `etalonnage-${identifiantSur(lutId)}-${marque}`,
          operation: "etalonnage",
          file: source.nature === "image" ? "courte" : "longue",
          entrees: { [source.nature]: source.url, lut: source.lutUrl },
          sortie: source.depot,
          parametres: { intensite: Math.min(1, Math.max(0, intensite)) },
        },
        { delaiMs: source.nature === "image" ? DELAI_ETALONNAGE_IMAGE_MS : DELAI_ETALONNAGE_VIDEO_MS, attendre: deps.attendre, maintenant: deps.maintenant },
      );
      return { fichierCle: source.depot.cle };
    },
  };
}
