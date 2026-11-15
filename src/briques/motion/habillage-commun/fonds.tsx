/**
 * FONDS VIVANTS PURS aux couleurs de la charte (C6-H5, AM-03). Rien ne les dessine encore (aucun consommateur).
 * Jamais en v4 sans images de référence (AM-03). `grain-papier` attend la mesure AM-05 (C6-H7a) et ne va jamais sur
 * un rendu qui reçoit déjà le grain FFmpeg.
 *
 * PUR : aucun hook (l'image arrive en propriété), aucun Remotion, aucun alias d'import, aucun hasard non déterministe. Ni flou ni
 * `filter: blur`. Couleurs de la charte seulement (orange seulement sur fond noir). Chaque fond est une fonction pure
 * de ses propriétés ; les `id` SVG sont suffixés par la graine.
 *
 * Opacités : `opaciteMax` de `DESCRIPTION_FONDS` est l'opacité EFFECTIVE (opacité du trait × opacité de la couche).
 * Les attributs `data-dep` (position du motif en % de l'écran, non repliée) et `data-pas-px` / `data-decalage-px`
 * (grille) servent aux tests de vitesse.
 */
import type { CSSProperties, ReactElement } from "react";
import { CHARTE_AXION, accentSur, avecOpacite, couleursSur, type FondAxion } from "../../jetons-motion";
import { derive, hasard } from "../courbes";

export const IDS_FONDS_VIVANTS = [
  "lueur-derive",
  "double-lueur",
  "grain-papier",
  "bande-diagonale",
  "quadrillage",
  "grille-perspective",
  "points",
] as const;
export type IdFondVivant = (typeof IDS_FONDS_VIVANTS)[number];

export type ProprietesFond = {
  id: IdFondVivant;
  /** Numéro de l'image (0, 1, 2…). */
  image: number;
  fps: number;
  largeur: number;
  hauteur: number;
  fond: FondAxion;
  graine: number;
};

export type DescriptionFond = {
  couleurs: { hex: string; opaciteMax: number }[];
  /** Couches présentes dans la bande basse (y ≥ 63 %, sous-titres). */
  couleursBandeBasse: { hex: string; opaciteMax: number }[];
  vitesseMaxPctParSec: number;
  attendMesure: boolean;
  incompatibleGrainFfmpeg: boolean;
};

/** Amplitude de la dérive des lueurs (part de l'écran). `derive` a une pente max de 1,198 par seconde. */
const AMPLITUDE_LUEUR = 0.015;
const PENTE_DERIVE = 1.198;
const VITESSE_LUEUR_PCT = +(AMPLITUDE_LUEUR * PENTE_DERIVE * 100).toFixed(3);
const VITESSE_MOTIF_PCT = 1; // % de la largeur par seconde
const PAS_GRILLE_LARGEUR = 0.07; // une case = 7 % de la largeur
const SECONDES_PAR_CASE = 4;
const VITESSE_GRILLE_PCT = +((PAS_GRILLE_LARGEUR * 100) / SECONDES_PAR_CASE).toFixed(3);

/** Opacité de couche (comme le 0,55 de `TramePerspective`) et opacité du trait. */
const COUCHE_GRILLE = 0.4;
const TRAIT_GRILLE = 0.07;
const BALAYAGE_GRILLE = 0.06;
const COUCHE_BANDE = 0.6;
const TRAIT_BANDE = 0.06;
const COUCHE_POINTS = 0.4;
const TRAIT_POINTS = 0.06;
const COUCHE_QUADRILLAGE = 0.4;
const TRAIT_QUADRILLAGE = 0.4;
const LUEUR = { ivoire: 0.04, noir: 0.1 } as const;
const DOUBLE_LUEUR = { ivoire: 0.02, noir: 0.05 } as const;
const GRAIN = { ivoire: 0.025, noir: 0.04 } as const;

const encre = (fond: FondAxion) => couleursSur(fond).texte;
const accent = (fond: FondAxion) => accentSur(fond, "orange");
const dessus = (hex: string, a: number) => ({ hex, opaciteMax: a });

function couchesDe(id: IdFondVivant, fond: FondAxion): { hex: string; opaciteMax: number }[] {
  switch (id) {
    case "lueur-derive":
      return [dessus(accent(fond), LUEUR[fond])];
    case "double-lueur":
      return [dessus(accent(fond), DOUBLE_LUEUR[fond]), dessus(accent(fond), DOUBLE_LUEUR[fond])];
    case "grain-papier":
      return [dessus(encre(fond), GRAIN[fond])];
    case "bande-diagonale":
      return [dessus(accent(fond), TRAIT_BANDE * COUCHE_BANDE)];
    case "quadrillage":
      return [dessus(CHARTE_AXION.gris, TRAIT_QUADRILLAGE * COUCHE_QUADRILLAGE)];
    case "grille-perspective":
      return [
        dessus(encre(fond), TRAIT_GRILLE * COUCHE_GRILLE),
        dessus(accent(fond), BALAYAGE_GRILLE * COUCHE_GRILLE),
      ];
    case "points":
      return [dessus(encre(fond), TRAIT_POINTS * COUCHE_POINTS)];
  }
}

