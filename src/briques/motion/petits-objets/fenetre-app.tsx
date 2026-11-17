/**
 * PETITS OBJETS — fenêtre d'application (C9-18) : contour tracé, panneau en fondu, trois points neutres, blocs gris (lignes, rectangle).
 * Contenu neutre : jamais une page web, jamais de défilement, jamais plus de 60 % du cadre. Pièce pure, NON inscrite (rien ne l'importe).
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { couleursSur } from "../../jetons-motion";
import { PILE_CSS } from "../../charte/axion-2026";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { IMAGES_ENTREE, phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** `largeur` et `hauteur` en % du cadre ; `titre` facultatif, 4 mots au plus (absent = aucun texte). */
export interface ParametresFenetreApp {
  largeur: number;
  hauteur: number;
  titre?: string;
}

const L = 1000;
const H = 1000;
const MIN_POURCENT = 20;
const HAUTEUR_BARRE = 84;
const MARGE = 36;
const HAUTEUR_LIGNE = 26;
const PAS_LIGNE = 54;
const LIGNES_MAX = 8;
/** Images du fondu du panneau, une fois le contour entièrement tracé. */
const IMAGES_FONDU = 6;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const f = (n: number): string => n.toFixed(1);

function valider(p: unknown): ParametresFenetreApp | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const { largeur, hauteur, titre } = r;
    if (!nombre(largeur) || !nombre(hauteur)) return null;
    if (largeur < MIN_POURCENT || largeur > 100 || hauteur < MIN_POURCENT || hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX + 1e-9) return null;
    const sortie: ParametresFenetreApp = { largeur, hauteur };
    if (titre !== undefined) {
      if (typeof titre !== "string") return null;
      const mots = titre.trim().split(/\s+/).filter(Boolean);
      if (mots.length === 0 || mots.length > MOTS_MAX) return null;
      sortie.titre = titre;
    }
    return sortie;
  } catch {
    return null;
  }
}

export const OBJET_FENETRE_APP: DefinitionObjet<ParametresFenetreApp> = {
  id: "objet-fenetre-app",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: { largeur: L, hauteur: H },
  dureeSec: { min: 1, max: 4 },
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, graine } = pr;
    const c = couleursSur(fond);
    const neutre = couleurDuTon("neutre", fond);
    const phase = phaseObjet(image, dureeImages);
    // Le panneau ne commence à apparaître que lorsque le contour est fini d'être tracé.
    const fondu = phase.trace < 1 ? 0 : Math.min(1, Math.max(0, (image - IMAGES_ENTREE + 1) / IMAGES_FONDU));
    const w = (parametres.largeur * L) / 100;
    const h = (parametres.hauteur * H) / 100;
    const x = (L - w) / 2;
    const y = (H - h) / 2;
    const contour = `M ${f(x)} ${f(y)} L ${f(x + w)} ${f(y)} L ${f(x + w)} ${f(y + h)} L ${f(x)} ${f(y + h)} Z`;
    const barre = Math.min(HAUTEUR_BARRE, h * 0.2);
    const haut = y + barre + MARGE;
    const lignes = Math.max(0, Math.min(LIGNES_MAX, Math.floor((y + h - MARGE - haut) / PAS_LIGNE)));
    const largeurTexte = w - 2 * MARGE;
    const blocs: JSX.Element[] = [];
    for (let i = 0; i < lignes; i++) {
      const part = i === 0 ? 0.45 : 0.35 + aleaGraine(graine, i) * 0.55;
      blocs.push(<rect key={i} x={f(x + MARGE)} y={f(haut + i * PAS_LIGNE)} width={f(largeurTexte * part)} height={HAUTEUR_LIGNE} rx={6} fill={c.panneauRelief} />);
    }
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <rect x={f(x)} y={f(y)} width={f(w)} height={f(h)} fill={c.panneau} fillOpacity={fondu} stroke="none" />
          <TraceSvg d={contour} t={phase.trace} ton="neutre" fond={fond} />
          <g fillOpacity={fondu}>
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={f(x + MARGE + i * 34)} cy={f(y + barre / 2)} r={10} fill={neutre} />
            ))}
            {parametres.titre ? (
              <text x={f(x + w / 2)} y={f(y + barre / 2 + 12)} textAnchor="middle" fontSize={34} fontWeight={600} fontFamily={PILE_CSS} fill={c.texte}>
                {parametres.titre}
              </text>
            ) : null}
            {blocs}
          </g>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_FENETRE_APP: readonly ParametresFenetreApp[] = [
  { largeur: 60, hauteur: 50, titre: "Mon espace" },
  { largeur: 50, hauteur: 40 },
  { largeur: 70, hauteur: 80, titre: "Tableau de suivi" },
];
