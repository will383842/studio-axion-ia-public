// Choix de l'illustration d'une couverture (ART-1) d'après son sujet : fonction PURE, sans alias « @/ ».
// Les mots du titre et du sous-titre sont comparés aux mots-clés du registre (liste FERMÉE, `registre-illustrations.ts`) : un mot-clé
// compte s'il apparaît en mots entiers, sans tenir compte des accents, de la casse ni du pluriel. Aucun mot-clé : aucune illustration, la
// couverture reste une composition typographique (jamais un aplat vide).
import { ICONES, ILLUSTRATIONS, NOMS_ICONES_PAGE, type IdIllustration, type NomIcone } from "./registre-illustrations";
import { maquettesDesEtapes } from "./maquettes-etapes";
import type { TypeMini } from "./registre-mini";

/** Mots normalisés : minuscules sans accents, ponctuation retirée, pluriel en -s / -x ramené au singulier. */
function mots(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m));
}

function contient(texte: readonly string[], cle: readonly string[]): boolean {
  return texte.some((_, i) => cle.every((m, k) => texte[i + k] === m));
}

/**
 * Illustration de la banque la mieux reliée au sujet, ou `null`. Score : 2 par mot-clé reconnu dans le titre, 1 dans le sous-titre (le titre
 * dit le sujet) ; à égalité, l'ordre du registre.
 */
export function choisirIllustration(titre: string, sousTitre?: string, exclues: readonly string[] = []): IdIllustration | null {
  const dansTitre = mots(titre);
  const dansSousTitre = mots(sousTitre ?? "");
  let meilleure: { id: IdIllustration; score: number } | null = null;
  for (const ill of ILLUSTRATIONS) {
    if (exclues.includes(ill.id)) continue;
    const score = ill.motsCles.reduce((s, cle) => s + (contient(dansTitre, mots(cle)) ? 2 : contient(dansSousTitre, mots(cle)) ? 1 : 0), 0);
    if (score > 0 && (!meilleure || score > meilleure.score)) meilleure = { id: ill.id as IdIllustration, score };
  }
  return meilleure?.id ?? null;
}

/**
 * Illustration d'une COUVERTURE : celle du sujet si un mot-clé est reconnu, sinon l'image par défaut du type, une métaphore générique de
 * tout carrousel pédagogique : T01 ordinateur et loupe (l'analyse), T01B avion en papier (l'idée), T01C panneau (la direction).
 */
export const ILLUSTRATION_PAR_DEFAUT = { T01: "I01", T01B: "I07", T01C: "I02" } as const satisfies Record<string, IdIllustration>;

/**
 * Scènes de la banque posées par un gabarit quel que soit le sujet (L7 : un même dessin jamais deux fois dans un carrousel). La couverture ne
 * les prend jamais : elle ne peut donc pas répéter la scène d'une page qui la suit.
 */
export const ILLUSTRATIONS_FIXES = { T26: ["I10", "I09"] } as const satisfies Record<string, readonly IdIllustration[]>;
const RESERVEES: readonly string[] = Object.values(ILLUSTRATIONS_FIXES).flat();

export function illustrationCouverture(type: keyof typeof ILLUSTRATION_PAR_DEFAUT, titre: string, sousTitre?: string): IdIllustration {
  return choisirIllustration(titre, sousTitre, RESERVEES) ?? ILLUSTRATION_PAR_DEFAUT[type];
}

/**
 * Icônes qui n'ont jamais de sens à côté d'une question (T23, tour 2) : le « ? » (la question le dit déjà), la croix et la coche (le
 * « non » et le « oui » des comparaisons).
 */
const ICONES_SANS_SENS_QUESTION: ReadonlySet<string> = new Set(["question", "croix", "coche"]);

/** Icône de la banque la mieux reliée à un texte (son nom ou un de ses mots-clés, en mot entier), hors icônes sans sens ; `null` sinon. */
export function choisirIcone(texte: string, secondaire?: string): NomIcone | null {
  const principal = mots(texte);
  const second = mots(secondaire ?? "");
  let meilleure: { nom: NomIcone; score: number } | null = null;
  for (const ic of ICONES) {
    if (ICONES_SANS_SENS_QUESTION.has(ic.nom) || !(NOMS_ICONES_PAGE as readonly string[]).includes(ic.nom)) continue;
    const score = [ic.nom, ...ic.motsCles].reduce((s, cle) => s + (contient(principal, mots(cle)) ? 2 : contient(second, mots(cle)) ? 1 : 0), 0);
    if (score > 0 && (!meilleure || score > meilleure.score)) meilleure = { nom: ic.nom as NomIcone, score };
  }
  return meilleure?.nom ?? null;
}

