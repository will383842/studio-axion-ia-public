import React from "react";
/**
 * ÉLÉMENT 38 `PanneauFin` (standard DA v4, lot 5). La fin, comme les deux références (Instagram 72,8 s ; LinkedIn 78,2 s).
 * Gabarit M9 : panneau IVOIRE qui MONTE DU BAS en 5 i (sans rebond au-dessus du haut) et pousse la prise vers le bas (translation
 * verticale de la prise seulement : `decalagePrise`). Puis, en cascade, UN ÉLÉMENT PAR IMAGE : logo Axion-IA, nom « Williams Jullin »
 * (Montserrat 900, 64), 5 pastilles d'outils (tuiles BLANC à contour 5 px, icônes du composant `Icone`), bouton ACCENT_1
 * « COMMENTEZ « RELANCE » » qui pulse. Aucun pictogramme de réseau social tiers : les tuiles portent des icônes neutres.
 * Durée 1-1,5 s. Son : « son qui monte » (≈ 1,2 → 2,6 kHz, synthèse maison `sons/montee.wav`).
 */
import { Easing, Img } from "remotion";
import { mediaV4 } from "../communs/medias-v4";
import { Icone } from "../../elements";
import { accents, Bruitage, courbe, COULEURS, FPS, gestesDeVie, H, MONTSERRAT, Palette, Pose, ressort, TRAIT, tick, W } from "./commun-lot5";

export const ID_PANNEAU_FIN = "panneau-fin";
export const DUREE_PANNEAU_FIN = 42; // 1,4 s

export type PanneauFinProps = { frame: number; debut: number; palette: Palette; nom?: string; motCle: string; icones?: string[] };

/** Avancement 0 → 1 de la montée du panneau (5 i, freinage net, aucun dépassement). */
export const monteePanneau = (frame: number, debut: number) => courbe(frame - debut, 0, 5, Easing.out(Easing.cubic));
/** Décalage vertical supplémentaire de la prise (fraction de H) : elle est repoussée vers le bas sous le panneau qui monte. */
export const decalagePrise = (frame: number, debut: number) => (frame < debut ? 0 : 0.12 * monteePanneau(frame, debut));

export function PanneauFin({ frame, debut, palette, nom = "Williams Jullin", motCle, icones = ["crayon", "video", "globe", "tableur", "partage"] }: PanneauFinProps) {
  const { ACCENT_1 } = accents(palette);
  const i = frame - debut;
  if (i < 0) return null;
  const p = monteePanneau(frame, debut);
  const k0 = i - 5; // la cascade démarre à l'image 5
  const pop = (n: number) => 0.3 + 0.7 * ressort("POP", k0 - n);
  const vu = (n: number) => k0 - n >= 0;
  const taille = 110;
  const pas = 160;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `translateY(${(1 - p) * H}px)`, background: COULEURS.IVOIRE, zIndex: 700 }}>
      {vu(0) ? (
        <Pose x={W / 2} y={0.30 * H} echelle={pop(0) * tick(k0, 10)} z={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            {/* vrai logo de marque (public/demo/marque/logo.png) */}
            <Img src={mediaV4("marque/logo-axion.png")} style={{ width: 150, height: 150, boxSizing: "border-box", borderRadius: RAYON_LOGO, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, boxShadow: `8px 9px 0 0 ${COULEURS.ENCRE}`, transform: "rotate(-4deg)" }} />
            <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 112, letterSpacing: "0.01em", color: COULEURS.ENCRE, lineHeight: 1, whiteSpace: "nowrap" }}>AXION-IA</div>
          </div>
        </Pose>
      ) : null}
      {vu(1) ? (
        <Pose x={W / 2} y={0.41 * H} echelle={pop(1) * tick(k0, 10, 2)}>
          <div style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 84, color: COULEURS.ENCRE, lineHeight: 1, whiteSpace: "nowrap" }}>{nom}</div>
        </Pose>
      ) : null}
      {icones.map((ic, n) => {
        if (!vu(2 + n)) return null;
        const x = W / 2 + (n - (icones.length - 1) / 2) * pas;
        return (
          <Pose key={n} x={x} y={0.53 * H} rotation={n % 2 ? 3 : -3} echelle={pop(2 + n) * tick(k0, 10, 1 + n)}>
            <div style={{ width: taille, height: taille, boxSizing: "border-box", borderRadius: 14, background: COULEURS.BLANC, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, boxShadow: `5px 6px 0 0 ${COULEURS.ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom={ic} taille={78} couleur={COULEURS.ENCRE} epaisseur={2.2} />
            </div>
          </Pose>
        );
      })}
      {vu(2 + icones.length) ? (
        <Pose x={W / 2} y={0.71 * H} echelle={pop(2 + icones.length) * tick(k0, 10, 0, 0.06, 15)} rotation={-1.5}>
          <div style={{ width: 0.8 * W, boxSizing: "border-box", padding: "34px 30px", borderRadius: 10, background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${COULEURS.ENCRE}`, boxShadow: `8px 9px 0 0 ${COULEURS.ENCRE}`, fontFamily: MONTSERRAT, fontWeight: 900, color: COULEURS.ENCRE, whiteSpace: "nowrap", letterSpacing: "0.01em", lineHeight: 1.1, textAlign: "center" }}>
            <div style={{ fontSize: 60 }}>COMMENTEZ</div>
            <div style={{ fontSize: 88 }}>« {motCle} »</div>
          </div>
        </Pose>
      ) : null}
    </div>
  );
}
const RAYON_LOGO = 26;

export function bruitagesPanneauFin(debut: number): Bruitage[] {
  return [[debut / FPS, "montee", 0.7], [(debut + 5 + 7) / FPS, "confirmation_002", 0.35]];
}
/** Un événement par image de cascade (logo, nom, 5 outils, bouton) + la montée. */
export const evenementsPanneauFin = (d: number, nbIcones = 5, fin = d + 56) => [d, ...Array.from({ length: 2 + nbIcones + 1 }, (_, n) => d + 5 + n), ...gestesDeVie(14, fin - d).map((x) => d + x)];
