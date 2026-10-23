/**
 * SUJETS DÉJÀ TRAITÉS (lot L1) : « un sujet déjà traité ne doit SURTOUT PAS être regénéré », pour tous les générateurs.
 * PUR : aucun accès à la base ; le service (`services/sujets-traites.ts`) lui donne les vidéos et les sujets lus.
 *
 * Le registre est RECALCULÉ à chaque appel (aucune collection, aucune migration). Un sujet est traité à deux niveaux :
 *  - IDENTIQUE : même clé exacte (`cas:<casId>`, `usine:<code>`, `fichier:<sha256>` ou `fichier:<nom>#<taille>`) ;
 *  - PROCHE : même thème, par `ideesDejaTraitees` (60 % de mots pleins en commun, 180 jours).
 *
 * Une vidéo COMPTE si elle n'est pas une démonstration ET que son statut est `en_file`, `en_fabrication`, `prete` ou
 * `maquette` ; une vidéo archivée compte si son `statutAvantArchive` en était un (la corbeille de 30 jours garde le
 * sujet pris ; la suppression définitive le libère, la vidéo ayant disparu). Brouillon, annulée, échec : libre, SAUF un
 * échec qui est une PAUSE « à valider » (`enAttenteValidation`, calculée par `marquerAttentes` depuis le dernier travail).
 *
 * Règle D1 : même sujet dans le MÊME générateur = refus avec choix ; dans un AUTRE générateur = avertissement seulement.
 * Règle D3 : même thème pour un autre métier = « proche » (on prévient avec choix, sans blocage sec).
 * Le contrôle ne vaut QUE pour une nouvelle vidéo / un nouveau sujet : `estReprise` ou `ignorerVideoId` le suspendent
 * (reprise, retouche, autre accroche, réexport, « réessayer »).
 */
import { ideesDejaTraitees, racinesIdee } from "./classement-generateur";
import type { StatutVideo } from "./types";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** Statuts d'une vidéo qui prennent son sujet (les autres le laissent libre). */
export const STATUTS_QUI_COMPTENT: readonly StatutVideo[] = ["en_file", "en_fabrication", "prete", "maquette"];

/**
 * Codes d'erreur d'un travail qui s'est ARRÊTÉ pour attendre Will (carte, script ou script de cas concret à valider) : la
 * vidéo est alors en `echec` mais rien n'est perdu et le sujet est pris. Liste FERMÉE : tout futur code de pause doit y
 * être ajouté. Ne JAMAIS y mettre `IV_TYPE_A_CHOISIR` (rien n'est encore engagé : cela bloquerait le nouveau dépôt).
 */
export const CODES_ATTENTE_VALIDATION: readonly string[] = ["IV_CARTE_A_VALIDER", "IV_SCRIPT_A_VALIDER", "CAS_CONCRET_SCRIPT_A_VALIDER"];

/** Numéro de sujet à partir duquel un sujet est une démonstration (cf. `ScriptMaitre.numero`). */
export const NUMERO_DEMONSTRATION = 9000;

export type NiveauSujet = "identique" | "proche";
export type ChoixConfirmation = "refaire" | "nouvel-angle";
export type GardeSujets = "bloquant" | "avertissement" | "eteint";
export const GARDES_SUJETS: readonly GardeSujets[] = ["bloquant", "avertissement", "eteint"];
export const GARDE_PAR_DEFAUT: GardeSujets = "bloquant";

/** Lecture tolérante du réglage `sujets.garde` : toute valeur inconnue = « bloquant » (le plus sûr). */
export function lireGarde(valeur: unknown): GardeSujets {
  return GARDES_SUJETS.find((g) => g === valeur) ?? GARDE_PAR_DEFAUT;
}

