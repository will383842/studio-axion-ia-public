/**
 * T-EXT-55 · ORCHESTRE DE L'ÉQUIPE du tutoriel de valeur — PUR : aucun appel, aucune horloge, aucun réseau, ne lève jamais.
 *
 * Il décide, à partir de l'état de l'équipe (`travail.parametres.tutoriel.equipe`), du PROCHAIN pas : UN rôle à la fois, dans
 * l'ordre chef de projet → (maquettiste si une pièce manque) → analyste → stratège → scénariste → réalisateur →
 * contrôleur (avant validation) → registre des textes → pause « à valider » (écran de T-EXT-24). Les rôles sans IA
 * (règles) rendent leur résultat tout de suite ; les rôles payants rendent l'entrée à envoyer et son empreinte (la chaîne
 * paie par `payerUneFois`, T-EXT-45a : même entrée = jamais repayé). La sortie d'un rôle est relue par SA garde ; refusée,
 * elle devient une remarque et le rôle est rejoué au plus `essaisMax` fois.
 *
 * Forme de `EtatEquipe` : celle que lisent l'écran de validation (T-EXT-24, `vueValidationTutoriel`) et les actions de
 * T-EXT-33 (`propositionScripts`, `scriptChoisi`, `registre`, `parcours`, `textesMaquette`, `conversation`, `propositions`).
 * Rien ici ne dit ni n'écrit une phrase : les textes viennent des rôles, relus par leurs gardes, puis choisis par Williams.
 */
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { formatDuRatio } from "../proprietes";
import type { RegistrePaye } from "../reprise";
import type { IdRole } from "../journal-roles";
import { carteParRegles, entreeAnalyste, GESTES_ZONE, lireCarteZones, roleAnalyste, TAILLE_MAX_FICHIERS, ZONES_MAX, type CarteZones, type FichierDossier } from "./analyste";
import { classerParRegles, etablirCahier, lireDecisionChef, roleChefDeProjet, type CahierVideo, type DecisionChef, type DemandeTutoriel, type InventaireDossier } from "./chef-de-projet";
import { controlerAvantValidation, resumePourWilliams, type VerdictControleur } from "./controleur";
import { PHRASE_FIN_RENDEZ_VOUS } from "./dossier-validation";
import { PROPOSITIONS_PIECE_MAX } from "../maquette-creee";
import { appliquerPieceGardee, CODE_PIECE_A_REVOIR, pasPieceCreee, recevoirProposition, type EtatPiece } from "./pas-piece-creee";
import { lireFluxAutomatisation } from "../gabarit-flux";
import { completerManque, entreeMaquettiste, MANQUES_MAQUETTISTE, roleMaquettiste, type ContexteMaquettiste, type ManqueMaquettiste, type PropositionMaquettiste } from "./maquettiste";
import { realiser, type ParcoursTutoriel } from "./realisateur";
import { etablirRegistre, type RegistreTextes } from "./registre-textes";
import { entreeScenariste, figerScriptChoisi, lirePropositionScripts, roleScenariste, type PropositionScripts, type ScriptChoisi } from "./scenariste";
import { entreeStrategeValeur, lireFicheValeur, roleStrategeValeur, type FicheValeur } from "./strategie-valeur";

/* ------------------------------------------------------------------ */
/* Rôles de l'équipe (lu par T-EXT-42 pour le devis)                    */
/* ------------------------------------------------------------------ */

export type PayantRole = "si-a-trancher" | "si-manque";
export interface RoleTutoriel {
  id: IdRole;
  /** Appels payants au plus (0 = règles seules). */
  essaisMax: number;
  payant?: PayantRole;
}

export const ROLES_TUTORIEL: readonly RoleTutoriel[] = Object.freeze([
  { id: "chef-de-projet", essaisMax: 1, payant: "si-a-trancher" },
  { id: "analyste", essaisMax: 1 },
  { id: "maquettiste", essaisMax: 1, payant: "si-manque" },
  { id: "stratege", essaisMax: 1 },
  { id: "scenariste", essaisMax: 2 },
  { id: "realisateur", essaisMax: 0 },
  { id: "controleur", essaisMax: 0 },
] satisfies RoleTutoriel[]);

/** Les rôles qui parlent à Claude (les autres sont des règles) : les définitions, importées jamais recopiées. */
export const ROLES_APPELES: Readonly<Partial<Record<IdRole, DefinitionRole>>> = Object.freeze({
  "chef-de-projet": roleChefDeProjet as DefinitionRole,
  analyste: roleAnalyste as DefinitionRole,
  maquettiste: roleMaquettiste as unknown as DefinitionRole,
  stratege: roleStrategeValeur as DefinitionRole,
  scenariste: roleScenariste as DefinitionRole,
});

