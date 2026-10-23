/**
 * MOTEUR « MONTAGE TABLEAU ANIMÉ » (tâche TB-11, plan `02-FORMAT-TABLEAU-ANIME.md` § 4, § 13.1, § 16 n° 8) : le
 * contrat commun `MoteurVideo` posé sur ce qui existe déjà, sans rien réécrire :
 *   - `decouperEnScenes` (découpage.ts) : étape « Le découpage », seulement quand la vidéo part d'un script ; une fiche
 *     déjà fournie (`entrees.tableau.ficheScenesCle`) la saute ;
 *   - `fabriquerTableau` (fabriquer.ts) : la chaîne fiche → voix → calage → pages → scènes → composition → contrôles,
 *     PILOTÉE PAS À PAS : chaque `avancer` la relance sur son journal de reprise (gardé dans le travail) et l'arrête
 *     dès qu'une étape vient d'être faite ou qu'il faut attendre un fournisseur (jamais d'attente longue) ;
 *   - `controles.ts`, `mise-en-page.ts`, `calage.ts` : appelés par la chaîne.
 * Où vivent les choses : la vidéo porte `entrees.tableau = { ficheScenesCle, empreinte, version }` (recopié dans la
 * commande), la fiche elle-même est dans le stockage ; le journal de la chaîne est dans `travail.parametres.tableau`,
 * puis dans le projet de montage de la version (`projetMontage.tableau`) : une retouche repart de là et ne refait que
 * ce dont les entrées ont changé (empreintes ; une scène déjà rendue sous son empreinte n'est jamais rendue deux fois).
 *
 * Les outils réels (voix du personnage, stockage, `studio-rendu`, budget, préparation des scènes) sont fournis par les
 * SERVICES (`services/tableau-branchements.ts`, sur le modèle du face caméra) ou injectés (tests) : ce moteur
 * n'importe aucun fournisseur, aucun service et aucun autre moteur. Format sans prix : `estimer()` rend 0 (les
 * quantités restent visibles) ; la voix est contrôlée et réservée par la chaîne juste avant sa lecture payante.
 *
 * Retouche par boutons (TB-20, `retouches.ts`) : `retoucher` applique les opérations du catalogue fermé à la fiche
 * de la version d'avant, refuse d'emblée (rien n'est lancé) une opération inconnue ou refusée par les règles, et sinon
 * repart du journal de cette version avec la nouvelle fiche : seules les scènes touchées sont rendues.
 *
 * Version 2 (refus lisible aujourd'hui) : autres ratios, fins par réseau, correction des sous-titres seule, maquette.
 */
import { createHash } from "node:crypto";
import type { CommandeFabrication, EtapeTravail, ErreurTravail, IdReseau, LigneCout, StyleResolu, Travail, ValeurStyleSousTitres } from "@/domaine/types";
import { ZERO, centimes } from "@/lib/montants";
import { decouperEnScenes, type EntreeDecoupage, type OutilsDecoupage } from "./decoupage";
import { ETAPES_CHAINE, etapeDuMoteur, etapesTableau, ficheFournie, lireEntreesTableau, type CleEtapeTableau, type VoixPayee } from "./etapes";
import { formatImage, formatSortie, PORTRAIT_LINKEDIN, reseauxDeLaSortie, sansAppelAuMot, VERTICAL_LIENS, type IdSortie } from "./formats-sortie";
import { finAuMot } from "./variantes-fin";
import type { FinRetenue } from "./relecture";
import { finPermise } from "@/reseaux/sorties";
import { lecturesVoixMax, ressemblanceDeLaCommande } from "@/briques/voix-maitre/reference";
import { ErreurFabrication, ETAPES_FABRICATION, fabriquerTableau, type CompteRenduFabrication, type EtapeFabrication, type JournalFabrication, type OutilsFabrication } from "./fabriquer";
import type { FicheTableau } from "./fiche";
import type { ContexteTableau } from "./regles";
import { apercuRetouche, estOperationRetouche, lireOperationRetouche, type ContexteRetouche, type OperationRetouche } from "./retouches";

/* Contrat commun des moteurs (TYPES seulement, `src/moteurs/types.ts`), lu par `import()` de type : voir `etapes.ts`. */
type MoteurVideo = import("@/moteurs/types").MoteurVideo;
type ContexteLancement = import("@/moteurs/types").ContexteLancement;
type DefinitionEtapeMoteur = import("@/moteurs/types").DefinitionEtapeMoteur;
type Estimation = import("@/moteurs/types").Estimation;
type ResultatFabrication = import("@/moteurs/types").ResultatFabrication;

export { ENTREE_TABLEAU, etapesTableau, lireEntreesTableau, type EntreesTableau, type VoixPayee } from "./etapes";
export { CATALOGUE_RETOUCHES, apercuRetouche, type ApercuRetouche, type ContexteRetouche, type OperationRetouche } from "./retouches";

export const ID_MOTEUR_TABLEAU = "montage-tableau";

/* ------------------------------------------------------------------ */
/* Outils fournis par les services (ou les tests)                        */
/* ------------------------------------------------------------------ */

/** Ce que la chaîne reçoit pour une commande ; le moteur pose lui-même la vidéo, la fiche, le journal et l'attente. */
export interface OutilsTableau extends Omit<OutilsFabrication, "videoId" | "lireFiche" | "journal" | "attendre" | "contexte"> {
  /** Lit la fiche de scènes (JSON brut) rangée dans le stockage sous cette clé. */
  lireFiche: (cle: string) => Promise<unknown>;
  /** Contexte des règles, sauf le script (posé par le moteur). */
  contexte: Omit<ContexteTableau, "texteScript">;
  /** Identifiants des appels de la bibliothèque (retouche « Changer la fin ») ; absent : aucune fin ne peut être choisie. */
  appels?: readonly string[];
  /** Découpage automatique (vidéo partie d'un script) ; absent : seule une fiche fournie peut être fabriquée. */
  decoupage?: { entree: Omit<EntreeDecoupage, "texteScript" | "videoId" | "versionId" | "controle">; outils: OutilsDecoupage };
  /** Délai de garde global du travail (ms) ; absent : `DELAI_GARDE_TRAVAIL_MS`. */
  delaiGardeMs?: number;
}

/** Fabrique des outils réels d'une commande ; `null` : pas reliés (aucun lancement réel possible). */
export type FabriqueOutilsTableau = (commande: CommandeFabrication, travailId: string) => Promise<OutilsTableau | null>;

