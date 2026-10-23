/**
 * EMPREINTES DES FICHIERS D'ENTRÉE (anti-doublon de sujets) — calcule le SHA-256 d'une image (image→vidéo) ou d'une
 * prise (face caméra animée) déjà déposée, et l'inscrit sur la fiche `Fichier` (champ JSON `sha256`, aucune migration).
 * Le registre des sujets traités relit `f.sha256` : une copie renommée du même fichier devient reconnaissable.
 * Lecture en continu côté stockage (mémoire constante), deux lectures R2 à la fois au plus par processus (les dépôts passent
 * avant le travail de fond) ; jamais sous `sousVerrou` pendant la lecture (un fichier de 15 Go y bloquerait tout) : seule
 * l'écriture finale y passe.
 *
 * NE JAMAIS appeler `assurerEmpreinte`, `rattraperEmpreintesEntrees`, `attendreRattrapage`, `empreinteDuFichier` ni
 * `empreinteAvantControle` depuis un code qui tient déjà `sousVerrou` : l'écriture finale reprend ce verrou, qui n'est pas
 * réentrant (interblocage garanti).
 */
import "server-only";
import type { Fichier } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import { depots, fournisseur, sousVerrou } from "./_commun";

/** Clés des dossiers d'entrée dont l'empreinte sert à reconnaître un sujet déjà traité. */
const CLE_ENTREE_CONTROLEE = /^studio\/(dev|prod)\/entree\/(image-video|facecam-animee)\//;

/** Lectures R2 simultanées au plus, pour tout le processus. */
const LECTURES_MAX = 2;
/** Fichiers traités au plus par appel du rattrapage (le reste au prochain appel). */
export const RATTRAPAGE_MAX = 50;

export function estEntreeControlee(cle: string): boolean {
  return typeof cle === "string" && CLE_ENTREE_CONTROLEE.test(cle);
}

/** Dossier d'entrée contrôlé d'une clé de stockage, ou undefined. */
export type DossierEntree = "image-video" | "facecam-animee";
export function dossierEntree(cle: string): DossierEntree | undefined {
  return (typeof cle === "string" ? CLE_ENTREE_CONTROLEE.exec(cle)?.[2] : undefined) as DossierEntree | undefined;
}

type Depots = ReturnType<typeof depots>;
export interface DependancesEmpreinte {
  stockage?: StockageFichiers;
  depot?: Depots;
  /** Travail de fond (rattrapage, calcul après envoi) : passe après les dépôts dans la file des lectures. */
  fond?: boolean;
}

const cleEnCours = Symbol.for("studio-axion-ia.empreintes-en-cours");
const cleRattrapage = Symbol.for("studio-axion-ia.empreintes-rattrapage");
const cleFile = Symbol.for("studio-axion-ia.empreintes-file");

type CleRattrapage = DossierEntree | "tous";
interface EtatRattrapage {
  fait: boolean;
  enCours?: Promise<void>;
  /** La promesse `enCours` pour laquelle le délai d'attente d'un contrôle est déjà dépassé : on ne l'attend plus. */
  depasseSur?: Promise<void>;
}
interface EtatsRattrapage {
  etats: Map<CleRattrapage, EtatRattrapage>;
  /** Fichiers en échec définitif : jamais relus dans ce processus. */
  definitifs: Set<string>;
}
interface Attente {
  fond: boolean;
  ok: () => void;
}
/** Un calcul d'empreinte en cours pour un fichier : sa promesse, son éventuelle place dans la file, et s'il a été « promu » par un dépôt. */
interface Calcul {
  promesse?: Promise<Fichier>;
  attente?: Attente;
  promu: boolean;
}
interface EtatFile {
  prio: number;
  fond: number;
  attente: Attente[];
}
type Global = typeof globalThis & { [cleEnCours]?: Map<string, Calcul>; [cleRattrapage]?: EtatsRattrapage; [cleFile]?: EtatFile };

const tousLesEtats = (): EtatsRattrapage => ((globalThis as Global)[cleRattrapage] ??= { etats: new Map(), definitifs: new Set() });
const etatRattrapage = (cle: CleRattrapage = "tous"): EtatRattrapage => {
  const t = tousLesEtats();
  let e = t.etats.get(cle);
  if (!e) t.etats.set(cle, (e = { fait: false }));
  return e;
};