/** Pire cas de l'entrée de chaque rôle payant : chaque champ à sa taille MAXIMALE (sert au plafond par défaut ; rien n'est envoyé). */
export function entreesPireCasEquipe(): Record<"chef-de-projet" | "analyste" | "maquettiste" | "stratege" | "scenariste", EntreeRole> {
  const long = (n: number) => "x".repeat(n);
  const zone = (i: number) => ({ id: `zone-${i}-${long(50)}`, nom: long(40), aller: long(120), cible: long(200), etat: "les-deux", gestes: [...GESTES_ZONE], prouve: long(140), chiffres: Array.from({ length: 12 }, () => long(60)) });
  const carte = { version: "carte-zones.v1", maquette: long(60), zones: Array.from({ length: ZONES_MAX }, (_, i) => zone(i)), manques: [] } as unknown as CarteZones;
  const cahier = { version: "cahier-tutoriel.v1", entree: "A", cas: 1, gabarits: ["G-Decision"], roles: ["analyste", "stratege", "scenariste", "realisateur", "controleur"], manques: [long(120)], scriptsFournis: [long(1500), long(1500)], fin: "prendre-rendez-vous", ratios: ["4:5", "9:16", "1:1"], dureeCibleSec: [40, 55], raisons: [long(200)] } as unknown as CahierVideo;
  const fiche = { version: "fiche-valeur.v1", metier: long(40), moments: Array.from({ length: 3 }, () => ({ pourquoi: long(140) })) } as unknown as FicheValeur;
  return {
    "chef-de-projet": { contexte: {}, variable: JSON.stringify({ phrase: long(300), dossier: { notes: long(2000) } }) },
    analyste: entreeAnalyste({ cahier, fichiers: [{ chemin: "index.html", contenu: long(TAILLE_MAX_FICHIERS) }] }),
    maquettiste: entreeMaquettiste("maquette", { metier: long(40), carteZones: carte.zones.map((z) => ({ id: z.id, libelle: z.nom })), interdits: [long(40)] }),
    stratege: entreeStrategeValeur(carte, cahier),
    scenariste: entreeScenariste({ cahier, carte, fiche, dureeFinSec: 5 }),
  };
}

export type { InventaireDossier };

const essaisMaxDe = (id: IdRole): number => ROLES_TUTORIEL.find((r) => r.id === id)?.essaisMax ?? 0;

/* ------------------------------------------------------------------ */
/* État et entrées                                                      */
/* ------------------------------------------------------------------ */

export interface TexteMaquette {
  etapeId: string;
  textes: string[];
  creee: boolean;
}

/** Ce que le dossier de Williams offre à l'équipe (lu par le service de T-EXT-41, zip déjà contrôlé). */
export interface DossierLu {
  inventaire: InventaireDossier;
  fichiers: FichierDossier[];
  donnees?: TableauDeBord;
  textesMaquette: TexteMaquette[];
  conversation?: { auteur: "client" | "assistant"; texte: string }[];
  couleurs: string[];
  polices: string[];
  noms: string[];
  /** Contexte du maquettiste, quand le dossier peut le donner ; absent : une pièce manquante ne peut pas être complétée. */
  contexteMaquettiste?: ContexteMaquettiste;
}

export interface EtatEquipe extends EtatPiece {
  demande: DemandeTutoriel;
  decision?: DecisionChef;
  cahier?: CahierVideo;
  carte?: CarteZones;
  /** Pièces que le maquettiste a proposées (jamais posées à la place de Williams). */
  pieces?: PropositionMaquettiste[];
  fiche?: FicheValeur;
  propositionScripts?: PropositionScripts;
  scriptChoisi?: ScriptChoisi;
  parcours?: ParcoursTutoriel;
  verdict?: VerdictControleur;
  registre?: RegistreTextes;
  textesMaquette?: TexteMaquette[];
  conversation?: { auteur: "client" | "assistant"; texte: string }[];
  dureeFinSec?: number;
  /** Remarques du dernier refus de chaque rôle payant (relues par le nouvel essai). */
  remarques?: Partial<Record<IdRole, string[]>>;
  /** Appels payants faits par rôle (refusés compris). */
  appels?: Partial<Record<IdRole, number>>;
  /** PHRASE-1 : la proposition n° 1 a pris ses 2 appels (un refus, puis la reprise avec les remarques) : plus d'autre proposition possible. */
  repriseMaquettiste?: true;
  /** Contrôle après le calage de la voix (durées réelles) : rangé par la chaîne, jamais bloquant. */
  verdictCalage?: VerdictControleur;
  /** Remarques du tronc commun des scripts (chantier SC) sur les versions : elles commentent, ne réécrivent jamais. */
  remarquesTronc?: string[];
  /** La correction de Williams a été notée au tronc (une seule fois). */
  correctionNotee?: true;
  /** T-EXT-45a : résultats déjà payés. */
  payes: RegistrePaye;
}

