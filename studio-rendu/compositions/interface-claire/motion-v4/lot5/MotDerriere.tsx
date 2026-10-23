import React from "react";
/**
 * ÉLÉMENT 35 ★ `MotDerriere` (standard DA v4, lot 5). Re-habillé : lettres ACCENT_1 à contour ENCRE 10 px et ombre dure L.
 * Un mot dit (≤ 8 lettres) en Montserrat 900, ≈ 0,9-1,0 L de large, au-dessus de la tête de Will (gabarit M1, prise à D1).
 * REPLI DOCUMENTÉ : le détourage de Will n'est pas disponible dans ce dépôt (aucun masque vidéo). La fiche prévoit alors : le mot passe
 * AU-DESSUS de la tête (y 0,03 → 0,18 H), sans chevauchement. Le code accepte déjà une zone `masque` (voir propriétés) : à brancher
 * quand le détourage existe ; ici elle reste vide.
 * Déroulé (i0 = mot dit) : lettres qui montent depuis une ligne de sol sous le mot (clip : jamais dans la zone du visage), 1 i par lettre (POP) · défilement latéral 0,15 % L/i ·
 * à +0,5 s une lettre clé passe ACCENT_2 (3 i) · 0,5 s plus tard une vague de « pop » traverse les lettres · sortie : lettres qui retombent en cascade de 1 i.
 * Durée 1,2-2,2 s. Son : `whoosh-in` grave (`sons/whoosh-grave.wav`, synthèse maison).
 */
import { accents, Bruitage, courbe, lerp, COULEURS, FPS, H, largeurTexte, MONTSERRAT, melange, Palette, ressort, W, contourTexte } from "./commun-lot5";
import { Easing } from "remotion";

export const ID_MOT_DERRIERE = "mot-derriere";
export const DUREE_MOT_DERRIERE = 48; // 1,6 s

export type MotDerriereProps = { frame: number; debut: number; palette: Palette; mot: string; /** Index de la lettre clé qui passe ACCENT_2 à +0,5 s. */ lettreCle?: number; duree?: number };

export function MotDerriere({ frame, debut, palette, mot, lettreCle = 2, duree = DUREE_MOT_DERRIERE }: MotDerriereProps) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const lettres = mot.split("");
  // Corps : le mot fait ≈ 0,92 L de large, au plus 380 px.
  const corps = Math.min(380, (0.76 * W * 100) / largeurTexte(mot, 100, -0.01)); // 0,76 L + contour = 0,06 → 0,94 L, jamais au bord
  const iSortie = duree - 3 - lettres.length; // la cascade de chute finit à `duree`
  const derive = lerp(-0.02 * W, 0.02 * W, courbe(i, 0, duree)); // défilement latéral continu de 0,04 L, borné : jamais de lettre au bord
  let x = -largeurTexte(mot, corps, -0.01) / 2;
  const iCle = 15 + lettres.length;
  const iVague0 = lettres.length + 7; // vagues de « pop » sur toutes les lettres (1 i d'écart), une toutes les 12 i : aucun temps mort
  const iVague = iVague0 + 12 * Math.max(0, Math.floor((i - iVague0) / 12));
  return (
    <div style={{ position: "absolute", left: W / 2 + derive, top: 0.12 * H, width: 0, height: 0, zIndex: 40, clipPath: `inset(${-0.9 * corps}px ${-W}px ${-(0.34 * corps + 14)}px ${-W}px)` }}>
      {/* Le clip fixe une « ligne de sol » sous le mot : les lettres en sortent en montant et y retombent, sans jamais entrer dans la zone du visage. */}
      {lettres.map((l, n) => {
        const lw = largeurTexte(l, corps, -0.01);
        const x0 = x;
        x += lw;
        const k = i - n; // 1 i par lettre
        const mont = ressort("POP", k);
        const kF = i - (iSortie + n);
        const chute = kF >= 0 ? courbe(kF + 1, 0, 3, Easing.in(Easing.cubic)) : 0;
        const couleur = n === lettreCle ? melange(ACCENT_1, ACCENT_2, courbe(i, iCle, 3)) : ACCENT_1;
        const pop = (n === lettreCle ? 1 + 0.12 * Math.sin(Math.PI * courbe(i, iCle, 6)) : 1) * (1 + 0.09 * Math.sin(Math.PI * courbe(i, iVague + n, 5)));
        if (k < 0 || chute >= 1) return null;
        return (
          <div key={n} style={{ position: "absolute", left: x0, top: -corps * 0.5, width: lw, height: corps, transform: `translateY(${(1 - mont) * corps * 0.55 + chute * 0.9 * corps}px) rotate(${chute * (n % 2 ? 9 : -9)}deg) scale(${(0.6 + 0.4 * mont) * pop})`, transformOrigin: "center bottom", opacity: Math.min(1, k / 2), filter: `drop-shadow(11px 12px 0 ${COULEURS.ENCRE})` }}>
            <span style={{ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, letterSpacing: "-0.01em", color: couleur, whiteSpace: "nowrap", ...contourTexte(corps, COULEURS.ENCRE, 0.1 * 2) }}>{l}</span>
          </div>
        );
      })}
    </div>
  );
}

export function bruitagesMotDerriere(debut: number): Bruitage[] {
  return [[debut / FPS, "whoosh-grave", 0.6]];
}
export const evenementsMotDerriere = (d: number, n = 5, duree = DUREE_MOT_DERRIERE) => {
  const vagues: number[] = [];
  for (let v = n + 7; v < duree - 3 - n; v += 12) vagues.push(d + v);
  return [d, d + 2, d + n, d + 15 + n, ...vagues, d + duree - 3 - n];
};
