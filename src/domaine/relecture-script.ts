/**
 * RELIRE ET MODIFIER LE SCRIPT AVANT LA VIDÉO (demande de Will : dans chaque générateur, le script se relit et se modifie
 * avant que la vidéo ne soit fabriquée). Brique 1 sur 8 : le modèle COMMUN à tous les formats. PUR, sans réseau,
 * importable côté client et côté serveur.
 *
 * Chaque format traduit son script en LIGNES (une par phrase dite, avec ses textes écrits à l'écran) grâce à son
 * adaptateur, puis reçoit en retour les seules DIFFÉRENCES (même logique que `modificationsDe` du cas concret). Une ligne
 * modifiée par Will passe au barème « will » des contrôles, les autres restent au barème « machine » (`NIVEAUX`).
 * L'EMPREINTE du texte relu permet au serveur d'exiger « script relu » au lancement : elle tombe dès que le texte change.
 */
import { NIVEAUX } from "@/domaine/controles-script/niveaux";
import type { Auteur, NiveauControle } from "@/domaine/controles-script/types";

export interface EcritLigne {
  /** Texte affiché à l'écran (balises d'accent `*…*` comprises). */
  texte: string;
  /** false : tiré d'un fait (un chiffre…), il ne se modifie pas ici. */
  modifiable: boolean;
}

export interface LigneScript {
  id: string;
  /** Ce que la voix dit. */
  dit: string;
  ecrits?: EcritLigne[];
  /** Ligne entière non modifiable (ex. une phrase imposée par le format). */
  verrouille?: boolean;
  /** Partie du script (« Accroche », « Avant »…), pour regrouper les lignes. */
  groupe?: string;
  /** Texte fourni par Will lui-même (choix « J'ai déjà mon texte ») : pris à l'identique, sans les contrôles de Claude. */
  deWill?: true;
}

/** Ce que Will a changé sur une ligne ; `ecrits[k] = null` : écrit inchangé. */
export interface DifferenceLigne {
  id: string;
  dit?: string;
  ecrits?: (string | null)[];
}

/**
 * Texte COLLÉ ou IMPORTÉ par Will (`decouperTexte`, simulation/script.ts) : ses blocs ont un id qui commence par `colle-`.
 * Décision du 18/10 : ce texte est pris à l'identique, sans contrôle de style ni blocage ; seules restent les limites
 * techniques (phrase vide, durée du format, taille du texte). Les scripts écrits par le générateur gardent leurs contrôles.
 */
export const PREFIXE_BLOC_COLLE = "colle-";
export const estBlocColle = (blocId: string): boolean => blocId.startsWith(PREFIXE_BLOC_COLLE);

/** Script entièrement collé ou importé (au moins un bloc, tous `colle-`) : un script mixte ou du générateur garde ses contrôles. */
export const estScriptColle = (blocs: readonly { id: string }[]): boolean => blocs.length > 0 && blocs.every((b) => estBlocColle(b.id));

/** Id d'un bloc ajouté à la main : dans un script collé, ce que Will y tape est son texte (`colle-`) ; sinon l'id neutre. */
export const idBlocAjoute = (blocs: readonly { id: string }[], idNeutre: string): string => (estScriptColle(blocs) ? `${PREFIXE_BLOC_COLLE}${idNeutre}` : idNeutre);

const net = (s: string) => s.replace(/\s+/g, " ").trim();

/** Applique une frappe sur une ligne (nouveau tableau). Ligne verrouillée ou écrit non modifiable : rien ne change. */
export function appliquerSaisie(lignes: readonly LigneScript[], id: string, saisie: { dit?: string; ecrit?: { index: number; texte: string } }): LigneScript[] {
  return lignes.map((l) => {
    if (l.id !== id || l.verrouille) return l;
    let suite = l;
    if (saisie.dit !== undefined) suite = { ...suite, dit: saisie.dit };
    const e = saisie.ecrit;
    if (e && suite.ecrits?.[e.index]?.modifiable) suite = { ...suite, ecrits: suite.ecrits.map((x, k) => (k === e.index ? { ...x, texte: e.texte } : x)) };
    return suite;
  });
}

