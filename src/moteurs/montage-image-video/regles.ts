/**
 * IMAGE → VIDÉO · Règles BLOQUANTES du script (plan § 4 et § 7 : Q04 à Q10, Q05 bis, Q08 bis, chapitres). PUR.
 *
 * Le script (fiche `fiche-image/1`) est contrôlé AVANT d'être montré à Will. Un manquement = une phrase pour Will.
 * Ordre de priorité (I9), appliqué au tri des manquements et aux conflits :
 *   1. interdits permanents (« machine », « Villeexemple », « aucun gain garanti », faux client, « certifié / Certifexemple ») :
 *      toujours bloquants, MÊME dans la phrase-choc de l'image (reformulation proposée, Will la valide) ;
 *   2. formules absolues (« zéro erreur », « 0 demande perdue », « dès le premier jour »…) : bloquantes tant que Will n'a
 *      pas choisi « garder » ou « reformuler » ;
 *   3. phrase-choc mot pour mot (version retenue par Will) ;
 *   4. rien d'inventé : un nombre absent de la carte est refusé, sauf s'il vient d'un ajout de Will (accepté et marqué).
 * `pourWill` : ce que seul Will peut trancher (une relance de Claude n'y change rien).
 */
import type { CarteImage } from "@/domaine/image-video/carte";
import { textesDeLaCarte } from "@/domaine/image-video/carte";
import { chiffresDe, type UniteChiffre } from "@/domaine/image-video/chiffres";
import { complexiteDe, DEBIT_MOTS_PAR_SEC, type ComplexiteCarte } from "@/domaine/image-video/complexite";
import { PARTIES, motsDits, motsOrange, phrasesDe, texteDuCorps, type EcranFiche, type FicheImage } from "@/domaine/image-video/fiche";
import { formulesAbsoluesDe } from "@/domaine/image-video/formules";
import { cleFormule, type ChoixFormule } from "@/domaine/image-video/versions-prudentes";
import { texteCompare } from "@/domaine/controles-script/texte";
import { MOTS_INTERDITS_FORMAT, texteAvecNombres } from "./emprunts";
import { refusQuestion } from "./fins";
import { ANNONCE_TROIS_ETAPES, ANNONCE_VOICI_COMMENT, annonceAttendue, ETAPES_RECIT_D, ETIQUETTE_SITUATION_TYPE, ordreDesParties, scenesPermises, situationTypeExigee, type CodeRecit } from "./recettes";
// Ré-exports : ces deux briques vivent dans le domaine (pures), les importeurs existants ne changent pas.
export { cleFormule, type ChoixFormule };

export type CodeRegle = "FORME" | "Q04" | "Q05" | "Q05bis" | "Q06" | "Q07" | "Q08" | "Q08bis" | "Q09" | "Q10" | "CHAPITRES";

export interface Manquement {
  regle: CodeRegle;
  /** 1 interdits, 2 formules absolues, 3 mot pour mot, 4 rien d'inventé, 5 le reste (I9). */
  priorite: 1 | 2 | 3 | 4 | 5;
  ecranId?: string;
  /** Une phrase simple pour Will. */
  message: string;
  /** À trancher par Will (formule absolue, phrase-choc de l'image à reformuler). */
  pourWill?: boolean;
  /** Version proposée (prudente, ou sans le mot interdit). */
  proposition?: string;
}


export interface ContexteRegles {
  carte: CarteImage;
  /** Calculée depuis la carte si absente. */
  complexite?: ComplexiteCarte;
  /** Choix de Will sur les formules absolues, par clé `cleFormule(texte)`, en plus de ceux de la carte. */
  choixFormules?: Readonly<Record<string, ChoixFormule>>;
  /** Textes tapés par Will dans le script (« 30 % ») : ils deviennent une source (I9), acceptée et marquée. */
  ajoutsWill?: readonly string[];
  /** Mots interdits de Will, en plus de ceux du format. */
  interdits?: readonly string[];
  /** Nœuds des chapitres retirés (version courte) : Q04 ne les demande plus. */
  noeudsRetires?: readonly string[];
  /** Déroulé du récit tiré (variété, axe 2) ; absent = REC-A, l'ossature d'aujourd'hui. */
  recit?: CodeRecit;
}

export interface VerdictScript {
  ok: boolean;
  /** Triés par priorité (I9), puis dans l'ordre du script. */
  manquements: Manquement[];
  /** Ce qui est accepté mais signalé (« ajouté par Will »). */
  marques: string[];
  /** Durée estimée du corps au débit de référence. */
  dureeEstimeeSec: number;
}

// ─── Constantes des règles ───────────────────────────────────────────────────────────────────────────────────────────

export const MOTS_PAR_PHRASE_MAX = 12;
/** Règle propre au format (distincte de celle du tableau animé, même valeur). */
export const ACCROCHE_IV_MOTS_MAX = 8;
export const ACCROCHE_FIN_MAX_SEC = 3;
export const QUESTION_MOTS_MAX = 12;
/** Tolérance de la durée estimée autour de la fourchette de la classe (Q10). */
export const TOLERANCE_DUREE_IV = 0.1;

