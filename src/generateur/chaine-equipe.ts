/**
 * CHAÎNE « ÉQUIPE » : une chaîne d'écriture LIVRÉE ÉTEINTE, choisie seulement si le réglage `generateur.chaine` vaut
 * « equipe » (aiguillage `chaineDeLEcriture`, `services/generation-claude.ts`, et `services/boucle-generation.ts`).
 *
 * Mêmes données (`DonneesGeneration`), même socle en cache 1 h (`creerContexte` → `blocsEnCache`), même exécutant
 * injecté, mêmes contrôles par code (`assemblerVersion` → `controlerVersion`, note /100, voyant) que les autres chaînes.
 * Aucun `output_config.format` : le JSON est demandé dans la consigne et validé par zod (`construireRequete`).
 *  0. CODE (aucun appel) : structure de l'étape 0, objectif de la vidéo, cible, appel final pris dans la banque des fins
 *     par réseau, rotation de 3 extraits de Will (`preparerEquipe`) ;
 *  1. rédacteur en chef (Opus, moyen) : angle, cible, promesse, idée, preuve ; « un influenceur IA pourrait-il dire
 *     cela ? » oui : un nouvel angle, UNE fois ;
 *  2. scénariste (Opus, moyen) : le script complet selon la recette ;
 *  3. accroches (Opus, moyen), écrites après le corps : 5 + la 1re ligne du post ; le code élimine et garde la mieux notée ;
 *  4. relecteur unique (Opus, moyen) : juge, ≤ 5 corrections ; le code trie, applique, refuse ce qui perd l'ancrage,
 *     puis recontrôle (une version relue qui a plus de garde-fous rouges qu'avant est écartée) ;
 *  5. une version par réseau en plus : le rôle `declinaison` (Sonnet, bas), l'appel remis à celui de la banque.
 * L'état est sauvé après chaque étape : une reprise repart de la dernière étape terminée sans rien repayer.
 */
import { citeeMotPourMot } from "@/domaine/controles-script";
import { alertesRepetitions, garderSansNouvelleRepetition } from "@/domaine/qualite-script/repetitions";
import type { ReseauDeclinaison } from "@/domaine/types";
import {
  Attente,
  FACTEUR_SORTIE_RENVOYEE,
  JETONS_CONSIGNES_AJOUTEES,
  appelPour,
  appeler,
  appliquerCorrections,
  assemblerVersion,
  blocsDeProse,
  creerContexte,
  declinerVersion,
  famillesRealisables,
  famillesTexte,
  finalisteDe,
  fondTexte,
  noterEtVoyant,
  ReponseCoupee,
  rendreReglesReseau,
  texteBlocs,
  variableBase,
  type Contexte,
  type EtatChaine,
  type ExecuteurRoles,
  type OptionsChaine,
  type VersionEcrite,
} from "./chaine";
import { adresseFautive, appelImposeDe, avecIntentions, completerMarqueurs, finirVersions, fondDe, garderCitationsAncrage, planOuverture, reseauxDe, type AppelImpose } from "./chaine-courte";
import { matieresEnvoyees, rendreMatiere, type DonneesGeneration } from "./contexte";
import { graine } from "./roles/commun";
import { roleDeclinaison, type SortieDeclinaison } from "./roles/declinaison";
import { pireCasPrudentAppel, totaliserPireCas, type PireCasChaine } from "./roles/estimation";
import { EVALUATIONS_EQUIPE_ACCROCHES, filtrerAccroches, roleEquipeAccroches, type SortieEquipeAccroches } from "./roles/equipe-accroches";
import { ficheCibleEquipe, rendreFicheCible, type FicheCibleEquipe } from "./roles/equipe-bases";
import { EVALUATIONS_EQUIPE_CHEF, roleEquipeChef, type SortieEquipeChef } from "./roles/equipe-chef";
import { appelEquipe, cibleEquipe, extraitsWillTournants, motifsAccrocheRefusee, objectifEquipe, rendreExtraitsTournants, violationsReglesWill, type AppelEquipe, type ObjectifEquipe } from "./roles/equipe-commun";
import { EVALUATIONS_EQUIPE_RELECTEUR, roleEquipeRelecteur, trierCorrections, type SortieEquipeRelecteur } from "./roles/equipe-relecteur";
import { EVALUATIONS_EQUIPE_SCENARISTE, LIVRAISON_AVANT, RELANCE_ENTRE, reperesManques, roleEquipeScenariste, type SortieEquipeScenariste } from "./roles/equipe-scenariste";
import { ditNonProuve } from "./roles/evaluation";
import { MOTS_PAR_PHRASE_MAX, REGLE_EMPHASE, type SortieProse } from "./roles/prose";
import type { DefinitionRole } from "./roles/types";

