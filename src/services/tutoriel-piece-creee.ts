/**
 * T-EXT-V2-09 · ÉCRAN « VOTRE MAQUETTE » (service) : Williams voit l'aperçu et CHAQUE texte d'une maquette créée depuis une phrase,
 * puis garde, corrige un texte, demande une autre proposition (une seule) ou arrête. Rien n'est filmé ni dit avant « Garder ».
 *
 *  - ÉTEINT PAR DÉFAUT : sans `tutoriel.entreePhrase` ET `tutoriel.pieceCreeeClaude` à exactement `true`, chaque geste refuse
 *    sans rien écrire. Les réglages sont lus par un lecteur injectable ; ce fichier n'en écrit aucun.
 *  - 0 € : AUCUN appel à Claude ici. Corriger un texte = un nouvel aperçu (poste, 0 €), le texte de Williams fait foi, jamais
 *    repassé par Claude. « Une autre proposition » ne fait que noter la demande et relancer le travail : l'appel payant passe
 *    par l'orchestre (V2-08), sous le plafond de V2-07.
 *  - Aucun montant n'est rendu.
 *  - Une pièce est une maquette OU un flux d'automatisation (`genre`) : le flux se lit de bout en bout (déclencheur, actions, résultat),
 *    se garde, se refait (une autre proposition) ou s'arrête comme une maquette ; ses textes ne se corrigent pas un à un.
 *    Une pièce « à revoir » (règles non respectées) s'affiche avec ses raisons ; seuls « une autre proposition » et « arrêter » restent.
 *
 * POUR V2-08 : le verrou `enFile` ne vaut que dans UN SEUL processus Studio. La garantie « une seule relance payée » repose donc
 * sur un seul serveur ; avec plusieurs processus, il faudra une écriture conditionnelle (comparaison avant écriture) sur l'état.
 * Le vrai appel payant de la 2e proposition passera par `payerUneFois` (clé : vidéo + proposition 2), plafond vérifié avant l'appel.
 *
 * La pièce vit dans `parametres.tutoriel.equipe.pieceCreee` du travail de fabrication de la vidéo (`PieceCreee` de l'équipe,
 * V2-08), derrière le dépôt injectable `DepotPiece`. L'écran en garde une vue (`EtatPieceCreee`) ; les gestes ne changent pas.
 */
import "server-only";
import { appliquerRelecture, chiffresARelire, type ChiffreARelire, type DecisionChiffre } from "@/briques/donnees-video/relecture-chiffres";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import { nombresAffirmes } from "@/domaine/nombres-fr";
import type { Fichier } from "@/domaine/types";
import { MESSAGE_PIECE_A_REVOIR, MESSAGE_PLUS_DE_PROPOSITION, MESSAGE_PLUS_DE_PROPOSITION_FLUX, type PieceCreee } from "@/moteurs/montage-tutoriel-outil/equipe/pas-piece-creee";
import { controlerFluxCree, empreinteFlux, textesDuFlux } from "@/moteurs/montage-tutoriel-outil/flux-cree";
import { lireFluxAutomatisation, type ActeurFlux, type FluxAutomatisation, type VueEcran } from "@/moteurs/montage-tutoriel-outil/gabarit-flux";
import { lireDescriptionMaquette, type DescriptionMaquette, type DonneeExemple } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import {
  controlerTextesCrees,
  empreinteDescription,
  entreePhraseActive,
  IMAGES_APERCU_MAX,
  lireApercu,
  pieceCreeeClaudeActive,
  PROPOSITIONS_PIECE_MAX,
  tableauDepuisDescription,
  textesDeLaMaquette,
  type ApercuPiece,
} from "@/moteurs/montage-tutoriel-outil/maquette-creee";

export const MESSAGE_FERME = "La création depuis une phrase n'est pas ouverte.";
export const NOM_FICHIER_APERCU = "apercu-piece.json";
/** 14 images + le fichier d'aperçu. */
export const FICHIERS_APERCU_MAX = IMAGES_APERCU_MAX + 1;

export type StatutPiece = "a-revoir" | "a-construire" | "a-valider" | "gardee" | "refusee";
export type GenrePiece = "maquette" | "flux";
export type CasPiece = "tableau-de-bord" | "automatisation";

/** Vue de l'écran sur la pièce créée de l'équipe (`PieceCreee`, V2-08) : une maquette ou un flux, y compris « à revoir ». */
export interface EtatPieceCreee {
  phrase: string;
  cas: CasPiece;
  /** 1 = première proposition, 2 = « l'autre proposition » (la dernière permise). */
  proposition: number;
  statut: StatutPiece;
  /** Absent = maquette (états d'avant). `flux` : `description` porte un `flux-automatisation.v1`. */
  genre?: GenrePiece;
  /** `description-maquette.v1` déjà relue (V2-02) ou `flux-automatisation.v1` (V2-06) : les textes sont ceux que Williams voit. */
  description: unknown;
  /** Raisons du « à revoir » (rangées avec la pièce, seulement tant qu'elle est « à revoir »). */
  erreurs?: string[];
  empreinte: string;
  apercu?: ApercuPiece;
  gardee?: { empreinte: string; le: string };
  /** Le travail doit repartir (rien de payant n'est lancé par ce service). */
  aRelancer?: boolean;
  /** PHRASE-1 : les appels permis au maquettiste sont tous faits (relu de l'équipe, jamais rangé) : plus d'autre proposition. */
  appelsEpuises?: true;
}