/** Raccords posés par les services (`services/tableau-branchements.ts`), comme `brancherServicesFacecam`. */
export interface ServicesTableau {
  outils?: FabriqueOutilsTableau;
}

const cleServices = Symbol.for("studio-axion-ia.tableau-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesTableau };

export function brancherServicesTableau(s: ServicesTableau): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesTableau(): ServicesTableau {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

export interface DependancesMoteurTableau {
  /** Outils injectés (tests) ; absents : ceux des services. */
  outils?: FabriqueOutilsTableau;
}

/* ------------------------------------------------------------------ */
/* Retouche par opérations (TB-20) : point d'entrée                      */
/* ------------------------------------------------------------------ */

export const OPERATION_NON_PRISE_EN_CHARGE = "OPERATION_NON_PRISE_EN_CHARGE";
export const RETOUCHE_REFUSEE = "TABLEAU_RETOUCHE_REFUSEE";

/**
 * Applique des opérations de retouche à la fiche (boutons de « Votre vidéo », plan § 13.1, catalogue `retouches.ts`),
 * dans l'ordre, puis valide la fiche entière. Sans opération : la fiche, inchangée. Refus : la fiche n'est pas touchée.
 */
export function appliquerOperationsTableau(
  fiche: FicheTableau,
  operations: readonly { type: string }[],
  contexte?: ContexteRetouche,
): { ok: true; fiche: FicheTableau } | { ok: false; code: string; message: string } {
  const refus = refusOperations(operations);
  if (refus) return { ok: false, ...refus };
  if (!operations.length) return { ok: true, fiche };
  if (!contexte) return { ok: false, code: RETOUCHE_REFUSEE, message: "Cette retouche ne peut pas être vérifiée pour l'instant : réessayez plus tard." };
  const apercu = apercuRetouche(fiche, operations as OperationRetouche[], contexte);
  return apercu.ok ? { ok: true, fiche: apercu.fiche } : { ok: false, code: RETOUCHE_REFUSEE, message: apercu.refus.join(" ") };
}

/** Refus de la première opération hors du catalogue (ou mal formée) ; `null` : toutes en font partie. */
export function refusOperations(operations: readonly { type: string }[]): { code: string; message: string } | null {
  const inconnue = operations.find((op) => !estOperationRetouche(op.type) || !lireOperationRetouche(op));
  if (!inconnue) return null;
  if (estOperationRetouche(inconnue.type)) return { code: RETOUCHE_REFUSEE, message: "Cette retouche est incomplète : choisissez de nouveau la scène et l'élément à changer." };
  return { code: OPERATION_NON_PRISE_EN_CHARGE, message: `Cette modification (« ${inconnue.type} ») n'est pas encore prise en charge pour le tableau animé. Utilisez les boutons de la scène, ou modifiez la fiche de scènes : seules les scènes changées seront refaites.` };
}

/* ------------------------------------------------------------------ */
/* État gardé dans le travail et dans le projet de montage               */
/* ------------------------------------------------------------------ */

interface EtatTableau {
  journal: JournalFabrication | null;
  /** Rang (dans `ETAPES_FABRICATION`) de la dernière étape de la chaîne passée pendant CE travail ; -1 : aucune. */
  atteinte: number;
  /** Fiche tirée du découpage (vidéo partie d'un script). */
  fiche?: unknown;
  /** Empreinte de la voix au départ du travail : la même à la fin = voix reprise, rien de payé ici. */
  voixDepart?: string;
  /** L'échec demandé par `simulerEchecEtape` a eu lieu (une seule fois). */
  echecSimuleFait?: boolean;
  /** La fiche vient d'une retouche par boutons : son texte dit fait foi (il a pu changer, voix relue). */
  retouchee?: boolean;
  /** Délai de garde global : empreinte de l'état de la chaîne et depuis quand (ms) elle n'a pas changé. */
  garde?: { empreinte: string; depuis: number };
}

interface ProjetTableau {
  journal: JournalFabrication;
  fiche?: unknown;
  retouchee?: boolean;
  ficheScenesCle?: string;
}

function lireEtat(travail: Travail): EtatTableau {
  const e = travail.parametres?.tableau as EtatTableau | undefined;
  return e && typeof e === "object" ? e : { journal: null, atteinte: -1 };
}

function avecEtat(travail: Travail, etat: EtatTableau): Travail {
  return { ...travail, parametres: { ...travail.parametres, tableau: etat } };
}

function lireProjet(projetMontage: Record<string, unknown> | undefined): ProjetTableau | null {
  const p = projetMontage?.tableau as ProjetTableau | undefined;
  return p && typeof p === "object" && p.journal && typeof p.journal === "object" ? p : null;
}

/** Journal sans les états en cours (voix, scènes, composition) : seules les étapes faites passent à la version. */
function journalAGarder(j: JournalFabrication | null): JournalFabrication | null {
  return j ? { version: j.version, etapes: j.etapes } : null;
}

/* ------------------------------------------------------------------ */
/* Estimation (format sans prix : quantités visibles, montants nuls)     */
/* ------------------------------------------------------------------ */

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, nature: LigneCout["nature"], total = ZERO): LigneCout {
  return { etape, fournisseur, unite, quantite, prixUnitaire: ZERO, total, nature };
}

function estimation(lignes: LigneCout[], dureeFabricationSec: number): Estimation {
  return { dureeFabricationSec, lignes, total: { centimes: lignes.reduce((s, l) => s + l.total.centimes, 0), devise: "EUR" } };
}

function lignesEstimees(commande: CommandeFabrication): LigneCout[] {
  const l: LigneCout[] = [];
  // Découpage : un appel Claude, une relance au plus (§ 4.2 n° 1 et 2).
  if (!ficheFournie(commande)) l.push(ligne("Découpage", "claude", "appel", 1, "estime"));
  // Voix : au caractère, sur le script validé (les `texteDit` mis bout à bout le redonnent mot pour mot).
  // 14/10 : contrôle de ressemblance actif : le texte est lu 2 fois au plus par défaut, 3 à 2 relances (prix annoncé = ce maximum).
  if (commande.distribution.length) l.push(ligne("Voix", "voix", "caractere", (commande.script.texteComplet ?? "").length * lecturesVoixMax(ressemblanceDeLaCommande(commande.entrees)), "estime"));
  l.push(ligne("Montage tableau animé", "studio", "forfait", 1, "estime"));
  return l;
}

/* ------------------------------------------------------------------ */
/* Travaux                                                               */
/* ------------------------------------------------------------------ */

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatTableau): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_TABLEAU,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: { tableau: etat },
  };
}

