/**
 * C10-09 — règle d'extraction « mot + définition » tirée d'une phrase DITE (côté Studio, jamais lue par le rendu).
 * Règles fixes en français, sans modèle ni appel à Claude : « X, c'est Y », « X, ça veut dire Y », « X signifie Y », « on appelle X, Y ».
 * `mot` = 1 à 3 mots dits, `definition` = 1 à 4 mots dits, recopiés tels quels (suites contiguës). Rien, ambiguïté ou nombre : null.
 * Pure, sans exception. Rien ne l'appelle encore (C9-36). Non exportée par `index.ts`.
 */
import type { MotMinute } from "../plan-scenes/schema";

export interface DefinitionDite {
  mot: string;
  definition: string;
  /** Indices (dans `mots`) du premier mot du terme et du dernier mot de la définition. */
  premier: number;
  dernier: number;
}

const MOT_MAX = 3;
const DEFINITION_MAX = 4;

/** Mots qui ne peuvent pas être le terme défini (« ça, c'est … », « ce que c'est … »). */
const VIDES = new Set(["ce", "ca", "cela", "ceci", "que", "qui", "il", "elle", "on", "je", "tu", "nous", "vous", "ils", "elles", "et", "mais", "donc", "alors", "voila", "ici", "la", "tout", "oui", "non"]);

const nu = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
/** Mot recopié : la ponctuation de bord est ôtée, le reste est intact. */
const propre = (s: string): string => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
const fermeLaPhrase = (s: string): boolean => /[.!?…;:,]\s*$/.test(s);
const MARQUEURS: readonly (readonly string[])[] = [["cest"], ["c", "est"], ["ca", "veut", "dire"], ["signifie"], ["on", "appelle"]];

export function definitionDite(mots: readonly MotMinute[], premier: number, dernier: number): DefinitionDite | null {
  try {
    if (!Array.isArray(mots) || mots.length === 0) return null;
    const a = Number.isFinite(premier) ? Math.max(0, Math.trunc(premier)) : 0;
    const b = Number.isFinite(dernier) ? Math.min(mots.length - 1, Math.trunc(dernier)) : mots.length - 1;
    if (a > b) return null;
    const bruts: string[] = [];
    for (let i = a; i <= b; i++) {
      const t = mots[i]?.texte;
      if (typeof t !== "string") return null;
      bruts.push(t);
    }
    const w = bruts.map(nu);

    // Toutes les occurrences d'un marqueur : plus d'une = ambiguïté.
    const trouves: { debut: number; fin: number; prefixe: boolean }[] = [];
    for (let i = 0; i < w.length; i++) {
      for (const m of MARQUEURS) {
        if (m.every((x, k) => w[i + k] === x)) {
          trouves.push({ debut: i, fin: i + m.length - 1, prefixe: m[0] === "on" });
          i += m.length - 1;
          break;
        }
      }
    }
    if (trouves.length !== 1) return null;
    const { debut, fin, prefixe } = trouves[0];

    let terme: [number, number];
    let defIdx: number;
    if (prefixe) {
      // « on appelle X, Y » : la virgule dite après X sépare X de Y (sinon ambiguïté).
      let e = -1;
      for (let i = fin + 1; i < bruts.length && i <= fin + MOT_MAX; i++) if (/,\s*$/.test(bruts[i])) { e = i; break; }
      if (e < 0) return null;
      terme = [fin + 1, e];
      defIdx = e + 1;
    } else {
      if (debut === 0) return null;
      let s = debut - 1;
      while (s > 0 && !fermeLaPhrase(bruts[s - 1])) s--;
      terme = [s, debut - 1];
      defIdx = fin + 1;
    }
    let f = defIdx;
    while (f < bruts.length) {
      if (fermeLaPhrase(bruts[f])) break;
      f++;
    }
    const finDef = Math.min(f, bruts.length - 1);
    if (defIdx > finDef) return null;

    const nTerme = terme[1] - terme[0] + 1;
    const nDef = finDef - defIdx + 1;
    if (nTerme < 1 || nTerme > MOT_MAX || nDef < 1 || nDef > DEFINITION_MAX) return null;
    const motsTerme = bruts.slice(terme[0], terme[1] + 1).map(propre);
    const motsDef = bruts.slice(defIdx, finDef + 1).map(propre);
    if ([...motsTerme, ...motsDef].some((x) => x === "")) return null;
    if (motsDef.some((x) => /\d/.test(x))) return null;
    // Même découpage que la garde et la pièce (l'apostrophe coupe aussi) : jamais un couple que la pièce refuse.
    const compte = (l: readonly string[]): number => l.join(" ").split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
    if (compte(motsTerme) > MOT_MAX || compte(motsDef) > DEFINITION_MAX) return null;
    if (motsTerme.every((x) => VIDES.has(nu(x)))) return null;

    return { mot: motsTerme.join(" "), definition: motsDef.join(" "), premier: a + terme[0], dernier: a + finDef };
  } catch {
    return null;
  }
}
