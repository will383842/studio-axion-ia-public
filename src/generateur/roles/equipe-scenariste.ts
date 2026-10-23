/**
 * CHAÎNE « ÉQUIPE » · 2. SCÉNARISTE (Opus, effort moyen). Écrit le script COMPLET selon la recette du format, à partir
 * de la décision du rédacteur en chef : fond, corps (segments), publication. L'accroche s'écrit APRÈS (rôle suivant),
 * l'appel final est choisi par le code dans la banque des fins. Gain livré avant 40 % de la durée, une relance entre
 * 50 et 70 %, rien après l'appel ; phrases de 14 mots au plus et emphase : les règles de la prose (`prose.ts`).
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECIT, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, regleTon, schemaArret } from "./commun";
import { roleDeclinaison, schemaDeclinaison, type SortieDeclinaison } from "./declinaison";
import { REGLES_WILL, violationsReglesWill } from "./equipe-commun";
import { ditNonProuve, type Evaluation } from "./evaluation";
import { roleFond, schemaFond, type SortieFond } from "./fond";
import { EVALUATIONS_PROSE, REGLE_EMPHASE, REGLE_PHRASES_COURTES, roleProse, schemaProse, type SortieProse } from "./prose";
import type { DefinitionRole } from "./types";

/** Repères de la recette « équipe » (part de la durée dite, corps et appel). */
export const LIVRAISON_AVANT = 0.4;
export const RELANCE_ENTRE: readonly [number, number] = [0.5, 0.7];

/**
 * Mêmes champs que le script court (`chaine-courte.ts` · `schemaCourtScript`), pris dans les schémas de la grande chaîne
 * (sans importer la chaîne courte : ce module est lu par `roles/index.ts`) ; la version n'a ni accroche, ni 1re ligne.
 */
export const schemaEquipeScenariste = z.object({
  arret: schemaArret.optional(),
  fond: schemaFond.pick({ motCle: true, motCleVariante: true, appuiPrincipal: true, issue: true, livraison: true, envoi: true }).extend({ exception: schemaFond.shape.exception.omit({ preuveId: true }) }),
  segments: z.array(schemaProse.shape.segments.element.omit({ intentionIllustration: true, incrustation: true })),
  limiteProposee: z.string().optional(),
  version: schemaDeclinaison.pick({ boucle: true, encadre: true, couverture: true }).extend({
    /** Seulement sans <appel_impose> (aucune ligne de la banque pour ce réseau) : l'appel du type imposé. */
    appel: schemaDeclinaison.shape.appel.optional(),
    publication: schemaDeclinaison.shape.publication.pick({ texte: true, motsDiese: true, titres: true, post: true, justifications: true }),
  }),
});
export type SortieEquipeScenariste = z.infer<typeof schemaEquipeScenariste>;

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;

/**
 * Où tombent la livraison et les relances, en part de la durée dite (mots du corps puis de l'appel ; l'accroche, écrite
 * après, n'est pas encore là) : fin du segment `livraison`, début de chaque segment `relance`.
 */
export function reperesTemps(segments: readonly { texte: string; marqueurs: readonly string[] }[], appel = ""): { livraison?: number; relances: number[] } {
  const total = segments.reduce((t, s) => t + mots(s.texte), 0) + mots(appel);
  if (!total) return { relances: [] };
  let cumul = 0;
  let livraison: number | undefined;
  const relances: number[] = [];
  for (const s of segments) {
    if (s.marqueurs.includes("relance")) relances.push(cumul / total);
    cumul += mots(s.texte);
    if (livraison === undefined && s.marqueurs.includes("livraison")) livraison = cumul / total;
  }
  return { livraison, relances };
}

/** Motifs des repères de temps manqués (vide : tenus). */
export function reperesManques(segments: readonly { texte: string; marqueurs: readonly string[] }[], appel = ""): string[] {
  const r = reperesTemps(segments, appel);
  return [
    r.livraison === undefined ? "aucun segment `livraison`" : r.livraison > LIVRAISON_AVANT ? `gain livré à ${Math.round(r.livraison * 100)} % (avant ${LIVRAISON_AVANT * 100} %)` : "",
    r.relances.some((x) => x >= RELANCE_ENTRE[0] && x <= RELANCE_ENTRE[1]) ? "" : `aucune relance entre ${RELANCE_ENTRE[0] * 100} et ${RELANCE_ENTRE[1] * 100} %`,
  ].filter(Boolean);
}

