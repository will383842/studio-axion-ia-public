import { z } from "zod";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import { NOMS_ICONES } from "../icones";
import type { DefinitionGabarit } from "../registre-gabarits";

/** Nombre d'éléments [min, max] de chaque liste : hors de ces bornes, le schéma refuse. */
export const BORNES_LISTES: Record<string, [number, number]> = { L01: [3, 3], L02: [3, 4], L03: [3, 4], L04: [3, 4], L05: [4, 5], L06: [3, 4], L07: [6, 9] };

/**
 * Budgets de caractères (mesurés au rendu, 4:5 et 3:4, mots longs compris : voir `essai-continu-listes.ts`), par type et par nombre d'éléments :
 * `titre` et `accent` pour la page, puis un budget par champ d'élément. Plus il y a d'éléments, moins chacun a de place (comme `capaciteListe`).
 */
const BUDGETS: Record<string, { page: { titre: number; accent: number }; element: (n: number) => Record<string, number> }> = {
  L01: { page: { titre: 22, accent: 14 }, element: () => ({ titre: 21, sous: 18 }) },
  L02: { page: { titre: 22, accent: 14 }, element: (n) => ({ titre: 18, sous: n <= 3 ? 40 : 32 }) },
  L03: { page: { titre: 22, accent: 14 }, element: (n) => ({ label: n <= 3 ? 13 : 9 }) },
  L04: { page: { titre: 18, accent: 18 }, element: (n) => ({ jour: 10, texte: n <= 3 ? 44 : 24 }) },
  L05: { page: { titre: 22, accent: 14 }, element: (n) => ({ texte: n <= 4 ? 56 : 48 }) },
  L06: { page: { titre: 22, accent: 14 }, element: () => ({ label: 12 }) },
  L07: { page: { titre: 16, accent: 14 }, element: () => ({ label: 14 }) },
};

/** Budgets de `type` pour `n` éléments : `page` (titre, accent) et `element` (un budget par champ texte d'un élément). */
export function budgetListe(type: string, n: number): { page: { titre: number; accent: number }; element: Record<string, number> } {
  const b = BUDGETS[type];
  if (!b) throw new Error(`Liste inconnue : ${type}`);
  return { page: b.page, element: b.element(n) };
}

const icone = z.enum(NOMS_ICONES);

/** Plus long mot admis dans un titre ou un accent : au-delà, un mot de 100 px déborde des 920 px de la zone. */
export const MOT_TITRE_MAX = 14;
/** Texte d'au plus `max` caractères dont aucun mot ne dépasse `motMax` (une carte étroite ne coupe pas un mot). */
const texteBorne = (max: number, motMax: number) => texteSansLien(1, max).refine((t) => t.split(/\s+/).every((m) => m.length <= motMax), `un mot de plus de ${motMax} caractères`);
const titreBorne = (max: number) => texteSansLien(1, max).refine((t) => t.split(/\s+/).every((m) => m.length <= MOT_TITRE_MAX), `un mot de plus de ${MOT_TITRE_MAX} caractères`);

/** Liste bornée dont chaque champ texte d'élément respecte le budget du nombre d'éléments. */
function liste<T extends z.ZodType>(type: string, element: T) {
  const [min, max] = BORNES_LISTES[type];
  return z.array(element).min(min).max(max).superRefine((elements, ctx) => {
    const b = budgetListe(type, elements.length).element;
    elements.forEach((e, i) => {
      for (const [champ, limite] of Object.entries(b)) {
        const v = (e as Record<string, unknown>)[champ];
        if (typeof v === "string" && v.length > limite) ctx.addIssue({ code: "custom", path: [i, champ], message: `${champ} : ${limite} caractères au plus avec ${elements.length} éléments` });
      }
    });
  });
}

function schemaListe<S extends z.ZodRawShape>(type: string, champs: S) {
  const b = budgetListe(type, BORNES_LISTES[type][0]).page;
  return z
    .object({
      type: z.literal(type),
      alt: texteSansLien(1, 125),
      rubrique: texteSansLien(1, RUBRIQUE_MAX).optional(),
      titre: titreBorne(b.titre),
      accent: titreBorne(b.accent),
      ...champs,
    })
    .strict();
}

const item = (nom: number, sous: number, motNom: number, motSous: number) => z.object({ icone, titre: texteBorne(nom, motNom), sous: texteBorne(sous, motSous) }).strict();

// Les bords d'une liste sont occupés par ses cartes de 80 à 1000 px : seul le haut (sous l'en-tête) est libre à coup sûr.
const BORDS_PLEINS = { gauche: [[0, 196]], droite: [[0, 196]] } as DefinitionGabarit["bordsLibres"];