export interface EntreesEquipe {
  dossier: DossierLu | null;
  /** V2 : la vidéo part d'une phrase ET les deux réglages sont allumés (lus par le service, jamais écrits ici) ; seul `true` exact compte. */
  phraseOuverte?: boolean;
  /** Williams a demandé d'ajuster un script fourni : seul `true` exact compte. */
  ajusterDemande?: true;
}

export type PauseEquipe = { code: string; message: string };

export type PasEquipe =
  /** Rôle payant : la chaîne l'appelle par `payerUneFois` puis rend la sortie à `appliquerSortie`. */
  | { faire: IdRole; payant: true; entree: EntreeRole; empreinteEntree: string }
  /** Rôle sans IA : déjà fait, voici l'état suivant. */
  | { faire: IdRole; payant: false; etat: EtatEquipe; resume: string }
  | { pause: PauseEquipe; etat?: EtatEquipe }
  | { fini: true };

export const MESSAGE_PLUS_DE_PROPOSITION = "Les deux essais de cette maquette sont faits : il n'y a plus d'autre proposition possible. Arrêtez cette demande et reformulez votre phrase. Rien n'a échoué.";
const MESSAGE_BLOQUEE = "Une étape de préparation n'a pas abouti : réessayez ou collez votre script.";
const MESSAGE_A_VALIDER = "Relisez les deux scripts, choisissez l'un ou corrigez-le, puis validez : la vidéo se fabrique ensuite.";
const MESSAGE_CONTROLE_BLOQUANT = "Le contrôle a relevé des points à revoir avant de valider (ils sont montrés sur l'écran) : choisissez, corrigez ou demandez une réécriture.";

export const CODE_EQUIPE_BLOQUEE = "TO_EQUIPE_BLOQUEE";
export const CODE_DOSSIER_INCOMPLET = "TO_DOSSIER_INCOMPLET";
export const CODE_A_VALIDER = "TO_SCRIPT_A_VALIDER";

const bloquee = (): PasEquipe => ({ pause: { code: CODE_EQUIPE_BLOQUEE, message: MESSAGE_BLOQUEE } });
const empreinteDe = (role: IdRole, entree: EntreeRole): string => fnv1a64(jsonCanonique({ role, entree }));

/** Nombre d'appels déjà faits à un rôle payant. */
const appelsFaits = (e: EtatEquipe, role: IdRole): number => e.appels?.[role] ?? 0;

/** Remarques renvoyées au rôle : 6 au plus (la dernière peut résumer les autres), chacune de 200 caractères au plus, 1 200 au total. */
export const REMARQUES_MAX = 6;
export const REMARQUE_CARACTERES_MAX = 200;
export const REMARQUES_TOTAL_MAX = 1200;

const echapperBalises = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Une remarque d'une seule ligne, bornée (le texte fautif cité par une erreur vient de Claude : jamais de longueur libre). */
const remarqueBornee = (t: string): string => {
  const seule = t.replace(/\s+/g, " ").trim();
  return seule.length > REMARQUE_CARACTERES_MAX ? `${seule.slice(0, REMARQUE_CARACTERES_MAX - 3)}...` : seule;
};

/** La nature d'une remarque, sans le lieu, les chiffres ni le texte cité : deux remarques de même nature ne sont pas « distinctes ». */
const natureRemarque = (t: string): string => (t.split(" : ").slice(1).join(" : ") || t).replace(/«[^»]*»/g, "«»").replace(/\d+/g, "#");

/**
 * Les remarques gardées dans l'état après un refus : sans doublon, UNE remarque de chaque nature d'abord (le reste ensuite),
 * 6 au plus ; quand il y en a davantage, la dernière dit combien d'autres restent (rien n'est tronqué sans le dire).
 */
export function remarquesDuRefus(erreurs: readonly unknown[]): string[] {
  const toutes = [...new Set(erreurs.filter((x): x is string => typeof x === "string").map(remarqueBornee).filter(Boolean))];
  const natures = new Set<string>();
  const distinctes: string[] = [];
  const autres: string[] = [];
  for (const t of toutes) {
    const n = natureRemarque(t);
    if (natures.has(n)) autres.push(t);
    else {
      natures.add(n);
      distinctes.push(t);
    }
  }
  const ordre = [...distinctes, ...autres];
  if (ordre.length <= REMARQUES_MAX) return ordre;
  const gardees = ordre.slice(0, REMARQUES_MAX - 1);
  return [...gardees, `et ${ordre.length - gardees.length} autres remarques du même genre`];
}

