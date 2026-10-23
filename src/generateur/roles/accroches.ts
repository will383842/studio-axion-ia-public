/**
 * RÔLE 3 · AUTEUR D'ACCROCHES (plan v5 B.3.5 étape 3 ; K2 ; C8, C41, C47, C69 ; lot G4).
 * Opus, effort `medium` (banc G4 : 8-9 k jetons de sortie et 0,20 $ par appel en `high`, pour un lot que le code et le juge filtrent ensuite). 10 à 15 accroches sur au moins 6 familles permises par la recette (données).
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, graine, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, regleTon, schemaArret, sujetSimule, tirer, tutoyer } from "./commun";
import { ditNonProuve, idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_ACCROCHES: readonly Evaluation<SortieAccroches>[] = [
  { id: "ACR-01", texte: "10 à 15 accroches", verifier: (s) => (s.arret ? [] : s.accroches.length < 10 || s.accroches.length > 15 ? [`${s.accroches.length} accroches`] : []) },
  { id: "ACR-02", texte: "au moins 6 familles distinctes (C47)", verifier: (s, c) => (s.arret ? [] : new Set(s.accroches.map((a) => a.famille)).size < Math.min(6, c.famillesPermises.length) ? [`${new Set(s.accroches.map((a) => a.famille)).size} familles`] : []) },
  { id: "ACR-03", texte: "familles permises par la recette (C41)", verifier: (s, c) => s.accroches.filter((a) => !c.famillesPermises.includes(a.famille)).map((a) => `famille ${a.famille} non permise`) },
  { id: "ACR-04", texte: "20 mots au plus (C8)", verifier: (s) => s.accroches.filter((a) => mots(a.dit) > 20).map((a) => `${mots(a.dit)} mots : « ${a.dit} »`) },
  { id: "ACR-05", critique: true, texte: "aucune preuve inventée, aucun nombre non prouvé", verifier: (s, c) => s.accroches.flatMap((a) => [...idsInconnus(a.preuveIds, c.preuveIds).map((x) => `preuve ${x}`), ...ditNonProuve(a.dit, c).map((x) => `« ${x} » non prouvé`)]) },
  { id: "ACR-06", texte: "au moins une accroche porte l'angle", verifier: (s) => (s.arret || s.accroches.some((a) => a.porteAngle) ? [] : ["aucune ne porte l'angle"]) },
  { id: "ACR-07", texte: "texte écrit (encadré) de 5 mots au plus", verifier: (s) => s.accroches.filter((a) => mots(a.ecrit) > 5).map((a) => `encadré « ${a.ecrit} »`) },
];

export const CONSIGNE_ACCROCHES = consigne(
  "Tu écris les ACCROCHES d'une courte vidéo d'Axion-IA : la 1re phrase dite, celle qui décide si le spectateur reste.",
  "Écris 10 accroches (12 au plus) sur au moins 6 familles, prises UNIQUEMENT dans la liste fournie (`famille` = identifiant exact). Une famille qui exige une matière absente ne s'utilise pas.",
  "Chaque accroche : une AFFIRMATION ou un RÉSULTAT (pas une question, sauf famille « question »), 20 mots au plus, au plus un nombre, un mot concret, la cible située, le problème et son coût dits tout de suite. Elle doit faire dire « c'est moi » à la cible.",
  "La tension d'une accroche chiffrée est dans l'ANOMALIE (« rien que pour… », « … à la main », « encore »), jamais dans le chiffre seul : un chiffre qui décrit un état normal est refusé.",
  "Pour chacune : `dit` (la phrase), `ecrit` (l'encadré de 5 mots au plus, qui apporte autre chose que la parole), `vu` (ce qu'on voit, jamais une personne ou un logo), `anomalie`, `boucleOuverte` (l'enjeu qui donne envie de rester, jamais une annonce), les preuves et matières qu'elle utilise, et `porteAngle`.",
  "Ni salut, ni présentation, ni « Stop », ni « Arrêtez. » seul, ni devoir imposé au spectateur ; une mise en garde (« Il ne faut jamais… ») est permise.",
  REGLE_PROBLEME,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(),
  REGLE_DONNEES,
);

export const schemaAccroches = z.object({
  arret: schemaArret.optional(),
  accroches: z.array(
    z.object({
      famille: z.string(),
      objectif: z.enum(["envoi", "sauvegarde", "commentaire", "fin-de-visionnage"]),
      dit: z.string(),
      ecrit: z.string(),
      vu: z.string(),
      anomalie: z.string(),
      boucleOuverte: z.string(),
      preuveIds: z.array(z.string()),
      matiereIds: z.array(z.string()),
      porteAngle: z.boolean(),
    }),
  ),
});
export type SortieAccroches = z.infer<typeof schemaAccroches>;

export const roleAccroches: DefinitionRole<typeof schemaAccroches> = {
  id: "accroches",
  version: 1,
  consigne: CONSIGNE_ACCROCHES,
  schema: schemaAccroches,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 10000,
  simuler(entree) {
    const l = lireVariable(entree.variable, entree.contexte.preuves);
    const familles = [...entree.variable.matchAll(/<famille id="([^"]+)"/g)].map((m) => m[1]);
    const liste = familles.length ? familles : ["situation-spectateur"];
    const m = l.matieres[0];
    // Simulation qui VARIE (E2E n° 1, n° 14) : accroches tirées du sujet (et d'une question reçue citée mot pour mot),
    // dans un ordre qui tourne avec le sujet ; jamais un nombre non prouvé.
    const s = sujetSimule(l.idee, /"motCle":\s*"([^"]+)"/.exec(entree.variable)?.[1]);
    const g = graine(l.idee);
    const v = (sing: string, plur: string) => (s.pluriel ? plur : sing);
    const P = capitale(s.possessif);
    const modeles = [
      `${capitale(s.court)}.`,
      `Ce que personne ne dit sur ${s.possessif}.`,
      `${P} : le coût caché.`,
      `Combien vous coûte${v("", "nt")} vraiment ${s.possessif} ?`,
      `${P} ${v("vole", "volent")} du temps à votre équipe.`,
      `Vous pensez gagner du temps sur ${s.possessif} ? Pas vraiment.`,
      `Le vrai problème avec ${s.possessif}.`,
      `${P} ne ${v("est", "sont")} pas une fatalité.`,
      `Une seule question sur ${s.possessif}.`,
      `${P}, chaque semaine, à la main.`,
      `${P} : l'erreur que personne ne voit.`,
      `Il ne faut jamais laisser ${s.possessif} à la main.`,
    ]
      .map((t) => tutoyer(t, l.adresse))
      .filter((t) => t.split(/\s+/).length <= 20 && !/\d/.test(t));
    const question = l.matieres.find((x) => x.type === "question-recue" && !x.chiffresNonProuves && x.texte.split(/\s+/).length <= 18 && !/\d/.test(x.texte));
    const dits = [...(question ? [`« ${question.texte.trim()} »`] : []), ...modeles.map((_, i) => modeles[(i + g) % modeles.length])];
    return {
      accroches: Array.from({ length: 10 }, (_, i) => ({
        famille: liste[i % liste.length],
        objectif: "envoi" as const,
        dit: dits[i % dits.length],
        ecrit: tirer([`${capitale(s.motCle)} : le coût`, `Moins de ${s.motCle}`, `${capitale(s.motCle)}, le vrai prix`], g, i).split(/\s+/).slice(0, 5).join(" "),
        vu: tirer(["Un écran couvert de cellules", "Une pile de dossiers", "Une main sur un clavier, tard le soir"], g, i),
        anomalie: "à la main",
        boucleOuverte: "Ce que ça coûte vraiment",
        preuveIds: [],
        matiereIds: question && i === 0 ? [question.id] : m ? [m.id] : [],
        porteAngle: i === 0,
      })),
    };
  },
};
