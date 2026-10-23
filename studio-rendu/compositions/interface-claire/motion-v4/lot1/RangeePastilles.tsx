import React from "react";
/**
 * 6. RangeePastilles — cascade de 3 à 8 pastilles carrées (88 px, rayon 14) : chiffres 1…n ou pictogrammes ; titre court au-dessus (« LES 6 ÉTAPES »).
 * Gabarit M1, largeur ≤ 0,86 L. Déroulé : 0 titre pop · 4 pastilles en cascade de 2 i (BLANC, chiffre ENCRE) · `actives` la pastille 1 (puis 2, 3…) passe ACCENT_1
 * (recoloration 3 i) · `sortie` cascade inverse de rétrécissement, 1 i par pastille.
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, MONTSERRAT, Picto, Plaque, Son, Tuile, W, accents, courbe, entreePop, largeurTexte, melange } from "./commun-lot1";
import type { NomPicto, Palette } from "./commun-lot1";

export type RangeePastillesProps = {
  palette: Palette;
  titre: string;
  /** Contenus : chiffres (texte) ou pictogrammes. Défaut : 1…`nb`. */
  contenus?: Array<string | { picto: NomPicto }>;
  nb?: number;
  /** Images des mots « la première », « la deuxième »… : la pastille k passe ACCENT_1 (recoloration 3 i) à `actives[k]`. */
  actives?: number[];
  /** Image du début de la sortie (cascade inverse). */
  sortie?: number;
  muet?: boolean;
};
export const DUREE_DEFAUT = 54;
const liste = (p: Pick<RangeePastillesProps, "contenus" | "nb">) => p.contenus ?? Array.from({ length: p.nb ?? 6 }, (_, k) => String(k + 1));
/** Vrai pour un contenu qui tient dans la pastille carrée : chiffre, très court texte (≤ 2 caractères) ou pictogramme. */
const estCourt = (c: string | { picto: NomPicto }) => typeof c !== "string" || c.length <= 2;
/**
 * Mesure la rangée : pastille carrée (`taille`) pour un chiffre ou un picto ; pour un mot, pastille élargie à son texte en capitales
 * (+ marge de chaque côté), le corps diminuant de 2 en 2 (jusqu'à 34) tant que la rangée dépasse `largeurMax`, puis (dernier recours) jusqu'à 16 pour ne jamais dépasser W − 80. PURE (testée).
 */
export function mesurerPastilles(items: Array<string | { picto: NomPicto }>, { taille = 100, ecart, largeurMax = 0.86 * W }: { taille?: number; ecart: number; largeurMax?: number }): { corps: number; largeurs: number[]; largeurRangee: number } {
  let corps = 58;
  const calcul = (cp: number) => items.map((c) => (estCourt(c) ? taille : Math.max(taille, Math.ceil(largeurTexte((c as string).toUpperCase(), cp)) + 2 * Math.round(0.3 * cp))));
  const total = (ls: number[]) => ls.reduce((s, l) => s + l, 0) + (ls.length - 1) * ecart;
  let largeurs = calcul(corps);
  while (total(largeurs) > largeurMax && corps > 34) {
    corps -= 2;
    largeurs = calcul(corps);
  }
  // Dernier recours (mots très longs) : sous 34, jamais plus large que l'écran moins une marge de 40 px de chaque côté.
  const bord = W - 2 * 40;
  while (total(largeurs) > bord && corps > 16) {
    corps -= 2;
    largeurs = calcul(corps);
  }
  return { corps, largeurs, largeurRangee: total(largeurs) };
}
export const evenements = (p: Pick<RangeePastillesProps, "contenus" | "nb" | "actives" | "sortie">): number[] => {
  const n = liste(p).length;
  const e = [0, ...Array.from({ length: n }, (_, k) => 4 + 2 * k), ...(p.actives ?? [22]), p.sortie ?? 42];
  return e.sort((a, b) => a - b);
};

export function RangeePastilles({ palette, titre, contenus, nb, actives = [22], sortie = 42, muet }: RangeePastillesProps) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const items = liste({ contenus, nb });
  const n = items.length;
  const taille = 100;
  const ecart = n > 6 ? 10 : 14;
  const decal = (k: number) => Math.round((n - 1 - k) * 0.4); // cascade serrée : sortie totale ≤ 5 i
  const sortieTitre = sortie + decal(-1); // le titre part en dernier
  if (i >= sortieTitre + 3) return null;
  const { corps, largeurs, largeurRangee } = mesurerPastilles(items, { taille, ecart });
  return (
    <>
      <div style={{ position: "absolute", left: (W - largeurRangee) / 2, top: BAS_M1 - taille - 12 - 88, width: largeurRangee }}>
        <Anim etat={entreePop(i, { incl: -2.5, sortie: sortieTitre })} origine="0% 100%" style={{ display: "inline-block", marginBottom: 12 }}>
          <Plaque fond={ACCENT_1} corps={52} interl={0.02}>{titre}</Plaque>
        </Anim>
        <div style={{ display: "flex", gap: ecart }}>
          {items.map((c, k) => {
            const etat = entreePop(i - (4 + 2 * k), { incl: k % 2 ? 2 : -2, sortie: sortie + decal(k) - (4 + 2 * k), nSortie: 3 });
            const fond = actives[k] !== undefined ? melange(COULEURS.BLANC, ACCENT_1, courbe(i, actives[k], 3)) : COULEURS.BLANC;
            return (
              <Anim key={k} etat={etat}>
                <Tuile taille={taille} fond={fond} style={{ width: largeurs[k] }}>
                  {typeof c === "string" ? <span style={{ fontFamily: `${MONTSERRAT}, sans-serif`, fontWeight: 900, fontSize: corps, textTransform: "uppercase", color: COULEURS.ENCRE, lineHeight: 1 }}>{c}</span> : <Picto nom={c.picto} taille={62} fond={ACCENT_1} />}
                </Tuile>
              </Anim>
            );
          })}
        </div>
      </div>
      {!muet && items.map((_, k) => (k % 2 === 0 ? <Son key={k} t={4 + 2 * k} fichier="tick_002" volume={0.12} /> : null))}
    </>
  );
}