/** Interdits permanents de Will (Q08), en plus de `MOTS_INTERDITS_FORMAT` du cas concret. */
export const INTERDITS_PERMANENTS: readonly string[] = [...MOTS_INTERDITS_FORMAT, "certifié", "certifiée", "certifiés", "Certifexemple"];
/** Faux client : un client présenté comme réel (« un client a… », « notre client »). */
const FAUX_CLIENT = /(?:^|[^a-z])(?:un|une|notre|nos|mon|ma|mes|ce|cette) (?:de nos )?client(?:e)?s? (?:a|ont|nous a|m a|nous ont|est|sont)(?=$|[^a-z])|(?:^|[^a-z])(?:notre|nos) client(?:e)?s?(?=$|[^a-z])/;
/** Phrases d'appel refusées dans le corps (la fin vient de la banque). */
export const TOURNURES_APPEL_CORPS: readonly string[] = ["en commentaire", "commentez", "premier commentaire", "dans la bio", "dans mon profil", "diagnostic gratuit", "abonnez-vous", "le lien"];
/** Renvois en arrière interdits après un chapitre détachable. */
export const RENVOIS: readonly string[] = ["comme on l a vu", "on l a vu", "comme vu", "plus haut", "ci-dessus", "la branche precedente", "le chapitre precedent", "cette branche"];
/** Remplacements proposés pour un mot interdit. */
const REMPLACEMENTS_INTERDITS: readonly [RegExp, string][] = [
  [/\bmachines\b/giu, "automatisations"],
  [/\bmachine\b/giu, "automatisation"],
  [/\s*(?:à|a|de|sur)\s+Villeexemple\b/giu, ""],
  [/\bVilleexemple\b/giu, ""],
  [/\s*,?\s*aucun gain garanti\b/giu, ""],
  [/\s*,?\s*(?:certifiée?s?|Certifexemple)\b/giu, ""],
];

// ─── Outils de texte ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Écritures de l'image ramenées à la forme parlée (« 23h14 » → « 23 heures 14 », « 4 sec » → « 4 secondes »). */
function formeParlee(t: string): string {
  return t
    .replace(/(\d{1,2})\s?h\s?(\d{2})(?!\d)/g, "$1 heures $2")
    .replace(/(\d+)\s?h\s?\/\s?(\d+)/g, "$1 heures sur $2")
    .replace(/(\d+)\s?(?:h|heure)(?![\p{L}])/gu, "$1 heures")
    .replace(/(\d+)\s?(?:sec|s)(?![\p{L}])/gu, "$1 secondes")
    .replace(/(\d+)\s?(?:min|mn)(?![\p{L}])/gu, "$1 minutes")
    .replace(/(\d+)(?:er|re|ère|e)(?![\p{L}])/gu, "$1")
    .replace(/(?<![\p{L}])premi(?:er|ère)(?![\p{L}])/giu, "1")
    .replace(/(?<![\p{L}])une (?:seule )?fois(?![\p{L}])/giu, "1 fois");
}

/** Texte comparable : forme parlée, minuscules sans accents ni ponctuation, nombres en chiffres. */
export function comparable(t: string): string {
  return texteAvecNombres(formeParlee(t)).replace(/\bheure\b/g, "heures");
}

