// Choix de l'illustration d'une couverture (ART-1) d'après son sujet : fonction PURE, sans alias « @/ ».
// Les mots du titre et du sous-titre sont comparés aux mots-clés du registre (liste FERMÉE, `registre-illustrations.ts`) : un mot-clé
// compte s'il apparaît en mots entiers, sans tenir compte des accents, de la casse ni du pluriel. Aucun mot-clé : aucune illustration, la
// couverture reste une composition typographique (jamais un aplat vide).
import { ICONES, ILLUSTRATIONS, NOMS_ICONES_PAGE, type IdIllustration, type NomIcone } from "./registre-illustrations";

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
export function choisirIllustration(titre: string, sousTitre?: string): IdIllustration | null {
  const dansTitre = mots(titre);
  const dansSousTitre = mots(sousTitre ?? "");
  let meilleure: { id: IdIllustration; score: number } | null = null;
  for (const ill of ILLUSTRATIONS) {
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

export function illustrationCouverture(type: keyof typeof ILLUSTRATION_PAR_DEFAUT, titre: string, sousTitre?: string): IdIllustration {
  return choisirIllustration(titre, sousTitre) ?? ILLUSTRATION_PAR_DEFAUT[type];
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
