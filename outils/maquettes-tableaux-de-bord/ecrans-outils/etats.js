/*
 * T-EXT-49 · États permis des 5 vues du « bureau exemple ».
 * Logique pure : aucune lecture de la page, aucun texte d'histoire.
 */
(function (cible) {
  "use strict";

  var VUES = {
    boite: {
      nom: "Espace démo · Boîte de réception",
      etats: ["avant", "liste", "nouveau", "ouvert", "etiquete", "brouillon"],
    },
    agenda: {
      nom: "Espace démo · Agenda",
      etats: ["semaine", "creneau-propose", "confirme"],
    },
    tableur: {
      nom: "Espace démo · Tableur",
      etats: ["lignes", "ligne-ajoutee", "colonne-a-jour"],
    },
    crm: {
      nom: "Espace démo · Clients",
      etats: ["fiche-vide", "fiche-remplie", "etape-suivante"],
    },
    messagerie: {
      nom: "Espace démo · Messages",
      etats: ["fil", "notification", "tache-creee"],
    },
  };

  var ORDRE = ["boite", "agenda", "tableur", "crm", "messagerie"];

  function etatPermis(vue, etat) {
    return Object.prototype.hasOwnProperty.call(VUES, vue) && VUES[vue].etats.indexOf(etat) !== -1;
  }

  cible.ETATS_ECRANS = {
    version: 1,
    etapesMax: 9,
    ordre: ORDRE,
    vues: VUES,
    etatPermis: etatPermis,
  };
})(window);
