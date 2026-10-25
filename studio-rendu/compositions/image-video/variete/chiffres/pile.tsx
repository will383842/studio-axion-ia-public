import React from "react";
/**
 * Pile des AUTRES chiffres du bandeau, sous la variante (qui a rapetissé vers le haut) : chacun claque sur son mot,
 * avec sa légende, comme le compteur de référence (« 80 % » compte de 0 à 80, « 24h/24 » claque tel quel). Couleur
 * du texte de la charte : le seul mot orange de l'écran reste le chiffre de la variante.
 */
import { largeurTexte } from "../../../../../src/briques/ecrans-motion/mesure";
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";
import type { DonneesEcranChiffresRendu } from "./donnees";
import { ANTON, c01, doux, encre, INTER, progres, rebond, scinderChiffre, tailleAnton, type CadreChiffres } from "./outils";

/** Hauteur d'une rangée de la pile (chiffre-clé de 112 px, ≥ 96). */
export const RANGEE_PILE = 132;
/** Borne de TAILLE des chiffres de la pile (la colonne réelle se mesure dans `planPile`, voir D2 de compositions-iv/11). */
const COL_CHIFFRE = 500;
/** Écart entre le chiffre et sa légende, et largeur utile d'une rangée. */
const ECART_RANGEE = 36;
const LARGEUR_RANGEE = 936;

/** Rangées arrivées à l'instant `t` (0 → n, continu : chaque rangée s'ouvre 0,4 s avant son mot). */
export function rangeesOuvertes(d: DonneesEcranChiffresRendu, t: number): number {
  return d.chiffres.reduce((n, c, i) => (i === d.focal ? n : n + doux(progres(t, c.t - 0.4, 0.4))), 0);
}

/** Le chiffre focal reste le point focal de l'écran une fois rangé : ≥ 230 px (standard 74 § 1). */
export const FOCAL_MIN_PX = 232;

/**
 * Hauteur d'une rangée de la pile : 132 px, moins si la variante ne peut pas rapetisser assez sans que son chiffre
 * passe sous 230 px (`tailleFocale` : sa taille à l'échelle 1).
 */
function rangeePile(d: DonneesEcranChiffresRendu, cadre: CadreChiffres, tailleFocale: number): number {
  const n = d.chiffres.length - 1;
  const h = cadre.bas - cadre.haut;
  const min = Math.min(1, FOCAL_MIN_PX / tailleFocale);
  return n > 0 ? Math.min(RANGEE_PILE, (h * (1 - min) - 16) / n) : RANGEE_PILE;
}

/** Échelle de la variante quand `k` rangées sont ouvertes : elle rapetisse vers le haut et leur laisse la place. */
export function echelleVariante(d: DonneesEcranChiffresRendu, cadre: CadreChiffres, k: number, tailleFocale: number): number {
  const h = cadre.bas - cadre.haut;
  return (h - k * rangeePile(d, cadre, tailleFocale) - (k > 0 ? 16 * Math.min(1, k) : 0)) / h;
}

/** Rangées de la pile, dans l'ordre du bandeau, juste sous la variante. */
export function planPile(d: DonneesEcranChiffresRendu, cadre: CadreChiffres, t: number, tailleFocale: number) {
  const k = rangeesOuvertes(d, t);
  const r = rangeePile(d, cadre, tailleFocale);
  const haut = cadre.haut + (cadre.bas - cadre.haut) * echelleVariante(d, cadre, k, tailleFocale) + 16;
  const rangees = d.chiffres
    .map((c, i) => ({ c, i }))
    .filter((x) => x.i !== d.focal)
    .map((x, j) => ({ ...x, y: haut + j * r, hauteur: r, taille: Math.max(96, Math.min(112, r * 0.9, tailleAnton(scinderChiffre(x.c.texte, x.c.legende).texte, COL_CHIFFRE, 112))) }));
  // D2 (compositions-iv/11) : le groupe « chiffre + légende » se centre sur x = 540. La colonne du chiffre colle au plus large
  // des chiffres (plus 500 px fixes), la légende garde sa largeur réelle (sur une ligne tant qu'elle tient), puis le groupe est centré.
  const colChiffre = Math.ceil(Math.max(0, ...rangees.map(({ c, taille }) => largeurAnton(scinderChiffre(c.texte, c.legende).texte, taille))));
  const largeurLegende = Math.max(0, ...rangees.map(({ c }) => { const l = scinderChiffre(c.texte, c.legende).legende; return l ? largeurTexte(l, "inter-gras", 60) : 0; }));
  const colLegende = largeurLegende > 0 ? Math.min(LARGEUR_RANGEE - colChiffre - ECART_RANGEE, Math.ceil(largeurLegende) + 4) : 0;
  const x0 = Math.round(540 - (colChiffre + (colLegende > 0 ? ECART_RANGEE + colLegende : 0)) / 2);
  return rangees.map((x) => ({ ...x, x0, colChiffre, colLegende }));
}

/** « 80 % » compte de 0 à 80 ; un chiffre composé (« 24h/24 ») claque tel quel. */
function compte(texte: string, avance: number): string {
  const m = /^(\D*?)(\d+)(\D*)$/.exec(texte);
  if (!m) return texte;
  const v = Number(m[2]);
  if (!(v > 1)) return texte;
  return `${m[1]}${Math.round(v * (1 - Math.pow(1 - c01(avance), 3)))}${m[3]}`;
}

export function Pile({ d, t, cadre, tailleFocale }: { d: DonneesEcranChiffresRendu; t: number; cadre: CadreChiffres; tailleFocale: number }) {
  return (
    <>
      {planPile(d, cadre, t, tailleFocale).map(({ c, i, y, hauteur, taille, x0, colChiffre, colLegende }) => {
        const x = progres(t, c.t, 0.32);
        const opacite = c01(x * 4);
        if (opacite <= 0) return null;
        const { texte, legende } = scinderChiffre(c.texte, c.legende);
        return (
          <div key={i} style={{ position: "absolute", left: x0, top: y, width: colChiffre + (colLegende > 0 ? ECART_RANGEE + colLegende : 0), height: hauteur, display: "flex", alignItems: "center", gap: ECART_RANGEE }}>
            <div style={{ width: colChiffre, flex: "none", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ ...ANTON, fontSize: taille, color: encre(d.fond), whiteSpace: "nowrap", opacity: opacite, transform: `scale(${1.6 - 0.6 * rebond(x)})`, transformOrigin: "100% 50%" }}>{compte(texte, progres(t, c.t, 0.7))}</div>
            </div>
            {legende ? <div style={{ ...INTER, lineHeight: 1.05, fontSize: 60, color: encre(d.fond), opacity: progres(t, c.t + 0.15, 0.35), maxWidth: colLegende }}>{legende}</div> : null}
          </div>
        );
      })}
    </>
  );
}
