/**
 * C10-13b-a : pièce pure, non inscrite, montée nulle part ; un seul texte (DV-09) ; jamais sur le visage (l'appelant garantit la zone).
 * PETITS OBJETS — le bouton d'appel cliqué : un curseur glisse vers la pilule, clique, la pilule s'enfonce, s'allume (lueur H6)
 * puis son contour passe au ton « valide » (le texte ne change jamais). Le minutage vient de `sequence-appel` (C10-13a).
 * Aucun hook, aucune horloge, aucun hasard ; lueur par ombres de boîte seulement ; ton jamais couleur libre.
 * Imports relatifs seulement (dossier lu par le rendu). Le dessin du curseur est recopié de `Curseur.tsx`, sans ombre portée.
 */
import { type JSX } from "react";
import { PALETTE } from "../../charte/axion-2026";
import { PILE_CSS } from "../../charte/axion-2026";
import { type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { etatSequenceAppel, haloBoutonAppel, LIBELLE_APPEL_RDV } from "../habillage-commun/sequence-appel";

export interface ParametresAppelRdv {
  /** Point de départ du curseur, en % de la toile ; facultatif. */
  depart?: { x: number; y: number };
}

const TOILE = { largeur: 1000, hauteur: 1000 } as const;
const LARGEUR = 560;
const HAUT = 128;
const TAILLE_TEXTE = 44;
const ECHELLE_CURSEUR = 2;

const dansPourcent = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;

function valider(p: unknown): ParametresAppelRdv | null {
  try {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
    const r = p as Record<string, unknown>;
    for (const cle of Object.keys(r)) if (cle !== "depart") return null;
    if (r.depart === undefined) return {};
    const d = r.depart;
    if (typeof d !== "object" || d === null) return null;
    const { x, y } = d as Record<string, unknown>;
    if (!dansPourcent(x) || !dansPourcent(y)) return null;
    return { depart: { x, y } };
  } catch {
    return null;
  }
}

const f = (n: number) => n.toFixed(1);

function Rendu(pr: ProprietesObjet<ParametresAppelRdv>): JSX.Element {
  const { image, dureeImages } = pr;
  const parametres = pr.parametres as ParametresAppelRdv | null;
  const vide = <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true" />;
  if (!parametres) return vide;
  const fond = pr.fond;
  const phase = phaseObjet(image, dureeImages);
  const etat = etatSequenceAppel(image, dureeImages, parametres.depart ? { depart: parametres.depart } : undefined);
  const boite = { largeur: LARGEUR, hauteur: HAUT };
  const contour = couleurDuTon(etat.bouton === "valide" ? "valide" : "neutre", fond);
  const lueur = haloBoutonAppel(etat, boite, couleurDuTon("accent", fond));
  const opacite = Math.min(phase.opacite, phase.trace);
  const cx = (etat.curseur.x / 100) * TOILE.largeur;
  const cy = (etat.curseur.y / 100) * TOILE.hauteur;
  const remplissage = fond === "noir" ? PALETTE.ivoire : PALETTE.noir;
  const trait = fond === "noir" ? PALETTE.noir : PALETTE.ivoire;
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={opacite}>
        <foreignObject x={0} y={0} width={TOILE.largeur} height={TOILE.hauteur} style={{ overflow: "visible" }}>
          <div style={{ position: "absolute", left: (TOILE.largeur - LARGEUR) / 2, top: (TOILE.hauteur - HAUT) / 2, width: LARGEUR, height: HAUT, transform: `scale(${etat.echelleBouton.toFixed(3)})` }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: HAUT / 2, ...lueur }} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: HAUT / 2,
                border: `4px solid ${contour}`,
                background: PALETTE.blanc,
                color: PALETTE.noir,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: PILE_CSS,
                fontWeight: 700,
                fontSize: TAILLE_TEXTE,
                whiteSpace: "nowrap",
              }}
            >
              {LIBELLE_APPEL_RDV}
            </div>
          </div>
        </foreignObject>
        {etat.anneau !== null ? (
          <circle data-anneau="oui" cx={f(cx)} cy={f(cy)} r={f(10 + 40 * etat.anneau)} fill="none" stroke={couleurDuTon("accent", fond)} strokeWidth={4} opacity={(1 - etat.anneau).toFixed(3)} />
        ) : null}
        <g transform={`translate(${f(cx)} ${f(cy)}) scale(${(ECHELLE_CURSEUR * etat.curseur.echelle).toFixed(3)})`}>
          <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={remplissage} stroke={trait} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

export const DEF_APPEL_RDV: DefinitionObjet<ParametresAppelRdv> = {
  id: "objet-appel-rdv",
  famille: "etiquette",
  capacite: "objet.appel",
  valider,
  toile: TOILE,
  dureeSec: { min: 2, max: 4 },
  donnees: "aucune",
  Rendu,
};

/** Données de planche (future) : entrées valides. */
export const EXEMPLES_APPEL_RDV = [{}, { depart: { x: 82, y: 88 } }, { depart: { x: 15, y: 80 } }] as const satisfies readonly ParametresAppelRdv[];
