/**
 * Plan du type `titre` (R1) : une ou deux lignes d'affiche mot par mot, la dernière dans la lueur orange (vidéo de
 * référence, plans `s6` et `s13`), et les particules lumineuses du fond sombre. PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, type Fond, type JeuEcran, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { c01, heureEvenement, instant, planEntreeEcran, planMarque, planMotParMot } from "./commun";
import { couleursDeLEcran, estFort, groupeDuJeu } from "./fond-fort";

export type ProprietesTitre = Extract<ProprietesEcran, { type: "titre" }>;

/** Nombre de particules d'un fond sombre. */
export const NB_PARTICULES = 16;

/** L3c · nombre de particules par densité tirée (v4 = 16). */
export const DENSITES_PARTICULES = Object.freeze({ v4: NB_PARTICULES, legere: 10, dense: 24 });
/** L3c · écart entre deux groupes de positions (en « groupe codé ») : décale tout le semis en x et en y. */
const PAS_GROUPE = 13;

/**
 * L3c · réglage des particules d'un écran : `base` est le groupe codé de la v4 pour ce type (titre 6, chiffre 0) ; le
 * groupe tiré n (1..5) donne `base + 13 n` ; la densité tirée donne le nombre. Sans jeu : `{ groupe: base, nombre: 16 }`.
 */
export function reglageParticules(jeu: JeuEcran | undefined, base: number): { groupe: number; nombre: number } {
  const d = jeu?.densiteParticules;
  const nombre = d === "legere" || d === "dense" ? DENSITES_PARTICULES[d] : NB_PARTICULES;
  return { groupe: base + PAS_GROUPE * groupeDuJeu(jeu), nombre };
}

/** L3c · particules d'un écran selon son jeu (aucune sur le fond fort, comme la maquette validée). */
export function particulesDeLEcran(p: Pick<ProprietesEcran, "fond" | "largeur" | "hauteur" | "jeu">, base: number, t: number) {
  if (estFort(p.jeu)) return [];
  const r = reglageParticules(p.jeu, base);
  return planParticules(p.fond, r.groupe, p.largeur, p.hauteur, t, r.nombre);
}

/** Une particule lumineuse, en px de l'image, au temps `t` (s) — montée lente, dérive latérale, scintillement. */
export function planParticules(fond: Fond, groupe: number, largeur: number, hauteur: number, t: number, nombre: number = NB_PARTICULES) {
  if (fond !== "sombre") return [];
  return Array.from({ length: nombre }, (_, i) => {
    const x0 = ((i * 197 + groupe * 71) % 1000) + 40;
    const y0 = ((i * 331 + groupe * 53) % 1500) + 200;
    const v = 0.4 + ((i * 7) % 10) / 12;
    return {
      x: ((x0 + 30 * Math.sin(t * v + v * 9)) * largeur) / 1080,
      y: ((y0 - ((t * 40 * v) % 300)) * hauteur) / 1920,
      rayon: (4 * largeur) / 1080,
      opacite: c01(0.25 + 0.35 * Math.abs(Math.sin(t * v * 2))),
      couleur: COULEURS_DUO.orangeVif,
    };
  });
}

/** Pas entre deux mots de la dernière ligne, plus lent : elle porte le sens. */
const PAS_DERNIERE = 0.16;
const PAS_PREMIERE = 0.1;
/** Départ par défaut de la 2ᵉ ligne quand le calage ne donne pas son heure (s). */
const DEPART_DEUXIEME_S = 0.5;

export function planTitre(p: ProprietesTitre, image: number) {
  const t = instant(image, p.fps);
  const { textes } = disposer(p);
  const dernier = p.lignes.length - 1;
  const lignes = p.lignes.map((_, i) => {
    const nom = `titre-${i + 1}`;
    const l = textes.find((x) => x.nom === nom)!;
    const debut = heureEvenement(p, nom) ?? (i === 0 ? 0.02 : DEPART_DEUXIEME_S);
    const pas = i === dernier && dernier > 0 ? PAS_DERNIERE : PAS_PREMIERE;
    const ecoule = t - debut;
    return { nom, pose: l, texte: l.texte, boite: l.boite, taille: l.tailleRendue, ecoule, pas, lueur: i === dernier, tient: l.tient && boiteDans(l.boite, p.zone), mots: planMotParMot(l.texte, ecoule, pas) };
  });
  return {
    t,
    couleurs: couleursDeLEcran(p.fond, p.jeu),
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, textes.find((x) => x.nom === "marque")!.boite),
    lignes,
    particules: particulesDeLEcran(p, 6, t),
  };
}
