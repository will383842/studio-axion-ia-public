import type { ComponentType, ReactNode } from "react";
import type { TypeDecor } from "../../../../src/briques/visuels/registre-decor";
import { COULEURS } from "../commun/constantes";

export interface ProprietesDecor {
  /** Côté du dessin carré : nombre de px, ou longueur CSS (par exemple « 100% » pour remplir son conteneur carré). */
  taille: number | string;
  /** Fond sur lequel la forme est posée : sur l'orange, la forme passe en crème (une seule couleur d'accent). */
  sur?: "creme" | "orange";
}

/** Couleurs d'une forme : remplissage principal (orange, ou crème sur fond orange), second remplissage, contour d'encre. */
function couleurs(sur: "creme" | "orange" = "creme") {
  return { plein: sur === "orange" ? COULEURS.creme : COULEURS.orange, clair: sur === "orange" ? COULEURS.pale : COULEURS.creme, encre: COULEURS.encre };
}

const TRAIT = 8;

/** Cadre commun : dessin carré 200 × 200, décoratif, SANS texte. */
function Cadre({ taille, children }: { taille: number | string; children: ReactNode }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 200 200" role="img" aria-hidden>
      {children}
    </svg>
  );
}

const E01 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><circle cx="100" cy="100" r="88" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} /></Cadre>;
};
const E02 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><circle cx="100" cy="100" r="70" fill="none" stroke={c.plein} strokeWidth="34" /><circle cx="100" cy="100" r="88" fill="none" stroke={c.encre} strokeWidth={TRAIT / 2} /><circle cx="100" cy="100" r="52" fill="none" stroke={c.encre} strokeWidth={TRAIT / 2} /></Cadre>;
};
const E03 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><rect x="16" y="16" width="168" height="168" rx="40" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} /></Cadre>;
};
const E04 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M100 20 L184 176 H16 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E05 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M100 12 L188 100 L100 188 L12 100 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E06 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M76 16 H124 V76 H184 V124 H124 V184 H76 V124 H16 V76 H76 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E07 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M12 140 A88 88 0 0 1 188 140 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E08 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return (
    <Cadre taille={taille}>
      {[28, 78, 128].map((y, i) => (
        <rect key={y} x="16" y={y} width={168 - i * 36} height="44" rx="22" fill={i === 1 ? c.clair : c.plein} stroke={c.encre} strokeWidth={TRAIT} />
      ))}
    </Cadre>
  );
};
const E09 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return (
    <Cadre taille={taille}>
      {[0, 1, 2].flatMap((l) => [0, 1, 2].map((k) => <circle key={`${l}${k}`} cx={36 + k * 64} cy={36 + l * 64} r="20" fill={(l + k) % 2 === 0 ? c.plein : c.clair} stroke={c.encre} strokeWidth={TRAIT / 2} />))}
    </Cadre>
  );
};
const E10 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return (
    <Cadre taille={taille}>
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${24 + i * 48} 28 L${76 + i * 48} 100 L${24 + i * 48} 172`} fill="none" stroke={i === 1 ? c.encre : c.plein} strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Cadre>
  );
};
const E11 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return (
    <Cadre taille={taille}>
      {[0, 1].map((i) => (
        <path key={i} d={`M14 ${64 + i * 70} L57 ${24 + i * 70} L100 ${64 + i * 70} L143 ${24 + i * 70} L186 ${64 + i * 70}`} fill="none" stroke={i === 0 ? c.plein : c.encre} strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Cadre>
  );
};
const E12 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M16 184 V16 A168 168 0 0 1 184 184 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E13 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return (
    <Cadre taille={taille}>
      <circle cx="100" cy="100" r="88" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} />
      <circle cx="100" cy="100" r="58" fill={c.clair} stroke={c.encre} strokeWidth={TRAIT} />
      <circle cx="100" cy="100" r="26" fill={c.encre} />
    </Cadre>
  );
};
const E14 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M100 10 C108 66 134 92 190 100 C134 108 108 134 100 190 C92 134 66 108 10 100 C66 92 92 66 100 10 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};
const E15 = ({ taille, sur }: ProprietesDecor) => {
  const c = couleurs(sur);
  return <Cadre taille={taille}><path d="M100 12 L176 56 V144 L100 188 L24 144 V56 Z" fill={c.plein} stroke={c.encre} strokeWidth={TRAIT} strokeLinejoin="round" /></Cadre>;
};

/** Un composant par élément décoratif du registre (le typage et un test refusent tout oubli). */
export const COMPOSANTS_DECOR: Record<TypeDecor, ComponentType<ProprietesDecor>> = { E01, E02, E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15 };
