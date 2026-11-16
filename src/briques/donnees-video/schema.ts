/**
 * SCHÉMA STRICT `tableau-de-bord.v1` (G4-01) — la forme d'un tableau de bord que le Studio accepte de mettre en vidéo.
 * Zod 4, `strictObject` partout : un champ inconnu est refusé à chaque niveau. Aucun chiffre n'est inventé ici.
 * Dossier réservé au Studio : rien ne l'importe en production, le rendu ne le lit pas.
 */
import { z } from "zod";

export const VERSION_TABLEAU_DE_BORD = "tableau-de-bord.v1" as const;

/** Liste blanche : lettres (accents compris), chiffres, espace et ponctuation courante. Pas de `@`, `<`, `>`, `{`, `}`. */
const CARACTERES_AUTORISES = /^[\p{L}\p{N} '’\-–,.:;()%/€+&!?«»·]+$/u;
const COURRIEL = /\S+\s*@\s*\S+|\b\S+\s+(?:arobase|at)\s+\S+\.\S+/i;
/** Suite d'au moins 9 chiffres, séparés ou non par espaces, points ou tirets : un numéro de téléphone. */
const TELEPHONE = /(?:\+|\b)\d(?:[ .\-]?\d){8,}/;

function texteSur(max: number, min = 1) {
  return z
    .string({ error: "Texte attendu." })
    .trim()
    .min(min, { error: "Texte vide : un libellé est obligatoire." })
    .max(max, { error: `Texte trop long : ${max} caractères au plus.` })
    .superRefine((t, ctx) => {
      if (COURRIEL.test(t)) ctx.addIssue({ code: "custom", message: "Adresse courriel refusée dans un libellé." });
      else if (TELEPHONE.test(t)) ctx.addIssue({ code: "custom", message: "Numéro de téléphone refusé dans un libellé." });
      else if (!CARACTERES_AUTORISES.test(t)) ctx.addIssue({ code: "custom", message: "Caractère non autorisé dans le texte (lettres, chiffres et ponctuation courante seulement)." });
    });
}

const identifiant = z
  .string({ error: "Identifiant attendu." })
  .regex(/^[a-z][a-z0-9-]{0,39}$/, { error: "Identifiant invalide : minuscules, chiffres et tirets, 40 caractères au plus." });

const nombre = (nom: string) => z.number({ error: `${nom} : nombre attendu.` }).finite({ error: `${nom} : nombre fini attendu.` });
const unite = z.string({ error: "Unité absente : elle est obligatoire." }).pipe(texteSur(20));
const date = z.string({ error: "Date attendue." }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide : format AAAA-MM-JJ." });

const indicateur = z.strictObject({
  id: identifiant,
  libelle: texteSur(60),
  valeur: nombre("Valeur"),
  unite: unite,
  precision: z.number({ error: "Précision : entier attendu." }).int({ error: "Précision : entier attendu." }).min(0, { error: "Précision : 0 à 4." }).max(4, { error: "Précision : 0 à 4." }),
  sens: z.enum(["hausse-bonne", "baisse-bonne"], { error: "Sens inconnu : « hausse-bonne » ou « baisse-bonne »." }),
});

const point = z.strictObject({ x: texteSur(30), valeur: nombre("Valeur du point") });

const serie = z.strictObject({
  id: identifiant,
  libelle: texteSur(60),
  unite: unite,
  points: z
    .array(point, { error: "Points attendus." })
    .min(2, { error: "Une série demande au moins 2 points." })
    .max(12, { error: "Une série porte 12 points au plus." }),
});

const comparaison = z.strictObject({ avant: identifiant, apres: identifiant });
const alerte = z.strictObject({ texte: texteSur(120), indicateurId: identifiant });

/** Formule : identifiants et nombres reliés par + - * / seulement (pas de parenthèses, pas de code). */
const FORMULE = /^\s*(?:[a-z][a-z0-9-]*|\d+(?:\.\d+)?)(?:\s+[-+*/]\s+(?:[a-z][a-z0-9-]*|\d+(?:\.\d+)?))*\s*$/;
const calcul = z.strictObject({
  id: identifiant,
  formule: z.string({ error: "Formule attendue." }).max(120, { error: "Formule trop longue." }).regex(FORMULE, { error: "Formule invalide : identifiants ou nombres reliés par + - * / (espaces autour des opérateurs)." }),
  resultat: nombre("Résultat"),
});

export const schemaTableauDeBord = z
  .strictObject({
    version: z.literal(VERSION_TABLEAU_DE_BORD, { error: `Version refusée : seule « ${VERSION_TABLEAU_DE_BORD} » est acceptée.` }),
    titre: texteSur(80),
    periode: z.strictObject({ debut: date, fin: date, libelle: texteSur(60) }),
    source: texteSur(60),
    indicateurs: z.array(indicateur, { error: "Indicateurs attendus." }).max(12, { error: "12 indicateurs au plus." }),
    series: z.array(serie, { error: "Séries attendues." }).max(6, { error: "6 séries au plus." }),
    comparaisons: z.array(comparaison, { error: "Comparaisons attendues." }).max(12, { error: "12 comparaisons au plus." }),
    alertes: z.array(alerte, { error: "Alertes attendues." }).max(12, { error: "12 alertes au plus." }),
    calculs: z.array(calcul, { error: "Calculs attendus." }).max(12, { error: "12 calculs au plus." }),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    d.indicateurs.forEach((ind, i) => {
      if (ids.has(ind.id)) ctx.addIssue({ code: "custom", path: ["indicateurs", i, "id"], message: `L'identifiant « ${ind.id} » apparaît deux fois.` });
      ids.add(ind.id);
    });
    d.comparaisons.forEach((c, i) => {
      for (const champ of ["avant", "apres"] as const) {
        if (!ids.has(c[champ])) ctx.addIssue({ code: "custom", path: ["comparaisons", i, champ], message: `La comparaison vise un indicateur inconnu : « ${c[champ]} ».` });
      }
    });
    d.alertes.forEach((a, i) => {
      if (!ids.has(a.indicateurId)) ctx.addIssue({ code: "custom", path: ["alertes", i, "indicateurId"], message: `L'alerte vise un indicateur inconnu : « ${a.indicateurId} ».` });
    });
    d.calculs.forEach((c, i) => {
      for (const mot of c.formule.split(/\s+/)) {
        if (/^[a-z]/.test(mot) && !ids.has(mot)) ctx.addIssue({ code: "custom", path: ["calculs", i, "formule"], message: `La formule cite un indicateur inconnu : « ${mot} ».` });
      }
    });
  });