const L01: DefinitionGabarit = {
  type: "L01",
  nom: "Bento illustré",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L01", { items: liste("L01", item(21, 18, 12, 14)) }),
  exemple: {
    type: "L01",
    alt: "Trois freins fréquents : trop d’outils, pas le temps, peur pour les données.",
    rubrique: "Ce qui freine",
    titre: "Ce qui vous freine,",
    accent: "souvent",
    items: [
      { icone: "layers", titre: "Trop d’outils", sous: "Lequel choisir ?" },
      { icone: "hourglass", titre: "Pas le temps", sous: "Le métier d’abord." },
      { icone: "lock", titre: "Peur pour les données", sous: "Où vont-elles ?" },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

const L02: DefinitionGabarit = {
  type: "L02",
  nom: "Liste à gros chiffres",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L02", { items: liste("L02", item(18, 40, 18, 20)) }),
  exemple: {
    type: "L02",
    alt: "Ce qu’on fait pour vous en quatre temps : auditer, choisir, installer, suivre.",
    rubrique: "Notre rôle",
    titre: "Ce qu’on fait",
    accent: "pour vous",
    items: [
      { icone: "search", titre: "Auditer", sous: "On repère où le temps se perd." },
      { icone: "target", titre: "Choisir", sous: "Un premier cas, avec vous." },
      { icone: "gear", titre: "Installer", sous: "Chez vous, à votre façon." },
      { icone: "trend", titre: "Suivre", sous: "On ajuste tant que c’est utile." },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

const L03: DefinitionGabarit = {
  type: "L03",
  nom: "Escalier",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L03", { etapes: liste("L03", z.object({ icone, label: texteSansLien(1, 13) }).strict()) }),
  exemple: {
    type: "L03",
    alt: "Un escalier en quatre marches : écouter, choisir, installer, suivre.",
    rubrique: "Un pas après l’autre",
    titre: "On avance",
    accent: "par étapes",
    etapes: [
      { icone: "users", label: "Écouter" },
      { icone: "target", label: "Choisir" },
      { icone: "gear", label: "Installer" },
      { icone: "flag", label: "Suivre" },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

const L04: DefinitionGabarit = {
  type: "L04",
  nom: "Chronologie",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L04", { etapes: liste("L04", z.object({ icone, jour: texteSansLien(1, 10), texte: texteSansLien(1, 56) }).strict()) }),
  exemple: {
    type: "L04",
    alt: "Un devis de bout en bout : jour 1, jour 3, jour 7.",
    rubrique: "Cas concret",
    titre: "Un devis,",
    accent: "de bout en bout",
    etapes: [
      { icone: "mail", jour: "Jour 1", texte: "Le devis part, la relance est prête." },
      { icone: "bell", jour: "Jour 3", texte: "Rappel doux, sans y penser." },
      { icone: "check", jour: "Jour 7", texte: "Réponse reçue ou nouvelle piste." },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  cas: true,
  actif: true,
};

const L05: DefinitionGabarit = {
  type: "L05",
  nom: "Checklist",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L05", { lignes: liste("L05", z.object({ icone, texte: texteSansLien(1, 56), coche: z.boolean() }).strict()) }),
  exemple: {
    type: "L05",
    alt: "Une liste à cocher avant de lancer : quatre points validés, un à éviter.",
    rubrique: "À cocher",
    titre: "Avant de",
    accent: "lancer",
    lignes: [
      { icone: "target", texte: "Un seul cas choisi", coche: true },
      { icone: "users", texte: "Une personne responsable", coche: true },
      { icone: "chart", texte: "Un critère de réussite", coche: true },
      { icone: "shield", texte: "Vous validez avant l’envoi", coche: true },
      { icone: "bolt", texte: "Tout automatiser d’un coup", coche: false },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

const L06: DefinitionGabarit = {
  type: "L06",
  nom: "Matrice effort / impact",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L06", { points: liste("L06", z.object({ label: texteSansLien(1, 12) }).strict()) }),
  exemple: {
    type: "L06",
    alt: "Une matrice effort et impact : les relances sont à traiter en premier.",
    rubrique: "Prioriser",
    titre: "Commencez",
    accent: "par là",
    // Le premier point est celui qu'on traite d'abord (case orange, cible).
    points: [{ label: "Relances" }, { label: "Veille" }, { label: "Refonte" }, { label: "Compte rendu" }],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

const L07: DefinitionGabarit = {
  type: "L07",
  nom: "Grille d’icônes",
  famille: "liste",
  role: "contenu",
  sombre: false,
  orangeFort: false,
  version: 1,
  schema: schemaListe("L07", { items: liste("L07", z.object({ icone, label: texteSansLien(1, 14) }).strict()) }),
  exemple: {
    type: "L07",
    alt: "Neuf tâches qui reviennent : relances, comptes rendus, factures, agenda, suivi, équipe, données, alertes, sécurité.",
    rubrique: "Tout ce qu’on peut préparer",
    titre: "Neuf tâches",
    accent: "qui reviennent",
    items: [
      { icone: "mail", label: "Relances" },
      { icone: "doc", label: "Comptes rendus" },
      { icone: "receipt", label: "Factures" },
      { icone: "calendar", label: "Agenda" },
      { icone: "trend", label: "Suivi" },
      { icone: "users", label: "Équipe" },
      { icone: "folder", label: "Données" },
      { icone: "bell", label: "Alertes" },
      { icone: "shield", label: "Sécurité" },
    ],
  },
  bordsLibres: BORDS_PLEINS,
  actif: true,
};

export const LISTES: DefinitionGabarit[] = [L01, L02, L03, L04, L05, L06, L07];
