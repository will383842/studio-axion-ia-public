/**
 * Valeurs attendues de la brique `chaine-scenes`, produites UNE FOIS par les fonctions de la chaîne par scènes
 * existante (`plansTableau`, `commandeTableau`, `empreinte`) au commit 2ed2d61, puis écrites ici telles quelles.
 * Aucun import de `src/moteurs/` : la brique est une copie, ce fichier en garde la preuve.
 */

/** Version de chaîne qui entrait dans les empreintes au commit 2ed2d61. */
export const VERSION_ATTENDUE = "fabrication-tableau/1";

/** Les trois jeux de scènes (entrées). */
export const JEUX = [
  {
    "nom": "une scène",
    "videoId": "v-1",
    "texteScript": "Une seule phrase.",
    "dureeSec": 4.4,
    "centre": 80,
    "scenes": [
      {
        "id": "s1",
        "debutSec": 0,
        "finSec": 4.4,
        "cle": "studio/dev/scenes/v-1/a.mp4"
      }
    ]
  },
  {
    "nom": "trois scènes",
    "videoId": "v-2",
    "texteScript": "Première. Deuxième. Troisième.",
    "dureeSec": 12.5,
    "centre": 83.12,
    "personnageId": "perso-1",
    "scenes": [
      {
        "id": "s1",
        "debutSec": 0,
        "finSec": 3.2,
        "cle": "k/1.mp4"
      },
      {
        "id": "s2",
        "debutSec": 3.2,
        "finSec": 8.75,
        "cle": "k/2.mp4"
      },
      {
        "id": "s3",
        "debutSec": 8.75,
        "finSec": 12.5,
        "cle": "k/3.mp4"
      }
    ]
  },
  {
    "nom": "cinq scènes et une fin",
    "videoId": "v-3",
    "texteScript": "Le cas. Le problème. La solution. Le résultat. La suite.",
    "dureeSec": 21.0004,
    "centre": 79.5,
    "prononciations": [
      {
        "mot": "MD",
        "prononciation": "èmdé"
      }
    ],
    "scenes": [
      {
        "id": "accroche",
        "debutSec": 0,
        "finSec": 0.30000000000000004,
        "cle": "k/a.mp4"
      },
      {
        "id": "étape-1",
        "debutSec": 0.30000000000000004,
        "finSec": 5.1234,
        "cle": "k/b.mp4"
      },
      {
        "id": "étape-2",
        "debutSec": 5.1234,
        "finSec": 9.9996,
        "cle": "k/c.mp4"
      },
      {
        "id": "resultat",
        "debutSec": 9.9996,
        "finSec": 17.5,
        "cle": "k/d.mp4"
      },
      {
        "id": "fin",
        "debutSec": 17.5,
        "finSec": 21.0004,
        "cle": "k/e.mp4"
      }
    ]
  }
];

