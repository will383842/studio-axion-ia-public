import React from "react";
/**
 * Pile des AUTRES chiffres du bandeau, sous la variante (qui a rapetissé vers le haut) : chacun claque sur son mot,
 * avec sa légende, comme le compteur de référence (« 80 % » compte de 0 à 80, « 24h/24 » claque tel quel). Couleur
 * du texte de la charte : le seul mot orange de l'écran reste le chiffre de la variante.
 */
import type { DonneesEcranChiffresRendu } from "./donnees";
import { ANTON, c01, doux, encre, INTER, progres, rebond, tailleAnton, type CadreChiffres } from "./outils";

/** Hauteur d'une rangée de la pile (chiffre-clé de 112 px, ≥ 96). */
export const RANGEE_PILE = 132;
const COL_CHIFFRE = 500;

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
  return d.chiffres
    .map((c, i) => ({ c, i }))
    .filter((x) => x.i !== d.focal)
    .map((x, j) => ({ ...x, y: haut + j * r, hauteur: r, taille: Math.max(96, Math.min(112, r * 0.9, tailleAnton(x.c.texte, COL_CHIFFRE, 112))) }));
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
      {planPile(d, cadre, t, tailleFocale).map(({ c, i, y, hauteur, taille }) => {
        const x = progres(t, c.t, 0.32);
        const opacite = c01(x * 4);
        if (opacite <= 0) return null;
        return (
          <div key={i} style={{ position: "absolute", left: 72, top: y, width: 936, height: hauteur, display: "flex", alignItems: "center", gap: 36 }}>
            <div style={{ width: COL_CHIFFRE, flex: "none", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ ...ANTON, fontSize: taille, color: encre(d.fond), whiteSpace: "nowrap", opacity: opacite, transform: `scale(${1.6 - 0.6 * rebond(x)})`, transformOrigin: "100% 50%" }}>{compte(c.texte, progres(t, c.t, 0.7))}</div>
            </div>
            {c.legende ? <div style={{ ...INTER, fontSize: 60, color: encre(d.fond), opacity: progres(t, c.t + 0.15, 0.35), maxWidth: 400 }}>{c.legende}</div> : null}
          </div>
        );
      })}
    </>
  );
}
