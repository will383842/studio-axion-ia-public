/**
 * DÉRIVATIONS PURES DU GÉNÉRATEUR DE SCRIPTS (plan v5 B.2.4, B.2.5). Importable côté client.
 *
 * Toutes reçoivent leurs données en paramètre (les services lisent les dépôts). Rien n'est stocké de ce qui se calcule :
 * état d'un réseau, état d'un sujet, grille, comptes d'utilisation des matières et des preuves.
 * (Le plan les range dans `domaine/derivations.ts` ; ce fichier existe déjà et sert la session du moteur : on garde un
 * fichier à part pour ne pas se disputer les mêmes lignes. Le nom des fonctions fait foi.)
 */
import { codeReseau, RESEAUX_DECLINAISON, reseauDuCode } from "@/reseaux/codes";
import { prononciationsActives, substituerPrononciations, type ContextePrononciation } from "./prononciations";
import type {
  Adresse,
  BlocScript,
  DateIso,
  EtapeEditoriale,
  Id,
  IdReseau,
  Matiere,
  ModeDiction,
  Prononciation,
  Publication,
  Ratio,
  ReseauDeclinaison,
  Script,
  ScriptMaitre,
  SegmentScript,
  TypeMatiere,
  VarianteReseau,
  Video,
} from "./types";

/* ------------------------------------------------------------------ */
/* Codes et noms de fichiers (B.2.4, B.6.10)                           */
/* ------------------------------------------------------------------ */

/** Suffixe de corps par mode, dans l'ordre fixe mode puis adresse : `-L` je lis, `-I` j'improvise, `-V` voix off. */
export const SUFFIXE_MODE: Readonly<Record<ModeDiction, string>> = { avatar: "", teleprompteur: "L", trame: "I", "voix-off": "V" };
/** Suffixe d'adresse : `-T` pour « tu », rien pour « vous ». */
export const SUFFIXE_ADRESSE: Readonly<Record<Adresse, string>> = { vous: "", tu: "T" };

export function numeroSur4(numero: number): string {
  return String(numero).padStart(4, "0");
}

/** Code d'une version par réseau : « 0042-AV-TT », « 0042-AV-TT-L-T », « 0043-SAR-YS ». Stable d'une version à l'autre. */
export function codeVariante(p: { numero: number; codeFormat: string; reseau: IdReseau; mode?: ModeDiction; adresse?: Adresse }): string {
  const parts = [numeroSur4(p.numero), p.codeFormat, codeReseau(p.reseau)];
  const m = SUFFIXE_MODE[p.mode ?? "avatar"];
  const a = SUFFIXE_ADRESSE[p.adresse ?? "vous"];
  if (m) parts.push(m);
  if (a) parts.push(a);
  return parts.join("-");
}

const MOTIF_CODE = /^(\d{4,})-([A-Z]{2,3})-([A-Z]{2})(?:-(L|I|V))?(?:-(T))?$/;

/** Lit un code de version (recherche « 0042-AV-TT-L ») ; null s'il est mal formé. */
export function analyserCode(code: string): { numero: number; codeFormat: string; reseau: IdReseau; mode: ModeDiction; adresse: Adresse } | null {
  const m = MOTIF_CODE.exec(code.trim().toUpperCase());
  if (!m) return null;
  const reseau = reseauDuCode(m[3]);
  if (!reseau) return null;
  const mode = (Object.keys(SUFFIXE_MODE) as ModeDiction[]).find((k) => SUFFIXE_MODE[k] === (m[4] ?? "")) ?? "avatar";
  return { numero: Number(m[1]), codeFormat: m[2], reseau, mode, adresse: m[5] ? "tu" : "vous" };
}