export const ROLES_CHAINE_EQUIPE = { chef: roleEquipeChef, scenariste: roleEquipeScenariste, accroches: roleEquipeAccroches, relecteur: roleEquipeRelecteur } as const;

/* ------------------------------------------------------------------ */
/* 0. Préparation par le code                                           */
/* ------------------------------------------------------------------ */

export interface PreparationEquipe {
  structure: string;
  objectif: ObjectifEquipe;
  cible: ReturnType<typeof cibleEquipe>;
  /** Appel final de chaque réseau, pris dans la banque des fins (null : aucune ligne, le scénariste l'écrit). */
  appels: Partial<Record<ReseauDeclinaison, AppelEquipe | null>>;
  /** Codes des extraits de Will montrés à ce sujet (rotation). */
  extraits: string[];
  /** Fiche de la cible lue dans les bases de l'Usine (absente : le brief ne donne pas de cible, ou aucune fiche : comportement d'avant). */
  fiche?: FicheCibleEquipe;
}

/** Étape 0 de la chaîne « équipe », PURE et sans appel : la même entrée donne toujours la même préparation. */
export function preparerEquipe(d: DonneesGeneration, reseaux: readonly ReseauDeclinaison[]): PreparationEquipe {
  const g = graine(d.sujet.idee, d.sujet.formatId);
  const objectif = objectifEquipe(d.sujet);
  const cible = cibleEquipe(d.sujet.cible);
  const fiche = ficheCibleEquipe(d.sujet.cible, cible, d.sujet.idee, g);
  return {
    structure: d.choix.structure,
    objectif,
    cible,
    appels: Object.fromEntries(reseaux.map((r) => [r, appelEquipe(r, objectif, graine(d.sujet.idee, r))])),
    extraits: extraitsWillTournants(g).map((x) => x.code),
    ...(fiche ? { fiche } : {}),
  };
}

/** Ce que la chaîne garde en plus dans l'état sauvé (champ facultatif : l'état reste un `EtatChaine`). */
export interface EtatEquipe {
  preparation?: PreparationEquipe;
  chef?: SortieEquipeChef;
  /** L'angle refusé au test « influenceur IA » (le chef a été rappelé une fois). */
  angleRefuse?: SortieEquipeChef;
  /** Ce que le scénariste a écrit pour la version (sans accroche ni 1re ligne). */
  scenario?: SortieEquipeScenariste["version"];
  accroches?: { premiereLigne: string; eliminees: { dit: string; motifs: string[] }[] };
  relecture?: SortieEquipeRelecteur;
  /** Corrections du relecteur refusées par le code (ancrage perdu, nombre non prouvé, règle de Will, accroche refusée). */
  refusees?: string[];
}
export type EtatChaineEquipe = EtatChaine & { equipe?: EtatEquipe };

const equipeDe = (c: Contexte): EtatEquipe => ((c.etat as EtatChaineEquipe).equipe ??= {});

/* ------------------------------------------------------------------ */
/* Parties variables                                                    */
/* ------------------------------------------------------------------ */

function rendrePreparation(c: Contexte, p: PreparationEquipe): string {
  const extraits = extraitsWillTournants(graine(c.d.sujet.idee, c.d.sujet.formatId)).filter((x) => p.extraits.includes(x.code));
  return [`<structure_imposee>${p.structure}</structure_imposee>`, `<objectif_video>${p.objectif}</objectif_video>`, `<cible taille="${p.cible.taille}">${p.cible.texte}</cible>`, rendreExtraitsTournants(extraits)].join("\n");
}

function variableChef(c: Contexte, p: PreparationEquipe, reseau: ReseauDeclinaison, refuse?: SortieEquipeChef): string {
  return [variableBase(c), rendrePreparation(c, p), rendreFicheCible(p.fiche, "chef"), rendreReglesReseau(c, reseau)[0], refuse ? `<angle_refuse>\n${JSON.stringify({ angle: refuse.angle, raison: refuse.testInfluenceur.raison })}\n</angle_refuse>` : ""].filter(Boolean).join("\n");
}

