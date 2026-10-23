/**
 * « MA VOIX » (générateur, plan v5 B.6.1, lot G2). PUR : importable côté client.
 * - tournures interdites à deux niveaux (`bloquant` seule ; `grappe` à partir de 2 dans un script, dès 1 dans un post) ;
 * - interdits de marque (ordres permanents de Will) : appliqués d'office, ils ne font que restreindre ;
 * - carnet de voix : expressions tirées des textes de Will par SOUS-CHAÎNE EXACTE, validées d'un toucher ;
 * - fiche de style proposée depuis les textes (longueurs de phrases, ouvertures), validée par Will ;
 * - sigles inconnus du dictionnaire de prononciation (file « à valider », jamais bloquante, C25).
 */
import type { ContexteAxion, DateIso, ExempleStyle, FicheStyle, Prononciation, TourneInterdite } from "./types";

/** Drapeaux des expressions des tournures (traduction JavaScript du lot GR : « imu »), plus « g » pour compter. */
export const DRAPEAUX_RECHERCHE = "gimu";

export interface TournureTrouvee {
  id: string;
  motif: string;
  niveau: TourneInterdite["niveau"];
  nombre: number;
  extraits: string[];
}

export interface ResultatTournures {
  trouvees: TournureTrouvee[];
  bloquantes: TournureTrouvee[];
  grappes: TournureTrouvee[];
  /** Nombre total d'occurrences de niveau `grappe`. */
  nombreGrappes: number;
  /** Vrai si une tournure bloquante est présente, ou si les grappes atteignent le seuil. */
  bloque: boolean;
}

function compiler(regex: string): RegExp | null {
  try {
    return new RegExp(regex, DRAPEAUX_RECHERCHE);
  } catch {
    return null;
  }
}

/**
 * Applique les tournures actives (non rangées) à un texte. `seuilGrappe` : 2 pour un script, 1 pour un post LinkedIn.
 * Portée `affiche` exclue ici (règles de typographie, contrôlées sur la forme affichée en G3).
 */
export function appliquerTournures(texte: string, tournures: Pick<TourneInterdite, "id" | "motif" | "regex" | "niveau" | "portee" | "archiveLe">[], options: { seuilGrappe?: number } = {}): ResultatTournures {
  const seuil = options.seuilGrappe ?? 2;
  const trouvees: TournureTrouvee[] = [];
  for (const t of tournures) {
    if (t.archiveLe || t.portee === "affiche") continue;
    const re = compiler(t.regex);
    if (!re) continue;
    const extraits = [...texte.matchAll(re)].map((m) => m[0].trim()).filter(Boolean);
    if (extraits.length) trouvees.push({ id: t.id, motif: t.motif, niveau: t.niveau, nombre: extraits.length, extraits });
  }
  const bloquantes = trouvees.filter((t) => t.niveau === "bloquant");
  const grappes = trouvees.filter((t) => t.niveau === "grappe");
  const nombreGrappes = grappes.reduce((a, t) => a + t.nombre, 0);
  return { trouvees, bloquantes, grappes, nombreGrappes, bloque: bloquantes.length > 0 || nombreGrappes >= seuil };
}

/** Échappe un texte pour une expression régulière. */
export function echapperRegex(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Expression d'une tournure saisie par Will : le motif tel quel, entre limites de mots (lettres accentuées comprises). */
export function regexDeMotif(motif: string): string {
  const parties = motif.trim().split(/\s+/).map(echapperRegex);
  return `(?<![\\p{L}\\p{N}_])${parties.join("\\s+")}(?![\\p{L}\\p{N}_])`;
}

/** Forme lisible d'une expression d'origine : 1re variante, lettres accentuées gardées, rien de technique. */
function lisibleDeRegex(regex: string): string {
  // 1re variante au niveau le plus haut.
  let profondeur = 0;
  let fin = regex.length;
  for (let i = 0; i < regex.length; i++) {
    const c = regex[i];
    if (c === "\\") i++;
    else if (c === "(" || c === "[") profondeur++;
    else if (c === ")" || c === "]") profondeur--;
    else if (c === "|" && profondeur === 0) {
      fin = i;
      break;
    }
  }
  let t = regex.slice(0, fin);
  t = t.replace(/\(\^\|\[[^\]]*\]\\s\*\)/g, "").replace(/\\s\*?/g, " ").replace(/\\b/g, "");
  // Classe de lettres : la lettre accentuée si elle y est (« [àa] » → à), sinon la première.
  t = t.replace(/\[([^\]^]+)\]/g, (_m, c: string) => [...c].find((x) => /[^\x00-\x7f]/.test(x)) ?? c[0]);
  // Groupes facultatifs retirés, alternatives réduites à la 1re.
  for (let i = 0; i < 4; i++) t = t.replace(/\(([^()]*)\)\?/g, "").replace(/\(([^()|]*)(?:\|[^()]*)?\)/g, "$1");
  return t.replace(/[?*+]/g, "").replace(/\s+/g, " ").trim();
}

