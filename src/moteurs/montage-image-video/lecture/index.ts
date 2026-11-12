/**
 * IMAGE → VIDÉO · L5 · Lecteur d'image : préparation, DOUBLE lecture Claude Opus (vision), fusion par le code, écarts,
 * alertes, refus (plan § 1, § 2, I2).
 *
 * 1. Préparation (`preparation.ts`) : PNG, image entière + 4 tuiles ×2 ; refus si < 800 px de côté.
 * 2. Deux appels INDÉPENDANTS du même rôle (`consigne.ts`), chacun avec l'image entière et les 4 tuiles, dans un ordre
 *    inverse (a : entière d'abord ; b : tuiles d'abord). Aucun ne voit la réponse de l'autre. Chaque appel est précédé
 *    de la réservation de son pire coût (`pireCasRole`) ; refus de réservation → aucun appel. Une réponse illisible ou
 *    coupée est relancée une fois au plus (réservée elle aussi).
 * 3. Fusion PAR LE CODE : blocs appariés par leur texte (puis leur rang), flèches par leurs deux bouts, groupes par leur
 *    sorte et leurs membres. Tout désaccord devient un ÉCART (champ, lecture A, lecture B) que Will tranche ; la valeur
 *    gardée est celle de la lecture A (ou celle qui existe). Un bloc ou une flèche vu par une seule lecture est gardé
 *    avec une ALERTE ; un chiffre écrit dans une seule lecture porte `lu: "une-seule"`. Une photo de personnes vue par
 *    l'une des deux lectures est marquée (jamais reprise).
 * 4. Refus en une phrase : moins de 3 textes lus, aucun bloc lu. Le type reconnu par aucune lecture est déduit par le code
 *    (Will peut l'imposer) ; un titre ou une phrase du bas absents sont déduits, avec une alerte (jamais de refus).
 * 5. Carte complétée par le code (`completerCarte`, L1 : chiffres, formules, cohérence, type), puis contrôlée
 *    (`controlerCarte`) ; le contrôle est rendu avec la carte, jamais caché.
 *
 * Aucun nom de fichier ni aucune clé de stockage n'est transmis à Claude : seules les images et leurs dimensions partent.
 */
