/**
 * Données de la galerie L9a (K20) — les composants K10, K12-K19 et K21 sur les images du jeu d'essai, pour que Will
 * juge à l'image sans rien payer : A et B (cinq cartes, récapitulatif, phrase-choc), C (bandeau des chiffres, alerte
 * Telegram, e-mail structuré, phrase-choc, scène « Ensemble »), E (recherche, dossiers, sources). Textes EXACTS des
 * cartes figées `tests/image-video/fixtures/cartes/*.json` (un test vérifie la concordance), icônes déjà résolues par
 * la table de L1 ; légendes du bandeau = celles de la maquette validée (image 09). Heures simulées (aucune voix).
 * PUR : aucune dépendance au rendu.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import type { EnteteSceneIV } from "../../../src/briques/schema-motion";
import { sceneGalerieC } from "./donnees-galerie";
import type { CorpsMomentIV } from "../../../src/briques/schema-motion/emprise";
import type { BeneficeIV, ChangementRepere } from "./plan-objets";

type Commun = {
  debut: number;
  fin: number;
  fond: Fond;
  entete?: Omit<EnteteSceneIV, "debut" | "fin">;
  /** Témoin des sous-titres (galerie seulement) ; par défaut le titre de l'en-tête. */
  sousTitre?: string;
};

/** Un moment de la galerie : un composant, ses données, son intervalle (secondes depuis le début de la vidéo). */
export type MomentGalerie = Commun & CorpsMomentIV;

export type ProprietesGalerieIV = {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  marque: "axion-ia.com";
  moments: MomentGalerie[];
  /** Repère de progression « k/N », fixe en haut, s'il y a lieu. */
  repere?: { changements: ChangementRepere[]; total: number; prefixe?: string } | null;
};

const BASE = { largeur: 1080, hauteur: 1920, fps: 25, marque: "axion-ia.com" as const };

/** Heures régulières : `n` mots à partir de `debut`, un tous les `pas`. */
const heuresDe = (debut: number, n: number, pas: number) => Array.from({ length: n }, (_, i) => Math.round((debut + i * pas) * 100) / 100);
const nombreDeMots = (phrase: string) => phrase.split(/\s+/).filter(Boolean).length;

/** Bénéfices de l'image A (textes exacts de la carte, icônes résolues). */
export function beneficesA(): BeneficeIV[] {
  return [
    { id: "n02", titre: "Gain de temps immédiat", ligne: "Automatisez vos tâches répétitives, libérez jusqu'à plusieurs heures dès aujourd'hui", icone: "horloge", micro: "horloge-envers" },
    { id: "n03", titre: "Plus de clarté", ligne: "Structurez idées, données, actions avec des outils IA simples", icone: "coche", micro: "post-it" },
    { id: "n04", titre: "Meilleure productivité", ligne: "Processus optimisés, décisions plus rapides", icone: "tendance", micro: "jauge" },
    { id: "n05", titre: "Réduction des coûts", ligne: "Moins d'erreurs, moins de pertes de temps", icone: "euro", micro: "tirelire" },
    { id: "n06", titre: "Résultats concrets", ligne: "Actions applicables tout de suite, impact mesurable dès le 1er jour", icone: "cible", micro: "cible" },
  ];
}

/** Bénéfices de l'image B. */
export function beneficesB(): BeneficeIV[] {
  return [
    { id: "n01", titre: "Gagnez du temps", ligne: "Automatisez les tâches chronophages", icone: "horloge", micro: "horloge-envers" },
    { id: "n02", titre: "Prenez de meilleures décisions", ligne: "IA + données : décidez plus vite et plus juste", icone: "boussole", micro: "bouton-decider" },
    { id: "n03", titre: "Dépassez vos concurrents", ligne: "Innovez, optimisez, gardez une longueur d'avance", icone: "eclair", micro: "course" },
    { id: "n04", titre: "Développez vos compétences", ligne: "Expertise, confiance", icone: "former", micro: "escalier" },
    { id: "n05", titre: "Boostez votre performance", ligne: "Résultats et rentabilité durables", icone: "tendance", micro: "graphe-monte" },
  ];
}

