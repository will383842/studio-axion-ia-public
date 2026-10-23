/**
 * La GALERIE du lot B exprimée comme un PLAN DE MISE EN SCÈNE (`plan-facecam-animee/1`) : mêmes composants, mêmes
 * instants (mots de la prise IMG_7747). Sert d'exemple de référence au réalisateur et de plan par défaut du rendu
 * universel. Les bruitages sont dérivés des événements par `bruitagesDuPlan` (réalisateur, lot C) une fois branché.
 */
import type { PlanFacecamAnimee } from "../../../src/domaine/facecam-animee/plan";
import { VERSION_CHARTE_INTERFACE } from "./charte";
import { GROUPES_GALERIE } from "./donnees-galerie-mots";
import { bruitagesGalerie } from "./Galerie";

/**
 * Version du plan écrite en toutes lettres (Lot I) : le conteneur de rendu ne copie pas `src/domaine/` et son paquet ne sait pas y trouver
 * `zod` ; un import de VALEUR depuis `plan.ts` cassait le paquet des compositions en production. Le type garde l'égalité.
 */
const VERSION_PLAN: PlanFacecamAnimee["version"] = "plan-facecam-animee/1";

export const PLAN_GALERIE: PlanFacecamAnimee = {
  version: VERSION_PLAN,
  charte: VERSION_CHARTE_INTERFACE,
  duree: 93,
  fps: 25,
  largeur: 1080,
  hauteur: 1920,
  prise: { src: "prise.mp4", finSec: 91.1 },
  groupes: GROUPES_GALERIE,
  zooms: [[3.82, 5.4, 1.12], [5.42, 6.9, 1.22], [6.96, 9.4, 1.08], [27.45, 30.0, 1.12], [50.9, 53.7, 1.15], [53.72, 55.25, 1.25], [70.95, 73.3, 1.12], [88.1, 90.45, 1.15]],
  cartes: [
    {
      debut: 9.45, fin: 15.5, titre: "Votre semaine", icone: "calendrier", entree: "chute",
      contenu: {
        type: "calendrier", jours: ["Lun", "Mar", "Mer", "Jeu", "Ven"], rangees: 2,
        pastilles: [
          { jour: 0, rangee: 0, icone: "horloge", a: 9.98 }, { jour: 1, rangee: 0, icone: "document", a: 10.52 }, { jour: 2, rangee: 0, icone: "mail", a: 11.12 },
          { jour: 2, rangee: 1, icone: "crayon", a: 11.68 }, { jour: 3, rangee: 0, icone: "graphique", a: 12.14 }, { jour: 4, rangee: 1, icone: "horloge", a: 12.98, accent: true },
        ],
        rangee: [{ icone: "document", a: 14.12 }, { icone: "mail", a: 14.3 }, { icone: "telephone", a: 14.58 }, { icone: "tableur", a: 14.9 }],
      },
    },
    {
      debut: 19.15, fin: 27.3, titre: "Axion-IA · ce qu'on fait", icone: "etincelles", entree: "surgit",
      contenu: {
        type: "grille", colonnes: 2,
        vignettes: [
          { a: 20.22, legende: "Former", contenu: { type: "fiche", lignes: 3, icone: "former", iconeA: 20.9 } },
          { a: 21.8, legende: "Accompagner", contenu: { type: "texte", titre: "1:1", pastille: "Dirigeant" } },
          { a: 23.92, legende: "Auditer", contenu: { type: "ecran", barres: 3 } },
          { a: 25.3, legende: "Automatiser", contenu: { type: "image" } },
        ],
      },
    },
    {
      debut: 33.75, fin: 38.25, titre: "Le réflexe", icone: "plus", entree: "glisse",
      contenu: {
        type: "logos",
        compteur: [{ valeur: 3, legende: "outils", a: 33.8 }, { valeur: 4, legende: "outils", a: 33.96 }, { valeur: 5, legende: "avec l'embauche", a: 35.18 }],
        tuiles: [{ icone: "mail", a: 33.8 }, { icone: "tableur", a: 33.85 }, { icone: "calendrier", a: 33.9 }, { icone: "robot", a: 33.96 }, { icone: "utilisateur", a: 35.18 }],
        cadenas: { a: 37.2, texte: "Et la fuite ?" },
      },
    },
    {
      debut: 39.85, fin: 50.75, titre: "Un dirigeant", icone: "utilisateur", entree: "chute",
      contenu: {
        type: "statuts", avant: { texte: "À faire" }, apres: { texte: "Fait", icone: "coche" },
        lignes: [
          { nom: "Recruter", detail: "pour l'administratif", a: 41.32, bascule: 46.42, apres: { texte: "Inutile" } },
          { nom: "Où part le temps", detail: "regardé d'abord", a: 44.08, bascule: 44.92, apres: { texte: "Trouvé", icone: "loupe" } },
          { nom: "Les équipes", detail: "leur après-midi", a: 48.0, bascule: 48.62, apres: { texte: "Retrouvé", icone: "coche" } },
          { nom: "Le dirigeant", detail: "son week-end", a: 49.46, bascule: 49.94, apres: { texte: "Retrouvé", icone: "coche" } },
        ],
      },
    },
    {
      debut: 55.25, fin: 59.6, titre: "Le diagnostic fuite", icone: "message", entree: "surgit",
      contenu: {
        type: "chat", indication: "Votre question…", message: { texte: "Un premier diagnostic ?", a: 55.4, vitesse: 30 }, reponse: { a: 56.2, lignes: 2, icone: "etincelles" },
        puces: [{ texte: "Gratuit", icone: "etoile", a: 56.24 }, { texte: "45 min", icone: "horloge", a: 57.36 }, { texte: "En visio", icone: "video", a: 58.0 }],
      },
    },
    {
      debut: 59.7, fin: 67.3, titre: "En 45 minutes", icone: "loupe", entree: "chute",
      contenu: {
        type: "liste", entete: { texte: "Trois questions", icone: "loupe", a: 59.75 },
        lignes: [{ texte: "Où part votre temps", icone: "horloge", a: 59.96 }, { texte: "Ce qui change en premier", icone: "eclair", a: 62.72 }, { texte: "Ce qu'il vous faut", icone: "boussole", a: 65.58 }],
        cocheA: 66.3, badge: { texte: "Vos priorités", icone: "etoile", a: 66.75 },
      },
    },
    {
      debut: 73.35, fin: 76.05, titre: "Vos priorités", icone: "graphique", entree: "glisse",
      contenu: {
        type: "graphique", baseA: 73.45, mention: "Illustration",
        barres: [{ hauteur: 0.9, a: 73.9, libelle: "N° 1", accent: true }, { hauteur: 0.62, a: 74.1, libelle: "N° 2" }, { hauteur: 0.38, a: 74.3, libelle: "N° 3" }],
        pastilles: [{ texte: "Claires", icone: "coche", a: 74.74 }, { texte: "Classées", icone: "graphique", a: 75.14 }],
      },
    },
    {
      debut: 76.15, fin: 81.7, titre: "Le calcul (exemple)", icone: "euro", entree: "chute",
      contenu: {
        type: "calcul", unite: "h",
        avant: { titre: "Mauvaise cible", a: 76.3, lignes: [{ libelle: "Outil au hasard", valeur: 10, a: 76.9 }, { libelle: "Essais", valeur: 10, a: 77.68 }], libelleTotal: "Temps perdu", totalA: 78.3, barreA: 78.6 },
        apres: { titre: "Bonne fuite", a: 79.2, lignes: [{ libelle: "Tâche ciblée", valeur: 2, a: 79.58 }, { libelle: "Gain", valeur: 2, a: 80.0 }], libelleTotal: "Temps passé", totalA: 80.2, barreA: 80.4 },
        barreTotalAvantA: 80.8, badge: { texte: "Exemple", a: 81.0 },
      },
    },
    {
      debut: 81.85, fin: 88.0, titre: "Commentaires", icone: "message", entree: "surgit",
      contenu: {
        type: "commentaire", publication: { auteur: "Axion-IA", texte: "Du temps vous échappe ? Le diagnostic fuite, gratuit.", a: 81.95 },
        champ: { indication: "Votre commentaire…", a: 82.3 }, saisie: { texte: "DIAGNOSTIC", debut: 82.9, fin: 83.9 },
        bouton: { texte: "Publier", a: 84.3 }, commentaire: { auteur: "Vous", a: 84.5, jaimeA: 85.2 },
        notification: { titre: "Nouveau message", texte: "Votre lien de réservation", a: 86.0 },
      },
    },
  ],
  fenetres: [
    { debut: 15.75, fin: 19.05, media: "images/horloge.jpg", recherche: "horloge sur un bureau", noirEtBlancA: 17.2, etiquette: { texte: "Sans bruit", a: 18.0 } },
    { debut: 30.0, fin: 31.85, media: "images/equipe.jpg", recherche: "équipe au travail", entree: "zoom", etiquette: { texte: "Partout", a: 30.1 } },
    { debut: 67.75, fin: 70.95, media: "images/robot.jpg", recherche: "robot assistant", entree: "bas", capture: true, etiquette: { texte: "Audit complet", a: 69.34 } },
  ],
  calques: [
    { type: "etiquette", debut: 4.3, fin: 6.0, texte: "Problème de travail", barreA: 5.42 },
    { type: "etiquette", debut: 5.95, fin: 8.9, texte: "Une fuite", fond: "orange", icones: [{ nom: "horloge", a: 6.1 }, { nom: "euro", a: 6.3 }] },
    { type: "glisse", debut: 7.5, fin: 9.3, texte: "Pour vous", icone: "utilisateur" },
    { type: "etiquette", debut: 27.45, fin: 30.0, texte: "Toutes les tailles", icones: [{ nom: "utilisateur", a: 27.5 }, { nom: "utilisateurs", a: 28.5 }, { nom: "batiment", a: 29.62 }] },
    { type: "etiquette", debut: 32.1, fin: 33.7, texte: "Colmater", fond: "orange", barreA: 33.0 },
    { type: "glisse", debut: 38.3, fin: 39.85, texte: "Trouver la fuite", icone: "loupe" },
    { type: "etiquette", debut: 53.75, fin: 55.25, texte: "Diagnostic fuite", fond: "orange", icones: [{ nom: "loupe", a: 54.26 }] },
    { type: "compteur", debut: 56.94, fin: 59.6, de: 0, a: 45, dureeDefilement: 1.3, suffixe: " min", legende: "gratuit", fond: "orange" },
    { type: "compteur", debut: 71.4, fin: 73.3, de: 0, a: 45, dureeDefilement: 1.0, suffixe: " minutes" },
    { type: "logos", debut: 88.1, fin: 90.45, logos: [{ icone: "calendrier", a: 88.1 }, { icone: "telephone", a: 89.02 }, { icone: "loupe", a: 89.34 }, { icone: "etoile", a: 90.16 }] },
  ],
  fin: { debut: 90.45, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["former", "boussole", "loupe", "eclair"], appel: "Le lien en commentaire" },
  sons: bruitagesGalerie(),
  pastilles: true,
};
