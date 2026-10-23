/**
 * Plan du type `chiffre` (R1) : un grand nombre dans la lueur orange, son unité, trois pastilles. Deux variantes,
 * selon `compteur` : le nombre tombe en zoom flou (vidéo de référence, plan `s2`), ou il se compte de 0 à sa valeur
 * dans un anneau qui se ferme (plan `s12`). PUR : ni `remotion` ni React.
 */
import { boiteDans, disposer, largeurTexte, type BoitePx, type ProprietesEcran, type TextePose } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { doux, famille, heureEvenement, instant, planEntreeEcran, planMarque, planMotParMot, progres, teinte, va } from "./commun";
import { couleursDeLEcran, estFort } from "./fond-fort";
import { particulesDeLEcran } from "./Titre";

export type ProprietesChiffre = Extract<ProprietesEcran, { type: "chiffre" }>;

/** Durée du comptage de l'anneau (s) et de l'arrivée du nombre en zoom (s). */
export const DUREE_COMPTAGE_S = 0.55;
const DUREE_ARRIVEE_S = 0.3;
/** Anneau de la référence : rayon 320, trait 30, dans une boîte de 740 px. */
const RAYON_REL = 320 / 740;
const TRAIT_REL = 30 / 740;
/** Pastille de la référence (36 px de texte) : marges, écart. */
const PASTILLE_MARGE_X = 28 / 36;
const PASTILLE_MARGE_Y = 12 / 36;
const PASTILLE_ECART = 32 / 36;
const PASTILLE_ECART_S = 0.16;
const PASTILLE_DEPART_S = 0.6;

/** Pastilles posées côte à côte, centrées dans la boîte du texte `pastilles`, réduites pour tenir en largeur. */
export function poserPastilles(textes: string[], pose: TextePose): { texte: string; boite: BoitePx; taille: number }[] {
  const mesure = (s: number) => textes.map((x) => largeurTexte(x, "inter-gras", s) + 2 * PASTILLE_MARGE_X * s);
  const total = (s: number) => mesure(s).reduce((a, b) => a + b, 0) + PASTILLE_ECART * s * Math.max(0, textes.length - 1);
  const base = pose.tailleRendue;
  const taille = Math.min(base, (base * pose.boite.largeur) / Math.max(1, total(base)));
  const largeurs = mesure(taille);
  const hauteur = taille * (1.3 + 2 * PASTILLE_MARGE_Y);
  let x = pose.boite.x + (pose.boite.largeur - total(taille)) / 2;
  const y = pose.boite.y + (pose.boite.hauteur - hauteur) / 2;
  return textes.map((texte, i) => {
    const boite = { x, y, largeur: largeurs[i], hauteur };
    x += largeurs[i] + PASTILLE_ECART * taille;
    return { texte, boite, taille };
  });
}

export function planChiffre(p: ProprietesChiffre, image: number) {
  const t = instant(image, p.fps);
  const { textes, boites } = disposer(p);
  const pose = (nom: string) => textes.find((x) => x.nom === nom);
  const nombre = pose("nombre")!;
  const unite = pose("unite")!;
  const zone = pose("pastilles");
  const couleurs = couleursDeLEcran(p.fond, p.jeu);
  const fort = estFort(p.jeu);
  const anneauBoite = boites.objets.find((o) => o.nom === "anneau")!.boite;

  // Variante « arrivée » : zoom 1,5 → 1 avec flou. Variante « compteur » : 0 → nombre, anneau, petite pulsation.
  const debutCompteur = heureEvenement(p, "compteur") ?? 0;
  const arrivee = progres(t, 0, DUREE_ARRIVEE_S);
  const x = p.compteur ? va(progres(t, debutCompteur, DUREE_COMPTAGE_S)) : 1;
  const pulsation = p.compteur ? 1 + 0.16 * Math.sin(Math.PI * progres(t, debutCompteur + DUREE_COMPTAGE_S, 0.3)) : 1;
  const valeur = p.compteur ? Math.round(p.nombre * x) : p.nombre;

  const rayon = anneauBoite.largeur * RAYON_REL;
  const circonference = 2 * Math.PI * rayon;
  const anneau = p.compteur
    ? {
        boite: anneauBoite,
        cx: anneauBoite.x + anneauBoite.largeur / 2,
        cy: anneauBoite.y + anneauBoite.hauteur / 2,
        rayon,
        trait: anneauBoite.largeur * TRAIT_REL,
        circonference,
        decalage: circonference * (1 - x),
        fraction: x,
        // L3c · fond fort : anneau nuit sur piste nuit légère (l'orange se perdrait sur la terracotta).
        couleurTrait: fort ? COULEURS_DUO.nuit : COULEURS_DUO.orangeVif,
        couleurPiste: fort ? teinte(COULEURS_DUO.nuit, 0.18) : teinte(p.fond === "sombre" ? COULEURS_DUO.blanc : COULEURS_DUO.encre, 0.12),
      }
    : null;

  const pastilles = zone
    ? poserPastilles(p.pastilles, zone).map((q, k) => {
        const y = progres(t, (heureEvenement(p, `pastille-${k + 1}`) ?? PASTILLE_DEPART_S + k * PASTILLE_ECART_S), 0.28);
        return { ...q, opacite: y, decalageY: (1 - doux(y)) * 30, bordure: teinte(couleurs.texte, 0.28), couleur: couleurs.texte, famille: famille("inter-gras"), tient: boiteDans(q.boite, p.zone) };
      })
    : [];

  return {
    t,
    couleurs,
    entree: planEntreeEcran(p, t),
    marque: planMarque(p, textes.find((q) => q.nom === "marque")!.boite),
    nombre: {
      pose: nombre,
      texte: String(valeur),
      valeur,
      boite: nombre.boite,
      taille: nombre.tailleRendue,
      opacite: p.compteur ? 1 : Math.min(1, arrivee * 3),
      echelle: p.compteur ? pulsation : 1.5 - 0.5 * doux(arrivee),
      flou: p.compteur ? 0 : arrivee < 1 ? (1 - arrivee) * 18 : 0,
      tient: nombre.tient && boiteDans(nombre.boite, p.zone),
    },
    unite: { pose: unite, texte: unite.texte, ecoule: t - (heureEvenement(p, "unite") ?? 0.2), mots: planMotParMot(unite.texte, t - (heureEvenement(p, "unite") ?? 0.2)), tient: unite.tient && boiteDans(unite.boite, p.zone) },
    anneau,
    pastilles,
    particules: particulesDeLEcran(p, 0, t),
  };
}
