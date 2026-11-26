import React from "react";
/**
 * LOT 6 (NEUF, non inscrit) : téléphone GÉNÉRIQUE qui joue une vidéo. Aucune marque, aucun logo, aucune forme propre à un fabricant :
 * coins arrondis, petite encoche neutre collée au bord haut (coins bas arrondis, aucun îlot flottant), aucune barre d'état, aucun bouton, aucune caméra dessinée.
 * L'écran joue `src` (adresse fournie) ; sans adresse, l'écran reste un cadre vide, sans erreur.
 * Rien sur le visage : ce composant ne reçoit ni ne dessine aucune personne.
 */
import { continueRender, delayRender, OffthreadVideo } from "remotion";
import manrope from "../../../commune/polices/Manrope-Variable.ttf";

/** Police du lot : Manrope, en UNE constante (SIL OFL 1.1, fichier déjà copié dans `commune/polices`). */
export const POLICE_LOT6 = "Manrope";
/** Couleurs de la charte seulement (valeurs copiées de `communs/briques-v4.tsx`, jamais importées). */
export const COULEURS_LOT6 = { ENCRE: "#141413", IVOIRE: "#FAF9F5", GRIS: "#B0AEA5", ORANGE_MARQUE: "#B23F16" } as const;

let chargement: Promise<void> | null = null;
export function chargerManropeLot6(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope (lot 6)");
  const face = new FontFace(POLICE_LOT6, `url(${manrope})`, { weight: "200 800" });
  chargement = face.load().then(() => { document.fonts.add(face); }).catch(() => undefined).finally(() => continueRender(attente));
}

export type ProprietesTelephoneVideo = {
  /** Adresse de la vidéo jouée dans l'écran. Absente ou vide : cadre vide. */
  src?: string;
  /** Image de départ dans la vidéo (défaut 0). */
  debutImage?: number;
  /** Largeur du téléphone en px (défaut 560) ; hauteur = 2 × largeur environ (rapport 9/19,5 non reconnaissable : 9/18). */
  largeur?: number;
  /** Son de la vidéo : éteint par défaut (aucun son neuf). Seul `true` l'allume. */
  son?: boolean;
};

export function TelephoneVideo({ src, debutImage = 0, largeur = 560, son = false }: ProprietesTelephoneVideo) {
  chargerManropeLot6();
  const hauteur = Math.round(largeur * 2);
  const cadre = Math.round(largeur * 0.03);
  const rayon = Math.round(largeur * 0.12);
  // Ombre B (douce, sombre, dessous) choisie par le pilote sur le clip TELEPHONE le 25/11 (journal/DECISIONS-PILOTE-20-11-j.md).
  const aVideo = typeof src === "string" && src.trim() !== "";
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, borderRadius: rayon, background: COULEURS_LOT6.ENCRE, padding: cadre, boxSizing: "border-box", boxShadow: `0 ${Math.round(largeur * 0.02)}px ${Math.round(largeur * 0.05)}px rgba(20, 20, 19, 0.35)`, fontFamily: `${POLICE_LOT6}, sans-serif` }}>
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: rayon - cadre, overflow: "hidden", background: COULEURS_LOT6.IVOIRE }}>
        {aVideo ? <OffthreadVideo src={src as string} trimBefore={debutImage} muted={son !== true} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: Math.round(largeur * 0.22), height: Math.round(largeur * 0.04), borderRadius: `0 0 ${Math.round(largeur * 0.03)}px ${Math.round(largeur * 0.03)}px`, background: COULEURS_LOT6.ENCRE }} />
      </div>
    </div>
  );
}
