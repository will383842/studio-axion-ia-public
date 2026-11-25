/**
 * PETITS OBJETS — anneau (ou camembert) de part (N-08a) : « 30 % » dessiné en arc. Pièce pure, NON inscrite (rien ne l'importe).
 * L'arc monte de 0 à la part pendant l'entrée ; le chiffre au centre est la valeur reçue, écrite comme `gros-chiffre.tsx`, jamais
 * arrondie ni animée. Aucun nombre n'est fabriqué ici (`donnees: "nombres-dits"`). Part en ton `accent`, reste en ton `neutre`.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import type { DefinitionObjet } from "./contrat";
import { ecrireNombreFr } from "./gros-chiffre";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

export interface ParametresAnneauDonnees {
  valeur: number;
  /** Défaut 100. */
  total?: number;
  /** Trois mots au plus, sans chiffre. */
  libelle?: string;
  forme?: "anneau" | "camembert";
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const TOTAL_DEFAUT = 100;
const VALEUR_MAX = 1e12;
const DECIMALES_MAX = 2;
const MOTS_LIBELLE_MAX = 3;
const LONGUEUR_LIBELLE_MAX = 24;
const ANNEAU = { cx: 500, cy: 500, r: 240, epaisseur: 60 } as const;
const DISQUE = { cx: 500, cy: 340, r: 170 } as const;
const TAILLE_CHIFFRE_MAX = 150;
const LARGEUR_CHIFFRE = 330;
const TAILLE_LIBELLE = 40;
const OPACITE_RESTE = 0.25;

const decimalesOk = (v: number): boolean => {
  for (let d = 0; d <= DECIMALES_MAX; d++) if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-9) return true;
  return false;
};
const decimalesDe = (v: number): number => {
  for (let d = 0; d <= DECIMALES_MAX; d++) if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-9) return d;
  return 0;
};

function valider(p: unknown): ParametresAnneauDonnees | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const v = r.valeur;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v >= VALEUR_MAX || !decimalesOk(v)) return null;
    let total = TOTAL_DEFAUT;
    if (r.total !== undefined) {
      const t = r.total;
      if (typeof t !== "number" || !Number.isFinite(t) || t <= 0 || t >= VALEUR_MAX || !decimalesOk(t)) return null;
      total = t;
    }
    if (v > total) return null;
    const sortie: ParametresAnneauDonnees = { valeur: v };
    if (r.total !== undefined) sortie.total = total;
    if (r.libelle !== undefined) {
      if (typeof r.libelle !== "string") return null;
      const m = r.libelle.trim();
      if (m === "" || m.length > LONGUEUR_LIBELLE_MAX || /\d/.test(m) || m.split(/\s+/).length > MOTS_LIBELLE_MAX) return null;
      sortie.libelle = m;
    }
    if (r.forme !== undefined) {
      if (r.forme !== "anneau" && r.forme !== "camembert") return null;
      sortie.forme = r.forme;
    }
    return sortie;
  } catch {
    return null;
  }
}

/** Angle final de la part, en degrés. Pur. */
export function angleDePart(valeur: number, total: number = TOTAL_DEFAUT): number {
  return total > 0 ? (valeur / total) * 360 : 0;
}

/** Secteur plein de 0 à `angle` degrés (départ en haut, sens horaire). */
function cheminSecteur(cx: number, cy: number, r: number, angle: number): string {
  const a = ((angle - 90) * Math.PI) / 180;
  const x = cx + r * Math.cos(a);
  const y = cy + r * Math.sin(a);
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export const OBJET_ANNEAU_DONNEES: DefinitionObjet<ParametresAnneauDonnees> = {
  id: "objet-anneau-donnees",
  famille: "chiffre",
  capacite: "objet.chiffre",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "nombres-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const phase = phaseObjet(image, dureeImages);
    const total = parametres.total ?? TOTAL_DEFAUT;
    const forme = parametres.forme ?? "anneau";
    const angle = Math.min(360, angleDePart(parametres.valeur, total) * phase.trace);
    const cPart = couleurDuTon("accent", fond);
    const cReste = couleurDuTon("neutre", fond);
    const texte = ecrireNombreFr(parametres.valeur, decimalesDe(parametres.valeur));
    const taille = Math.min(TAILLE_CHIFFRE_MAX, LARGEUR_CHIFFRE / (texte.length * 0.62));
    const anneau = forme === "anneau";
    const yChiffre = anneau ? 520 : 650;
    const yLibelle = anneau ? 590 : 710;
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          {anneau ? (
            <>
              <circle data-role="reste" cx={ANNEAU.cx} cy={ANNEAU.cy} r={ANNEAU.r} fill="none" stroke={cReste} strokeWidth={ANNEAU.epaisseur} opacity={OPACITE_RESTE} />
              <circle
                data-role="part"
                data-angle={angle.toFixed(2)}
                cx={ANNEAU.cx}
                cy={ANNEAU.cy}
                r={ANNEAU.r}
                fill="none"
                stroke={cPart}
                strokeWidth={ANNEAU.epaisseur}
                pathLength={360}
                strokeDasharray={`${angle.toFixed(3)} ${(360 - angle).toFixed(3)}`}
                transform={`rotate(-90 ${ANNEAU.cx} ${ANNEAU.cy})`}
              />
            </>
          ) : (
            <>
              <circle data-role="reste" cx={DISQUE.cx} cy={DISQUE.cy} r={DISQUE.r} fill={cReste} opacity={OPACITE_RESTE} />
              {angle >= 360 ? (
                <circle data-role="part" data-angle={angle.toFixed(2)} cx={DISQUE.cx} cy={DISQUE.cy} r={DISQUE.r} fill={cPart} />
              ) : (
                <path data-role="part" data-angle={angle.toFixed(2)} d={angle > 0 ? cheminSecteur(DISQUE.cx, DISQUE.cy, DISQUE.r, angle) : "M 0 0"} fill={angle > 0 ? cPart : "none"} />
              )}
            </>
          )}
          <text data-role="chiffre" x={500} y={yChiffre} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={800} fontSize={taille.toFixed(1)} fill={cReste}>
            {texte}
          </text>
          {total === TOTAL_DEFAUT ? (
            <text data-role="unite" x={500} y={yChiffre + 50} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={600} fontSize={TAILLE_LIBELLE} fill={cReste}>
              %
            </text>
          ) : null}
          {parametres.libelle ? (
            <text data-role="libelle" x={500} y={yLibelle + (total === TOTAL_DEFAUT ? 50 : 0)} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={600} fontSize={TAILLE_LIBELLE} fill={cReste}>
              {parametres.libelle}
            </text>
          ) : null}
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par la planche (N-08c). */
export const EXEMPLES_ANNEAU: readonly ParametresAnneauDonnees[] = [
  { valeur: 30, libelle: "des visiteurs" },
  { valeur: 12.5, forme: "camembert" },
  { valeur: 3, total: 4, libelle: "sur quatre" },
];