/**
 * Icônes des questions d'une page T23 : pour chacune, celle choisie par le spec si elle a un sens, sinon celle de son texte (question,
 * puis aide). Un seul système par page : si une question n'en a pas, ou si deux questions ont la même, AUCUNE icône (`null`).
 */
export function iconesDesQuestions(questions: readonly { question: string; aide: string; icone?: NomIcone }[]): NomIcone[] | null {
  const icones = questions.map((q) => (q.icone && !ICONES_SANS_SENS_QUESTION.has(q.icone) ? q.icone : choisirIcone(q.question, q.aide)));
  if (icones.some((i) => i === null)) return null;
  return new Set(icones).size === icones.length ? (icones as NomIcone[]) : null;
}

/** Icône de chaque mini-visuel d'une carte T02 (W01, pastille numérotée, n'en a pas) : même table que le gabarit `T02.tsx`. */
export const ICONE_DU_MINI_PAGE: Record<Exclude<TypeMini, "W01">, NomIcone> = { W02: "coche", W03: "fleche", W06: "graphique", W07: "hausse", W25: "etoile" };

/** Icônes d'un nœud T28 sans icône choisie, par rang : même table que le gabarit `T28.tsx`. */
export const ICONES_NOEUDS_DEFAUT: readonly NomIcone[] = ["document", "engrenage", "loupe", "envoyer", "coche-cercle"];

/** Forme minimale d'une page lue ici (structurelle : ce fichier est importé par studio-rendu, sans le schéma). */
type PageDessinee =
  | { type: "T01" | "T01B" | "T01C"; titre: string; sousTitre?: string }
  | { type: "T02"; cartes: readonly { mini?: TypeMini }[] }
  | { type: "T23"; questions: readonly { question: string; aide: string; icone?: NomIcone }[] }
  | { type: "T28"; noeuds: readonly { icone?: NomIcone }[] }
  | { type: "T20"; etapes: readonly { titre: string; corps: string }[]; variante?: "maquettes" }
  | { type: string };

/**
 * Dessins posés par chaque page d'un carrousel, dans l'ordre (illustrations « Ixx », icônes « icone-nom ») : la porte refuse qu'un même dessin
 * revienne (L7). Les mini-maquettes d'une page T20 « maquettes » (« maquette-nom ») sont des dessins. Les croix, coches et cases des en-têtes et des listes sont des signes du gabarit, pas des dessins.
 */
export function dessinsDuCarrousel(spec: { pages: readonly PageDessinee[] }): { page: number; dessin: string }[] {
  return spec.pages.flatMap((p, i) => {
    const page = i + 1;
    const icones = (noms: readonly string[]) => noms.map((n) => ({ page, dessin: `icone-${n}` }));
    if (p.type === "T01" || p.type === "T01B" || p.type === "T01C") {
      const c = p as Extract<PageDessinee, { titre: string }>;
      return [{ page, dessin: illustrationCouverture(c.type, c.titre, c.sousTitre) }];
    }
    if (p.type === "T26") return ILLUSTRATIONS_FIXES.T26.map((dessin) => ({ page, dessin }));
    if (p.type === "T02") {
      const { cartes } = p as Extract<PageDessinee, { type: "T02" }>;
      return cartes.every((c) => c.mini && c.mini !== "W01") ? icones(cartes.map((c) => ICONE_DU_MINI_PAGE[c.mini as Exclude<TypeMini, "W01">])) : [];
    }
    if (p.type === "T23") return icones(iconesDesQuestions((p as Extract<PageDessinee, { type: "T23" }>).questions) ?? []);
    if (p.type === "T28") return icones((p as Extract<PageDessinee, { type: "T28" }>).noeuds.map((n, k) => n.icone ?? ICONES_NOEUDS_DEFAUT[k % ICONES_NOEUDS_DEFAUT.length]));
    if (p.type === "T20") {
      const t20 = p as Extract<PageDessinee, { type: "T20" }>;
      if (t20.variante === "maquettes") return maquettesDesEtapes(t20.etapes).map((m) => ({ page, dessin: `maquette-${m}` }));
    }
    return [];
  });
}