/** Image A : paperboard redessiné (la photo montre des personnes : jamais reprise), 5 cartes, récapitulatif, phrase-choc. */
export function galerieA(): ProprietesGalerieIV {
  const pas = 2.4;
  const heures = heuresDe(3.4, 5, pas);
  const phrase = "Formez-vous aujourd'hui, transformez vos résultats dès *demain.*";
  return {
    ...BASE,
    dureeSec: 23.5,
    repere: { changements: heures.map((t, i) => ({ t: t - 0.15, numero: i + 1 })), total: 5 },
    moments: [
      { sorte: "paperboard", debut: 0, fin: 3.2, fond: "ivoire", entete: { etiquette: "Formation Axion-IA", titre: "La *méthode.*" }, etapes: ["Objectifs", "Actions IA", "Résultats"] },
      { sorte: "benefices", debut: 3.2, fin: 15.4, fond: "ivoire", entete: { etiquette: "Ce que vous gagnez", titre: "*Cinq* bénéfices." }, benefices: beneficesA(), heures },
      { sorte: "recap", debut: 15.4, fin: 18.6, fond: "ivoire", entete: { etiquette: "Vue d'ensemble", titre: "Les *cinq* d'un coup." }, benefices: beneficesA() },
      { sorte: "phrase-choc", debut: 18.6, fin: 23.5, fond: "sombre", sousTitre: "Transformez vos résultats dès *demain.*", phrase, heures: heuresDe(18.9, nombreDeMots(phrase), 0.3) },
    ],
  };
}

/** Image B : 5 cartes, récapitulatif, phrase-choc. */
export function galerieB(): ProprietesGalerieIV {
  const heures = heuresDe(0.4, 5, 2.4);
  const phrase = "Comprendre. Former. *Transformer.*";
  return {
    ...BASE,
    dureeSec: 18.5,
    repere: { changements: heures.map((t, i) => ({ t: t - 0.15, numero: i + 1 })), total: 5 },
    moments: [
      { sorte: "benefices", debut: 0, fin: 12.2, fond: "ivoire", entete: { etiquette: "Vous gagnez", titre: "*Concrètement.*" }, benefices: beneficesB(), heures },
      { sorte: "recap", debut: 12.2, fin: 15.2, fond: "ivoire", entete: { etiquette: "Vue d'ensemble", titre: "Les *cinq* d'un coup." }, benefices: beneficesB() },
      { sorte: "phrase-choc", debut: 15.2, fin: 18.5, fond: "sombre", sousTitre: "Comprendre. Former. *Transformer.*", phrase, heures: heuresDe(15.5, nombreDeMots(phrase), 0.45) },
    ],
  };
}