/** Les seules différences entre le script écrit (`avant`) et le script relu (`apres`), ligne par ligne (par `id`). */
export function differences(avant: readonly LigneScript[], apres: readonly LigneScript[]): DifferenceLigne[] {
  const res: DifferenceLigne[] = [];
  for (const a of avant) {
    const b = apres.find((x) => x.id === a.id);
    if (!b || a.verrouille) continue;
    const dit = net(b.dit) !== net(a.dit) ? b.dit : undefined;
    const ecrits = (a.ecrits ?? []).map((x, k) => {
      const v = b.ecrits?.[k]?.texte;
      return x.modifiable && v !== undefined && net(v) !== net(x.texte) ? v : null;
    });
    const ecritsChanges = ecrits.some((v) => v !== null);
    if (dit !== undefined || ecritsChanges) res.push({ id: a.id, ...(dit !== undefined ? { dit } : {}), ...(ecritsChanges ? { ecrits } : {}) });
  }
  return res;
}

/** Barème de chaque ligne : « will » si Will l'a modifiée, « machine » sinon. */
export function auteursDesLignes(avant: readonly LigneScript[], apres: readonly LigneScript[]): Record<string, Auteur> {
  const modifiees = new Set(differences(avant, apres).map((d) => d.id));
  return Object.fromEntries(apres.map((l) => [l.id, modifiees.has(l.id) ? "will" : "machine"]));
}

/** Niveau d'un contrôle pour l'auteur de la ligne (barème commun) ; `null` : ne s'applique pas. */
export function niveauPour(code: string, auteur: Auteur): NiveauControle | null {
  return NIVEAUX[code]?.[auteur] ?? null;
}

/**
 * Empreinte STABLE du texte relu (ordre des lignes, phrases dites, textes écrits ; espaces normalisés) : FNV-1a deux
 * passes + longueur, comme `empreinteCas`. Même texte, même empreinte ; une lettre changée, une autre empreinte.
 */
export function empreinte(lignes: readonly LigneScript[]): string {
  const t = JSON.stringify(lignes.map((l) => [l.id, net(l.dit), (l.ecrits ?? []).map((e) => net(e.texte))]));
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `relu-${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${t.length.toString(36)}`;
}

/** Côté serveur, au lancement : l'empreinte reçue est-elle celle du texte qui va être fabriqué ? */
export function scriptRelu(lignes: readonly LigneScript[], empreinteRecue: string | undefined | null): boolean {
  return !!empreinteRecue && empreinte(lignes) === empreinteRecue;
}

/** Débit retenu quand le format n'en donne pas (mots lus par seconde). */
export const DEBIT_PAR_DEFAUT = 2.8;

/** Mots LUS d'un texte (la ponctuation isolée « : », « ? » ne compte pas). */
function motsLus(t: string): number {
  return t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/** Durée estimée (s) des phrases dites, au débit du format (mots/s) ou à 2,8 mots/s. */
export function dureeEstimee(lignes: readonly LigneScript[], motsParSeconde: number = DEBIT_PAR_DEFAUT): number {
  const mots = lignes.reduce((s, l) => s + motsLus(l.dit), 0);
  return mots / Math.max(0.1, motsParSeconde);
}

/** Une pastille de contrôle, rendue par l'action serveur du format (niveau déjà lu au bon barème). */
export interface PastilleControle {
  niveau: NiveauControle;
  /** Une phrase courte, vouvoiement. */
  texte: string;
  /** Ligne concernée ; absente : le script entier. */
  ligneId?: string;
  code?: string;
}

/** Ce que reçoivent le contrôle et le lancement : le script relu, ses différences, le barème de chaque ligne. */
export interface ScriptRelu {
  lignes: LigneScript[];
  modifications: DifferenceLigne[];
  auteurs: Record<string, Auteur>;
  empreinte: string;
}

export type ResultatLancement = { ok: true } | { ok: false; message: string; code?: string; montant?: number };

/**
 * Ce que chaque format fournit pour brancher l'écran commun. `versLignes` et `depuisModifications` sont purs ;
 * `controler` est une action serveur GRATUITE (aucun appel payant) ; `lancer` vérifie l'empreinte (`scriptRelu`) et
 * l'accord du prix (montant confirmé, centimes) avant toute dépense.
 */
export interface AdaptateurFormat<Source> {
  versLignes(source: Source): LigneScript[];
  depuisModifications(source: Source, modifications: readonly DifferenceLigne[]): { ok: true; source: Source } | { ok: false; raisons: string[] };
  controler(script: ScriptRelu): Promise<PastilleControle[]>;
  lancer(script: ScriptRelu, accord: number | true): Promise<ResultatLancement>;
}

/** Le script relu, prêt pour `controler` ou `lancer`. */
export function scriptReluDe(avant: readonly LigneScript[], apres: readonly LigneScript[]): ScriptRelu {
  return { lignes: [...apres], modifications: differences(avant, apres), auteurs: auteursDesLignes(avant, apres), empreinte: empreinte(apres) };
}