export interface DepotPiece {
  lire(videoId: string): Promise<EtatPieceCreee | null>;
  ecrire(videoId: string, etat: EtatPieceCreee): Promise<void>;
}

type LecteurReglage = <T>(id: string, defaut: T) => Promise<T>;

export interface DependancesPiece {
  reglage?: LecteurReglage;
  session?: () => Promise<unknown>;
  depot?: DepotPiece;
  /** Fichiers envoyés par la voie commune (`fichiersEnvoyes`). */
  fichiers?: (ids: unknown, videoId: string) => Promise<Fichier[]>;
  /** Contenu JSON d'un fichier envoyé. */
  lireJson?: (fichier: Fichier) => Promise<unknown>;
  urls?: (ids: string[]) => Promise<Record<string, string>>;
  /** Relance du travail de la vidéo (V2-08). Jamais un appel à Claude. */
  relancer?: (videoId: string) => Promise<void>;
  maintenant?: () => string;
  /** Noms non neutres refusés dans la description (`noms-neutres.json`, lus par l'appelant). */
  interdits?: readonly string[];
  /** Noms permis dans les textes créés (`ecrans-outils/noms.json`). */
  nomsPermis?: readonly string[];
  /** Lecteur des noms de la charte (par défaut : la copie sous `src/`). Qui échoue = noms illisibles. */
  noms?: () => Promise<{ interdits: string[]; permis: string[] }>;
}

export type IssuePiece = { ok: true; message: string; statut?: StatutPiece } | { ok: false; message: string };

export interface ApercuVue {
  url: string;
  ecranId: string;
  titre: string;
  etat: "avant" | "maintenant";
}

/** Une ligne du déroulé d'un flux : déclencheur, puis chaque action, puis le résultat. */
export interface EtapeFluxVue {
  id: string;
  nature: "declencheur" | "etape" | "resultat";
  /** Texte lisible de l'étape. */
  libelle: string;
  /** Qui agit (étapes seulement) : « L'automatisation », « L'IA » ou « Vous ». */
  acteur?: string;
  /** Écran du bureau exemple où cela se passe, en mots simples. */
  ecran: string;
}

