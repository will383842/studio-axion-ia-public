/**
 * PETITS OBJETS — panneau de réglages (C10-12) : contour tracé, panneau en fondu, interrupteur qui bascule, curseur, pastilles de couleur.
 * Aucun texte, aucune marque, jamais le plein cadre (≤ 60 %). Pièce pure, NON inscrite (rien ne l'importe). Imports relatifs seulement.
 */
import type { JSX } from "react";
import { couleursSur } from "../../jetons-motion";
import { SURFACE_MAX, type DefinitionObjet } from "./contrat";
import { IMAGES_ENTREE, phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** `largeur` et `hauteur` en % du cadre ; `interrupteur` = état final ; `curseur` 0..100 ; `pastilles` 1..3 ; `selection` = index de la pastille cerclée. */
export interface ParametresPanneauReglages {
  largeur: number;
  hauteur: number;
  interrupteur: boolean;
  curseur: number;
  pastilles: number;
  selection?: number;
}

const L = 1000;
const H = 1000;
/** Minimum (% du cadre) : la capsule de 180, 3 pastilles cerclées et 3 rangées de 72 tiennent dans le panneau (400 sur 1000). */
const MIN_POURCENT = 40;
const MARGE = 60;
const IMAGES_FONDU = 6;
/** Durée de la bascule de l'interrupteur, en images. */
const IMAGES_BASCULE = 6;
const PASTILLES_MAX = 3;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const f = (n: number): string => n.toFixed(1);
const entier = (n: unknown): n is number => nombre(n) && Number.isInteger(n);

function valider(p: unknown): ParametresPanneauReglages | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { largeur, hauteur, interrupteur, curseur, pastilles, selection } = p as Record<string, unknown>;
    if (!nombre(largeur) || !nombre(hauteur) || !nombre(curseur)) return null;
    if (largeur < MIN_POURCENT || largeur > 100 || hauteur < MIN_POURCENT || hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX + 1e-9) return null;
    if (typeof interrupteur !== "boolean") return null;
    if (curseur < 0 || curseur > 100) return null;
    if (!entier(pastilles) || pastilles < 1 || pastilles > PASTILLES_MAX) return null;
    const sortie: ParametresPanneauReglages = { largeur, hauteur, interrupteur, curseur, pastilles };
    if (selection !== undefined) {
      if (!entier(selection) || selection < 0 || selection >= pastilles) return null;
      sortie.selection = selection;
    }
    return sortie;
  } catch {
    return null;
  }
}

export const OBJET_PANNEAU_REGLAGES: DefinitionObjet<ParametresPanneauReglages> = {
  id: "objet-panneau-reglages",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: { largeur: L, hauteur: H },
  dureeSec: { min: 1, max: 4 },
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const c = couleursSur(fond);
    const neutre = couleurDuTon("neutre", fond);
    const accent = couleurDuTon("accent", fond);
    const phase = phaseObjet(image, dureeImages);
    // Le panneau n'apparaît qu'une fois le contour tracé ; la bascule ne commence qu'une fois le fondu fini.
    const fondu = phase.trace < 1 ? 0 : Math.min(1, Math.max(0, (image - IMAGES_ENTREE + 1) / IMAGES_FONDU));
    const bascule = Math.min(1, Math.max(0, (image - IMAGES_ENTREE - IMAGES_FONDU + 1) / IMAGES_BASCULE));
    const w = (parametres.largeur * L) / 100;
    const h = (parametres.hauteur * H) / 100;
    const x = (L - w) / 2;
    const y = (H - h) / 2;
    const contour = `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h)} L ${f(x)} ${f(y + h)} Z`;
    const gauche = x + MARGE;
    const droite = x + w - MARGE;
    const pas = (h - 2 * MARGE) / 3;
    // Rangée 1 : interrupteur (capsule + bouton).
    const yInter = y + MARGE + pas / 2;
    const largeurCapsule = Math.min(180, w - 2 * MARGE);
    const rayon = 36;
    const bGauche = gauche + rayon;
    const bDroite = gauche + largeurCapsule - rayon;
    const bx = parametres.interrupteur ? bGauche + (bDroite - bGauche) * bascule : bGauche;
    // Rangée 2 : curseur (rail + poignée).
    const yCurseur = y + MARGE + pas * 1.5;
    const px = gauche + ((droite - gauche) * parametres.curseur) / 100;
    // Rangée 3 : pastilles de couleur.
    const yPast = y + MARGE + pas * 2.5;
    const pastilles: JSX.Element[] = [];
    for (let i = 0; i < parametres.pastilles; i++) {
      const cx = gauche + 30 + i * 90;
      pastilles.push(
        <circle key={i} data-role="pastille" cx={f(cx)} cy={f(yPast)} r={28} fill={i === 0 ? accent : neutre} stroke="none" />,
      );
      if (parametres.selection === i) pastilles.push(<circle key={`s${i}`} cx={f(cx)} cy={f(yPast)} r={40} fill="none" stroke={c.texte} strokeWidth={4} strokeOpacity={fondu} />);
    }
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} fill={c.panneau} fillOpacity={fondu} stroke="none" />
          <TraceSvg d={contour} t={phase.trace} ton="neutre" fond={fond} />
          <g fillOpacity={fondu}>
            <rect x={f(gauche)} y={f(yInter - rayon)} width={f(largeurCapsule)} height={rayon * 2} rx={rayon} fill={c.panneauRelief} stroke="none" />
            <circle data-role="bouton" cx={f(bx)} cy={f(yInter)} r={rayon - 8} fill={parametres.interrupteur && bascule > 0.5 ? accent : neutre} stroke="none" />
            <rect x={f(gauche)} y={f(yCurseur - 6)} width={f(droite - gauche)} height={12} rx={6} fill={c.panneauRelief} stroke="none" />
            <circle data-role="poignee" cx={f(px)} cy={f(yCurseur)} r={24} fill={neutre} stroke="none" />
            {pastilles}
          </g>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_PANNEAU_REGLAGES: readonly ParametresPanneauReglages[] = [
  { largeur: 50, hauteur: 50, interrupteur: true, curseur: 70, pastilles: 3, selection: 1 },
  { largeur: 45, hauteur: 40, interrupteur: false, curseur: 30, pastilles: 2 },
  { largeur: 60, hauteur: 60, interrupteur: true, curseur: 100, pastilles: 1, selection: 0 },
];
