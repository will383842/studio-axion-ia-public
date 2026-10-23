/**
 * PLAN de l'objet `calendrier` (R5) : une page de calendrier de biais — bandeau orange, grille de jours ; un jour
 * s'allume, puis une coche surgit. Objet simplifié, une micro-animation. Aucune figure, aucune marque tierce.
 * PUR : ni `remotion` ni React. Textes fournis par `textes` : [0] le mois (bandeau), [1] le jour allumé.
 */
import { ajuster, sansBalises, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse, planSurgir, progres, teinte, va, type ProprietesObjet } from "./commun";
import { animDe, arrivee, cocheTracee, surgie, type AvecAnim, type Mouvement } from "./anim-objets";

export type TexteObjet = { texte: string; boite: BoitePx; taille: number; tient: boolean };

/** Colonnes et rangées de la grille, et jour qui s'allume (rang de la case). */
export const GRILLE_CALENDRIER = Object.freeze({ colonnes: 7, rangees: 5, allumee: 17 });
/** Instants (s depuis le début de l'écran) : le jour s'allume, la coche surgit. */
export const TEMPS_CALENDRIER = Object.freeze({ allume: 0.7, dureeAllume: 0.3, coche: 1.15, dureeCoche: 0.35 });

function poser(texte: string | undefined, boite: BoitePx, voulue: number): TexteObjet | null {
  const t = sansBalises(texte ?? "").trim();
  if (!t) return null;
  const v = Math.min(voulue, boite.hauteur / 1.25);
  const r = ajuster(t, "inter-gras", v, boite.largeur, v * 0.6);
  return { texte: t, boite, taille: r.taille, tient: r.tient };
}

/** L7 · noms des animations 1 et 2 (planches). */
export const ANIMS_CALENDRIER = Object.freeze(["", "grille en vague, coche dessinée", "bandeau qui descend, rangées posées"]);

export function planCalendrier(p: ProprietesObjet & AvecAnim, image?: number) {
  const n = animDe(p);
  return n ? planCalendrierAnime(p, image, n) : planCalendrierV4(p, image);
}

/** Le plan de la v4 (animation n° 0). */
function planCalendrierV4(p: ProprietesObjet, image?: number) {
  const { largeur: w, hauteur: h } = p.boite;
  const t = image === undefined ? p.t : image / 25;
  const c = couleursDuFond(p.fond);
  const bandeau: BoitePx = { x: 0, y: 0, largeur: w, hauteur: h * 0.2 };
  const marge = w * 0.06;
  const zone: BoitePx = { x: marge, y: bandeau.hauteur + h * 0.05, largeur: w - 2 * marge, hauteur: h - bandeau.hauteur - h * 0.1 };
  const { colonnes, rangees, allumee } = GRILLE_CALENDRIER;
  const pas = { x: zone.largeur / colonnes, y: zone.hauteur / rangees };
  const cote = Math.min(pas.x, pas.y) * 0.78;
  const cellules: BoitePx[] = Array.from({ length: colonnes * rangees }, (_, i) => ({
    x: zone.x + (i % colonnes) * pas.x + (pas.x - cote) / 2,
    y: zone.y + Math.floor(i / colonnes) * pas.y + (pas.y - cote) / 2,
    largeur: cote,
    hauteur: cote,
  }));
  const jour = cellules[allumee];
  const x = progres(t, TEMPS_CALENDRIER.allume, TEMPS_CALENDRIER.dureeAllume);
  const surgi = progres(t, TEMPS_CALENDRIER.coche, TEMPS_CALENDRIER.dureeCoche);
  const diametre = cote * 0.78;
  const mois = poser(p.textes?.[0], { x: w * 0.08, y: bandeau.hauteur * 0.15, largeur: w * 0.84, hauteur: bandeau.hauteur * 0.7 }, bandeau.hauteur * 0.5);
  const texteJour = poser(p.textes?.[1], jour, cote * 0.55);
  return {
    boite: { x: 0, y: 0, largeur: w, hauteur: h },
    rayon: Math.min(w, h) * 0.08,
    fiche: COULEURS_DUO.blanc,
    ombre: c.ombre,
    bandeau: { boite: bandeau, couleur: COULEURS_DUO.orange, texte: mois, texteCouleur: COULEURS_DUO.blanc },
    police: { famille: famille("inter-gras"), graisse: graisse("inter-gras") },
    cellules,
    cellulesCouleur: COULEURS_DUO.grisClair,
    cellulesOpacite: 0.45,
    rayonCellule: cote * 0.22,
    /** Le jour allumé : couleur d'accent qui monte, léger grossissement. */
    jour: { index: allumee, boite: jour, progres: x, couleur: teinte(COULEURS_DUO.orangeVif, x), echelle: 1 + 0.12 * Math.sin(Math.PI * x), texte: texteJour, texteCouleur: COULEURS_DUO.blanc },
    coche: {
      boite: { x: jour.x + jour.largeur - diametre * 0.55, y: jour.y + jour.hauteur - diametre * 0.55, largeur: diametre, hauteur: diametre },
      ...planSurgir(surgi),
      couleur: COULEURS_DUO.vert,
      trait: COULEURS_DUO.blanc,
    },
    textes: [mois?.texte, texteJour?.texte].filter((x): x is string => !!x),
  };
}

