/**
 * RÔLE 7 · ADAPTATEUR DE FORMAT, LA PROSE (plan v5 B.3.5 étape 7 ; K3-K6, K10, K14-K25 ; §2 bis à §2 quinquies ; lot G4).
 * Opus, effort `high`. Écrit le CORPS COMMUN à partir du plan validé par le code : l'ouverture (accroche) et la fin
 * (appel, boucle) sont refaites par réseau à l'étape 11. Les blocs, annotations et plafonds viennent de la recette.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, graine, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECIT, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, regleTon, schemaArret, schemaMarqueur, schemaNature, sujetSimule, tirer, tutoyer } from "./commun";
import { ditNonProuve, idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/** Plafond de mots par phrase (PRS-04) et part des segments qui portent une emphase : lus par la consigne ET par les contrôles. */
export const MOTS_PAR_PHRASE_MAX = 14;
export const PART_EMPHASE_MAX = 0.4;
export const REGLE_PHRASES_COURTES = `PHRASES : ${MOTS_PAR_PHRASE_MAX} mots au plus par phrase.`;
export const REGLE_EMPHASE = `\`emphase\` (2 mots au plus, jamais dans les 3 premières secondes, sur ${Math.round(PART_EMPHASE_MAX * 100)} % des segments au plus)`;

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_PROSE: readonly Evaluation<SortieProse>[] = [
  { id: "PRS-01", texte: "blocs du corps permis par la recette", verifier: (s, c) => s.segments.filter((x) => c.blocsCorps && !c.blocsCorps.includes(x.bloc)).map((x) => `bloc ${x.bloc} hors recette`) },
  { id: "PRS-02", critique: true, texte: "aucune preuve ni matière inventée", verifier: (s, c) => s.segments.flatMap((x) => [...idsInconnus(x.preuveIds, c.preuveIds), ...idsInconnus(x.matiereIds, c.matiereIds)]).map((x) => `id inconnu ${x}`) },
  { id: "PRS-03", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => s.segments.flatMap((x) => ditNonProuve(x.texte, c)).map((x) => `« ${x} » non prouvé`) },
  { id: "PRS-04", texte: "phrases de 14 mots au plus", verifier: (s) => s.segments.flatMap((x) => x.texte.split(/(?<=[.!?…])\s+/)).filter((p) => p.split(/\s+/).filter(Boolean).length > MOTS_PAR_PHRASE_MAX).map((p) => `phrase longue : « ${p} »`) },
  { id: "PRS-05", critique: true, texte: "limite proposée jamais écrite dans le texte (K19)", verifier: (s) => (s.limiteProposee && s.segments.some((x) => x.texte.includes(s.limiteProposee!.slice(0, 30))) ? ["limite proposée écrite dans le texte"] : []) },
  { id: "PRS-07", critique: true, texte: "chaque segment de corps du plan est écrit", verifier: (s, c) => (s.arret || !c.planCorps?.length ? [] : c.planCorps.filter((i) => !s.segments.some((x) => x.planIndex === i)).map((i) => `segment ${i} du plan non écrit`)) },
  { id: "PRS-06", texte: "au moins une phrase de 3 mots ou moins (K14)", verifier: (s) => (s.arret || s.segments.flatMap((x) => x.texte.split(/(?<=[.!?…])\s+/)).some((p) => p.split(/\s+/).filter(Boolean).length <= 3) ? [] : ["aucune phrase courte"]) },
];