/** Tournures dont l'expression ne se relit pas mot pour mot (structures, débuts de phrase) : libellé écrit à la main. */
const LIBELLES_TOURNURES: Readonly<Record<string, string>> = {
  "personne-n-en-parle": "personne n'en parle",
  "chiffres-verifies": "chiffres vérifiés",
  "resultat-en-tete": "« Résultat : » en début de phrase",
  "en-effet-en-tete": "« En effet » en début de phrase",
  "ainsi-en-tete": "« Ainsi, » en début de phrase",
  "vraiment-question": "vraiment ?",
  "ce-n-est-pas-x-c-est-y": "ce n'est pas X, c'est Y",
  "ce-n-est-pas-x-c-est-y-large": "ce n'est pas X… c'est Y",
  "pas-x-mais-y": "pas X mais Y",
  "pas-x-mais-y-large": "pas seulement X… mais Y",
  decortiquer: "décortiquer",
  decryptons: "décryptons",
  "stop-arretez": "« Stop. » ou « Arrêtez. » seul",
  "voici-nombre": "voici + un nombre",
};

const sansAccent = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Vérification E2E n° 1, n° 26 : le libellé MONTRÉ d'une tournure interdite. Les tournures semées portent un motif
 * normalisé (« a-l-ere-de ») : on le relit dans l'expression d'origine pour retrouver accents et apostrophes
 * (« à l'ère de »). Un motif déjà lisible (dicté par Will) est rendu tel quel. PUR.
 */
export function libelleTournure(motif: string, regexOrigine?: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(motif)) return motif;
  if (LIBELLES_TOURNURES[motif]) return LIBELLES_TOURNURES[motif];
  const mots = motif.split("-");
  if (regexOrigine) {
    const morceaux = lisibleDeRegex(regexOrigine).match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? [];
    let k = 0;
    let sortie = "";
    for (const m of morceaux) {
      if (k === mots.length) break;
      if (/[\p{L}\p{N}]/u.test(m)) {
        if (sansAccent(m) !== mots[k]) break;
        sortie += m;
        k++;
      } else if (sortie) sortie += m.includes("'") || m.includes("’") ? "'" : m.includes("-") ? "-" : " ";
    }
    if (k === mots.length) return sortie.trim();
  }
  return mots.join(" ");
}

/* ------------------------------------------------------------------ */
/* Interdits de marque (ordres permanents de Will, C42)                 */
/* ------------------------------------------------------------------ */

export interface InterditTrouve {
  id: string;
  texte: string;
  extrait: string;
}

