/**
 * CHAÎNE « ÉQUIPE » · 3. ACCROCHES (Opus, effort moyen), écrites APRÈS le corps : 5 accroches de 5 familles, chacune
 * notée, et la 1re ligne du post. Le CODE élimine celles qui échouent (`motifsAccrocheRefusee` : 1re phrase de 12 mots au
 * plus et finie avant 3 s au débit de la recette, un chiffre ou un « pour qui » dans les 9 premiers mots, ni pré-roll ni
 * salut), celles qui enfreignent une règle de Will (`violationsReglesWill`), une famille hors liste ou déjà prise, et
 * garde la mieux notée (`filtrerAccroches`).
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, lireVariable, REGLE_DONNEES, REGLE_RIEN_INVENTE, regleTon, schemaArret, sujetSimule, tutoyer } from "./commun";
import { motifsAccrocheRefusee, REGLES_WILL, violationsReglesWill, type TailleCible } from "./equipe-commun";
import { ditNonProuve, idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

export const schemaEquipeAccroches = z.object({
  arret: schemaArret.optional(),
  accroches: z.array(
    z.object({
      famille: z.string(),
      dit: z.string(),
      ecrit: z.string(),
      /** Note du rôle, de 0 à 10 : le code garde la mieux notée parmi celles qui passent. */
      note: z.number(),
      raison: z.string(),
      preuveIds: z.array(z.string()),
      matiereIds: z.array(z.string()),
    }),
  ),
  premiereLigne: z.string(),
});
export type SortieEquipeAccroches = z.infer<typeof schemaEquipeAccroches>;
export type AccrocheEquipe = SortieEquipeAccroches["accroches"][number];

