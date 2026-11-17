/**
 * ICÔNE ANIMÉE (C6-H18). PURE : aucun hook, aucun Remotion, aucune horloge ; l'image arrive en propriété. Imports relatifs seulement (lue par le rendu).
 * Aucun consommateur. Absorbe les sept gestes d'animation sans Lottie de S12-09 (AM-19).
 * Le tracé passe par le dessinateur de C9-02 (`TraceSvg`, `pathLength={1}`, jamais de filtre) ; les nœuds autres que `path` reçoivent les mêmes règles sur leur balise.
 * Les attributs de peinture des nœuds (fill, stroke, opacity) sont ignorés : la couleur vient du seul ton (règle 17 de E1), traduit par `tons.ts`.
 */
import type { JSX } from "react";
import type { FondAxion } from "../../jetons-motion";
import { DUREES, FPS_MOTION } from "../jetons";
import { courbe, mixer, progres } from "../courbes";
import { TraceSvg } from "../petits-objets/TraceSvg";
import { couleurDuTon } from "../petits-objets/tons";
import type { TonObjet } from "../petits-objets/contrat";
import { ICONES_BIBLIOTHEQUE, type NomIconeBibliotheque, type NoeudBibliotheque } from "./index";

export type AnimationIcone = "trace" | "pop" | "coche-dessinee" | "croix-barre" | "fleche-pousse" | "pulsation" | "duotone-remplissage";

export interface ProprietesIconeAnimee {
  nom: NomIconeBibliotheque;
  /** Image courante, depuis le début du geste. */
  image: number;
  fps: number;
  animation: AnimationIcone;
  ton: TonObjet;
  fond: FondAxion;
  /** Côté du carré, en px. */
  taille: number;
}

/** Décalage entre les deux traits de la croix (images). */
const DECALAGE_CROIX = 4;
const ENTREE_POP = 0.6;
const AMPLEUR_PULSATION = 0.08;
const PERIODE_PULSATION = 1;
const POUSSEE = 2;
const OPACITE_DUOTONE = 0.25;
/** Épaisseur de trait sur la grille de 24 (celle de `harmoniser.ts`). */
const TRAIT_GRILLE_24 = 2;

const borne01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
/** Aller-retour 0 → 1 → 0 sur [0, 1]. */
const aller = (p: number): number => 1 - Math.abs(2 * borne01(p) - 1);

function lireViewBox(vb: string): { x: number; y: number; l: number; h: number } {
  const n = vb.trim().split(/[\s,]+/).map(Number);
  if (n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0) return { x: n[0], y: n[1], l: n[2], h: n[3] };
  return { x: 0, y: 0, l: 24, h: 24 };
}

/** Attributs de géométrie seulement : on retire toute peinture portée par le nœud. */
function geometrie(attributs: Record<string, string>): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const [k, v] of Object.entries(attributs)) {
    if (k === "fill" || k === "opacity" || k.startsWith("stroke")) continue;
    sortie[k] = v;
  }
  return sortie;
}

function Noeud({ noeud, t, ton, fond, epaisseur, remplissage }: { noeud: NoeudBibliotheque; t: number; ton: TonObjet; fond: FondAxion; epaisseur: number; remplissage?: number }): JSX.Element {
  const [balise, attributs] = noeud;
  const couleur = couleurDuTon(ton, fond);
  const geo = geometrie(attributs);
  if (remplissage !== undefined) {
    const Balise = balise as "path";
    return <Balise {...geo} fill={couleur} fillOpacity={remplissage} stroke="none" />;
  }
  if (balise === "path") return <TraceSvg d={geo.d ?? ""} t={t} ton={ton} fond={fond} epaisseur={epaisseur} />;
  const Balise = balise as "circle";
  const k = borne01(t);
  return (
    <Balise
      {...geo}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - k}
      stroke={couleur}
      strokeWidth={epaisseur}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

export function IconeAnimee({ nom, image, fps, animation, ton, fond, taille }: ProprietesIconeAnimee): JSX.Element {
  const icone = ICONES_BIBLIOTHEQUE[nom];
  const cote = Number.isFinite(taille) && taille > 0 ? taille : 24;
  if (!icone) return <svg width={cote} height={cote} viewBox="0 0 24 24" aria-hidden="true" />;

  const cadence = Number.isFinite(fps) && fps > 0 ? fps : FPS_MOTION;
  const im = Number.isFinite(image) ? Math.max(0, image) : 0;
  const s = im / cadence;
  const vb = lireViewBox(icone.viewBox);
  const epaisseur = (TRAIT_GRILLE_24 * vb.l) / 24;
  const cx = vb.x + vb.l / 2;
  const cy = vb.y + vb.h / 2;

  /** Avancement du tracé du nœud `i`, `decalage` images après le précédent. */
  const trace = (i: number, duree: number, decalage = 0): number => progres(s - (i * decalage) / cadence, 0, duree);
  let echelle = 1;
  let dx = 0;
  let opaciteGroupe = 1;
  let tracePar = (_i: number): number => 1;
  let remplissage: number | undefined;

  switch (animation) {
    case "trace":
      tracePar = (i) => trace(i, DUREES.entree);
      break;
    case "coche-dessinee":
      tracePar = (i) => trace(i, DUREES.entreeCourte);
      break;
    case "croix-barre":
      tracePar = (i) => trace(i, DUREES.entreeCourte, DECALAGE_CROIX);
      break;
    case "pop": {
      const k = progres(s, 0, DUREES.entreeCourte);
      opaciteGroupe = k;
      echelle = mixer(ENTREE_POP, 1, k);
      break;
    }
    case "pulsation":
      echelle = 1 + AMPLEUR_PULSATION * courbe("douce")(aller((s % PERIODE_PULSATION) / PERIODE_PULSATION));
      break;
    case "fleche-pousse":
      dx = (POUSSEE * vb.l * courbe("douce")(aller(s / DUREES.entree))) / 24;
      break;
    case "duotone-remplissage":
      tracePar = (i) => trace(i, DUREES.entree);
      remplissage = OPACITE_DUOTONE * progres(s, 0, DUREES.entree);
      break;
  }

  const transform = `translate(${dx} 0) translate(${cx} ${cy}) scale(${echelle}) translate(${-cx} ${-cy})`;
  return (
    <svg width={cote} height={cote} viewBox={icone.viewBox} role="img" aria-label={nom} style={{ overflow: "visible" }}>
      <g transform={transform} opacity={opaciteGroupe}>
        {remplissage !== undefined &&
          icone.noeuds.map((n, i) => <Noeud key={`f${i}`} noeud={n} t={1} ton={ton} fond={fond} epaisseur={epaisseur} remplissage={remplissage} />)}
        {icone.noeuds.map((n, i) => (
          <Noeud key={i} noeud={n} t={tracePar(i)} ton={ton} fond={fond} epaisseur={epaisseur} />
        ))}
      </g>
    </svg>
  );
}