/** Ce que le registre lit d'une vidéo. */
export interface VideoRegistre {
  id: string;
  titre: string;
  sujet?: string;
  formatId: string;
  statut: StatutVideo;
  statutAvantArchive?: StatutVideo;
  estDemo?: boolean;
  creeLe: string;
  entrees?: Record<string, unknown>;
  /** Script de la vidéo (pour retrouver son sujet central). */
  scriptId?: string;
  varianteId?: string;
  /** Vidéo dérivée (variante de réseau, d'accroche…) : jamais un sujet à elle seule, elle suit sa vidéo mère. */
  sourceVideoId?: string;
  typeDerive?: string;
  /** Pause en attente de Will, calculée depuis le dernier travail (`marquerAttentes`), jamais lue sur la vidéo. */
  enAttenteValidation?: boolean;
}

/** Ce que le registre lit d'un sujet central (chaîne d'écriture). */
export interface SujetRegistre {
  id: string;
  numero?: number;
  /** Version du sujet : plusieurs versions portent le même numéro, seule la dernière fait une entrée. */
  version?: number;
  estDemo?: boolean;
  archiveLe?: string;
  creeLe: string;
  idee: string;
  formatId: string;
  /** `ScriptMaitre.origineUsine.parts.cas_usage` : code du cas d'usage de l'Usine d'où vient le sujet. */
  codeCasUsage?: string;
}

/** Fichier connu (prise, image) : sert à reconnaître le MÊME fichier déposé deux fois. */
export interface FichierRegistre {
  id: string;
  cleStockage: string;
  nom: string;
  taille: number;
  sha256?: string;
}

export interface EntreeRegistre {
  /** `video` : une vidéo comptée ; `sujet` : un sujet central numéroté sans vidéo comptée. */
  source: "video" | "sujet";
  id: string;
  videoId?: string;
  sujetId?: string;
  /** Numéro du sujet central (toutes ses versions), s'il y en a un. */
  numero?: number;
  /** Identifiants de TOUTES les versions du sujet central. */
  sujetIds?: string[];
  /** Générateur = identifiant du format (`avocat`, `facecam`, `facecam-animee`, `tableau-anime`, `cas-concret`, `image-video`). */
  generateur: string;
  titre: string;
  /** Texte comparé pour le « proche ». */
  texte: string;
  le: string;
  cles: string[];
  lien: string;
}

export interface Precedent {
  videoId?: string;
  sujetId?: string;
  titre: string;
  le: string;
  lien: string;
  generateur: string;
}

export interface CandidatSujet {
  generateur: string;
  /** Clés exactes du nouveau sujet (`cleCas`, `cleUsine`, `cleFichier`). */
  cles?: string[];
  /** Texte libre du sujet (idée, titre) pour le « proche ». */
  texte?: string;
  /** Reprise, retouche, autre accroche, réexport, « réessayer » : aucun contrôle. */
  estReprise?: boolean;
  /** Vidéo en cours de reprise (jamais comparée à elle-même) ; sans effet sur les autres. */
  ignorerVideoId?: string;
  /** Plusieurs vidéos en cours de reprise (brouillon repris + pauses du même cas) : s'ajoute à `ignorerVideoId`. */
  ignorerVideoIds?: string[];
  /** Ignore toutes les versions du sujet qui porte cet identifiant. */
  ignorerSujetId?: string;
  /** Ignore le sujet central de ce numéro (toutes versions). */
  ignorerNumero?: number;
  /**
   * INTERNE (posé par le service pour une relance) : ignore seulement l'entrée du SUJET CENTRAL de ce numéro, jamais les
   * autres vidéos du même numéro (une autre vidéo prête sur ce sujet doit toujours bloquer).
   */
  ignorerEntreeSujetNumero?: number;
}

export interface Suggestion {
  titre: string;
  code?: string;
  casId?: string;
  source: "catalogue" | "usine";
}

export interface Confirmation {
  choix: ChoixConfirmation;
  jeton: string;
}

export type ResultatVerification =
  | { ok: true; avertissement?: { niveau: NiveauSujet; precedents: Precedent[] }; confirme?: ChoixConfirmation }
  | { ok: false; niveau: NiveauSujet; precedents: Precedent[]; suggestions: Suggestion[]; jeton: string; jetonPerime?: true };

/* ------------------------------------------------------------------ */
/* Clés exactes                                                         */
/* ------------------------------------------------------------------ */

