/**
 * CLASSEMENT DU GÉNÉRATEUR (plan v5 B.6, lot G1b). PUR : importable côté client.
 *
 * Filtres de la liste Scripts (état dans l'adresse, une valeur par critère), recherche par code (« 42 », « 0042 »,
 * « 0042-AV-TT », « SAR »), bouton « Format » rangé par type de vidéo, ordre et heure de publication proposés (J à J+4),
 * et ce que Buffer transmet vraiment par réseau (vérifié le 02/10/2026).
 */
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import type { Adresse, ModeDiction, ReseauDeclinaison } from "./types";
import type { EtatReseau, LigneGrille } from "./derivations-generateur";

/* ------------------------------------------------------------------ */
/* Filtres (B.6.4)                                                     */
/* ------------------------------------------------------------------ */

/** Vues rapides : tuiles d'Accueil et valeurs du critère « État ». */
export type VueRapide = "a-relire" | "pret-a-fabriquer" | "il-manque-une-matiere" | "il-manque-une-preuve" | "a-revoir" | "a-programmer";

export const VUES_RAPIDES: Record<VueRapide, string> = {
  "a-relire": "À relire",
  "pret-a-fabriquer": "Prêts à fabriquer",
  "il-manque-une-matiere": "Il manque une matière",
  "il-manque-une-preuve": "Il manque une preuve",
  "a-revoir": "Milieu modifié, à revoir",
  "a-programmer": "À programmer",
};

export interface FiltresScripts {
  reseau?: ReseauDeclinaison;
  format?: string;
  etat?: VueRapide;
  qui?: ModeDiction;
  adresse?: Adresse;
  pilier?: string;
  serie?: string;
  q?: string;
}

const CLES_FILTRES = ["reseau", "format", "etat", "qui", "adresse", "pilier", "serie", "q"] as const;
const MODES: ModeDiction[] = ["avatar", "teleprompteur", "trame", "voix-off"];

type Parametres = Record<string, string | string[] | undefined> | URLSearchParams;

function lire(p: Parametres, cle: string): string | undefined {
  const v = p instanceof URLSearchParams ? (p.get(cle) ?? undefined) : p[cle];
  const un = Array.isArray(v) ? v[0] : v;
  return un?.trim() || undefined;
}

/** Lit les filtres dans l'adresse ; une valeur inconnue est ignorée (jamais d'erreur). */
export function lireFiltres(p: Parametres): FiltresScripts {
  const f: FiltresScripts = {};
  const reseau = lire(p, "reseau");
  if (reseau && (RESEAUX_DECLINAISON as readonly string[]).includes(reseau)) f.reseau = reseau as ReseauDeclinaison;
  const format = lire(p, "format");
  if (format) f.format = format;
  const etat = lire(p, "etat");
  if (etat && etat in VUES_RAPIDES) f.etat = etat as VueRapide;
  const qui = lire(p, "qui");
  if (qui && (MODES as string[]).includes(qui)) f.qui = qui as ModeDiction;
  const adresse = lire(p, "adresse");
  if (adresse === "vous" || adresse === "tu") f.adresse = adresse;
  for (const c of ["pilier", "serie", "q"] as const) {
    const v = lire(p, c);
    if (v) f[c] = v;
  }
  return f;
}

/** Adresse d'une liste filtrée (`/ecrire?reseau=tiktok&format=avocat`), dans un ordre stable. */
export function adresseFiltres(base: string, f: FiltresScripts, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra);
  for (const c of CLES_FILTRES) if (f[c]) p.set(c, f[c]!);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export function nombreFiltres(f: FiltresScripts, sauf: (keyof FiltresScripts)[] = []): number {
  return CLES_FILTRES.filter((c) => !sauf.includes(c) && !!f[c]).length;
}

/* ------------------------------------------------------------------ */
/* Recherche par code (B.6.14)                                         */
/* ------------------------------------------------------------------ */

export type RequeteCode = { numero: number } | { prefixeCode: string; numero: number } | { codeFormat: string };

/**
 * « 42 » ou « 0042 » → numéro ; « 0042-AV-TT » ou « 0042-av-tt-l » → début de code (et numéro) ; « SAR » ou « AV » → code
 * de format (seulement s'il est connu : on ne confond pas un mot avec un code). null : recherche par texte.
 */