import { createHash } from "node:crypto";
import {
  chiffresDeLaCarte,
  coherenceDe,
  completerCarte,
  controlerCarte,
  formulesDeLaCarte,
  estAutomatisation,
  offreDeduite,
  schemaCarteImage,
  textesDeLaCarte,
  TYPES_IMAGE,
  type BrouillonCarte,
  type CarteImage,
  type ControleCarte,
  type GroupeCarte,
  type LienCarte,
  type NoeudCarte,
  type TypeImage,
} from "@/domaine/image-video/carte";
import { chiffresDe, cleChiffre } from "@/domaine/image-video/chiffres";
import { LIMITES_CARTE, normaliserCarteBrute, phraseAdaptation, refusTropChargee } from "@/domaine/image-video/normalisation";
import { reparerEtSignaler } from "@/domaine/image-video/reparation";
import { pireCasRole, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import type { Offre } from "../emprunts";
import { roleLectureImage, schemaLectureImage, variableLecture, type GroupeLu, type LectureImage, type LienLu, type NoeudLu, type SensLecture } from "./consigne";
import { preparerImage, type ConvertirEnPng } from "./preparation";

export { roleLectureImage, schemaLectureImage, type LectureImage } from "./consigne";

/** Étape inscrite sur chaque réservation. */
export const ETAPE_LECTURE = "lecture-image";
/** Appels au plus par lecture (1 + une relance si la réponse est illisible ou coupée). */
export const APPELS_PAR_LECTURE_MAX = 2;
/** En dessous de ce nombre de textes lus, l'image est refusée. */
export const TEXTES_MIN = 3;

export const PHRASE_TYPE_INCONNU = "Je ne reconnais pas ce type d'image : choisissez-le";

/** Réponse d'un appel, telle que la rend le chemin de dépense du studio (même forme que l'écriture du cas concret). */
export type ReponseAppelLecture =
  | { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; invalide?: string; coutUsd?: number }
  | { ok: false; arret: string; message: string };

export interface DemandeReservationLecture {
  appelId: string;
  videoId: string;
  etape: string;
  modele: string;
  coutEstimeUsd: number;
}

export interface OutilsLecture {
  /** Conversion en PNG de l'image entière et des tuiles (serveur ; double en simulation). */
  convertir: ConvertirEnPng;
  /** UN appel du rôle, branché par le service sur le chemin de dépense existant (client Claude du studio). */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelLecture>;
  /** Réserve le pire coût AVANT l'appel ; refus → aucun appel. */
  budget: { reserver: (demande: DemandeReservationLecture) => Promise<{ ok: true } | { ok: false; message: string }> };
}

export interface EntreeLecture {
  videoId: string;
  /** Fichier déposé. `cle` (stockage) et `empreinte` vont dans la carte, JAMAIS vers Claude. */
  source: { cle: string; octets: Uint8Array; empreinte?: string };
  /** Type imposé par Will après un refus « type inconnu » (ou à tout moment) : remplace le type calculé. */
  typeImpose?: TypeImage;
  /** Offre corrigée par Will au dépôt ; sinon déduite du type. */
  offre?: Offre;
}

export type MotifRefusLecture = "format" | "trop-petite" | "conversion" | "budget" | "appel" | "illisible" | "sans-texte" | "type-inconnu" | "incomplete" | "trop-chargee";

export type ResultatLecture =
  | { ok: true; carte: CarteImage; controle: ControleCarte; appels: number; simule: boolean; coutUsd?: number }
  | {
      ok: false;
      motif: MotifRefusLecture;
      /** Phrase simple pour Will. */
      message: string;
      appels: number;
      /** Vrai : Will peut imposer le type (`typeImpose`) et relancer sans repayer s'il garde les lectures. */
      choisirType?: boolean;
      /** Lectures déjà payées (gardées pour une reprise sans nouvel appel). */
      lectures?: Partial<Record<SensLecture, LectureImage>>;
    };

// ─── Appels ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const idAppelLecture = (videoId: string, sens: SensLecture, essai: number) => `iv-lecture-${videoId}-${sens}-${essai}`;

type IssueLecture = { ok: true; lecture: LectureImage; simule: boolean; coutUsd?: number } | { ok: false; motif: "budget" | "appel" | "illisible"; message: string };

/** Lit la sortie d'un appel : objet déjà validé (`donnees`), sinon le texte JSON ; une réponse coupée n'est jamais lue. */
function lireLecture(r: Extract<ReponseAppelLecture, { ok: true }>): LectureImage | null {
  if (r.stopReason === "max_tokens") return null;
  let brut: unknown = r.donnees;
  if (brut === undefined && typeof r.texte === "string") {
    try {
      brut = JSON.parse(r.texte);
    } catch {
      return null;
    }
  }
  const v = schemaLectureImage.safeParse(brut);
  return v.success ? v.data : null;
}

async function uneLecture(sens: SensLecture, entree: EntreeRole, videoId: string, outils: OutilsLecture, compte: { appels: number }): Promise<IssueLecture> {
  const role = roleLectureImage as unknown as DefinitionRole;
  let coutUsd: number | undefined;
  for (let essai = 1; essai <= APPELS_PAR_LECTURE_MAX; essai++) {
    const reservation = await outils.budget.reserver({ appelId: idAppelLecture(videoId, sens, essai), videoId, etape: ETAPE_LECTURE, modele: role.modele, coutEstimeUsd: pireCasRole(role, entree) });
    if (!reservation.ok) return { ok: false, motif: "budget", message: `Lecture de l'image non lancée : ${reservation.message}` };
    compte.appels++;
    const r = await outils.appeler(role, entree);
    if (!r.ok) return { ok: false, motif: "appel", message: `Lecture de l'image interrompue : ${r.message}` };
    if (r.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + r.coutUsd;
    const lecture = lireLecture(r);
    if (lecture) return { ok: true, lecture, simule: r.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
  }
  return { ok: false, motif: "illisible", message: "La lecture de l'image n'a pas donné de réponse lisible, même après une relance : relancez la lecture plus tard." };
}

// ─── Fusion ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Ecart {
  champ: string;
  lectureA: string;
  lectureB: string;
}

const net = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
/** Forme lâche pour apparier deux textes (casse, accents et espaces ignorés). */
const lache = (s: string) => net(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Ressemblance de deux textes (coefficient de Dice sur les paires de lettres), de 0 à 1. */
export function ressemblance(a: string, b: string): number {
  const x = lache(a);
  const y = lache(b);
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const paires = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const px = paires(x);
  const py = paires(y);
  let communes = 0;
  for (const [k, n] of px) communes += Math.min(n, py.get(k) ?? 0);
  return (2 * communes) / (x.length - 1 + (y.length - 1));
}

/** Seuil de ressemblance pour apparier deux blocs. */
const SEUIL_BLOC = 0.5;

const parId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);

/** Appariement glouton déterministe : meilleure note d'abord, égalités départagées par le rang puis les ids. */
function apparier<A extends { id: string }, B extends { id: string }>(as: readonly A[], bs: readonly B[], note: (a: A, b: B) => number, seuil: number, depart: (a: A, b: B) => number = () => 0): Map<string, B> {
  const candidats: { a: A; b: B; n: number; d: number }[] = [];
  for (const a of as) for (const b of bs) {
    const n = note(a, b);
    if (n >= seuil) candidats.push({ a, b, n, d: depart(a, b) });
  }
  candidats.sort((x, y) => y.n - x.n || x.d - y.d || x.a.id.localeCompare(y.a.id) || x.b.id.localeCompare(y.b.id));
  const res = new Map<string, B>();
  const prisB = new Set<string>();
  for (const c of candidats) {
    if (res.has(c.a.id) || prisB.has(c.b.id)) continue;
    res.set(c.a.id, c.b);
    prisB.add(c.b.id);
  }
  return res;
}

/** Premier id libre « <prefixe>NN » (NN sur 2 chiffres au moins). */
function idLibre(prefixe: string, pris: Set<string>): string {
  for (let i = 1; ; i++) {
    const id = `${prefixe}${String(i).padStart(2, "0")}`;
    if (!pris.has(id)) return id;
  }
}

const texteDe = (v: unknown): string => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(" / ") : String(v));

export interface Fusion {
  brouillon: BrouillonCarte;
  ecarts: Ecart[];
  alertes: string[];
}

/** Brouillon de carte sans les champs de l'image (ajoutés par `lireImage`). */
type BrouillonSansImage = Omit<BrouillonCarte, "image">;

/**
 * Fusionne deux lectures (PUR, déterministe : l'ordre des listes reçues ne compte pas). La lecture A sert de référence
 * pour les valeurs et les ids ; chaque désaccord devient un écart.
 */
export function fusionnerLectures(a: LectureImage, b: LectureImage): { brouillon: BrouillonSansImage; ecarts: Ecart[]; alertes: string[] } {
  const ecarts: Ecart[] = [];
  const alertes: string[] = [];
  const ecart = (champ: string, va: unknown, vb: unknown) => {
    const ta = texteDe(va);
    const tb = texteDe(vb);
    if (net(ta) !== net(tb)) ecarts.push({ champ, lectureA: ta, lectureB: tb });
  };
  /** Valeur gardée : celle de A, ou celle de B si A n'a rien lu. */
  const garder = (va: string, vb: string) => (net(va) ? net(va) : net(vb));

  if (a.type !== b.type) ecarts.push({ champ: "type", lectureA: a.type, lectureB: b.type });
  for (const champ of ["titre", "sousTitre", "phraseChoc", "signature"] as const) ecart(champ, a[champ], b[champ]);

  // Blocs.
  const noeudsA = [...a.noeuds].sort(parId);
  const noeudsB = [...b.noeuds].sort(parId);
  const texteNoeud = (n: NoeudLu) => `${n.libelle} ${n.detail}`;
  const paireNoeud = apparier(noeudsA, noeudsB, (x, y) => ressemblance(texteNoeud(x), texteNoeud(y)), SEUIL_BLOC, (x, y) => Math.abs(x.ordre - y.ordre));
  const idsPris = new Set(noeudsA.map((n) => n.id));
  const idFinalB = new Map<string, string>();
  for (const [ida, nb] of paireNoeud) idFinalB.set(nb.id, ida);
  const seulsB = noeudsB.filter((n) => !idFinalB.has(n.id));
  for (const n of seulsB) {
    const id = idsPris.has(n.id) ? idLibre("n", idsPris) : n.id;
    idsPris.add(id);
    idFinalB.set(n.id, id);
  }

  // Groupes (membres ramenés aux ids finaux).
  const groupesA = [...a.groupes].sort(parId);
  const groupesB = [...b.groupes].sort(parId).map((g) => ({ ...g, noeuds: g.noeuds.map((i) => idFinalB.get(i) ?? i) }));
  const jaccard = (x: string[], y: string[]) => {
    const sx = new Set(x);
    const sy = new Set(y);
    const inter = [...sx].filter((i) => sy.has(i)).length;
    const union = new Set([...sx, ...sy]).size;
    return union ? inter / union : 0;
  };
  const paireGroupe = apparier(groupesA, groupesB, (x, y) => (x.sorte !== y.sorte ? 0 : (x.id === y.id ? 1 : 0) + jaccard(x.noeuds, y.noeuds)), SEUIL_BLOC);
  const groupesPris = new Set(groupesA.map((g) => g.id));
  const idGroupeB = new Map<string, string>();
  for (const [ida, gb] of paireGroupe) idGroupeB.set(gb.id, ida);
  for (const g of groupesB) {
    if (idGroupeB.has(g.id)) continue;
    let id = g.id;
    for (let i = 2; groupesPris.has(id); i++) id = `${g.id.slice(0, 36)}-${i}`;
    groupesPris.add(id);
    idGroupeB.set(g.id, id);
  }
  const groupeFinalB = (g: string) => (g ? (idGroupeB.get(g) ?? g) : "");

  const noeuds: NoeudCarte[] = [];
  const versNoeud = (n: NoeudLu, id: string, groupe: string, photo: boolean): NoeudCarte => {
    const r: NoeudCarte = { id, libelle: net(n.libelle), role: n.role, couleur: n.couleur, acteur: n.acteur, ordre: n.ordre };
    if (net(n.detail)) r.detail = net(n.detail);
    if (net(n.icone)) r.icone = net(n.icone);
    if (groupe) r.groupe = groupe;
    // Une sortie d'un seul objet est une vraie quantité (entonnoir 20 → 19 + 1) ; le calcul parasite « 1 + 1 ≠ 1 » est
    // écarté là où il naîtrait (`coherenceDe`).
    if (n.quantite !== null && n.quantite > 0) r.quantite = n.quantite;
    const sous = n.sousElements.map(net).filter(Boolean);
    if (sous.length) r.sousElements = sous;
    if (n.exemple) r.exemple = true;
    if (photo) r.photoPersonnes = true;
    return r;
  };
  for (const na of a.noeuds) {
    const nb = paireNoeud.get(na.id);
    if (!nb) {
      noeuds.push(versNoeud(na, na.id, na.groupe, na.photoPersonnes));
      alertes.push(`Le bloc « ${net(na.libelle)} » n'a été vu que par une des deux lectures : vérifiez-le.`);
      ecarts.push({ champ: `noeuds.${na.id}`, lectureA: net(na.libelle), lectureB: "" });
      continue;
    }
    const p = `noeuds.${na.id}`;
    ecart(`${p}.libelle`, na.libelle, nb.libelle);
    ecart(`${p}.detail`, na.detail, nb.detail);
    ecart(`${p}.sousElements`, na.sousElements.map(net), nb.sousElements.map(net));
    ecart(`${p}.role`, na.role, nb.role);
    ecart(`${p}.couleur`, na.couleur, nb.couleur);
    ecart(`${p}.acteur`, na.acteur, nb.acteur);
    ecart(`${p}.icone`, na.icone, nb.icone);
    ecart(`${p}.groupe`, na.groupe, groupeFinalB(nb.groupe));
    ecart(`${p}.quantite`, na.quantite, nb.quantite);
    ecart(`${p}.exemple`, na.exemple ? "oui" : "non", nb.exemple ? "oui" : "non");
    ecart(`${p}.photoPersonnes`, na.photoPersonnes ? "oui" : "non", nb.photoPersonnes ? "oui" : "non");
    const fus: NoeudLu = {
      ...na,
      detail: garder(na.detail, nb.detail),
      icone: garder(na.icone, nb.icone),
      quantite: na.quantite ?? nb.quantite,
      sousElements: na.sousElements.length ? na.sousElements : nb.sousElements,
    };
    // Une photo de personnes vue par l'une des deux lectures n'est jamais reprise (M3).
    noeuds.push(versNoeud(fus, na.id, na.groupe || groupeFinalB(nb.groupe), na.photoPersonnes || nb.photoPersonnes));
  }
  // Vus par B seulement : dans l'ordre des ids (jamais l'ordre reçu), comme tout le reste de la fusion.
  for (const nb of seulsB) {
    const id = idFinalB.get(nb.id)!;
    noeuds.push(versNoeud(nb, id, groupeFinalB(nb.groupe), nb.photoPersonnes));
    alertes.push(`Le bloc « ${net(nb.libelle)} » n'a été vu que par une des deux lectures : vérifiez-le.`);
    ecarts.push({ champ: `noeuds.${id}`, lectureA: "", lectureB: net(nb.libelle) });
  }

  // Flèches (bouts ramenés aux ids finaux), appariées par leurs deux bouts, à rang égal par id.
  const libelle = new Map(noeuds.map((n) => [n.id, n.libelle]));
  const liensB = [...b.liens].sort(parId).map((l) => ({ ...l, de: idFinalB.get(l.de) ?? l.de, vers: idFinalB.get(l.vers) ?? l.vers }));
  const liensA = [...a.liens].sort(parId);
  const paireLien = apparier(liensA, liensB, (x, y) => (x.de === y.de && x.vers === y.vers ? 1 : 0), 1);
  const liensPris = new Set(liensA.map((l) => l.id));
  const vusB = new Set([...paireLien.values()].map((l) => l.id));
  const versLien = (l: LienLu, id: string): LienCarte => {
    const r: LienCarte = { id, de: l.de, vers: l.vers, couleur: l.couleur, style: l.style };
    if (net(l.etiquette)) r.etiquette = net(l.etiquette);
    // « 0 » rendu pour une flèche sans pourcentage écrit : pas une part (« 0 % + 0 % ≠ 100 % », panne du 15/10).
    if (l.part !== null && l.part > 0) r.part = l.part;
    return r;
  };
  const nomLien = (l: Pick<LienLu, "de" | "vers">) => `« ${libelle.get(l.de) ?? "?"} » → « ${libelle.get(l.vers) ?? "?"} »`;
  const liens: LienCarte[] = [];
  for (const la of a.liens) {
    const lb = paireLien.get(la.id);
    if (!lb) {
      liens.push(versLien(la, la.id));
      alertes.push(`La flèche ${nomLien(la)} n'a été vue que par une des deux lectures : vérifiez-la.`);
      ecarts.push({ champ: `liens.${la.id}`, lectureA: nomLien(la), lectureB: "" });
      continue;
    }
    const p = `liens.${la.id}`;
    ecart(`${p}.etiquette`, la.etiquette, lb.etiquette);
    ecart(`${p}.part`, la.part, lb.part);
    ecart(`${p}.couleur`, la.couleur, lb.couleur);
    ecart(`${p}.style`, la.style, lb.style);
    liens.push(versLien({ ...la, etiquette: garder(la.etiquette, lb.etiquette), part: la.part ?? lb.part }, la.id));
  }
  for (const lb of liensB.filter((l) => !vusB.has(l.id))) {
    const id = liensPris.has(lb.id) ? idLibre("l", liensPris) : lb.id;
    liensPris.add(id);
    liens.push(versLien(lb, id));
    alertes.push(`La flèche ${nomLien(lb)} n'a été vue que par une des deux lectures : vérifiez-la.`);
    ecarts.push({ champ: `liens.${id}`, lectureA: "", lectureB: nomLien(lb) });
  }

  // Groupes.
  const versGroupe = (g: GroupeLu, id: string, membres: string[]): GroupeCarte => {
    const r: GroupeCarte = { id, sorte: g.sorte, noeuds: membres };
    if (net(g.titre)) r.titre = net(g.titre);
    if (g.majoritaire) r.majoritaire = true;
    return r;
  };
  const groupes: GroupeCarte[] = [];
  for (const ga of a.groupes) {
    const gb = paireGroupe.get(ga.id);
    if (!gb) {
      groupes.push(versGroupe(ga, ga.id, ga.noeuds));
      ecarts.push({ champ: `groupes.${ga.id}`, lectureA: ga.titre || ga.sorte, lectureB: "" });
      continue;
    }
    const p = `groupes.${ga.id}`;
    ecart(`${p}.titre`, ga.titre, gb.titre);
    ecart(`${p}.majoritaire`, ga.majoritaire ? "oui" : "non", gb.majoritaire ? "oui" : "non");
    ecart(`${p}.noeuds`, [...ga.noeuds].sort(), [...gb.noeuds].sort());
    groupes.push(versGroupe({ ...ga, titre: garder(ga.titre, gb.titre) }, ga.id, ga.noeuds));
  }
  const vusGroupesB = new Set([...paireGroupe.values()].map((g) => g.id));
  for (const gb of groupesB.filter((g) => !vusGroupesB.has(g.id))) {
    const id = idGroupeB.get(gb.id)!;
    groupes.push(versGroupe(gb, id, gb.noeuds));
    ecarts.push({ champ: `groupes.${id}`, lectureA: "", lectureB: gb.titre || gb.sorte });
  }

  // Bandeau et pied : comparés case par case.
  const listes = (champ: "bandeau" | "pied") => {
    const n = Math.max(a[champ].length, b[champ].length);
    const res: string[] = [];
    for (let i = 0; i < n; i++) {
      ecart(`${champ}.${i}`, a[champ][i] ?? "", b[champ][i] ?? "");
      const v = garder(a[champ][i] ?? "", b[champ][i] ?? "");
      if (v) res.push(v);
    }
    return res;
  };

  const brouillon: BrouillonSansImage = {
    version: "carte-image/1",
    titre: garder(a.titre, b.titre),
    phraseChoc: garder(a.phraseChoc, b.phraseChoc),
    noeuds,
    liens,
    groupes,
    bandeau: listes("bandeau"),
    pied: listes("pied"),
    lecture: { ecarts: [], alertes: [] },
  };
  const sousTitre = garder(a.sousTitre, b.sousTitre);
  if (sousTitre) brouillon.sousTitre = sousTitre;
  const signature = garder(a.signature, b.signature);
  if (signature) brouillon.signature = signature;
  return { brouillon, ecarts, alertes };
}

/** Clés des chiffres écrits dans une lecture (tous textes confondus). */
function chiffresLus(l: LectureImage): Set<string> {
  const textes = [l.titre, l.sousTitre, l.phraseChoc, ...l.noeuds.flatMap((n) => [n.libelle, n.detail, ...n.sousElements]), ...l.liens.map((x) => x.etiquette), ...l.bandeau];
  return new Set(textes.flatMap((t) => chiffresDe(t)).map((c) => cleChiffre(c.brut)));
}

/** Nombre de textes lus (non vides) dans la carte fusionnée. */
function textesLus(b: BrouillonSansImage): number {
  return textesDeLaCarte({ ...b, titre: b.titre || " ", phraseChoc: b.phraseChoc || " " }).filter((t) => net(t.texte)).length;
}

// ─── Lecteur ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Empreinte du fichier déposé (SHA-256), si l'appelant n'en fournit pas. */
export function empreinteDe(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

/**
 * Lit une image (voir l'en-tête). `lectures` : lectures déjà payées (reprise après un refus « type inconnu » : Will
 * impose le type, aucune lecture n'est refaite).
 */
export async function lireImage(entree: EntreeLecture, outils: OutilsLecture, lectures?: Partial<Record<SensLecture, LectureImage>>): Promise<ResultatLecture> {
  const prep = await preparerImage(entree.source.octets, outils.convertir);
  if (!prep.ok) return { ok: false, motif: prep.motif, message: prep.message, appels: 0 };

  const compte = { appels: 0 };
  const lues: Partial<Record<SensLecture, LectureImage>> = { ...lectures };
  let simule = true;
  let coutUsd: number | undefined;
  for (const sens of ["a", "b"] as const) {
    if (lues[sens]) continue;
    const images = sens === "a" ? [prep.entiere, ...prep.tuiles] : [...prep.tuiles, prep.entiere];
    const issue = await uneLecture(sens, { contexte: {}, variable: variableLecture(sens, prep.largeur, prep.hauteur), images }, entree.videoId, outils, compte);
    if (!issue.ok) return { ok: false, motif: issue.motif, message: issue.message, appels: compte.appels, lectures: lues };
    lues[sens] = issue.lecture;
    simule &&= issue.simule;
    if (issue.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + issue.coutUsd;
  }
  const a = lues.a!;
  const b = lues.b!;
  const refus = (motif: MotifRefusLecture, message: string, plus: { choisirType?: boolean } = {}): ResultatLecture => ({ ok: false, motif, message, appels: compte.appels, lectures: lues, ...plus });

  const f = fusionnerLectures(a, b);
  if (textesLus(f.brouillon) < TEXTES_MIN) return refus("sans-texte", "Je ne lis presque aucun texte sur cette image (moins de 3) : déposez une image plus nette, avec son texte.");
  if (!f.brouillon.noeuds.length) {
    return refus("incomplete", "Je ne trouve aucun bloc dans l'image : vérifiez qu'elle est entière.");
  }
  // Zéro blocage : un titre ou une phrase du bas manquants sont déduits par le code (jamais vides, jamais un texte déjà
  // utilisé si un autre existe, de préférence sans chiffre : l'inventaire des chiffres ne doit pas être dupliqué), et
  // dits dans les alertes, placées en tête pour survivre à la coupe à 60.
  const deductions: string[] = [];
  const parOrdre = [...f.brouillon.noeuds].sort((x, y) => x.ordre - y.ordre || x.id.localeCompare(y.id));
  const choisir = (candidats: string[], deja: string[]): string => {
    const textes = candidats.map(net).filter(Boolean);
    const neufs = textes.filter((t) => !deja.includes(t));
    return neufs.find((t) => !chiffresDe(t).length) ?? neufs[0] ?? textes[0] ?? "";
  };
  if (!f.brouillon.titre) {
    const sousTitre = net(f.brouillon.sousTitre ?? "");
    const deNoeuds = parOrdre.flatMap((n) => [n.libelle, n.detail ?? "", ...(n.sousElements ?? [])]);
    if (sousTitre) {
      f.brouillon.titre = sousTitre;
      delete f.brouillon.sousTitre;
    } else {
      f.brouillon.titre = choisir(deNoeuds, []) || "Image sans titre";
    }
    deductions.push(`Titre non lu : j'ai pris ${sousTitre ? "le sous-titre" : "le premier bloc"} (« ${f.brouillon.titre} »).`);
  }
  if (!f.brouillon.phraseChoc) {
    const dernierBloc = parOrdre.length ? [parOrdre[parOrdre.length - 1]!.libelle, parOrdre[parOrdre.length - 1]!.detail ?? ""] : [];
    const source = [
      f.brouillon.signature ?? "",
      ...[...f.brouillon.pied].reverse(),
      ...dernierBloc,
    ];
    const reprise = choisir(source, [net(f.brouillon.titre)]);
    f.brouillon.phraseChoc = reprise || f.brouillon.titre;
    deductions.push(`Phrase du bas non lue : j'ai pris ${reprise ? "un texte déjà lu en bas de l'image" : "le titre"} (« ${f.brouillon.phraseChoc} »).`);
  }
  f.alertes.unshift(...deductions);

  const brouillon0: BrouillonCarte = {
    ...f.brouillon,
    image: { cle: entree.source.cle, empreinte: entree.source.empreinte ?? empreinteDe(entree.source.octets), largeur: prep.largeur, hauteur: prep.hauteur, orientation: prep.orientation },
    lecture: { ecarts: f.ecarts.slice(0, 60), alertes: f.alertes.slice(0, 60) },
    ...(entree.offre ? { offre: entree.offre } : {}),
  };
  // R1 : le code RÉPARE ce qui dépasse le schéma (avec une adaptation écrite) avant de le contrôler ; seule une image
  // trop chargée est refusée, avec ce qu'il faut faire.
  const norm = normaliserCarteBrute(brouillon0);
  if (norm.tropChargee) return refus("trop-chargee", norm.tropChargee.message);
  const brouillon = norm.carte;
  const adaptations = norm.adaptations;
  let carte: CarteImage;
  try {
    const nbChiffres = chiffresDeLaCarte(brouillon).length;
    if (nbChiffres > LIMITES_CARTE.chiffres) return refus("trop-chargee", refusTropChargee("chiffres", nbChiffres, LIMITES_CARTE.chiffres).message);
    const enBandeau = chiffresDeLaCarte(brouillon).filter((c) => c.dansBandeau).length;
    if (enBandeau > 12) adaptations.push({ code: "bandeau-chiffres-coupes", avant: String(enBandeau), apres: "12", raison: `${enBandeau} chiffres dans le bandeau : les 12 premiers gardés pour le bandeau (tous restent lus dans les blocs)` });
    const premiere = completerCarte(brouillon);
    // Concordance des chiffres : écrit dans les deux lectures, ou dans une seule (alerte de `controlerCarte`).
    const dansA = chiffresLus(a);
    const dansB = chiffresLus(b);
    const chiffres = premiere.chiffres.map((c) => ({ ...c, lu: dansA.has(cleChiffre(c.brut)) && dansB.has(cleChiffre(c.brut)) ? ("les-deux" as const) : ("une-seule" as const) }));
    carte = completerCarte({ ...premiere, chiffres });
    if (entree.typeImpose) {
      const types: [TypeImage] = [entree.typeImpose];
      carte = schemaCarteImage.parse({ ...carte, types, offre: entree.offre ?? offreDeduite(types), automatisation: estAutomatisation(types) });
    } else if (a.type === "inconnu" && b.type === "inconnu") {
      adaptations.push({ code: "type-deduit", avant: "inconnu", apres: carte.types.join(" + "), raison: `type déduit par le code (${carte.types.join(" + ")}) : aucune des deux lectures ne l'a reconnu` });
    }
    // Calculs et formules coupés au maximum du schéma par `completerCarte` : on le dit. (Au-delà de 40 formules, les
    // suivantes ne sont pas demandées à Will à la porte « carte » ; le script les contrôle de nouveau à sa propre porte.)
    const calculs = coherenceDe(brouillon).length;
    if (calculs > LIMITES_CARTE.calculs) adaptations.push({ code: "calculs-coupes", avant: String(calculs), apres: String(LIMITES_CARTE.calculs), raison: `${calculs} calculs à vérifier : les ${LIMITES_CARTE.calculs} premiers gardés` });
    const formules = formulesDeLaCarte(brouillon).length;
    if (formules > LIMITES_CARTE.formules) adaptations.push({ code: "formules-coupees", avant: String(formules), apres: String(LIMITES_CARTE.formules), raison: `${formules} formules très affirmatives : les ${LIMITES_CARTE.formules} premières gardées` });
    if (adaptations.length) carte = schemaCarteImage.parse({ ...carte, adaptations: adaptations.map(phraseAdaptation).slice(0, 60) });
  } catch {
    // Dernier filet : une carte qui échoue encore au schéma (cas non prévu par la normalisation) ne doit pas boucler.
    return refus("illisible", "La lecture de l'image a donné une carte que je ne sais pas réparer. Réessayer relit l'image (nouvelle lecture, comptée dans le prix) ; si cela recommence, déposez-la de nouveau, plus nette ou découpée en deux.");
  }
  // R2 : une carte incohérente ne bloque pas la vidéo, le code la répare seul (les réparations sont dites dans `carte.adaptations`).
  carte = reparerEtSignaler(carte, { typeChoisi: !!entree.typeImpose }).carte;
  return { ok: true, carte, controle: controlerCarte(carte), appels: compte.appels, simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
}

/** Types que Will peut imposer après un refus « type inconnu ». */
export const TYPES_A_CHOISIR: readonly TypeImage[] = TYPES_IMAGE;