const decisionChef = (chef: SortieEquipeChef | undefined) => (chef ? `<decision_chef>\n${JSON.stringify({ ...chef, arret: undefined, testInfluenceur: undefined }, null, 1)}\n</decision_chef>` : "");

function appelImpose(c: Contexte, p: PreparationEquipe, reseau: ReseauDeclinaison, corps: Parameters<typeof appelPour>[3]): AppelImpose {
  return appelImposeDe(c, p.appels[reseau], reseau, corps);
}

function variableScenariste(c: Contexte, p: PreparationEquipe, reseau: ReseauDeclinaison): string {
  const blocs = `<blocs_corps>\n${c.blocsCorps.map((b) => `<bloc id="${b.id}">${b.consigne}</bloc>`).join("\n")}\n</blocs_corps>`;
  return [variableBase(c), rendrePreparation(c, p), rendreFicheCible(p.fiche, "scenariste"), decisionChef(equipeDe(c).chef), c.etat.fond ? fondTexte(c) : "", blocs, ...rendreReglesReseau(c, reseau), appelImpose(c, p, reseau, []).balise].filter(Boolean).join("\n");
}

function corpsTexte(c: Contexte): string {
  const segs = (c.etat.corps?.[0]?.blocs ?? []).flatMap((b) => b.segments);
  return `<corps>\n${segs.map((s) => s.texte).filter((t) => t.trim()).join("\n")}\n</corps>`;
}

function variableAccroches(c: Contexte, p: PreparationEquipe, reseau: ReseauDeclinaison): string {
  return [variableBase(c), rendrePreparation(c, p), decisionChef(equipeDe(c).chef), fondTexte(c), corpsTexte(c), famillesTexte(c), rendreReglesReseau(c, reseau)[0]].filter(Boolean).join("\n");
}

/** La grille du relecteur : les repères de la recette « équipe », lus des mêmes constantes que les consignes. */
export function grilleEquipe(): string {
  return [
    "<grille>",
    "- Accroche : 1re phrase de 12 mots au plus, finie avant 3 s ; un chiffre prouvé ou un « pour qui » dans les 9 premiers mots ; ni salut ni annonce.",
    `- Rétention : gain livré avant ${LIVRAISON_AVANT * 100} % de la durée ; une relance entre ${RELANCE_ENTRE[0] * 100} et ${RELANCE_ENTRE[1] * 100} % ; rien après l'appel.`,
    `- Clarté : phrases de ${MOTS_PAR_PHRASE_MAX} mots au plus ; ${REGLE_EMPHASE}.`,
    "- Positionnement : une seule cible (celle de <cible>), ce que NOUS mettons en place, jamais « faites-le vous-même ».",
    "</grille>",
  ].join("\n");
}

/** Ce que le code relève déjà (règles de Will, repères de temps, phrases longues, garde-fous rouges) : donné au relecteur. */
function alertesCode(v: VersionEcrite, segs: { texte: string; marqueurs?: string[] }[]): string[] {
  const textes = [v.declinaison.accroche, ...segs.map((s) => s.texte)];
  return [
    ...textes.flatMap((t) => violationsReglesWill(t).map((x) => `${x.id} : ${x.texte} dans « ${t} »`)),
    ...reperesManques(segs.map((s) => ({ texte: s.texte, marqueurs: s.marqueurs ?? [] })), v.appel.texte),
    ...segs.flatMap((s, i) => s.texte.split(/(?<=[.!?…])\s+/).filter((ph) => ph.split(/\s+/).filter(Boolean).length > MOTS_PAR_PHRASE_MAX).map((ph) => `segment ${i} : phrase de plus de ${MOTS_PAR_PHRASE_MAX} mots (« ${ph} »)`)),
    ...alertesRepetitions([v.declinaison.accroche, ...segs.map((s) => s.texte)], v.appel.texte),
    ...v.violations.filter((x) => x.bloquant).slice(0, 5).map((x) => `${x.controle} : ${x.message}`),
  ];
}