/** Travail refusé d'emblée (opération, ratio ou réseau pas encore pris en charge) : message lisible, rien à refaire. */
function travailRefuse(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, code: string, message: string): Travail {
  const t = nouveauTravail(defs, ctx, commande, { journal: null, atteinte: -1 });
  const erreur: ErreurTravail = { code, reessayable: false, messagePourWill: message };
  return { ...t, statut: "echec", erreur, termineLe: t.creeLe, etapes: t.etapes.map((e) => ({ ...e, statut: "ignoree" as const })) };
}

/** Étapes de la chaîne passées (faites ou reprises) pendant ce travail. */
function etapesPassees(etat: EtatTableau): Set<EtapeFabrication> {
  return new Set(ETAPES_FABRICATION.filter((_, i) => i <= etat.atteinte));
}

function etapeFaite(cle: string, etat: EtatTableau, passees: Set<EtapeFabrication>): boolean {
  if (cle === "decoupage") return etat.fiche !== undefined;
  const chaine = ETAPES_CHAINE[cle as Exclude<CleEtapeTableau, "decoupage">];
  return !!chaine && chaine.every((e) => passees.has(e));
}

/** Statuts des étapes d'après l'état ; `echec` : l'étape en échec et son erreur. */
function statuts(travail: Travail, etat: EtatTableau, echec?: { cle: string; erreur: ErreurTravail }): EtapeTravail[] {
  const passees = etapesPassees(etat);
  const etapes = travail.etapes.map((e): EtapeTravail => {
    if (e.statut === "ignoree") return { ...e };
    // Incident du 12/10 : l'échec d'une étape déjà passée pour la première sortie (scènes ou montage du second
    // vertical) est montré sur elle. Avant, l'étape restait « terminée », aucune n'était en échec et le travail restait
    // « en_cours » sans fin, la chaîne retombant à chaque tour sur le même échec.
    if (echec && e.cle === echec.cle) return { ...e, statut: "echec", progression: 0, coutReel: undefined, erreur: echec.erreur };
    if (etapeFaite(e.cle, etat, passees)) return { ...e, statut: "terminee", progression: 100, coutReel: ZERO, erreur: undefined };
    return { ...e, statut: "en_attente", progression: 0, coutReel: undefined, erreur: undefined };
  });
  if (!echec) {
    const prete = etapes.find((e) => e.statut === "en_attente" && e.dependDe.every((d) => etapes.find((x) => x.cle === d)?.statut === "terminee"));
    if (prete) Object.assign(prete, { statut: "en_cours", progression: 10 });
  }
  return etapes;
}

function suivant(travail: Travail, etat: EtatTableau, etapes: EtapeTravail[], maintenant: number): Travail {
  const enEchec = etapes.find((e) => e.statut === "echec");
  const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
  const iso = new Date(maintenant).toISOString();
  return {
    ...avecEtat(travail, etat),
    etapes,
    progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1)),
    statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
    erreur: enEchec?.erreur,
    modifieLe: iso,
    termineLe: fini || enEchec ? iso : undefined,
  };
}

/** Échec d'une étape (la première non faite si aucune n'est désignée). */
function enEchec(travail: Travail, etat: EtatTableau, cle: string | undefined, erreur: ErreurTravail, maintenant: number): Travail {
  const passees = etapesPassees(etat);
  const cible = cle && travail.etapes.some((e) => e.cle === cle) ? cle : travail.etapes.find((e) => e.statut !== "ignoree" && !etapeFaite(e.cle, etat, passees))?.cle ?? travail.etapes[0]?.cle;
  return suivant(travail, etat, statuts(travail, etat, cible ? { cle: cible, erreur } : undefined), maintenant);
}

/* ------------------------------------------------------------------ */
/* Un tour de la chaîne                                                  */
/* ------------------------------------------------------------------ */

/** Étapes après lesquelles la chaîne s'arrête quand elle vient de les faire (fin d'une étape du moteur). */
const ARRETS: ReadonlySet<EtapeFabrication> = new Set(["script", "voix", "calage", "fin", "scenes", "composition"]);
/** Une fiche refusée ne change pas en réessayant : la main revient à Will. */
const NON_REESSAYABLES: ReadonlySet<EtapeFabrication> = new Set(["fiche", "script", "calage", "mise-en-page", "fin"]);
const MARQUE_PAUSE = "tableau:pause";

/** Phrase montrée quand le dessin d'une scène rate (après un nouvel essai sous un autre identifiant). */
export const PHRASE_SCENE_RATEE = "Le dessin d'une scène n'a pas abouti. Relancez : la voix déjà payée est gardée.";

/**
 * Délai de garde GLOBAL du travail (M, défaut prudent 45 min, réglable par `OutilsTableau.delaiGardeMs`) : aucune
 * fabrication ne reste en cours sans que l'état de sa chaîne change plus longtemps. Au-delà du délai de garde d'un rendu
 * (15 min, deux fois avec le nouvel essai) et des attentes de la file longue.
 */
export const DELAI_GARDE_TRAVAIL_MS = 45 * 60_000;
export const CODE_SANS_NOUVELLE = "TABLEAU_SANS_NOUVELLE";

/** Empreinte de ce qui avance dans la chaîne (journal, étapes passées, fiche) : change dès qu'un rendu avance. */
function empreinteAvancement(etat: EtatTableau): string {
  return createHash("sha256").update(JSON.stringify([etat.journal, etat.atteinte, etat.fiche ?? null])).digest("hex").slice(0, 32);
}

/**
 * Pour « Relancer » : les rendus suivis restés en cours ou ratés repartent (scènes : à soumettre ; composition : nouvelle
 * demande), sinon la chaîne relirait le même échec, gardé 24 h par `studio-rendu`. Les étapes faites (la voix payée
 * comprise) restent dans le journal : rien n'est repayé.
 */
function relancerRendus(j: JournalFabrication | null): JournalFabrication | null {
  if (!j) return j;
  const copie = structuredClone(j);
  type Suivi = { scenes?: JournalFabrication["scenes"]; composition?: JournalFabrication["composition"] };
  const relancer = (x: Suivi) => {
    if (x.scenes) x.scenes.etat.cartes = x.scenes.etat.cartes.map((c) => (c.statut === "soumise" || c.statut === "echec" ? { ...c, statut: "a-soumettre" as const, essais: 0, veille: undefined } : c));
    if (x.composition?.etat.phase === "soumise") delete x.composition;
  };
  relancer(copie);
  for (const sortie of Object.values(copie.sorties ?? {})) if (sortie) relancer(sortie);
  return copie;
}