/**
 * File des lectures R2 du processus : `LECTURES_MAX` à la fois au plus ; les dépôts passent AVANT le travail de fond, et le
 * travail de fond n'occupe jamais la dernière place : un petit dépôt d'image n'est pas affamé par le rattrapage.
 */
async function dansLaFile<T>(f: () => Promise<T>, fond: boolean, calcul: Calcul): Promise<T> {
  const file = ((globalThis as Global)[cleFile] ??= { prio: 0, fond: 0, attente: [] });
  const entree: Attente = { fond: fond && !calcul.promu, ok: () => undefined };
  await new Promise<void>((ok) => {
    entree.ok = ok;
    calcul.attente = entree;
    file.attente.push(entree);
    distribuer(file);
  });
  try {
    return await f();
  } finally {
    if (entree.fond) file.fond--;
    else file.prio--;
    calcul.attente = undefined;
    distribuer(file);
  }
}

/**
 * Un dépôt a besoin d'un calcul lancé en fond : si sa place est encore dans la file, elle devient prioritaire (le dépôt d'une
 * petite image n'attend pas derrière la lecture d'une prise de 15 Go). Déjà en lecture : rien à faire, elle avance déjà.
 */
function promouvoir(calcul: Calcul): void {
  calcul.promu = true;
  const file = (globalThis as Global)[cleFile];
  const e = calcul.attente;
  if (file && e && e.fond && file.attente.includes(e)) {
    e.fond = false;
    distribuer(file);
  }
}

function distribuer(file: EtatFile): void {
  for (;;) {
    const libre = file.prio + file.fond < LECTURES_MAX;
    let i = libre ? file.attente.findIndex((w) => !w.fond) : -1;
    if (i < 0 && libre && file.fond < LECTURES_MAX - 1) i = file.attente.findIndex((w) => w.fond);
    if (i < 0) return;
    const [w] = file.attente.splice(i, 1);
    if (w.fond) file.fond++;
    else file.prio++;
    w.ok();
  }
}

/** Calcule (une seule fois à la fois par fichier) et enregistre l'empreinte ; rend le fichier, modifié si besoin. */
export async function assurerEmpreinte(f: Fichier, dep: DependancesEmpreinte = {}): Promise<Fichier> {
  if (f.sha256) return f;
  const stockage = dep.stockage ?? (await fournisseur("stockage"));
  if (!stockage.empreinteSha256) return f;
  const g = globalThis as Global;
  const enCours = (g[cleEnCours] ??= new Map());
  const deja = enCours.get(f.id);
  if (deja) {
    // Un dépôt (non-fond) qui trouve un calcul de fond le PROMEUT : il n'attend pas derrière le travail de fond.
    if (dep.fond !== true) promouvoir(deja);
    return deja.promesse!;
  }
  const calcul: Calcul = { promu: false };
  const depot = dep.depot ?? depots();
  calcul.promesse = (async () => {
    // Fiche relue AVANT la lecture : le rattrapage tient parfois une liste périmée (empreinte déjà là, fiche disparue) → rien à lire.
    const fraiche = await depot.fichiers.obtenir(f.id);
    if (!fraiche) return f;
    if (fraiche.sha256) return fraiche;
    const { sha256 } = await dansLaFile(() => stockage.empreinteSha256!(f.cleStockage, f.taille), dep.fond === true, calcul);
    // Écriture finale seule sous verrou, sur la fiche RELUE : disparue, déjà munie d'une empreinte ou déplacée → rien n'est écrit.
    return sousVerrou(async () => {
      const actuelle = await depot.fichiers.obtenir(f.id);
      if (!actuelle) return f;
      if (actuelle.sha256 || actuelle.cleStockage !== f.cleStockage) return actuelle;
      return depot.fichiers.modifier(f.id, { sha256 });
    });
  })();
  enCours.set(f.id, calcul);
  try {
    return await calcul.promesse;
  } finally {
    enCours.delete(f.id);
  }
}

/**
 * Échec DÉFINITIF (inutile de relire dans ce processus) : réponse R2 en 4xx (sauf 408 et 429) ou écart de taille (marqueur
 * `definitif`). Toute autre erreur, inconnue comprise (panne Postgres, coupure réseau, délai), est réessayable.
 */