export function analyserRequeteCode(q: string, codesFormat: readonly string[] = []): RequeteCode | null {
  const t = q.trim();
  const n = /^(?:n°\s*)?(\d{1,6})$/i.exec(t);
  if (n) return { numero: Number(n[1]) };
  const c = /^(\d{1,6})((?:-[A-Za-z]{1,3})+)$/.exec(t);
  if (c) return { numero: Number(c[1]), prefixeCode: `${c[1].padStart(4, "0")}${c[2].toUpperCase()}` };
  if (/^[A-Za-z]{2,3}$/.test(t) && codesFormat.includes(t.toUpperCase())) return { codeFormat: t.toUpperCase() };
  return null;
}

/* ------------------------------------------------------------------ */
/* Filtrer les sujets                                                  */
/* ------------------------------------------------------------------ */

/** Ce que la liste sait d'un sujet (forme de `VueSujet`, réduite au nécessaire). */
export interface SujetClassable {
  maitre: {
    numero?: number;
    brief: { idee: string; pilier?: string; serieId?: string };
    angle?: { titre: string };
    manque?: { type: string };
  };
  etat: string;
  grille: Pick<LigneGrille, "formatId" | "mode" | "adresse" | "cases">[];
}

function cases(s: SujetClassable): { reseau: ReseauDeclinaison; etat: EtatReseau; code?: string }[] {
  return s.grille.flatMap((l) => (Object.entries(l.cases) as [ReseauDeclinaison, { etat: EtatReseau; code?: string }][]).map(([reseau, c]) => ({ reseau, etat: c.etat, code: c.code })));
}

function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ETATS_PAR_VUE: Record<VueRapide, EtatReseau[]> = {
  "a-relire": ["a-relire", "a-completer"],
  "pret-a-fabriquer": ["validee"],
  "il-manque-une-matiere": [],
  "il-manque-une-preuve": [],
  "a-revoir": ["a-reverifier"],
  "a-programmer": ["en-video"],
};

/** Le sujet relève-t-il de cette vue rapide ? */
export function sujetDansVue(s: SujetClassable, vue: VueRapide): boolean {
  if (vue === "il-manque-une-matiere") return !!s.maitre.manque && ["ANCRAGE_MANQUANT", "MATIERE_INSUFFISANTE", "MATIERE_A_PRECISER"].includes(s.maitre.manque.type);
  if (vue === "il-manque-une-preuve") return s.maitre.manque?.type === "PREUVE_MANQUANTE";
  return cases(s).some((c) => ETATS_PAR_VUE[vue].includes(c.etat));
}

/**
 * Applique les filtres (ET entre critères). `codesFormat` : formatId → code de classement (recherche « SAR »).
 * Le réseau et le format retiennent un sujet qui a AU MOINS une version écrite sur ce réseau / dans ce format.
 */
