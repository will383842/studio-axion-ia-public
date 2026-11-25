/**
 * PETITS OBJETS — compteur à rouleau (N-08b, couvre C11-O5) : chaque chiffre est une colonne 0-9 qui défile (translation verticale,
 * fenêtre découpée) puis s'arrête sur le chiffre de la valeur reçue ; les colonnes de droite font plus de tours. Arrêt complet à la
 * fin de l'entrée (`DUREES.entree`), dernière image = valeur exacte. Aucun comptage (≠ gros-chiffre) : défilement mécanique.
 * Pièce pure, NON inscrite (rien ne l'importe). La valeur vient de l'appelant (garde Studio : `donnees: "nombres-dits"`) ; rien n'est inventé ici.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import type { DefinitionObjet } from "./contrat";
import { ecrireNombreFr } from "./gros-chiffre";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

export interface ParametresRouleau {
  valeur: number;
  /** 2 caractères au plus, sans chiffre. */
  prefixe?: string;
  /** 4 caractères au plus, sans chiffre. */
  suffixe?: string;
  decimales?: 0 | 1 | 2;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const VALEUR_MAX = 1e12;
const PREFIXE_MAX = 2;
const SUFFIXE_MAX = 4;
const LARGEUR_MAX = 560; // ≤ 60 % du cadre
const TAILLE_MAX = 260;
const LARGEUR_CHIFFRE = 0.62; // chiffres tabulaires, en fraction de la taille
const HAUTEUR_LIGNE = 1.1;
const TOURS_MAX = 4;

function valider(p: unknown): ParametresRouleau | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const v = r.valeur;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v >= VALEUR_MAX) return null;
    const sortie: ParametresRouleau = { valeur: v };
    let d = 0;
    if (r.decimales !== undefined) {
      if (r.decimales !== 0 && r.decimales !== 1 && r.decimales !== 2) return null;
      d = r.decimales;
      sortie.decimales = r.decimales;
    }
    // la valeur doit tenir exactement dans les décimales demandées : on n'arrondit jamais un nombre dit
    if (Number(v.toFixed(d)) !== v) return null;
    for (const [cle, max] of [["prefixe", PREFIXE_MAX], ["suffixe", SUFFIXE_MAX]] as const) {
      const t = r[cle];
      if (t === undefined) continue;
      if (typeof t !== "string" || t.length === 0 || t.length > max || /\d/.test(t)) return null;
      sortie[cle] = t;
    }
    return sortie;
  } catch {
    return null;
  }
}

export const OBJET_COMPTEUR_ROULEAU: DefinitionObjet<ParametresRouleau> = {
  id: "objet-compteur-rouleau",
  famille: "chiffre",
  capacite: "objet.chiffre",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "nombres-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const prefixe = parametres.prefixe ?? "";
    const suffixe = parametres.suffixe ?? "";
    const nombre = ecrireNombreFr(parametres.valeur, parametres.decimales ?? 0);
    const complet = `${prefixe}${nombre}${suffixe}`;
    const cellules = [...complet];
    const taille = Math.min(TAILLE_MAX, LARGEUR_MAX / (cellules.length * LARGEUR_CHIFFRE));
    const largeur = taille * LARGEUR_CHIFFRE;
    const ligne = taille * HAUTEUR_LIGNE;
    const x0 = (L - largeur * cellules.length) / 2;
    const base = 520;
    const couleur = couleurDuTon(ton, fond);
    const debutNombre = prefixe.length;
    const finNombre = debutNombre + nombre.length;
    // ids de clipPath propres à l'instance : deux compteurs dans une même page ne se partagent pas leurs découpes
    const idInstance = [...complet].map((ch) => ch.charCodeAt(0).toString(36)).join("") + "-" + taille.toFixed(1).replace(".", "_");
    let rang = 0;
    const colonnes: JSX.Element[] = [];
    cellules.forEach((c, i) => {
      const cx = x0 + largeur * (i + 0.5);
      const dansNombre = i >= debutNombre && i < finNombre;
      if (!dansNombre || !/\d/.test(c)) {
        colonnes.push(
          <text key={i} data-role="fixe" x={cx.toFixed(1)} y={base} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={800} fontSize={taille.toFixed(1)} fill={couleur} style={{ fontVariantNumeric: "tabular-nums" }}>
            {c}
          </text>,
        );
        return;
      }
      const cible = Number(c);
      const tours = Math.min(TOURS_MAX, 1 + rang);
      rang += 1;
      const total = tours * 10 + cible;
      const decalage = phase.trace >= 1 ? total : Math.round(total * phase.trace * 100) / 100;
      const roues: JSX.Element[] = [];
      for (let k = 0; k < total + 1; k++) {
        roues.push(
          <text key={k} data-role="roue" x={0} y={(k * ligne).toFixed(1)} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={800} fontSize={taille.toFixed(1)} fill={couleur} style={{ fontVariantNumeric: "tabular-nums" }}>
            {k % 10}
          </text>,
        );
      }
      colonnes.push(
        <g key={i} data-role="colonne" data-cible={cible} data-decalage={decalage} transform={`translate(${cx.toFixed(1)} ${base})`}>
          <clipPath id={`rouleau-${idInstance}-${i}`}>
            <rect x={(-largeur / 2).toFixed(1)} y={(-taille * 0.82).toFixed(1)} width={largeur.toFixed(1)} height={ligne.toFixed(1)} />
          </clipPath>
          <g clipPath={`url(#rouleau-${idInstance}-${i})`}>
            <g transform={`translate(0 ${(-decalage * ligne).toFixed(2)})`}>{roues}</g>
          </g>
        </g>,
      );
    });
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite} role="img" aria-label={complet}>
          {colonnes}
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par N-08c. */
export const EXEMPLES_ROULEAU: readonly ParametresRouleau[] = [
  { valeur: 20, suffixe: "min" },
  { valeur: 98, prefixe: "+", suffixe: "%" },
  { valeur: 1250 },
  { valeur: 4.5, decimales: 1 },
];