/** L'entrée du rôle, avec ses remarques d'un refus précédent : une donnée échappée (aucune balise n'en sort) et bornée, jamais une consigne. */
function avecRemarques(e: EtatEquipe, role: IdRole, entree: EntreeRole): EntreeRole {
  const brutes = e.remarques?.[role];
  if (!Array.isArray(brutes)) return entree;
  const retenues: string[] = [];
  let total = 0;
  for (const t of brutes.filter((x): x is string => typeof x === "string").slice(0, REMARQUES_MAX)) {
    const r = echapperBalises(remarqueBornee(t)).slice(0, REMARQUE_CARACTERES_MAX).replace(/&[a-z]{0,3}$/, "");
    if (!r || total + r.length > REMARQUES_TOTAL_MAX) continue;
    retenues.push(r);
    total += r.length + 3;
  }
  return retenues.length ? { ...entree, variable: `${entree.variable}\n<remarques_precedentes>${retenues.join(" | ")}</remarques_precedentes>` } : entree;
}

/** Le rôle ne peut plus être rejoué : il a épuisé ses essais sans sortie valable. */
const epuise = (e: EtatEquipe, role: IdRole, limite = essaisMaxDe(role)): boolean => appelsFaits(e, role) >= limite && (e.remarques?.[role]?.length ?? 0) > 0;

function appel(e: EtatEquipe, role: IdRole, entreeBrute: EntreeRole): PasEquipe {
  if (appelsFaits(e, role) >= Math.max(1, essaisMaxDe(role)) && (e.remarques?.[role]?.length ?? 0) > 0) return bloquee();
  const entree = avecRemarques(e, role, entreeBrute);
  return { faire: role, payant: true, entree, empreinteEntree: empreinteDe(role, entree) };
}

const local = (faire: IdRole, etat: EtatEquipe, resume: string): PasEquipe => ({ faire, payant: false, etat, resume });

/** Ids de pièce que le maquettiste sait compléter, relevés dans le cahier. */
const manquesMaquettiste = (c: CahierVideo): ManqueMaquettiste[] => MANQUES_MAQUETTISTE.filter((m) => c.manques.includes(m));

/** Manque désigné par un identifiant (sans phrase) que personne ne sait compléter ici. */
const manqueSansReponse = (c: CahierVideo): string | undefined => c.manques.find((m) => /^[a-z][a-z-]*$/.test(m) && !(MANQUES_MAQUETTISTE as readonly string[]).includes(m));

const dureeFin = (e: EtatEquipe): number => e.dureeFinSec ?? 0;

/* ------------------------------------------------------------------ */
/* Prochain pas                                                         */
/* ------------------------------------------------------------------ */

/** V2-08 : option du pas « pièce créée ». Absente (ou différente de `true`) : toutes les sorties d'avant, inchangées. */
export interface OptionsPas {
  phraseOuverte?: boolean;
}

/** Le prochain pas de l'équipe. Même état et mêmes entrées : même pas (déterministe). Ne lève jamais. */
export function prochainPas(e: EtatEquipe, entrees: EntreesEquipe, options: OptionsPas = {}): PasEquipe {
  try {
    return pas(e, entrees, (options.phraseOuverte ?? entrees.phraseOuverte) === true);
  } catch {
    return bloquee();
  }
}

/** Le manque que crée une phrase : une maquette (cas 2) ou un flux (cas 3). */
const manquePiece = (c: CahierVideo): "maquette" | "flux-automatisation" | undefined => (c.entree !== "C" ? undefined : c.manques.includes("flux-automatisation") ? "flux-automatisation" : c.manques.includes("maquette") ? "maquette" : undefined);

/** Contexte du maquettiste pour une phrase : la phrase est une DONNÉE ; aucune carte, aucune pièce de l'utilisateur. */
const contextePiece = (e: EtatEquipe, proposition: 1 | 2): ContexteMaquettiste => ({ metier: "selon la demande", carteZones: [], interdits: [], demande: e.demande.phrase ?? "", proposition });

/** Ce que les étapes suivantes lisent d'une pièce gardée (à la place d'un dossier) : les mêmes formes, déduites sans Claude. */
function dossierDePiece(e: EtatEquipe): DossierLu {
  const flux = e.pieceCreee?.genre === "flux";
  return {
    inventaire: { maquette: true, maquetteVivante: true, tableauDeBord: !flux, captures: 0, donnees: e.donnees !== undefined, scripts: [], flux, conversation: false },
    fichiers: [],
    ...(e.donnees ? { donnees: e.donnees } : {}),
    textesMaquette: e.textesMaquette ?? [],
    couleurs: [],
    polices: [],
    noms: [],
  };
}

