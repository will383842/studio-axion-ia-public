/**
 * MATIÈRES : saisie, découpe d'une dictée, jauge, retrait (générateur, plan v5 B.2.9, lot G2). PUR : importable côté client.
 *
 * Règle d'or : une matière est citée MOT POUR MOT. Le code découpe une dictée en morceaux qui sont TOUJOURS des
 * sous-chaînes exactes de ce que Will a dicté (positions `debut`/`fin` dans la dictée) ; aucun mot n'est changé, ajouté
 * ni retiré. Tout ce que propose la machine (type, noms à masquer, rangement) reste à confirmer d'un toucher.
 */
import type { DateIso, Id, Matiere, Preuve, Publication, Script, ScriptMaitre, SegmentScript, TypeMatiere, VarianteReseau, Video } from "./types";
import { estPerimee, expireBientot } from "./preuves";
import { detailConcret, etatReseau, matiereDisponible, proposerTypeMatiere, versionsCourantes, type EtatReseau } from "./derivations-generateur";

/* ------------------------------------------------------------------ */
/* Libellés (les seuls mots que Will voit pour les 11 types)            */
/* ------------------------------------------------------------------ */

export const TYPES_MATIERE: readonly TypeMatiere[] = [
  "question-recue",
  "avis-will",
  "observation",
  "parole-dirigeant",
  "cas-client",
  "idee-recue",
  "anecdote-will",
  "limite",
  "etude",
  "actualite",
  "demonstration",
];

export const LIBELLES_MATIERE: Readonly<Record<TypeMatiere, { court: string; pluriel: string; manque: string }>> = {
  "anecdote-will": { court: "Anecdote", pluriel: "Anecdotes", manque: "des anecdotes" },
  "avis-will": { court: "Avis", pluriel: "Avis", manque: "des avis tranchés" },
  "cas-client": { court: "Cas client", pluriel: "Cas clients", manque: "des cas clients" },
  "parole-dirigeant": { court: "Parole de dirigeant", pluriel: "Paroles", manque: "des phrases de dirigeants" },
  "question-recue": { court: "Question reçue", pluriel: "Questions", manque: "des questions de clients" },
  observation: { court: "Observation", pluriel: "Observations", manque: "des observations" },
  "idee-recue": { court: "Idée reçue", pluriel: "Idées reçues", manque: "des idées reçues" },
  etude: { court: "Étude", pluriel: "Études", manque: "des études" },
  actualite: { court: "Actualité", pluriel: "Actualités", manque: "des actualités" },
  demonstration: { court: "Démonstration", pluriel: "Démos", manque: "des démonstrations" },
  limite: { court: "Limite", pluriel: "Limites", manque: "des limites (« sauf si… »)" },
};

/** Types dont la citation exige l'accord de la personne (C55). */
export function accordRequis(type: TypeMatiere): boolean {
  return type === "cas-client" || type === "parole-dirigeant";
}

/** Types dont les faits vivent dans une Preuve (la matière POINTE vers elle, jamais de copie). */
export function exigePreuve(type: TypeMatiere): type is "cas-client" | "etude" {
  return type === "cas-client" || type === "etude";
}

/* ------------------------------------------------------------------ */
/* Découpe d'une dictée en vrac : VERBATIM garanti                      */
/* ------------------------------------------------------------------ */

export interface MorceauDictee {
  /** Exactement `dictee.slice(debut, fin)`. */
  texte: string;
  debut: number;
  fin: number;
}

const OUVRANTS = new Set(["«", "“", "„"]);
const FERMANTS = new Set(["»", "”"]);

/**
 * Découpe une dictée en morceaux : sauts de ligne, puis fins de phrase (. ! ? …) suivies d'un blanc, HORS guillemets.
 * Un point suivi d'une minuscule (« etc. et »), ou d'un chiffre collé (« 3.5 »), ne coupe pas. Chaque morceau est une
 * sous-chaîne EXACTE de la dictée (blancs du bord retirés) : aucun mot n'est changé.
 */