export function filtrerSujets<S extends SujetClassable>(sujets: S[], f: FiltresScripts, codesFormat: Readonly<Record<string, string>> = {}): S[] {
  const requete = f.q ? analyserRequeteCode(f.q, Object.values(codesFormat)) : null;
  return sujets.filter((s) => {
    const cs = cases(s);
    if (f.reseau && !cs.some((c) => c.reseau === f.reseau && c.etat !== "absent")) return false;
    if (f.format && !s.grille.some((l) => l.formatId === f.format)) return false;
    if (f.qui && !s.grille.some((l) => l.mode === f.qui)) return false;
    if (f.adresse && !s.grille.some((l) => l.adresse === f.adresse)) return false;
    if (f.pilier && s.maitre.brief.pilier !== f.pilier) return false;
    if (f.serie && s.maitre.brief.serieId !== f.serie) return false;
    if (f.etat && !sujetDansVue(s, f.etat)) return false;
    if (f.q) {
      if (requete && "prefixeCode" in requete) {
        const prefixe = requete.prefixeCode;
        return cs.some((c) => !!c.code && (c.code === prefixe || c.code.startsWith(`${prefixe}-`)));
      }
      if (requete && "numero" in requete) return s.maitre.numero === requete.numero;
      if (requete && "codeFormat" in requete) return s.grille.some((l) => codesFormat[l.formatId] === requete.codeFormat);
      const q = sansAccents(f.q);
      return sansAccents(`${s.maitre.brief.idee} ${s.maitre.angle?.titre ?? ""}`).includes(q);
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Bouton « Format » (B.6.4)                                           */
/* ------------------------------------------------------------------ */

export interface FormatClassable {
  id: string;
  nom: string;
  code: string;
  famille: string;
}

export interface FormatAffiche extends FormatClassable {
  nombre: number;
  favori: boolean;
}

/** Favoris : ceux que Will a choisis, sinon les 3 formats qui ont le plus de vidéos (calculé, surchargeable). */
export function favorisCalcules(formats: FormatClassable[], nombres: Readonly<Record<string, number>>, choisis?: string[]): string[] {
  if (choisis?.length) return choisis.filter((id) => formats.some((f) => f.id === id));
  return formats
    .filter((f) => (nombres[f.id] ?? 0) > 0)
    .sort((a, b) => (nombres[b.id] ?? 0) - (nombres[a.id] ?? 0) || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 3)
    .map((f) => f.id);
}

/**
 * Groupes du bouton Format : favoris en premier, puis un groupe par type de vidéo (ordre de `ordreFamilles`), formats
 * sans vidéo masqués (sauf « tout afficher » ou recherche), recherche sur le nom ET le code. Le code reste stable au
 * renommage : c'est lui qui identifie, pas le nom.
 */
export function groupesFormats(
  formats: FormatClassable[],
  nombres: Readonly<Record<string, number>>,
  options: { favoris?: string[]; recherche?: string; toutAfficher?: boolean; ordreFamilles?: string[]; libelleFamille?: (f: string) => string } = {},
): { groupes: { cle: string; libelle: string; formats: FormatAffiche[] }[]; masques: number } {
  const favoris = favorisCalcules(formats, nombres, options.favoris);
  const q = options.recherche ? sansAccents(options.recherche.trim()) : "";
  const tout = options.toutAfficher || !!q;
  const affiches: FormatAffiche[] = formats.map((f) => ({ ...f, nombre: nombres[f.id] ?? 0, favori: favoris.includes(f.id) }));
  const visibles = affiches.filter((f) => (tout || f.nombre > 0 || f.favori) && (!q || sansAccents(f.nom).includes(q) || sansAccents(f.code).startsWith(q)));
  const masques = q ? 0 : affiches.filter((f) => !visibles.includes(f)).length;
  const tri = (a: FormatAffiche, b: FormatAffiche) => b.nombre - a.nombre || a.nom.localeCompare(b.nom, "fr");
  const groupes: { cle: string; libelle: string; formats: FormatAffiche[] }[] = [];
  const fav = visibles.filter((f) => f.favori).sort(tri);
  if (fav.length) groupes.push({ cle: "favoris", libelle: "Favoris", formats: fav });
  const familles = [...new Set([...(options.ordreFamilles ?? []), ...visibles.map((f) => f.famille)])];
  for (const fam of familles) {
    const siens = visibles.filter((f) => !f.favori && f.famille === fam).sort(tri);
    if (siens.length) groupes.push({ cle: fam, libelle: options.libelleFamille?.(fam) ?? fam, formats: siens });
  }
  return { groupes, masques };
}

/* ------------------------------------------------------------------ */
/* Ordre et heure de publication (B.5.5, B.6.12)                       */
/* ------------------------------------------------------------------ */

/** Ordre proposé par défaut (`hyp-ordre-publication`) : TikTok J, Reels J+1, Shorts J+2, LinkedIn J+3, Facebook J+4. */
export const ORDRE_PUBLICATION_PAR_DEFAUT: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"];
/** Réseaux décalés au jour ouvré suivant quand leur jour tombe un week-end (v5 : LinkedIn). */
export const RESEAUX_JOUR_OUVRE: readonly ReseauDeclinaison[] = ["linkedin"];

export interface CreneauPropose {
  reseau: ReseauDeclinaison;
  /** AAAA-MM-JJ */
  jour: string;
  /** Rang dans l'ordre : J+0, J+1… (avant décalage week-end). */
  rang: number;
  /** « 09:30 » si Will l'a réglée pour ce réseau ; sinon rien (jamais une « meilleure heure »). */
  heure?: string;
  decaleWeekEnd: boolean;
}

function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function jourSemaine(jour: string): number {
  return new Date(`${jour}T12:00:00Z`).getUTCDay();
}

/** Ordre complet et valide : l'ordre réglé, sans doublon ni inconnu, complété par l'ordre par défaut. */
export function ordreValide(ordre?: readonly string[]): ReseauDeclinaison[] {
  const connus = (ordre ?? []).filter((r): r is ReseauDeclinaison => (ORDRE_PUBLICATION_PAR_DEFAUT as readonly string[]).includes(r));
  return [...new Set([...connus, ...ORDRE_PUBLICATION_PAR_DEFAUT])];
}

/**
 * Jours proposés (un ESPACEMENT d'au moins 24 h entre deux réseaux, pas une « meilleure heure ») pour les réseaux d'un
 * sujet, à partir du jour J : le n-ième réseau de l'ordre part à J+n ; LinkedIn tombé un week-end passe au lundi.
 */
export function planifierPublications(
  jourJ: string,
  reseaux: readonly ReseauDeclinaison[],
  ordre: readonly string[] = ORDRE_PUBLICATION_PAR_DEFAUT,
  heures: Partial<Record<ReseauDeclinaison, string>> = {},
): CreneauPropose[] {
  const presents = ordreValide(ordre).filter((r) => reseaux.includes(r));
  return presents.map((reseau, rang) => {
    let jour = ajouterJours(jourJ, rang);
    let decaleWeekEnd = false;
    if (RESEAUX_JOUR_OUVRE.includes(reseau)) {
      const js = jourSemaine(jour);
      if (js === 6 || js === 0) {
        jour = ajouterJours(jour, js === 6 ? 2 : 1);
        decaleWeekEnd = true;
      }
    }
    const heure = heures[reseau];
    return { reseau, jour, rang, heure: heure && /^\d{2}:\d{2}$/.test(heure) ? heure : undefined, decaleWeekEnd };
  });
}

/** Monte ou descend un réseau dans l'ordre (un toucher) ; renvoie un nouvel ordre complet. */
export function deplacerDansOrdre(ordre: readonly string[], reseau: ReseauDeclinaison, sens: -1 | 1): ReseauDeclinaison[] {
  const o = ordreValide(ordre);
  const i = o.indexOf(reseau);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= o.length) return o;
  [o[i], o[j]] = [o[j], o[i]];
  return o;
}

/* ------------------------------------------------------------------ */
/* Ce que Buffer transmet (vérifié en G1b)                             */
/* ------------------------------------------------------------------ */

/**
 * Champs que Buffer accepte à la création d'une publication, par réseau. Relevé dans le schéma de l'interface Buffer
 * (`CreatePostInput.metadata`) le 02/10/2026. Ce qui n'est pas transmis devient un rappel « à coller » dans le kit.
 */
export const CHAMPS_BUFFER = {
  verifieLe: "2026-10-02",
  source: "Schéma Buffer, CreatePostInput.metadata (YoutubePostMetadataInput, TikTokPostMetadataInput, InstagramPostMetadataInput…)",
  parReseau: {
    tiktok: { titre: true, premierCommentaire: false, commentaireEpingle: false, motsCles: false, instantCouverture: true },
    instagram: { titre: false, premierCommentaire: true, commentaireEpingle: false, motsCles: false, instantCouverture: true },
    "youtube-shorts": { titre: true, premierCommentaire: false, commentaireEpingle: false, motsCles: false, instantCouverture: true },
    linkedin: { titre: false, premierCommentaire: true, commentaireEpingle: false, motsCles: false, instantCouverture: true },
    facebook: { titre: false, premierCommentaire: true, commentaireEpingle: false, motsCles: false, instantCouverture: true },
  } satisfies Record<ReseauDeclinaison, { titre: boolean; premierCommentaire: boolean; commentaireEpingle: boolean; motsCles: boolean; instantCouverture: boolean }>,
} as const;

/** Champs de la version qui ne partent PAS avec Buffer : le kit les affiche « à coller ». */
export function champsACollerALaMain(reseau: ReseauDeclinaison, champs: { titres?: unknown; commentaireEpingle?: string; motsClesDeclares?: string[]; sources?: string[] }): ("titre" | "premierCommentaire" | "commentaireEpingle" | "motsCles")[] {
  const b = CHAMPS_BUFFER.parReseau[reseau];
  const r: ("titre" | "premierCommentaire" | "commentaireEpingle" | "motsCles")[] = [];
  if (champs.titres && !b.titre) r.push("titre");
  if (champs.sources?.length && !b.premierCommentaire) r.push("premierCommentaire");
  if (champs.commentaireEpingle && !b.commentaireEpingle) r.push("commentaireEpingle");
  if (champs.motsClesDeclares?.length && !b.motsCles) r.push("motsCles");
  return r;
}

/**
 * Réseaux proposés par la feuille Buffer : une vidéo issue d'une version est VERROUILLÉE sur le réseau de sa version
 * (B.5.5) ; « autreReseau » (confirmation « réseau différent ») rouvre le choix. Sans version : choix libre.
 */
export function reseauxProposesBuffer<R extends string>(tous: readonly R[], reseauVersion?: string, autreReseau = false): R[] {
  if (!reseauVersion || autreReseau) return [...tous];
  return tous.filter((r) => r === reseauVersion);
}

/* ------------------------------------------------------------------ */
/* Sujet sensible (v5, écran Sujet) : PROPOSÉ par le code, jamais imposé */
/* ------------------------------------------------------------------ */

const MOTS_SENSIBLES: Record<"juridique" | "donnees" | "financier" | "rh", RegExp> = {
  juridique: /\b(juridique|loi|lois|l[ée]gal|ill[ée]gal|contrat|contentieux|tribunal|avocat|amende|sanction|pv|proc[eè]s|cnil|dpo|rgpd|conformit[ée]|responsabilit[ée])\b/i,
  donnees: /\b(donn[ée]es personnelles|donn[ée]es clients?|fichiers? clients?|confidentialit[ée]|fuite de donn[ée]es)\b/i,
  financier: /\b(imp[ôo]ts?|fiscal|fiscalit[ée]|tva|urssaf|comptabilit[ée] l[ée]gale|bilan comptable)\b/i,
  rh: /\b(licenci\w*|prud.?hom\w*|salari[ée]s? protég[ée]s?|rupture conventionnelle|droit du travail)\b/i,
};

/** Sujet sensible repéré dans l'idée (la pastille « Qui parle » passe alors à « Je lis », un toucher la remet). */
export function detecterSujetSensible(texte: string): "juridique" | "donnees" | "financier" | "rh" | undefined {
  for (const [k, re] of Object.entries(MOTS_SENSIBLES) as [keyof typeof MOTS_SENSIBLES, RegExp][]) if (re.test(texte)) return k;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Sujet déjà traité (C56 à l'écran Sujet ; vérification E2E n° 1, n° 8) */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set(["les", "des", "une", "dans", "pour", "avec", "sans", "leur", "leurs", "vous", "votre", "vos", "nous", "notre", "nos", "est", "sont", "qui", "que", "quoi", "comment", "pourquoi", "faites", "fait", "faire", "chaque", "tous", "toutes", "tout", "plus", "moins", "encore", "cette", "ces", "son", "ses", "aux", "par", "sur", "entre", "elle", "ils", "elles", "mais", "donc", "car", "quand", "dont"]);

/** Mots pleins ramenés à leur racine (sans accents, sans pluriel) : base de la ressemblance entre deux sujets. */
export function racinesIdee(texte: string): Set<string> {
  const mots = texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m))
    .map((m) => (m.length > 4 ? m.replace(/(es|s|x|e)$/, "") : m));
  return new Set(mots);
}

export interface SujetDejaEcrit {
  id: string;
  numero?: number;
  idee: string;
  /** Date du sujet (création). */
  le: string;
}

/**
 * Sujets déjà traités qui ressemblent à cette idée : mêmes mots pleins à 60 % au moins (sur la plus courte des deux),
 * sur 180 jours, numérotés seulement. Gratuit, avant toute écriture : « Déjà traité en n° 2 le 03/10 ».
 */
export function ideesDejaTraitees(idee: string, passes: SujetDejaEcrit[], maintenant: string, options: { jours?: number; seuil?: number } = {}): (SujetDejaEcrit & { recouvrement: number })[] {
  const a = racinesIdee(idee);
  if (!a.size) return [];
  const jours = options.jours ?? 180;
  const seuil = options.seuil ?? 0.6;
  return passes
    .filter((p) => p.numero !== undefined && (Date.parse(maintenant) - Date.parse(p.le)) / 86_400_000 <= jours)
    .map((p) => {
      const b = racinesIdee(p.idee);
      const communs = [...a].filter((x) => b.has(x)).length;
      return { ...p, recouvrement: b.size ? communs / Math.min(a.size, b.size) : 0 };
    })
    .filter((p) => p.recouvrement >= seuil)
    .sort((x, y) => y.recouvrement - x.recouvrement || y.le.localeCompare(x.le));
}