const VITESSES: Record<IdFondVivant, number> = {
  "lueur-derive": VITESSE_LUEUR_PCT,
  "double-lueur": VITESSE_LUEUR_PCT,
  "grain-papier": 0,
  "bande-diagonale": VITESSE_MOTIF_PCT,
  quadrillage: VITESSE_MOTIF_PCT,
  "grille-perspective": VITESSE_GRILLE_PCT,
  points: VITESSE_MOTIF_PCT,
};

/** Toutes les couches des fonds vivants sont étendues à l'écran entier (aucune n'est exclue de la bande basse). */
const description = (id: IdFondVivant, fond: FondAxion): DescriptionFond => ({
  couleurs: couchesDe(id, fond),
  couleursBandeBasse: couchesDe(id, fond),
  vitesseMaxPctParSec: VITESSES[id],
  attendMesure: id === "grain-papier",
  incompatibleGrainFfmpeg: id === "grain-papier",
});

/** Description par fond de l'écran (ivoire et noir), lue par les tests de contraste et de vitesse. */
export const DESCRIPTION_FONDS_PAR_FOND: Record<FondAxion, Record<IdFondVivant, DescriptionFond>> = {
  ivoire: Object.fromEntries(IDS_FONDS_VIVANTS.map((id) => [id, description(id, "ivoire")])) as Record<IdFondVivant, DescriptionFond>,
  noir: Object.fromEntries(IDS_FONDS_VIVANTS.map((id) => [id, description(id, "noir")])) as Record<IdFondVivant, DescriptionFond>,
};

/** Description par défaut (fond ivoire, le plus exigeant) ; les couleurs par fond sont dans `DESCRIPTION_FONDS_PAR_FOND`. */
export const DESCRIPTION_FONDS: Record<IdFondVivant, DescriptionFond> = DESCRIPTION_FONDS_PAR_FOND.ivoire;

const PLEIN: CSSProperties = { position: "absolute", inset: 0 };

const f2 = (n: number) => n.toFixed(2);

function lueur(cx: number, cy: number, hex: string, a: number, rayon: number): string {
  return `radial-gradient(circle at ${f2(cx)}% ${f2(cy)}%, ${avecOpacite(hex, a)} 0%, ${avecOpacite(hex, 0)} ${rayon}%)`;
}

