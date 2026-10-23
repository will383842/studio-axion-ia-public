/**
 * INSCRIPTION DES OUTILS DU SERVEUR (lots R4 et R5, 03/10) : ce que `studio-rendu` calcule gratuitement sur notre
 * serveur, hors montage — miniatures (R4), étalonnage et son (R5). Le registre (`fournisseurs/index.ts`) lit
 * `outilsServeur()` une ligne par type, sans rien savoir d'autre.
 * Rien n'est inscrit sans `STUDIO_RENDU_URL` : la simulation reste. Inscrit ne veut pas dire actif : chaque outil
 * s'active par le choix de Will (Réglages > Connexions, réglage « fournisseur.<type> ») ou `FOURNISSEUR_<TYPE>=studio-rendu`.
 */
import type { FournisseurEtalonnage, FournisseurMiniature, FournisseurSon } from "../types";
import { obtenirServiceRendu } from "./client";
import { creerFournisseurEtalonnageStudioRendu } from "./etalonnage";
import { creerFournisseurMiniatureStudioRendu } from "./miniature";
import { studioRenduRelie } from "./montage";
import { creerFournisseurSonStudioRendu } from "./son";

export interface OutilsServeur {
  miniature: Record<string, FournisseurMiniature>;
  etalonnage: Record<string, FournisseurEtalonnage>;
  son: Record<string, FournisseurSon>;
}

export function outilsServeur(env: Record<string, string | undefined> = process.env): OutilsServeur {
  if (!studioRenduRelie(env)) return { miniature: {}, etalonnage: {}, son: {} };
  // Le service est obtenu à chaque usage (l'adresse est lue au moment du calcul).
  const rendu = () => obtenirServiceRendu(env);
  return {
    miniature: { "studio-rendu": creerFournisseurMiniatureStudioRendu({ rendu }) },
    etalonnage: { "studio-rendu": creerFournisseurEtalonnageStudioRendu({ rendu }) },
    son: { "studio-rendu": creerFournisseurSonStudioRendu({ rendu }) },
  };
}