/** Applique d'office les interdits qui ont une expression (confirmés ou non : ils ne font que restreindre). */
export function appliquerInterdits(texte: string, interdits: ContexteAxion["interdits"]): InterditTrouve[] {
  const sortie: InterditTrouve[] = [];
  for (const i of interdits) {
    if (!i.regex) continue;
    const re = compiler(i.regex);
    const m = re ? re.exec(texte) : null;
    if (m) sortie.push({ id: i.id, texte: i.texte, extrait: m[0] });
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Carnet de voix : extraction par sous-chaîne exacte                   */
/* ------------------------------------------------------------------ */

const MOTS_OUTILS = new Set(
  "a à au aux avec ce ces c c' cette d de des du e elle en est et il ils j je l la le les leur lui m ma mais me mes mon n ne nous on ou où par pas pour qu que qui s sa se ses si son sur t ta te tes ton tu un une vous vos votre y".split(" "),
);

function normal(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface ExpressionProposee {
  /** Sous-chaîne EXACTE du texte source. */
  expression: string;
  texteSourceId: string;
  /** Nombre de textes de Will où elle revient. */
  textes: number;
}

/**
 * Expressions qui reviennent dans au moins deux textes de Will (2 à 5 mots, pas seulement des mots-outils). Chaque
 * expression est une SOUS-CHAÎNE EXACTE de son texte source (vérifiée) ; Will la valide d'un toucher.
 */
export function proposerCarnetVoix(textes: Pick<ExempleStyle, "id" | "texte">[], options: { min?: number; max?: number } = {}): ExpressionProposee[] {
  const min = options.min ?? 2;
  const occurrences = new Map<string, { expression: string; texteSourceId: string; textes: Set<string> }>();
  for (const t of textes) {
    const mots = [...t.texte.matchAll(/[\p{L}\p{N}'’-]+/gu)].map((m) => ({ mot: m[0], debut: m.index!, fin: m.index! + m[0].length }));
    for (let n = 5; n >= 2; n--) {
      for (let i = 0; i + n <= mots.length; i++) {
        const fenetre = mots.slice(i, i + n);
        const brut = t.texte.slice(fenetre[0].debut, fenetre[n - 1].fin);
        if (/[.!?;:\n]/.test(brut)) continue;
        const pleins = fenetre.filter((m) => !MOTS_OUTILS.has(normal(m.mot).replace(/['’]$/, "")));
        if (!pleins.length) continue;
        const cle = normal(fenetre.map((m) => m.mot).join(" "));
        const o = occurrences.get(cle) ?? { expression: brut, texteSourceId: t.id, textes: new Set<string>() };
        o.textes.add(t.id);
        occurrences.set(cle, o);
      }
    }
  }
  const retenues = [...occurrences.entries()]
    .filter(([, o]) => o.textes.size >= min)
    .sort((a, b) => b[1].textes.size - a[1].textes.size || b[0].length - a[0].length);
  // Une expression contenue dans une plus longue déjà retenue (même nombre de textes) n'est pas reproposée.
  const sortie: ExpressionProposee[] = [];
  for (const [cle, o] of retenues) {
    if (sortie.some((s) => normal(s.expression).includes(cle) && s.textes >= o.textes.size)) continue;
    const source = textes.find((t) => t.id === o.texteSourceId)!;
    if (!source.texte.includes(o.expression)) continue;
    sortie.push({ expression: o.expression, texteSourceId: o.texteSourceId, textes: o.textes.size });
    if (sortie.length >= (options.max ?? 12)) break;
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* Fiche de style proposée                                             */
/* ------------------------------------------------------------------ */

function phrasesDe(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((p) => p.trim())
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
}

/** Mesures d'une fiche de style tirées des textes retenus : longueur médiane des phrases, écart type, ouvertures. */
export function mesurerTextes(textes: Pick<ExempleStyle, "id" | "texte" | "retenu" | "archiveLe">[]): Pick<FicheStyle, "longueurPhraseMediane" | "ecartTypeLongueurs" | "ouvertures" | "tireeDe"> {
  const retenus = textes.filter((t) => t.retenu && !t.archiveLe);
  const longueurs = retenus.flatMap((t) => phrasesDe(t.texte).map((p) => p.split(/\s+/).length)).sort((a, b) => a - b);
  const mediane = longueurs.length ? (longueurs.length % 2 ? longueurs[(longueurs.length - 1) / 2] : (longueurs[longueurs.length / 2 - 1] + longueurs[longueurs.length / 2]) / 2) : 0;
  const moyenne = longueurs.length ? longueurs.reduce((a, b) => a + b, 0) / longueurs.length : 0;
  const ecart = longueurs.length ? Math.sqrt(longueurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / longueurs.length) : 0;
  // Ouverture : les premiers mots du texte, tels qu'écrits (sous-chaîne exacte).
  const ouvertures = [...new Set(retenus.map((t) => /^\s*([\p{L}\p{N}'’-]+(?:\s+[\p{L}\p{N}'’-]+){0,3})/u.exec(t.texte)?.[1] ?? "").filter(Boolean))].slice(0, 6);
  return { longueurPhraseMediane: mediane, ecartTypeLongueurs: Math.round(ecart * 10) / 10, ouvertures, tireeDe: retenus.map((t) => t.id) };
}

/** Nombre de mots d'un texte. */
export function compterMots(texte: string): number {
  return (texte.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
}

/* ------------------------------------------------------------------ */
/* Prononciation : sigles inconnus (file « à valider », C25)            */
/* ------------------------------------------------------------------ */

/** Sigles (2 à 6 capitales) absents du dictionnaire. La voix les lit comme un mot d'ici là : rien n'est bloqué. */
export function siglesInconnus(textes: string[], dictionnaire: Pick<Prononciation, "mot" | "archiveLe">[]): string[] {
  const connus = new Set(dictionnaire.filter((p) => !p.archiveLe).map((p) => normal(p.mot)));
  const trouves = new Set<string>();
  for (const t of textes) for (const m of t.matchAll(/(?<![\p{L}\p{N}])\p{Lu}{2,6}(?![\p{L}\p{N}])/gu)) if (!connus.has(normal(m[0]))) trouves.add(m[0]);
  return [...trouves].sort();
}

/* ------------------------------------------------------------------ */
/* Rappel hebdomadaire facultatif (coupé par défaut)                   */
/* ------------------------------------------------------------------ */

/** « 2 phrases entendues cette semaine ? » : seulement si Will l'a allumé, au plus une fois tous les 7 jours. */
export function rappelHebdoDu(actif: boolean, dernier: DateIso | undefined, maintenant: DateIso): boolean {
  if (!actif) return false;
  if (!dernier) return true;
  return new Date(maintenant).getTime() - new Date(dernier).getTime() >= 7 * 86_400_000;
}