/** Efface la carte, les données, les textes de la maquette et tout ce qui en découle (la pièce, les appels et les paiements restent). */
function sansDeductionDePiece(e: EtatEquipe): EtatEquipe {
  const { carte: _c, donnees: _d, textesMaquette: _t, carteEmpreinte: _o, fiche: _f, propositionScripts: _p, scriptChoisi: _s, parcours: _pa, verdict: _v, registre: _r, verdictCalage: _vc, remarquesTronc: _rt, correctionNotee: _cn, ...reste } = e;
  void [_c, _d, _t, _o, _f, _p, _s, _pa, _v, _r, _vc, _rt, _cn];
  return reste;
}

function pas(e: EtatEquipe, entrees: EntreesEquipe, phraseOuverte: boolean): PasEquipe {
  let dossier = entrees.dossier;
  const demande: DemandeTutoriel = dossier ? { ...e.demande, dossier: dossier.inventaire } : e.demande;

  /* 1. Chef de projet : les règles classent ; « à trancher » seulement, un appel d'Opus. */
  if (!e.cahier) {
    const regles = classerParRegles(demande);
    // V2 : une phrase seule, réglages allumés. Aucun appel du chef (les règles classent, 0 €) ; les cas 4 et 5 restent en pause.
    if (phraseOuverte && regles.entree === "C" && !dossier && !e.decision) {
      const c = etablirCahier(demande, regles, { phraseOuverte: true });
      if (!c.ok) return { pause: { code: c.attente.code, message: c.attente.message }, etat: { ...e, decision: regles } };
      return local("chef-de-projet", { ...e, decision: regles, cahier: c.cahier, remarques: sans(e.remarques, "chef-de-projet") }, "La demande est classée : une maquette sera proposée, vous la verrez avant tout.");
    }
    // Phrase seule (entrée C) : le cahier attend de toute façon (V2), quel que soit l'avis du chef : rien n'est payé pour rien.
    if (regles.entree === "C" && !e.decision) {
      const c = etablirCahier(demande, regles);
      if (!c.ok) return { pause: { code: c.attente.code, message: c.attente.message }, etat: { ...e, decision: regles } };
    }
    if (regles.certitude === "a-trancher" && !e.decision) {
      return appel(e, "chef-de-projet", { contexte: {}, variable: JSON.stringify(demande) });
    }
    const decision = e.decision ?? regles;
    const c = etablirCahier(demande, decision, phraseOuverte ? { phraseOuverte: true } : {});
    if (!c.ok) return { pause: { code: c.attente.code, message: c.attente.message }, etat: { ...e, decision } };
    return local("chef-de-projet", { ...e, decision, cahier: c.cahier, remarques: sans(e.remarques, "chef-de-projet") }, "Le dossier est classé : le cas et le parcours sont choisis.");
  }
  const cahier = e.cahier;

  /* 2a. V2 : la pièce créée depuis une phrase : proposer, faire contrôler, construire, faire garder, puis la chaîne d'avant. */
  const piece = phraseOuverte && !dossier ? manquePiece(cahier) : undefined;
  if (piece) {
    const p = e.pieceCreee;
    // Proposition demandée : 1 au départ ; 2 quand l'écran a noté « En proposer une autre » (pièce n° 2 « à construire »).
    const numero: 1 | 2 = p?.proposition === 2 ? 2 : 1;
    const refusNote = (e.remarques?.maquettiste?.length ?? 0) > 0;
    const faits = appelsFaits(e, "maquettiste");
    // Un refus déjà noté pour la proposition 2 ne se rejoue pas tout seul.
    if (p && numero === 2 && refusNote && faits >= PROPOSITIONS_PIECE_MAX) return bloquee();
    // Les deux appels sont faits pour la proposition 1 (refus, puis reprise) : une proposition 2 « à construire » n'a aucun appel pour se faire.
    if (p && numero === 2 && p.statut === "a-construire" && e.repriseMaquettiste === true) return { pause: { code: CODE_PIECE_A_REVOIR, message: MESSAGE_PLUS_DE_PROPOSITION } };
    if (!p || (numero === 2 && p.statut === "a-construire" && faits < PROPOSITIONS_PIECE_MAX)) {
      // Jamais plus de PROPOSITIONS_PIECE_MAX appels au maquettiste pour une phrase (le plafond n'en compte pas plus).
      if (faits >= PROPOSITIONS_PIECE_MAX) return bloquee();
      // PHRASE-1 : proposition 1 refusée à la lecture (maquette) : UNE reprise, avec les remarques ; un flux refusé ne se rejoue pas tout seul.
      if (numero === 1 && faits >= 1 && refusNote && piece !== "maquette") return bloquee();
      if (numero === 2 && faits >= numero && refusNote) return bloquee();
      // en attendant T-EXT-25b : le manque « flux-automatisation » n'existe pas encore dans MANQUES_MAQUETTISTE.
      const entree = entreeMaquettiste(piece as ManqueMaquettiste, contextePiece(e, numero));
      return { faire: "maquettiste", payant: true, entree: avecRemarques(e, "maquettiste", entree), empreinteEntree: empreinteDe("maquettiste", avecRemarques(e, "maquettiste", entree)) };
    }
    const r = pasPieceCreee(p);
    // La pièce quitte « gardée » : tout ce qui vient de l'ancienne pièce est effacé (rien n'est repris d'un texte que Williams ne voit plus).
    if ("pause" in r) return { pause: r.pause, ...(r.etat ? { etat: { ...sansDeductionDePiece(e), pieceCreee: r.etat } } : {}) };
    if (e.carteEmpreinte !== p.gardee?.empreinte) {
      const gardee = appliquerPieceGardee(sansDeductionDePiece(e));
      // en attendant qu'un gabarit serve le cas 2 (G-Decision et G-Journee ne servent que 1, 4, 5) : une maquette gardée est, pour la suite, un tableau de bord existant (cas 1).
      const g = gardee.cahier?.cas === 2 ? { ...gardee, cahier: { ...gardee.cahier, cas: 1 as const } } : gardee;
      return local("maquettiste", g, g.carteEmpreinte !== undefined ? "Votre maquette est gardée : ses zones, ses chiffres et ses textes sont relevés." : "La maquette gardée n'a pas pu être relue : elle est à revoir.");
    }
    dossier = dossierDePiece(e);
  }

  /* 2. Maquettiste, seulement si une pièce qu'il sait compléter manque. */
  const manque = piece ? undefined : manquesMaquettiste(cahier).find((m) => !e.pieces?.some((p) => p.manque === m));
  const sansReponse = piece ? undefined : manqueSansReponse(cahier);
  if (sansReponse) return { pause: { code: CODE_DOSSIER_INCOMPLET, message: `Il manque « ${sansReponse} » : ajoutez-le à votre dossier. Rien n'a échoué.` } };
  if (manque) {
    if (!dossier?.contexteMaquettiste) return { pause: { code: CODE_DOSSIER_INCOMPLET, message: `Il manque « ${manque} » : ajoutez-le à votre dossier. Rien n'a échoué.` } };
    return appel(e, "maquettiste", entreeMaquettiste(manque, dossier.contexteMaquettiste));
  }

  if (!dossier) return { pause: { code: CODE_DOSSIER_INCOMPLET, message: "Il manque votre dossier : ajoutez-le. Rien n'a échoué." } };

  /* 3. Analyste : les règles d'abord (attributs `data-zone`, 0 €) ; sinon le rôle. */
  if (!e.carte) {
    const regles = carteParRegles(dossier.fichiers);
    if (regles) {
      const lu = lireCarteZones(regles, { cahier, fichiers: dossier.fichiers, ...(dossier.donnees ? { donnees: dossier.donnees } : {}) });
      if (lu.ok) return local("analyste", { ...e, carte: lu.carte }, "Les zones de l'écran sont relevées.");
    }
    return appel(e, "analyste", entreeAnalyste({ cahier, fichiers: dossier.fichiers, ...(dossier.donnees ? { donnees: dossier.donnees } : {}) }));
  }
  const carte = e.carte;

  /* 4. Stratège de valeur. */
  if (!e.fiche) return appel(e, "stratege", entreeStrategeValeur(carte, cahier));
  const fiche = e.fiche;

  /* 5. Scénariste : deux versions. */
  const entreeScen = { cahier, carte, fiche, dureeFinSec: dureeFin(e), ...(entrees.ajusterDemande === true ? { ajusterDemande: true as const } : {}) };
  if (!e.propositionScripts) return appel(e, "scenariste", entreeScenariste(entreeScen));
  const proposition = e.propositionScripts;

  /* 6. Réalisateur (règles seules), sur la version A : le choix de Williams vient après. */
  if (!e.parcours) {
    const f = formatDuRatio("4:5");
    const provisoire = figerScriptChoisi(proposition, { version: "A" });
    const r = realiser({ cahier, carte, fiche, script: provisoire, largeur: f.largeur, hauteur: f.hauteur });
    // Le réalisateur refuse (règles) : Williams le lit tel quel, rien n'a échoué.
    if (!r.ok) return { pause: { code: CODE_EQUIPE_BLOQUEE, message: `${MESSAGE_BLOQUEE} (${(r.erreurs[0] ?? "parcours impossible").replace(/\s+/g, " ").slice(0, 160)})` } };
    return local("realisateur", { ...e, parcours: r.parcours }, "Le parcours de la vidéo est dessiné.");
  }
  const parcours = e.parcours;

  /* 7. Contrôleur (avant validation), sans IA. */
  if (!e.verdict) {
    const verdict = controlerAvantValidation({
      cahier,
      carte,
      fiche,
      proposition,
      parcours,
      ...(dossier.donnees ? { donnees: dossier.donnees } : {}),
      textesMaquette: dossier.textesMaquette.map((t) => ({ etapeId: t.etapeId, textes: t.textes })),
      couleurs: dossier.couleurs,
      polices: dossier.polices,
      noms: dossier.noms,
      dureeFinSec: dureeFin(e),
      ...(entrees.ajusterDemande === true ? { ajusterDemande: true as const } : {}),
    });
    return local("controleur", { ...e, verdict }, resumePourWilliams(verdict).slice(0, 120));
  }

  /* 8. Registre des textes : les textes du dossier ; les phrases dites s'ajoutent au choix de Williams (T-EXT-33). */
  if (!e.registre) {
    const registre = etablirRegistre({
      script: { phrases: [], origine: "choisi" },
      fin: cahier.fin,
      ...(cahier.fin === "prendre-rendez-vous" ? { texteFin: PHRASE_FIN_RENDEZ_VOUS } : {}),
      parcours: {},
      textesMaquette: dossier.textesMaquette,
      ...(dossier.conversation ? { conversation: dossier.conversation } : {}),
    });
    return local("documentaliste", { ...e, registre, textesMaquette: dossier.textesMaquette, ...(dossier.conversation ? { conversation: dossier.conversation } : {}) }, "Les textes visibles sont listés.");
  }

  /* 9. Arrêt : Williams choisit. Un contrôle bloquant ne bloque pas en silence : il s'affiche. */
  if (e.verdict?.verdict === "bloque") return { pause: { code: CODE_A_VALIDER, message: MESSAGE_CONTROLE_BLOQUANT } };
  return { pause: { code: CODE_A_VALIDER, message: MESSAGE_A_VALIDER } };
}

