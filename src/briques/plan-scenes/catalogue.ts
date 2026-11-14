/**
 * CATALOGUE DES BRIQUES DU PLAN DE SCÈNES (lot C) — fausse interface logicielle, recréée d'après les noms du prototype
 * `axion-crm-video` (non disponible dans le cloud). Chaque brique : un identifiant stable, des paramètres validés par
 * Zod (objet strict : tout champ inconnu est refusé), un exemple valide (démo, repli), une toile de dessin (le rendu la
 * met à l'échelle dans sa zone) et des alias pour retrouver la pièce la plus proche d'un nom approché.
 * Le rendu React est dans `./briques/` (composants purs, sans Zod) : ce fichier n'est lu que côté studio.
 */
import { z } from "zod";
import { TOILES } from "./toiles";

const texteCourt = (max: number) => z.string().trim().min(1).max(max);
const point = z.strictObject({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export const schemaCurseur = z.strictObject({
  /** Trajet en % de la toile (2 à 6 points), parcouru d'un mouvement lisse. */
  trajet: z.array(point).min(2).max(6),
  /** Clic doux (anneau qui s'efface) à l'arrivée. */
  clic: z.boolean(),
  /** Part de la scène consacrée au déplacement (0,2 à 0,9). */
  partDeplacement: z.number().min(0.2).max(0.9),
});

export const schemaZoomCamera = z.strictObject({
  /** Point visé en % de la toile. */
  cible: point,
  facteur: z.number().min(1).max(2.5),
  /** Instant du zoom, en part de la scène (0 à 0,8). */
  moment: z.number().min(0).max(0.8),
  /** Contenu montré sous la caméra quand la brique est seule (niveau 1). */
  titreFenetre: texteCourt(40),
});

export const schemaFrappeClavier = z.strictObject({
  champ: texteCourt(40),
  texte: texteCourt(120),
  /** Caractères par seconde (8 à 30). */
  vitesse: z.number().min(8).max(30),
});

export const schemaCarteKpi = z.strictObject({
  libelle: texteCourt(40),
  valeur: z.number().finite(),
  prefixe: z.string().max(4),
  suffixe: z.string().max(6),
  decimales: z.number().int().min(0).max(2),
  tendance: z.enum(["hausse", "baisse", "stable"]),
  variation: z.string().max(16),
});

export const schemaGraphique = z.strictObject({
  type: z.enum(["barres", "courbe"]),
  titre: z.string().max(48),
  valeurs: z.array(z.strictObject({ libelle: texteCourt(14), valeur: z.number().min(0) })).min(2).max(8),
  /** Indice de la valeur mise en avant (-1 : aucune). */
  enAvant: z.number().int().min(-1).max(7),
});

export const schemaTableauDeBord = z.strictObject({
  titre: texteCourt(40),
  kpis: z.array(z.strictObject({ libelle: texteCourt(24), valeur: texteCourt(12) })).min(2).max(4),
  serie: z.array(z.number().min(0)).min(3).max(12),
});

export const STATUTS_CRM = ["nouveau", "en-cours", "gagne", "perdu"] as const;
export const schemaListeCrm = z.strictObject({
  titre: texteCourt(40),
  lignes: z.array(z.strictObject({ nom: texteCourt(28), detail: z.string().max(36), statut: z.enum(STATUTS_CRM) })).min(1).max(6),
  /** Ligne surlignée (-1 : aucune). */
  surligner: z.number().int().min(-1).max(5),
});

export const schemaFenetreApp = z.strictObject({
  titre: texteCourt(40),
  onglets: z.array(texteCourt(16)).max(4),
  ongletActif: z.number().int().min(0).max(3),
  contenu: z.enum(["vide", "formulaire", "liste"]),
});

export const schemaBulleChat = z.strictObject({
  messages: z.array(z.strictObject({ auteur: z.enum(["client", "assistant"]), texte: texteCourt(140) })).min(1).max(4),
  /** Petits points « en train d'écrire » avant chaque réponse de l'assistant. */
  saisie: z.boolean(),
});

export const schemaLegende = z.strictObject({
  texte: texteCourt(80),
  sousTexte: z.string().max(80),
  style: z.enum(["bandeau", "etiquette", "titre"]),
});

/* Pièces « de données » (GV2-45) : chaque élément arrive sur un mot dit. `surMot` = indice du mot dans le minutage du plan ;
 * `aMs` = instant de ce mot depuis le début de la scène, posé par le code (`poserInstantsSurMot`), jamais par le modèle. */
const surMot = z.number().int().min(0);
const aMs = z.number().min(0).optional();
const valeurAvecMot = { valeur: z.number().finite(), unite: z.string().trim().max(8).optional(), surMot, aMs };

export const schemaCompteur = z.strictObject({
  valeur: z.number().finite(),
  unite: z.string().trim().min(1).max(8).optional(),
  libelle: texteCourt(40).optional(),
  surMot,
  aMs,
});

export const schemaJauge = z.strictObject({
  valeur: z.number().min(0).max(100),
  libelle: texteCourt(40).optional(),
  surMot,
  aMs,
});

export const schemaAvantApres = z.strictObject({
  avant: z.strictObject(valeurAvecMot),
  apres: z.strictObject(valeurAvecMot),
  titre: texteCourt(40).optional(),
});

export const schemaBarres = z.strictObject({
  barres: z.array(z.strictObject({ libelle: texteCourt(20), valeur: z.number().min(0).finite(), surMot, aMs })).min(2).max(4),
  unite: z.string().trim().min(1).max(8).optional(),
});

const elementAuMot = z.strictObject({ texte: texteCourt(40), surMot, aMs });

export const schemaEtapes = z.strictObject({
  elements: z.array(elementAuMot).min(2).max(6),
});

export const schemaListeAuMot = z.strictObject({
  titre: texteCourt(40).optional(),
  elements: z.array(elementAuMot).min(2).max(6),
});

export const schemaCitation = z.strictObject({
  texte: texteCourt(120),
  auteur: texteCourt(30).optional(),
  surMot,
  aMs,
});

export const GENRES_REPERE = ["lieu", "date", "duree"] as const;
export const schemaRepere = z.strictObject({
  genre: z.enum(GENRES_REPERE),
  texte: texteCourt(30),
  surMot,
  aMs,
});

export interface DefinitionBrique<S extends z.ZodType = z.ZodType> {
  id: string;
  nom: string;
  /** Ce que montre la brique (repris dans la consigne du générateur). */
  description: string;
  /** Famille, pour le repli vers la pièce la plus proche. */
  famille: "geste" | "chiffre" | "interface" | "texte" | "donnee";
  /** Noms approchés qui désignent cette brique (repli d'un nom inconnu). */
  alias: string[];
  /** Taille de dessin (px) ; le rendu la met à l'échelle dans la zone de la scène. */
  toile: { largeur: number; hauteur: number };
  schema: S;
  exemple: z.infer<S>;
}

function brique<S extends z.ZodType>(d: DefinitionBrique<S>): DefinitionBrique<S> {
  return d;
}

export const CATALOGUE_BRIQUES = {
  curseur: brique({
    id: "curseur",
    nom: "Curseur",
    description: "Flèche de souris qui glisse d'un point à l'autre puis clique doucement.",
    famille: "geste",
    alias: ["souris", "pointeur", "clic", "cursor"],
    toile: TOILES["curseur"],
    schema: schemaCurseur,
    exemple: { trajet: [{ x: 20, y: 70 }, { x: 55, y: 45 }, { x: 72, y: 38 }], clic: true, partDeplacement: 0.6 },
  }),
  "zoom-camera": brique({
    id: "zoom-camera",
    nom: "Zoom caméra",
    description: "Rapproche lentement la caméra d'un point de l'écran (en calque : agrandit les autres calques).",
    famille: "geste",
    alias: ["zoom", "camera", "rapprocher", "loupe"],
    toile: TOILES["zoom-camera"],
    schema: schemaZoomCamera,
    exemple: { cible: { x: 62, y: 40 }, facteur: 1.6, moment: 0.3, titreFenetre: "Devis en cours" },
  }),
  "frappe-clavier": brique({
    id: "frappe-clavier",
    nom: "Frappe au clavier",
    description: "Un champ de saisie qui se remplit lettre par lettre, avec un curseur texte.",
    famille: "interface",
    alias: ["frappe", "saisie", "clavier", "typing", "ecriture"],
    toile: TOILES["frappe-clavier"],
    schema: schemaFrappeClavier,
    exemple: { champ: "Client", texte: "Fuite sous l'évier, cuisine", vitesse: 16 },
  }),
  "carte-kpi": brique({
    id: "carte-kpi",
    nom: "Carte KPI",
    description: "Un chiffre clé qui monte jusqu'à sa valeur, avec un libellé et une tendance.",
    famille: "chiffre",
    alias: ["kpi", "chiffre", "compteur", "indicateur", "stat", "statistique"],
    toile: TOILES["carte-kpi"],
    schema: schemaCarteKpi,
    exemple: { libelle: "Devis envoyés ce mois", valeur: 38, prefixe: "+", suffixe: " %", decimales: 0, tendance: "hausse", variation: "vs septembre" },
  }),
  graphique: brique({
    id: "graphique",
    nom: "Graphique",
    description: "Barres qui poussent ou courbe qui se trace, une valeur mise en avant.",
    famille: "chiffre",
    alias: ["graphe", "courbe", "barres", "histogramme", "chart"],
    toile: TOILES["graphique"],
    schema: schemaGraphique,
    exemple: {
      type: "barres",
      titre: "Demandes par semaine",
      valeurs: [
        { libelle: "S1", valeur: 12 },
        { libelle: "S2", valeur: 18 },
        { libelle: "S3", valeur: 16 },
        { libelle: "S4", valeur: 27 },
      ],
      enAvant: 3,
    },
  }),
  "tableau-de-bord": brique({
    id: "tableau-de-bord",
    nom: "Tableau de bord",
    description: "Écran de synthèse : 2 à 4 chiffres en tuiles et une petite courbe.",
    famille: "chiffre",
    alias: ["dashboard", "tableau", "synthese", "bord"],
    toile: TOILES["tableau-de-bord"],
    schema: schemaTableauDeBord,
    exemple: {
      titre: "Cette semaine",
      kpis: [
        { libelle: "Demandes", valeur: "27" },
        { libelle: "Devis signés", valeur: "9" },
        { libelle: "Temps de réponse", valeur: "12 min" },
      ],
      serie: [4, 6, 5, 8, 7, 11, 13],
    },
  }),
  "liste-crm": brique({
    id: "liste-crm",
    nom: "Liste / CRM",
    description: "Liste de contacts ou de demandes qui arrivent une à une, avec un statut ; une ligne surlignée.",
    famille: "interface",
    alias: ["crm", "liste", "contacts", "clients", "pipeline", "leads"],
    toile: TOILES["liste-crm"],
    schema: schemaListeCrm,
    exemple: {
      titre: "Demandes du jour",
      lignes: [
        { nom: "M. Durand", detail: "Fuite cuisine", statut: "nouveau" },
        { nom: "Mme Leroy", detail: "Chauffe-eau", statut: "en-cours" },
        { nom: "SCI Les Tilleuls", detail: "Contrat entretien", statut: "gagne" },
      ],
      surligner: 0,
    },
  }),
  "fenetre-app": brique({
    id: "fenetre-app",
    nom: "Fenêtre d'app",
    description: "Fenêtre de logiciel (barre de titre, onglets) qui s'ouvre en douceur ; sert de décor aux autres briques.",
    famille: "interface",
    alias: ["fenetre", "app", "application", "logiciel", "ecran", "window"],
    toile: TOILES["fenetre-app"],
    schema: schemaFenetreApp,
    exemple: { titre: "Axion CRM", onglets: ["Demandes", "Devis", "Agenda"], ongletActif: 1, contenu: "formulaire" },
  }),
  "bulle-chat": brique({
    id: "bulle-chat",
    nom: "Bulle de chat",
    description: "Échange de messages (client, assistant) qui apparaissent l'un après l'autre.",
    famille: "interface",
    alias: ["chat", "message", "conversation", "bulle", "sms", "messagerie"],
    toile: TOILES["bulle-chat"],
    schema: schemaBulleChat,
    exemple: {
      messages: [
        { auteur: "client", texte: "Bonjour, j'ai une fuite sous l'évier." },
        { auteur: "assistant", texte: "Je vous propose demain 9 h. Le devis arrive par SMS." },
      ],
      saisie: true,
    },
  }),
  legende: brique({
    id: "legende",
    nom: "Légende",
    description: "Texte à l'écran : bandeau, étiquette ou titre, qui arrive en fondu glissé.",
    famille: "texte",
    alias: ["texte", "titre", "sous-titre", "bandeau", "etiquette", "caption", "label"],
    toile: TOILES["legende"],
    schema: schemaLegende,
    exemple: { texte: "Le devis part tout seul", sousTexte: "", style: "bandeau" },
  }),
  compteur: brique({
    id: "compteur",
    nom: "Compteur",
    description: "Un nombre dit avec son unité, qui monte d'un coup jusqu'à la valeur dite, au moment où le mot est prononcé.",
    famille: "donnee",
    alias: ["nombre", "decompte", "total"],
    toile: TOILES["compteur"],
    schema: schemaCompteur,
    exemple: { valeur: 40, unite: "%", libelle: "de temps gagné", surMot: 0, aMs: 400 },
  }),
  jauge: brique({
    id: "jauge",
    nom: "Jauge",
    description: "Une part de 0 à 100 % annoncée dans la voix (taux, avancement), qui se remplit jusqu'à la valeur dite.",
    famille: "donnee",
    alias: ["pourcentage", "taux", "avancement", "progression"],
    toile: TOILES["jauge"],
    schema: schemaJauge,
    exemple: { valeur: 72, libelle: "des demandes traitées", surMot: 0, aMs: 400 },
  }),
  "avant-apres": brique({
    id: "avant-apres",
    nom: "Avant / après",
    description: "Deux valeurs opposées, avant puis après, chacune montrée au mot où elle est dite.",
    famille: "donnee",
    alias: ["comparaison", "avant", "apres", "versus"],
    toile: TOILES["avant-apres"],
    schema: schemaAvantApres,
    exemple: {
      titre: "Temps de réponse",
      avant: { valeur: 48, unite: "h", surMot: 0, aMs: 300 },
      apres: { valeur: 12, unite: "min", surMot: 3, aMs: 1500 },
    },
  }),
  barres: brique({
    id: "barres",
    nom: "Barres comparées",
    description: "2 à 4 grandeurs comparées côte à côte, chaque barre poussant au mot où sa valeur est dite.",
    famille: "donnee",
    alias: ["comparer", "classement", "ecart"],
    toile: TOILES["barres"],
    schema: schemaBarres,
    exemple: {
      unite: "h",
      barres: [
        { libelle: "Avant", valeur: 12, surMot: 0, aMs: 300 },
        { libelle: "Maintenant", valeur: 3, surMot: 2, aMs: 1100 },
      ],
    },
  }),
  etapes: brique({
    id: "etapes",
    nom: "Étapes",
    description: "Une suite d'étapes numérotées (2 à 6), chacune apparaissant quand elle est nommée dans la voix.",
    famille: "donnee",
    alias: ["etape", "parcours", "procedure", "marche a suivre"],
    toile: TOILES["etapes"],
    schema: schemaEtapes,
    exemple: {
      elements: [
        { texte: "Le client appelle", surMot: 0, aMs: 300 },
        { texte: "L'assistant répond", surMot: 3, aMs: 1200 },
        { texte: "Le devis part", surMot: 6, aMs: 2100 },
      ],
    },
  }),
  "liste-au-mot": brique({
    id: "liste-au-mot",
    nom: "Liste au mot",
    description: "Une liste annoncée (2 à 6 éléments) qui se remplit : chaque ligne arrive au mot où elle est dite.",
    famille: "donnee",
    alias: ["enumeration", "points", "liste a puces", "checklist"],
    toile: TOILES["liste-au-mot"],
    schema: schemaListeAuMot,
    exemple: {
      titre: "Ce qui est inclus",
      elements: [
        { texte: "Devis automatique", surMot: 0, aMs: 300 },
        { texte: "Relances par SMS", surMot: 2, aMs: 1000 },
        { texte: "Agenda à jour", surMot: 4, aMs: 1800 },
      ],
    },
  }),
  citation: brique({
    id: "citation",
    nom: "Citation",
    description: "Une phrase rapportée (parole d'un client, d'un avis), avec son auteur, qui apparaît au mot où elle commence.",
    famille: "donnee",
    alias: ["temoignage", "avis", "verbatim"],
    toile: TOILES["citation"],
    schema: schemaCitation,
    exemple: { texte: "Je ne rate plus aucun appel.", auteur: "Un plombier", surMot: 0, aMs: 300 },
  }),
  repere: brique({
    id: "repere",
    nom: "Repère",
    description: "Un lieu, une date ou une durée dite à voix haute, posée en repère court au moment où elle est dite.",
    famille: "donnee",
    alias: ["lieu", "date", "duree", "localisation"],
    toile: TOILES["repere"],
    schema: schemaRepere,
    exemple: { genre: "lieu", texte: "Lyon", surMot: 0, aMs: 300 },
  }),
} as const;

export type IdPiece = keyof typeof CATALOGUE_BRIQUES;
export const IDS_PIECES = Object.keys(CATALOGUE_BRIQUES) as [IdPiece, ...IdPiece[]];
export type ParametresPiece<K extends IdPiece> = z.infer<(typeof CATALOGUE_BRIQUES)[K]["schema"]>;

export function estPiece(id: unknown): id is IdPiece {
  return typeof id === "string" && Object.hasOwn(CATALOGUE_BRIQUES, id);
}

type Mot = { debutMs: number };
type AvecMot = { surMot: number; aMs?: number };

/**
 * Pose `aMs` (instant du mot depuis le début de la scène, jamais négatif) sur chaque élément des pièces « de données »
 * d'après son `surMot`. Fonction pure : renvoie une copie. Un `surMot` hors du minutage est laissé tel quel (le rendu
 * répartit alors les éléments à égalité).
 */
export function poserInstantsSurMot<T>(piece: IdPiece, parametres: T, mots: readonly Mot[], debutSceneMs: number): T {
  if (!parametres || typeof parametres !== "object") return parametres;
  const poser = <E extends AvecMot>(e: E): E => {
    const mot = mots[e.surMot];
    return mot ? { ...e, aMs: Math.max(0, mot.debutMs - debutSceneMs) } : { ...e };
  };
  const p = structuredClone(parametres) as Record<string, unknown>;
  switch (piece) {
    case "compteur":
    case "jauge":
    case "citation":
    case "repere":
      return poser(p as unknown as AvecMot) as unknown as T;
    case "avant-apres":
      p.avant = poser(p.avant as AvecMot);
      p.apres = poser(p.apres as AvecMot);
      return p as T;
    case "barres":
      p.barres = (p.barres as AvecMot[]).map(poser);
      return p as T;
    case "etapes":
    case "liste-au-mot":
      p.elements = (p.elements as AvecMot[]).map(poser);
      return p as T;
    default:
      return parametres;
  }
}

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Pièce la plus proche d'un nom approché (alias), sinon d'après le texte de la scène : un chiffre → carte KPI, sinon
 * légende. Jamais `undefined` : il y a toujours une pièce de repli.
 */
export function pieceLaPlusProche(nom: unknown, texte?: string): IdPiece {
  if (estPiece(nom)) return nom;
  if (typeof nom === "string" && nom.trim()) {
    const n = normaliser(nom);
    for (const def of Object.values(CATALOGUE_BRIQUES)) {
      if (normaliser(def.id) === n || def.alias.some((a) => normaliser(a) === n)) return def.id as IdPiece;
    }
    for (const def of Object.values(CATALOGUE_BRIQUES)) {
      if (def.alias.some((a) => n.split(" ").includes(normaliser(a)))) return def.id as IdPiece;
    }
  }
  return texte && /\d/.test(texte) ? "carte-kpi" : "legende";
}