export const EVALUATIONS_EQUIPE_ACCROCHES: readonly Evaluation<SortieEquipeAccroches>[] = [
  { id: "EQA-01", texte: "5 accroches de 5 familles permises", verifier: (s, c) => (s.arret ? [] : [s.accroches.length !== 5 ? `${s.accroches.length} accroches` : null, new Set(s.accroches.map((a) => a.famille)).size !== s.accroches.length ? "familles répétées" : null, ...s.accroches.filter((a) => !c.famillesPermises.includes(a.famille)).map((a) => `famille ${a.famille} hors liste`)].filter((x): x is string => !!x)) },
  { id: "EQA-02", critique: true, texte: "aucune preuve ni matière inventée, aucun nombre non prouvé", verifier: (s, c) => s.accroches.flatMap((a) => [...idsInconnus(a.preuveIds, c.preuveIds), ...idsInconnus(a.matiereIds, c.matiereIds)].map((x) => `id inconnu ${x}`).concat([a.dit, a.ecrit].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`))).concat(ditNonProuve(s.premiereLigne, c).map((x) => `1re ligne : « ${x} » non prouvé`)) },
  { id: "EQA-03", texte: "règles de Will tenues", verifier: (s) => [...s.accroches.map((a) => a.dit), s.premiereLigne].flatMap((t) => violationsReglesWill(t).map((v) => `${v.id} : « ${t} »`)) },
];

export const CONSIGNE_EQUIPE_ACCROCHES = consigne(
  "Tu écris les ACCROCHES d'une courte vidéo d'Axion-IA dont le corps est DÉJÀ écrit (<corps>), au format de la <recette>, pour UN réseau (<reseau>) et UNE cible (<cible>). L'accroche + le corps doivent se lire d'une traite, sans répéter la 1re phrase du corps.",
  "Exactement 5 accroches, sur 5 familles différentes prises UNIQUEMENT dans la liste fournie (<familles>, `famille` = identifiant exact). Chacune : `dit` (ce qui est dit), `ecrit` (un encadré de 5 mots au plus), `note` (de 0 à 10 : la force pour un dirigeant de la cible qui fait défiler son fil) et `raison` (en une phrase).",
  "Le CODE élimine toute accroche qui échoue : 1re phrase de 12 mots au plus, finie avant 3 secondes au débit fourni ; un chiffre prouvé ou un « pour qui » (la cible : sa taille ou sa fonction) dans les 9 premiers mots ; ni salut, ni annonce de la vidéo (« Aujourd'hui on va… »), ni « Stop ».",
  "`premiereLigne` : la 1re ligne de la publication, qui donne envie de lire la suite, avec le mot-clé du <fond>, différente de chaque accroche.",
  REGLES_WILL,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  "Si rien ne tient sans inventer, remplis `arret` avec ANCRAGE_MANQUANT et la raison, sans accroche.",
  REGLE_DONNEES,
);

export const roleEquipeAccroches: DefinitionRole<typeof schemaEquipeAccroches> = {
  id: "equipe-accroches",
  version: 1,
  consigne: CONSIGNE_EQUIPE_ACCROCHES,
  schema: schemaEquipeAccroches,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 6000,
  simuler(entree) {
    // Simulation : 5 accroches qui situent la cible tôt, sur les 5 premières familles fournies (aucun fait inventé).
    const l = lireVariable(entree.variable);
    const s = sujetSimule(l.idee, /"motCle": "([^"]+)"/.exec(entree.variable)?.[1]);
    const taille = /<cible taille="([^"]+)"/.exec(entree.variable)?.[1] ?? "PME";
    const familles = [...entree.variable.matchAll(/<famille id="([^"]+)"/g)].map((m) => m[1]);
    const t = (x: string) => tutoyer(x, l.adresse);
    const formes = [`Dirigeant de ${taille} ? ${capitale(s.possessif)} coûtent des heures.`, `En ${taille}, tout part de là. ${capitale(s.possessif)}, à la main.`, `Dirigeants de ${taille} : on supprime ${s.possessif}.`, `${taille} : du temps perdu. ${capitale(s.possessif)}, chaque semaine.`, `Patron de ${taille} ? Voici ce qu'on retire.`];
    const accroches = familles.slice(0, 5).map((famille, i) => ({ famille, dit: t(capitale(formes[i % formes.length])), ecrit: `${capitale(s.motCle)} : le coût`.split(/\s+/).slice(0, 5).join(" "), note: 8 - i, raison: "Simulation : la cible est située dès le début.", preuveIds: [], matiereIds: [] }));
    return { accroches, premiereLigne: t(`${capitale(s.motCle)} : ce qu'on met en place pour ${taille === "GE" ? "les grands groupes" : `les ${taille}`}`) };
  },
};

/**
 * Filtre par le CODE : élimine les accroches qui échouent, enfreignent une règle de Will (« vient de sortir », « nouvel
 * outil », « X vient d'annoncer », interdits, tics d'IA) ou dont la famille est hors liste ou déjà prise ; garde la mieux notée parmi les
 * autres (à note égale, la première). `gardees` : celles qui passent, la retenue en tête.
 */
export function filtrerAccroches(accroches: readonly AccrocheEquipe[], o: { debit: number; cible: { taille: TailleCible; fonction?: string }; famillesPermises?: readonly string[] }): { gardees: AccrocheEquipe[]; eliminees: { dit: string; motifs: string[] }[]; retenue?: AccrocheEquipe } {
  const eliminees: { dit: string; motifs: string[] }[] = [];
  const familles = new Set<string>();
  const passent = accroches.filter((a) => {
    const motifs = [
      ...motifsAccrocheRefusee(a.dit, o),
      ...violationsReglesWill(`${a.dit} ${a.ecrit}`).map((v) => `règle de Will : ${v.texte}`),
      ...(o.famillesPermises && !o.famillesPermises.includes(a.famille) ? [`famille ${a.famille} hors liste`] : []),
      ...(familles.has(a.famille) ? [`famille ${a.famille} déjà prise`] : []),
    ];
    familles.add(a.famille);
    if (motifs.length) eliminees.push({ dit: a.dit, motifs });
    return !motifs.length;
  });
  const retenue = passent.reduce<AccrocheEquipe | undefined>((b, a) => (!b || a.note > b.note ? a : b), undefined);
  return { gardees: retenue ? [retenue, ...passent.filter((a) => a !== retenue)] : [], eliminees, retenue };
}