/** V2-08 : la sortie du maquettiste pour une phrase devient une pièce proposée, relue par les contrôles des textes créés. Ne lève jamais. */
async function appliquerPropositionPiece(
  e: EtatEquipe,
  faits: EtatEquipe,
  genre: "maquette" | "flux-automatisation",
  sortie: unknown,
  refus: (erreurs: string[]) => Appliquee,
  accepte: (etat: EtatEquipe, resume: string) => Appliquee,
): Promise<Appliquee> {
  const numero = e.pieceCreee?.proposition ?? 1;
  if (genre === "maquette") {
    const p = await completerManque({ manque: "maquette", contexte: contextePiece(e, numero), appeler: async () => sortie });
    if (p.statut !== "proposition" || p.manque !== "maquette") return refus(p.statut === "a-revoir" ? p.erreurs : ["pièce à compléter inconnue"]);
    const recue = recevoirProposition(faits, { genre: "maquette", proposition: numero, contenu: p.description });
    // PHRASE-1 : les contrôles des textes créés et les déductions de la pièce gardée (carte, chiffres) valent un refus du lecteur pour la
    // proposition n° 1 : remarques gardées, reprise automatique dans les 2 appels déjà comptés. La proposition n° 2 (ou la reprise
    // elle-même) n'a plus d'appel : la pièce reste « à revoir », avec ses erreurs, comme avant.
    if (numero === 1 && recue.pieceCreee?.statut === "a-revoir" && appelsFaits(faits, "maquettiste") < PROPOSITIONS_PIECE_MAX) return refus(recue.pieceCreee.erreurs ?? []);
    return accepte(recue, "Une maquette est proposée : vous la verrez avant tout.");
  }
  // en attendant T-EXT-25b : le maquettiste ne sait pas encore rendre un flux ; la sortie est relue ici par le lecteur du flux (T-EXT-50).
  const contenu = sortie && typeof sortie === "object" ? (sortie as { contenu?: unknown }).contenu : undefined;
  const lu = lireFluxAutomatisation(contenu);
  if (!lu.ok) return refus(lu.erreurs);
  return accepte(recevoirProposition(faits, { genre: "flux", proposition: numero, contenu: lu.flux }), "Une automatisation est proposée : vous la verrez avant tout.");
}

