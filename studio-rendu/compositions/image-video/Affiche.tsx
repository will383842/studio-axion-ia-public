import React from "react";
/**
 * Affiche de la première image (aperçu des réseaux) : l'OUV-D dans son état FINAL (tous les mots de l'accroche, un seul
 * mot orange, la marque, « Situation type » pour une automatisation), posée par-dessus le premier bloc pendant
 * `affiche.images` image(s) seulement (40 ms) : dès l'image suivante, rien n'est dessiné et le bloc reprend. Posée en
 * DERNIER enfant de la composition, hors caméra, comme `QueueFin`.
 */
import { useCurrentFrame } from "remotion";
import type { FormatIV } from "../../../src/briques/schema-motion/variete";
import { OuvertureD } from "./variete/ouverture/ouv-d";
import type { AfficheIV } from "./variete/ouverture/donnees";

export function Affiche({ affiche, largeur, hauteur }: { affiche?: AfficheIV | null; largeur: number; hauteur: number }) {
  const image = useCurrentFrame();
  if (!affiche || image >= affiche.images) return null;
  const format: FormatIV = hauteur < largeur * 1.5 ? "4:5" : "9:16";
  return <OuvertureD d={affiche.donnees} t={99} format={format} fond={affiche.fond} affiche />;
}