export function FondVivant({ id, image, fps, largeur, hauteur, fond, graine }: ProprietesFond): ReactElement {
  const t = image / fps;
  const [c0, c1] = couchesDe(id, fond);
  const hex = c0.hex;

  if (id === "lueur-derive" || id === "double-lueur") {
    const x1 = 35 + AMPLITUDE_LUEUR * 100 * derive(t, graine);
    const y1 = 30 + AMPLITUDE_LUEUR * 100 * derive(t, graine + 1);
    const fonds = [lueur(x1, y1, hex, c0.opaciteMax, 60)];
    let dep = `${f2(x1)},${f2(y1)}`;
    if (id === "double-lueur") {
      const x2 = 70 + AMPLITUDE_LUEUR * 100 * derive(t, graine + 2);
      const y2 = 65 + AMPLITUDE_LUEUR * 100 * derive(t, graine + 3);
      fonds.push(lueur(x2, y2, c1.hex, c1.opaciteMax, 55));
      dep += `;${f2(x2)},${f2(y2)}`;
    }
    return <div data-fond={id} data-dep={dep} style={{ ...PLEIN, backgroundImage: fonds.join(", ") }} />;
  }

  if (id === "grain-papier") {
    const seed = graine + Math.floor(image / 2);
    const ident = `grain-${graine}`;
    return (
      <div data-fond={id} data-seed={seed} style={PLEIN}>
        <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} style={PLEIN}>
          <filter id={ident} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed={seed} result="bruit" />
            <feColorMatrix in="bruit" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.2" result="masque" />
            <feFlood floodColor={avecOpacite(hex, c0.opaciteMax * 4)} result="encre" />
            <feComposite in="encre" in2="masque" operator="in" />
          </filter>
          <rect width={largeur} height={hauteur} filter={`url(#${ident})`} />
        </svg>
      </div>
    );
  }

  if (id === "bande-diagonale") {
    const dx = (t * VITESSE_MOTIF_PCT) % 100;
    const pas = 14;
    return (
      <div data-fond={id} data-dep={`${f2(t * VITESSE_MOTIF_PCT)},0`} style={PLEIN}>
        <div
          style={{
            ...PLEIN,
            opacity: COUCHE_BANDE,
            backgroundImage: `linear-gradient(115deg, transparent 0%, transparent 40%, ${avecOpacite(hex, TRAIT_BANDE)} 40%, ${avecOpacite(hex, TRAIT_BANDE)} 60%, transparent 60%, transparent 100%)`,
            backgroundSize: `${pas}% 100%`,
            backgroundPosition: `${f2(dx)}% 0%`,
          }}
        />
      </div>
    );
  }

  if (id === "quadrillage") {
    const pas = Math.max(8, Math.round(largeur * 0.05));
    const dep = (t * VITESSE_MOTIF_PCT * largeur) / 100;
    const trait = Math.max(1, Math.round(largeur / 720));
    const g = avecOpacite(hex, TRAIT_QUADRILLAGE);
    return (
      <div data-fond={id} data-dep={`${f2(t * VITESSE_MOTIF_PCT)},0`} style={PLEIN}>
        <div
          style={{
            ...PLEIN,
            opacity: COUCHE_QUADRILLAGE,
            backgroundImage: `linear-gradient(${g} ${trait}px, transparent ${trait}px), linear-gradient(90deg, ${g} ${trait}px, transparent ${trait}px)`,
            backgroundSize: `${pas}px ${pas}px`,
            backgroundPosition: `${f2(dep % pas)}px 0px`,
          }}
        />
      </div>
    );
  }

  if (id === "points") {
    const pas = Math.max(8, Math.round(largeur * 0.04));
    const dep = (t * VITESSE_MOTIF_PCT * largeur) / 100;
    const ident = `points-${graine}`;
    return (
      <div data-fond={id} data-dep={`${f2(t * VITESSE_MOTIF_PCT)},0`} style={PLEIN}>
        <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} style={{ ...PLEIN, opacity: COUCHE_POINTS }}>
          <defs>
            <pattern id={ident} width={pas} height={pas} patternUnits="userSpaceOnUse" patternTransform={`translate(${f2(dep % pas)} 0)`}>
              <circle cx={pas / 2} cy={pas / 2} r={Math.max(1, pas / 14)} fill={avecOpacite(hex, TRAIT_POINTS)} />
            </pattern>
          </defs>
          <rect width={largeur} height={hauteur} fill={`url(#${ident})`} />
        </svg>
      </div>
    );
  }

  // grille-perspective : technique de TramePerspective (noyau.tsx), recopiée sans l'importer.
  const pas = PAS_GRILLE_LARGEUR * largeur;
  const decalage = (t / SECONDES_PAR_CASE) * pas;
  const epais = Math.max(1, largeur / 720);
  const trait = avecOpacite(hex, TRAIT_GRILLE);
  const balayage = avecOpacite(c1.hex, BALAYAGE_GRILLE);
  const masque = "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)";
  const deriveBalayage = (t * 12) % 100;
  return (
    <div
      data-fond={id}
      data-dep={`0,${f2((decalage / largeur) * 100)}`}
      data-pas-px={f2(pas)}
      data-decalage-px={f2(decalage)}
      style={PLEIN}
    >
      <div style={{ ...PLEIN, perspective: `${Math.round(largeur * 0.83)}px`, perspectiveOrigin: "50% 30%", opacity: COUCHE_GRILLE }}>
        <div
          style={{
            position: "absolute",
            left: -largeur * 0.5,
            width: largeur * 2,
            top: hauteur * 0.55,
            height: hauteur * 0.9,
            transform: "rotateX(72deg)",
            transformOrigin: "50% 0%",
            backgroundImage: `linear-gradient(${trait} ${epais}px, transparent ${epais}px), linear-gradient(90deg, ${trait} ${epais}px, transparent ${epais}px), linear-gradient(100deg, transparent ${f2(deriveBalayage - 20)}%, ${balayage} ${f2(deriveBalayage)}%, transparent ${f2(deriveBalayage + 20)}%)`,
            backgroundSize: `${pas}px ${pas}px, ${pas}px ${pas}px, 100% 100%`,
            backgroundPosition: `0px ${f2(decalage % pas)}px, 0px ${f2(decalage % pas)}px, 0px 0px`,
            maskImage: masque,
            WebkitMaskImage: masque,
          }}
        />
      </div>
    </div>
  );
}

/** Graine de repli déterministe pour un appelant qui n'en a pas (jamais de hasard non déterministe). */
export const graineParDefaut = (indice: number): number => Math.floor(hasard(indice) * 1000);