type Issue = { type: "pause" } | { type: "fini"; compteRendu: CompteRenduFabrication } | { type: "echec"; cle: string; erreur: ErreurTravail };

const texteDitDe = (brute: unknown) => {
  const scenes = (brute as { scenes?: unknown } | null)?.scenes;
  return Array.isArray(scenes) ? scenes.map((s) => String((s as { texteDit?: unknown })?.texteDit ?? "")).join(" ") : "";
};

const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function tourDeChaine(commande: CommandeFabrication, outils: OutilsTableau, depart: EtatTableau, versionId?: string): Promise<{ etat: EtatTableau; issue: Issue }> {
  const entrees = lireEntreesTableau(commande.entrees);
  const etat: EtatTableau = { ...depart };
  let brute: unknown;
  try {
    brute = etat.fiche !== undefined ? etat.fiche : entrees.ficheScenesCle ? await outils.lireFiche(entrees.ficheScenesCle) : undefined;
  } catch (err) {
    return { etat, issue: { type: "echec", cle: "fiche", erreur: { code: "TABLEAU_FICHE_ILLISIBLE", reessayable: true, messagePourWill: "La fiche de scènes n'a pas pu être lue. Vous pouvez réessayer.", detailTechnique: raisonDe(err) } } };
  }
  // Script de référence : celui du générateur quand la fiche en a été découpée ; sinon la fiche relue par Will.
  // Une fiche retouchée par boutons fait foi elle aussi (ses contrôles de script ont été repassés à la retouche).
  const texteScript = !etat.retouchee && !entrees.ficheScenesCle && commande.script.texteComplet ? commande.script.texteComplet : texteDitDe(brute);
  const cible = !etat.echecSimuleFait && commande.simulerEchecEtape ? commande.simulerEchecEtape : undefined;
  let journal = etat.journal ? structuredClone(etat.journal) : null;
  let atteinte = etat.atteinte;
  let pause = false;
  /** La pause vient d'une étape tout juste faite (et non d'une attente au milieu d'une étape). */
  let pauseApresEtape = false;
  let simule = false;

  const { lireFiche: _lire, contexte, decoupage: _decoupage, delaiGardeMs: _garde, tracer, ...reste } = outils;
  void _lire;
  void _decoupage;
  void _garde;
  // 14/10 : contrôle de ressemblance à la voix de référence, figé dans la commande au lancement (absent : coupé).
  const ressemblance = reste.voix.ressemblance ?? ressemblanceDeLaCommande(commande.entrees);
  const o: OutilsFabrication = {
    ...reste,
    voix: { ...reste.voix, ...(ressemblance ? { ressemblance } : {}) },
    // Réseaux cochés → formats de sortie (posés dans les entrées au lancement) ; des outils qui les fixent l'emportent.
    ...(!reste.sorties && entrees.sorties?.length ? { sorties: entrees.sorties } : {}),
    ...(!reste.traceScriptId && entrees.traceScriptId ? { traceScriptId: entrees.traceScriptId } : {}),
    // 17/10 : style des sous-titres résolu au lancement (choix de la vidéo, sinon défaut du format), figé dans la commande.
    ...(reste.styleSousTitres === undefined && commande.styles.sousTitres?.valeur?.type === "style-sous-titres" ? { styleSousTitres: commande.styles.sousTitres as StyleResolu<ValeurStyleSousTitres> } : {}),
    // 17/10 : intensité des sous-titres dynamiques (choix de la vidéo, sinon profil du format), figée dans la commande.
    ...(reste.intensiteSousTitres === undefined && commande.sousTitres?.intensite ? { intensiteSousTitres: commande.sousTitres.intensite } : {}),
    // Case « déjà vu » cochée à la création : la relecture de la fabrication la lit (sans elle, la relecture bloque).
    ...(!reste.dejaVu && entrees.dejaVu ? { dejaVu: entrees.dejaVu } : {}),
    ...(tracer ? { tracer: (e) => tracer({ ...e, ...(versionId ? { versionId } : {}) }) } : {}),
    videoId: commande.videoId,
    lireFiche: async () => brute,
    contexte: { ...contexte, texteScript },
    journal: {
      lire: async () => (journal ? structuredClone(journal) : null),
      ecrire: async (j) => {
        // L'étape qui vient d'être faite : celle dont l'empreinte est nouvelle.
        const faite = ETAPES_FABRICATION.find((e) => j.etapes[e] && j.etapes[e]?.empreinte !== journal?.etapes[e]?.empreinte);
        if (faite && cible === etapeDuMoteur(faite) && ARRETS.has(faite)) {
          simule = true;
          throw new Error(`Échec simulé de l'étape « ${cible} ».`);
        }
        journal = structuredClone(j);
        if (!faite) return;
        atteinte = Math.max(atteinte, ETAPES_FABRICATION.indexOf(faite));
        if (ARRETS.has(faite)) {
          pause = pauseApresEtape = true;
          throw new Error(MARQUE_PAUSE);
        }
      },
    },
    // Un fournisseur fait attendre : on rend la main, le prochain `avancer` reprend au même endroit.
    attendre: async () => {
      pause = true;
      throw new Error(MARQUE_PAUSE);
    },
  };

  try {
    const compteRendu = await fabriquerTableau(o);
    return { etat: { ...etat, journal, atteinte: ETAPES_FABRICATION.length - 1, ...(simule ? { echecSimuleFait: true } : {}) }, issue: { type: "fini", compteRendu } };
  } catch (err) {
    const etape = err instanceof ErreurFabrication ? err.etape : undefined;
    // Attente ou échec au milieu d'une étape : celles d'avant ont été passées (faites ou reprises).
    if (etape && !pauseApresEtape) atteinte = Math.max(atteinte, ETAPES_FABRICATION.indexOf(etape) - 1);
    const apres: EtatTableau = { ...etat, journal, atteinte, ...(simule ? { echecSimuleFait: true } : {}) };
    if (pause) return { etat: apres, issue: { type: "pause" } };
    const cle = etape ? etapeDuMoteur(etape) : undefined;
    const raisons = err instanceof ErreurFabrication ? err.raisons : [raisonDe(err)];
    const nom = etapesTableau(commande).find((e) => e.cle === cle)?.nom ?? "La fabrication";
    const reessayable = simule || !etape || !NON_REESSAYABLES.has(etape);
    const sceneRatee = !simule && etape === "scenes" && raisons.some((r) => r.startsWith("Rendu de la scène"));
    const erreur: ErreurTravail = {
      code: simule ? "TABLEAU_ECHEC_SIMULE" : etape === "fiche" ? "TABLEAU_FICHE_REFUSEE" : sceneRatee ? "TABLEAU_SCENE_RATEE" : "TABLEAU_ECHEC",
      reessayable,
      messagePourWill: sceneRatee ? PHRASE_SCENE_RATEE : `${nom} n'a pas abouti. ${raisons.join(" ")}${reessayable ? " Vous pouvez réessayer cette étape seule." : " Modifiez la fiche de scènes, puis relancez."}`,
      detailTechnique: raisonDe(err),
    };
    return { etat: apres, issue: { type: "echec", cle: cle ?? "fiche", erreur } };
  }
}

