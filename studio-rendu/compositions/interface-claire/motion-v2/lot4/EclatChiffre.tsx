import React from "react";
/**
 * ÉLÉMENT 17 « ÉCLAT-CHIFFRE » = coup de poing P5 (lot 4 « Impact / énergie », standard DA v2 § C et § D).
 *  - Emplacement E7 (plein écran), formes F7 (aplat encre grainé 5 %) + F5 géant (éclat orange de 16 branches, 1,3 L de
 *    diamètre, plus grand que le cadre), mouvement P5.
 *  - UNIQUEMENT pour un chiffre DIT par Will (`valeur`, `unite`) : le compteur DÉFILE de 0 jusqu'au chiffre dit, en
 *    ralentissant. Jamais de chiffre inventé. À n'utiliser qu'à partir de 10 s de vidéo (visage totalement couvert).
 *  - Chorégraphie (images depuis i0, 30 i/s) : i0 coupe franche ; éclat 0,3 → 1 (JAILLIR, rotation −30° → 0, puis 1°/i) ;
 *    i0-i12 compteur qui défile ; i12 arrivée (1,15 → 1 CLAQUER, secousse de l'élément, 10 éclats sable et ivoire) ;
 *    i14-i19 l'unité glisse depuis la droite (étirement de 6 % + 2 copies fantômes) ; i20-i30 pose ;
 *    i31-i35 sortie par ASPIRATION (le tout rétrécit en iris vers le centre, rotation +90°, ease-in cubique).
 *  - Visage : COUVERT en entier à l'état posé ; en sortie, au plus 2 images de recouvrement partiel (tolérance de 3).
 *  - Prise : jamais touchée. Bruitage : drop_002 + eclats à l'arrivée (i12).
 */
import { COULEURS, POLICES } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { alea, BruitageMotion, borne, cheminEtoile, FPS, freinCubique, Grain, lerp, ressort, secousse, sortieCubique } from "./outils4";

export type DonneesEclatChiffre = {
  debut: number;
  /** Fin de la sortie (s). Durée conseillée : 1 à 1,4 s. */
  fin: number;
  /** Le chiffre DIT par Will. */
  valeur: number;
  /** Unité dite (« min », « h »). */
  unite?: string;
};

export const FICHE_ECLAT_CHIFFRE = Object.freeze({
  id: "eclat-chiffre",
  nom: "Éclat-chiffre",
  lot: 4,
  emplacement: "E7" as const,
  forme: "F7+F5" as const,
  mouvement: "P5" as const,
  sortie: "aspiration" as const,
  visage: "couvert" as const,
  dureeMin: 1.0,
  dureeMax: 1.4,
  quandUtiliser: "Un chiffre dit et important (« 45 minutes »). Jamais sans chiffre dit ; jamais avant 10 s.",
});

/** 45 minutes : Will le dit dans la vidéo 1 (« 45 min » y figure déjà). */
export const EXEMPLE_ECLAT_CHIFFRE: DonneesEclatChiffre = { debut: 0.1, fin: 0.1 + 36 / FPS, valeur: 45, unite: "min" };
export const INSTANTS_ECLAT_CHIFFRE = [0, 3, 8, 13, 24] as const;

const ARRIVEE = 12;
const SORTIE = 31;