/**
 * L7 · animations 1 et 2 (le jour s'allume et la coche se pose une fois la grille immobile). 1 : les cases paraissent
 * en vague, du coin haut-gauche au coin bas-droit, et la coche se dessine. 2 : le bandeau descend, les rangées glissent
 * l'une après l'autre (alternativement de gauche et de droite), puis le jour s'allume et la coche surgit.
 */
function planCalendrierAnime(p: ProprietesObjet, image: number | undefined, n: number) {
  const v4 = planCalendrierV4(p, image);
  const t = image === undefined ? p.t : image / 25;
  const { colonnes } = GRILLE_CALENDRIER;
  const allume = n === 1 ? 0.8 : 0.85;
  const x = progres(t, allume, TEMPS_CALENDRIER.dureeAllume);
  const jour = { ...v4.jour, progres: x, couleur: teinte(COULEURS_DUO.orangeVif, x), echelle: 1 + 0.12 * Math.sin(Math.PI * x) };
  let mouvementsCellules: Mouvement[];
  let coche;
  let bandeau: typeof v4.bandeau & { mouvement?: Mouvement } = v4.bandeau;
  let cochage;
  if (n === 1) {
    mouvementsCellules = v4.cellules.map((_, i) => surgie(progres(t, 0.1 + ((i % colonnes) + Math.floor(i / colonnes)) * 0.035, 0.3)));
    const y = progres(t, 1.2, 0.45);
    const c = cocheTracee(y);
    coche = { ...v4.coche, opacite: c.opacite, echelle: c.echelle, rotation: c.rotation, trace: c.trace };
    cochage = y > 0 && y < 1;
  } else {
    // Les rangées partent d'aussi loin que le vide entre la grille et le bord de la page, jamais au-delà.
    const depart = v4.cellules[0]!.x;
    mouvementsCellules = v4.cellules.map((_, i) => {
      const r = Math.floor(i / colonnes);
      return arrivee(progres(t, 0.15 + r * 0.08, 0.3), { dx: (r % 2 ? 1 : -1) * depart });
    });
    // Le bandeau descend depuis le haut de la page (caché au-dessus : la page coupe ce qui la dépasse, comme en v4).
    bandeau = { ...v4.bandeau, mouvement: arrivee(progres(t, 0, 0.45), { dy: -v4.bandeau.boite.hauteur }, va) };
    const y = progres(t, 1.3, TEMPS_CALENDRIER.dureeCoche);
    coche = { ...v4.coche, ...planSurgir(y) };
    cochage = y > 0 && y < 1;
  }
  return { ...v4, bandeau, mouvementsCellules, jour, coche, anim: { numero: n, nom: ANIMS_CALENDRIER[n]!, cochage } };
}