const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "");
/** Texte réduit pour comparer : sans accents, minuscules, espaces et ponctuation écrasés. */
export const normaliser = (t: string): string => sansAccents(t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const cleCas = (casId: string): string => `cas:${casId.trim()}`;
export const cleUsine = (code: string): string => `usine:${code.trim()}`;

/** `fichier:<sha256>` ; sans empreinte, nom normalisé + taille. Vide si rien d'exploitable. */
export function cleFichier(f: { sha256?: string; nom?: string; taille?: number }): string | undefined {
  if (f.sha256?.trim()) return `fichier:${f.sha256.trim().toLowerCase()}`;
  const nom = f.nom ? normaliser(f.nom) : "";
  if (nom && typeof f.taille === "number" && f.taille > 0) return `fichier:${nom}#${f.taille}`;
  return undefined;
}

/** Clé d'un fichier connu seulement par sa référence (identifiant ou clé de stockage) : même dépôt, même clé. */
export const cleFichierRef = (ref: string): string => `fichier:ref:${ref.trim()}`;

/** TOUTES les clés possibles d'un fichier (empreinte, nom + taille) : un renommage ou une empreinte absente ne contourne rien. */
export function clesFichier(f: { sha256?: string; nom?: string; taille?: number }): string[] {
  const sha = f.sha256?.trim() ? `fichier:${f.sha256.trim().toLowerCase()}` : undefined;
  const nom = f.nom ? normaliser(f.nom) : "";
  const nomTaille = nom && typeof f.taille === "number" && f.taille > 0 ? `fichier:${nom}#${f.taille}` : undefined;
  return [sha, nomTaille].filter((x): x is string => !!x);
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texteNonVide = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Les fichiers, retrouvés par identifiant OU par clé de stockage. */
function indexFichiers(fichiers: readonly FichierRegistre[]): Map<string, FichierRegistre> {
  const m = new Map<string, FichierRegistre>();
  for (const f of fichiers) {
    m.set(f.id, f);
    m.set(f.cleStockage, f);
  }
  return m;
}

/** Clés du fichier : empreinte ET nom + taille si le fichier est connu, plus sa référence (même dépôt = même clé). */
function clesDuFichier(ref: string | undefined, sha256: string | undefined, index: Map<string, FichierRegistre>): string[] {
  const f = ref ? index.get(ref) : undefined;
  const cles = [...clesFichier({ sha256, ...(f ? { nom: f.nom, taille: f.taille } : {}) }), ...(f ? clesFichier(f) : [])];
  if (ref) cles.push(cleFichierRef(ref));
  if (f) cles.push(cleFichierRef(f.id), cleFichierRef(f.cleStockage));
  return [...new Set(cles)];
}

/** Clés exactes d'une vidéo, lues dans ses entrées (cas concret, prise de face caméra animée, image d'image → vidéo). */
export function clesDeLaVideo(v: Pick<VideoRegistre, "formatId" | "entrees">, fichiers: readonly FichierRegistre[] = []): string[] {
  const cles: string[] = [];
  const index = indexFichiers(fichiers);
  const e = v.entrees;
  if (v.formatId === "cas-concret") {
    const casId = texteNonVide(objet(e?.casConcret).casId);
    if (casId) cles.push(cleCas(casId));
  } else if (v.formatId === "facecam-animee") {
    const fa = objet(e?.facecamAnimee);
    for (const r of [texteNonVide(fa.fichierId), texteNonVide(fa.priseCle)]) cles.push(...clesDuFichier(r, undefined, index));
  } else if (v.formatId === "image-video") {
    const iv = objet(e?.imageVideo);
    cles.push(...clesDuFichier(texteNonVide(iv.imageCle), texteNonVide(iv.empreinte), index));
  }
  return [...new Set(cles)];
}

/* ------------------------------------------------------------------ */
/* « Compte comme traité »                                              */
/* ------------------------------------------------------------------ */

/** Statut qui fait foi : celui d'avant l'archivage pour une vidéo archivée. */
export function statutEffectif(v: Pick<VideoRegistre, "statut" | "statutAvantArchive">): StatutVideo | undefined {
  return v.statut === "archivee" ? v.statutAvantArchive : v.statut;
}

/** Une vidéo prend-elle son sujet ? Démonstration, brouillon, annulée, vraie panne : non. Une pause à valider : oui. */
export function videoCompte(v: Pick<VideoRegistre, "statut" | "statutAvantArchive" | "estDemo" | "enAttenteValidation">): boolean {
  if (v.estDemo) return false;
  const s = statutEffectif(v);
  if (s === "echec" && v.enAttenteValidation === true) return true;
  return !!s && STATUTS_QUI_COMPTENT.includes(s);
}

/** Ce que `marquerAttentes` lit d'un travail. */
export interface TravailRegistre {
  cibleId: string;
  type: string;
  statut: string;
  creeLe?: string;
  modifieLe?: string;
  id?: string;
  erreur?: { code?: string };
  etapes?: { statut: string; erreur?: { code?: string } }[];
}

/** Code d'erreur du travail, ou de son étape en échec (lecture tolérante). */
const codeDuTravail = (t: TravailRegistre): string | undefined => t.erreur?.code ?? t.etapes?.find((e) => e.statut === "echec")?.erreur?.code;

/**
 * Pose `enAttenteValidation` sur les vidéos en `echec` dont le DERNIER travail (hors réexport) est un échec qui porte un
 * code de pause (`CODES_ATTENTE_VALIDATION`). Une pause suivie d'une vraie panne, un travail annulé : aucun champ.
 * Les autres vidéos sont rendues inchangées.
 */
export function marquerAttentes<V extends Pick<VideoRegistre, "id" | "statut" | "statutAvantArchive">>(videos: readonly V[], travaux: readonly TravailRegistre[]): (V & { enAttenteValidation?: boolean })[] {
  // Tri tolérant (ancien travail sans date) : date de création, puis de modification, puis identifiant.
  const rang = (t: TravailRegistre) => [String(t.creeLe ?? ""), String(t.modifieLe ?? ""), String(t.id ?? "")];
  const plusRecent = (a: TravailRegistre, b: TravailRegistre) => {
    const [x, y] = [rang(a), rang(b)];
    for (let i = 0; i < 3; i++) {
      const c = x[i]!.localeCompare(y[i]!);
      if (c) return c > 0;
    }
    return false;
  };
  const dernier = new Map<string, TravailRegistre>();
  for (const t of travaux) {
    if (t.type === "reexport" || typeof t.cibleId !== "string") continue;
    const d = dernier.get(t.cibleId);
    if (!d || plusRecent(t, d)) dernier.set(t.cibleId, t);
  }
  return videos.map((v) => {
    if (statutEffectif(v) !== "echec") return v;
    const t = dernier.get(v.id);
    const code = t && t.statut === "echec" ? codeDuTravail(t) : undefined;
    return code && CODES_ATTENTE_VALIDATION.includes(code) ? { ...v, enAttenteValidation: true } : v;
  });
}

/** Un sujet central compte s'il est numéroté (premier appel payant fait), réel et non archivé. */
export function sujetCompte(s: Pick<SujetRegistre, "numero" | "estDemo" | "archiveLe">): boolean {
  return s.numero !== undefined && s.numero < NUMERO_DEMONSTRATION && !s.estDemo && !s.archiveLe;
}

/* ------------------------------------------------------------------ */
/* Registre                                                             */
/* ------------------------------------------------------------------ */

export interface SourcesRegistre {
  videos: readonly VideoRegistre[];
  /** Sujets centraux (scripts maîtres). */
  sujets?: readonly SujetRegistre[];
  /** Pour retrouver le sujet central d'une vidéo : identifiant de script (ou de version) -> identifiant de sujet. */
  sujetDuScript?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  fichiers?: readonly FichierRegistre[];
}

function lireIndex(m: SourcesRegistre["sujetDuScript"], cle: string | undefined): string | undefined {
  if (!m || !cle) return undefined;
  return m instanceof Map ? m.get(cle) : (m as Record<string, string>)[cle];
}

/** Un sujet central avec toutes ses versions (même numéro) : seule la dernière fait foi. */
interface GroupeSujet {
  cle: string;
  derniere: SujetRegistre;
  ids: string[];
  /** Code Usine de la dernière version qui en porte un. */
  codeCasUsage?: string;
}

function grouperSujets(sujets: readonly SujetRegistre[]): { groupes: GroupeSujet[]; parId: Map<string, GroupeSujet> } {
  const parCle = new Map<string, SujetRegistre[]>();
  for (const s of sujets) {
    const cle = s.numero !== undefined ? `n${s.numero}` : `i${s.id}`;
    parCle.set(cle, [...(parCle.get(cle) ?? []), s]);
  }
  const groupes: GroupeSujet[] = [];
  const parId = new Map<string, GroupeSujet>();
  for (const [cle, versions] of parCle) {
    const triees = [...versions].sort((x, y) => (y.version ?? 0) - (x.version ?? 0) || y.creeLe.localeCompare(x.creeLe) || y.id.localeCompare(x.id));
    const code = triees.find((x) => x.codeCasUsage)?.codeCasUsage;
    const g: GroupeSujet = { cle, derniere: triees[0]!, ids: triees.map((x) => x.id), ...(code ? { codeCasUsage: code } : {}) };
    groupes.push(g);
    for (const id of g.ids) parId.set(id, g);
  }
  return { groupes, parId };
}

/** Une vidéo dérivée (variante de réseau, d'accroche, extrait…) suit sa vidéo mère COMPTÉE : elle ne prend pas de sujet à elle seule. Orpheline, elle compte. */
const estDerivee = (v: Pick<VideoRegistre, "sourceVideoId" | "typeDerive">, meres: ReadonlyMap<string, VideoRegistre>): boolean => {
  // Orpheline (mère supprimée : `sourceVideoId` retiré, `typeDerive` gardé) ou dont la mère ne compte pas : elle compte.
  const mere = v.sourceVideoId ? meres.get(v.sourceVideoId) : undefined;
  return !!mere && videoCompte(mere);
};

function groupeDeLaVideo(v: Pick<VideoRegistre, "varianteId" | "scriptId">, index: SourcesRegistre["sujetDuScript"], parId: Map<string, GroupeSujet>): GroupeSujet | undefined {
  const sujetId = lireIndex(index, v.varianteId) ?? lireIndex(index, v.scriptId);
  return sujetId ? parId.get(sujetId) : undefined;
}

/**
 * Le registre des sujets traités : une entrée par vidéo qui compte (hors vidéos dérivées), plus une par sujet central
 * numéroté qu'aucune vidéo comptée ne porte (« Le diagnostic fuite » écrit en n° 1, vidéo pas encore lancée : traité
 * quand même). Un sujet à plusieurs versions (même numéro) ne fait qu'UNE entrée : sa dernière version.
 */
export function construireRegistre(src: SourcesRegistre): EntreeRegistre[] {
  const fichiers = src.fichiers ?? [];
  const { groupes, parId } = grouperSujets(src.sujets ?? []);
  const entrees: EntreeRegistre[] = [];
  const meres = new Map(src.videos.map((x) => [x.id, x]));
  const portes = new Set<string>();
  for (const v of src.videos) {
    if (!videoCompte(v) || estDerivee(v, meres)) continue;
    const g = groupeDeLaVideo(v, src.sujetDuScript, parId);
    if (g) portes.add(g.cle);
    const cles = clesDeLaVideo(v, fichiers);
    if (g?.codeCasUsage) cles.push(cleUsine(g.codeCasUsage));
    entrees.push({
      source: "video",
      id: v.id,
      videoId: v.id,
      ...(g ? { sujetId: g.derniere.id, sujetIds: g.ids, ...(g.derniere.numero !== undefined ? { numero: g.derniere.numero } : {}) } : {}),
      generateur: v.formatId,
      titre: v.titre,
      texte: g?.derniere.idee || v.sujet || v.titre,
      le: v.creeLe,
      cles,
      lien: `/videos/${v.id}`,
    });
  }
  for (const g of groupes) {
    const s = g.derniere;
    if (!sujetCompte(s) || portes.has(g.cle)) continue;
    entrees.push({
      source: "sujet",
      id: s.id,
      sujetId: s.id,
      sujetIds: g.ids,
      ...(s.numero !== undefined ? { numero: s.numero } : {}),
      generateur: s.formatId,
      titre: s.idee,
      texte: s.idee,
      le: s.creeLe,
      cles: g.codeCasUsage ? [cleUsine(g.codeCasUsage)] : [],
      lien: `/scripts/${s.id}`,
    });
  }
  return entrees.sort((x, y) => y.le.localeCompare(x.le) || x.id.localeCompare(y.id));
}

/**
 * Le sujet central d'une vidéo, QUEL QUE SOIT son statut (même en échec ou en brouillon, donc absente du registre).
 * Sert à une relance : la vidéo ne doit pas être bloquée par son propre sujet (`ignorerEntreeSujetNumero`).
 */
export function sujetDeLaVideo(src: SourcesRegistre, videoId: string): { sujetId: string; numero?: number } | undefined {
  const v = src.videos.find((x) => x.id === videoId);
  if (!v) return undefined;
  const { parId } = grouperSujets(src.sujets ?? []);
  const g = groupeDeLaVideo(v, src.sujetDuScript, parId);
  return g ? { sujetId: g.derniere.id, ...(g.derniere.numero !== undefined ? { numero: g.derniere.numero } : {}) } : undefined;
}

/* ------------------------------------------------------------------ */
/* Recherche des précédents                                             */
/* ------------------------------------------------------------------ */

export interface Trouve {
  entree: EntreeRegistre;
  niveau: NiveauSujet;
}

const JOURS_PROCHE = 180;

/** Générateurs dont le sujet est une clé exacte (un cas du catalogue, une prise, une image). */
const GENERATEURS_A_CLE_EXACTE: readonly string[] = ["cas-concret", "facecam-animee", "image-video"];

/** Empreintes (sha256) parmi des clés : ni les références, ni les clés « nom + taille » (qui contiennent « # »). */
function shasDe(cles: Iterable<string>): Set<string> {
  return new Set([...cles].filter((c) => c.startsWith("fichier:") && !c.startsWith("fichier:ref:") && !c.includes("#")));
}

/** Deux fichiers de même nom et même taille mais d'empreintes connues et différentes sont deux fichiers : pas de jonction. */
function nomTailleContredit(cle: string, shasCandidat: Set<string>, clesEntree: readonly string[]): boolean {
  if (!cle.includes("#") || !cle.startsWith("fichier:")) return false;
  const shasEntree = shasDe(clesEntree);
  return shasCandidat.size > 0 && shasEntree.size > 0 && ![...shasCandidat].some((x) => shasEntree.has(x));
}

/** Entrées du registre qui traitent déjà ce sujet (identique d'abord, puis proche), hors la vidéo / le sujet ignoré. */
export function chercherPrecedents(registre: readonly EntreeRegistre[], candidat: CandidatSujet, maintenant: string): Trouve[] {
  const cles = new Set(candidat.cles ?? []);
  const ignore = (e: EntreeRegistre): boolean =>
    (!!candidat.ignorerVideoId && e.videoId === candidat.ignorerVideoId) ||
    (!!candidat.ignorerVideoIds && !!e.videoId && candidat.ignorerVideoIds.includes(e.videoId)) ||
    (!!candidat.ignorerSujetId && (e.sujetId === candidat.ignorerSujetId || !!e.sujetIds?.includes(candidat.ignorerSujetId))) ||
    (candidat.ignorerNumero !== undefined && e.numero === candidat.ignorerNumero) ||
    (candidat.ignorerEntreeSujetNumero !== undefined && e.source === "sujet" && e.numero === candidat.ignorerEntreeSujetNumero);
  const gardees = registre.filter((e) => !ignore(e));
  const trouves = new Map<string, Trouve>();
  const shasCandidat = shasDe(cles);
  for (const e of gardees) if (e.cles.some((c) => cles.has(c) && !nomTailleContredit(c, shasCandidat, e.cles))) trouves.set(e.id, { entree: e, niveau: "identique" });
  // Générateurs à clé exacte : si le candidat a sa clé, le texte ne sert pas (deux cas ou deux prises ne sont pas « proches »).
  // Une clé `usine:` (cas d'usage de l'Usine) vaut aussi clé exacte : deux cas d'usage distincts sur une même douleur de métier ne sont pas « proches ».
  const parCle = (GENERATEURS_A_CLE_EXACTE.includes(candidat.generateur) || [...cles].some((c) => c.startsWith("usine:"))) && cles.size > 0;
  const texte = parCle ? undefined : candidat.texte?.trim();
  if (texte && racinesIdee(texte).size) {
    const restantes = gardees.filter((e) => !trouves.has(e.id));
    const versIdee = (e: EntreeRegistre, idee: string) => ({ id: e.id, numero: 0, idee, le: Number.isFinite(Date.parse(e.le)) ? e.le : maintenant });
    // `ideesDejaTraitees` ne lit que les sujets numérotés : un numéro factice les rend tous éligibles (verrouillé par un test).
    // Une vidéo est « proche » si son texte OU son titre affiché (≠ du texte : le sujet d'un tableau est un geste interne) dépasse le seuil.
    const proches = ideesDejaTraitees(
      texte,
      [...restantes.map((e) => versIdee(e, e.texte)), ...restantes.filter((e) => typeof e.titre === "string" && e.titre.trim() && e.titre !== e.texte && racinesIdee(e.titre).size >= 2).map((e) => versIdee(e, e.titre))],
      maintenant,
      { jours: JOURS_PROCHE },
    );
    const parId = new Map(gardees.map((e) => [e.id, e]));
    for (const p of proches) trouves.set(p.id, { entree: parId.get(p.id)!, niveau: "proche" });
  }
  return [...trouves.values()].sort((a, b) => (a.niveau === b.niveau ? 0 : a.niveau === "identique" ? -1 : 1) || b.entree.le.localeCompare(a.entree.le));
}

const versPrecedent = (e: EntreeRegistre): Precedent => ({ ...(e.videoId ? { videoId: e.videoId } : {}), ...(e.sujetId ? { sujetId: e.sujetId } : {}), titre: e.titre, le: e.le, lien: e.lien, generateur: e.generateur });

/* ------------------------------------------------------------------ */
/* Jeton                                                                */
/* ------------------------------------------------------------------ */

/** Empreinte courte (FNV-1a 32 bits, deux passes) : assez pour repérer une confirmation périmée, rien de secret. */
export function empreinteCourte(texte: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
    h2 ^= h2 >>> 13;
  }
  return h1.toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

/** Jeton = empreinte des précédents (identifiant, niveau, date), du générateur et du candidat (clés, texte) : change dès qu'une vidéo apparaît, disparaît ou change. */
export function jetonDes(candidat: Pick<CandidatSujet, "generateur" | "cles" | "texte">, trouves: readonly Trouve[]): string {
  const lignes = trouves.map((t) => `${t.entree.id}|${t.niveau}|${t.entree.le}`).sort();
  // Lié au candidat : une confirmation donnée pour un autre sujet ne vaut pas pour celui-ci.
  return empreinteCourte([candidat.generateur, [...(candidat.cles ?? [])].sort().join(","), normaliser(candidat.texte ?? ""), ...lignes].join("\n"));
}

/* ------------------------------------------------------------------ */
/* Vérification                                                         */
/* ------------------------------------------------------------------ */

export interface OptionsVerification {
  maintenant: string;
  garde?: GardeSujets;
  confirmation?: Confirmation;
  /** Appelée seulement en cas de refus (trois propositions au plus sont gardées). */
  suggestions?: () => Suggestion[];
}

const niveauLePlusFort = (t: readonly Trouve[]): NiveauSujet => (t.some((x) => x.niveau === "identique") ? "identique" : "proche");

/**
 * Vérifie un nouveau sujet contre le registre. Le registre ne contient que les vidéos qui COMPTENT : une vidéo en échec
 * relancée (`ignorerVideoId`) n'y est pas, mais son sujet central numéroté, lui, y est. Le domaine ne voyant que le
 * registre, l'appelant (le service) retrouve le sujet de la vidéo relancée avec `sujetDeLaVideo` et le passe en
 * `ignorerEntreeSujetNumero` (l'entrée du sujet central seulement : les AUTRES vidéos du même numéro continuent de bloquer),
 * sinon la relance serait bloquée par son propre sujet.
 */
export function verifierSujet(registre: readonly EntreeRegistre[], candidat: CandidatSujet, opts: OptionsVerification): ResultatVerification {
  const garde = opts.garde ?? GARDE_PAR_DEFAUT;
  if (garde === "eteint" || candidat.estReprise) return { ok: true };
  const trouves = chercherPrecedents(registre, candidat, opts.maintenant);
  if (!trouves.length) return { ok: true };
  const memeGenerateur = trouves.filter((t) => t.entree.generateur === candidat.generateur);
  // D1 : un autre générateur ne bloque jamais, il prévient. Mode « avertissement » : tout prévient, rien ne bloque.
  if (!memeGenerateur.length || garde === "avertissement") {
    return { ok: true, avertissement: { niveau: niveauLePlusFort(trouves), precedents: trouves.map((t) => versPrecedent(t.entree)) } };
  }
  const jeton = jetonDes(candidat, memeGenerateur);
  const c = opts.confirmation;
  if (c && (c.choix === "refaire" || c.choix === "nouvel-angle") && c.jeton === jeton) return { ok: true, confirme: c.choix };
  return {
    ok: false,
    niveau: niveauLePlusFort(memeGenerateur),
    precedents: memeGenerateur.map((t) => versPrecedent(t.entree)),
    suggestions: (opts.suggestions?.() ?? []).slice(0, 3),
    jeton,
    ...(c ? { jetonPerime: true as const } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                          */
/* ------------------------------------------------------------------ */

// Écrits en deux morceaux pour qu'aucun texte du dépôt ne contienne ces expressions en clair.
const MOTS_INTERDITS = [new RegExp("gren" + "oble"), new RegExp("aucun gain " + "garanti")];

/** Texte interdit dans toute communication (deux expressions bannies par Will). */
export function contientMotInterdit(...textes: (string | undefined)[]): boolean {
  const t = normaliser(textes.filter(Boolean).join(" "));
  return MOTS_INTERDITS.some((re) => re.test(t));
}

export interface CandidatSuggestion extends Suggestion {
  /** Autres textes de la ligne, contrôlés pour les mots interdits seulement. */
  textes?: string[];
}

/**
 * Garde au plus `max` propositions : ni code ni titre déjà traité, un seul exemplaire par titre, aucun mot interdit.
 * Dans le même générateur, un titre « proche » (60 % de mots pleins) d'un sujet traité est aussi écarté.
 */
export function filtrerSuggestions(candidats: readonly CandidatSuggestion[], registre: readonly EntreeRegistre[], generateur: string, maintenant: string, max = 3): Suggestion[] {
  const cles = new Set(registre.flatMap((e) => e.cles));
  const titresTraites = new Set(registre.flatMap((e) => [normaliser(e.titre), normaliser(e.texte)]));
  const memeGenerateur = registre.filter((e) => e.generateur === generateur).map((e) => ({ id: e.id, numero: 0, idee: e.texte, le: e.le }));
  const vus = new Set<string>();
  const sortie: Suggestion[] = [];
  for (const c of candidats) {
    if (sortie.length >= max) break;
    const titre = c.titre.trim();
    const norm = normaliser(titre);
    if (!norm || vus.has(norm) || titresTraites.has(norm)) continue;
    if (c.code && cles.has(cleUsine(c.code))) continue;
    if (c.casId && cles.has(cleCas(c.casId))) continue;
    if (contientMotInterdit(titre, ...(c.textes ?? []))) continue;
    if (ideesDejaTraitees(titre, memeGenerateur, maintenant, { jours: JOURS_PROCHE }).length) continue;
    vus.add(norm);
    sortie.push({ titre, source: c.source, ...(c.code ? { code: c.code } : {}), ...(c.casId ? { casId: c.casId } : {}) });
  }
  return sortie;
}