function variableRelecteur(c: Contexte, p: PreparationEquipe, v: VersionEcrite): string {
  const d = c.d;
  const segs = (c.etat.corps![0].blocs ?? []).flatMap((x) => x.segments);
  const ancrages = d.choix.ancrages.map((x) => d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m);
  const citees = matieresEnvoyees(d).filter((m) => ancrages.some((a) => a.id === m.id) || segs.some((s) => citeeMotPourMot(s.texte, m)));
  const alertes = alertesCode(v, segs);
  return [
    fondTexte(c),
    ...citees.map((m) => rendreMatiere(m, d)),
    grilleEquipe(),
    `<cible taille="${p.cible.taille}">${p.cible.texte}</cible>`,
    rendreFicheCible(p.fiche, "relecteur"),
    `<objectif_video>${p.objectif}</objectif_video>`,
    `<accroche>${v.declinaison.accroche}</accroche>`,
    `<corps>\n${segs.map((s, i) => `<segment index="${i}" marqueurs="${(s.marqueurs ?? []).join(",")}">${s.texte}</segment>`).join("\n")}\n</corps>`,
    `<appel>${v.appel.texte}</appel>`,
    `<boucle>${v.boucle ? v.declinaison.boucle : ""}</boucle>`,
    `<alertes_code>\n${alertes.map((x) => `- ${x}`).join("\n") || "- aucune"}\n</alertes_code>`,
  ].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------ */
/* Pire cas                                                             */
/* ------------------------------------------------------------------ */

export interface OptionsChaineEquipe extends Pick<OptionsChaine, "tournures" | "contexteWill" | "debit" | "hashtags"> {
  /** Réseau de l'unique version (banc ; défaut : le 1er du sujet). */
  reseau?: ReseauDeclinaison;
  /** PRODUCTION : une version par réseau ; la 1re est écrite par l'équipe, les autres par le rôle `declinaison`. */
  reseaux?: ReseauDeclinaison[];
}

/**
 * PIRE CAS PRUDENT de la chaîne « équipe » (PUR), même règle que les autres chaînes (`totaliserPireCas`) : le chef DEUX
 * fois (nouvel angle après le test « influenceur IA » ; le 2e reçoit seulement l'angle refusé, compté dans les consignes
 * ajoutées), le scénariste, les accroches, le relecteur, puis une déclinaison par réseau en plus (parties ensemble),
 * chacun au pire prudent. L'entrée de chaque appel compte les sorties qu'il reçoit (`maxTokens` × 1,5 : le relecteur
 * reçoit le script et l'accroche retenue, pas les 5 accroches) et 3 000 jetons de consignes. `etatDepart` : seules les
 * étapes après la sienne sont comptées.
 */
export function pireCasChaineEquipe(d: DonneesGeneration, options: OptionsChaineEquipe = {}, etatDepart?: EtatChaine): PireCasChaine {
  const c = creerContexte(d, { executer: async () => ({ ok: false, arret: "verrou-perdu", message: "" }) }, { ...options, reprises: false }, etatDepart, async () => {});
  const reseaux = reseauxDe(d, options);
  const reseau = reseaux[0];
  const p = preparerEquipe(d, reseaux);
  const sortie = (r: DefinitionRole) => r.maxTokens * FACTEUR_SORTIE_RENVOYEE;
  const appel = (role: DefinitionRole, variable: string, jetonsEnPlus: number) => pireCasPrudentAppel(role, { contexte: c.cache, variable }, jetonsEnPlus + JETONS_CONSIGNES_AJOUTEES);
  const regles = (r: ReseauDeclinaison | undefined) => (r ? rendreReglesReseau(c, r).join("\n") : "");
  const reglesAutres = reseaux.slice(1).map(regles).sort((a, b) => b.length - a.length)[0] ?? "";
  const chef = sortie(roleEquipeChef);
  const scenario = sortie(roleEquipeScenariste);
  const prevus = [
    { etape: 1, n: 2, appel: appel(roleEquipeChef, variableChef(c, p, reseau), 0) },
    { etape: 2, n: 1, appel: appel(roleEquipeScenariste, variableScenariste(c, p, reseau), chef) },
    { etape: 3, n: 1, appel: appel(roleEquipeAccroches, [variableBase(c), rendrePreparation(c, p), famillesTexte(c)].join("\n"), chef + scenario) },
    { etape: 4, n: 1, appel: appel(roleEquipeRelecteur, [grilleEquipe(), rendreFicheCible(p.fiche, "relecteur")].filter(Boolean).join("\n"), scenario) },
    { etape: 5, n: reseaux.length - 1, parallele: reseaux.length - 1, appel: appel(roleDeclinaison, [variableBase(c), reglesAutres].join("\n"), scenario + sortie(roleEquipeAccroches)) },
  ];
  return totaliserPireCas(prevus.filter((x) => x.etape > c.etat.etape && x.n > 0));
}

/* ------------------------------------------------------------------ */
/* Conduite                                                             */
/* ------------------------------------------------------------------ */

export type ResultatChaineEquipe =
  | { statut: "terminee"; etat: EtatChaineEquipe; version: VersionEcrite; avantRelecture: VersionEcrite; relecture?: SortieEquipeRelecteur }
  | { statut: "arretee"; etat: EtatChaineEquipe }
  | { statut: "coupee"; etat: EtatChaineEquipe; message: string }
  | { statut: "attente"; etat: EtatChaineEquipe; arret: Exclude<Attente["arret"], "reponse-coupee">; message: string };

/** Objectif de l'accroche (forme de la grande chaîne) selon l'objectif de la vidéo. */
const OBJECTIF_ACCROCHE = { notoriete: "envoi", conversation: "commentaire", diagnostic: "fin-de-visionnage" } as const;

const bloquants = (v: VersionEcrite) => v.violations.filter((x) => x.bloquant).length;

/**
 * Déroule les étapes 1 à 5 depuis la dernière terminée (`sauver` après chacune : rien n'est repayé). « arretee » : un
 * rôle a répondu ANCRAGE_MANQUANT ou PREUVE_MANQUANTE, ou une sortie est inutilisable (`SORTIE_INVALIDE`, dont : aucune
 * accroche ne passe le filtre du code) ; « coupee » : réponse coupée, rien n'est relancé ; « attente » : crédit, plafond
 * ou modèle. Supplément (état de départ à l'étape 1 avec la décision du chef) : le script et les accroches sont réécrits.
 */
export async function executerChaineEquipe(d: DonneesGeneration, executeur: ExecuteurRoles, options: OptionsChaineEquipe = {}, etatDepart?: EtatChaine, sauver: (e: EtatChaine) => Promise<void> = async () => {}): Promise<ResultatChaineEquipe> {
  const c = creerContexte(d, executeur, { ...options, reprises: false }, etatDepart, sauver);
  const etat = c.etat as EtatChaineEquipe;
  const reseaux = reseauxDe(d, options);
  const reseau = reseaux[0];
  const eq = equipeDe(c);
  const p = (eq.preparation ??= preparerEquipe(d, reseaux));
  const arreter = async (etape: number, type: NonNullable<EtatChaine["arret"]>["type"], message: string): Promise<ResultatChaineEquipe> => {
    c.etat.arret = { type, etape, message };
    await sauver(c.etat);
    return { statut: "arretee", etat };
  };
  const terminer = async (n: number) => {
    c.etat.etape = n;
    await sauver(c.etat);
  };
  const journalDe = (role: string) => [...c.etat.journal].reverse().find((x) => x.role === role);
  const noter = (role: string, echecs: string[]) => {
    const j = journalDe(role);
    if (j && echecs.length) j.echecs = [...new Set([...(j.echecs ?? []), ...echecs])];
  };
  if (c.etat.arret) return { statut: "arretee", etat };
  let avantRelecture = c.etat.versions?.[0];
  let relecture: SortieEquipeRelecteur | undefined;
  try {
    // 1. Rédacteur en chef ; « un influenceur IA pourrait-il dire cela ? » oui : un nouvel angle, une fois.
    if (c.etat.etape < 1) {
      // Reprise : un 1er appel déjà payé (angle refusé dans l'état) n'est jamais repayé ; on repart du nouvel angle.
      let r = eq.angleRefuse ? undefined : await appeler(c, 1, roleEquipeChef, variableChef(c, p, reseau), EVALUATIONS_EQUIPE_CHEF);
      if (r?.donnees && !r.marqueur && !r.donnees.arret && r.donnees.testInfluenceur.reponse === "oui") {
        eq.angleRefuse = r.donnees;
        await sauver(c.etat);
        r = undefined;
      }
      if (!r) r = await appeler(c, 1, roleEquipeChef, variableChef(c, p, reseau, eq.angleRefuse), EVALUATIONS_EQUIPE_CHEF);
      const s = r.donnees;
      if (r.marqueur || s?.arret) return arreter(1, r.marqueur ?? s!.arret!.code, s?.arret?.raison ?? "Aucun angle ne tient sans inventer.");
      if (!s || !s.angle.trim() || !s.promesse.trim()) return arreter(1, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (rédacteur en chef) : ${r.echecs.join(" ; ") || "sortie vide"}.`);
      eq.chef = s;
      await terminer(1);
    }

    // 2. Scénariste : le script complet, pour le 1er réseau (l'accroche viendra après).
    if (c.etat.etape < 2) {
      if (!eq.chef) return arreter(2, "SORTIE_INVALIDE", "La décision du rédacteur en chef manque : le script ne peut pas être écrit.");
      const ctx = { ...c.evalCtx, blocsCorps: c.blocsCorps.map((x) => x.id) };
      const r = await appeler(c, 2, roleEquipeScenariste, variableScenariste(c, p, reseau), EVALUATIONS_EQUIPE_SCENARISTE, ctx);
      const sb = r.donnees;
      if (r.marqueur || sb?.arret) return arreter(2, r.marqueur ?? sb!.arret!.code, sb?.arret?.raison ?? "Le script ne tient pas sans inventer.");
      if (!sb) return arreter(2, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (script) : ${r.echecs.join(" ; ") || "sortie vide"}.`);
      // Supplément : le fond d'origine (limite validée comprise) est gardé, jamais réécrit.
      const fond = c.etat.fond ?? fondDe(sb, d);
      if (!c.etat.fond && fond.exception.source === "matiere" && !c.evalCtx.matiereIds.has(fond.exception.matiereId ?? "")) fond.exception = { ...fond.exception, source: "proposition-machine", matiereId: undefined };
      c.etat.fond = fond;
      const ancrages = d.choix.ancrages.map((x) => d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, texte: m.texte }));
      const prose: SortieProse = { segments: completerMarqueurs(sb.segments, { livraison: fond.livraison, ancrages, exceptionMatiereId: fond.exception.matiereId }), limiteProposee: sb.limiteProposee };
      const corps = avecIntentions(c, blocsDeProse(c, prose));
      if (!corps.length) return arreter(2, "SORTIE_INVALIDE", "Réponse de Claude inutilisable (script) : aucun segment de corps.");
      c.etat.corps = [{ combinaison: 1, structure: p.structure, accrocheId: "", prose, blocs: corps, limiteProposee: sb.limiteProposee ?? (fond.exception.source === "proposition-machine" ? fond.exception.texte : undefined) }];
      c.etat.gagnant = 0;
      eq.scenario = sb.version;
      await terminer(2);
    }

    // 3. Accroches sur le corps écrit ; le code élimine celles qui échouent et garde la mieux notée.
    if (c.etat.etape < 3) {
      if (!eq.scenario || !c.etat.corps?.[0]?.blocs) return arreter(3, "SORTIE_INVALIDE", "Le script manque : les accroches ne peuvent pas être écrites.");
      const ctx = { ...c.evalCtx, famillesPermises: famillesRealisables(c).map((f) => f.id) };
      const r = await appeler(c, 3, roleEquipeAccroches, variableAccroches(c, p, reseau), EVALUATIONS_EQUIPE_ACCROCHES, ctx);
      const sa: SortieEquipeAccroches | undefined = r.donnees;
      if (r.marqueur || sa?.arret) return arreter(3, r.marqueur ?? sa!.arret!.code, sa?.arret?.raison ?? "Aucune accroche possible sans inventer.");
      if (!sa?.accroches.length) return arreter(3, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (accroches) : ${r.echecs.join(" ; ") || "sortie vide"}.`);
      const adresse = d.sujet.adresse;
      // Une accroche qui dit un nombre non prouvé, ou dans l'autre adresse, est éliminée comme les autres.
      const sures = sa.accroches.filter((a) => !ditNonProuve(a.dit, c.evalCtx).length && !adresseFautive(a.dit, adresse));
      const f = filtrerAccroches(sures, { debit: c.debit, cible: p.cible, famillesPermises: ctx.famillesPermises });
      const eliminees = [...sa.accroches.filter((a) => !sures.includes(a)).map((a) => ({ dit: a.dit, motifs: ["nombre non prouvé ou autre adresse"] })), ...f.eliminees];
      eq.accroches = { premiereLigne: sa.premiereLigne, eliminees };
      noter(roleEquipeAccroches.id, eliminees.map((e) => `éliminée « ${e.dit} » : ${e.motifs.join(", ")}`));
      if (!f.retenue) return arreter(3, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (accroches) : aucune ne passe le contrôle du code (${eliminees.map((e) => e.motifs.join(", ")).join(" ; ")}).`);
      if (adresseFautive(sa.premiereLigne, adresse) || ditNonProuve(sa.premiereLigne, c.evalCtx).length) return arreter(3, "SORTIE_INVALIDE", `Réponse de Claude inutilisable (accroches) : 1re ligne refusée (« ${sa.premiereLigne} »).`);
      c.etat.accroches = f.gardees.map((a, i) => ({ famille: a.famille, objectif: OBJECTIF_ACCROCHE[p.objectif], dit: a.dit.trim(), ecrit: a.ecrit, vu: "", anomalie: "", boucleOuverte: "", preuveIds: a.preuveIds, matiereIds: a.matiereIds, porteAngle: i === 0, id: `acc-${i + 1}` }));
      c.etat.finalistes = c.etat.accroches.slice(0, 5).map((x) => finalisteDe(c, x, undefined, f.gardees[c.etat.accroches!.indexOf(x)]?.note ?? 0));
      const retenue = c.etat.finalistes[0];
      const k = c.etat.corps[0];
      k.accrocheId = retenue.id;
      k.plan = planOuverture(["cout", ...(retenue.matiereIds?.length ? (["ancrage"] as const) : [])]);
      const a = appelImpose(c, p, reseau, k.blocs ?? []);
      const sc = eq.scenario;
      const declinaison: SortieDeclinaison = { accrocheId: retenue.id, accroche: retenue.dit, appel: { type: a.type, texte: a.texte ?? sc.appel?.texte ?? "" }, boucle: sc.boucle, encadre: sc.encadre, couverture: sc.couverture, segmentFacultatifRetenu: false, publication: { ...sc.publication, premiereLigne: sa.premiereLigne, motCleVariante: c.etat.fond?.motCleVariante } };
      avantRelecture = assemblerVersion(c, reseau, declinaison);
      noterEtVoyant(avantRelecture);
      c.etat.versions = [avantRelecture];
      await terminer(3);
    }

    // 4. Relecteur unique : il juge, le code applique ses corrections (au plus 5, par priorité), puis recontrôle.
    if (c.etat.etape < 4) {
      const avant = c.etat.versions![0];
      const k = c.etat.corps![0];
      const corpsAvant = k.blocs ?? [];
      const segs = corpsAvant.flatMap((x) => x.segments);
      const r = await appeler(c, 4, roleEquipeRelecteur, variableRelecteur(c, p, avant), EVALUATIONS_EQUIPE_RELECTEUR);
      let version = avant;
      if (!r.donnees) {
        c.etat.nonRelue = `Relecture inutilisable (${r.echecs.join(" ; ") || "sortie vide"}) : la version gardée n'est pas relue.`;
        noter(roleEquipeRelecteur.id, ["relecture inutilisable"]);
      } else {
        delete c.etat.nonRelue;
        relecture = r.donnees;
        eq.relecture = relecture;
        const refus: string[] = [];
        const triees = trierCorrections(relecture.corrections).filter((x) => {
          const motifs = [...violationsReglesWill(x.texte).map((v) => v.texte), ...ditNonProuve(x.texte, c.evalCtx).map((n) => `« ${n} » non prouvé`)];
          if (motifs.length) refus.push(`correction (${x.axe}) refusée : ${motifs.join(", ")}`);
          return !motifs.length;
        });
        const ancrages = d.choix.ancrages.map((x) => d.matieres.find((m) => m.id === x.matiereId)).filter((m): m is NonNullable<typeof m> => !!m).map((m) => ({ id: m.id, texte: m.texte }));
        const surSegments = triees.filter((x) => x.ou === "segment" && x.segmentIndex !== undefined && segs[x.segmentIndex]).map((x) => ({ segmentIndex: x.segmentIndex!, texte: x.texte, motif: `${x.axe} : ${x.motif}` }));
        const ancrees = garderCitationsAncrage(segs, surSegments, ancrages);
        // Répétitions : une correction qui AJOUTE une répétition est refusée.
        const sansRedite = garderSansNouvelleRepetition(avant.declinaison.accroche, segs, ancrees.gardees, avant.appel.texte);
        const gardees = sansRedite.gardees;
        refus.push(...ancrees.refusees, ...sansRedite.refusees);
        const surAccroche = triees.find((x) => x.ou === "accroche" && x.texte.trim());
        let accroche = avant.declinaison.accroche;
        if (surAccroche) {
          const motifs = [...motifsAccrocheRefusee(surAccroche.texte, { debit: c.debit, cible: p.cible }), ...(adresseFautive(surAccroche.texte, d.sujet.adresse) ? ["autre adresse"] : [])];
          if (motifs.length) refus.push(`correction de l'accroche refusée : ${motifs.join(", ")}`);
          else accroche = surAccroche.texte.trim();
        }
        if (gardees.length || accroche !== avant.declinaison.accroche) {
          k.blocs = appliquerCorrections(corpsAvant, gardees);
          const relue = assemblerVersion(c, avant.reseau, { ...avant.declinaison, accroche });
          noterEtVoyant(relue);
          // Recontrôle : une version relue qui a plus de garde-fous rouges qu'avant est écartée (texte d'avant gardé).
          if (bloquants(relue) > bloquants(avant)) {
            k.blocs = corpsAvant;
            refus.push(`corrections écartées au recontrôle : ${bloquants(relue)} garde-fou(s) rouge(s) contre ${bloquants(avant)} avant`);
          } else {
            version = relue;
            c.etat.reecritures = 1;
          }
        }
        eq.refusees = refus;
        noter(roleEquipeRelecteur.id, refus);
      }
      c.etat.versions = [version];
      await terminer(4);
    }

    // 5. Une version par réseau en plus (rôle `declinaison`, en parallèle), l'appel remis à celui de la banque ; C14.
    if (c.etat.etape < 5) {
      const premiere = c.etat.versions![0];
      const autres = reseaux.filter((x) => x !== premiere.reseau);
      const differente = `Accroche et 1re ligne de publication DIFFÉRENTES de celles de la version ${premiere.reseau} (« ${premiere.declinaison.accroche} » ; « ${premiere.declinaison.publication.premiereLigne} »).`;
      const adresse = d.sujet.adresse;
      const nouvelles = await Promise.all(
        autres.map(async (x) => {
          const v = await declinerVersion(c, x, differente);
          if (!v) return null;
          if (adresseFautive(v.declinaison.accroche, adresse) || adresseFautive(v.declinaison.publication.premiereLigne, adresse)) {
            c.etat.journal.push({ etape: 5, role: roleDeclinaison.id, dureeMs: 0, coutUsd: 0, modele: "-", resultat: "invalide", echecs: [`${x} : accroche ou 1re ligne pas au « ${adresse} », version écartée`] });
            return null;
          }
          const a = p.appels[x];
          if (!a) return v;
          const type = a.type && c.p.reseau(x).appelsPermis.includes(a.type) ? a.type : v.appel.type;
          return assemblerVersion(c, x, { ...v.declinaison, appel: { type, texte: a.texte } });
        }),
      );
      const versions = [premiere, ...nouvelles.filter((v): v is VersionEcrite => !!v)];
      finirVersions(c, versions);
      c.etat.versions = versions;
      await terminer(5);
    }
    const version = c.etat.versions![0];
    return { statut: "terminee", etat, version, avantRelecture: avantRelecture ?? version, relecture };
  } catch (e) {
    if (e instanceof ReponseCoupee) {
      c.etat.reponseCoupee = e.brut;
      await sauver(c.etat);
      return { statut: "coupee", etat, message: e.message };
    }
    if (e instanceof Attente && e.arret !== "reponse-coupee") {
      await sauver(c.etat);
      return { statut: "attente", etat, arret: e.arret, message: e.message };
    }
    throw e;
  }
}

/** Le texte dit d'une version (accroche, corps, appel), pour les tests et la trace. */
export function texteDitEquipe(etat: EtatChaine, v: VersionEcrite): string {
  return [v.declinaison.accroche, texteBlocs(etat.corps?.[etat.gagnant ?? 0]?.blocs ?? []), v.appel.texte].filter(Boolean).join(" ");
}
