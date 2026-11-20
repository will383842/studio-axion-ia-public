/**
 * T-EXT-V2-09 · Copie des noms de la charte pour l'image du studio : `Dockerfile.dockerignore` exclut `outils/`, ces deux
 * fichiers n'y existent donc pas à l'exécution. Une copie ici (sous `src/`), jamais un import d'un dossier exclu
 * (`image-autonome`). Le test `tests/tutoriel-outil/piece-creee-ecran.test.ts` compare cette copie aux deux fichiers d'origine :
 * toute différence le fait échouer.
 *  - `outils/maquettes-tableaux-de-bord/charte/noms-neutres.json`
 *  - `outils/maquettes-tableaux-de-bord/ecrans-outils/noms.json`
 */
export interface NomsMaquette {
  produit?: string;
  organisation?: string;
  vues?: Record<string, string>;
}
export interface FichierNoms {
  interdits: string[];
  maquettes: Record<string, NomsMaquette>;
}

export const NOMS_NEUTRES: FichierNoms = {
  "interdits": [
    "velora",
    "calyra",
    "sylva",
    "relayo",
    "noveria",
    "blueflow",
    "ordiva",
    "boreal",
    "maison alba",
    "feuille.",
    "orbis",
    "rivage"
  ],
  "maquettes": {
    "01-courriels": {
      "produit": "Espace démo · Courriels",
      "organisation": "Entreprise exemple"
    },
    "02-projets": {
      "produit": "Espace démo · Projets",
      "organisation": "Entreprise exemple"
    },
    "03-accueil-24h": {
      "produit": "Espace démo · Accueil 24 h",
      "organisation": "Entreprise exemple"
    },
    "04-clients": {
      "produit": "Espace démo · Clients",
      "organisation": "Entreprise exemple"
    },
    "05-stocks": {
      "produit": "Espace démo · Stocks",
      "organisation": "Entreprise exemple"
    },
    "06-equipe": {
      "produit": "Espace démo · Équipe",
      "organisation": "Entreprise exemple"
    },
    "07-taches": {
      "produit": "Espace démo · Connaissances",
      "organisation": "Entreprise exemple"
    }
  }
};

export const NOMS_ECRANS_OUTILS: FichierNoms = {
  "interdits": [
    "velora",
    "calyra",
    "sylva",
    "relayo",
    "noveria",
    "blueflow",
    "ordiva",
    "boreal",
    "maison alba",
    "feuille.",
    "orbis",
    "rivage"
  ],
  "maquettes": {
    "ecrans-outils": {
      "produit": "Espace démo · Boîte de réception",
      "organisation": "Entreprise exemple",
      "vues": {
        "boite": "Espace démo · Boîte de réception",
        "agenda": "Espace démo · Agenda",
        "tableur": "Espace démo · Tableur",
        "crm": "Espace démo · Clients",
        "messagerie": "Espace démo · Messages"
      }
    }
  }
};