export const CONSIGNE_PROSE = consigne(
  "Tu écris le TEXTE DIT du corps d'une courte vidéo d'Axion-IA, face caméra, à partir du PLAN validé (un segment du plan = une ou deux phrases). L'accroche et l'appel seront refaits par réseau : tu écris tout ce qui est entre les deux.",
  "Écris AU MOINS un segment pour CHAQUE segment `corps` du plan, dans l'ordre (`planIndex` = son index) : aucun segment du plan n'est sauté, surtout pas l'appui, la livraison ni l'exception. Le corps commence par une phrase qui se comprend seule et enchaîne sur l'accroche fournie sans la répéter. Garde l'ordre du plan, ses preuves, ses matières, son exception. Une matière citée l'est MOT POUR MOT (`citeMatiereId`). Chaque segment est relié au précédent par une cause ou une opposition réelle, jamais par un simple ajout.",
  "Tiens le plafond du corps (en secondes, au débit fourni) : plus court vaut mieux que rempli. Ne dis pas deux fois la même preuve dans les 10 premières secondes. Répète le mot-clé seulement dans une phrase qui apprend quelque chose. Utilise une expression du carnet de voix s'il en contient.",
  "Termine la partie information sur le fait le plus net, qui récompense le spectateur : pas un résumé, pas une morale, ni le délai ni le coût (ils vont dans la légende).",
  "LIMITE : si le fond ne fournit qu'une limite proposée, écris à sa place exactement « [LIMITE À VALIDER] » et recopie la proposition dans `limiteProposee`.",
  `Annotations permises par la recette seulement : ${REGLE_EMPHASE}, \`incrustation\` (un montant égal à une valeur de preuve, avec son sens, ou un objet), \`intentionIllustration\` (environ un segment sur trois ; jamais une personne, un visage, une main, un logo ni une marque ; jamais un chiffre, un graphique ni une jauge sans preuve chiffrée). Marque \`facultatif\` les segments qui ne servent qu'au réseau le plus long (au plus le nombre permis).`,
  REGLE_RECIT,
  REGLE_PROBLEME,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(),
  REGLE_DONNEES,
);

export const schemaProse = z.object({
  arret: schemaArret.optional(),
  segments: z.array(
    z.object({
      planIndex: z.number().int(),
      bloc: z.string(),
      texte: z.string(),
      nature: schemaNature,
      marqueurs: z.array(schemaMarqueur),
      preuveIds: z.array(z.string()),
      matiereIds: z.array(z.string()),
      citeMatiereId: z.string().optional(),
      emphase: z.array(z.string()),
      intentionIllustration: z.string().optional(),
      incrustation: z.object({ type: z.enum(["montant", "objet"]), texte: z.string(), sens: z.enum(["gain", "perte"]).optional() }).optional(),
      facultatif: z.boolean(),
    }),
  ),
  limiteProposee: z.string().optional(),
});
export type SortieProse = z.infer<typeof schemaProse>;