/** Sorties attendues, dans l’ordre de `JEUX`. */
export const ATTENDUS = [
  {
    "plans": [
      {
        "ordre": 1,
        "segmentId": "s1",
        "debutSec": 0,
        "finSec": 4.4,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:s1",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      }
    ],
    "commande": {
      "versionContrat": 2,
      "moteurId": "montage-tableau",
      "videoId": "v-1",
      "formatId": "tableau-anime",
      "versionFormat": 1,
      "profilRenduVersion": 1,
      "dureeCibleSec": 4,
      "ratios": [
        "9:16"
      ],
      "script": {
        "blocs": [],
        "texteComplet": "Une seule phrase."
      },
      "distribution": [
        {
          "role": "voix",
          "source": "double"
        }
      ],
      "styles": {
        "sousTitres": {
          "id": "sous-titres-encre",
          "nom": "Encre",
          "valeur": {
            "type": "style-sous-titres",
            "gabarit": "minimal",
            "police": "Inter Bold",
            "tailleRelative": 1,
            "taillePx": 60,
            "motsParLigne": 6,
            "motsParLigneMin": 3,
            "casse": "normale",
            "animation": "aucune",
            "couleurAccent": "creme",
            "jetonEmphase": "orange-vif",
            "modeEmphase": "mot",
            "position": "centre",
            "positionPct": 80,
            "contourPx": 0,
            "ombrePx": 0,
            "dureeMinGroupeSec": 0.6,
            "dureeMaxGroupeSec": 1.6,
            "chiffresAlignes": true,
            "encre": {
              "texte": "#110A05",
              "page": "#E9DCC8"
            }
          }
        },
        "decor": {
          "id": "page-charte",
          "nom": "Page de la charte",
          "valeur": {
            "type": "decor",
            "mode": "teinte",
            "teinte": "#E9DCC8",
            "profondeurFlou": 0,
            "directionLumiere": "face",
            "positionSujet": 0.5,
            "clair": true
          }
        },
        "lut": null,
        "musique": null
      },
      "briques": {
        "sous-titres": true,
        "etalonnage": false,
        "illustrations": true,
        "son": true,
        "habillage": false,
        "texte-ecran": false,
        "mention-ia": false
      },
      "entrees": {},
      "reglages": {},
      "plans": [],
      "prononciations": [],
      "mentionIA": {
        "incrustee": false,
        "position": "haut-droite",
        "dureeSec": 0,
        "texte": "",
        "dansLegende": false
      },
      "budgetMax": {
        "centimes": 0,
        "devise": "EUR"
      },
      "construiteLe": "1970-01-01T00:00:00.000Z",
      "sousTitres": {
        "base": "minimal",
        "intensite": "equilibre"
      },
      "medias": {
        "scene:s1": {
          "cle": "studio/dev/scenes/v-1/a.mp4",
          "mime": "video/mp4",
          "dureeSec": 4.4
        }
      }
    },
    "empreinte": "95a2a880606297bb791d3e9e9fb39311"
  },
  {
    "plans": [
      {
        "ordre": 1,
        "segmentId": "s1",
        "debutSec": 0,
        "finSec": 3.2,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:s1",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 2,
        "segmentId": "s2",
        "debutSec": 3.2,
        "finSec": 8.75,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:s2",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 3,
        "segmentId": "s3",
        "debutSec": 8.75,
        "finSec": 12.5,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:s3",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      }
    ],
    "commande": {
      "versionContrat": 2,
      "moteurId": "montage-tableau",
      "videoId": "v-2",
      "formatId": "tableau-anime",
      "versionFormat": 1,
      "profilRenduVersion": 1,
      "dureeCibleSec": 13,
      "ratios": [
        "9:16"
      ],
      "script": {
        "blocs": [],
        "texteComplet": "Première. Deuxième. Troisième."
      },
      "distribution": [
        {
          "role": "voix",
          "source": "double",
          "personnageId": "perso-1"
        }
      ],
      "styles": {
        "sousTitres": {
          "id": "sous-titres-encre",
          "nom": "Encre",
          "valeur": {
            "type": "style-sous-titres",
            "gabarit": "minimal",
            "police": "Inter Bold",
            "tailleRelative": 1,
            "taillePx": 60,
            "motsParLigne": 6,
            "motsParLigneMin": 3,
            "casse": "normale",
            "animation": "aucune",
            "couleurAccent": "creme",
            "jetonEmphase": "orange-vif",
            "modeEmphase": "mot",
            "position": "centre",
            "positionPct": 83.12,
            "contourPx": 0,
            "ombrePx": 0,
            "dureeMinGroupeSec": 0.6,
            "dureeMaxGroupeSec": 1.6,
            "chiffresAlignes": true,
            "encre": {
              "texte": "#110A05",
              "page": "#E9DCC8"
            }
          }
        },
        "decor": {
          "id": "page-charte",
          "nom": "Page de la charte",
          "valeur": {
            "type": "decor",
            "mode": "teinte",
            "teinte": "#E9DCC8",
            "profondeurFlou": 0,
            "directionLumiere": "face",
            "positionSujet": 0.5,
            "clair": true
          }
        },
        "lut": null,
        "musique": null
      },
      "briques": {
        "sous-titres": true,
        "etalonnage": false,
        "illustrations": true,
        "son": true,
        "habillage": false,
        "texte-ecran": false,
        "mention-ia": false
      },
      "entrees": {},
      "reglages": {},
      "plans": [],
      "prononciations": [],
      "mentionIA": {
        "incrustee": false,
        "position": "haut-droite",
        "dureeSec": 0,
        "texte": "",
        "dansLegende": false
      },
      "budgetMax": {
        "centimes": 0,
        "devise": "EUR"
      },
      "construiteLe": "1970-01-01T00:00:00.000Z",
      "sousTitres": {
        "base": "minimal",
        "intensite": "equilibre"
      },
      "medias": {
        "scene:s1": {
          "cle": "k/1.mp4",
          "mime": "video/mp4",
          "dureeSec": 3.2
        },
        "scene:s2": {
          "cle": "k/2.mp4",
          "mime": "video/mp4",
          "dureeSec": 5.55
        },
        "scene:s3": {
          "cle": "k/3.mp4",
          "mime": "video/mp4",
          "dureeSec": 3.75
        }
      }
    },
    "empreinte": "227480fdc076c55377d5c8220e1c3fd7"
  },
  {
    "plans": [
      {
        "ordre": 1,
        "segmentId": "accroche",
        "debutSec": 0,
        "finSec": 0.30000000000000004,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:accroche",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 2,
        "segmentId": "étape-1",
        "debutSec": 0.30000000000000004,
        "finSec": 5.1234,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:étape-1",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 3,
        "segmentId": "étape-2",
        "debutSec": 5.1234,
        "finSec": 9.9996,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:étape-2",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 4,
        "segmentId": "resultat",
        "debutSec": 9.9996,
        "finSec": 17.5,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:resultat",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      },
      {
        "ordre": 5,
        "segmentId": "fin",
        "debutSec": 17.5,
        "finSec": 21.0004,
        "texte": "",
        "sourceImage": "illustration",
        "illustration": {
          "source": "bibliotheque",
          "elementId": "scene:fin",
          "verrouille": true,
          "candidats": []
        },
        "motsEnValeur": [],
        "cadrage": {
          "pointInteret": {
            "x": 0.5,
            "y": 0.5
          },
          "zoom": 1,
          "zoomFin": 1,
          "valeur": "large"
        },
        "transition": "coupe"
      }
    ],
    "commande": {
      "versionContrat": 2,
      "moteurId": "montage-tableau",
      "videoId": "v-3",
      "formatId": "tableau-anime",
      "versionFormat": 1,
      "profilRenduVersion": 1,
      "dureeCibleSec": 21,
      "ratios": [
        "9:16"
      ],
      "script": {
        "blocs": [],
        "texteComplet": "Le cas. Le problème. La solution. Le résultat. La suite."
      },
      "distribution": [
        {
          "role": "voix",
          "source": "double"
        }
      ],
      "styles": {
        "sousTitres": {
          "id": "sous-titres-encre",
          "nom": "Encre",
          "valeur": {
            "type": "style-sous-titres",
            "gabarit": "minimal",
            "police": "Inter Bold",
            "tailleRelative": 1,
            "taillePx": 60,
            "motsParLigne": 6,
            "motsParLigneMin": 3,
            "casse": "normale",
            "animation": "aucune",
            "couleurAccent": "creme",
            "jetonEmphase": "orange-vif",
            "modeEmphase": "mot",
            "position": "centre",
            "positionPct": 79.5,
            "contourPx": 0,
            "ombrePx": 0,
            "dureeMinGroupeSec": 0.6,
            "dureeMaxGroupeSec": 1.6,
            "chiffresAlignes": true,
            "encre": {
              "texte": "#110A05",
              "page": "#E9DCC8"
            }
          }
        },
        "decor": {
          "id": "page-charte",
          "nom": "Page de la charte",
          "valeur": {
            "type": "decor",
            "mode": "teinte",
            "teinte": "#E9DCC8",
            "profondeurFlou": 0,
            "directionLumiere": "face",
            "positionSujet": 0.5,
            "clair": true
          }
        },
        "lut": null,
        "musique": null
      },
      "briques": {
        "sous-titres": true,
        "etalonnage": false,
        "illustrations": true,
        "son": true,
        "habillage": false,
        "texte-ecran": false,
        "mention-ia": false
      },
      "entrees": {},
      "reglages": {},
      "plans": [],
      "prononciations": [
        {
          "mot": "MD",
          "prononciation": "èmdé"
        }
      ],
      "mentionIA": {
        "incrustee": false,
        "position": "haut-droite",
        "dureeSec": 0,
        "texte": "",
        "dansLegende": false
      },
      "budgetMax": {
        "centimes": 0,
        "devise": "EUR"
      },
      "construiteLe": "1970-01-01T00:00:00.000Z",
      "sousTitres": {
        "base": "minimal",
        "intensite": "equilibre"
      },
      "medias": {
        "scene:accroche": {
          "cle": "k/a.mp4",
          "mime": "video/mp4",
          "dureeSec": 0.3
        },
        "scene:étape-1": {
          "cle": "k/b.mp4",
          "mime": "video/mp4",
          "dureeSec": 4.823
        },
        "scene:étape-2": {
          "cle": "k/c.mp4",
          "mime": "video/mp4",
          "dureeSec": 4.876
        },
        "scene:resultat": {
          "cle": "k/d.mp4",
          "mime": "video/mp4",
          "dureeSec": 7.5
        },
        "scene:fin": {
          "cle": "k/e.mp4",
          "mime": "video/mp4",
          "dureeSec": 3.5
        }
      }
    },
    "empreinte": "e2383e80838e3a6e02ca4946668e48ef"
  }
];
