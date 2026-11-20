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
 *
 * POUR V2-08 : le verrou `enFile` ne vaut que dans UN SEUL processus Studio. La garantie « une seule relance payée » repose donc
 * sur un seul serveur ; avec plusieurs processus, il faudra une écriture conditionnelle (comparaison avant écriture) sur l'état.
 * Le vrai appel payant de la 2e proposition passera par `payerUneFois` (clé : vidéo + proposition 2), plafond vérifié avant l'appel.
 *
 * // en attendant V2-08 : l'état « pièce créée » de l'équipe n'est pas encore sur master. Interface minimale `EtatPieceCreee`,
 * rangée dans `parametres.pieceCreee` du travail de fabrication de la vidéo, derrière le dépôt injectable `DepotPiece`.
 * V2-08 remplacera `depotParDefaut` par `EtatEquipe.pieceCreee` ; les gestes ci-dessous ne changent pas.
 */
import "server-only";
import { appliquerRelecture, chiffresARelire, type ChiffreARelire, type DecisionChiffre } from "@/briques/donnees-video/relecture-chiffres";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import { nombresAffirmes } from "@/domaine/nombres-fr";
import type { Fichier } from "@/domaine/types";
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

export type StatutPiece = "a-construire" | "a-valider" | "gardee" | "refusee";
export type CasPiece = "tableau-de-bord" | "automatisation";

/** en attendant V2-08 : forme minimale de `EtatEquipe.pieceCreee`. */
export interface EtatPieceCreee {
  phrase: string;
  cas: CasPiece;
  /** 1 = première proposition, 2 = « l'autre proposition » (la dernière permise). */
  proposition: number;
  statut: StatutPiece;
  /** Description `description-maquette.v1` déjà relue (V2-02) : les textes sont ceux que Williams voit. */
  description: unknown;
  empreinte: string;
  apercu?: ApercuPiece;
  gardee?: { empreinte: string; le: string };
  /** Le travail doit repartir (rien de payant n'est lancé par ce service). */
  aRelancer?: boolean;
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

export interface VuePieceCreee {
  phrase: string;
  cas: CasPiece;
  empreinte: string;
  apercu: ApercuVue[];
  textes: { ecranId: string; titre: string; textes: string[] }[];
  chiffres: ChiffreARelire[];
  defauts: string[];
  propositionsRestantes: 0 | 1;
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

export const MESSAGE_NOMS = "Les noms neutres de la charte ne sont pas lisibles : rien n'est modifié pour l'instant.";

/** Les listes données par l'appelant font foi ; sinon celles de la charte. `null` si elles sont illisibles. */
async function avecNoms(d: DependancesPiece): Promise<DependancesPiece | null> {
  if (d.interdits?.length && d.nomsPermis) return d;
  try {
    const n = await (d.noms ?? nomsParDefaut)();
    if (!n.interdits.length) return null;
    return { ...d, interdits: d.interdits ?? n.interdits, nomsPermis: d.nomsPermis ?? n.permis };
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

async function depotParDefaut(): Promise<DepotPiece> {
  const { depots } = await import("./_commun");
  const travailDe = async (videoId: string) => {
    const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
    return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
  };
  return {
    async lire(videoId) {
      const brut = (await travailDe(videoId))?.parametres?.pieceCreee;
      return brut && typeof brut === "object" ? (brut as EtatPieceCreee) : null;
    },
    async ecrire(videoId, etat) {
      const t = await travailDe(videoId);
      if (!t) return;
      await depots().travaux.modifier(t.id, { parametres: { ...(t.parametres ?? {}), pieceCreee: etat } });
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
  const description = descriptionDe(etat, d);
  if (!description) return null;
  const titres = new Map(description.ecrans.map((e) => [e.id, e.titre]));
  const ids = (etat.apercu?.images ?? []).map((i) => i.cle);
  const urls = ids.length ? await (d.urls ?? (await import("./fichiers")).urlsFichiers)(ids) : {};
  const tableau = tableauDepuisDescription(description, maintenant(d).slice(0, 10));
  const defauts = [...(etat.apercu?.controle.defauts ?? []), ...controlerTextesCrees(description, d.nomsPermis ?? []), ...(nomsIllisibles ? [MESSAGE_NOMS] : [])];
  return {
    phrase: etat.phrase,
    cas: etat.cas,
    empreinte: etat.empreinte,
    apercu: (etat.apercu?.images ?? []).flatMap((i) => (urls[i.cle] ? [{ url: urls[i.cle]!, ecranId: i.ecranId, titre: titres.get(i.ecranId) ?? i.ecranId, etat: i.etat }] : [])),
    textes: textesDeLaMaquette(description).map((t) => ({ ...t, titre: titres.get(t.ecranId) ?? t.ecranId })),
    chiffres: tableau.ok ? chiffresARelire(tableau.donnee).filter((c) => c.cle.startsWith("indicateur:")) : [],
    defauts: [...new Set(defauts)],
    propositionsRestantes: etat.proposition >= PROPOSITIONS_PIECE_MAX ? 0 : 1,
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
  if (etat.statut !== "a-valider" || !etat.apercu) return refus("Il n'y a pas encore d'aperçu à garder.");
  if (unSeulBlocDeTexte(demande?.empreinte) !== etat.empreinte || etat.apercu.empreinteDescription !== etat.empreinte) {
    return refus("Cette maquette a changé depuis que vous l'avez ouverte. Rechargez la page pour la revoir.");
  }
  if (!etat.apercu.controle.ok) return refus("L'aperçu a des défauts : corrigez les textes concernés ou demandez une autre proposition.");
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