/* ------------------------------------------------------------------ */
/* Résultat                                                              */
/* ------------------------------------------------------------------ */

/** Ce qui a été payé pendant ce travail : la voix, si elle a été lue ici (reprise d'une version d'avant : rien). */
function lignesPayeesDe(etat: EtatTableau): LigneCout[] {
  const voix = etat.journal?.etapes.voix;
  if (!voix || voix.empreinte === etat.voixDepart) return [];
  const audio = voix.sortie as { coutCentimes?: number; reutilise?: boolean; caracteres?: number; fournisseur?: string } | undefined;
  if (!audio || audio.reutilise || !audio.coutCentimes) return [];
  return [ligne("Voix", audio.fournisseur ?? "voix", "caractere", audio.caracteres ?? 0, "reel", centimes(audio.coutCentimes))];
}

/** Alertes et note d'une sortie (contrôles, fin absente, voix sans la recette). */
function qualiteDe(controles: CompteRenduFabrication["controles"], fin: CompteRenduFabrication["fin"], recette: CompteRenduFabrication["recetteVoix"], enPlus: CompteRenduFabrication["alertes"] = []) {
  const signales = [...controles.indicatifs, ...controles.nonFaits];
  const alertes = [
    ...signales.map((l) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `${l.libelle} : ${l.raison}` })),
    // Pas de fin validée : la vidéo est livrée sans écran de fin, et le rapport le dit (jamais un échec). Déjà dite par
    // la chaîne (fin sans appel de TikTok et Shorts) : pas deux fois.
    ...(fin && "absente" in fin && !(enPlus ?? []).some((a) => a.message === fin.absente) ? [{ code: "fin" as const, gravite: "info" as const, message: fin.absente }] : []),
    // Repli de la recette : voix brute gardée (horodatages absents), dit au rapport.
    ...(recette && !recette.appliquee && recette.raison ? [{ code: "synchronisation" as const, gravite: "info" as const, message: recette.raison }] : []),
    // Bruitage introuvable retiré (repli sûr) : la vidéo est livrée sans ce son, et le rapport le dit.
    ...(enPlus ?? []),
  ];
  return { alertes, note: Math.max(60, 90 - 5 * signales.length) };
}

/**
 * Formats par réseau T4 : pour quels réseaux du registre un fichier a été fait, et sa fin. Réseaux : la table et la règle
 * des fins (`reseauxDeLaSortie`, la même que `reseauDeLaSortie` des services) ; quand les deux verticaux sont faits
 * (`faites`), le vertical ne sert plus que Instagram et Facebook, le vertical « liens » TikTok et Shorts. Fin : celle
 * que le tableau a rendue (`fin`) ; une fin au mot retire les réseaux où elle est interdite (TikTok, Shorts, LinkedIn ;
 * décision de Will du 18/10 16 h 55 : YouTube garde par défaut le fichier au mot, `FIN_AU_MOT_TOLEREE`). Les sorties qui ne disent jamais
 * l'appel au mot (`SORTIES_SANS_APPEL_AU_MOT`) : `appelAuMot: false`, toujours. Les autres : fin inconnue ou absente
 * → champ absent (leur voix peut dire l'appel de la fiche, `appelDitDeLaSortie`).
 * Décision 1 (18/10, « LinkedIn = 4:5 », confirmée par la décision de Will du 18/10 16 h 55) : un portrait à fin propre sert aussi LinkedIn, et passe donc avant le carré ;
 * à fin au mot ou inconnue, jamais (LinkedIn garde le carré, sans appel au mot). T5 : quand le portrait de LinkedIn
 * (`portrait-linkedin`, toujours sans appel au mot) est fait, c'est lui qui sert LinkedIn, et le portrait du fil ne le
 * sert plus.
 */
export function destinationDeLaSortie(format: IdSortie, faites: readonly IdSortie[], fin?: FinRetenue): { reseaux: IdReseau[]; appelAuMot?: boolean } {
  const appelAuMot = sansAppelAuMot(format) ? false : fin && "ecran" in fin ? finAuMot(fin) : undefined;
  const ratio = formatSortie(formatImage(format)).ratio;
  const reseaux = reseauxDeLaSortie(format, faites).filter((r) => finPermise(r, { appelAuMot, ratio }));
  if (format === "portrait" && appelAuMot === false && !faites.includes(PORTRAIT_LINKEDIN) && !reseaux.includes("linkedin")) reseaux.push("linkedin");
  return { reseaux, ...(appelAuMot !== undefined ? { appelAuMot } : {}) };
}

