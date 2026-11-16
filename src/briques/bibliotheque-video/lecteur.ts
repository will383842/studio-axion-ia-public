/**
 * Lecteur de l'entrée figée (C1-U4) : donne le profil, l'historique et un `choisir` déjà branché sur la graine.
 * Reçoit une `EntreeBibliotheque` déjà lue ; ne lit rien. Module côté Studio seulement.
 */
import { choisir, type Besoin, type Historique, type ResultatChoix } from "./choisir";
import { graineDe } from "./graine";
import type { Candidat, Choix, EntreeBibliotheque, ProfilVideo } from "./types";

export interface LecteurBibliotheque {
  profil: ProfilVideo;
  historique: Historique;
  choisir: <C extends Candidat>(
    besoin: Omit<Besoin, "graine"> & { graine?: string },
    candidats: readonly C[],
    dejaChoisis?: readonly Choix[],
  ) => ResultatChoix<C>;
}

export function lecteurDepuisEntree(entree: EntreeBibliotheque): LecteurBibliotheque {
  return {
    profil: entree.profil,
    historique: entree.recents,
    choisir: (besoin, candidats, dejaChoisis) =>
      choisir(
        entree.profil,
        { ...besoin, graine: besoin.graine ?? graineDe(entree.graine, besoin.capacite) },
        candidats,
        entree.recents,
        dejaChoisis ?? entree.choix ?? [],
      ),
  };
}