function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Titre court d'un nom de fichier : 4 mots au plus, minuscules sans accents, tirets. */
export function titreCourt(titre: string): string {
  const mots = sansAccents(titre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((m) => m.length > 1 || /\d/.test(m));
  return mots.slice(0, 4).join("-").slice(0, 40).replace(/-+$/, "") || "sujet";
}

/**
 * Nom de fichier : `<code>-<titre-court>-<ratio>[-A2][-vN].<ext>` (B.6.10), par exemple
 * `0042-AV-TT-L-donnees-chatgpt-9x16-v2.mp4`. `-A2` (`-A3`…) = 2e accroche testée : jamais un code de version.
 * Sous-titres : même racine (`.srt`, `.vtt`), sans ratio.
 */
export function nomFichier(p: { code: string; titre: string; extension: string; ratio?: Ratio; essaiAccroche?: number; version?: number }): string {
  const parts = [p.code, titreCourt(p.titre)];
  if (p.ratio) parts.push(p.ratio.replace(":", "x"));
  if (p.essaiAccroche && p.essaiAccroche >= 2) parts.push(`A${p.essaiAccroche}`);
  if (p.version && p.version > 1) parts.push(`v${p.version}`);
  return `${parts.join("-")}.${p.extension.replace(/^\./, "")}`;
}

/* ------------------------------------------------------------------ */
/* Texte, empreintes, assemblage (B.2.5, B.2.6)                        */
/* ------------------------------------------------------------------ */

/** Empreinte courte et stable d'un texte (FNV-1a 32 bits + longueur), calculable côté client. */
export function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${texte.length.toString(36)}`;
}

export function texteDesBlocs(blocs: BlocScript[]): string {
  return blocs.flatMap((b) => b.segments.map((s) => s.texte.trim())).filter(Boolean).join(" ");
}

/** Empreinte du corps (segments facultatifs compris) : une version dont l'empreinte diffère doit être revue (B.2.6). */
export function empreinteCorps(blocsCorps: BlocScript[]): string {
  return empreinte(JSON.stringify(blocsCorps.map((b) => [b.blocRecette, b.segments.map((s) => [s.texte.trim(), s.facultatif ?? ""])])));
}

/** Répartit un texte complet en ouverture, corps et fin selon les parties déclarées par la recette résolue. */
export function repartirBlocs(blocs: BlocScript[], parties: { ouverture: string[]; fin: string[] }): { ouverture: BlocScript[]; corps: BlocScript[]; fin: BlocScript[] } {
  return {
    ouverture: blocs.filter((b) => parties.ouverture.includes(b.blocRecette)),
    corps: blocs.filter((b) => !parties.ouverture.includes(b.blocRecette) && !parties.fin.includes(b.blocRecette)),
    fin: blocs.filter((b) => parties.fin.includes(b.blocRecette)),
  };
}

/** Le segment est-il dit sur ce réseau ? Un segment facultatif ne l'est que sur SON réseau, s'il y est retenu. */
export function segmentRetenu(s: Pick<SegmentScript, "facultatif">, variante: Pick<VarianteReseau, "reseau" | "segmentFacultatifRetenu">): boolean {
  return !s.facultatif || (s.facultatif === variante.reseau && variante.segmentFacultatifRetenu);
}

/** Ouverture + corps (segments facultatifs inclus ou non) + fin : le texte d'UNE version par réseau. */
export function assemblerBlocs(script: Pick<Script, "blocs">, variante: Pick<VarianteReseau, "ouverture" | "fin" | "reseau" | "segmentFacultatifRetenu">): BlocScript[] {
  const corps = script.blocs
    .map((b) => ({ ...b, segments: b.segments.filter((s) => segmentRetenu(s, variante)) }))
    .filter((b) => b.segments.length > 0);
  return [...variante.ouverture, ...corps, ...variante.fin];
}

/**
 * Texte DIT de chaque segment, calculé depuis le texte affiché par le SEUL point d'application des prononciations
 * (`prononciationsActives`, B.0 n° 24). Le texte affiché ne change jamais.
 */
export function appliquerPrononciations(segments: SegmentScript[], dictionnaire: Prononciation[], contexte: ContextePrononciation = {}): (SegmentScript & { texteDit: string })[] {
  const actives = prononciationsActives(dictionnaire, contexte);
  return segments.map((s) => ({ ...s, texteDit: substituerPrononciations(s.texte, actives) }));
}

/* ------------------------------------------------------------------ */
/* États : source de vérité (B.2.5)                                    */
/* ------------------------------------------------------------------ */

export type EtatReseau = "absent" | "a-relire" | "a-completer" | "a-reverifier" | "validee" | "en-video" | "programmee" | "publiee" | "probleme";

/** Du moins avancé au plus avancé (l'état d'un sujet = celui de sa version la moins avancée). */
export const ORDRE_ETATS_RESEAU: readonly EtatReseau[] = ["a-completer", "a-reverifier", "a-relire", "probleme", "validee", "en-video", "programmee", "publiee"];

/** Versions COURANTES : non archivées, la plus haute version de chaque code. */
export function versionsCourantes<V extends Pick<VarianteReseau, "code" | "version" | "archiveLe">>(variantes: V[], options: { avecArchivees?: boolean } = {}): V[] {
  const parCode = new Map<string, V>();
  for (const v of variantes) {
    const d = parCode.get(v.code);
    if (!d || v.version > d.version) parCode.set(v.code, v);
  }
  return [...parCode.values()].filter((v) => options.avecArchivees || !v.archiveLe);
}

/**
 * État d'un réseau pour une version : son état d'écriture tant qu'elle n'est pas validée, puis ce que disent la vidéo
 * et les publications. Une publication « simulation » ne compte jamais (AV2.4-4).
 */
export function etatReseau(
  variante: Pick<VarianteReseau, "id" | "etat" | "reseau" | "archiveLe"> | null | undefined,
  video: Pick<Video, "id" | "statut"> | null | undefined,
  publications: Pick<Publication, "videoId" | "varianteId" | "reseau" | "statut" | "via">[] = [],
): EtatReseau {
  if (!variante || variante.archiveLe) return "absent";
  if (variante.etat !== "validee") return variante.etat;
  const siennes = publications.filter((p) => p.via !== "simulation" && p.reseau === variante.reseau && (p.varianteId === variante.id || (!!video && p.videoId === video.id)));
  if (siennes.some((p) => p.statut === "publiee")) return "publiee";
  if (siennes.some((p) => p.statut === "programmee")) return "programmee";
  if (siennes.some((p) => p.statut === "echec")) return "probleme";
  if (video && video.statut === "echec") return "probleme";
  if (video && video.statut === "prete") return "en-video";
  return "validee";
}

/** Copie éditoriale d'une vidéo rattachée : `etatReseau` fait foi, `Video.etapeEditoriale` n'en est qu'un reflet. */
export function etapeEditorialeDe(etat: EtatReseau): EtapeEditoriale | undefined {
  switch (etat) {
    case "a-relire":
    case "a-completer":
    case "a-reverifier":
      return "a_relire";
    case "validee":
    case "en-video":
    case "probleme":
      return "validee";
    case "programmee":
      return "programmee";
    case "publiee":
      return "publiee";
    default:
      return undefined;
  }
}

/** `Script.statutEditorial` d'un texte rattaché : « valide » si et seulement si TOUTES ses versions courantes sont validées. */
export function statutEditorialDerive(scriptId: Id, variantes: Pick<VarianteReseau, "code" | "version" | "archiveLe" | "scriptId" | "etat">[]): "valide" | "brouillon" {
  const siennes = versionsCourantes(variantes).filter((v) => v.scriptId === scriptId);
  return siennes.length > 0 && siennes.every((v) => v.etat === "validee") ? "valide" : "brouillon";
}

export type EtatSujet = NonNullable<ScriptMaitre["etat"]> | Exclude<EtatReseau, "absent">;

/** État d'un sujet : `etat` s'il est posé, sinon l'état le MOINS avancé de ses versions courantes. */
export function etatSujet(
  maitre: Pick<ScriptMaitre, "id" | "etat" | "archiveLe">,
  variantes: Pick<VarianteReseau, "id" | "code" | "version" | "archiveLe" | "scriptMaitreId" | "etat" | "reseau" | "videoId">[],
  videos: Pick<Video, "id" | "statut" | "varianteId">[] = [],
  publications: Pick<Publication, "videoId" | "varianteId" | "reseau" | "statut" | "via">[] = [],
): EtatSujet {
  const courantes = versionsCourantes(variantes.filter((v) => v.scriptMaitreId === maitre.id)).filter((v) => !v.archiveLe);
  // Un arrêt résiduel d'un AJOUT (« + Je lis » arrêté) n'efface pas l'état des versions déjà écrites (E2E n° 1, n° 22).
  if (maitre.etat && !(courantes.length && (maitre.etat === "a-completer" || maitre.etat === "echec"))) return maitre.etat;
  const etats = courantes.map((v) => etatReseau(v, videos.find((x) => x.varianteId === v.id) ?? null, publications));
  const presents = etats.filter((e): e is Exclude<EtatReseau, "absent"> => e !== "absent");
  if (!presents.length) return "brouillon";
  const moins = presents.reduce((a, b) => (ORDRE_ETATS_RESEAU.indexOf(b) < ORDRE_ETATS_RESEAU.indexOf(a) ? b : a));
  // Mode essai : des versions validées toutes programmées (envoi simulé compris) se lisent « programmé ».
  if (moins === "validee" || moins === "en-video") {
    const prog = (v: (typeof courantes)[number]) => publications.some((p) => p.reseau === v.reseau && (p.varianteId === v.id || (!!v.videoId && p.videoId === v.videoId)) && (p.statut === "programmee" || p.statut === "publiee"));
    if (courantes.every((v) => v.etat === "validee" && prog(v))) return "programmee";
  }
  return moins;
}

/* ------------------------------------------------------------------ */
/* Grille d'un sujet (B.6.2)                                           */
/* ------------------------------------------------------------------ */

export interface CaseGrille {
  etat: EtatReseau;
  varianteId?: Id;
  code?: string;
}

export interface LigneGrille {
  formatId: string;
  mode: ModeDiction;
  adresse: Adresse;
  scriptIds: Id[];
  cases: Record<ReseauDeclinaison, CaseGrille>;
}

const ORDRE_MODES: ModeDiction[] = ["avatar", "teleprompteur", "trame", "voix-off"];

/**
 * Une ligne par (format, mode, adresse) : « Avocat », « Avocat · je lis »… ; 5 cases réseau (`etatReseau`).
 * En corps distinct, plusieurs textes partagent la même ligne (un par réseau). Les textes archivés et les anciennes
 * versions d'un texte (remplacées par une version plus récente) sont ignorés.
 */
export function grilleSujet(
  maitre: Pick<ScriptMaitre, "id">,
  scripts: Pick<Script, "id" | "formatId" | "mode" | "adresse" | "scriptMaitreId" | "archiveLe" | "creeLe" | "parentId">[],
  variantes: Pick<VarianteReseau, "id" | "code" | "version" | "archiveLe" | "scriptMaitreId" | "scriptId" | "etat" | "reseau" | "formatId">[],
  videos: Pick<Video, "id" | "statut" | "varianteId">[] = [],
  publications: Pick<Publication, "videoId" | "varianteId" | "reseau" | "statut" | "via">[] = [],
  reseaux: readonly ReseauDeclinaison[] = RESEAUX_DECLINAISON,
): LigneGrille[] {
  const duSujet = scripts.filter((s) => s.scriptMaitreId === maitre.id && !s.archiveLe);
  const siens = duSujet.filter((s) => !duSujet.some((x) => x.parentId === s.id)).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const courantes = versionsCourantes(variantes.filter((v) => v.scriptMaitreId === maitre.id));
  const lignes: LigneGrille[] = [];
  const formats: string[] = [];
  for (const s of siens) {
    if (!formats.includes(s.formatId)) formats.push(s.formatId);
    const mode = s.mode ?? "avatar";
    const adresse = s.adresse ?? "vous";
    let ligne = lignes.find((l) => l.formatId === s.formatId && l.mode === mode && l.adresse === adresse);
    if (!ligne) {
      ligne = { formatId: s.formatId, mode, adresse, scriptIds: [], cases: Object.fromEntries(reseaux.map((r) => [r, { etat: "absent" }])) as Record<ReseauDeclinaison, CaseGrille> };
      lignes.push(ligne);
    }
    ligne.scriptIds.push(s.id);
  }
  for (const l of lignes) {
    for (const r of reseaux) {
      const v = courantes.find((x) => l.scriptIds.includes(x.scriptId) && x.reseau === r);
      if (v) l.cases[r] = { etat: etatReseau(v, videos.find((x) => x.varianteId === v.id) ?? null, publications), varianteId: v.id, code: v.code };
    }
  }
  return lignes.sort(
    (a, b) => formats.indexOf(a.formatId) - formats.indexOf(b.formatId) || ORDRE_MODES.indexOf(a.mode) - ORDRE_MODES.indexOf(b.mode) || (a.adresse === b.adresse ? 0 : a.adresse === "vous" ? -1 : 1),
  );
}

/* ------------------------------------------------------------------ */
/* Utilisations des matières et des preuves : CALCULÉES, jamais stockées */
/* ------------------------------------------------------------------ */

export interface EntreesUtilisation {
  maitres: Pick<ScriptMaitre, "id" | "numero" | "ancrages" | "idees" | "appuiPrincipal" | "exception" | "envoi" | "accrochesFinalistes" | "archiveLe">[];
  scripts: Pick<Script, "id" | "scriptMaitreId" | "blocs" | "archiveLe">[];
  variantes: Pick<VarianteReseau, "id" | "code" | "version" | "archiveLe" | "scriptMaitreId" | "scriptId" | "etat" | "reseau" | "ouverture" | "fin" | "caracteristiques" | "avisWill" | "modifieLe">[];
}

export interface Utilisations {
  /** Nombre de sujets VALIDÉS qui l'ont utilisée (l'usage n'est consommé qu'à la validation, n° 44). */
  nombre: number;
  derniere?: DateIso;
  /** « A servi dans n° 42 : TikTok, LinkedIn ». */
  sujets: { scriptMaitreId: Id; numero?: number; reseaux: ReseauDeclinaison[]; le: DateIso }[];
}

function segmentsDe(blocs: BlocScript[]): SegmentScript[] {
  return blocs.flatMap((b) => b.segments);
}

function utilisations(entrees: EntreesUtilisation, dansMaitre: (m: EntreesUtilisation["maitres"][number]) => boolean, dansSegment: (s: SegmentScript) => boolean, dansFiche: (v: EntreesUtilisation["variantes"][number]) => boolean): Utilisations {
  const sujets: Utilisations["sujets"] = [];
  for (const m of entrees.maitres) {
    if (m.archiveLe) continue;
    const scripts = entrees.scripts.filter((s) => s.scriptMaitreId === m.id && !s.archiveLe);
    const validees = versionsCourantes(entrees.variantes.filter((v) => v.scriptMaitreId === m.id)).filter((v) => v.etat === "validee");
    if (!validees.length) continue;
    const parLeSujet = dansMaitre(m) || scripts.some((s) => segmentsDe(s.blocs).some(dansSegment));
    const concernees = validees.filter((v) => parLeSujet || dansFiche(v) || segmentsDe([...v.ouverture, ...v.fin]).some(dansSegment));
    if (!concernees.length) continue;
    const le = concernees.map((v) => v.avisWill?.le ?? v.caracteristiques?.figeeLe ?? v.modifieLe).sort().at(-1)!;
    sujets.push({ scriptMaitreId: m.id, numero: m.numero, reseaux: RESEAUX_DECLINAISON.filter((r) => concernees.some((v) => v.reseau === r)), le });
  }
  sujets.sort((a, b) => b.le.localeCompare(a.le));
  return { nombre: sujets.length, derniere: sujets[0]?.le, sujets };
}

export function utilisationsMatiere(id: Id, entrees: EntreesUtilisation): Utilisations {
  return utilisations(
    entrees,
    (m) => m.ancrages.some((a) => a.matiereId === id) || !!m.idees?.some((i) => i.matiereIds?.includes(id)) || m.appuiPrincipal?.matiereId === id || m.exception?.matiereId === id || !!m.accrochesFinalistes?.some((a) => a.matiereIds?.includes(id)),
    (s) => !!s.matiereIds?.includes(id) || s.sourceTexte?.matiereId === id,
    (v) => !!v.caracteristiques?.matiereIds.includes(id),
  );
}

export function utilisationsPreuve(id: Id, entrees: EntreesUtilisation): Utilisations {
  return utilisations(
    entrees,
    (m) => !!m.idees?.some((i) => i.preuveIds.includes(id)) || m.appuiPrincipal?.preuveId === id || m.exception?.preuveId === id || !!m.envoi?.preuveIds.includes(id) || !!m.accrochesFinalistes?.some((a) => a.preuveIds.includes(id)),
    (s) => !!s.preuveIds?.includes(id),
    (v) => !!v.caracteristiques?.preuvesCitees.some((p) => p.id === id),
  );
}

/* ------------------------------------------------------------------ */
/* Heuristiques gratuites, toujours confirmées d'un toucher (B.2.9)    */
/* ------------------------------------------------------------------ */

/** Lexique du concret : métiers, objets et lieux qui rendent un ancrage précis (C31). Complété en G2. */
export const LEXIQUE_CONCRET: readonly string[] = [
  "comptable", "expert-comptable", "daf", "drh", "dirigeant", "gerant", "associe", "assistante", "commercial", "commerciale", "technicien", "artisan", "avocat", "notaire", "boulanger", "restaurateur",
  "excel", "tableau", "tableur", "onglet", "onglets", "facture", "factures", "devis", "fichier", "classeur", "mail", "mails", "courriel", "logiciel", "erp", "crm", "planning", "bon de commande", "chatgpt",
  "entrepot", "atelier", "usine", "magasin", "agence", "bureau", "chantier", "boutique", "comite", "reunion",
];

/** Le détail concret d'un texte (chiffre, objet, métier ou lieu nommé, nom propre) ; null : l'ancrage est « faible » (C31). */
export function detailConcret(texte: string, lexique: readonly string[] = LEXIQUE_CONCRET): string | null {
  const chiffre = /\d+(?:[,.]\d+)?(?:\s?(?:%|€|h|heures?|jours?|ans?|mois|onglets?|versions?|clients?|salariés?))?/i.exec(texte);
  if (chiffre) return chiffre[0];
  const normalise = ` ${sansAccents(texte).toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  const mot = lexique.find((m) => normalise.includes(` ${sansAccents(m).toLowerCase()} `));
  if (mot) return mot;
  // Nom propre : un mot à majuscule qui n'ouvre pas une phrase.
  const nom = /(?<![.!?]\s|^)(?<=\s)([A-ZÀ-Ý][a-zà-ÿ]+(?:\s[A-ZÀ-Ý][a-zà-ÿ]+)*)/.exec(texte.trim());
  return nom ? nom[1] : null;
}

/** Thème (pilier) proposé par mots-clés ; undefined si aucun mot ne correspond. */
export function proposerPilier(texte: string, piliers: { id: string; motsCles: string[] }[]): string | undefined {
  const t = ` ${sansAccents(texte).toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  let meilleur: { id: string; score: number } | undefined;
  for (const p of piliers) {
    const score = p.motsCles.filter((m) => t.includes(` ${sansAccents(m).toLowerCase()} `) || t.includes(` ${sansAccents(m).toLowerCase()}s `)).length;
    if (score > 0 && (!meilleur || score > meilleur.score)) meilleur = { id: p.id, score };
  }
  return meilleur?.id;
}

/**
 * Type de matière proposé (critères écrits, B.2.9) : guillemets → parole ; « ? » → question reçue ; « sauf si » → limite ;
 * « beaucoup pensent » → idée reçue ; passé à la 1re personne → anecdote ; constat sur plusieurs entreprises → observation ;
 * faits à la 3e personne sur un client → cas client ; étude, actualité, démonstration ; sinon un avis, au présent.
 */
export function proposerTypeMatiere(texte: string): TypeMatiere {
  const t = texte.trim();
  const n = sansAccents(t).toLowerCase().replace(/’/g, "'");
  // E2E-2 parcours n° 13 : un type annoncé en tête (« Actualité : … », « Étude : … ») est celui que Will a dit.
  const annonce = /^(actualite|actu|info|etude|enquete|sondage|limite|question|avis|observation|anecdote)s?\s*:/.exec(n)?.[1];
  const annonces: Record<string, TypeMatiere> = { actualite: "actualite", actu: "actualite", info: "actualite", etude: "etude", enquete: "etude", sondage: "etude", limite: "limite", question: "question-recue", avis: "avis-will", observation: "observation", anecdote: "anecdote-will" };
  if (annonce && annonces[annonce]) return annonces[annonce];
  if (/[«"“][^»"”]{8,}[»"”]/.test(t)) return "parole-dirigeant";
  if (/\?\s*$/.test(t)) return "question-recue";
  // Propos d'un TIERS (« un dirigeant m'a dit », « nous a dit ») : jamais l'avis de Will (« rien d'inventé », E2E n° 1, n° 12).
  if (/\b(m'a|m'ont|nous a|nous ont|lui a|leur a)\s+(dit|confie|raconte|explique|avoue|lache|ecrit|repondu)\b|\b(me|nous) (disait|disaient|confiait|racontait)\b/.test(n)) {
    return /\b(mon|notre|un|une|nos|des) clients?\b|\b(mon|notre|une|un|nos|des) clientes?\b|\bsociete\b/.test(n) ? "cas-client" : "parole-dirigeant";
  }
  // Une scène générale à la 3e personne (« Dans une PME, une personne passe… », « Ce qu'on voit souvent… ») : observation.
  if (/^(dans (une?|les|beaucoup de|bien des) (pme|tpe|entreprises?|equipes?|societes?|cabinets?|services?)\b|ce qu'on voit|on voit souvent|souvent,|en general,)/.test(n)) return "observation";
  if (/\b(sauf si|a moins que|ca ne marche pas (quand|si)|ne fonctionne pas (quand|si))\b/.test(n)) return "limite";
  if (/\b(beaucoup|la plupart des gens|on|tout le monde|les dirigeants)\s+(pense|pensent|croit|croient|imagine|imaginent)\b/.test(n)) return "idee-recue";
  if (/\b(la premiere fois que j|j'ai|je suis|j'etais|nous avons|on a)\s+[a-z]+(e|i|is|it|u|ert|ait)\b/.test(n)) return "anecdote-will";
  if (/\b(dans (presque )?(toutes|tous|la plupart)|chez (presque )?tous|la plupart des (pme|entreprises|dirigeants))\b/.test(n)) return "observation";
  // Vérif A1 : un constat sur plusieurs entreprises au milieu de la phrase (« Chaque vendredi, dans beaucoup de PME, … »).
  if (/\b(dans|chez) (beaucoup|nombre|bien) d(e |es )(pme|tpe|entreprises|equipes|societes|cabinets|dirigeants)\b/.test(n)) return "observation";
  if (/\b(mon|notre|un|une) client(e)?\b/.test(n) && /\d/.test(n)) return "cas-client";
  if (/https?:\/\/|\b(etude|selon (une|l'|le|la)|enquete|sondage)\b/.test(n)) return "etude";
  if (/\b(nouvelle loi|vient de (sortir|paraitre)|entre en vigueur|depuis le \d)\b/.test(n)) return "actualite";
  // Une date du mois et de l'année (« en septembre 2026 », « le 12 mars 2026 ») : une actualité datée.
  if (/\b(en|depuis|le \d{1,2}(er)?|au|debut|fin|mi-?)\s*(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre) 20\d\d\b/.test(n)) return "actualite";
  if (/\b(a l'ecran|je montre|demonstration|en direct)\b/.test(n)) return "demonstration";
  return "avis-will";
}

/** Une matière est-elle disponible pour la machine (validée, ni retirée, ni archivée, ni périmée) ? */
export function matiereDisponible(m: Pick<Matiere, "statut" | "retrait" | "archiveLe" | "perimeLe">, maintenant: DateIso): boolean {
  return m.statut === "validee" && !m.retrait && !m.archiveLe && !(m.perimeLe && m.perimeLe <= maintenant);
}
