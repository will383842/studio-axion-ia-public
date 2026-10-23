/**
 * RÔLE 1 · STRATÈGE D'ANGLES (plan v5 B.3.5 étape 1 ; K11 ; addendum §2 bis à §2 quinquies ; lot G4).
 * Opus, effort `medium` (mesure du banc G4 : 5,6 k jetons de sortie en `high` pour 8 angles). Construit 5 à 8 angles sur les 2-3 combinaisons transmises par l'étape 0 et désigne le plus fort.
 */
import { z } from "zod";
import { problemeAbstrait } from "@/domaine/controles-script";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, graine, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECIT, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, schemaArret, sujetSimule, tirer } from "./commun";
import { idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/* ------------------------------------------------------------------ */
/* Évaluations (écrites AVANT la consigne)                              */
/* ------------------------------------------------------------------ */

export const EVALUATIONS_STRATEGE: readonly Evaluation<SortieStratege>[] = [
  { id: "STR-01", texte: "5 à 8 angles, sauf arrêt propre", verifier: (s) => (s.arret ? [] : s.angles.length < 5 || s.angles.length > 8 ? [`${s.angles.length} angles`] : []) },
  { id: "STR-02", texte: "au moins 2 angles peu probables", verifier: (s) => (s.arret || s.angles.filter((a) => a.probabilite === "peu-probable").length >= 2 ? [] : ["moins de 2 angles peu probables"]) },
  { id: "STR-03", texte: "chaque angle part d'une structure transmise", verifier: (s, c) => s.angles.filter((a) => !c.structures.includes(a.structure)).map((a) => `structure ${a.structure} non transmise`) },
  { id: "STR-04", critique: true, texte: "aucune preuve ni matière inventée", verifier: (s, c) => s.angles.flatMap((a) => [...idsInconnus(a.preuveIds, c.preuveIds), ...idsInconnus(a.matiereIds, c.matiereIds)]).map((x) => `id inconnu ${x}`) },
  { id: "STR-05", texte: "problème concret et coût déclarés (§2 bis)", verifier: (s) => s.angles.flatMap((a, i) => [problemeAbstrait(a.probleme), a.cout.trim() ? null : "coût absent", a.issue.trim() ? null : "issue absente"].filter((x): x is string => !!x).map((m) => `angle ${i + 1} : ${m}`)) },
  { id: "STR-06", texte: "l'angle retenu existe et n'a pas de matière plaquée", verifier: (s) => (s.arret ? [] : !s.angles[s.retenu] ? ["index retenu hors liste"] : s.angles[s.retenu].pertinences.some((p) => p.pertinence === "plaquee" && s.angles[s.retenu].matiereIds.includes(p.matiereId)) ? ["matière plaquée dans l'angle retenu"] : []) },
  { id: "STR-07", texte: "une seule cible, nommée", verifier: (s) => s.angles.filter((a) => !a.cible.trim()).map((a) => `cible absente : ${a.titre}`) },
];

/* ------------------------------------------------------------------ */
/* Consigne                                                             */
/* ------------------------------------------------------------------ */

export const CONSIGNE_STRATEGE = consigne(
  "Tu es le stratège éditorial d'Axion-IA. Tu proposes les ANGLES d'une courte vidéo face caméra, dans le style des vidéos modèles (<modele>) : verdict posé, faits vrais, une cible qui se reconnaît.",
  "Tu reçois le sujet, les matières vraies, les preuves et 2 ou 3 combinaisons (structure, ancrage, point de vue, ressenti) choisies par le code. Chaque angle part d'UNE de ces combinaisons (`combinaison` = son numéro, `structure` = son identifiant).",
  "Propose 5 angles (6 au plus), dont au moins 2 peu probables (contre-pied prouvable). Pour chacun : le problème du spectateur, ce qu'il coûte, l'issue donnée, la cible (une seule), le terme pivot, la pertinence de chaque matière citée (`forte`, `acceptable`, `plaquee`) et les 4 tests (enjeu concret, contre-pied prouvable, cible nette, raison d'en parler maintenant).",
  "Désigne dans `retenu` l'index (à partir de 0) de l'angle le plus fort : celui qu'un dirigeant de la cible regarderait jusqu'au bout et enverrait, porté par une matière `forte` et une preuve. Jamais un angle bâti sur une matière plaquée.",
  "Au plus 2 sujets sur 3 en « douleur » franche (`intensite`) : les autres en « gain » (ce que le spectateur pourrait gagner) ou en « curiosité » (« saviez-vous que… »), toujours utiles. Respecte le bloc <diversite> s'il est fourni : il dit ce que la série a trop vu (ouvertures, fins, récit, expressions) et si ce sujet est une RUPTURE (forme inattendue).",
  REGLE_PROBLEME,
  REGLE_RECIT,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  "Si aucune combinaison ne tient sans inventer (matière hors sujet, limite ou croyance manquante), remplis `arret` avec ANCRAGE_MANQUANT et la raison, et laisse `angles` vide.",
  REGLE_DONNEES,
);

/* ------------------------------------------------------------------ */
/* Schéma                                                               */
/* ------------------------------------------------------------------ */

export const schemaStratege = z.object({
  arret: schemaArret.optional(),
  angles: z.array(
    z.object({
      titre: z.string(),
      promesse: z.string(),
      combinaison: z.number().int(),
      structure: z.string(),
      typeAngle: z.enum(["contre-pied", "dementi", "verdict", "cas", "question", "methode", "actualite"]),
      sourceAngle: z.enum(["brief", "question-recue", "parole-dirigeant", "mot-cle-cherche", "veille", "matiere"]),
      probleme: z.string(),
      cout: z.string(),
      issue: z.string(),
      intensite: z.enum(["douleur", "gain", "curiosite"]),
      cible: z.string(),
      termePivot: z.string(),
      contrePied: z.boolean(),
      probabilite: z.enum(["forte", "peu-probable"]),
      risqueBanal: z.enum(["faible", "moyen", "eleve"]),
      quiParleConseille: z.enum(["will", "avatar"]),
      preuveIds: z.array(z.string()),
      matiereIds: z.array(z.string()),
      pertinences: z.array(z.object({ matiereId: z.string(), pertinence: z.enum(["forte", "acceptable", "plaquee"]) })),
      tests: z.object({ enjeu: z.boolean(), contrePiedProuvable: z.boolean(), cible: z.boolean(), maintenant: z.boolean() }),
    }),
  ),
  retenu: z.number().int(),
  raisonChoix: z.string(),
});
export type SortieStratege = z.infer<typeof schemaStratege>;

export const roleStratege: DefinitionRole<typeof schemaStratege> = {
  id: "stratege",
  version: 1,
  consigne: CONSIGNE_STRATEGE,
  schema: schemaStratege,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 12000,
  simuler(entree) {
    const l = lireVariable(entree.variable, entree.contexte.preuves);
    if (!l.matieres.length || !l.structures.length) return { arret: { code: "ANCRAGE_MANQUANT", raison: "Aucune matière vraie fournie." }, angles: [], retenu: 0, raisonChoix: "" };
    const m = l.matieres[0];
    const preuve = m.preuve ?? l.preuves[0];
    // Simulation qui VARIE (E2E n° 1, n° 14) : titres, problème et cible tirés du sujet, rotation par graine.
    const s = sujetSimule(l.idee);
    const g = graine(l.idee);
    const C = capitale(s.court);
    const titres = [C, `${capitale(s.possessif)} : ce que ça coûte vraiment`, `Ce qu'on peut retirer de ${s.possessif}`, `${capitale(s.motCle)} : l'idée reçue`, `${capitale(s.motCle)} : le premier geste`, `${capitale(s.motCle)} : par où commencer`];
    const cibles = ["un dirigeant de PME", "une DAF", "un responsable administratif", "un chef d'équipe", "une assistante de direction"];
    const couts = ["des heures perdues chaque semaine", "des erreurs que personne ne voit", "des soirées passées sur une tâche sans valeur", "des décisions prises sur des chiffres douteux"];
    const issues = [`retirer le geste à la main de ${s.possessif}`, `confier ${s.possessif} à un outil et garder la vérification`, `commencer par la tâche la plus répétitive`];
    const types = ["cas", "contre-pied", "verdict", "question", "methode", "dementi"] as const;
    const angles = Array.from({ length: 5 }, (_, i) => ({
      titre: i === 0 ? C : tirer(titres, g, i),
      promesse: tirer([`Ce qu'on gagne à ne plus faire ${s.possessif} à la main`, `Le geste qui libère du temps sur ${s.possessif}`, `Pourquoi ${s.possessif} peuvent changer dès cette semaine`], g, i),
      combinaison: 1,
      structure: l.structures[i % l.structures.length],
      typeAngle: types[(i + (i ? g : 0)) % types.length],
      sourceAngle: "matiere" as const,
      probleme: `${capitale(tirer(cibles, g, i))} vit chaque semaine : ${s.court}`,
      cout: tirer(couts, g, i),
      issue: tirer(issues, g, i),
      intensite: ((i + g) % 3 === 0 ? "gain" : (i + g) % 3 === 1 ? "douleur" : "curiosite") as "gain" | "douleur" | "curiosite",
      cible: tirer(cibles, g, i),
      termePivot: s.motCle,
      contrePied: i > 2,
      probabilite: (i > 2 ? "peu-probable" : "forte") as "peu-probable" | "forte",
      risqueBanal: "moyen" as const,
      quiParleConseille: "avatar" as const,
      preuveIds: preuve ? [preuve] : [],
      matiereIds: [m.id],
      pertinences: [{ matiereId: m.id, pertinence: "forte" as const }],
      tests: { enjeu: true, contrePiedProuvable: i > 2, cible: true, maintenant: true },
    }));
    return { angles, retenu: 0, raisonChoix: "Simulation : premier angle." };
  },
};