function sans<T extends object>(o: T | undefined, cle: keyof T): T | undefined {
  if (!o) return o;
  const { [cle]: _x, ...reste } = o;
  void _x;
  return reste as T;
}

/* ------------------------------------------------------------------ */
/* Sortie d'un rôle payant                                              */
/* ------------------------------------------------------------------ */

export type Appliquee = { ok: true; etat: EtatEquipe; resume: string } | { ok: false; etat: EtatEquipe; bloquee: boolean };

/**
 * Relit la sortie du rôle par SA garde. Acceptée : l'état avance. Refusée : les remarques sont gardées dans l'état (le rôle
 * est rejoué avec elles) ; `bloquee` quand il n'a plus d'essai. Ne lève jamais.
 */
export async function appliquerSortie(e: EtatEquipe, role: IdRole, sortie: unknown, entrees: EntreesEquipe): Promise<Appliquee> {
  const faits: EtatEquipe = { ...e, appels: { ...e.appels, [role]: appelsFaits(e, role) + 1 } };
  // PHRASE-1 : la proposition n° 1 d'une maquette partie d'une phrase a droit à une reprise : elle n'est bloquée qu'aux PROPOSITIONS_PIECE_MAX appels.
  const repriseMaquette = role === "maquettiste" && !entrees.dossier && !!e.cahier && manquePiece(e.cahier) === "maquette" && (e.pieceCreee?.proposition ?? 1) === 1;
  const refus = (erreurs: string[]): Appliquee => {
    const etat: EtatEquipe = { ...faits, remarques: { ...faits.remarques, [role]: remarquesDuRefus(erreurs).length ? remarquesDuRefus(erreurs) : ["réponse illisible"] } };
    return { ok: false, etat, bloquee: epuise(etat, role, repriseMaquette ? Math.max(essaisMaxDe(role), PROPOSITIONS_PIECE_MAX) : undefined) };
  };
  const accepte = (etat: EtatEquipe, resume: string): Appliquee => ({
    ok: true,
    etat: { ...etat, remarques: sans(etat.remarques, role), ...(repriseMaquette && appelsFaits(etat, role) >= PROPOSITIONS_PIECE_MAX ? { repriseMaquettiste: true as const } : {}) },
    resume,
  });
  try {
    const dossier = entrees.dossier;
    const demande: DemandeTutoriel = dossier ? { ...e.demande, dossier: dossier.inventaire } : e.demande;
    switch (role) {
      case "chef-de-projet": {
        const regles = classerParRegles(demande);
        const decision = lireDecisionChef(sortie, demande, regles);
        return accepte({ ...faits, decision }, "La demande est tranchée.");
      }
      case "maquettiste": {
        const genrePiece = !dossier && e.cahier ? manquePiece(e.cahier) : undefined;
        if (genrePiece) return await appliquerPropositionPiece(e, faits, genrePiece, sortie, refus, accepte);
        const manque = e.cahier ? manquesMaquettiste(e.cahier).find((m) => !e.pieces?.some((p) => p.manque === m)) : undefined;
        if (!manque || !dossier?.contexteMaquettiste) return refus(["pièce à compléter inconnue"]);
        const p = await completerManque({ manque, contexte: dossier.contexteMaquettiste, appeler: async () => sortie });
        if (p.statut === "a-revoir") return refus(p.erreurs);
        return accepte({ ...faits, pieces: [...(e.pieces ?? []), p] }, "Une pièce manquante est proposée.");
      }
      case "analyste": {
        if (!e.cahier || !dossier) return refus(["dossier absent"]);
        const lu = lireCarteZones(sortie, { cahier: e.cahier, fichiers: dossier.fichiers, ...(dossier.donnees ? { donnees: dossier.donnees } : {}) });
        return lu.ok ? accepte({ ...faits, carte: lu.carte }, "Les zones de l'écran sont relevées.") : refus(lu.erreurs);
      }
      case "stratege": {
        if (!e.cahier || !e.carte) return refus(["carte absente"]);
        const lu = lireFicheValeur(sortie, e.carte, e.cahier);
        return lu.ok ? accepte({ ...faits, fiche: lu.fiche }, "La valeur à montrer est choisie.") : refus(lu.erreurs);
      }
      case "scenariste": {
        if (!e.cahier || !e.carte || !e.fiche) return refus(["fiche de valeur absente"]);
        const lu = lirePropositionScripts(sortie, { cahier: e.cahier, carte: e.carte, fiche: e.fiche, dureeFinSec: dureeFin(e), ...(entrees.ajusterDemande === true ? { ajusterDemande: true as const } : {}) });
        return lu.ok ? accepte({ ...faits, propositionScripts: lu.proposition }, "Deux versions du script sont écrites.") : refus(lu.erreurs);
      }
      default:
        return refus(["rôle sans appel payant"]);
    }
  } catch {
    return refus(["réponse inutilisable"]);
  }
}