/** Nombres d'un texte (écrits en chiffres ou en lettres), dans l'ordre. */
export function nombresDuTexte(t: string): number[] {
  return [...comparable(t).matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
}

/** Un chiffre dit ou écrit : sa valeur ET son unité (« 2 minutes » ≠ « 2 heures »). `null` : plage (« 24h/24 »). */
export interface ChiffreDit {
  valeur: number | null;
  unite: UniteChiffre;
  /** Écriture lue (sert à comparer deux plages). */
  brut: string;
}

/**
 * Morceaux de texte sans ponctuation interne : « deux heures. Vingt e-mails » ne fait jamais l'heure « 2h20 ». « 23 h 14 »
 * reste tel quel : `chiffresDe` le lit comme l'image (une seule lecture des deux côtés).
 */
const morceaux = (t: string) => t.replace(/(\d{1,2})\s?:\s?(\d{2})(?!\d)/g, "$1h$2").split(/[.;!?…]|,(?!\d)|\s[:—–]\s/);

/**
 * Un morceau en chiffres, à la forme que lit `chiffresDe` : « vingt-trois heures quatorze » → « 23 heures 14 », lu
 * comme l'heure « 23 h 14 » de l'image par la même règle (`HEURE_ESPACEE`), sans condition de fin de morceau.
 */
function enChiffres(m: string): string {
  return texteAvecNombres(
    m
      .replace(/(?<![\p{L}])une (?:seule )?fois(?![\p{L}])/giu, "1 fois")
      .replace(/(?<![\p{L}])premi(?:er|ère)(?![\p{L}])/giu, "1er"),
  )
    .replace(/\b(\d{1,3}) heures? sur (\d{1,3})\b/g, "$1h/$2")
    .replace(/\b(\d{1,3}) jours? sur (\d{1,3})\b/g, "$1j/$2")
    .replace(/ de l apres-midi/g, " de l'apres-midi");
}

/**
 * Calcul écrit (« 8 + 6 + 5 = 19 ») : ses opérandes sans unité se comparent à la valeur seule. Un résultat suivi d'une
 * unité (« 2 + 1 = 3h », « … = 30 % ») redevient un chiffre ordinaire, contrôlé valeur ET unité.
 */
const CALCUL = /\d+(?:[.,]\d+)?(?:\s?[+=×]\s?\d+(?:[.,]\d+)?)+/g;

const lus = (t: string): ChiffreDit[] => chiffresDe(t).map((c) => ({ valeur: c.valeur, unite: c.unite, brut: c.brut }));

/**
 * Chiffres d'un texte (en chiffres ou en lettres), valeur ET unité, lus par `chiffresDe` (L1) : « deux heures » →
 * 2 h, « quatre-vingts pour cent » → 80 %, « trois heures du matin » → l'heure 3h. Image et script passent par la même
 * lecture : leurs écritures se comparent directement. `calculs` : opérandes d'un calcul écrit, sans unité.
 */
export function lectureChiffres(t: string): { chiffres: ChiffreDit[]; calculs: number[] } {
  const chiffres: ChiffreDit[] = [];
  const calculs: number[] = [];
  // Ligne par ligne : `texteAvecNombres` remplace le saut de ligne par une espace, ce qui ferait une heure à cheval
  // sur deux lignes (« 6 h\n20 clients » ≠ 6h20).
  for (const m of t.split(/\r?\n|\r/).flatMap(morceaux)) {
    const c = enChiffres(m);
    const sansCalculs = c.replace(CALCUL, (x: string, debut: number) => {
      const operandes = x.match(/\d+(?:[.,]\d+)?/g) ?? [];
      const dernier = operandes[operandes.length - 1] ?? "";
      const lu = chiffresDe(dernier + c.slice(debut + x.length))[0];
      const avecUnite = !!lu && lu.valeur !== null && lu.unite !== "nombre";
      for (const n of avecUnite ? operandes.slice(0, -1) : operandes) calculs.push(Number(n.replace(",", ".")));
      return avecUnite ? ` ${dernier}` : " ";
    });
    chiffres.push(...lus(sansCalculs));
  }
  return { chiffres, calculs };
}

export const chiffresDuTexte = (t: string): ChiffreDit[] => lectureChiffres(t).chiffres;

const cleDit = (c: Pick<ChiffreDit, "valeur" | "unite" | "brut">) => (c.valeur === null ? `plage|${c.brut.replace(/\s+/g, "").toLowerCase()}` : `${c.valeur}|${c.unite}`);
const UNITE_FR: Partial<Record<UniteChiffre, string>> = { "%": " %", "€": " €", sec: " s", min: " min", h: " h", jour: " jour" };
/** « 2 h », « 80 % », « 3h » (heure d'horloge), « 20 » (sans unité), « 24h/24 ». */
function chiffreFr(c: ChiffreDit): string {
  if (c.valeur === null) return c.brut;
  if (c.unite === "heure") return `${Math.floor(c.valeur / 60)}h${c.valeur % 60 ? String(c.valeur % 60).padStart(2, "0") : ""}`;
  return `${nombreFr(c.valeur)}${UNITE_FR[c.unite] ?? ""}`;
}

/** Texte comparé mot à mot, apostrophes comprises (« l'a » = « l a »). */
const motAMot = (t: string) => texteCompare(t).replace(/'/g, " ").replace(/\s+/g, " ").trim();

function contientExpression(texte: string, expr: string): boolean {
  const e = motAMot(expr);
  return e.length > 0 && ` ${motAMot(texte)} `.includes(` ${e} `);
}

/** Proposition sans mot interdit (Will la valide ou la réécrit). */
export function reformulerInterdits(t: string): string {
  let r = t;
  for (const [re, par] of REMPLACEMENTS_INTERDITS) r = r.replace(re, par);
  return r.replace(/\s+([.,!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

const nombreFr = (n: number) => String(n).replace(".", ",");
const ecransDe = (fiche: FicheImage, partie: (typeof PARTIES)[number]) => fiche.ecrans.filter((e) => e.partie === partie);
const textesDeLEcran = (e: EcranFiche) => [e.texteDit, ...e.textesEcran.map((t) => t.replace(/\*/g, ""))];

/** Empreinte de la carte d'où un script doit partir : celle de la validation, sinon celle de l'image. */
export function empreinteDeCarte(carte: Pick<CarteImage, "validation" | "image">): string {
  return carte.validation?.empreinteCarte ?? carte.image.empreinte;
}

/** Phrase-choc que le script doit dire : version validée par Will, sinon version prudente choisie, sinon celle de l'image. */
export function phraseChocAttendue(carte: CarteImage, choix: ContexteRegles["choixFormules"] = {}): string {
  if (carte.phraseChocValidee) return carte.phraseChocValidee;
  const prudente = carte.formulesAbsolues.find((f) => f.ou === "phraseChoc" && (choix[cleFormule(f.texte)] ?? f.choixWill) === "reformuler");
  return prudente?.proposition ?? carte.phraseChoc;
}

// ─── Les règles ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Forme : écrans uniques, références connues, événements calés sur un mot dit, scènes permises, empreinte. */
function regleForme(fiche: FicheImage, ctx: ContexteRegles): Manquement[] {
  const res: Manquement[] = [];
  const m = (message: string, ecranId?: string): Manquement => ({ regle: "FORME", priorite: 5, message, ...(ecranId ? { ecranId } : {}) });
  if (fiche.empreinteCarte !== empreinteDeCarte(ctx.carte)) res.push(m("Le script n'a pas été écrit d'après la carte validée : relancez l'écriture."));
  const connus = new Set([...ctx.carte.noeuds, ...ctx.carte.liens, ...ctx.carte.chiffres, ...ctx.carte.groupes].map((x) => x.id));
  const scenes = scenesPermises(ctx.carte.types);
  const vus = new Set<string>();
  for (const e of fiche.ecrans) {
    if (vus.has(e.id)) res.push(m(`L'écran ${e.id} est écrit deux fois.`, e.id));
    vus.add(e.id);
    for (const r of e.refs) if (!connus.has(r)) res.push(m(`L'écran ${e.id} montre un élément qui n'est pas sur l'image (${r}).`, e.id));
    if (!scenes.has(e.scene)) res.push(m(`L'écran ${e.id} utilise une scène qui ne convient pas à ce type d'image (${e.scene}).`, e.id));
    const n = motsDits(e.texteDit).length;
    for (const s of e.surMot) {
      if (s.mot >= n) res.push(m(`L'écran ${e.id} cale une animation sur un mot qui n'est pas dit (mot ${s.mot + 1} sur ${n}).`, e.id));
      if (s.ref && !e.refs.includes(s.ref)) res.push(m(`L'écran ${e.id} anime un élément qu'il ne cite pas (${s.ref}).`, e.id));
    }
  }
  return res;
}

/** Q04 · Rien d'oublié : chaque chiffre à dire est dit, chaque bloc (et donc chaque branche) est montré. */
function regleRienOublie(fiche: FicheImage, ctx: ContexteRegles): Manquement[] {
  const res: Manquement[] = [];
  const retires = new Set(ctx.noeudsRetires ?? []);
  // Valeur ET unité : le 2 de « deux minutes » ne vaut pas « 2h ».
  const dits = new Set(chiffresDuTexte(texteDuCorps(fiche)).map(cleDit));
  const vus = new Set<string>();
  // Une formule passée en « version prudente » ne dit plus son chiffre (« 0 demande » devient « presque aucune demande ») :
  // ce chiffre-là n'est plus à dire (sauf si la version prudente le garde).
  const adoucies = ctx.carte.formulesAbsolues.filter((f) => (ctx.choixFormules?.[cleFormule(f.texte)] ?? f.choixWill) === "reformuler");
  for (const c of ctx.carte.chiffres) {
    if (!c.aDire || (c.dansNoeud && retires.has(c.dansNoeud))) continue;
    if (adoucies.some((f) => contientExpression(f.texte, c.brut) && !contientExpression(f.proposition, c.brut))) continue;
    const lien = c.dansLien ? ctx.carte.liens.find((l) => l.id === c.dansLien) : undefined;
    if (lien && retires.has(lien.vers)) continue;
    // L'inventaire de la carte porte déjà valeur et unité (`chiffresDe`, L1) ; une plage se relit dans son écriture.
    const cle = c.valeur === null ? cleDit(chiffresDuTexte(c.brut)[0] ?? { valeur: null, unite: c.unite, brut: c.brut }) : cleDit({ valeur: c.valeur, unite: c.unite, brut: c.brut });
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (!dits.has(cle)) res.push({ regle: "Q04", priorite: 5, message: `Le chiffre « ${c.brut} » de l'image n'est jamais dit.` });
  }
  const cites = new Set(fiche.ecrans.flatMap((e) => (e.texteDit.trim() ? e.refs : [])));
  for (const n of ctx.carte.noeuds) {
    if (n.photoPersonnes || retires.has(n.id) || cites.has(n.id)) continue;
    res.push({ regle: "Q04", priorite: 5, message: `Le bloc « ${n.libelle} » de l'image n'est ni dit ni montré.` });
  }
  return res;
}

/**
 * Chiffres permis (clés « valeur|unité ») : ceux écrits sur l'image, avec leur unité ; les comptes visibles et la
 * numérotation, SANS unité seulement (« quatre étapes », « un… quatre » ; jamais « quatre heures »).
 */
function chiffresPermis(carte: CarteImage, complexite: ComplexiteCarte): Set<string> {
  const permis = new Set<string>();
  for (const t of textesDeLaCarte(carte)) for (const c of chiffresDuTexte(t.texte)) permis.add(cleDit(c));
  for (const c of carte.chiffres) if (c.valeur !== null) permis.add(cleDit({ valeur: c.valeur, unite: c.unite, brut: c.brut }));
  const comptes: number[] = [
    carte.noeuds.length,
    complexite.branches,
    complexite.chapitres.length,
    ...carte.groupes.map((g) => g.noeuds.length),
    ...carte.noeuds.map((n) => n.quantite ?? 0),
    ...carte.noeuds.map((n) => n.sousElements?.length ?? 0),
    ...["etape", "sortie", "resultat", "benefice", "source", "indicateur"].map((r) => carte.noeuds.filter((n) => n.role === r).length),
    ...carte.liens.map((l) => l.part ?? 0),
  ];
  const sansUnite = (v: number) => permis.add(cleDit({ valeur: v, unite: "nombre", brut: "" }));
  for (const c of comptes) sansUnite(c);
  // Numérotation « un… cinq » : jusqu'au plus grand compte visible.
  const max = Math.max(0, ...comptes.filter((c) => c <= 12));
  for (let i = 1; i <= max; i++) sansUnite(i);
  return permis;
}

/** Q05 · Rien d'inventé : aucun nombre hors de l'image et des ajouts de Will (script, écrans, accroches, question). */
function regleRienInvente(fiche: FicheImage, ctx: ContexteRegles, complexite: ComplexiteCarte, marques: string[]): Manquement[] {
  const permis = chiffresPermis(ctx.carte, complexite);
  // Opérandes sans unité d'un calcul : la valeur seule suffit, si elle est sur l'image (avec n'importe quelle unité).
  const valeursImage = new Set([...permis].map((k) => k.split("|")[0]));
  const deWill = new Set((ctx.ajoutsWill ?? []).flatMap((t) => chiffresDuTexte(t)).map(cleDit));
  const res: Manquement[] = [];
  const marquer = (c: ChiffreDit) => {
    const m = `« ${chiffreFr(c)} » : ajouté par Will.`;
    if (!marques.includes(m)) marques.push(m);
  };
  const controler = (textes: string[], ou: string, ecranId?: string) => {
    const libres = new Map<string, ChiffreDit>();
    for (const t of textes) {
      const { chiffres, calculs } = lectureChiffres(t);
      for (const v of calculs) if (!valeursImage.has(String(v))) libres.set(`${v}|nombre`, { valeur: v, unite: "nombre", brut: String(v) });
      for (const c of chiffres) {
        const k = cleDit(c);
        if (permis.has(k)) continue;
        if (deWill.has(k)) marquer(c);
        else libres.set(k, c);
      }
    }
    if (libres.size) {
      const liste = [...libres.values()].map((c) => `« ${chiffreFr(c)} »`).join(", ");
      res.push({ regle: "Q05", priorite: 4, message: `${ou} : ${liste} ${libres.size > 1 ? "ne sont" : "n'est"} pas sur l'image.`, ...(ecranId ? { ecranId } : {}) });
    }
  };
  for (const e of fiche.ecrans) controler(textesDeLEcran(e), `Écran ${e.id}`, e.id);
  fiche.accroches.forEach((a, i) => controler([a.texteDit, ...a.textesEcran], `Accroche ${i === 0 ? "A" : "B"}`));
  controler([fiche.questionCommentaire.texteDit, fiche.questionCommentaire.texteEcran], "Question de commentaire");
  return res;
}

/** Q05 bis · « Situation type » pour une automatisation ; formules absolues tranchées par Will. */
function reglePromesses(fiche: FicheImage, ctx: ContexteRegles): Manquement[] {
  const res: Manquement[] = [];
  if (situationTypeExigee(ctx.carte)) {
    const premier = ecransDe(fiche, "explication")[0];
    const dit = premier && /(?:^| )situation type(?: |$)|^exemple(?: |$)/.test(comparable(premier.texteDit));
    const ecrit = premier && premier.textesEcran.some((t) => contientExpression(t.replace(/\*/g, ""), ETIQUETTE_SITUATION_TYPE));
    if (!dit || !ecrit) {
      res.push({
        regle: "Q05bis",
        priorite: 5,
        ...(premier ? { ecranId: premier.id } : {}),
        message: `Image d'automatisation : l'explication doit commencer par « situation type » (dit${dit ? "" : " : manque"}) et l'afficher (écrit${ecrit ? "" : " : manque"}).`,
      });
    }
  }
  const choix = new Map<string, ChoixFormule>();
  for (const f of ctx.carte.formulesAbsolues) if (f.choixWill) choix.set(cleFormule(f.texte), f.choixWill);
  for (const [k, v] of Object.entries(ctx.choixFormules ?? {})) choix.set(k, v);
  const vues = new Set<string>();
  for (const e of fiche.ecrans) {
    for (const t of textesDeLEcran(e)) {
      for (const f of formulesAbsoluesDe(t, e.id)) {
        const cle = cleFormule(f.texte);
        if (vues.has(cle)) continue;
        vues.add(cle);
        const c = choix.get(cle);
        if (!c) {
          res.push({ regle: "Q05bis", priorite: 2, ecranId: e.id, pourWill: true, proposition: f.proposition, message: `Formule très affirmative : « ${f.texte} ». Gardez-la ou prenez la version prudente.` });
        } else if (c === "reformuler") {
          res.push({ regle: "Q05bis", priorite: 2, ecranId: e.id, proposition: f.proposition, message: `Will a choisi la version prudente de « ${f.texte} » : le script la garde encore.` });
        }
      }
    }
  }
  return res;
}

/** Q06 · Phrase-choc mot pour mot (casse et ponctuation ignorées), dans la dernière partie. */
function reglePhraseChoc(fiche: FicheImage, attendue: string): Manquement[] {
  const dite = ecransDe(fiche, "phrase-choc").map((e) => e.texteDit).join(" ");
  if (comparable(dite) === comparable(attendue)) return [];
  return [{ regle: "Q06", priorite: 3, message: `La phrase-choc doit être dite mot pour mot : « ${attendue} » (dit : « ${dite || "rien"} »).` }];
}

const NOMS_PARTIES: Readonly<Record<(typeof PARTIES)[number], string>> = { accroche: "accroche", douleur: "douleur", "debut-reponse": "début de réponse", explication: "explication", resultat: "résultat", "phrase-choc": "phrase-choc" };
const nomPartie = (p: (typeof PARTIES)[number]) => NOMS_PARTIES[p];

/** Q07 · Ossature : 6 parties dans l'ordre, accroche courte, annonce du nombre, deux accroches de familles différentes. */
function regleOssature(fiche: FicheImage, ctx: ContexteRegles, complexite: ComplexiteCarte): Manquement[] {
  const res: Manquement[] = [];
  const m = (message: string, ecranId?: string): Manquement => ({ regle: "Q07", priorite: 5, message, ...(ecranId ? { ecranId } : {}) });
  // L'ordre suit le déroulé du récit (REC-B : le résultat avant la douleur) ; sans récit, l'ossature d'aujourd'hui.
  const ordre = ordreDesParties(ctx.recit);
  const rangs = fiche.ecrans.map((e) => ordre.indexOf(e.partie));
  for (const p of PARTIES) if (!fiche.ecrans.some((e) => e.partie === p)) res.push(m(`La partie « ${p} » manque.`));
  const desordre = fiche.ecrans.find((e, i) => i > 0 && rangs[i]! < rangs[i - 1]!);
  if (desordre) res.push(m(`L'écran ${desordre.id} (« ${desordre.partie} ») n'est pas à sa place : ${ordre.map(nomPartie).join(", ")}.`, desordre.id));
  const debutReponse = comparable(ecransDe(fiche, "debut-reponse").map((e) => e.texteDit).join(" "));
  if (ctx.recit === "REC-B" && !debutReponse.includes(comparable(ANNONCE_VOICI_COMMENT))) res.push(m(`Déroulé « résultat puis comment » : le début de réponse doit dire « ${ANNONCE_VOICI_COMMENT} ».`));
  if (ctx.recit === "REC-D" && !nombresDuTexte(debutReponse).includes(ETAPES_RECIT_D)) res.push(m(`Déroulé « en trois étapes » : le début de réponse doit annoncer « ${ANNONCE_TROIS_ETAPES} ».`));

  const accroche = ecransDe(fiche, "accroche").map((e) => e.texteDit).join(" ");
  const motsAccroche = motsDits(accroche).length;
  if (motsAccroche > ACCROCHE_IV_MOTS_MAX || motsAccroche / DEBIT_MOTS_PAR_SEC > ACCROCHE_FIN_MAX_SEC) {
    res.push(m(`L'accroche fait ${motsAccroche} mots : ${ACCROCHE_IV_MOTS_MAX} au plus, finie avant ${ACCROCHE_FIN_MAX_SEC} s.`));
  }
  if (comparable(accroche) !== comparable(fiche.accroches[0].texteDit)) res.push(m("Le premier écran ne dit pas l'accroche retenue."));
  fiche.accroches.forEach((a, i) => {
    const n = motsDits(a.texteDit).length;
    if (n > ACCROCHE_IV_MOTS_MAX) res.push(m(`L'accroche ${i === 0 ? "A" : "B"} fait ${n} mots : ${ACCROCHE_IV_MOTS_MAX} au plus.`));
  });
  if (fiche.accroches[0].famille === fiche.accroches[1].famille) res.push(m("Les deux accroches sont de la même famille : proposez-en une d'une autre (chiffre, question, ratio…)."));

  const annonce = annonceAttendue(ctx.carte, complexite.classe);
  if (annonce) {
    const enumeres = new Set(annonce.noeuds);
    const premierEnumere = fiche.ecrans.findIndex((e) => e.refs.some((r) => enumeres.has(r)));
    const avant = fiche.ecrans.slice(0, premierEnumere < 0 ? fiche.ecrans.length : premierEnumere).filter((e) => e.partie === "debut-reponse" || e.partie === "explication");
    if (!avant.some((e) => nombresDuTexte(e.texteDit).includes(annonce.nombre))) {
      res.push(m(`Le début de réponse doit annoncer le nombre (« ${annonce.nombre} ») avant le premier élément.`));
    }
  }
  return res;
}

/** Q08 · Interdits (prioritaires sur le mot pour mot), faux client, nom d'exemple sans « par exemple », appel dans le corps. */
function regleInterdits(fiche: FicheImage, ctx: ContexteRegles, dejaSignales: readonly string[]): Manquement[] {
  const res: Manquement[] = [];
  const tous = [...INTERDITS_PERMANENTS, ...(ctx.interdits ?? [])];
  let interdits = tous;
  const noms = ctx.carte.noeuds
    .filter((n) => n.exemple)
    .flatMap((n) => [n.libelle, n.detail ?? ""].join(" ").split(/\s+/).filter((w, i) => i > 0 && /^\p{Lu}\p{Ll}+$/u.test(w)))
    .filter((w, i, a) => a.indexOf(w) === i);
  const controler = (t: string, ou: string, corps: boolean, ecranId?: string) => {
    const avec = (message: string, extra: Partial<Manquement> = {}): Manquement => ({ regle: "Q08", priorite: 1, message, ...(ecranId ? { ecranId } : {}), ...extra });
    for (const i of interdits) if (contientExpression(t, i)) res.push(avec(`${ou} : « ${i} » est interdit.`, { proposition: reformulerInterdits(t) }));
    if (FAUX_CLIENT.test(texteCompare(t).replace(/'/g, " "))) res.push(avec(`${ou} : un client est présenté comme réel ; dites « situation type » ou « par exemple ».`));
    for (const nom of noms) {
      for (const p of phrasesDe(t)) if (contientExpression(p, nom) && !contientExpression(p, "exemple")) res.push(avec(`${ou} : « ${nom} » est un nom d'exemple ; dites « par exemple ».`));
    }
    if (corps) for (const a of TOURNURES_APPEL_CORPS) if (contientExpression(t, a)) res.push(avec(`${ou} : aucune phrase d'appel dans le corps (« ${a} ») ; la fin vient de la banque.`));
  };
  for (const e of fiche.ecrans) {
    // Phrase-choc de l'image porteuse d'un interdit : déjà signalée à Will (un seul message) ; ses écrans restent
    // contrôlés pour tout le reste (autre interdit, faux client, nom d'exemple, phrase d'appel).
    interdits = e.partie === "phrase-choc" ? tous.filter((i) => !dejaSignales.includes(i)) : tous;
    controler(e.texteDit, `Écran ${e.id}`, true, e.id);
    // Textes d'écran : le nom d'exemple est permis si l'écran affiche aussi l'étiquette « exemple ».
    const etiquette = e.textesEcran.some((t) => contientExpression(t.replace(/\*/g, ""), "exemple"));
    for (const t of e.textesEcran.map((x) => x.replace(/\*/g, ""))) controler(etiquette ? sansNoms(t, noms) : t, `Écran ${e.id}`, true, e.id);
  }
  fiche.accroches.forEach((a, i) => [a.texteDit, ...a.textesEcran].forEach((t) => controler(t, `Accroche ${i === 0 ? "A" : "B"}`, true)));
  for (const t of [fiche.questionCommentaire.texteDit, fiche.questionCommentaire.texteEcran]) controler(t, "Question de commentaire", false);
  return res;
}

/** Texte sans les noms d'exemple (déjà annoncés par l'étiquette « exemple » de l'écran). */
function sansNoms(t: string, noms: readonly string[]): string {
  return noms.reduce((r, n) => r.replace(new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "gu"), ""), t);
}

/** Q08 bis · Question de commentaire : une question en « vous », courte, sans mot à commenter, sans lien, sans promesse. */
function regleQuestion(fiche: FicheImage, ctx: ContexteRegles): Manquement[] {
  const { texteDit, texteEcran } = fiche.questionCommentaire;
  const res: Manquement[] = [];
  const m = (message: string): Manquement => ({ regle: "Q08bis", priorite: 5, message: `Question de commentaire : ${message}` });
  const n = motsDits(texteDit).length;
  if (n > QUESTION_MOTS_MAX) res.push(m(`${n} mots, ${QUESTION_MOTS_MAX} au plus.`));
  // Même contrôle que le plan des fins (L14), qui compte aussi « ? » détaché comme un mot : sinon la fin serait refusée.
  const refusFins = refusQuestion(texteDit);
  if (refusFins && n <= QUESTION_MOTS_MAX) res.push({ regle: "Q08bis", priorite: 5, message: `Question de commentaire : ${refusFins}` });
  if (!texteDit.trim().endsWith("?")) res.push(m("ce doit être une question."));
  if (!/(?:^| )(?:vous|votre|vos)(?: |$)/.test(texteCompare(texteDit).replace(/-/g, " "))) res.push(m("elle s'adresse au public en « vous »."));
  const surImage = new Set(textesDeLaCarte(ctx.carte).flatMap((t) => t.texte.split(/[^\p{L}]+/u)));
  for (const t of [texteDit, texteEcran]) {
    const c = texteCompare(t);
    const motEnCapitales = t.split(/[^\p{L}]+/u).find((w) => w.length >= 4 && w === w.toUpperCase() && /\p{Lu}/u.test(w) && !surImage.has(w));
    if (/commentaire|commentez|ecrivez|repondez par/.test(c) || motEnCapitales) res.push(m("elle ne demande jamais d'écrire un mot."));
    if (/(?:^| )(?:lien|profil|bio|description)(?: |$)|https?:|www\.|\.com/.test(c)) res.push(m("aucun lien."));
    if (/je vous (?:l )?envoie|gratuit|offert|cadeau/.test(c.replace(/'/g, " "))) res.push(m("aucune promesse."));
  }
  return [...new Map(res.map((r) => [r.message, r])).values()];
}

/** Q09 · Phrases de 12 mots au plus, un seul mot orange par écran, chiffres en lettres dans le texte dit. */
function regleEcriture(fiche: FicheImage): Manquement[] {
  const res: Manquement[] = [];
  const dits: [string, string | undefined][] = [
    ...fiche.ecrans.map((e) => [e.texteDit, e.id] as [string, string]),
    ...fiche.accroches.map((a) => [a.texteDit, undefined] as [string, undefined]),
    [fiche.questionCommentaire.texteDit, undefined],
  ];
  for (const [t, ecranId] of dits) {
    const ou = ecranId ? `Écran ${ecranId}` : "Hors corps";
    for (const p of phrasesDe(t)) {
      const n = motsDits(p).length;
      if (n > MOTS_PAR_PHRASE_MAX) res.push({ regle: "Q09", priorite: 5, message: `${ou} : phrase de ${n} mots (« ${p} »), ${MOTS_PAR_PHRASE_MAX} au plus.`, ...(ecranId ? { ecranId } : {}) });
    }
    if (/\d/.test(t)) res.push({ regle: "Q09", priorite: 5, message: `${ou} : les chiffres se disent en lettres (« ${t} »).`, ...(ecranId ? { ecranId } : {}) });
  }
  for (const e of fiche.ecrans) {
    const o = motsOrange(e).length;
    if (o > 1) res.push({ regle: "Q09", priorite: 5, ecranId: e.id, message: `Écran ${e.id} : ${o} mots orange, un seul par écran.` });
  }
  return res;
}

/** Durée estimée du corps (accroche → phrase-choc) au débit de référence. */
export function dureeEstimeeSec(fiche: Pick<FicheImage, "ecrans">): number {
  return motsDits(texteDuCorps(fiche)).length / DEBIT_MOTS_PAR_SEC;
}

/** Q10 · Durée estimée dans la fourchette de la classe, ±10 %. */
function regleDuree(fiche: FicheImage, complexite: ComplexiteCarte, ctx: ContexteRegles): Manquement[] {
  // Version courte : sa durée relève du plafond du réseau (Q11, après la voix), plus de la classe.
  if (ctx.noeudsRetires?.length) return [];
  const d = dureeEstimeeSec(fiche);
  const [bas, haut] = complexite.fourchetteSec;
  if (d >= bas * (1 - TOLERANCE_DUREE_IV) && d <= haut * (1 + TOLERANCE_DUREE_IV)) return [];
  const sens = d > haut ? `trop long de ${Math.ceil(d - haut)} s : raccourcissez l'explication` : `trop court de ${Math.ceil(bas - d)} s`;
  return [{ regle: "Q10", priorite: 5, message: `Script de ${Math.round(d)} s pour une image « ${complexite.classe} » (${bas} à ${haut} s) : ${sens}.` }];
}

/** Chapitres : seulement pour une image très complexe ; repères « i/n » ; un chapitre non essentiel est détachable. */
function regleChapitres(fiche: FicheImage, ctx: ContexteRegles, complexite: ComplexiteCarte): Manquement[] {
  const res: Manquement[] = [];
  const m = (message: string): Manquement => ({ regle: "CHAPITRES", priorite: 5, message });
  const attendus = complexite.chapitres;
  if (attendus.length === 0) {
    if (fiche.chapitres.length) res.push(m("Cette image n'est pas très complexe : pas de chapitres."));
    return res;
  }
  // Un retrait de version courte garde les chapitres essentiels et renumérote : on compare à ce qui reste.
  const retires = new Set(ctx.noeudsRetires ?? []);
  const gardes = attendus.filter((c) => c.essentiel || !c.noeuds.every((n) => retires.has(n)));
  if (fiche.chapitres.length !== gardes.length) {
    res.push(m(`L'image demande ${gardes.length} chapitres, le script en a ${fiche.chapitres.length}.`));
    return res;
  }
  const rang = new Map(fiche.ecrans.map((e, i) => [e.id, i]));
  const explication = fiche.ecrans.filter((e) => e.partie === "explication").map((e) => e.id);
  const couverts = fiche.chapitres.flatMap((c) => c.ecrans);
  if (couverts.join(",") !== explication.join(",")) res.push(m("Les chapitres doivent couvrir toute l'explication, dans l'ordre, sans trou."));
  fiche.chapitres.forEach((c, i) => {
    const attendu = gardes[i]!;
    if (c.repere !== `${i + 1}/${fiche.chapitres.length}`) res.push(m(`Le chapitre ${i + 1} doit porter le repère « ${i + 1}/${fiche.chapitres.length} » (lu : « ${c.repere} »).`));
    if (c.essentiel !== attendu.essentiel) res.push(m(`Le chapitre « ${c.titre} » doit être ${attendu.essentiel ? "essentiel" : "détachable"}.`));
    const refs = new Set(c.ecrans.flatMap((id) => fiche.ecrans.find((e) => e.id === id)?.refs ?? []));
    const exclusifs = attendu.noeuds.filter((n) => !gardes.some((g, j) => j !== i && g.noeuds.includes(n)));
    const manquants = exclusifs.filter((n) => !refs.has(n) && !fiche.ecrans.some((e) => e.partie !== "explication" && e.refs.includes(n)));
    if (manquants.length) res.push(m(`Le chapitre « ${c.titre} » ne montre pas ${manquants.join(", ")}.`));
    if (c.essentiel) return;
    // Détachable : rien après lui ne renvoie à ses blocs (ni aux flèches ou chiffres qui y mènent), ni en arrière.
    const fin = Math.max(...c.ecrans.map((id) => rang.get(id) ?? -1));
    const siens = new Set(exclusifs);
    for (const l of ctx.carte.liens) if (siens.has(l.vers)) siens.add(l.id);
    for (const ch of ctx.carte.chiffres) if ((ch.dansNoeud && siens.has(ch.dansNoeud)) || (ch.dansLien && siens.has(ch.dansLien))) siens.add(ch.id);
    for (const e of fiche.ecrans.slice(fin + 1)) {
      const renvoi = e.refs.find((r) => siens.has(r));
      if (renvoi) res.push(m(`L'écran ${e.id} renvoie au chapitre détachable « ${c.titre} » (${renvoi}) : il ne pourrait plus être retiré.`));
      const mot = RENVOIS.find((r) => contientExpression(e.texteDit, r));
      if (mot) res.push(m(`L'écran ${e.id} renvoie en arrière (« ${mot} ») après le chapitre détachable « ${c.titre} ».`));
    }
    const bords = [c.ecrans[0], c.ecrans[c.ecrans.length - 1]].map((id) => fiche.ecrans.find((e) => e.id === id)?.texteDit.trim() ?? "");
    if (bords.some((t) => !/[.!?…]$/.test(t))) res.push(m(`Le chapitre « ${c.titre} » doit commencer et finir sur une phrase complète.`));
  });
  return res;
}

// ─── Verdict ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Contrôle complet d'un script, dans l'ordre de priorité I9. Conflit « mot pour mot / interdits » : si la phrase-choc
 * à dire porte un interdit (et que Will n'en a pas validé de version), UN seul message lui est adressé, avec une
 * proposition ; le mot pour mot n'est alors pas reproché au script.
 */
export function verifierScript(fiche: FicheImage, ctx: ContexteRegles): VerdictScript {
  const complexite = ctx.complexite ?? complexiteDe(ctx.carte);
  const marques: string[] = [];
  const attendue = phraseChocAttendue(ctx.carte, ctx.choixFormules);
  const interdits = [...INTERDITS_PERMANENTS, ...(ctx.interdits ?? [])];
  const interditsDansChoc = interdits.filter((i) => contientExpression(attendue, i));
  const interditDansChoc = interditsDansChoc[0];
  const conflit: Manquement[] = interditDansChoc
    ? [{
        regle: "Q08",
        priorite: 1,
        pourWill: true,
        proposition: reformulerInterdits(attendue),
        message: `La phrase-choc de l'image contient « ${interditDansChoc} », interdit même mot pour mot : validez « ${reformulerInterdits(attendue)} » ou réécrivez-la.`,
      }]
    : [];
  const tous = [
    ...conflit,
    ...regleInterdits(fiche, ctx, interditsDansChoc),
    ...reglePromesses(fiche, ctx),
    ...(interditDansChoc ? [] : reglePhraseChoc(fiche, attendue)),
    ...regleRienInvente(fiche, ctx, complexite, marques),
    ...regleForme(fiche, ctx),
    ...regleRienOublie(fiche, ctx),
    ...regleOssature(fiche, ctx, complexite),
    ...regleQuestion(fiche, ctx),
    ...regleEcriture(fiche),
    ...regleDuree(fiche, complexite, ctx),
    ...regleChapitres(fiche, ctx, complexite),
  ];
  const manquements = tous.map((x, i) => ({ x, i })).sort((a, b) => a.x.priorite - b.x.priorite || a.i - b.i).map((a) => a.x);
  return { ok: manquements.length === 0, manquements, marques, dureeEstimeeSec: dureeEstimeeSec(fiche) };
}

/** Manquements qu'une relance de Claude peut corriger (tout sauf ce que Will doit trancher). */
export function aCorrigerParClaude(v: Pick<VerdictScript, "manquements">): Manquement[] {
  return v.manquements.filter((x) => !x.pourWill);
}

/** Manquements que seul Will peut trancher (formules absolues, phrase-choc à reformuler). */
export function aTrancherParWill(v: Pick<VerdictScript, "manquements">): Manquement[] {
  return v.manquements.filter((x) => x.pourWill);
}