function resultatDe(commande: CommandeFabrication, r: CompteRenduFabrication, etat: EtatTableau): ResultatFabrication {
  const { alertes, note } = qualiteDe(r.controles, r.fin, r.recetteVoix, r.alertes);
  // La voix reprise d'une fabrication arrêtée est déjà dans le journal : pas recopiée dans le projet.
  const { voixPayee: _reprise, ...entrees } = lireEntreesTableau(commande.entrees);
  void _reprise;
  // Une sortie par format fabriqué (une seule voix pour toutes). Formats par réseau T4 : chaque fichier dit ses réseaux
  // et, quand elle est sûre, sa fin ; la publication envoie à chaque réseau SON fichier (`meilleureSortie`). Deux
  // verticaux : celui de TikTok et Shorts (sans la fin au mot) reste AVANT celui des Reels (un lecteur d'avant T4 qui
  // prend le premier fichier du ratio n'envoie jamais la promesse d'envoi par erreur). T5 : de même, le portrait de
  // LinkedIn (sans la fin au mot) passe juste avant le portrait du fil (rien d'autre ne bouge).
  const ordonnees = [...r.sorties].sort((a, b) => Number(b.format === VERTICAL_LIENS) - Number(a.format === VERTICAL_LIENS));
  const iPortrait = ordonnees.findIndex((s) => s.format === "portrait");
  const iLinkedin = ordonnees.findIndex((s) => s.format === PORTRAIT_LINKEDIN);
  if (iPortrait >= 0 && iLinkedin > iPortrait) ordonnees.splice(iPortrait, 0, ...ordonnees.splice(iLinkedin, 1));
  const faites = ordonnees.map((s) => s.format);
  const sorties = ordonnees.length
    ? ordonnees.map((s) => {
        const q = qualiteDe(s.controles, s.fin, r.recetteVoix, s.alertes);
        return {
          ratio: s.ratio,
          ...destinationDeLaSortie(s.format, faites, s.fin),
          fichierCle: s.cles.video,
          vignetteCle: s.cles.vignette,
          resolution: `${s.largeur}x${s.hauteur}`,
          dureeSec: s.dureeSec,
          taille: s.tailleOctets ?? 0,
          rapportQualite: { note: q.note, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: true }, alertes: q.alertes, niveauSonoreLufs: -14 },
        };
      })
    : [{ ratio: "9:16" as const, fichierCle: r.cles.video, vignetteCle: r.cles.vignette, resolution: "1080x1920", dureeSec: r.dureeSec, taille: 0, rapportQualite: { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: true }, alertes, niveauSonoreLufs: -14 } }];
  return {
    sorties,
    noteQualite: { globale: note, alertes },
    lignesReelles: [...lignesPayeesDe(etat), ligne("Montage tableau animé", "studio", "forfait", 1, "reel")],
    projetMontage: {
      moteur: ID_MOTEUR_TABLEAU,
      tableau: {
        journal: journalAGarder(etat.journal),
        ...(etat.fiche !== undefined ? { fiche: etat.fiche } : {}),
        ...(etat.retouchee ? { retouchee: true } : {}),
        ...entrees,
        cles: r.cles,
        scenes: r.scenes,
        controles: { verdict: r.controles.verdict, resume: r.controles.resume, phrases: r.controles.phrases },
        dureeSec: r.dureeSec,
        ...(r.fin ? { fin: r.fin } : {}),
        ...(r.recetteVoix ? { recetteVoix: r.recetteVoix } : {}),
        sorties: ordonnees.map((s) => ({ format: s.format, libelle: s.libelle, ratio: s.ratio, largeur: s.largeur, hauteur: s.hauteur, reseaux: s.reseaux, video: s.cles.video, vignette: s.cles.vignette, dureeSec: s.dureeSec })),
        // Sorties demandées mais refusées (une autre est prête) : la vidéo est livrée sans elles, le rapport le dit.
        ...(r.manquantes?.length ? { manquantes: r.manquantes.map((m) => ({ format: m.format, libelle: m.libelle, etape: m.etape, raisons: m.raisons })) } : {}),
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ce qu'une fabrication arrêtée a déjà fait (lu par les services)       */
/* ------------------------------------------------------------------ */

/**
 * La voix payée par ce travail (ou reprise par lui), telle que son journal la garde : de quoi la reprendre dans une
 * fabrication suivante de la même vidéo. `null` : aucune voix faite.
 */
export function voixPayeeDuTravail(travail: Pick<Travail, "id" | "parametres">): VoixPayee | null {
  const j = lireEtat(travail as Travail).journal;
  const voix = j?.etapes.voix;
  if (!j || !voix) return null;
  return { travailId: travail.id, journal: structuredClone({ version: j.version, etapes: { voix }, ...(j.voix ? { voix: j.voix } : {}), ...(j.lectures ? { lectures: j.lectures } : {}), ...(j.recettes ? { recettes: j.recettes } : {}) }) };
}

/**
 * Fichiers vidéo déjà déposés par ce travail, sortie par sortie (le montage de la sortie est au journal), même si le
 * travail s'est arrêté ensuite sur une autre sortie.
 */
export function fichiersDuTravail(travail: Pick<Travail, "parametres">): Partial<Record<IdSortie, { video: string; vignette?: string }>> {
  const j = lireEtat(travail as Travail).journal;
  const r: Partial<Record<IdSortie, { video: string; vignette?: string }>> = {};
  const lire = (x: { etapes?: { composition?: { sortie?: unknown } } } | undefined) => {
    const s = x?.etapes?.composition?.sortie as { sortieCle?: unknown; vignetteCle?: unknown } | undefined;
    return typeof s?.sortieCle === "string" && s.sortieCle ? { video: s.sortieCle, ...(typeof s.vignetteCle === "string" && s.vignetteCle ? { vignette: s.vignetteCle } : {}) } : null;
  };
  const vertical = lire(j ?? undefined);
  if (vertical) r.vertical = vertical;
  for (const [id, sortie] of Object.entries(j?.sorties ?? {})) {
    const f = lire(sortie);
    if (f) r[id as IdSortie] = f;
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* Le moteur                                                             */
/* ------------------------------------------------------------------ */

const NON_RELIE = "Le tableau animé n'est pas relié (voix, stockage des fichiers ou serveur de rendu). Vérifiez Réglages > Connexions, puis réessayez.";

/** Refus avant toute réservation : ce qui manque à la commande elle-même. */
function refusDeCommande(commande: CommandeFabrication): { code: string; message: string } | null {
  if (!commande.distribution.length) return { code: "TABLEAU_SANS_VOIX", message: "Choisissez le personnage qui prête sa voix à cette vidéo." };
  if (!ficheFournie(commande) && !commande.script.texteComplet?.trim()) return { code: "TABLEAU_SANS_FICHE", message: "Il manque la fiche de scènes ou le script de cette vidéo." };
  return null;
}

export function creerMoteurMontageTableau(dependances: DependancesMoteurTableau = {}): MoteurVideo {
  const fabrique = (): FabriqueOutilsTableau | undefined => dependances.outils ?? servicesTableau().outils;

  /**
   * Fiche gardée dans le projet de la version d'avant : la fiche découpée (vidéo partie d'un script), ou la fiche
   * retouchée par boutons tant que la commande désigne la même fiche rangée (une nouvelle fiche fournie l'emporte).
   */
  function ficheDuProjet(commande: CommandeFabrication, avant: ProjetTableau | null): { fiche: unknown; retouchee: boolean } | null {
    if (avant?.fiche === undefined) return null;
    if (!ficheFournie(commande)) return { fiche: avant.fiche, retouchee: !!avant.retouchee };
    const memeFiche = avant.retouchee === true && avant.ficheScenesCle === lireEntreesTableau(commande.entrees).ficheScenesCle;
    return memeFiche ? { fiche: avant.fiche, retouchee: true } : null;
  }

  /** Travail qui repart du projet de montage d'une version (retouche, réexport) ; `retouche` : la fiche retouchée. */
  function travailDepuisParent(commande: CommandeFabrication, contexte: ContexteLancement, projetMontage: Record<string, unknown> | undefined, retouche?: FicheTableau): Travail {
    const avant = lireProjet(projetMontage);
    const garde = retouche ? { fiche: retouche, retouchee: true } : ficheDuProjet(commande, avant);
    const etat: EtatTableau = {
      journal: avant?.journal ?? null,
      atteinte: -1,
      ...(garde ? { fiche: garde.fiche } : {}),
      ...(garde?.retouchee ? { retouchee: true } : {}),
      ...(avant?.journal.etapes.voix ? { voixDepart: avant.journal.etapes.voix.empreinte } : {}),
    };
    return nouveauTravail(etapesTableau(commande, { ficheConnue: garde !== null }), contexte, commande, etat);
  }

  /** Fiche de départ d'une retouche : celle du projet d'avant, sinon celle rangée sous la clé de la commande. */
  async function ficheDeDepart(commande: CommandeFabrication, outils: OutilsTableau, projetMontage: Record<string, unknown> | undefined): Promise<unknown> {
    const garde = ficheDuProjet(commande, lireProjet(projetMontage));
    if (garde) return garde.fiche;
    const cle = lireEntreesTableau(commande.entrees).ficheScenesCle;
    return cle ? outils.lireFiche(cle) : undefined;
  }

  return {
    id: ID_MOTEUR_TABLEAU,
    nom: "Montage tableau animé",
    capacites: {
      // 90 s : plafond du Reel Facebook (§ 2) ; 9:16 seulement en version 1.
      dureeMaxSec: 90,
      ratios: ["9:16"],
      langues: ["fr-FR"],
      retoucheParPlan: true,
      asynchrone: true,
      accordExige: false,
      maquette: false,
    },

    async estimer(commande) {
      return estimation(lignesEstimees(commande), etapesTableau(commande).reduce((t, e) => t + e.dureeEstimeeSec, 0));
    },
    async estimerRetouche() {
      // Seules les scènes changées sont rendues : une scène et la composition, au plus souvent.
      return estimation([ligne("Montage tableau animé", "studio", "forfait", 1, "estime")], 150);
    },
    async estimerReexport() {
      return estimation([ligne("Montage tableau animé", "studio", "forfait", 1, "estime")], 10);
    },

    etapes: (commande) => etapesTableau(commande),

    refusAuLancement: refusDeCommande,
    refusRetouche: refusDeCommande,

    async lancer(commande, contexte) {
      // Voix déjà payée par une fabrication arrêtée de cette vidéo (même texte dit) : reprise, jamais relue ni recomptée.
      const reprise = lireEntreesTableau(commande.entrees).voixPayee;
      const journal = reprise ? (structuredClone(reprise.journal) as JournalFabrication) : null;
      return nouveauTravail(etapesTableau(commande), contexte, commande, { journal, atteinte: -1, ...(journal?.etapes.voix ? { voixDepart: journal.etapes.voix.empreinte } : {}) });
    },

    async avancer(travail, commande, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule" || travail.statut === "echec") return { travail };
      let etat = lireEtat(travail);
      let outils: OutilsTableau | null = null;
      try {
        outils = (await fabrique()?.(commande, travail.id)) ?? null;
      } catch (err) {
        return { travail: enEchec(travail, etat, undefined, { code: "TABLEAU_NON_RELIE", reessayable: true, messagePourWill: `${raisonDe(err)} Vous pouvez réessayer.`, detailTechnique: raisonDe(err) }, maintenant) };
      }
      if (!outils) return { travail: enEchec(travail, etat, undefined, { code: "TABLEAU_NON_RELIE", reessayable: true, messagePourWill: NON_RELIE }, maintenant) };

      // 1. Découpage (vidéo partie d'un script) : une étape à lui seul.
      if (travail.etapes.some((e) => e.cle === "decoupage" && e.statut !== "ignoree") && etat.fiche === undefined) {
        if (commande.simulerEchecEtape === "decoupage" && !etat.echecSimuleFait) {
          etat = { ...etat, echecSimuleFait: true };
          return { travail: enEchec(travail, etat, "decoupage", { code: "TABLEAU_ECHEC_SIMULE", reessayable: true, messagePourWill: "Le découpage n'a pas abouti. Vous pouvez réessayer cette étape seule." }, maintenant) };
        }
        if (!outils.decoupage) return { travail: enEchec(travail, etat, "decoupage", { code: "TABLEAU_DECOUPAGE_NON_RELIE", reessayable: false, messagePourWill: "Le découpage automatique n'est pas encore relié : fournissez la fiche de scènes de cette vidéo." }, maintenant) };
        const { entree, outils: outilsDecoupage } = outils.decoupage;
        const r = await decouperEnScenes({ ...entree, texteScript: commande.script.texteComplet, videoId: commande.videoId, versionId: travail.versionId ?? commande.videoId, controle: outils.contexte }, outilsDecoupage);
        if (!r.ok) {
          const reessayable = r.motif === "budget" || r.motif === "appel";
          return { travail: enEchec(travail, etat, "decoupage", { code: `TABLEAU_DECOUPAGE_${r.motif.toUpperCase()}`, reessayable, messagePourWill: [r.message, ...r.refus].join(" "), detailTechnique: r.refus.join(" | ") }, maintenant) };
        }
        etat = { ...etat, fiche: r.fiche };
        return { travail: suivant(travail, etat, statuts(travail, etat), maintenant) };
      }

      // 2. La chaîne, jusqu'à la prochaine étape faite ou la prochaine attente.
      const tour = await tourDeChaine(commande, outils, etat, travail.versionId);
      etat = tour.etat;
      if (tour.issue.type === "pause") {
        // Délai de garde global : l'état de la chaîne n'a pas changé depuis M minutes → échec lisible, reprise sans repayer.
        const empreinte = empreinteAvancement({ ...etat, garde: undefined });
        const depuis = etat.garde?.empreinte === empreinte ? etat.garde.depuis : maintenant;
        etat = { ...etat, garde: { empreinte, depuis } };
        const delai = outils.delaiGardeMs ?? DELAI_GARDE_TRAVAIL_MS;
        if (maintenant - depuis >= delai) {
          const min = Math.round(delai / 60_000);
          return { travail: enEchec(travail, etat, undefined, { code: CODE_SANS_NOUVELLE, reessayable: true, messagePourWill: `La fabrication n'a plus avancé depuis ${min} min. Relancez : la voix déjà payée est gardée.`, detailTechnique: `Aucun changement d'état de la chaîne depuis ${min} min.` }, maintenant) };
        }
        return { travail: suivant(travail, etat, statuts(travail, etat), maintenant) };
      }
      if (tour.issue.type === "echec") return { travail: enEchec(travail, etat, tour.issue.cle, tour.issue.erreur, maintenant) };
      const r = tour.issue.compteRendu;
      if (r.controles.verdict === "bloque") {
        const etatControle = { ...etat, atteinte: ETAPES_FABRICATION.indexOf("controles") - 1 };
        return { travail: enEchec(travail, etatControle, "controle", { code: "TABLEAU_CONTROLES_BLOQUANTS", reessayable: false, messagePourWill: `La vérification bloque la livraison (${r.controles.resume}). ${r.controles.phrases.join(" ")}` }, maintenant) };
      }
      return { travail: suivant(travail, etat, statuts(travail, etat), maintenant), resultat: resultatDe(commande, r, etat) };
    },

    async reessayer(travail, maintenant = Date.now()) {
      // L'étape en échec repart ; tout ce qui est fait reste fait (le journal garde chaque étape réussie). Les rendus
      // suivis repartent (pas l'échec gardé par le serveur) et le délai de garde global recommence.
      const etat = lireEtat(travail);
      const { garde: _garde, ...sansGarde } = etat;
      void _garde;
      return {
        ...avecEtat(travail, { ...sansGarde, journal: relancerRendus(etat.journal) }),
        etapes: travail.etapes.map((e) => (e.statut === "echec" ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)),
        statut: "en_cours",
        erreur: undefined,
        termineLe: undefined,
        tentatives: travail.tentatives + 1,
        modifieLe: new Date(maintenant).toISOString(),
      };
    },

    async retoucher({ commande, contexte, operations, parent }) {
      const ctx = { ...contexte, type: "retouche" as const };
      // Opérations par boutons (TB-20) : hors catalogue = refus avant tout ; sinon appliquées à la fiche de la version
      // d'avant et validées ici, avant de lancer quoi que ce soit (un refus ne modifie rien et dit pourquoi).
      const ops = operations ?? [];
      const refus = refusOperations(ops);
      if (refus) return travailRefuse(etapesTableau(commande), ctx, commande, refus.code, refus.message);
      if (ops.length) {
        let outils: OutilsTableau | null = null;
        let brute: unknown;
        try {
          outils = (await fabrique()?.(commande, contexte.travailId)) ?? null;
          brute = outils ? await ficheDeDepart(commande, outils, parent?.projetMontage) : undefined;
        } catch (err) {
          return travailRefuse(etapesTableau(commande), ctx, commande, "TABLEAU_NON_RELIE", `${raisonDe(err)} Vous pouvez réessayer.`);
        }
        if (!outils) return travailRefuse(etapesTableau(commande), ctx, commande, "TABLEAU_NON_RELIE", NON_RELIE);
        if (brute === undefined) return travailRefuse(etapesTableau(commande), ctx, commande, RETOUCHE_REFUSEE, "La fiche de scènes de cette vidéo est introuvable : la retouche n'est pas possible.");
        const r = appliquerOperationsTableau(brute as FicheTableau, ops, { ...outils.contexte, appels: outils.appels });
        if (!r.ok) return travailRefuse(etapesTableau(commande), ctx, commande, r.code, r.message);
        return travailDepuisParent(commande, ctx, parent?.projetMontage, r.fiche);
      }
      // Fiche modifiée : nouvelle clé (ou nouvelle empreinte) dans `entrees.tableau` ; la chaîne repart du journal de la
      // version d'avant et ne refait que les étapes dont les entrées ont changé (les scènes intactes sont reprises).
      return travailDepuisParent(commande, ctx, parent?.projetMontage);
    },

    async reexporter({ commande, contexte, cible, parent }) {
      const ctx = { ...contexte, type: "reexport" as const };
      if ("reseau" in cible) return travailRefuse(etapesTableau(commande), ctx, commande, "REEXPORT_NON_PRIS_EN_CHARGE", "Les fins par réseau du tableau animé viendront en version 2 : la vidéo reste telle quelle.");
      if (cible.ratio !== "9:16") return travailRefuse(etapesTableau(commande), ctx, commande, "REEXPORT_NON_PRIS_EN_CHARGE", `Le tableau animé ne sort qu'en 9:16 pour l'instant (le ${cible.ratio} viendra en version 2).`);
      // 9:16 : recomposé depuis la version d'avant, tout est repris (rien de payé, rien de rendu deux fois).
      return travailDepuisParent(commande, ctx, parent?.projetMontage);
    },

    async recalquer({ commande, contexte }) {
      return travailRefuse(etapesTableau(commande), { ...contexte, type: "recalque-sous-titres" }, commande, "RECALQUE_NON_PRIS_EN_CHARGE", "La correction des sous-titres seuls n'est pas encore prise en charge pour le tableau animé (version 2) : ils suivent la voix.");
    },

    async maquette(commande) {
      // Pas de maquette (capacites.maquette = false) : la fiche de scènes tient lieu d'aperçu.
      return { dureeSec: commande.dureeCibleSec };
    },

    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return {
        ...travail,
        statut: "annule",
        etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, coutReel: undefined, erreur: undefined })),
        erreur: undefined,
        modifieLe: iso,
        termineLe: iso,
      };
    },

    lignesPayees(travail) {
      return lignesPayeesDe(lireEtat(travail));
    },
  };
}

export const moteurMontageTableau = creerMoteurMontageTableau();