/** Objets de C et de E, un par moment, avec le repère « 1/3 → 2/3 → 3/3 ». */
export function galerieObjets(): ProprietesGalerieIV {
  const c = sceneGalerieC();
  const phraseC = "Votre client a toujours une réponse. Même à *3h* du matin.";
  return {
    ...BASE,
    dureeSec: 30,
    repere: { changements: [{ t: 0, numero: 1 }, { t: 9.5, numero: 2 }, { t: 20, numero: 3 }], total: 3 },
    moments: [
      { sorte: "alerte", debut: 0, fin: 3, fond: "ivoire", entete: { etiquette: "Chemin 2 · 20 %", titre: "Une *alerte.*" }, source: "Telegram", moment: "maintenant", message: "Intervention requise", t0: 0.6 },
      {
        sorte: "email",
        debut: 3,
        fin: 6.5,
        fond: "ivoire",
        entete: { etiquette: "Chemin 2 · 20 %", titre: "Un e-mail *structuré.*" },
        champs: [
          { nom: "Objet", t: 3.6 },
          { nom: "Contexte", t: 4.3 },
          { nom: "Demande", t: 5 },
          { nom: "Urgence", t: 5.7 },
        ],
      },
      {
        sorte: "bandeau",
        debut: 6.5,
        fin: 9.5,
        fond: "sombre",
        sousTitre: "*Vingt-quatre* heures sur vingt-quatre.",
        etiquette: "Résultat",
        chiffres: [
          { texte: "80 %", legende: "résolus tout de suite", t: 6.8 },
          { texte: "0", legende: "demande perdue", t: 7.6 },
          { texte: "24h/24", legende: "sans pause", t: 8.4 },
        ],
      },
      { sorte: "ensemble", debut: 9.5, fin: 11, fond: "ivoire", entete: { etiquette: "Vue d'ensemble", titre: "Tout le *circuit.*" }, schema: c.schema, options: { chiffresCles: ["80 %", "20 %"] } },
      { sorte: "phrase-choc", debut: 11, fin: 15, fond: "sombre", sousTitre: "Même à trois *heures* du matin.", phrase: phraseC, heures: heuresDe(11.3, nombreDeMots(phraseC), 0.25) },
      {
        sorte: "sources",
        debut: 15,
        fin: 20,
        fond: "ivoire",
        entete: { etiquette: "Ils arrivent de partout", titre: "Cinq *sources.*" },
        // Noms de la carte E, en quinconce (deux rangs) : chacun tient au plancher sur la largeur de deux cases.
        sources: [
          { icone: "mail", nom: "Email", t: 15.4 },
          { icone: "scan", nom: "Scan", t: 15.9 },
          { icone: "dossier", nom: "Drive", t: 16.4 },
          { icone: "message", nom: "WhatsApp", t: 16.9 },
          { icone: "usb", nom: "USB", t: 17.4 },
        ],
        cible: { icone: "etincelles" },
      },
      {
        sorte: "dossiers",
        debut: 20,
        fin: 25,
        fond: "ivoire",
        entete: { etiquette: "L'IA classe", titre: "Tout est *rangé.*" },
        dossiers: [
          { nom: "Clients", t: 20.8 },
          { nom: "Fournisseurs", t: 21.6 },
          { nom: "Contrats", t: 22.4 },
          { nom: "Factures", t: 23.2 },
        ],
      },
      { sorte: "recherche", debut: 25, fin: 30, fond: "ivoire", entete: { etiquette: "Vous cherchez", titre: "Vous *trouvez.*" }, requete: "bon de commande Martin", frappe: 25.5, trouve: { texte: "Trouvé — 3 secondes", t: 27.4 } },
    ],
  };
}

/** Instants des images fixes de la galerie L9a (secondes). */
export const INSTANTS_GALERIE_L9A = Object.freeze({
  A: [
    { nom: "1-paperboard", t: 2.6 },
    { nom: "2-carte-1", t: 4.6 },
    { nom: "3-carte-3", t: 9.4 },
    { nom: "4-carte-5", t: 14.6 },
    { nom: "5-recap", t: 17.6 },
    { nom: "6-phrase-choc", t: 23 },
  ],
  B: [
    { nom: "1-carte-1", t: 1.6 },
    { nom: "2-carte-2", t: 3.9 },
    { nom: "3-carte-5", t: 11.4 },
    { nom: "4-recap", t: 14.4 },
    { nom: "5-phrase-choc", t: 18 },
  ],
  objets: [
    { nom: "1-alerte", t: 1.05 },
    { nom: "2-email", t: 6.2 },
    { nom: "3-bandeau", t: 9.2 },
    { nom: "4-ensemble", t: 10.6 },
    { nom: "5-phrase-choc", t: 14.6 },
    { nom: "6-sources", t: 17.6 },
    { nom: "7-dossiers", t: 22.5 },
    { nom: "8-recherche", t: 29 },
  ],
} as const);
