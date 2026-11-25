/**
 * FIXTURE (lot QUAL-1) : plan composé À LA MAIN pour le script du fondateur (stocks, ~41,4 s, 4:5), réutilisable par
 * QUAL-3 (dessin) et QUAL-5 (chaîne). Tous les textes sont des suites contiguës du script, la phrase titre ou le libellé
 * de fin ; aucun chiffre.
 */
import T11 from "./plan-sans-voix-t11.json";
import type { PlanComposeSansVoix } from "@/briques/plan-scenes/tutoriel/sans-voix/types";

export const SCRIPT_STOCKS =
  "Vous perdez du temps à compter vos stocks à la main ? Voici un tableau de bord qui le fait pour vous. En haut, trois chiffres : les articles en stock, ceux qui passent sous le seuil, et la valeur totale. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article ouvre son historique : entrées, sorties, et date de la prochaine rupture prévue. Quand un article passe sous le seuil, une alerte part toute seule. Vous décidez en une minute au lieu d'une heure. Vous voulez le même pour votre entreprise ? Prenez rendez-vous.";

export const DUREE_STOCKS_MS = 41400;

export const PLAN_SANS_VOIX_STOCKS: PlanComposeSansVoix = {
  version: "sans-voix-1",
  format: { largeur: 1080, hauteur: 1350, fps: 25 },
  dureeMs: DUREE_STOCKS_MS,
  basPct: 87,
  scenes: [
    { id: "s1", genre: "titre", debutMs: 0, finMs: 5000, mots: { premier: 0, dernier: 18 }, texte: "Suivre ses stocks avec un tableau de bord simple" },
    {
      id: "s2",
      genre: "ecran",
      debutMs: 5000,
      finMs: 34000,
      mots: { premier: 19, dernier: 88 },
      titreFenetre: "Tableau de bord",
      evenements: [
        {
          genre: "cartes-chiffres",
          aMs: 9800,
          cartes: [
            { libelle: "Articles en stock", aMs: 10000, source: { premier: 30, dernier: 32 } },
            { libelle: "Passent sous le seuil", aMs: 12600, source: { premier: 35, dernier: 39 } },
            { libelle: "Valeur totale", aMs: 14800, source: { premier: 42, dernier: 44 } },
          ],
        },
        { genre: "liste", aMs: 17000, titre: "Articles à commander", lignes: 4, source: { premier: 47, dernier: 53 } },
        { genre: "tri", aMs: 20000, etiquette: "Par urgence", source: { premier: 54, dernier: 56 } },
        { genre: "clic", aMs: 23000, cible: "ligne-1", source: { premier: 57, dernier: 58 } },
        {
          genre: "panneau",
          aMs: 23600,
          titre: "Historique",
          source: { premier: 62, dernier: 62 },
          rubriques: [
            { libelle: "Entrées", aMs: 25200, source: { premier: 63, dernier: 63 } },
            { libelle: "Sorties", aMs: 26300, source: { premier: 64, dernier: 64 } },
            { libelle: "Date de la prochaine rupture prévue", aMs: 27800, source: { premier: 66, dernier: 71 } },
          ],
        },
        { genre: "alerte", aMs: 30000, texte: "Un article passe sous le seuil", cartePulse: 1, source: { premier: 73, dernier: 78 } },
        { genre: "focus", aMs: 8700, finMs: 9900, cible: "cartes", source: { premier: 25, dernier: 29 } },
        { genre: "focus", aMs: 15600, finMs: 16800, cible: "cartes", source: { premier: 30, dernier: 44 } },
        { genre: "focus", aMs: 28000, finMs: 29200, cible: "panneau", source: { premier: 66, dernier: 71 } },
      ],
    },
    { id: "s3", genre: "repere", debutMs: 34000, finMs: 38000, mots: { premier: 86, dernier: 95 }, avant: "une heure", apres: "une minute", barreAMs: 36400, apresAMs: 35600 },
    { id: "s4", genre: "appel", debutMs: 38000, finMs: 41400, mots: { premier: 96, dernier: 106 }, question: "Vous voulez le même pour votre entreprise ?", bouton: "Prenez rendez-vous", clicAMs: 40300, marque: "Axion IA", site: "axion-ia.com" },
  ],
};

/** Plan RÉEL du rendu de contrôle du tour 4 (sortie de QUAL-2 sur le script du fondateur) : alerte à 32,1 s alors que l'écran
 *  se termine à 33,8 s ; clic de liste à 22 s ; « une minute » dit AVANT « une heure ». Sert aux tests de timing réel. */
