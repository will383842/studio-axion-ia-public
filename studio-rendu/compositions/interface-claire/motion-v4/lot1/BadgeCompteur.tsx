import React from "react";
/**
 * 3. BadgeCompteur — titre + rangée de tuiles (pictogrammes) + compteur sur plaque ACCENT_2 qui défile jusqu'à la valeur DITE.
 * Gabarit M1, 0,72 L × 0,13 H. Déroulé (images depuis i0) : 0 plaque-titre s'étire · 3-9 tuiles en cascade (2 i) · 6 compteur défile
 * (12 i) puis CLAQUE · `inversion` : sur le mot de rupture (« zéro ») la plaque passe ENCRE, les tuiles passent GRIS (3 i) et le compteur redescend.
 */
import { Easing, useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, MONTSERRAT, Picto, Plaque, Son, Tuile, W, accents, courbe, entreeEtire, entreePop, lerp, melange, ressort, hauteurPlaque, facteurSortie } from "./commun-lot1";
import type { NomPicto, Palette } from "./commun-lot1";

export type BadgeCompteurProps = {
  palette: Palette;
  titre: string;
  pictos: NomPicto[];
  /** Valeur dite (le compteur défile de 0 à cette valeur). */
  valeur: number;
  /** Rupture : à l'image `a`, le compteur redescend à `valeur` (ex. 0 au mot « zéro »), plaque ENCRE, tuiles GRIS. */
  inversion?: { a: number; valeur: number };
  /** Image du début du défilement (défaut 6). */
  debutCompteur?: number;
  sortie?: number;
  muet?: boolean;
};
export const DUREE_DEFAUT = 66;
export const evenements = (p: Pick<BadgeCompteurProps, "pictos" | "inversion" | "sortie" | "debutCompteur">): number[] => {
  const e = [0, ...p.pictos.map((_, k) => 3 + 2 * k)];
  const d = p.debutCompteur ?? 6;
  e.push(d, d + 12);
  if (p.inversion) e.push(p.inversion.a, p.inversion.a + 12);
  e.push(p.sortie ?? 60);
  return e;
};
const nombre = (v: number) => Math.round(v).toLocaleString("fr-FR").replace(/[  ]/g, " ");

export function BadgeCompteur({ palette, titre, pictos, valeur, inversion, debutCompteur = 6, sortie = 60, muet }: BadgeCompteurProps) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const g = facteurSortie(i, sortie);
  if (i >= sortie + 3) return null;
  // compteur
  const monte = courbe(i, debutCompteur, 12, Easing.out(Easing.cubic));
  let v = valeur * monte;
  const inv = inversion ? courbe(i, inversion.a, 3) : 0;
  if (inversion) v = i >= inversion.a ? lerp(valeur, inversion.valeur, courbe(i, inversion.a, 12, Easing.out(Easing.cubic))) : v;
  const claque = 1 + 0.12 * (1 - Math.min(1, ressort("CLAQUE", i - (debutCompteur + 12)))) * (i >= debutCompteur + 12 ? 1 : 0) + (inversion ? 0.12 * (1 - Math.min(1, ressort("CLAQUE", i - (inversion.a + 12)))) * (i >= inversion.a + 12 ? 1 : 0) : 0);
  const fondCompteur = melange(ACCENT_2, COULEURS.ENCRE, inv);
  const texteCompteur = melange(COULEURS.ENCRE, ACCENT_1, inv);
  const corpsTitre = 40;
  const tuile = 92;
  const largeur = 0.8 * W;
  const hauteurGauche = hauteurPlaque(corpsTitre) + 14 + tuile;
  const top = BAS_M1 - hauteurGauche;
  const titreEtat = entreeEtire(i);
  const comptPop = entreePop(i - 4, { incl: 1.5, nom: "CLAQUE" });
  return (
    <>
      <div style={{ position: "absolute", left: (W - largeur) / 2, top, width: largeur, height: hauteurGauche, transform: `scale(${g})`, transformOrigin: "50% 100%" }}>
        <Anim etat={titreEtat} origine="0% 50%" style={{ position: "absolute", left: 0, top: 0, transform: "rotate(-2deg)" }}>
          <Plaque fond={ACCENT_1} corps={corpsTitre} interl={0.03}>{titre}</Plaque>
        </Anim>
        <div style={{ position: "absolute", left: 0, top: hauteurPlaque(corpsTitre) + 14, display: "flex", gap: 14 }}>
          {pictos.map((p, k) => {
            const etat = entreePop(i - (3 + 2 * k), { incl: k % 2 ? 2 : -2 });
            return (
              <Anim key={k} etat={etat}>
                <Tuile taille={tuile} fond={melange(COULEURS.BLANC, COULEURS.GRIS, inv)}><Picto nom={p} taille={58} fond={melange(ACCENT_1, COULEURS.GRIS, inv)} /></Tuile>
              </Anim>
            );
          })}
        </div>
        <Anim etat={comptPop} origine="100% 50%" style={{ position: "absolute", right: 0, bottom: 0 }}>
          <div style={{ transform: `scale(${claque})`, transformOrigin: "100% 50%" }}>
            <Plaque fond={fondCompteur} texte={texteCompteur} corps={108} ombreT="M" interl={0} lisere={inv > 0.5}>
              <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: `${MONTSERRAT}, sans-serif` }}>{nombre(v)}</span>
            </Plaque>
          </div>
        </Anim>
      </div>
      {!muet && Array.from({ length: 6 }, (_, k) => <Son key={k} t={debutCompteur + 2 * k} fichier="tick_001" volume={0.18} />)}
      {!muet && <Son t={debutCompteur + 12} fichier="ding-3" volume={0.2} />}
      {!muet && inversion && <Son t={inversion.a} fichier="drop_002" volume={0.22} />}
    </>
  );
}