export const EVALUATIONS_EQUIPE_SCENARISTE: readonly Evaluation<SortieEquipeScenariste>[] = [
  ...EVALUATIONS_PROSE.filter((e) => ["PRS-01", "PRS-02", "PRS-03", "PRS-04", "PRS-05", "PRS-06"].includes(e.id)).map((e) => ({ ...e, verifier: (s: SortieEquipeScenariste, c: Parameters<typeof e.verifier>[1]) => e.verifier({ arret: s.arret, segments: s.segments, limiteProposee: s.limiteProposee } as SortieProse, c) })),
  { id: "EQS-01", texte: "gain avant 40 %, relance entre 50 et 70 %", verifier: (s) => (s.arret ? [] : reperesManques(s.segments)) },
  { id: "EQS-02", critique: true, texte: "aucun nombre non prouvé dans la publication", verifier: (s, c) => [s.version.publication.texte, s.version.publication.post?.texte ?? ""].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`) },
  { id: "EQS-03", texte: "règles de Will tenues (segments, publication, appel)", verifier: (s) => (s.arret ? [] : [...s.segments.map((x) => x.texte), s.version.publication.texte, s.version.publication.post?.texte ?? "", s.version.appel?.texte ?? ""].flatMap((t) => violationsReglesWill(t).map((v) => `${v.id} : « ${t} »`))) },
];

export const CONSIGNE_EQUIPE_SCENARISTE = consigne(
  "Tu es le SCÉNARISTE d'Axion-IA. Tu écris le script COMPLET d'une courte vidéo, au format de la <recette>, pour UN réseau (<reseau>), à partir de la décision du rédacteur en chef (<decision_chef>) : son angle, sa cible, sa promesse, son idée unique et sa preuve. La structure est imposée (<structure_imposee>).",
  "L'ACCROCHE sera écrite APRÈS toi, sur ton corps : le corps commence par une phrase qui se comprend seule. L'APPEL final est imposé (<appel_impose>, choisi par le code) : tu ne l'écris pas, tu y amènes ; RIEN après l'appel. Sans <appel_impose>, écris `version.appel` du type demandé (<appel type=…>), 47 mots au plus, jamais de réservation directe ni de prix. Un appel d'envoi nomme le destinataire de `fond` mot pour mot.",
  "`fond` : le mot-clé (2 à 4 mots que la cible dit vraiment et qui se disent tels quels dans une phrase française : « devis d'électricien », pas « devis électricien ») et une variante, l'appui principal (la preuve retenue), l'issue, la livraison (le gain, le fait le plus net, qui récompense le spectateur), l'exception (une matière `limite` fournie, sinon une proposition marquée `proposition-machine`), le destinataire d'un envoi (`destinataireRole` : un rôle pris mot pour mot dans la liste « Rôles destinataires d'un envoi » fournie) et sa phrase, qui nomme ce rôle mot pour mot (« Envoyez-la à votre DAF. »), jamais « un collègue », ni un métier hors de cette liste, ni la personne que la vidéo met en cause.",
  "`segments` : le TEXTE DIT du corps, dans l'ordre de la structure imposée, réparti dans les blocs du corps de la recette (<blocs_corps>, `bloc` = son id) ; un segment = une ou deux phrases, `planIndex` = son rang à partir de 1. Une matière citée l'est MOT POUR MOT (`citeMatiereId`). Chaque segment est relié au précédent par une cause ou une opposition réelle. Tiens le plafond du corps (en secondes, au débit fourni) : plus court vaut mieux que rempli.",
  "MOT-CLÉ : le mot-clé de `fond` est DIT mot pour mot (mêmes mots, même ordre, sans accord ni conjugaison) au moins DEUX fois dans le corps, car l'accroche, écrite après toi, peut ne pas le dire : dans le 1er segment, puis une seconde fois plus loin, dans une phrase qui apporte un fait nouveau, jamais suivi de « concrètement » ni de « donc ».",
  `RYTHME : le GAIN (segment marqué \`livraison\`) est dit avant ${LIVRAISON_AVANT * 100} % de la durée ; UNE relance (segment marqué \`relance\` : un enjeu, jamais une annonce) commence entre ${RELANCE_ENTRE[0] * 100} et ${RELANCE_ENTRE[1] * 100} %.`,
  "`marqueurs` de chaque segment (liste fermée) : `livraison` (un seul), `ancrage` sur chaque segment qui cite la matière d'ancrage, `cout`, `solution`, `resultat` ou `methode` selon ce qu'il dit, `exception` sur la limite (ou « [LIMITE À VALIDER] »), `relance`.",
  "LIMITE : si tu n'as qu'une limite proposée, écris à sa place exactement « [LIMITE À VALIDER] » et recopie la proposition dans `limiteProposee`.",
  "`version` : la boucle si le réseau en a une (6 mots au plus), l'encadré (5 mots au plus, qui contient le mot-clé mot pour mot et apporte autre chose que la parole) et la couverture (5 mots au plus), la publication selon les règles du réseau fournies (sa 1re ligne sera écrite avec l'accroche), chaque choix de plateforme justifié par l'identifiant de sa règle datée (`regleId`).",
  "Si <fiche_cible> est fournie : écris avec les mots de cette cible (<mots_de_la_cible>), réponds par le fait aux objections qu'elle se fait (<objections_de_la_cible>) sans les citer ni les annoncer, et ne dis jamais ce qui figure dans <a_ne_pas_dire>. UNE vidéo = UNE cible : n'élargis pas à une autre taille ni à un autre métier.",
  REGLES_WILL,
  REGLE_PROBLEME,
  REGLE_RECIT,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  REGLE_PHRASES_COURTES,
  `Annotation du segment : ${REGLE_EMPHASE}.`,
  "Si le script ne tient pas sans inventer, remplis `arret` (ANCRAGE_MANQUANT ou PREUVE_MANQUANTE) avec la raison.",
  REGLE_DONNEES,
);

/** Plan factice de la SIMULATION seulement : la livraison tôt, la relance au milieu (les repères de la recette tenus). */
const PLAN_SIMULE = { segments: [{ partie: "ouverture", fonction: ["accroche"] }, ...[["ancrage"], ["livraison"], ["solution"], ["relance"], ["exception"]].map((fonction) => ({ partie: "corps", fonction }))] };

export const roleEquipeScenariste: DefinitionRole<typeof schemaEquipeScenariste> = {
  id: "equipe-scenariste",
  version: 3,
  consigne: CONSIGNE_EQUIPE_SCENARISTE,
  schema: schemaEquipeScenariste,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 12000,
  simuler(entree) {
    // Simulation : fond, prose et déclinaison simulés, composés (aucun appel, aucun fait inventé).
    const fond = roleFond.simuler(entree) as SortieFond;
    const prose = roleProse.simuler({ ...entree, variable: `${entree.variable}\n<plan_valide>\n${JSON.stringify(PLAN_SIMULE)}\n</plan_valide>` }) as SortieProse;
    const v = roleDeclinaison.simuler({ ...entree, variable: `${entree.variable}\nMot-clé : ${fond.motCle}\nDestinataire de l'envoi : ${fond.envoi.destinataireRole}` }) as SortieDeclinaison;
    const { premiereLigne: _p, commentaireEpingle: _c, motsClesDeclares: _d, motsClesBloques: _b, motCleVariante: _m, ...publication } = v.publication;
    void [_p, _c, _d, _b, _m];
    const segments = prose.segments.map(({ intentionIllustration: _i, incrustation: _x, ...x }) => {
      void [_i, _x];
      return x;
    });
    return { fond, segments, limiteProposee: prose.limiteProposee, version: { boucle: v.boucle, encadre: v.encadre, couverture: v.couverture, ...(/<appel_impose /.test(entree.variable) ? {} : { appel: v.appel }), publication } };
  },
};