const REEL_BRUT = {
 "version": "sans-voix-1",
 "format": {
  "largeur": 1080,
  "hauteur": 1350,
  "fps": 25
 },
 "dureeMs": 41925,
 "basPct": 87,
 "scenes": [
  {
   "id": "s1-titre",
   "genre": "titre",
   "texte": "Suivre ses stocks avec un tableau de bord simple",
   "surTitre": "Vous perdez du temps à compter vos stocks à la main ?",
   "mots": {
    "premier": 0,
    "dernier": 10
   },
   "debutMs": 0,
   "finMs": 4795
  },
  {
   "id": "s2-ecran",
   "genre": "ecran",
   "titreFenetre": "Tableau de bord",
   "evenements": [
    {
     "genre": "cartes-chiffres",
     "aMs": 9671,
     "cartes": [
      {
       "libelle": "Articles en stock",
       "aMs": 11289,
       "source": {
        "premier": 26,
        "dernier": 28
       }
      },
      {
       "libelle": "Passent sous le seuil",
       "aMs": 13292,
       "source": {
        "premier": 31,
        "dernier": 34
       }
      },
      {
       "libelle": "Valeur totale",
       "aMs": 15680,
       "source": {
        "premier": 37,
        "dernier": 38
       }
      }
     ]
    },
    {
     "genre": "liste",
     "aMs": 18248,
     "titre": "Articles à commander",
     "lignes": 4,
     "source": {
      "premier": 43,
      "dernier": 47
     }
    },
    {
     "genre": "tri",
     "aMs": 20251,
     "etiquette": "Par urgence",
     "source": {
      "premier": 48,
      "dernier": 50
     }
    },
    {
     "genre": "clic",
     "aMs": 21969,
     "cible": "ligne-1",
     "source": {
      "premier": 52,
      "dernier": 55
     }
    },
    {
     "genre": "panneau",
     "aMs": 23508,
     "titre": "Historique",
     "rubriques": [
      {
       "libelle": "Entrées",
       "aMs": 25126,
       "source": {
        "premier": 59,
        "dernier": 59
       }
      },
      {
       "libelle": "Sorties",
       "aMs": 25591,
       "source": {
        "premier": 60,
        "dernier": 60
       }
      },
      {
       "libelle": "Date de la prochaine rupture prévue",
       "aMs": 26440,
       "source": {
        "premier": 62,
        "dernier": 67
       }
      }
     ],
     "source": {
      "premier": 56,
      "dernier": 67
     }
    },
    {
     "genre": "alerte",
     "aMs": 32085,
     "texte": "Un article passe sous le seuil",
     "source": {
      "premier": 69,
      "dernier": 76
     },
     "cartePulse": 1
    },
    {
     "genre": "focus",
     "aMs": 4795,
     "finMs": 8595,
     "cible": "ensemble",
     "source": {
      "premier": 11,
      "dernier": 20
     }
    },
    {
     "genre": "focus",
     "aMs": 8822,
     "finMs": 16403,
     "cible": "cartes",
     "source": {
      "premier": 21,
      "dernier": 38
     }
    },
    {
     "genre": "focus",
     "aMs": 16629,
     "finMs": 21358,
     "cible": "liste",
     "source": {
      "premier": 39,
      "dernier": 50
     }
    }
   ],
   "mots": {
    "premier": 11,
    "dernier": 79
   },
   "debutMs": 4795,
   "finMs": 33803
  },
  {
   "id": "s3-repere",
   "genre": "repere",
   "avant": "une heure",
   "apres": "une minute",
   "barreAMs": 36495,
   "apresAMs": 34957,
   "mots": {
    "premier": 80,
    "dernier": 88
   },
   "debutMs": 33803,
   "finMs": 37445
  },
  {
   "id": "s4-appel",
   "genre": "appel",
   "question": "Vous voulez le même pour votre entreprise ?",
   "bouton": "Prendre rendez-vous",
   "clicAMs": 41086,
   "mots": {
    "premier": 89,
    "dernier": 97
   },
   "debutMs": 37445,
   "finMs": 41925
  }
 ]
} as unknown as PlanComposeSansVoix;

/** Mêmes scènes, identifiants normalisés en s1..s4 (comme la fixture à la main). */
/** Ancien plan réel (tour 10) : alerte sans déclencheur distinct. */
export const PLAN_SANS_VOIX_REEL_ANCIEN: PlanComposeSansVoix = { ...REEL_BRUT, scenes: REEL_BRUT.scenes.map((sc, i) => ({ ...sc, id: `s${i + 1}` })) };

/** PLAN RÉEL du tour 11 (alerte à 28 928 ms, déclencheur à 32 085 ms, cartes citées à 11 289 / 13 292 / 15 680 ms), identifiants normalisés en s1..s4. */
const REEL_T11 = T11 as unknown as PlanComposeSansVoix;
export const PLAN_SANS_VOIX_REEL: PlanComposeSansVoix = { ...REEL_T11, scenes: REEL_T11.scenes.map((sc, i) => ({ ...sc, id: `s${i + 1}` })) };