export function estDefinitif(e: unknown): boolean {
  const x = e as { statut?: unknown; definitif?: unknown } | null;
  if (x?.definitif === true) return true;
  return typeof x?.statut === "number" && x.statut >= 400 && x.statut < 500 && x.statut !== 408 && x.statut !== 429;
}

async function rattraper(dep: DependancesEmpreinte, cleEtat: CleRattrapage): Promise<void> {
  const t = tousLesEtats();
  const etat = etatRattrapage(cleEtat);
  const depot = dep.depot ?? depots();
  const dansLeDossier = (cle: string) => (cleEtat === "tous" ? estEntreeControlee(cle) : dossierEntree(cle) === cleEtat);
  const toutes = await depot.fichiers.lister((f) => f.origine === "depot" && f.statut === "pret" && !f.sha256 && dansLeDossier(f.cleStockage) && !t.definitifs.has(f.id));
  const cibles = toutes.slice(0, RATTRAPAGE_MAX);
  let premiereErreur: unknown;
  for (const f of cibles) {
    try {
      await assurerEmpreinte(f, { ...dep, depot, fond: true });
    } catch (e) {
      console.error("[empreinte] rattrapage", f.id, e);
      if (estDefinitif(e)) t.definitifs.add(f.id); // 404, 403, taille différente… : inutile de relire dans ce processus
      else premiereErreur ??= e;
    }
  }
  if (premiereErreur !== undefined) throw premiereErreur;
  if (toutes.length <= RATTRAPAGE_MAX) etat.fait = true;
}

/**
 * Rattrape les fichiers d'entrée déjà déposés sans empreinte (appelé avant le contrôle « déjà traité » via `attendreRattrapage`).
 * Un échec n'arrête jamais les suivants. Relance une erreur à la fin seulement si un échec peut passer (5xx, 429, délai, panne
 * inconnue) ; les échecs définitifs ne sont pas relus dans le processus. 50 fichiers au plus par appel ; deux appels simultanés
 * (même dossier) partagent le même travail ; une fois tout fait, plus rien n'est refait. `dossier` : ne regarde que ce dossier.
 */
export function rattraperEmpreintesEntrees(dep: DependancesEmpreinte = {}, dossier?: DossierEntree): Promise<void> {
  const cle: CleRattrapage = dossier ?? "tous";
  const etat = etatRattrapage(cle);
  if (etat.fait) return Promise.resolve();
  if (etat.enCours) return etat.enCours;
  const p = rattraper(dep, cle).finally(() => {
    etat.enCours = undefined;
  });
  etat.enCours = p;
  return p;
}

/** Un calcul de fond a échoué : le rattrapage est de nouveau à faire (le fichier reste sans empreinte). */
export function signalerEmpreinteManquante(): void {
  for (const e of tousLesEtats().etats.values()) e.fait = false;
}

/** Phrases du refus quand l'empreinte d'un fichier ne peut pas être établie : rien n'est créé, rien n'est payé. */
export const PHRASE_VERIFICATION_IMPOSSIBLE = "Vérification du fichier impossible pour l'instant. Réessayez dans une minute.";
export const PHRASE_VERIFICATION_EN_COURS = "Vérification du fichier en cours, réessayez dans quelques minutes.";
export const PHRASE_FICHIER_ILLISIBLE = "Ce fichier est illisible : déposez-le à nouveau.";

/** La phrase du refus pour une erreur de `empreinteAvantControle` / `empreinteDuFichier`. */
export function phraseRefusEmpreinte(e: unknown): string {
  if ((e as { enCours?: unknown } | null)?.enCours === true) return PHRASE_VERIFICATION_EN_COURS;
  return estDefinitif(e) ? PHRASE_FICHIER_ILLISIBLE : PHRASE_VERIFICATION_IMPOSSIBLE;
}

/** Attente maximale du rattrapage d'un dossier avant un contrôle (ms) ; au-delà il continue en fond et ne bloque pas le dépôt. */
export const DELAI_RATTRAPAGE_CONTROLE_MS = 20_000;
/** Attente maximale du calcul du fichier PROPRE du dépôt (ms) ; au-delà : « vérification en cours », le calcul continue en fond. */
export const DELAI_FICHIER_CONTROLE_MS = 60_000;