export interface VuePieceCreee {
  phrase: string;
  cas: CasPiece;
  genre: GenrePiece;
  /** Le flux, lisible de bout en bout (vide pour une maquette). */
  etapes: EtapeFluxVue[];
  /** Phrase d'accueil quand la pièce est « à revoir » (sinon null). */
  message: string | null;
  empreinte: string;
  apercu: ApercuVue[];
  textes: { ecranId: string; titre: string; textes: string[] }[];
  chiffres: ChiffreARelire[];
  defauts: string[];
  propositionsRestantes: 0 | 1;
  /** PHRASE-1 : les deux essais de création sont faits alors que la proposition n° 1 est affichée (l'écran le dit, sans parler d'une « autre proposition » déjà demandée). */
  essaisEpuises?: true;
  statut: StatutPiece;
  /** Une autre proposition est demandée et pas encore arrivée : corriger et déposer sont fermés. */
  autreEnAttente: boolean;
  /** Les noms de la charte ne sont pas lisibles : la page reste lisible, rien ne peut être modifié. */
  nomsIllisibles: boolean;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const refus = (message: string): IssuePiece => ({ ok: false, message });
const unSeulBlocDeTexte = (t: unknown): string => (typeof t === "string" ? t.trim() : "");

/** Vrai SEULEMENT si les deux réglages valent exactement `true`. Lecture en échec : éteint. */
export async function creationDepuisPhraseOuverte(lire?: LecteurReglage): Promise<boolean> {
  try {
    const l = lire ?? (await import("./_commun")).lireParametre;
    return (await entreePhraseActive(l)) && (await pieceCreeeClaudeActive(l));
  } catch {
    return false;
  }
}

/*
 * Copie des noms de la charte pour l'image du studio : Dockerfile.dockerignore exclut le dossier d'outils, ces deux fichiers n'y
 * existent donc pas à l'exécution. Jamais un import d'un dossier exclu (image-autonome). Le test piece-creee-ecran.test.ts compare
 * ces deux constantes aux fichiers d'origine : toute différence le fait échouer.
 *  - outils/maquettes-tableaux-de-bord/charte/noms-neutres.json
 *  - outils/maquettes-tableaux-de-bord/ecrans-outils/noms.json
 */
export interface NomsMaquette {
  produit?: string;
  organisation?: string;
  vues?: Record<string, string>;
}
export interface FichierNoms {
  interdits: string[];
  maquettes: Record<string, NomsMaquette>;
}

export const NOMS_NEUTRES: FichierNoms = {
  "interdits": [
    "velora",
    "calyra",
    "sylva",
    "relayo",
    "noveria",
    "blueflow",
    "ordiva",
    "boreal",
    "maison alba",
    "feuille.",
    "orbis",
    "rivage"
  ],
  "maquettes": {
    "01-courriels": {
      "produit": "Espace démo · Courriels",
      "organisation": "Entreprise exemple"
    },
    "02-projets": {
      "produit": "Espace démo · Projets",
      "organisation": "Entreprise exemple"
    },
    "03-accueil-24h": {
      "produit": "Espace démo · Accueil 24 h",
      "organisation": "Entreprise exemple"
    },
    "04-clients": {
      "produit": "Espace démo · Clients",
      "organisation": "Entreprise exemple"
    },
    "05-stocks": {
      "produit": "Espace démo · Stocks",
      "organisation": "Entreprise exemple"
    },
    "06-equipe": {
      "produit": "Espace démo · Équipe",
      "organisation": "Entreprise exemple"
    },
    "07-taches": {
      "produit": "Espace démo · Connaissances",
      "organisation": "Entreprise exemple"
    }
  }
};

export const NOMS_ECRANS_OUTILS: FichierNoms = {
  "interdits": [
    "velora",
    "calyra",
    "sylva",
    "relayo",
    "noveria",
    "blueflow",
    "ordiva",
    "boreal",
    "maison alba",
    "feuille.",
    "orbis",
    "rivage"
  ],
  "maquettes": {
    "ecrans-outils": {
      "produit": "Espace démo · Boîte de réception",
      "organisation": "Entreprise exemple",
      "vues": {
        "boite": "Espace démo · Boîte de réception",
        "agenda": "Espace démo · Agenda",
        "tableur": "Espace démo · Tableur",
        "crm": "Espace démo · Clients",
        "messagerie": "Espace démo · Messages"
      }
    }
  }
};

/* Noms de la charte : copie ci-dessus (les fichiers d'`outils/` n'entrent pas dans l'image). Illisibles = refus (jamais « tout permis »). */
type NomsCharte = { interdits: string[]; permis: string[] };

async function nomsParDefaut(): Promise<NomsCharte> {
  const interdits = new Set<string>();
  const permis = new Set<string>();
  for (const j of [NOMS_NEUTRES, NOMS_ECRANS_OUTILS]) {
    for (const m of Array.isArray(j.interdits) ? j.interdits : []) if (typeof m === "string" && m.trim()) interdits.add(m);
    for (const m of Object.values(j.maquettes ?? {})) {
      for (const v of [m.produit, m.organisation, ...Object.values(m.vues ?? {})]) if (typeof v === "string" && v.trim()) permis.add(v);
    }
  }
  if (interdits.size === 0) throw new Error("noms-neutres vides");
  return { interdits: [...interdits], permis: [...permis] };
}

export /** Phrase d'accueil d'un flux « à revoir » (la phrase de `pas-piece-creee.ts` parle d'une maquette). */
const MESSAGE_FLUX_A_REVOIR = "L'automatisation proposée ne respecte pas les règles (détail sur l'écran) : vous pouvez en demander une autre. Rien n'a échoué.";
const MESSAGE_NOMS = "Les noms neutres de la charte ne sont pas lisibles : rien n'est modifié pour l'instant.";

/** Les listes données par l'appelant font foi ; sinon celles de la charte. `null` si elles sont illisibles. */
async function avecNoms(d: DependancesPiece): Promise<DependancesPiece | null> {
  if (d.interdits?.length && d.nomsPermis) return d;
  try {
    const n = await (d.noms ?? nomsParDefaut)();
    if (!n.interdits.length) return null;
    // Une liste `interdits` vide donnée par l'appelant ne vaut jamais « tout permis » : on retombe sur la charte.
    const interditsAppelant = d.interdits?.length ? d.interdits : undefined;
    return { ...d, interdits: interditsAppelant ?? n.interdits, nomsPermis: interditsAppelant ? (d.nomsPermis ?? n.permis) : n.permis };
  } catch {
    return null;
  }
}

/** Un seul geste à la fois par vidéo (dans ce processus) : lecture, contrôle puis écriture ne se mélangent pas. */
const verrous = new Map<string, Promise<unknown>>();
async function enFile<T>(videoId: string, f: () => Promise<T>): Promise<T> {
  const avant = verrous.get(videoId) ?? Promise.resolve();
  const courant = avant.then(f, f);
  const fin = courant.catch(() => undefined);
  verrous.set(videoId, fin);
  try {
    return await courant;
  } finally {
    if (verrous.get(videoId) === fin) verrous.delete(videoId);
  }
}

const AUTRE_EN_ATTENTE = "Une autre proposition se prépare : attendez-la.";
const autreEnAttente = (e: EtatPieceCreee) => e.aRelancer === true && e.proposition >= 2 && e.statut === "a-construire";

/** Ce que l'équipe range sous `parametres.tutoriel.equipe` (seuls les champs lus ici). */
interface EquipeRangee {
  pieceCreee?: PieceCreee;
  demande?: { phrase?: string };
  appels?: { maquettiste?: number };
}

/** Vue de l'écran depuis la pièce de l'équipe (maquette ou flux, « à revoir » compris). `null` : rien à voir (pas de pièce). Pure. */
export function etatEcranDepuisPiece(equipe: EquipeRangee | null | undefined): EtatPieceCreee | null {
  const p = equipe?.pieceCreee;
  if (!equipe || !p || typeof p !== "object" || (p.genre !== "maquette" && p.genre !== "flux")) return null;
  const proposition = p.proposition === 2 ? 2 : 1;
  const etat: EtatPieceCreee = {
    phrase: equipe.demande?.phrase ?? "",
    cas: p.genre === "flux" ? "automatisation" : "tableau-de-bord",
    genre: p.genre,
    proposition,
    statut: p.statut,
    description: p.contenu,
    empreinte: p.empreinte,
  };
  if (p.apercu) etat.apercu = p.apercu;
  if (p.gardee) etat.gardee = p.gardee;
  if (p.statut === "a-revoir" && Array.isArray(p.erreurs)) etat.erreurs = p.erreurs.filter((x): x is string => typeof x === "string");
  if (proposition === 2 && p.statut === "a-construire" && (equipe.appels?.maquettiste ?? 0) < PROPOSITIONS_PIECE_MAX) etat.aRelancer = true;
  if ((equipe.appels?.maquettiste ?? 0) >= PROPOSITIONS_PIECE_MAX) etat.appelsEpuises = true;
  return etat;
}

/** Pièce de l'équipe depuis la vue de l'écran (`aRelancer` n'est pas rangé : il se déduit). Pure. */
export function pieceDepuisEtatEcran(x: EtatPieceCreee): PieceCreee {
  const p: PieceCreee = {
    genre: x.genre === "flux" ? "flux" : "maquette",
    proposition: x.proposition === 2 ? 2 : 1,
    contenu: x.description as PieceCreee["contenu"],
    empreinte: x.empreinte,
    statut: x.statut,
  };
  if (x.statut === "a-revoir" && x.erreurs) p.erreurs = x.erreurs;
  if (x.apercu) p.apercu = x.apercu;
  if (x.gardee) p.gardee = x.gardee;
  return p;
}

async function depotParDefaut(): Promise<DepotPiece> {
  const { depots } = await import("./_commun");
  const travailDe = async (videoId: string) => {
    const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
    return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
  };
  const tutorielDe = (parametres: Record<string, unknown> | undefined) => {
    const t = parametres?.tutoriel;
    return t && typeof t === "object" ? (t as Record<string, unknown>) : null;
  };
  const equipeDe = (parametres: Record<string, unknown> | undefined) => {
    const e = tutorielDe(parametres)?.equipe;
    return e && typeof e === "object" ? (e as Record<string, unknown> & EquipeRangee) : null;
  };
  return {
    async lire(videoId) {
      return etatEcranDepuisPiece(equipeDe((await travailDe(videoId))?.parametres));
    },
    async ecrire(videoId, etat) {
      const t = await travailDe(videoId);
      const equipe = equipeDe(t?.parametres);
      if (!t || !equipe) return;
      await depots().travaux.modifier(t.id, {
        parametres: { ...t.parametres, tutoriel: { ...tutorielDe(t.parametres), equipe: { ...equipe, pieceCreee: pieceDepuisEtatEcran(etat) } } },
      });
    },
  };
}

async function sessionOk(d: DependancesPiece): Promise<void> {
  await (d.session ?? (await import("./auth")).exigerSession)();
}

async function deposDe(d: DependancesPiece): Promise<DepotPiece> {
  return d.depot ?? (await depotParDefaut());
}

/** Ouvre un geste : session, puis les deux réglages. `null` si tout est permis. */
async function ouvrir(d: DependancesPiece): Promise<IssuePiece | null> {
  await sessionOk(d);
  return (await creationDepuisPhraseOuverte(d.reglage)) ? null : refus(MESSAGE_FERME);
}

function descriptionDe(etat: EtatPieceCreee, d: DependancesPiece): DescriptionMaquette | null {
  const r = lireDescriptionMaquette(etat.description, { interdits: d.interdits ?? [] });
  return r.ok ? r.description : null;
}

const estFlux = (etat: EtatPieceCreee): boolean => etat.genre === "flux";

function fluxDe(etat: EtatPieceCreee): FluxAutomatisation | null {
  const r = lireFluxAutomatisation(etat.description);
  return r.ok ? r.flux : null;
}

const NOM_VUE: Record<VueEcran, string> = { boite: "Boîte de réception", agenda: "Agenda", tableur: "Tableur", crm: "Clients", messagerie: "Messages" };
const NOM_ACTEUR: Record<ActeurFlux, string> = { automatisation: "L'automatisation", ia: "L'IA", humain: "Vous" };

/** Le flux dans l'ordre où il se déroule : déclencheur, chaque action, résultat. Aucune phrase inventée : seuls les textes du flux et des mots fixes. */
function etapesDuFlux(f: FluxAutomatisation): EtapeFluxVue[] {
  const parId = new Map(textesDuFlux(f).map((t) => [t.etapeId, t.textes.join(" · ")]));
  return [
    { id: "declencheur", nature: "declencheur", libelle: parId.get("declencheur") || "Ce qui déclenche l'automatisation", ecran: NOM_VUE[f.declencheur.vue] },
    ...f.etapes.map((e) => ({ id: e.id, nature: "etape" as const, libelle: e.libelleSchema, acteur: NOM_ACTEUR[e.acteur], ecran: NOM_VUE[e.vue] })),
    { id: "resultat", nature: "resultat", libelle: parId.get("resultat") || "Ce que vous obtenez", ecran: NOM_VUE[f.resultat.vue] },
  ];
}

const maintenant = (d: DependancesPiece) => (d.maintenant ?? (() => new Date().toISOString()))();

function sansAperceu(etat: EtatPieceCreee): EtatPieceCreee {
  const copie = { ...etat };
  delete copie.apercu;
  delete copie.gardee;
  return copie;
}

/** Remplace la description : nouvelle empreinte, nouvel aperçu à faire (poste, 0 €), plus rien de gardé. */
function avecDescription(etat: EtatPieceCreee, description: DescriptionMaquette): EtatPieceCreee {
  return { ...sansAperceu(etat), description, empreinte: empreinteDescription(description), statut: "a-construire", aRelancer: false };
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Ce que l'écran montre, ou `null` (« Rien à voir pour l'instant »). Session exigée ; lecture seule, rien n'est écrit. */
export async function vuePieceCreee(videoId: string, d: DependancesPiece = {}): Promise<VuePieceCreee | null> {
  await sessionOk(d);
  const avec = await avecNoms(d);
  const nomsIllisibles = avec === null;
  if (avec) d = avec;
  const etat = await (await deposDe(d)).lire(videoId);
  if (!etat) return null;
  const flux = estFlux(etat);
  const description = flux ? null : descriptionDe(etat, d);
  const fluxLu = flux ? fluxDe(etat) : null;
  // Une pièce illisible ne se montre que « à revoir » (avec ses raisons) ou pendant l'attente d'une autre proposition.
  if (!description && !fluxLu && etat.statut !== "a-revoir" && !autreEnAttente(etat)) return null;
  const titres = new Map<string, string>(description ? description.ecrans.map((e) => [e.id, e.titre]) : []);
  if (fluxLu) {
    titres.set("avant", "Avant");
    titres.set("declencheur", "Déclencheur");
    titres.set("resultat", "Résultat");
    for (const e of fluxLu.etapes) titres.set(e.id, e.libelleSchema);
  }
  // Plus aucune proposition possible (reprise ou proposition n° 2 épuisée) : la vue ne dit plus « vous pouvez en demander une autre ».
  const plusDAutre = etat.proposition >= PROPOSITIONS_PIECE_MAX || etat.appelsEpuises === true;
  const ids = (etat.apercu?.images ?? []).map((i) => i.cle);
  const urls = ids.length ? await (d.urls ?? (await import("./fichiers")).urlsFichiers)(ids) : {};
  const tableau = description ? tableauDepuisDescription(description, maintenant(d).slice(0, 10)) : null;
  const defautsPiece = description ? controlerTextesCrees(description, d.nomsPermis ?? []) : fluxLu ? controlerFluxCree(fluxLu, d.nomsPermis ?? []) : [];
  const defauts = [...(etat.apercu?.controle.defauts ?? []), ...defautsPiece, ...(etat.statut === "a-revoir" ? (etat.erreurs ?? []) : []), ...(nomsIllisibles ? [MESSAGE_NOMS] : [])];
  const textes = description ? textesDeLaMaquette(description) : fluxLu ? textesDuFlux(fluxLu).map((t) => ({ ecranId: t.etapeId, textes: t.textes })) : [];
  return {
    phrase: etat.phrase,
    cas: etat.cas,
    genre: flux ? "flux" : "maquette",
    etapes: fluxLu ? etapesDuFlux(fluxLu) : [],
    message: etat.statut === "a-revoir" ? (plusDAutre ? (flux ? MESSAGE_PLUS_DE_PROPOSITION_FLUX : MESSAGE_PLUS_DE_PROPOSITION) : flux ? MESSAGE_FLUX_A_REVOIR : MESSAGE_PIECE_A_REVOIR) : null,
    empreinte: etat.empreinte,
    apercu: (etat.apercu?.images ?? []).flatMap((i) => (urls[i.cle] ? [{ url: urls[i.cle]!, ecranId: i.ecranId, titre: titres.get(i.ecranId) ?? i.ecranId, etat: i.etat }] : [])),
    textes: textes.map((t) => ({ ...t, titre: titres.get(t.ecranId) ?? t.ecranId })),
    chiffres: tableau?.ok ? chiffresARelire(tableau.donnee).filter((c) => c.cle.startsWith("indicateur:")) : [],
    defauts: [...new Set(defauts)],
    propositionsRestantes: plusDAutre ? 0 : 1,
    ...(etat.proposition < PROPOSITIONS_PIECE_MAX && etat.appelsEpuises === true ? { essaisEpuises: true as const } : {}),
    statut: etat.statut,
    autreEnAttente: autreEnAttente(etat),
    nomsIllisibles,
  };
}

/* ------------------------------------------------------------------ */
/* Dépôt de l'aperçu                                                   */
/* ------------------------------------------------------------------ */

const nomDeFichier = (cle: string) => cle.split(/[\\/]/).pop() ?? cle;

/** Dépôt de l'aperçu fabriqué sur le poste : `apercu-piece.json` + les images. Refus si l'empreinte n'est pas celle de la pièce. */
export function enregistrerApercu(videoId: string, ids: unknown, d: DependancesPiece = {}): Promise<IssuePiece> {
  return enFile(videoId, () => enregistrerApercuSeul(videoId, ids, d));
}

async function enregistrerApercuSeul(videoId: string, ids: unknown, d: DependancesPiece): Promise<IssuePiece> {
  const ferme = await ouvrir(d);
  if (ferme) return ferme;
  const avec = await avecNoms(d);
  if (!avec) return refus(MESSAGE_NOMS);
  d = avec;
  const depot = await deposDe(d);
  const etat = await depot.lire(videoId);
  if (!etat) return refus("Il n'y a pas de maquette pour cette vidéo.");
  if (etat.statut !== "a-construire") return refus("Aucun aperçu n'est attendu pour cette maquette.");
  if (autreEnAttente(etat)) return refus(AUTRE_EN_ATTENTE);
  if (!Array.isArray(ids) || ids.length === 0) return refus("Choisissez au moins un fichier.");
  if (ids.length > FICHIERS_APERCU_MAX) return refus(`Trop de fichiers : ${IMAGES_APERCU_MAX} images et l'aperçu au plus.`);
  const lesFichiers = d.fichiers ?? (async (liste: unknown, id: string) => (await import("./fichiers")).fichiersEnvoyes(liste, "entree", id, FICHIERS_APERCU_MAX));
  const fichiers = await lesFichiers(ids, videoId);
  const json = fichiers.find((f) => f.nom === NOM_FICHIER_APERCU);
  if (!json) return refus(`Le fichier « ${NOM_FICHIER_APERCU} » manque.`);
  const lecteur = d.lireJson ?? (async (f: Fichier) => {
    const { urlFichier } = await import("./fichiers");
    const url = await urlFichier(f.id);
    if (!url) throw new Error("illisible");
    return (await fetch(url)).json();
  });
  let brut: unknown;
  try {
    brut = await lecteur(json);
  } catch {
    return refus("L'aperçu est illisible.");
  }
  const lu = lireApercu(brut);
  if (!lu.ok) return refus(lu.erreurs[0] ?? "L'aperçu est illisible.");
  if (lu.apercu.empreinteDescription !== etat.empreinte) return refus("Cet aperçu ne correspond pas à la maquette proposée");
  const parNom = new Map(fichiers.filter((f) => f.id !== json.id).map((f) => [f.nom, f.id]));
  const images: ApercuPiece["images"] = [];
  for (const im of lu.apercu.images) {
    const id = parNom.get(nomDeFichier(im.cle));
    if (!id) return refus(`L'image « ${nomDeFichier(im.cle)} » n'a pas été envoyée.`);
    images.push({ ...im, cle: id });
  }
  await depot.ecrire(videoId, { ...etat, apercu: { ...lu.apercu, images }, statut: "a-valider" });
  return { ok: true, message: "L'aperçu est prêt : relisez chaque texte.", statut: "a-valider" };
}

/* ------------------------------------------------------------------ */
/* Garder (avec la relecture des chiffres)                             */
/* ------------------------------------------------------------------ */

/** Les données chiffrées de la description, dans l'ordre où `tableauDepuisDescription` les range (clé de décision → donnée). */
function donneesChiffrees(d: DescriptionMaquette, tableau: TableauDeBord): Map<string, { zoneId: string; donnee: DonneeExemple; rang: number }> {
  const ids = new Set(tableau.indicateurs.map((i) => i.id));
  const sortie = new Map<string, { zoneId: string; donnee: DonneeExemple; rang: number }>();
  const pris = new Set<string>();
  for (const z of d.ecrans.flatMap((e) => e.zones)) {
    let rang = 0;
    for (const x of z.donnees) {
      const candidats = [x.id, ...Array.from({ length: 12 }, (_, k) => `${x.id.slice(0, 36)}-${k + 2}`)];
      const id = candidats.find((c) => ids.has(c) && !pris.has(c));
      if (!id) continue;
      pris.add(id);
      sortie.set(`indicateur:${id}`, { zoneId: z.id, donnee: x, rang: rang++ });
    }
  }
  return sortie;
}

function chiffreRemplace(x: DonneeExemple, valeur: number): string | number {
  if (typeof x.valeur === "number") return valeur;
  const premier = nombresAffirmes(x.valeur)[0];
  return premier ? x.valeur.replace(premier.brut, String(valeur).replace(".", ",")) : x.valeur;
}

/** Applique les décisions de Williams sur la description (valeurs reportées ; un chiffre refusé retire la donnée). */
function appliquerChiffres(d: DescriptionMaquette, decisions: Record<string, DecisionChiffre>, aujourdHui: string): { ok: true; description: DescriptionMaquette } | { ok: false; message: string } {
  const tableau = tableauDepuisDescription(d, aujourdHui);
  if (!tableau.ok) return { ok: false, message: "Les chiffres de la maquette ne se relisent pas : " + (tableau.erreurs[0] ?? "illisibles.") };
  const liees = donneesChiffrees(d, tableau.donnee);
  const complet: Record<string, DecisionChiffre> = {};
  for (const c of chiffresARelire(tableau.donnee)) {
    const cleIndicateur = c.cle.startsWith("point:") ? [...liees].find(([, v]) => `point:${v.zoneId}:${v.rang}` === c.cle)?.[0] : c.cle;
    complet[c.cle] = (cleIndicateur ? decisions[cleIndicateur] : undefined) ?? { type: "valide" };
  }
  const r = appliquerRelecture(tableau.donnee, complet);
  if (!r.ok) return { ok: false, message: r.raisons[0] ?? "Les chiffres ne sont pas relus." };
  const copie = structuredClone(d);
  const retirees = new Set<string>();
  for (const [cle, { donnee }] of liees) {
    const dec = decisions[cle];
    if (!dec || dec.type === "valide") continue;
    if (dec.type === "refuse") retirees.add(donnee.id);
    else if (typeof dec.valeur === "number" && Number.isFinite(dec.valeur)) {
      const cible = copie.ecrans.flatMap((e) => e.zones.flatMap((z) => z.donnees)).find((x) => x.id === donnee.id);
      if (cible) cible.valeur = chiffreRemplace(cible, dec.valeur);
    } else return { ok: false, message: `La correction de « ${donnee.libelle} » n'est pas un nombre.` };
  }
  for (const e of copie.ecrans) for (const z of e.zones) z.donnees = z.donnees.filter((x) => !retirees.has(x.id));
  return { ok: true, description: copie };
}

export interface DemandeGarder {
  empreinte: string;
  chiffres?: Record<string, DecisionChiffre>;
}

/** « Garder cette maquette » : fige l'empreinte et les textes. Si un chiffre change, la description change : nouvel aperçu (0 €). */
export function garderPiece(videoId: string, demande: DemandeGarder, d: DependancesPiece = {}): Promise<IssuePiece> {
  return enFile(videoId, () => garderPieceSeul(videoId, demande, d));
}

async function garderPieceSeul(videoId: string, demande: DemandeGarder, d: DependancesPiece): Promise<IssuePiece> {
  const ferme = await ouvrir(d);
  if (ferme) return ferme;
  const avec = await avecNoms(d);
  if (!avec) return refus(MESSAGE_NOMS);
  d = avec;
  const depot = await deposDe(d);
  const etat = await depot.lire(videoId);
  if (!etat) return refus("Il n'y a pas de maquette pour cette vidéo.");
  if (etat.statut === "a-revoir") return refus("Cette proposition est à revoir : demandez-en une autre.");
  if (etat.statut !== "a-valider" || !etat.apercu) return refus("Il n'y a pas encore d'aperçu à garder.");
  if (unSeulBlocDeTexte(demande?.empreinte) !== etat.empreinte || etat.apercu.empreinteDescription !== etat.empreinte) {
    return refus("Cette maquette a changé depuis que vous l'avez ouverte. Rechargez la page pour la revoir.");
  }
  if (!etat.apercu.controle.ok) return refus(etat.proposition >= PROPOSITIONS_PIECE_MAX || etat.appelsEpuises === true ? "L'aperçu a des défauts : corrigez les textes concernés ou arrêtez cette demande." : "L'aperçu a des défauts : corrigez les textes concernés ou demandez une autre proposition.");
  if (estFlux(etat)) {
    // Un flux ne montre aucun chiffre : seul l'aperçu et le contrôle des textes comptent. Les décisions de chiffres sont ignorées.
    const flux = fluxDe(etat);
    if (!flux) return refus("Le flux de l'automatisation est illisible.");
    const defaut = controlerFluxCree(flux, d.nomsPermis ?? [])[0];
    if (defaut) return refus(`Cette automatisation a des points à revoir : ${defaut}`);
    if (empreinteFlux(flux) !== etat.empreinte) return refus("Cette automatisation a changé depuis que vous l'avez ouverte. Rechargez la page pour la revoir.");
    await depot.ecrire(videoId, { ...etat, statut: "gardee", gardee: { empreinte: etat.empreinte, le: maintenant(d) }, aRelancer: true });
    await d.relancer?.(videoId);
    return { ok: true, message: "Automatisation gardée. La fabrication de votre vidéo peut continuer.", statut: "gardee" };
  }
  const description = descriptionDe(etat, d);
  if (!description) return refus("La description de la maquette est illisible.");
  const decisions = demande.chiffres && typeof demande.chiffres === "object" ? demande.chiffres : {};
  let finale = description;
  if (Object.keys(decisions).length > 0) {
    const a = appliquerChiffres(description, decisions, maintenant(d).slice(0, 10));
    if (!a.ok) return refus(a.message);
    const relue = lireDescriptionMaquette(a.description, { interdits: d.interdits ?? [] });
    if (!relue.ok) return refus(`Ces chiffres ne tiennent pas dans la maquette : ${relue.erreurs[0] ?? "refusé."}`);
    finale = relue.description;
  }
  if (empreinteDescription(finale) !== etat.empreinte) {
    await depot.ecrire(videoId, avecDescription(etat, finale));
    return { ok: true, message: "Vos chiffres sont pris en compte : un nouvel aperçu se prépare. Rien n'est filmé avant que vous gardiez la maquette.", statut: "a-construire" };
  }
  await depot.ecrire(videoId, { ...etat, statut: "gardee", gardee: { empreinte: etat.empreinte, le: maintenant(d) }, aRelancer: true });
  await d.relancer?.(videoId);
  return { ok: true, message: "Maquette gardée. La fabrication de votre vidéo peut continuer.", statut: "gardee" };
}

/* ------------------------------------------------------------------ */
/* Corriger un texte                                                   */
/* ------------------------------------------------------------------ */

export interface DemandeCorrection {
  ecranId: string;
  avant: string;
  apres: string;
}

function remplacerTexte(d: DescriptionMaquette, avant: string, apres: string): { description: DescriptionMaquette; n: number } {
  const copie = structuredClone(d);
  let n = 0;
  const sub = (t: string) => (t === avant ? (n++, apres) : t);
  for (const e of copie.ecrans) {
    e.titre = sub(e.titre);
    for (const z of e.zones) {
      z.libelle = sub(z.libelle);
      for (const x of z.donnees) {
        x.libelle = sub(x.libelle);
        if (typeof x.valeur === "string") x.valeur = sub(x.valeur);
      }
    }
  }
  copie.etats = { avant: sub(copie.etats.avant), maintenant: sub(copie.etats.maintenant) };
  return { description: copie, n };
}

/** « Corriger un texte » : le texte de Williams fait foi, mis tel quel (jamais repassé par Claude). 0 € : seulement un nouvel aperçu. */
export function corrigerTexte(videoId: string, demande: DemandeCorrection, d: DependancesPiece = {}): Promise<IssuePiece> {
  return enFile(videoId, () => corrigerTexteSeul(videoId, demande, d));
}

async function corrigerTexteSeul(videoId: string, demande: DemandeCorrection, d: DependancesPiece): Promise<IssuePiece> {
  const ferme = await ouvrir(d);
  if (ferme) return ferme;
  const avec = await avecNoms(d);
  if (!avec) return refus(MESSAGE_NOMS);
  d = avec;
  const depot = await deposDe(d);
  const etat = await depot.lire(videoId);
  if (!etat) return refus("Il n'y a pas de maquette pour cette vidéo.");
  if (etat.statut === "gardee" || etat.statut === "refusee") return refus("Cette maquette n'est plus modifiable.");
  if (etat.statut === "a-revoir") return refus("Cette proposition est à revoir : demandez-en une autre.");
  if (estFlux(etat)) return refus("Les textes d'une automatisation ne se corrigent pas ici : demandez une autre proposition.");
  if (autreEnAttente(etat)) return refus(AUTRE_EN_ATTENTE);
  const avant = unSeulBlocDeTexte(demande?.avant);
  const apres = unSeulBlocDeTexte(demande?.apres);
  if (!avant || !apres) return refus("Écrivez le texte à mettre à la place.");
  if (avant === apres) return refus("Ce texte est déjà celui de la maquette.");
  const description = descriptionDe(etat, d);
  if (!description) return refus("La description de la maquette est illisible.");
  const visible = textesDeLaMaquette(description).find((t) => t.ecranId === demande.ecranId)?.textes ?? [];
  if (!visible.includes(avant)) return refus("Ce texte n'est plus dans la maquette. Rechargez la page.");
  const { description: neuve, n } = remplacerTexte(description, avant, apres);
  if (n === 0) return refus("Ce texte est imposé (nom de la maquette) ou se corrige dans la liste des chiffres.");
  const relue = lireDescriptionMaquette(neuve, { interdits: d.interdits ?? [] });
  if (!relue.ok) return refus(`« ${apres} » : ${relue.erreurs[0] ?? "texte refusé."}`);
  const defaut = controlerTextesCrees(relue.description, d.nomsPermis ?? []).find((e) => e.startsWith(`« ${apres} »`));
  if (defaut) return refus(defaut);
  await depot.ecrire(videoId, avecDescription(etat, relue.description));
  return { ok: true, message: "Votre texte est repris tel quel. Un nouvel aperçu se prépare.", statut: "a-construire" };
}

/* ------------------------------------------------------------------ */
/* Une autre proposition, arrêter                                      */
/* ------------------------------------------------------------------ */

/** « En proposer une autre » : une seule fois par vidéo. Ne fait que noter la demande et relancer le travail : cette fonction n'appelle jamais Claude. */
export function autreProposition(videoId: string, d: DependancesPiece = {}): Promise<IssuePiece> {
  return enFile(videoId, () => autrePropositionSeul(videoId, d));
}

async function autrePropositionSeul(videoId: string, d: DependancesPiece): Promise<IssuePiece> {
  const ferme = await ouvrir(d);
  if (ferme) return ferme;
  const depot = await deposDe(d);
  const etat = await depot.lire(videoId);
  if (!etat) return refus("Il n'y a pas de maquette pour cette vidéo.");
  if (etat.proposition >= PROPOSITIONS_PIECE_MAX) return refus("Vous avez déjà demandé une autre proposition");
  if (etat.statut === "gardee" || etat.statut === "refusee") return refus("Cette maquette n'est plus modifiable.");
  if (etat.appelsEpuises === true) {
    // Une maquette « à revoir » ne se garde ni ne se corrige : il ne reste qu'à arrêter.
    return refus(etat.statut === "a-revoir" ? "Les deux essais de cette maquette sont faits : il n'y a plus d'autre proposition possible. Il ne reste qu'à arrêter, puis reformuler votre phrase." : "Les deux essais de cette maquette sont faits : il n'y a plus d'autre proposition possible. Gardez-la, corrigez un texte ou arrêtez.");
  }
  await depot.ecrire(videoId, { ...sansAperceu(etat), proposition: 2, statut: "a-construire", aRelancer: true });
  await d.relancer?.(videoId);
  return { ok: true, message: "Une autre proposition se prépare. Vous la verrez ici, mot pour mot, avant toute fabrication.", statut: "a-construire" };
}

/** « Arrêter » : la maquette est refusée, rien n'est fabriqué. */
export function arreter(videoId: string, d: DependancesPiece = {}): Promise<IssuePiece> {
  return enFile(videoId, () => arreterSeul(videoId, d));
}

async function arreterSeul(videoId: string, d: DependancesPiece): Promise<IssuePiece> {
  const ferme = await ouvrir(d);
  if (ferme) return ferme;
  const depot = await deposDe(d);
  const etat = await depot.lire(videoId);
  if (!etat) return refus("Il n'y a pas de maquette pour cette vidéo.");
  if (etat.statut === "gardee") return refus("Cette maquette est déjà gardée.");
  await depot.ecrire(videoId, { ...etat, statut: "refusee", aRelancer: false });
  return { ok: true, message: "C'est arrêté. Rien n'a été fabriqué. Reformulez votre phrase pour recommencer.", statut: "refusee" };
}
