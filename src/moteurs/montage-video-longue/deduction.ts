/**
 * DÉDUCTION TEXTE → SCÈNES (lot QUALL-2) : de chaque phrase lue, la scène qui l'illustre (étapes, liste, avant/après,
 * chiffre, phrase clé). Heuristiques françaises PURES, sans IA ; repli TOUJOURS sur la phrase clé (jamais de fond nu).
 * Rien n'est inventé : chaque texte affiché est une sous-chaîne de la phrase (seule la majuscule initiale change).
 * PUR : lu aussi par la composition Remotion, donc chemins relatifs seulement (jamais « @/ »).
 */
import type { ElementApparition, FormeLongue, SceneAvantApres, SceneChiffre, SceneEtapes, SceneListe, ScenePhraseCle } from "./storyboard-types";
import { nombresEcrits, uniteApres } from "./nombres";

/** Un mot horodaté, en millisecondes de la vidéo entière. */
export interface MotMs {
  mot: string;
  debutMs: number;
  finMs: number;
}

/** Une phrase lue. `debutMs` = début de son premier mot ; `finMs` = fin de la scène qui la porte (respiration comprise). */
export interface PhraseLue {
  texte: string;
  mots: MotMs[];
  debutMs: number;
  finMs: number;
}

type SansBase<T> = T extends unknown ? Omit<T, "id" | "chapitreId" | "fond" | "entree"> : never;
/** Une scène de contenu avant qu'on lui donne identifiant, chapitre, fond et transition. */
export type SceneBrouillon = SansBase<SceneListe | SceneEtapes | SceneChiffre | SceneAvantApres | ScenePhraseCle>;

export interface ContexteDeduction {
  /** Titre du chapitre (vrai ou déduit). */
  titre: string;
  /** Texte entier du chapitre (pour compter les mots clés). */
  texteChapitre: string;
  /** Mémoire de la dernière forme de phrase clé (partagée entre chapitres). */
  etat: { forme: FormeLongue | null };
}

/** Une scène déduite et les phrases qui la portent. */
export interface ScenePortee {
  scene: SceneBrouillon;
  sources: PhraseLue[];
}

/** Une scène plus longue doit montrer des éléments qui arrivent au fil de la lecture. */
export const SCENE_LONGUE_MS = 8000;

/* ------------------------------------------------------------------ */
/* Petits outils de texte                                              */
/* ------------------------------------------------------------------ */

const FIN_PONCT = /[\s.,;:…]+$/u;
const mots = (t: string) => t.split(/\s+/).filter(Boolean);
const nbMots = (t: string) => mots(t).length;
export const majuscule = (t: string) => (t ? t[0].toLocaleUpperCase("fr") + t.slice(1) : t);
const sansFin = (t: string) => t.replace(FIN_PONCT, "").trim();

/** Au plus `n` mots : coupe à la dernière virgule ou « ; » de la première moitié au moins, sinon au mot (« … » ajouté). */
export function abreger(texte: string, n: number): string {
  const t = sansFin(texte);
  const m = mots(t);
  if (m.length <= n) return t;
  const debut = m.slice(0, n);
  for (let i = n - 1; i >= Math.floor(n / 2); i--) if (/[,;:]$/.test(debut[i])) return sansFin(debut.slice(0, i + 1).join(" "));
  return `${sansFin(debut.join(" "))}…`;
}

/** Positions de début de chaque mot dans `mots.join(" ")`. */
function decalages(ms: MotMs[]): number[] {
  const res: number[] = [];
  let pos = 0;
  for (const m of ms) {
    res.push(pos);
    pos += m.mot.length + 1;
  }
  return res;
}

/** Index du mot qui contient le caractère `idx` du texte de la phrase. */
function motA(p: PhraseLue, idx: number): number {
  const dec = decalages(p.mots);
  let r = 0;
  for (let i = 0; i < dec.length; i++) if (dec[i] <= idx) r = i;
  return r;
}
const tempsAu = (p: PhraseLue, idx: number) => p.mots[motA(p, idx)]?.debutMs ?? p.debutMs;

/* ------------------------------------------------------------------ */
/* Phrases                                                             */
/* ------------------------------------------------------------------ */