export interface DependancesAvantControle extends DependancesEmpreinte {
  /** Tests : délai d'attente du rattrapage. */
  delaiRattrapageMs?: number;
  /** Tests : délai d'attente du calcul du fichier du dépôt. */
  delaiFichierMs?: number;
  /** Tests : relecture de la fiche complète du fichier déposé. */
  fiche?: (id: string) => Promise<Fichier | null>;
}

/**
 * Attend, au plus `delaiRattrapageMs`, le rattrapage des anciens fichiers du dossier. Une fois le délai dépassé pour un
 * rattrapage en cours, on ne l'attend plus tant que c'est le même (un lot de 10 images n'attend pas 10 fois).
 */
export async function attendreRattrapage(dossier: DossierEntree, dep: DependancesAvantControle = {}): Promise<void> {
  const etat = etatRattrapage(dossier);
  if (etat.fait) return;
  const p = rattraperEmpreintesEntrees(dep, dossier);
  const base = etat.enCours;
  if (base && etat.depasseSur === base) return;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    const delai = new Promise<"delai">((ok) => {
      minuteur = setTimeout(() => ok("delai"), dep.delaiRattrapageMs ?? DELAI_RATTRAPAGE_CONTROLE_MS);
    });
    const fini = p.then(
      () => "fini" as const,
      (e) => {
        console.error("[empreinte] rattrapage avant contrôle", e);
        return "fini" as const;
      },
    );
    if ((await Promise.race([fini, delai])) === "delai" && base) etat.depasseSur = base;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/**
 * Empreinte du fichier PRÉCIS du dépôt, attendue au plus `delaiFichierMs` : au-delà, erreur `{ enCours: true }` (le calcul
 * continue en fond ; le prochain essai le trouve fini ou en cours, via la promesse partagée). Autre erreur : relancée.
 * Hors dossiers contrôlés ou en simulation : fichier rendu tel quel.
 */
export async function empreinteDuFichier<T extends { id: string; cleStockage: string; sha256?: string }>(f: T, dep: DependancesAvantControle = {}): Promise<T> {
  if (f.sha256 || !estEntreeControlee(f.cleStockage)) return f;
  const fiche = await (dep.fiche ?? ((id: string) => (dep.depot ?? depots()).fichiers.obtenir(id)))(f.id);
  if (!fiche) return f;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    const delai = new Promise<never>((_, non) => {
      minuteur = setTimeout(() => non(Object.assign(new Error("vérification du fichier en cours"), { enCours: true })), dep.delaiFichierMs ?? DELAI_FICHIER_CONTROLE_MS);
    });
    const avec = await Promise.race([assurerEmpreinte(fiche, dep), delai]);
    return avec.sha256 ? { ...f, sha256: avec.sha256 } : f;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/**
 * Avant le contrôle « déjà traité » : rend le fichier avec son `sha256` (une copie renommée devient reconnaissable).
 * 1. rattrapage des anciens fichiers de SON dossier d'entrée (borné par une durée, jamais attendu deux fois de suite) ;
 * 2. empreinte du fichier précis du dépôt, ATTENDUE (bornée). Une erreur ici est relancée : l'appelant REFUSE le lancement
 *    avec `phraseRefusEmpreinte(e)`.
 * Hors dossiers d'entrée contrôlés ou en simulation, rend le fichier tel quel. NE JAMAIS appeler sous `sousVerrou`.
 */
export async function empreinteAvantControle<T extends { id: string; cleStockage: string; sha256?: string }>(f: T, dep: DependancesAvantControle = {}): Promise<T> {
  const dossier = dossierEntree(f.cleStockage);
  if (f.sha256 || !dossier) return f;
  await attendreRattrapage(dossier, dep);
  return empreinteDuFichier(f, dep);
}

/** Pour les tests : oublie l'état du rattrapage et des calculs en cours. */
export function oublierRattrapageEmpreintes(): void {
  (globalThis as Global)[cleRattrapage] = undefined;
  (globalThis as Global)[cleEnCours] = undefined;
  (globalThis as Global)[cleFile] = undefined;
}