export function decouperDictee(dictee: string): MorceauDictee[] {
  const morceaux: MorceauDictee[] = [];
  let debut = 0;
  let guillemets = 0;
  let droits = false; // guillemets droits " … "
  const pousser = (fin: number) => {
    let a = debut;
    let b = fin;
    while (a < b && /\s/.test(dictee[a])) a++;
    while (b > a && /\s/.test(dictee[b - 1])) b--;
    if (b > a && /[\p{L}\p{N}]/u.test(dictee.slice(a, b))) morceaux.push({ texte: dictee.slice(a, b), debut: a, fin: b });
  };
  for (let i = 0; i < dictee.length; i++) {
    const c = dictee[i];
    if (OUVRANTS.has(c)) guillemets++;
    else if (FERMANTS.has(c) || (c === '"' && droits)) {
      if (c === '"') droits = false;
      else guillemets = Math.max(0, guillemets - 1);
      // Citation fermée sur une fin de phrase (« … pas. ») : la phrase s'arrête après le guillemet.
      const avantGuillemet = dictee.slice(debut, i).replace(/\s+$/, "");
      if (guillemets === 0 && !droits && /[.!?…]$/.test(avantGuillemet)) {
        let k = i + 1;
        while (k < dictee.length && /[ \t ]/.test(dictee[k])) k++;
        if (k > i + 1 && k < dictee.length && !/\p{Ll}/u.test(dictee[k]) && dictee[k] !== "\n") {
          pousser(i + 1);
          debut = i + 1;
        }
      }
      continue;
    } else if (c === '"') droits = true;
    if (c === "\n" || c === "\r") {
      pousser(i);
      debut = i + 1;
      guillemets = 0;
      droits = false;
      continue;
    }
    if (guillemets > 0 || droits) continue;
    if (c === "." || c === "!" || c === "?" || c === "…") {
      // Ponctuation groupée (« ?! », « ... ») et guillemet fermant collé : la phrase s'arrête après.
      let j = i + 1;
      while (j < dictee.length && /[.!?…»”"]/.test(dictee[j])) j++;
      if (j >= dictee.length) continue;
      if (!/\s/.test(dictee[j])) continue;
      let k = j;
      while (k < dictee.length && /[ \t ]/.test(dictee[k])) k++;
      const suivant = dictee[k];
      if (suivant && c === "." && /\p{Ll}/u.test(suivant)) continue;
      pousser(j);
      debut = j;
      i = j - 1;
    }
  }
  pousser(dictee.length);
  return morceaux;
}

/** Vérif A1 : à partir de 3 phrases, le texte de Will est un TEXTE COLLÉ (et non « une phrase à vous »). */
export const PHRASES_TEXTE_COLLE = 3;
/** Morceau minimal d'un texte collé (mots) : une phrase plus courte rejoint la suivante. */
const MOTS_MIN_MORCEAU = 6;

/** Le texte de Will est-il un texte collé (3 phrases ou plus) ? */
export function estTexteColle(texte: string | undefined): boolean {
  return !!texte && decouperDictee(texte).length >= PHRASES_TEXTE_COLLE;
}

/**
 * Vérif A1 (constat prod du 09/10) : un texte COLLÉ par Will ne devient plus UNE matière d'un seul type (le texte entier
 * classé « limite » faisait dire « il manque le pourquoi » à un texte qui le contenait) : il est découpé comme une
 * dictée en vrac (`decouperDictee`), MOT POUR MOT (rien n'est réécrit ni ajouté), une phrase trop courte rejoignant la
 * suivante ; chaque morceau devient une matière avec son type. Moins de 3 phrases : le texte reste entier.
 */
export function decouperTexteWill(texte: string): string[] {
  const t = texte.trim();
  if (!estTexteColle(t)) return t ? [t] : [];
  const morceaux: string[] = [];
  let attente = "";
  for (const { texte: p } of decouperDictee(t)) {
    attente = attente ? `${attente} ${p}` : p;
    if (attente.split(/\s+/).length >= MOTS_MIN_MORCEAU) {
      morceaux.push(attente);
      attente = "";
    }
  }
  if (attente) {
    if (morceaux.length) morceaux[morceaux.length - 1] = `${morceaux[morceaux.length - 1]} ${attente}`;
    else morceaux.push(attente);
  }
  return morceaux;
}

/** Chaque morceau est-il une sous-chaîne EXACTE de la dictée ? (contrôle de toute sortie, celle de la machine comprise) */
export function estVerbatim(dictee: string, texte: string): boolean {
  return texte.trim().length > 0 && dictee.includes(texte);
}

/** Les mots de la dictée, dans l'ordre (pour vérifier qu'une découpe n'en a perdu ni changé aucun). */
export function motsDe(texte: string): string[] {
  return texte.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
}

/**
 * Vérifie la sortie d'un rangement (celui du code ou celui de « Ranger pour moi ») : un morceau qui n'est pas une
 * sous-chaîne exacte de la dictée est REJETÉ (jamais corrigé).
 */
export function verifierRangement<T extends { texte: string }>(dictee: string, sortie: T[]): { gardes: T[]; rejetes: T[] } {
  const gardes: T[] = [];
  const rejetes: T[] = [];
  for (const m of sortie) (estVerbatim(dictee, m.texte) ? gardes : rejetes).push(m);
  return { gardes, rejetes };
}

/* ------------------------------------------------------------------ */
/* Noms à masquer (C59) et texte qui ressemble à une consigne (C58)     */
/* ------------------------------------------------------------------ */

/** Mots à majuscule qui ne sont pas des noms de personnes ou d'entreprises clientes (outils, sigles du métier, lieux génériques). */
export const MOTS_CONNUS: readonly string[] = [
  "IA", "PME", "TPE", "ETI", "DAF", "DRH", "RH", "CRM", "ERP", "RGPD", "TVA", "URSSAF", "OPCO", "CPF", "PDF", "SaaS",
  "ChatGPT", "GPT", "Claude", "Copilot", "Gemini", "Mistral", "OpenAI", "Excel", "Word", "Outlook", "Teams", "Google", "Microsoft",
  "Sheets", "Notion", "Zapier", "Make", "LinkedIn", "TikTok", "Instagram", "Facebook", "YouTube", "Shorts", "Buffer", "Axion-IA", "Axion",
  "France", "Paris", "Lyon", "Europe", "Internet", "Je", "On", "Il", "Elle", "Nous", "Vous", "Ils", "Elles", "Un", "Une", "Le", "La", "Les",
  "Dans", "Chez", "Mon", "Ma", "Mes", "Notre", "Nos", "Ce", "Cette", "Est-ce", "Quand", "Pourquoi", "Comment", "Beaucoup", "Sauf",
];

/**
 * Noms propres repérés, PROPOSÉS pour `nomsSensibles` (un toucher). Un mot à majuscule hors début de phrase et hors
 * des mots connus, ou une suite d'au moins deux mots à majuscule (« Marc Durand »), même en tête de phrase.
 */
export function proposerNomsSensibles(texte: string, connus: readonly string[] = MOTS_CONNUS): string[] {
  const connu = new Set(connus.map((m) => m.toLowerCase()));
  const trouves = new Set<string>();
  const re = /[\p{Lu}][\p{L}'’-]*(?:\s+[\p{Lu}][\p{L}'’-]*)*/gu;
  for (const m of texte.matchAll(re)) {
    const avant = texte.slice(0, m.index).replace(/\s+$/, "");
    const debutPhrase = avant === "" || /[.!?…:«“"\n]$/.test(avant);
    const mots = m[0].split(/\s+/);
    const inconnus = mots.filter((x) => !connu.has(x.toLowerCase()) && !/^\p{Lu}{2,}$/u.test(x));
    // Deux mots inconnus ou plus à la suite (« Marc Durand ») : un nom, même en tête de phrase.
    if (inconnus.length >= 2 && inconnus.length === mots.filter((x) => !connu.has(x.toLowerCase())).length && mots.length >= 2) {
      trouves.add(inconnus.join(" "));
      continue;
    }
    // Sinon, mot par mot : le premier mot d'une phrase n'est pas un nom (majuscule de début).
    mots.forEach((x, i) => {
      if (i === 0 && debutPhrase) return;
      if (inconnus.includes(x)) trouves.add(x);
    });
  }
  // E2E-1 n° 13 (addendum §2 quinquies 4) : la VILLE d'un client l'identifie aussi. Une ville connue (« Lyon ») n'est
  // pas un nom inconnu, mais « à Lyon », « de Lyon », « près de Lyon » est proposé au masquage.
  for (const m of texte.matchAll(/(?:^|[\s(])(?:à|a|de|d['’]|sur|près de|vers|en)\s*([\p{Lu}][\p{L}'’-]+)/gu)) {
    if (VILLES_CONNUES.has(m[1].toLowerCase())) trouves.add(m[1]);
  }
  return [...trouves];
}

/** Villes de la liste des mots connus (les pays et régions ne sont pas proposés). */
const VILLES_CONNUES = new Set(["paris", "lyon", "marseille", "toulouse", "nice", "nantes", "strasbourg", "montpellier", "bordeaux", "lille", "rennes", "villeexemple", "annecy", "chambéry", "saint-étienne", "clermont-ferrand", "dijon", "valence"]);

/** Domaines dont une adresse est connue (le reste rend la matière « à confirmer », C58). */
export const DOMAINES_CONNUS: readonly string[] = ["axion-ia.com", "legifrance.gouv.fr", "service-public.fr", "economie.gouv.fr", "insee.fr", "bpifrance.fr", "cnil.fr"];

/** Un texte qui ressemble à une consigne donnée à une machine reste « à confirmer » (C58). Renvoie la raison, ou null. */
export function ressembleInstruction(texte: string, domaines: readonly string[] = DOMAINES_CONNUS): string | null {
  const t = texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/\b(ignore[rsz]?|oublie[rsz]?)\b.{0,40}\b(instructions?|consignes?|regles?|ce qui precede)\b/.test(t)) return "Ressemble à une consigne (« ignore… »).";
  if (/\btu es (un|une|le|la|desormais|maintenant)\b/.test(t)) return "Ressemble à une consigne (« tu es… »).";
  if (/\bconsignes?\b/.test(t)) return "Contient le mot « consigne ».";
  for (const m of texte.matchAll(/https?:\/\/([^/\s]+)/gi)) {
    const hote = m[1].toLowerCase().replace(/^www\./, "");
    if (!domaines.some((d) => hote === d || hote.endsWith(`.${d}`))) return `Adresse web inconnue (${hote}).`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Mots-clés (comparaison avec un sujet, B.3.9)                         */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set(
  "alors aussi autre avant avec avoir bien cela cest cette comme dans depuis des donc elle elles encore est etre fait faire leur leurs mais meme moins nous notre nos pour plus quand que quel quelle qui sans ses son sont sous sur tout tous toute toutes tres une vous votre vos parce chaque fois deja jamais rien entre".split(/\s+/),
);

/** Mots-clés d'un texte : mots de 5 lettres ou plus, sans accents, hors mots vides, au plus 6. */
export function motsClesDe(texte: string): string[] {
  const mots = texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 5 && !MOTS_VIDES.has(m));
  return [...new Set(mots)].slice(0, 6);
}

/* ------------------------------------------------------------------ */
/* État affiché d'une matière                                          */
/* ------------------------------------------------------------------ */

export interface EtatMatiere {
  disponible: boolean;
  perimee: boolean;
  expireBientot: boolean;
  /** Cas client ou parole sans accord : jamais citée (C55). */
  accordManquant: boolean;
  /** Observation ou idée reçue sans détail concret : ancrage « faible » (C31). */
  faible: boolean;
  aConfirmer: boolean;
  retiree: boolean;
}

export function etatMatiere(m: Matiere, maintenant: DateIso): EtatMatiere {
  const accordManquant = accordRequis(m.type) && !m.accord?.obtenu;
  return {
    disponible: matiereDisponible(m, maintenant) && !accordManquant,
    perimee: estPerimee(m.perimeLe, maintenant),
    expireBientot: expireBientot(m.type, m.perimeLe, maintenant),
    accordManquant,
    faible: (m.type === "observation" || m.type === "idee-recue") && !detailConcret(m.texte),
    aConfirmer: m.statut === "a-confirmer",
    retiree: !!m.retrait,
  };
}

/* ------------------------------------------------------------------ */
/* Jauge du carburant (Accueil, onglet Matières)                        */
/* ------------------------------------------------------------------ */

/** Types qui font la variété des ancrages (l'anecdote reste minoritaire, la limite sert à l'exception). */
const TYPES_VARIETE: readonly TypeMatiere[] = ["question-recue", "avis-will", "observation", "parole-dirigeant", "idee-recue", "cas-client"];

export interface Jauge {
  /** « De quoi faire ≈ N sujets variés ». */
  sujets: number;
  disponibles: number;
  parType: Record<TypeMatiere, number>;
  /** Le type le moins fourni parmi ceux qui font la variété. */
  manqueSurtout?: TypeMatiere;
  expirentBientot: number;
  /** 0 à 1, pour la barre : 1 à partir de 20 sujets. */
  remplissage: number;
}

/**
 * Jauge : sujets variés possibles avec les matières disponibles. Une limite ne porte pas un sujet ; l'anecdote de Will
 * est plafonnée à une sur quatre (C52) dès qu'il y a au moins 3 autres matières.
 */
export function jaugeCarburant(matieres: Matiere[], maintenant: DateIso): Jauge {
  const parType = Object.fromEntries(TYPES_MATIERE.map((t) => [t, 0])) as Record<TypeMatiere, number>;
  let expirent = 0;
  for (const m of matieres) {
    const e = etatMatiere(m, maintenant);
    if (!e.disponible) continue;
    parType[m.type]++;
    if (e.expireBientot) expirent++;
  }
  const disponibles = Object.values(parType).reduce((a, b) => a + b, 0);
  const anecdotes = parType["anecdote-will"];
  const autres = disponibles - anecdotes - parType.limite;
  const anecdotesComptees = autres >= 3 ? Math.min(anecdotes, Math.floor(autres / 3)) : anecdotes;
  const sujets = autres + anecdotesComptees;
  const manqueSurtout = [...TYPES_VARIETE].sort((a, b) => parType[a] - parType[b] || TYPES_VARIETE.indexOf(a) - TYPES_VARIETE.indexOf(b))[0];
  return { sujets, disponibles, parType, manqueSurtout, expirentBientot: expirent, remplissage: Math.min(1, sujets / 20) };
}

/* ------------------------------------------------------------------ */
/* Retrait : versions touchées (B.0 n° 56, B.2.9)                       */
/* ------------------------------------------------------------------ */

export type CategorieTouchee = "a-completer" | "a-revoir" | "programmee" | "publiee";

export interface VersionTouchee {
  varianteId: Id;
  code: string;
  reseau: VarianteReseau["reseau"];
  scriptMaitreId: Id;
  numero?: number;
  etat: EtatReseau;
  categorie: CategorieTouchee;
  /** Publications programmées (un bouton « Déprogrammer » chacune, jamais automatique) ou publiées. */
  publications: Pick<Publication, "id" | "reseau" | "date" | "statut" | "via" | "urlPubliee">[];
}

export interface EntreesRetrait {
  maitres: Pick<ScriptMaitre, "id" | "numero" | "ancrages" | "idees" | "appuiPrincipal" | "exception" | "envoi" | "accrochesFinalistes" | "archiveLe" | "brief">[];
  scripts: Pick<Script, "id" | "scriptMaitreId" | "blocs" | "archiveLe">[];
  variantes: Pick<VarianteReseau, "id" | "code" | "version" | "archiveLe" | "scriptMaitreId" | "scriptId" | "etat" | "reseau" | "ouverture" | "fin" | "caracteristiques" | "videoId">[];
  videos: Pick<Video, "id" | "statut" | "varianteId">[];
  publications: Pick<Publication, "id" | "videoId" | "varianteId" | "reseau" | "statut" | "via" | "date" | "urlPubliee">[];
}

/** Ce que l'on cherche : des matières (ids) et des preuves (ids). Une preuve retirée touche aussi les matières qui la citent. */
export interface CibleRetrait {
  matiereIds: Id[];
  preuveIds: Id[];
}

function segmentTouche(s: SegmentScript, c: CibleRetrait): boolean {
  return !!s.matiereIds?.some((id) => c.matiereIds.includes(id)) || (!!s.sourceTexte && c.matiereIds.includes(s.sourceTexte.matiereId)) || !!s.preuveIds?.some((id) => c.preuveIds.includes(id));
}

function maitreTouche(m: EntreesRetrait["maitres"][number], c: CibleRetrait): boolean {
  const mat = (id?: Id) => !!id && c.matiereIds.includes(id);
  const pr = (ids?: Id[]) => !!ids?.some((id) => c.preuveIds.includes(id));
  return (
    m.ancrages.some((a) => mat(a.matiereId)) ||
    !!m.brief.matiereIdsImposees?.some(mat) ||
    !!m.idees?.some((i) => i.matiereIds?.some(mat) || pr(i.preuveIds)) ||
    mat(m.appuiPrincipal?.matiereId) ||
    (!!m.appuiPrincipal?.preuveId && c.preuveIds.includes(m.appuiPrincipal.preuveId)) ||
    mat(m.exception?.matiereId) ||
    (!!m.exception?.preuveId && c.preuveIds.includes(m.exception.preuveId)) ||
    pr(m.envoi?.preuveIds) ||
    !!m.accrochesFinalistes?.some((a) => a.matiereIds?.some(mat) || pr(a.preuveIds))
  );
}

/**
 * TOUTES les versions courantes (non rangées) qui utilisent la cible : par le fond du sujet, par un segment du corps,
 * de l'ouverture ou de la fin, ou par la fiche figée. Classées selon ce qu'il faut faire :
 * non validée → « à compléter » ; validée non programmée → « à revoir » ; programmée → « Déprogrammer » (un toucher par
 * publication) ; publiée → fiche « Que faire ».
 */
export function versionsTouchees(cible: CibleRetrait, e: EntreesRetrait): VersionTouchee[] {
  const sortie: VersionTouchee[] = [];
  for (const m of e.maitres) {
    if (m.archiveLe) continue;
    const parLeFond = maitreTouche(m, cible) || e.scripts.some((s) => s.scriptMaitreId === m.id && !s.archiveLe && s.blocs.some((b) => b.segments.some((x) => segmentTouche(x, cible))));
    for (const v of versionsCourantes(e.variantes.filter((x) => x.scriptMaitreId === m.id))) {
      const parLaVersion =
        [...v.ouverture, ...v.fin].some((b) => b.segments.some((x) => segmentTouche(x, cible))) ||
        !!v.caracteristiques?.matiereIds.some((id) => cible.matiereIds.includes(id)) ||
        !!v.caracteristiques?.preuvesCitees.some((p) => cible.preuveIds.includes(p.id));
      if (!parLeFond && !parLaVersion) continue;
      const video = e.videos.find((x) => x.varianteId === v.id) ?? null;
      const etat = etatReseau(v, video, e.publications);
      const siennes = e.publications.filter((p) => p.via !== "simulation" && p.reseau === v.reseau && (p.varianteId === v.id || (!!video && p.videoId === video.id)));
      const categorie: CategorieTouchee =
        etat === "publiee" ? "publiee" : etat === "programmee" ? "programmee" : etat === "validee" || etat === "en-video" || etat === "probleme" ? "a-revoir" : "a-completer";
      sortie.push({
        varianteId: v.id,
        code: v.code,
        reseau: v.reseau,
        scriptMaitreId: m.id,
        numero: m.numero,
        etat,
        categorie,
        publications: siennes
          .filter((p) => (categorie === "publiee" ? p.statut === "publiee" : categorie === "programmee" ? p.statut === "programmee" : false))
          .map((p) => ({ id: p.id, reseau: p.reseau, date: p.date, statut: p.statut, via: p.via, urlPubliee: p.urlPubliee })),
      });
    }
  }
  return sortie.sort((a, b) => a.code.localeCompare(b.code));
}

/** Matières qui citent une preuve (elles tombent avec elle). */
export function matieresDeLaPreuve(preuveId: Id, matieres: Pick<Matiere, "id" | "preuveId">[]): Id[] {
  return matieres.filter((m) => m.preuveId === preuveId).map((m) => m.id);
}

/** Fiche « Que faire » d'une version publiée (B.2.9) : rien d'automatique, retirer la vidéo reste un geste de Will. */
export const QUE_FAIRE_PUBLIEE: readonly string[] = [
  "Épingler un commentaire de correction",
  "Ranger la vidéo dans le studio",
  "Écrire une nouvelle version sans cette matière",
];

/** Type proposé par le code, réexporté pour les écrans (confirmé d'un toucher). */
export { proposerTypeMatiere };

/** Une preuve est-elle disponible pour la machine (validée, ni retirée, ni rangée, ni périmée) ? */
export function preuveDisponible(p: Pick<Preuve, "statut" | "retrait" | "archiveLe" | "perimeLe">, maintenant: DateIso): boolean {
  return p.statut === "validee" && !p.retrait && !p.archiveLe && !estPerimee(p.perimeLe, maintenant);
}

/* ------------------------------------------------------------------ */
/* Limite validée d'un sujet (vérification E2E n° 1, problème n° 9)     */
/* ------------------------------------------------------------------ */

/**
 * Une limite PROPOSÉE PAR LA MACHINE puis validée par Will (« C'est juste ») ne devient PAS une matière libre : elle est
 * réservée au sujet qui l'a portée (jamais reprise seule au sujet suivant, jamais rangée dans « Mes matières » comme si
 * Will l'avait dictée). La réserve est écrite dans `source.detail`.
 */
export const PREFIXE_LIMITE_DU_SUJET = "Limite validée pour le sujet ";

export function sujetReserveDe(m: Pick<Matiere, "source">): Id | undefined {
  const d = m.source.detail;
  return d?.startsWith(PREFIXE_LIMITE_DU_SUJET) ? d.slice(PREFIXE_LIMITE_DU_SUJET.length).trim() : undefined;
}

/** Une matière peut-elle servir à ce sujet ? (les limites réservées ne servent qu'au leur) */
export function matierePourSujet(m: Pick<Matiere, "source">, sujetId: Id): boolean {
  const r = sujetReserveDe(m);
  return !r || r === sujetId;
}

/** Motif d'un retrait, en mots simples (Journal ; mêmes mots que les boutons de « Retirer »). */
export const LIBELLES_MOTIF_RETRAIT: Readonly<Record<NonNullable<Matiere["retrait"]>["motif"], string>> = {
  "accord-retire": "accord retiré",
  faux: "c'est faux",
  dementi: "démenti",
  autre: "autre raison",
};

/** Sorte de preuve, en mots simples (Journal). */
export const LIBELLES_TYPE_PREUVE: Readonly<Record<Preuve["type"], string>> = {
  "chiffre-interne": "chiffre maison",
  "cas-client": "cas client",
  etude: "étude",
  "regle-loi": "règle de loi",
};
