/**
 * RÔLE 2 · FOND MAÎTRE (plan v5 B.3.5 étape 2 ; K8, K11, K16, K19, K20 ; lot G4).
 * Opus, effort `medium` (B.3.4 n° 10, coût mesuré au banc G4). Fixe ce que le sujet affirme : idées, appui principal, exception, envoi, livraison, mot-clé.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, graine, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RIEN_INVENTE, schemaArret, sujetSimule, tirer, tutoyer } from "./commun";
import { ditNonProuve, idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_FOND: readonly Evaluation<SortieFond>[] = [
  { id: "FND-01", texte: "1 à 3 idées", verifier: (s) => (s.arret ? [] : s.idees.length < 1 || s.idees.length > 3 ? [`${s.idees.length} idées`] : []) },
  { id: "FND-02", critique: true, texte: "appui principal = une preuve ou une matière fournie", verifier: (s, c) => (s.arret ? [] : !s.appuiPrincipal.preuveId && !s.appuiPrincipal.matiereId ? ["appui absent"] : [...idsInconnus(s.appuiPrincipal.preuveId ? [s.appuiPrincipal.preuveId] : [], c.preuveIds), ...idsInconnus(s.appuiPrincipal.matiereId ? [s.appuiPrincipal.matiereId] : [], c.matiereIds)].map((x) => `appui inconnu ${x}`)) },
  { id: "FND-03", texte: "exception sourcée ou proposée à part (K19)", verifier: (s, c) => (s.exception.source === "matiere" && (!s.exception.matiereId || !c.matiereIds.has(s.exception.matiereId)) ? ["limite « matière » sans matière fournie"] : []) },
  { id: "FND-04", texte: "destinataire de l'envoi = un rôle (K20)", verifier: (s) => (s.arret || s.envoi.destinataireRole.trim() ? [] : ["destinataire absent"]) },
  { id: "FND-05", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => [s.livraison, ...s.idees.map((i) => i.affirmation)].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`) },
  { id: "FND-06", texte: "issue donnée (§2 bis)", verifier: (s) => (s.arret || s.issue.trim() ? [] : ["issue absente"]) },
];

export const CONSIGNE_FOND = consigne(
  "Tu fixes le FOND d'une courte vidéo d'Axion-IA, à partir de l'angle retenu. Tu n'écris pas encore le texte dit.",
  "Donne : le thème (3 mots au plus, avec le mot-clé), le mot-clé que la cible taperait vraiment, 1 à 3 idées (une affirmation chacune, avec ses preuves ou matières), l'APPUI PRINCIPAL, OBLIGATOIRE (`preuveId` d'une preuve fournie, sinon `matiereId` d'une matière fournie : observation, étude, question reçue… ; une matière `avis-will` seulement si Will parle lui-même), l'ISSUE, la LIVRAISON (la phrase la plus nette que le spectateur retient, tenant exactement la promesse de l'angle) et l'ENVOI (un rôle de la liste fournie qui décide ou qui gagne, jamais la personne dont la vidéo parle, et la phrase qui lui donne envie de transmettre).",
  "EXCEPTION (la limite) : si une matière `limite` ou `avis-will` fournie la porte, cite-la mot pour mot (`source: matiere`, son id). Sinon une preuve. Sinon ne la rédige pas dans le texte : propose-la à part (`source: proposition-machine`, elle sera validée par Will) ou `source: aucune`. Choisis sa place parmi celles permises.",
  "Ajoute 0 à 2 critères propres au sujet que le texte devra respecter (ex. « la preuve X n'est jamais chiffrée »).",
  REGLE_PROBLEME,
  REGLE_RIEN_INVENTE,
  "Ne jamais adoucir une affirmation pour éviter de la prouver : si elle n'a pas de preuve, remplis `arret` avec PREUVE_MANQUANTE.",
  REGLE_DONNEES,
);

export const schemaFond = z.object({
  arret: schemaArret.optional(),
  theme: z.string(),
  motCle: z.string(),
  motCleVariante: z.string(),
  idees: z.array(z.object({ affirmation: z.string(), preuveIds: z.array(z.string()), matiereIds: z.array(z.string()) })),
  appuiPrincipal: z.object({ preuveId: z.string().optional(), matiereId: z.string().optional() }),
  issue: z.string(),
  livraison: z.string(),
  exception: z.object({
    source: z.enum(["matiere", "preuve", "proposition-machine", "aucune"]),
    texte: z.string(),
    matiereId: z.string().optional(),
    preuveId: z.string().optional(),
    place: z.enum(["concession-tot", "apres-livraison", "avant-appel", "angle"]),
  }),
  envoi: z.object({ destinataireRole: z.string(), phrase: z.string() }),
  niveauConscience: z.enum(["ignore-le-probleme", "connait-le-probleme", "connait-les-solutions", "compare-les-offres"]),
  criteresPropres: z.array(z.object({ texte: z.string() })),
});
export type SortieFond = z.infer<typeof schemaFond>;

export const roleFond: DefinitionRole<typeof schemaFond> = {
  id: "fond",
  version: 1,
  consigne: CONSIGNE_FOND,
  schema: schemaFond,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 8000,
  simuler(entree) {
    const l = lireVariable(entree.variable, entree.contexte.preuves);
    const m = l.matieres[0];
    const limite = l.matieres.find((x) => x.type === "limite");
    const preuve = m?.preuve ?? l.preuves[0];
    // Simulation qui VARIE (E2E n° 1, n° 14) : mot-clé, idée, livraison et limite proposée tirés du SUJET.
    const s = sujetSimule(l.idee);
    const g = graine(l.idee);
    const v = (sing: string, plur: string) => (s.pluriel ? plur : sing);
    const limites = [
      `En revanche, si ${s.possessif} ${v("change", "changent")} de forme chaque mois, gardez la main.`,
      `Par contre, si ${s.possessif} ne ${v("revient", "reviennent")} qu'une fois par an, ne l'automatisez pas.`,
      `À moins que ${s.possessif} ${v("demande", "demandent")} un vrai jugement à chaque fois : là, gardez-${v("la", "les")}.`,
    ];
    return {
      theme: tirer([`Moins de temps sur ${s.possessif}`, `${capitale(s.possessif)} sans geste à la main`, `Ce que coûte${v("", "nt")} ${s.possessif}`], g),
      motCle: s.motCle,
      motCleVariante: tirer([`${s.motCle} à la main`, `${s.motCle} faite${v("", "s")} à la main`, `le temps passé sur ${s.possessif}`], g),
      idees: [{ affirmation: tirer([`${capitale(s.possessif)} : le geste se supprime, il ne s'accélère pas.`, `${capitale(s.possessif)} ne demande${v("", "nt")} pas plus d'effort, juste moins de copie.`, `Sur ${s.possessif}, la machine copie et l'humain vérifie.`], g), preuveIds: preuve ? [preuve] : [], matiereIds: m ? [m.id] : [] }],
      appuiPrincipal: preuve ? { preuveId: preuve } : { matiereId: m?.id },
      issue: tirer([`Retirer le geste à la main de ${s.possessif}.`, `Confier ${s.possessif} à un outil, garder la vérification.`, `Commencer par la partie la plus répétitive de ${s.possessif}.`], g),
      livraison: tirer(["La tâche ne prend presque plus de temps.", "Il ne reste qu'à vérifier.", "L'équipe récupère ce temps."], g),
      exception: limite ? { source: "matiere" as const, texte: limite.texte, matiereId: limite.id, place: "apres-livraison" as const } : { source: "proposition-machine" as const, texte: tutoyer(tirer(limites, g), l.adresse), place: "apres-livraison" as const },
      envoi: tirer([{ destinataireRole: "DAF", phrase: "Votre DAF saura quoi en faire." }, { destinataireRole: "dirigeant", phrase: "Votre dirigeant saura quoi en faire." }, { destinataireRole: "responsable administratif", phrase: "Votre responsable administratif saura quoi en faire." }], g),
      niveauConscience: "connait-le-probleme" as const,
      criteresPropres: [],
    };
  },
};