/** Phrases = mots jusqu'à `[.!?…]` final. Un reste sans ponctuation forme une dernière phrase. */
export function decouperPhrases(lus: MotMs[]): MotMs[][] {
  const res: MotMs[][] = [];
  let cour: MotMs[] = [];
  for (const m of lus) {
    if (!m.mot.trim()) continue;
    cour.push(m);
    if (/[.!?…]["'»”)]*$/u.test(m.mot)) {
      res.push(cour);
      cour = [];
    }
  }
  if (cour.length) res.push(cour);
  return res;
}

/** Phrase lue à partir de ses mots ; `finMs` = fin de sa scène. */
export function phraseDe(ms: MotMs[], finMs: number): PhraseLue {
  return { texte: ms.map((m) => m.mot).join(" "), mots: ms, debutMs: ms[0].debutMs, finMs };
}

/** Deux phrases voisines en une (pour une phrase trop courte). */
export function fusionner(a: PhraseLue, b: PhraseLue): PhraseLue {
  return phraseDe([...a.mots, ...b.mots], Math.max(a.finMs, b.finMs));
}

/** Coupe une phrase en deux à la ponctuation la plus proche du milieu (puis au mot le plus proche). */
export function indiceCoupe(ms: MotMs[]): number | null {
  const n = ms.length;
  if (n < 4) return null;
  const milieu = n / 2;
  let meilleur = -1;
  for (let j = 2; j <= n - 2; j++) {
    if (!/[,;:]$/.test(ms[j - 1].mot) && ms[j - 1].mot !== ":") continue;
    if (j < n * 0.25 || j > n * 0.75) continue;
    if (meilleur < 0 || Math.abs(j - milieu) < Math.abs(meilleur - milieu)) meilleur = j;
  }
  return meilleur >= 0 ? meilleur : Math.round(milieu);
}

function couperPhrase(p: PhraseLue): [PhraseLue, PhraseLue] | null {
  const j = indiceCoupe(p.mots);
  if (!j) return null;
  const b = p.mots.slice(j);
  return [phraseDe(p.mots.slice(0, j), b[0].debutMs), phraseDe(b, p.finMs)];
}

/* ------------------------------------------------------------------ */
/* Étapes (impératif)                                                  */
/* ------------------------------------------------------------------ */

const RE_IMPERATIF = /^(?:(?:d['’]abord|ensuite|puis|enfin|maintenant|et|alors)\s*,?\s*)?(?:n['’])?([a-zà-ÿœ-]+ez)\b(?!-(?:vous|nous|t-))/i;
const PAS_IMPERATIF = new Set(["chez", "assez", "nez", "rez", "lez", "avez", "savez", "êtes", "dites", "faites", "vous"]);

/** Vrai si la phrase commence par un verbe à l'impératif (« Choisissez… », « Ensuite, ouvrez… »). */
export function estImperatif(texte: string): boolean {
  const t = texte.trim();
  if (/\?["»”)]*$/.test(t)) return false;
  const m = RE_IMPERATIF.exec(t);
  if (!m) return false;
  const verbe = m[1].toLowerCase();
  if (PAS_IMPERATIF.has(verbe)) return false;
  // « Ensuite vous … » : le mot trouvé n'est jamais « vous », mais on écarte aussi « vous <verbe>ez » en tête.
  return !/^(?:vous|nous)\b/i.test(t);
}

function etapesDe(run: PhraseLue[], numeroDepart: number): ScenePortee {
  const elements: ElementApparition[] = run.map((p) => {
    const texte = majuscule(abreger(p.texte, 22));
    const nb = nombresEcrits(p.texte).find((n) => texte.includes(n.ecrit));
    return { texte, apparitionMs: p.debutMs, accent: nb ? nb.ecrit : null };
  });
  return { scene: { type: "etapes", debutMs: run[0].debutMs, finMs: run[run.length - 1].finMs, numeroDepart, elements }, sources: run };
}

/** Tailles des scènes d'étapes : 3 au plus, réparties à égalité (5 → 3 + 2, 4 → 2 + 2, 7 → 3 + 2 + 2). */
export function repartirEtapes(n: number): number[] {
  const k = Math.ceil(n / 3);
  const base = Math.floor(n / k);
  const reste = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < reste ? 1 : 0));
}

/* ------------------------------------------------------------------ */
/* Liste                                                               */
/* ------------------------------------------------------------------ */

interface GroupeListe {
  jetons: MotMs[];
}

/** Sépare des mots en éléments (virgule, « et », « ou »). */
function groupesListe(jetons: MotMs[]): GroupeListe[] {
  const res: GroupeListe[] = [];
  let cour: MotMs[] = [];
  const clore = () => {
    if (cour.length) res.push({ jetons: cour });
    cour = [];
  };
  for (const j of jetons) {
    const nu = j.mot.replace(/[.,;:!?…]+$/u, "").toLowerCase();
    if (nu === "et" || nu === "ou") {
      clore();
      continue;
    }
    cour.push(j);
    if (/,$/.test(j.mot)) clore();
  }
  clore();
  return res;
}

const texteGroupe = (g: GroupeListe) => majuscule(sansFin(g.jetons.map((j) => j.mot).join(" ")));

function listeDe(p: PhraseLue): ScenePortee | null {
  const ms = p.mots;
  const ic = ms.findIndex((m) => m.mot.includes(":"));
  let titre: string | null = null;
  let groupes: GroupeListe[];
  if (ic >= 0) {
    const [avantCol, apresCol] = ms[ic].mot.split(":");
    const tete = ms.slice(0, ic).map((m) => m.mot);
    if (avantCol) tete.push(avantCol);
    titre = sansFin(tete.join(" ")) || null;
    const queue: MotMs[] = [];
    if (apresCol) queue.push({ ...ms[ic], mot: apresCol });
    queue.push(...ms.slice(ic + 1));
    groupes = groupesListe(queue);
    if (groupes.length < 2 || groupes.length > 6 || groupes.some((g) => g.jetons.length > 12)) return null;
  } else {
    groupes = groupesListe(ms);
    if (groupes.length < 3 || groupes.length > 6 || groupes.some((g) => g.jetons.length > 4)) return null;
  }
  const elements: ElementApparition[] = groupes.map((g) => {
    const texte = texteGroupe(g);
    return { texte, apparitionMs: g.jetons[0].debutMs, accent: nombresEcrits(texte)[0]?.ecrit ?? null };
  });
  const compte = titre ? (nombresEcrits(titre).find((n) => n.valeur === elements.length)?.valeur ?? null) : null;
  return { scene: { type: "liste", debutMs: p.debutMs, finMs: p.finMs, titre, elements, compte }, sources: [p] };
}

/* ------------------------------------------------------------------ */
/* Avant / après                                                       */
/* ------------------------------------------------------------------ */

const PLUS_BESOIN = /plus besoin/i;
const PLUS_JAMAIS = /plus jamais/i;

function coteTexte(t: string): string {
  return majuscule(abreger(t, 12));
}

function avantApresDe(p: PhraseLue, suivante?: PhraseLue): { portee: ScenePortee; consomme: number } | null {
  const t = p.texte;
  let cotes: { avant: string; apres: string; tApres: number; fin: number; sources: PhraseLue[] } | null = null;
  let m = /plus besoin\s+(?:de\s+|d['’]|du\s+|des\s+)?(.+?)\s*[:,]\s+(.+)$/i.exec(t);
  if (m) cotes = { avant: m[1], apres: m[2], tApres: tempsAu(p, t.lastIndexOf(m[2])), fin: p.finMs, sources: [p] };
  if (!cotes && (m = /^(.+?),\s*(?:et\s+)?plus jamais\s+(.+)$/i.exec(t))) cotes = { avant: m[2], apres: m[1], tApres: p.debutMs, fin: p.finMs, sources: [p] };
  if (!cotes && (m = /au lieu\s+(?:de\s+|d['’])(.+?),\s+(.+)$/i.exec(t))) cotes = { avant: m[1], apres: m[2], tApres: tempsAu(p, t.lastIndexOf(m[2])), fin: p.finMs, sources: [p] };
  if (!cotes && suivante && /^avant\s*,/i.test(t) && /^(?:maintenant|aujourd['’]hui|désormais)\s*,/i.test(suivante.texte)) {
    const ii = suivante.mots.findIndex((x) => /,$/.test(x.mot));
    cotes = {
      avant: t.replace(/^avant\s*,\s*/i, ""),
      apres: suivante.texte.replace(/^(?:maintenant|aujourd['’]hui|désormais)\s*,\s*/i, ""),
      tApres: suivante.mots[ii + 1]?.debutMs ?? suivante.debutMs,
      fin: suivante.finMs,
      sources: [p, suivante],
    };
  }
  if (!cotes) return null;
  const avant = coteTexte(cotes.avant);
  const apres = coteTexte(cotes.apres);
  if (!avant || !apres) return null;
  // L'après arrive à sa lecture, mais jamais avant que l'avant ait eu 800 ms d'écran, ni dans les 400 dernières ms.
  const apparitionApresMs = Math.min(Math.max(p.debutMs + 800, cotes.tApres), cotes.fin - 400);
  return { portee: { scene: { type: "avant-apres", debutMs: p.debutMs, finMs: cotes.fin, avant, apres, apparitionApresMs }, sources: cotes.sources }, consomme: cotes.sources.length };
}

/* ------------------------------------------------------------------ */
/* Chiffre                                                             */
/* ------------------------------------------------------------------ */

function chiffreDe(p: PhraseLue): ScenePortee | null {
  const ns = nombresEcrits(p.texte).slice(0, 2);
  if (!ns.length) return null;
  return {
    scene: {
      type: "chiffre",
      debutMs: p.debutMs,
      finMs: p.finMs,
      chiffres: ns.map((n) => ({ valeur: n.valeur, ecrit: n.ecrit, affiche: n.affiche, unite: uniteApres(p.texte, n.fin), apparitionMs: tempsAu(p, n.debut) })),
      contexte: abreger(p.texte, 12),
    },
    sources: [p],
  };
}

/* ------------------------------------------------------------------ */
/* Phrase clé                                                          */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set(
  (
    "le la les un une des du de d l au aux ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs " +
    "je tu il elle on nous vous ils elles me te se lui y en qui que qu quoi dont où et ou mais donc or ni car si " +
    "à dans par pour sur sous avec sans chez vers entre contre depuis pendant avant après jusqu comme quand lorsque dès puis alors ensuite " +
    "est sont être été étant suis es sommes êtes ai as a avons avez ont avoir eu fait faire fais font peut peuvent doit doivent " +
    "ne pas plus jamais très trop assez aussi encore déjà toujours souvent vraiment seulement même tout tous toute toutes chaque autre autres " +
    "quelque quelqu quelques beaucoup peu moins bien mal ici là cela ça ceci celui celle ceux celles quel quelle quels quelles " +
    "dit dire dis va vont aller fois chose choses"
  ).split(/\s+/),
);

/** Mot normalisé : minuscules, sans ponctuation de bord, sans « l' / d' » devant. */
function normaliser(m: string): string {
  const s = m.toLocaleLowerCase("fr").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const k = s.split(/['’]/);
  return k[k.length - 1];
}

/** Mot tel qu'écrit, sans ponctuation de bord ni « l' » devant. */
function motBrut(m: string): string {
  const s = m.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const k = s.split(/['’]/);
  return k[k.length - 1];
}

/** Mot clé d'une phrase : 3 × (dans le titre du chapitre) + 2 × (au moins 2 fois dans le chapitre) + longueur / 4. */
export function motCle(texte: string, ctx: Pick<ContexteDeduction, "titre" | "texteChapitre">): string | null {
  const titre = new Set(mots(ctx.titre).map(normaliser));
  const comptes = new Map<string, number>();
  for (const m of mots(ctx.texteChapitre)) {
    const n = normaliser(m);
    comptes.set(n, (comptes.get(n) ?? 0) + 1);
  }
  let meilleur: string | null = null;
  let note = -1;
  for (const m of mots(texte)) {
    const n = normaliser(m);
    if (n.length < 4 || MOTS_VIDES.has(n) || /\d/.test(n)) continue;
    const s = 3 * (titre.has(n) ? 1 : 0) + 2 * ((comptes.get(n) ?? 0) >= 2 ? 1 : 0) + n.length / 4;
    if (s > note) {
      note = s;
      meilleur = motBrut(m);
    }
  }
  return meilleur;
}

const FORMES_ORDRE: FormeLongue[] = ["horloge", "calendrier", "alerte", "cible", "coche", "graphique", "fleche", "cercle"];
const REGLES_FORME: [FormeLongue, RegExp][] = [
  ["horloge", /^(?:heures?|minutes?|instants?|matin|matins)$/],
  ["calendrier", /^(?:jours?|journées?|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|semaines?|mois|ans?|années?)$/],
  ["alerte", /^(?:alertes?|urgences?|ruptures?|manquer|manque|faux|fausses?|problèmes?|erreurs?)$/],
  ["cible", /^(?:seuils?|objectifs?|minimum|maximum)$/],
  ["coche", /^(?:justes?|solutions?|automatiquement|seule?|seuls|fini|finie|finis)$/],
  ["graphique", /^(?:chiffres?|stocks?|valeurs?|ventes?|tableaux?)$/],
  ["fleche", /^(?:commander|commande|commandes|envoyer|part|arrive|arrivent|rendez-vous)$/],
];

/** Forme de la phrase clé d'après les mots du texte ; jamais deux fois la même de suite. */
export function formePour(texte: string, precedente: FormeLongue | null): FormeLongue {
  const ns = mots(texte).map(normaliser);
  const trouvees = REGLES_FORME.filter(([, re]) => ns.some((n) => re.test(n))).map(([f]) => f);
  const choix = trouvees.find((f) => f !== precedente);
  if (choix) return choix;
  const base = precedente ? FORMES_ORDRE.indexOf(precedente) : -1;
  return FORMES_ORDRE[(base + 1) % FORMES_ORDRE.length];
}

function phraseCleDe(p: PhraseLue, ctx: ContexteDeduction, forcer?: string): ScenePortee {
  const brut = sansFin(p.texte);
  let kw = forcer ?? motCle(brut, ctx);
  let phrase = brut;
  if (nbMots(brut) > 12) {
    const clauses = brut.split(/(?<=[,;:])\s+/).map(sansFin);
    const contient = (c: string) => (kw ? c.toLowerCase().includes(kw.toLowerCase()) : false);
    const clause = clauses.find((c) => contient(c) && nbMots(c) <= 12);
    if (clause) phrase = clause;
    else {
      // Pas de proposition courte : les 12 premiers mots (ou 12 mots autour du mot forcé s'il est plus loin), suivis de « … ».
      const m = mots(brut);
      const i = forcer ? m.findIndex((x) => x.toLowerCase().includes(forcer.toLowerCase())) : -1;
      const d = i >= 12 ? Math.min(i - 6, m.length - 12) : 0;
      phrase = `${sansFin(m.slice(d, d + 12).join(" "))}…`;
      if (!forcer) kw = motCle(phrase, ctx);
    }
  }
  phrase = majuscule(phrase);
  let motClePose: string | null = null;
  if (kw) {
    const idx = phrase.toLowerCase().indexOf(kw.toLowerCase());
    if (idx >= 0) motClePose = phrase.slice(idx, idx + kw.length);
  }
  const forme = formePour(p.texte, ctx.etat.forme);
  ctx.etat.forme = forme;
  return { scene: { type: "phrase-cle", debutMs: p.debutMs, finMs: p.finMs, phrase, motCle: motClePose, forme }, sources: [p] };
}

/* ------------------------------------------------------------------ */
/* Contrôle des scènes longues                                         */
/* ------------------------------------------------------------------ */

/** Instants où un élément arrive à l'écran (le début de la scène compte pour ce qui est déjà là). */
export function apparitions(s: SceneBrouillon): number[] {
  switch (s.type) {
    case "liste":
    case "etapes":
      return s.elements.map((e) => e.apparitionMs);
    case "chiffre":
      return [s.debutMs, ...s.chiffres.map((c) => c.apparitionMs)];
    case "avant-apres":
      return [s.debutMs, s.apparitionApresMs];
    case "phrase-cle":
      return [s.debutMs];
  }
}

/** Vrai si la scène est courte, ou si ses éléments arrivent au fil de la lecture. */
export function estEchelonnee(s: SceneBrouillon): boolean {
  if (s.finMs - s.debutMs <= SCENE_LONGUE_MS) return true;
  const a = apparitions(s);
  const min = Math.min(...a);
  const max = Math.max(...a);
  return max - min >= 1500 && s.finMs - max <= SCENE_LONGUE_MS;
}

/* ------------------------------------------------------------------ */
/* Une phrase → une scène                                              */
/* ------------------------------------------------------------------ */

function sceneUnePhrase(p: PhraseLue, suivante: PhraseLue | undefined, ctx: ContexteDeduction, profondeur: number): { portees: ScenePortee[]; consomme: number } {
  const liste = listeDe(p);
  const aa = liste ? null : avantApresDe(p, suivante);
  let portee: ScenePortee | null = liste;
  let consomme = 1;
  if (!portee && aa) {
    portee = aa.portee;
    consomme = aa.consomme;
  }
  if (!portee) {
    portee = chiffreDe(p);
  }
  if (!portee) {
    const forcer = PLUS_BESOIN.exec(p.texte)?.[0] ?? PLUS_JAMAIS.exec(p.texte)?.[0];
    portee = phraseCleDe(p, ctx, forcer);
  }
  if (consomme === 1 && !estEchelonnee(portee.scene) && profondeur < 2) {
    const moities = couperPhrase(p);
    if (moities) {
      const a = sceneUnePhrase(moities[0], undefined, ctx, profondeur + 1);
      const b = sceneUnePhrase(moities[1], undefined, ctx, profondeur + 1);
      return { portees: [...a.portees, ...b.portees], consomme: 1 };
    }
  }
  return { portees: [portee], consomme };
}

/** Quatre phrases clés de suite : un bloc de 2 à 3 phrases courtes devient une liste (chacune arrive à sa lecture). */
function briserMonotonie(items: ScenePortee[]): ScenePortee[] {
  const res: ScenePortee[] = [];
  let i = 0;
  while (i < items.length) {
    let k = 0;
    while (i + k < items.length && items[i + k].scene.type === "phrase-cle" && items[i + k].sources.length === 1) k++;
    if (k < 4) {
      res.push(items[i]);
      i++;
      continue;
    }
    const taille = Math.min(3, k - 2);
    res.push(items[i]);
    const bloc = items.slice(i + 1, i + 1 + taille);
    const sources = bloc.map((b) => b.sources[0]);
    const elements: ElementApparition[] = sources.map((s) => ({ texte: majuscule(abreger(s.texte, 12)), apparitionMs: s.debutMs, accent: nombresEcrits(s.texte)[0]?.ecrit ?? null }));
    res.push({ scene: { type: "liste", debutMs: sources[0].debutMs, finMs: sources[sources.length - 1].finMs, titre: null, elements, compte: null }, sources });
    i += 1 + taille;
  }
  return res;
}

/**
 * Les scènes de contenu d'un chapitre, dans l'ordre, qui couvrent [début de la 1re phrase, fin de la dernière[ sans trou.
 * Ordre de décision : étapes (≥ 2 impératifs de suite), liste, avant/après, chiffre, phrase clé.
 */
export function deduireScenes(phrases: PhraseLue[], ctx: ContexteDeduction): ScenePortee[] {
  const items: ScenePortee[] = [];
  let i = 0;
  while (i < phrases.length) {
    let run = 0;
    while (i + run < phrases.length && estImperatif(phrases[i + run].texte)) run++;
    if (run >= 2) {
      let num = 1;
      let pos = i;
      for (const t of repartirEtapes(run)) {
        items.push(etapesDe(phrases.slice(pos, pos + t), num));
        num += t;
        pos += t;
      }
      i += run;
      continue;
    }
    const r = sceneUnePhrase(phrases[i], phrases[i + 1], ctx, 0);
    items.push(...r.portees);
    i += r.consomme;
  }
  return briserMonotonie(items);
}
