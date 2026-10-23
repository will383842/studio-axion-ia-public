/** Ajustement automatique du titre : fonctions PURES (la mesure réelle est injectée par `Titre.tsx`). */
import { TITRE } from "./constantes";

export interface OptionsAjustement {
  min?: number;
  max?: number;
  cible?: number;
  tolerance?: number;
}

export interface ResultatAjustement {
  taille: number;
  /** Largeur mesurée à `taille`. */
  largeur: number;
  /** `min` / `max` : le corps est borné, la ligne n'atteint (ou ne dépasse) pas la cible ; `null` : ajusté. */
  borne: "min" | "max" | null;
}

/**
 * Dichotomie sur le corps : le plus grand corps de [min, max] dont la ligne la plus large ne dépasse pas `cible + tolerance`.
 * `mesurer(taille)` renvoie la largeur (px) de la ligne la plus large à ce corps ; elle croît avec le corps.
 */
export function ajusterTailleTitre(mesurer: (taille: number) => number, options: OptionsAjustement = {}): ResultatAjustement {
  const min = options.min ?? TITRE.min;
  const max = options.max ?? TITRE.max;
  const cible = options.cible ?? TITRE.cible;
  const tolerance = options.tolerance ?? TITRE.tolerance;
  const limite = cible + tolerance;

  const largeurMax = mesurer(max);
  if (largeurMax <= limite) return { taille: max, largeur: largeurMax, borne: "max" };
  const largeurMin = mesurer(min);
  if (largeurMin > limite) return { taille: min, largeur: largeurMin, borne: "min" };

  let bas = min; // tient
  let haut = max; // ne tient pas
  let largeurBas = largeurMin;
  for (let i = 0; i < 40 && haut - bas > 0.05; i++) {
    const milieu = (bas + haut) / 2;
    const largeur = mesurer(milieu);
    if (largeur <= limite) {
      bas = milieu;
      largeurBas = largeur;
      // Assez près de la cible : on s'arrête sans chercher plus fin.
      if (largeur >= cible - tolerance) break;
    } else {
      haut = milieu;
    }
  }
  return { taille: bas, largeur: largeurBas, borne: null };
}

/** Coupe le titre en au plus `nbLignes` lignes, aux espaces, en minimisant l'irrégularité (somme des carrés des écarts de longueur). */
export function decouperTitre(titre: string, nbLignes: number): string[] {
  const mots = titre.split(/\s+/).filter(Boolean);
  const n = Math.max(1, Math.min(Math.floor(nbLignes), mots.length));
  if (n <= 1) return [mots.join(" ")];
  const longueur = (de: number, a: number) => mots.slice(de, a).join(" ").length;
  const ideal = mots.join(" ").length / n;
  // cout[k][i] : plus petite irrégularité pour couper les i premiers mots en k lignes.
  const cout: number[][] = Array.from({ length: n + 1 }, () => Array(mots.length + 1).fill(Infinity));
  const coupe: number[][] = Array.from({ length: n + 1 }, () => Array(mots.length + 1).fill(0));
  cout[0][0] = 0;
  for (let k = 1; k <= n; k++) {
    for (let i = k; i <= mots.length; i++) {
      for (let j = k - 1; j < i; j++) {
        const c = cout[k - 1][j] + (longueur(j, i) - ideal) ** 2;
        if (c < cout[k][i]) {
          cout[k][i] = c;
          coupe[k][i] = j;
        }
      }
    }
  }
  const lignes: string[] = [];
  let fin = mots.length;
  for (let k = n; k >= 1; k--) {
    const debut = coupe[k][fin];
    lignes.unshift(mots.slice(debut, fin).join(" "));
    fin = debut;
  }
  return lignes;
}

export interface MiseEnLignes {
  lignes: string[];
  taille: number;
  largeur: number;
  borne: "min" | "max" | null;
}

/** Part du meilleur corps en dessous de laquelle on préfère ne pas descendre pour gagner une ligne de moins. */
const TOLERANCE_CORPS = 0.88;

/**
 * Essaie 1 à `maxLignes` lignes. Écarte celles qui débordent en largeur (erreur si aucune ne tient), celles qui laissent un mot
 * seul sur une ligne (sauf si toutes en ont), puis celles qui dépassent `hauteurMax`, et garde la plus courte dont le corps
 * vaut au moins 88 % du meilleur. Si aucune ne tient en hauteur, la moins haute.
 */
export function choisirMiseEnLignes(
  titre: string,
  mesurer: (lignes: string[], taille: number) => number,
  { maxLignes, hauteurMax, ...options }: OptionsAjustement & { maxLignes: number; hauteurMax: number },
): MiseEnLignes {
  const candidates: MiseEnLignes[] = [];
  const vues = new Set<string>();
  for (let n = 1; n <= maxLignes; n++) {
    const lignes = decouperTitre(titre, n);
    const cle = lignes.join("\n");
    if (vues.has(cle)) continue;
    vues.add(cle);
    candidates.push({ lignes, ...ajusterTailleTitre((t) => mesurer(lignes, t), options) });
  }
  const limite = (options.cible ?? TITRE.cible) + (options.tolerance ?? TITRE.tolerance);
  const hauteur = (c: MiseEnLignes) => c.lignes.length * c.taille * TITRE.interligne;
  // Jamais de ligne plus large que le cadre, même en dernier recours : on échoue plutôt que de déborder en silence.
  const etroites = candidates.filter((c) => c.largeur <= limite);
  if (etroites.length === 0) {
    throw new Error(`Le titre « ${titre.slice(0, 40)} » ne tient pas dans la largeur du cadre (${limite} px) même au corps minimal`);
  }
  // Un mot seul sur une ligne (hors titre d'une seule ligne) est écarté tant qu'une autre mise en lignes convient.
  const motIsole = (c: MiseEnLignes) => c.lignes.length > 1 && c.lignes.some((l) => !l.includes(" "));
  const sansMotIsole = etroites.filter((c) => !motIsole(c));
  const parmiEtroites = sansMotIsole.length > 0 ? sansMotIsole : etroites;
  const quiTiennent = parmiEtroites.filter((c) => hauteur(c) <= hauteurMax);
  if (quiTiennent.length === 0) return parmiEtroites.reduce((a, b) => (hauteur(b) < hauteur(a) ? b : a));
  const meilleur = Math.max(...quiTiennent.map((c) => c.taille));
  return quiTiennent.find((c) => c.taille >= meilleur * TOLERANCE_CORPS) as MiseEnLignes;
}
