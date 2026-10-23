// Registre des illustrations et icônes des carrousels : PUR, SANS alias « @/ ».
// Liste FERMÉE : un identifiant hors de cette liste ne produit aucun dessin. Aucun SVG n'est jamais injecté depuis
// un contenu (texte, réponse d'IA, saisie) : le contenu ne peut que CHOISIR un identifiant ci-dessous.

export type FamilleDessin = "illustration" | "icone";

export interface MetaDessin {
  id: string;
  nom: string;
  motsCles: readonly string[];
  famille: FamilleDessin;
  licence: string;
  /** Identifiant de l'entrée correspondante dans `src/briques/droits/registre/`. */
  droit: string;
}

export const DROIT_ILLUSTRATIONS = "illustrations-maison-axion";
export const DROIT_ICONES = "icones-lucide-visuels";
const LICENCE_MAISON = "Création interne Axion-IA";
const LICENCE_LUCIDE = "ISC (Lucide)";

const illustration = (id: string, nom: string, motsCles: readonly string[]): MetaDessin => ({ id, nom, motsCles, famille: "illustration", licence: LICENCE_MAISON, droit: DROIT_ILLUSTRATIONS });
const icone = (nom: string, motsCles: readonly string[]): MetaDessin => ({ id: `icone-${nom}`, nom, motsCles, famille: "icone", licence: LICENCE_LUCIDE, droit: DROIT_ICONES });

export const ILLUSTRATIONS: readonly MetaDessin[] = [
  illustration("I01", "Ordinateur avec loupe", ["recherche", "analyse", "audit", "diagnostic", "veille", "informatique"]),
  illustration("I02", "Panneau directionnel", ["choix", "direction", "orientation", "décision", "chemin", "stratégie"]),
  illustration("I03", "Chronomètre", ["temps", "délai", "rapidité", "durée", "gain de temps", "urgence"]),
  illustration("I04", "Enveloppe", ["courrier", "email", "message", "relance", "envoi", "notification"]),
  illustration("I05", "Agenda", ["calendrier", "échéance", "rendez-vous", "planning", "date", "organisation"]),
  illustration("I06", "Dossier", ["document", "classement", "dossier client", "archive", "administratif", "pièces"]),
  illustration("I07", "Avion en papier", ["envoi", "lancement", "message", "départ", "livraison", "idée"]),
  illustration("I08", "Bulles de discussion", ["conversation", "échange", "avis", "client", "communication", "dialogue"]),
  illustration("I09", "Cible", ["objectif", "résultat", "précision", "ciblage", "but", "performance"]),
  illustration("I10", "Sablier", ["attente", "patience", "délai", "temps qui passe", "retard", "durée"]),
  illustration("I11", "Pile de factures", ["facture", "comptabilité", "paiement", "gestion", "charges", "impayé"]),
  illustration("I12", "Table de réunion", ["réunion", "équipe", "rendez-vous", "collaboration", "organisation", "bureau"]),
];