export const roleProse: DefinitionRole<typeof schemaProse> = {
  id: "prose",
  version: 1,
  consigne: CONSIGNE_PROSE,
  schema: schemaProse,
  modele: MODELE_ECRITURE,
  effort: "high",
  maxTokens: 9000,
  simuler(entree) {
    const l = lireVariable(entree.variable, entree.contexte.preuves);
    const blocs = [...entree.variable.matchAll(/<bloc id="([^"]+)"/g)].map((m) => m[1]);
    const [b1, b2] = [blocs[0] ?? "corps", blocs[1] ?? blocs[0] ?? "corps"];
    const m = l.matieres[0];
    const p = m?.preuve ?? l.preuves[0];
    const limite = l.matieres.find((x) => x.type === "limite");
    const seg = (planIndex: number, bloc: string, texte: string, marqueurs: z.infer<typeof schemaMarqueur>[], extra: Partial<SortieProse["segments"][number]> = {}) => ({ planIndex, bloc, texte, nature: "fait" as const, marqueurs, preuveIds: [], matiereIds: [], emphase: [], facultatif: false, ...extra });
    // Un segment par segment « corps » du plan validé (PRS-07), sans faux client : cadrage honnête au présent.
    let plan: { segments: { partie: string; fonction: string[] }[] } | null = null;
    try {
      plan = JSON.parse(/<plan_valide>\n([\s\S]*?)\n<\/plan_valide>/.exec(entree.variable)?.[1] ?? "null");
    } catch {
      plan = null;
    }
    // Simulation qui VARIE (E2E n° 1, n° 14) : le texte est tiré du sujet et de sa matière ; une matière sans chiffre
    // non prouvé est citée MOT POUR MOT, sinon cadrage hypothétique (« Prenons un dirigeant qui… »), jamais de faux client.
    const s = sujetSimule(l.idee, /"motCle":\s*"([^"]+)"/.exec(entree.variable)?.[1]);
    const g = graine(l.idee);
    const t = (x: string) => tutoyer(x, l.adresse);
    const citable = m && !m.chiffresNonProuves && !/\d/.test(m.texte) && m.texte.split(/\s+/).length <= 30 && !["limite", "cas-client"].includes(m.type) ? m : undefined;
    const ouverture = tirer([`Prenons un dirigeant qui gère ${s.possessif3} à la main.`, `Prenons une équipe qui refait ${s.possessif3} chaque semaine.`, `Prenons une PME où ${s.court} prend des heures.`], g);
    const pools: Record<string, string[]> = {
      relance: ["Chaque copie est une erreur possible.", "Personne ne vérifie ce qui est recopié.", "Le temps part, sans que personne le voie.", "Et l'erreur arrive au pire moment."],
      solution: ["Alors on supprime l'étape. Pas accélérée.", "La machine fait la copie. L'humain vérifie.", "On relie les outils entre eux. Fini.", "Un outil fait le geste à sa place."],
      resultat: ["Résultat : la tâche ne prend presque plus de temps.", "Résultat : moins d'erreurs, plus de temps.", "Ce qui reste : vérifier, pas recopier."],
      autre: [t("Ce temps-là revient à votre équipe."), "L'équipe garde la main sur la décision.", "Et les chiffres sont justes."],
    };
    const corps = (plan?.segments ?? []).map((x, i) => ({ s: x, i })).filter((x) => x.s.partie === "corps");
    const vus = new Set<string>();
    const segments = (corps.length ? corps : [{ s: { partie: "corps", fonction: ["preuve"] }, i: 1 }]).map(({ s: sp, i }, k) => {
      const exception = sp.fonction.includes("exception") && limite;
      if (exception) return seg(i, b2, limite.texte, ["exception"], { matiereIds: [limite.id], citeMatiereId: limite.id });
      const marqueurs = sp.fonction.filter((f): f is z.infer<typeof schemaMarqueur> => (schemaMarqueur.options as readonly string[]).includes(f));
      if (k === 0) {
        const texte = citable ? citable.texte.trim() : ouverture;
        return seg(i, b1, texte, marqueurs, { preuveIds: p ? [p] : [], matiereIds: m ? [m.id] : [], ...(citable ? { citeMatiereId: citable.id } : {}) });
      }
      const cle = sp.fonction.includes("solution") ? "solution" : sp.fonction.some((f) => f === "livraison" || f === "resultat") ? "resultat" : sp.fonction.includes("relance") ? "relance" : "autre";
      const pool = pools[cle];
      let texte = pool[(g + k) % pool.length];
      for (let d = 1; vus.has(texte) && d < pool.length; d++) texte = pool[(g + k + d) % pool.length];
      vus.add(texte);
      return seg(i, k < 2 ? b1 : b2, texte, marqueurs);
    });
    // Au moins une phrase de 3 mots ou moins (K14) et le mot-clé dans le corps.
    const dernier = segments[segments.length - 1];
    if (!segments.some((x) => x.texte.split(/(?<=[.!?…])\s+/).some((ph) => ph.split(/\s+/).filter(Boolean).length <= 3)) && dernier && !dernier.marqueurs.includes("exception")) dernier.texte = `${dernier.texte} ${tirer(["C'est tout.", "Point final.", "Et ça tient."], g)}`;
    return { segments };
  },
};
