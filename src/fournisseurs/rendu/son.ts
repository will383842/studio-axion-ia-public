/**
 * SON RÉEL « studio-rendu » (lot R5, 03/10) — gratuit, sur notre serveur (opération `mixage`) : la MÊME chaîne de la
 * voix que le montage, une musique qui s'efface sous la voix si elle est donnée, puis −14 LUFS (± 0,5) et une crête
 * vraie ≤ −1,5 dBTP mesurées sur le fichier rendu. Prépare le podcast (aucun écran ne l'appelle encore).
 * `mixer` exige `source` (adresses signées par le studio). Inscrit seulement si `STUDIO_RENDU_URL` existe ; actif par
 * `FOURNISSEUR_SON=studio-rendu` (ou le réglage « fournisseur.son »).
 */
import type { FournisseurSon } from "../types";
import { executerRendu } from "./attente";
import { ErreurRendu } from "./client";
import type { DependancesOutilServeur } from "./etalonnage";

/** Attente maximale d'un mixage (file longue : un montage peut passer devant). */
export const DELAI_MIXAGE_MS = 20 * 60_000;

export function creerFournisseurSonStudioRendu(deps: DependancesOutilServeur): FournisseurSon {
  return {
    id: "studio-rendu",
    type: "son",
    nom: "Son, sur le serveur",
    reelPrevu: "FFmpeg (chaîne de la voix, loudnorm)",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    async mixer({ niveauCibleLufs, baisseSousVoixDb, source }) {
      if (!source) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Rien à mixer : la voix n'est pas dans le stockage." });
      const marque = (deps.maintenant ?? Date.now)().toString(36);
      const fin = await executerRendu(
        deps.rendu(),
        {
          idRendu: `mixage-${marque}`,
          operation: "mixage",
          file: "longue",
          entrees: { voix: source.voixUrl, ...(source.musiqueUrl ? { musique: source.musiqueUrl } : {}) },
          sortie: source.depot,
          parametres: { lufs: niveauCibleLufs, creteVraieMaxDbtp: -1.5, baisseSousVoixDb, ...(source.dureeSec ? { dureeSec: source.dureeSec } : {}) },
        },
        { delaiMs: DELAI_MIXAGE_MS, attendre: deps.attendre, maintenant: deps.maintenant },
      );
      return { fichierCle: source.depot.cle, niveauLufs: fin.mesures?.lufs ?? niveauCibleLufs, ...(fin.mesures?.creteVraieDbtp !== undefined ? { creteVraieDbtp: fin.mesures.creteVraieDbtp } : {}) };
    },
  };
}
