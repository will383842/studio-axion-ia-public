/**
 * Données de la galerie (K20) des objets de L8 — images D (tri des e-mails : entonnoir puis nuée), E (classement des
 * documents : écran partagé avant / après) et F (saisie unique des commandes : écran partagé puis additionneur
 * 8 + 6 + 5 = 19 et compteur 19 min → 45 sec). Textes et nombres = cartes figées `tests/image-video/fixtures/cartes/`,
 * icônes déjà résolues par la table de L1 (un test vérifie la concordance). Heures des mots simulées (aucune voix).
 * PUR : aucune dépendance au rendu.
 */
import type { ProprietesSceneObjetsIV } from "./plan-objets";

/** Instants des images fixes de la galerie (secondes), par image. */
export const INSTANTS_GALERIE_OBJETS = Object.freeze({
  D: Object.freeze([
    { nom: "D1-chute", t: 3.2 },
    { nom: "D2-sorties", t: 8.9 },
    { nom: "D3-cascade", t: 12.6 },
    { nom: "D4-seize-sur-vingt", t: 15.6 },
  ]),
  E: Object.freeze([
    { nom: "E1-avant", t: 4.4 },
    { nom: "E2-volet", t: 5.35 },
    { nom: "E3-apres", t: 9.4 },
  ]),
  F: Object.freeze([
    { nom: "F1-avant", t: 4.8 },
    { nom: "F2-apres", t: 9.0 },
    { nom: "F3-minuteurs", t: 12.2 },
    { nom: "F4-addition", t: 13.6 },
    { nom: "F5-quarante-cinq", t: 17.2 },
  ]),
} as const);

const CADRE = { largeur: 1080, hauteur: 1920, fps: 25, fond: "ivoire", marque: "axion-ia.com" } as const;

/** Image D : 20 e-mails tombent dans l'entonnoir (16 à gauche, 4 à droite), puis la nuée coche les 16. */
export function sceneGalerieD(): ProprietesSceneObjetsIV {
  return {
    ...CADRE,
    dureeSec: 16.5,
    entetes: [
      { debut: 0, fin: 4.6, etiquette: "Situation type · tri des e-mails", titre: "*20* e-mails." },
      { debut: 4.6, fin: 9.6, etiquette: "L'IA classe et répond", titre: "Deux *sorties.*" },
      { debut: 9.6, fin: 16.5, etiquette: "Répondus automatiquement", titre: "*16* sur 20." },
    ],
    objets: [
      {
        debut: 0,
        fin: 9.6,
        sorte: "entonnoir",
        proprietes: {
          quantite: 20,
          icone: "mail",
          moteur: "IA",
          sorties: [
            { libelle: "Répondus automatiquement", compte: 16, couleur: "vert" },
            { libelle: "Pour vous", compte: 4, couleur: "noir" },
          ],
          chutes: { debut: 1.2, fin: 7.4 },
        },
      },
      { debut: 9.6, fin: 16.5, sorte: "nuee", proprietes: { quantite: 20, cochees: 16, icone: "mail", apparition: 9.7, debutCoches: 10.8, finCoches: 14.6 } },
    ],
  };
}

/** Image E : l'avant (sources en vrac, recherche de 23 min), le volet, l'après (rangé, trouvé en 3 secondes). */
export function sceneGalerieE(): ProprietesSceneObjetsIV {
  return {
    ...CADRE,
    dureeSec: 10.5,
    entetes: [
      { debut: 0, fin: 5.1, etiquette: "Situation type · documents", titre: "Tout en *vrac.*" },
      { debut: 5.1, fin: 10.5, etiquette: "Maintenant", titre: "Rangé, *trouvé.*" },
    ],
    objets: [
      {
        debut: 0,
        fin: 10.5,
        sorte: "ecran-partage",
        proprietes: {
          bascule: 5.1,
          avant: {
            titre: "Avant",
            lignes: [
              { icones: ["mail", "scan", "dossier", "message", "usb"], t: 0.8 },
              { texte: "Documents en vrac", t: 2.2 },
              { texte: "Recherche", valeur: "23 min", t: 3.6 },
            ],
          },
          apres: {
            titre: "Après",
            lignes: [
              { texte: "classe · renomme · archive · indexe", valeur: "IA", t: 6.0 },
              { texte: "Dossiers rangés", t: 7.2 },
              { texte: "Trouvé", valeur: "3 secondes", coche: true, t: 8.4 },
            ],
          },
        },
      },
    ],
  };
}

/** Image F : trois saisies contre une seule, puis 8 + 6 + 5 = 19 min et le compteur qui descend à 45 sec. */
export function sceneGalerieF(): ProprietesSceneObjetsIV {
  return {
    ...CADRE,
    dureeSec: 18,
    entetes: [
      { debut: 0, fin: 5.2, etiquette: "Situation type · commandes", titre: "Trois *saisies.*" },
      { debut: 5.2, fin: 9.6, etiquette: "Maintenant", titre: "Une *seule* saisie." },
      { debut: 9.6, fin: 14.2, etiquette: "Le temps par commande", titre: "Faites le *calcul.*" },
      { debut: 14.2, fin: 18, etiquette: "Maintenant", titre: "*45* secondes." },
    ],
    objets: [
      {
        debut: 0,
        fin: 9.6,
        sorte: "ecran-partage",
        proprietes: {
          bascule: 5.2,
          avant: {
            titre: "Avant",
            lignes: [
              { texte: "Saisie CRM", valeur: "8 min", t: 1.0 },
              { texte: "Saisie Compta", valeur: "6 min", t: 2.0 },
              { texte: "Saisie Stock", valeur: "5 min", t: 3.0 },
              { valeur: "19 min/commande", t: 4.2 },
            ],
          },
          apres: {
            titre: "Après",
            lignes: [
              { texte: "CRM", valeur: "instantané", coche: true, t: 6.0 },
              { texte: "Compta", valeur: "instantané", coche: true, t: 6.6 },
              { texte: "Stock", valeur: "instantané", coche: true, t: 7.2 },
              { valeur: "45 sec", coche: true, t: 8.2 },
            ],
          },
        },
      },
      {
        debut: 9.6,
        fin: 18,
        sorte: "additionneur",
        proprietes: {
          termes: [
            { libelle: "CRM", valeur: 8, t: 10.2 },
            { libelle: "Compta", valeur: 6, t: 11.0 },
            { libelle: "Stock", valeur: 5, t: 11.8 },
          ],
          unite: "min",
          total: { valeur: 19, t: 13.2 },
          apres: { secondes: 45, texte: "45 sec", t: 14.6 },
        },
      },
    ],
  };
}

/** Les trois scènes de la galerie des objets. */
export const SCENES_GALERIE_OBJETS = Object.freeze({ D: sceneGalerieD, E: sceneGalerieE, F: sceneGalerieF });