export function EclatChiffre({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_ECLAT_CHIFFRE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesEclatChiffre }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const k = (t - d.debut) * FPS;
  if (k < 0 || k >= SORTIE + 4.5) return null;
  const cx = W / 2;
  const cy = H * 0.5;

  // Sortie : iris qui se referme (aspiration) + rotation de +90° du contenu.
  const u = borne((k - SORTIE) / 4, 0, 1);
  const asp = sortieCubique(u);
  const rIris = (1 - asp) * Math.hypot(W, H) * 0.52;
  const contenu = 1 - asp;
  const rotSortie = 90 * asp;

  // Éclat géant : 0,3 → 1 (JAILLIR), rotation −30° → 0, puis 1°/image.
  const sE = ressort(k + 1, "JAILLIR");
  const echelleEclat = lerp(0.3, 1, sE);
  const rotEclat = lerp(-30, 0, sE) + Math.max(0, k - 6) * 1;

  // Compteur : défile de 0 à la valeur dite (ralentit), arrivée CLAQUER à i12.
  const defil = freinCubique(k / ARRIVEE);
  const valeurAff = k >= ARRIVEE ? d.valeur : Math.round(d.valeur * defil);
  const m = k - ARRIVEE;
  const claque = m >= 0 ? lerp(1.15, 1, ressort(m, "CLAQUER")) : 1;
  const dxSecousse = secousse(m, 0.012 * W);

  const texteChiffre = String(valeurAff);
  const tailleChiffre = Math.min(W * 0.78 / Math.max(1.2, texteChiffre.length * 0.66), H * 0.34);
  const tailleUnite = tailleChiffre * 0.42;

  // Unité : glisse depuis la droite i14 → i19 (étirement 6 % et 2 copies fantômes dans les 3 premières images).
  const kU = k - 14;
  const pU = kU <= 0 ? 0 : 1 - (1 - borne(kU / 5, 0, 1)) ** 3;
  const unite = d.unite?.toUpperCase();
  const posU = (p: number) => lerp(W * 0.62, 0, p);

  // Dix éclats sable et ivoire à l'arrivée (M7 : frein 0,86, gravité 0,002 H/i²).
  const eclats = m >= 0 && m < 14 ? Array.from({ length: 10 }, (_, j) => {
    const ang = (j / 10) * 2 * Math.PI + alea(j + 3) * 0.5;
    const v = (0.025 + 0.02 * alea(j * 2.3 + 1)) * W;
    // position = somme géométrique de la vitesse freinée (0,86^n) + chute
    const dist = (v * (1 - Math.pow(0.86, m + 1))) / (1 - 0.86);
    const x = cx + Math.cos(ang) * dist;
    const y = cy - H * 0.02 + Math.sin(ang) * dist + 0.5 * 0.002 * H * m * m;
    const r = (0.012 + 0.016 * alea(j * 5.1)) * W;
    const op = m <= 8 ? 1 : 1 - borne((m - 8) / 6, 0, 1);
    const rot = m * (15 + 25 * alea(j + 9)) * (j % 2 ? 1 : -1);
    return <polygon key={j} points={`0,${-r * 1.4} ${r},${r} ${-r},${r * 0.8}`} transform={`translate(${x} ${y}) rotate(${rot})`} fill={j % 3 ? COULEURS.sable : COULEURS.ivoire} opacity={op} />;
  }) : null;

  const contour = tailleChiffre * 0.04;
  const nombreX = cx + dxSecousse;
  const nombreY = cy + tailleChiffre * 0.08;
  const ghosts = kU > 0 && kU < 3 ? [1, 2] : [];
  const unite_y = nombreY + tailleChiffre * 0.78;
  const etire = kU > 0 && kU < 3 ? 1.06 : 1;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <defs>
        <clipPath id="ec-iris">
          <circle cx={cx} cy={cy} r={Math.max(0.01, rIris)} />
        </clipPath>
      </defs>
      <g clipPath={k >= SORTIE ? "url(#ec-iris)" : undefined}>
        <rect x={0} y={0} width={W} height={H} fill={COULEURS.encre} />
        <Grain W={W} H={H} id="ec-grain" opacite={0.035} clair />
        <g transform={`translate(${cx} ${cy}) rotate(${rotSortie}) scale(${contenu}) translate(${-cx} ${-cy})`}>
          <g transform={`translate(${dxSecousse} 0)`}>
            <g transform={`translate(${cx} ${cy}) rotate(${rotEclat}) scale(${echelleEclat})`}>
              <path d={cheminEtoile(16, 0.65 * W, { vallee: 0.72, court: 0.8, graine: 11 })} fill={COULEURS.encre} transform={`translate(${0.012 * W} ${0.012 * W})`} />
              <path d={cheminEtoile(16, 0.65 * W, { vallee: 0.72, court: 0.8, graine: 11 })} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={0.006 * W} strokeLinejoin="round" />
            </g>
          </g>
          {eclats}
          <g transform={`translate(${nombreX} ${nombreY}) rotate(-4) scale(${claque}) translate(${-nombreX} ${-nombreY})`}>
            <text x={nombreX + tailleChiffre * 0.03} y={nombreY + tailleChiffre * 0.03} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleChiffre} fill={COULEURS.encre} style={{ fontVariantNumeric: "tabular-nums" }}>{texteChiffre}</text>
            <text x={nombreX} y={nombreY} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleChiffre} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={contour * 2} paintOrder="stroke fill" strokeLinejoin="round" style={{ fontVariantNumeric: "tabular-nums" }}>{texteChiffre}</text>
          </g>
          {unite && kU > -0.5 ? (
            <>
              {ghosts.map((g) => (
                <text key={g} x={cx + posU(Math.max(0, pU - g * 0.18))} y={unite_y} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleUnite} fill={COULEURS.ivoire} opacity={g === 1 ? 0.3 : 0.15}>{unite}</text>
              ))}
              <g transform={`translate(${cx + posU(pU)} ${unite_y}) scale(${etire} 1)`}>
                <text x={tailleUnite * 0.04} y={tailleUnite * 0.04} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleUnite} fill={COULEURS.encre}>{unite}</text>
                <text x={0} y={0} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleUnite} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={tailleUnite * 0.14} paintOrder="stroke fill" strokeLinejoin="round">{unite}</text>
              </g>
            </>
          ) : null}
        </g>
      </g>
    </svg>
  );
}

/** Bruitage : drop_002 + eclats à l'arrivée du chiffre (i12). */
export function bruitagesEclatChiffre(d: DonneesEclatChiffre = EXEMPLE_ECLAT_CHIFFRE): BruitageMotion[] {
  const a = d.debut + ARRIVEE / FPS;
  return [[d.debut, "whoosh-in", 0.08], [a, "drop_002", 0.14], [a + 0.02, "eclats", 0.1]];
}