const ICONES_NOMS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["courrier", ["email", "message", "lettre"]],
  ["calendrier", ["date", "échéance", "planning"]],
  ["horloge", ["heure", "temps", "délai"]],
  ["bouclier", ["protection", "sécurité", "conformité"]],
  ["dossier", ["classement", "fichier", "client"]],
  ["graphique", ["statistiques", "chiffres", "résultats"]],
  ["eclair", ["rapidité", "énergie", "automatique"]],
  ["coche", ["validé", "ok", "fait"]],
  ["croix", ["refus", "erreur", "fermer"]],
  ["fleche", ["suite", "direction", "suivant"]],
  ["engrenage", ["réglage", "processus", "mécanique"]],
  ["loupe", ["recherche", "analyse", "détail"]],
  ["bulle", ["discussion", "avis", "commentaire"]],
  ["cadenas", ["confidentialité", "accès", "verrou"]],
  ["cible", ["objectif", "but", "ciblage"]],
  ["sablier", ["attente", "durée", "patience"]],
  ["document", ["contrat", "texte", "page"]],
  ["liste", ["étapes", "tâches", "checklist"]],
  ["telephone", ["appel", "contact", "mobile"]],
  ["ordinateur", ["poste de travail", "informatique", "bureau"]],
  ["utilisateurs", ["équipe", "groupe", "clients"]],
  ["valise", ["métier", "professionnel", "déplacement"]],
  ["ampoule", ["idée", "astuce", "solution"]],
  ["fusee", ["lancement", "croissance", "démarrage"]],
  ["drapeau", ["jalon", "étape", "signalement"]],
  ["etoile", ["favori", "qualité", "avis"]],
  ["cle", ["accès", "clé", "solution"]],
  ["maison", ["accueil", "domicile", "local"]],
  ["hausse", ["croissance", "progression", "amélioration"]],
  ["baisse", ["diminution", "perte", "recul"]],
  ["alerte", ["attention", "risque", "danger"]],
  ["question", ["aide", "doute", "interrogation"]],
  ["coche-cercle", ["validation", "réussite", "confirmé"]],
  ["lien", ["connexion", "adresse", "relation"]],
  ["crayon", ["modifier", "écrire", "rédaction"]],
  ["corbeille", ["supprimer", "déchet", "nettoyage"]],
  ["balance", ["droit", "justice", "équilibre"]],
  ["batiment", ["entreprise", "société", "bureau"]],
  ["envoyer", ["envoi", "expédier", "transmettre"]],
  ["telechargement", ["récupérer", "sauvegarde", "télécharger"]],
];

/** Noms des icônes, en liste FERMÉE typée : le seul choix qu'une page de carrousel peut faire (champ `icone`). */
export const NOMS_ICONES = ["courrier", "calendrier", "horloge", "bouclier", "dossier", "graphique", "eclair", "coche", "croix", "fleche", "engrenage", "loupe", "bulle", "cadenas", "cible", "sablier", "document", "liste", "telephone", "ordinateur", "utilisateurs", "valise", "ampoule", "fusee", "drapeau", "etoile", "cle", "maison", "hausse", "baisse", "alerte", "question", "coche-cercle", "lien", "crayon", "corbeille", "balance", "batiment", "envoyer", "telechargement"] as const;
/**
 * Icônes qu'une PAGE de carrousel peut choisir : toutes, sauf « lien » (SEC-01 : le schéma d'un carrousel ne porte aucun mot de lien, même en
 * valeur d'énumération).
 */
export const NOMS_ICONES_PAGE = ["courrier", "calendrier", "horloge", "bouclier", "dossier", "graphique", "eclair", "coche", "croix", "fleche", "engrenage", "loupe", "bulle", "cadenas", "cible", "sablier", "document", "liste", "telephone", "ordinateur", "utilisateurs", "valise", "ampoule", "fusee", "drapeau", "etoile", "cle", "maison", "hausse", "baisse", "alerte", "question", "coche-cercle", "crayon", "corbeille", "balance", "batiment", "envoyer", "telechargement"] as const satisfies readonly (typeof NOMS_ICONES)[number][];
export type NomIcone = (typeof NOMS_ICONES_PAGE)[number];

export const ICONES: readonly MetaDessin[] = ICONES_NOMS.map(([nom, mots]) => icone(nom, mots));

export const REGISTRE_DESSINS: readonly MetaDessin[] = [...ILLUSTRATIONS, ...ICONES];

export const IDS_DESSINS: readonly string[] = REGISTRE_DESSINS.map((d) => d.id);

export type IdIllustration = "I01" | "I02" | "I03" | "I04" | "I05" | "I06" | "I07" | "I08" | "I09" | "I10" | "I11" | "I12";

/** Vrai si `id` est dans la liste fermée. Seul moyen d'accepter un identifiant venu d'un contenu. */
export function dessinConnu(id: string): boolean {
  return IDS_DESSINS.includes(id);
}

export function trouverDessin(id: string): MetaDessin | undefined {
  return REGISTRE_DESSINS.find((d) => d.id === id);
}

/** Dessins dont un mot-clé contient `mot` (insensible à la casse), illustrations d'abord. */
export function chercherDessins(mot: string): MetaDessin[] {
  const m = mot.trim().toLowerCase();
  if (m === "") return [];
  return REGISTRE_DESSINS.filter((d) => d.nom.toLowerCase().includes(m) || d.motsCles.some((k) => k.toLowerCase().includes(m)));
}
