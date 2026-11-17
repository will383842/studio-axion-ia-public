/** PETITS OBJETS — post-it (famille etiquette) : papier légèrement incliné, ombre douce (2e forme décalée, jamais de filtre), mots dits en Manrope seule. Pièce pure, non inscrite. Imports relatifs seulement. */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION } from "../../jetons-motion";
import { DUREE_SEC, MOTS_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { tremblement } from "./tremblement";

/** Mots dits, 1 à 4 (une ligne par mot). */
export interface ParametresPostIt {
  mots: string[];
}

const TOILE = { largeur: 600, hauteur: 600 } as const;
const UTILE = 0.8;
const TAILLE_MAX = 72;
const LARGEUR_CAR = 0.62;
const INTERLIGNE = 1.2;
const MOT_MAX_CAR = 24;
const BANDE = 36;
const OMBRE = 4;
const INCLINAISON_MAX = 3;

function lireMots(p: unknown): ParametresPostIt | null {
  if (typeof p !== "object" || p === null) return null;
  const { mots } = p as Record<string, unknown>;
  if (!Array.isArray(mots) || mots.length < 1 || mots.length > MOTS_MAX) return null;
  const propres: string[] = [];
  for (const m of mots) {
    if (typeof m !== "string") return null;
    const t = m.trim();
    if (t.length === 0 || t.length > MOT_MAX_CAR) return null;
    propres.push(t);
  }
  return { mots: propres };
}

/** Taille du texte : réduite quand le mot le plus long ou le nombre de lignes ferait déborder la zone utile du papier. */
export function taillePostIt(mots: readonly string[]): number {
  const plusLong = Math.max(1, ...mots.map((m) => m.length));
  const lignes = Math.max(1, mots.length);
  return Math.min(TAILLE_MAX, (TOILE.largeur * UTILE) / (plusLong * LARGEUR_CAR), (TOILE.hauteur * UTILE) / (lignes * INTERLIGNE));
}

const f = (n: number) => n.toFixed(2);

function Rendu({ image, fps, dureeImages, fond, ton = "neutre", graine, parametres }: ProprietesObjet<ParametresPostIt>): JSX.Element {
  const { trace, opacite } = phaseObjet(image, dureeImages);
  const p = parametres as ParametresPostIt | null;
  const visible = p !== null && opacite > 0;
  const c = couleursSur(fond);
  const t = tremblement(graine, image, fps);
  const angle = (aleaGraine(graine, 100) - 0.5) * 2 * INCLINAISON_MAX + t.angle;
  const echelle = 0.94 + 0.06 * trace;
  const marge = (TOILE.largeur * (1 - UTILE)) / 4;
  const [x, y] = [marge, marge];
  const [l, h] = [TOILE.largeur - 2 * marge, TOILE.hauteur - 2 * marge];
  const taille = visible ? taillePostIt(p.mots) : TAILLE_MAX;
  const hauteurTexte = visible ? p.mots.length * taille * INTERLIGNE : 0;
  const haut = y + BANDE + (h - BANDE - hauteurTexte) / 2;
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
      {visible ? (
        <g opacity={opacite} transform={`translate(${f(t.dx)} ${f(t.dy)}) rotate(${f(angle)} ${TOILE.largeur / 2} ${TOILE.hauteur / 2}) translate(${f((TOILE.largeur * (1 - echelle)) / 2)} ${f((TOILE.hauteur * (1 - echelle)) / 2)}) scale(${f(echelle)})`}>
          <rect x={x + OMBRE} y={y + OMBRE} width={l} height={h} rx={6} fill={c.filet} />
          <rect x={x} y={y} width={l} height={h} rx={6} fill={c.panneauRelief} />
          <rect x={x} y={y} width={l} height={BANDE} rx={6} fill={couleurDuTon(ton, fond)} />
          {p.mots.map((m, i) => (
            <text key={i} x={TOILE.largeur / 2} y={haut + (i + 0.78) * taille * INTERLIGNE} textAnchor="middle" fontFamily={FAMILLE_CSS_AXION} fontWeight={700} fontSize={f(taille)} fill={c.texte}>
              {m}
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}

/** Pièce pure : aucune inscription ici, une fiche à part s'en chargera. */
export const DEF_POST_IT: DefinitionObjet<ParametresPostIt> = {
  id: "objet-post-it",
  famille: "etiquette",
  capacite: "objet.etiquette",
  valider: lireMots,
  toile: TOILE,
  dureeSec: { min: 1, max: DUREE_SEC.max },
  donnees: "mots-dits",
  Rendu,
};

/** Données de planche : entrées valides. */
export const EXEMPLES_POST_IT: readonly ParametresPostIt[] = [{ mots: ["à", "retenir"] }, { mots: ["ça", "coûte", "trop", "cher"] }, { mots: ["oui"] }];
