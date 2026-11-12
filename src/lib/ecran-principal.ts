"use client";

import { useSyncExternalStore } from "react";

/**
 * Règle « un seul orange plein par écran » (refonte R3).
 * Chaque bouton « principal » visible et actif (page, fenêtre, feuille) se déclare ici en s'affichant et se retire en
 * disparaissant. Tant qu'il y en a au moins un, « Nouvelle vidéo » (barre de gauche) passe en contour.
 */
let nombre = 0;
const abonnes = new Set<() => void>();

function prevenir() {
  for (const a of abonnes) a();
}

/** Déclare un bouton principal affiché ; renvoie la fonction qui le retire. */
export function declarerBoutonPrincipal(): () => void {
  nombre += 1;
  prevenir();
  let retire = false;
  return () => {
    if (retire) return;
    retire = true;
    nombre = Math.max(0, nombre - 1);
    prevenir();
  };
}

export function nombreBoutonsPrincipaux(): number {
  return nombre;
}

/** Vrai quand l'écran porte son propre bouton principal. Faux côté serveur et avant l'affichage. */
export function useEcranAUnBoutonPrincipal(): boolean {
  return useSyncExternalStore(
    (cb) => {
      abonnes.add(cb);
      return () => abonnes.delete(cb);
    },
    () => nombre > 0,
    () => false,
  );
}

/** Variante de « Nouvelle vidéo » dans la barre : orange plein seul sur l'écran, sinon contour orange. */
export function varianteNouvelleVideo(ecranAUnPrincipal: boolean): "plein" | "contour" {
  return ecranAUnPrincipal ? "contour" : "plein";
}
