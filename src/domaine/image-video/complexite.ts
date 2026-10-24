/**
 * IMAGE → VIDÉO · Type, complexité et durée calculés PAR LE CODE depuis la carte (plan § 2 et § 3). PUR, déterministe :
 * même carte (quel que soit l'ordre de ses listes) = même résultat ; toute égalité est départagée par l'id.
 *
 * U = unités narratives, C = chiffres à dire, B = branches, D = niveaux de décision, N = nœuds.
 */
import { cleChiffre, chiffresDe } from "./chiffres";
import type { CarteImage, NoeudCarte, TypeImage } from "./carte";

/**
 * Débit de référence (voix de Will à 1,1 puis tempo ×1,05), recalibré le 18/10/2026 sur deux vraies voix : 3,52 mots/s
 * (v-dcc902c3f3dd) et 3,27 (v-dd3049053f88), soit 3,39 de moyenne, à tempo ×1,08. Le 24/10/2026 (décision de Will) le tempo passe à ×1,05 :
 * 3,4 × 1,05 / 1,08 ≈ 3,3, par le calcul en attendant la mesure d'une vraie vidéo (la v-6e4a06b9c718 faisait 3,97 à ×1,08). Les mots de chaque classe en découlent : aucun nombre de mots en dur.
 */
export const DEBIT_MOTS_PAR_SEC = 3.3;

export const CLASSES = ["simple", "moyenne", "branches", "tres-complexe"] as const;
export type ClasseImage = (typeof CLASSES)[number];

/** Corps visé (secondes) et mots du corps (= durée × débit, arrondis) par classe (§ 3). */
const motsPour = (sec: number) => Math.round(sec * DEBIT_MOTS_PAR_SEC);
export const BORNES_CLASSE: Readonly<Record<ClasseImage, { corpsSec: [number, number]; mots: [number, number] }>> = Object.freeze({
  simple: { corpsSec: [30, 40], mots: [motsPour(30), motsPour(40)] },
  moyenne: { corpsSec: [40, 50], mots: [motsPour(40), motsPour(50)] },
  branches: { corpsSec: [48, 56], mots: [motsPour(48), motsPour(56)] },
  "tres-complexe": { corpsSec: [60, 78], mots: [motsPour(60), motsPour(78)] },
});

/** Tolérance de la durée estimée d'un script autour de la cible (§ 3). */
export const TOLERANCE_SCRIPT = 0.1;

export interface ChapitreCarte {
  titre: string;
  noeuds: string[];
  /** Faux = détachable (branche minoritaire, détails), retiré des versions courtes. */
  essentiel: boolean;
}

export interface ComplexiteCarte {
  noeuds: number;
  liens: number;
  branches: number;
  niveauxDecision: number;
  chiffresADire: number;
  unitesNarratives: number;
  classe: ClasseImage;
  dureeCibleSec: number;
  fourchetteSec: [number, number];
  motsCorps: [number, number];
  /** Vide sauf « tres-complexe » (2 ou 3 chapitres). */
  chapitres: ChapitreCarte[];
}

type CarteCalcul = Pick<CarteImage, "noeuds" | "liens" | "groupes" | "chiffres">;

const parOrdre = (a: NoeudCarte, b: NoeudCarte) => a.ordre - b.ordre || a.id.localeCompare(b.id);

/** Liens triés par id : l'ordre des listes reçues ne compte jamais. */
function liensTries(carte: Pick<CarteImage, "liens">) {
  return [...carte.liens].sort((a, b) => a.id.localeCompare(b.id));
}

function sortants(carte: Pick<CarteImage, "liens">, id: string): number {
  return carte.liens.filter((l) => l.de === id).length;
}

/** Nœuds de décision : rôle `decision` et au moins deux chemins qui en partent. */
function decisions(carte: CarteCalcul): NoeudCarte[] {
  return carte.noeuds.filter((n) => n.role === "decision" && sortants(carte, n.id) >= 2).sort(parOrdre);
}

/** Niveaux de décision : plus longue suite de décisions sur un même chemin. */
function niveaux(carte: CarteCalcul): number {
  const estDecision = new Set(decisions(carte).map((n) => n.id));
  const precedents = new Map<string, string[]>();
  for (const l of liensTries(carte)) precedents.set(l.vers, [...(precedents.get(l.vers) ?? []), l.de]);
  const memo = new Map<string, number>();
  const profondeur = (id: string, pile: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (pile.has(id)) return 0;
    pile.add(id);
    const avant = Math.max(0, ...(precedents.get(id) ?? []).map((p) => profondeur(p, pile)));
    pile.delete(id);
    const v = avant + (estDecision.has(id) ? 1 : 0);
    memo.set(id, v);
    return v;
  };
  return Math.max(0, ...[...carte.noeuds].sort(parOrdre).map((n) => profondeur(n.id, new Set())));
}

function aUnChiffre(n: NoeudCarte): boolean {
  return [n.libelle, n.detail ?? ""].some((t) => chiffresDe(t).length > 0);
}

/**
 * Unités narratives : 1 par `etape`, `sortie`, `resultat`, `benefice` ; des étapes automatiques consécutives sans
 * chiffre comptent ensemble pour 1 ; une nuée ou un entonnoir (objets en nombre) comptent 2 ; +1 par branche.
 */
function unites(carte: CarteCalcul, branches: number): number {
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const etapeMuette = (n: NoeudCarte | undefined) => !!n && n.role === "etape" && n.acteur === "auto" && !aUnChiffre(n) && !(n.quantite && n.quantite >= 2);
  let u = 0;
  for (const n of [...carte.noeuds].sort(parOrdre)) {
    if (n.quantite !== undefined && n.quantite >= 2) {
      u += 2;
      continue;
    }
    if (!["etape", "sortie", "resultat", "benefice"].includes(n.role)) continue;
    const suiteDeMuettes = etapeMuette(n) && carte.liens.some((l) => l.vers === n.id && etapeMuette(parId.get(l.de)));
    if (!suiteDeMuettes) u += 1;
  }
  return u + branches;
}

/** Chiffres à dire, comptés une fois par écriture (« 80 % » du lien et du bandeau = un seul). */
function chiffresADire(carte: CarteCalcul): number {
  return new Set(carte.chiffres.filter((c) => c.aDire).map((c) => cleChiffre(c.brut))).size;
}

/** Type principal (et secondaire éventuel) recalculé depuis le graphe, dans un ordre de priorité fixe. */
export function typesDeLaCarte(carte: CarteCalcul): [TypeImage] | [TypeImage, TypeImage] {
  const trouves: TypeImage[] = [];
  const compte = (role: NoeudCarte["role"]) => carte.noeuds.filter((n) => n.role === role).length;
  if (decisions(carte).length > 0) trouves.push("embranchement");
  if (carte.groupes.some((g) => g.sorte === "avant") && carte.groupes.some((g) => g.sorte === "apres")) trouves.push("avant-apres");
  const entonnoir = carte.noeuds.some(
    (n) => (n.quantite ?? 0) >= 2 && carte.liens.some((l) => l.de === n.id && sortants(carte, l.vers) >= 2),
  );
  if (entonnoir) trouves.push("entonnoir");
  if (compte("benefice") >= 2) trouves.push("benefices");
  if (compte("indicateur") >= 2) trouves.push("tableau-de-bord");
  const heures = carte.noeuds.filter((n) => [n.libelle, n.detail ?? ""].some((t) => chiffresDe(t).some((c) => c.unite === "heure"))).length;
  if (heures >= 3) trouves.push("chronologie");
  // Convergence : au moins deux sources reliées qui mènent (directement ou par un bloc) à un moteur.
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const versMoteur = (id: string) =>
    carte.liens.some((l) => l.de === id && (parId.get(l.vers)?.role === "moteur" || carte.liens.some((m) => m.de === l.vers && parId.get(m.vers)?.role === "moteur")));
  if (carte.noeuds.filter((n) => n.role === "source" && versMoteur(n.id)).length >= 2) trouves.push("convergence");
  if (trouves.length === 0) trouves.push("chaine");
  return trouves.length >= 2 ? [trouves[0], trouves[1]] : [trouves[0]];
}

function classeDe(type: TypeImage, m: { U: number; C: number; B: number; D: number; N: number; benefices: number; chiffre: boolean }): ClasseImage {
  if (m.U > 9 || m.C > 12 || m.N > 14 || m.D >= 2 || m.B >= 3) return "tres-complexe";
  if (m.B >= 2) return "branches";
  if (m.C <= 4 && ((type === "benefices" && m.benefices <= 5) || (type === "avant-apres" && m.N <= 6 && !m.chiffre))) return "simple";
  return "moyenne";
}

/** Coupe une liste en `k` blocs consécutifs aussi égaux que possible (les premiers plus longs). */
function enBlocs<T>(liste: T[], k: number): T[][] {
  const res: T[][] = [];
  let i = 0;
  for (let b = 0; b < k; b++) {
    const taille = Math.floor(liste.length / k) + (b < liste.length % k ? 1 : 0);
    res.push(liste.slice(i, i + taille));
    i += taille;
  }
  return res.filter((x) => x.length > 0);
}

/** Ramène à 3 chapitres au plus en fusionnant la fin (le dernier garde l'essentiel s'il en contient). */
function auPlusTrois(chapitres: ChapitreCarte[]): ChapitreCarte[] {
  if (chapitres.length <= 3) return chapitres;
  const queue = chapitres.slice(2);
  return [
    ...chapitres.slice(0, 2),
    { titre: queue[0].titre, noeuds: queue.flatMap((c) => c.noeuds), essentiel: queue.some((c) => c.essentiel) },
  ];
}

/**
 * Chapitres d'une carte très complexe : branches de la carte (tronc + branche majoritaire = chapitre essentiel, chaque
 * autre branche = chapitre détachable), sinon ses autres groupes, sinon le chemin principal coupé en 2 ou 3 blocs.
 */
export function chapitresDe(carte: CarteCalcul): ChapitreCarte[] {
  const parId = new Map(carte.noeuds.map((n) => [n.id, n]));
  const tries = (ids: string[]) => ids.map((i) => parId.get(i)).filter((n): n is NoeudCarte => !!n).sort(parOrdre).map((n) => n.id);
  const titreDe = (titre: string | undefined, ids: string[]) => titre ?? parId.get(ids[0])?.libelle ?? "";
  const groupes = [...carte.groupes].sort((a, b) => a.id.localeCompare(b.id));

  const branches = groupes.filter((g) => g.sorte === "branche");
  if (branches.length >= 2) {
    const part = (g: (typeof branches)[number]) => Math.max(0, ...carte.liens.filter((l) => g.noeuds.includes(l.vers) && !g.noeuds.includes(l.de)).map((l) => l.part ?? 0));
    const ordonnees = [...branches].sort((a, b) => Number(!!b.majoritaire) - Number(!!a.majoritaire) || part(b) - part(a) || a.id.localeCompare(b.id));
    const dansBranche = new Set(branches.flatMap((g) => g.noeuds));
    const tronc = carte.noeuds.filter((n) => !dansBranche.has(n.id)).map((n) => n.id);
    const premier = tries([...tronc, ...ordonnees[0].noeuds]);
    const chapitres: ChapitreCarte[] = [
      { titre: titreDe(ordonnees[0].titre, tries(ordonnees[0].noeuds)), noeuds: premier, essentiel: true },
      ...ordonnees.slice(1).map((g) => ({ titre: titreDe(g.titre, tries(g.noeuds)), noeuds: tries(g.noeuds), essentiel: false })),
    ];
    return auPlusTrois(chapitres);
  }

  const autres = groupes.filter((g) => g.sorte !== "branche");
  if (autres.length >= 2) {
    const premierOrdre = (g: (typeof autres)[number]) => Math.min(...g.noeuds.map((i) => parId.get(i)?.ordre ?? 999));
    const ordonnes = [...autres].sort((a, b) => premierOrdre(a) - premierOrdre(b) || a.id.localeCompare(b.id));
    const dansGroupe = new Set(autres.flatMap((g) => g.noeuds));
    const libres = carte.noeuds.filter((n) => !dansGroupe.has(n.id)).map((n) => n.id);
    const chapitres = ordonnes.map((g, i) => ({ titre: titreDe(g.titre, tries(g.noeuds)), noeuds: tries(i === 0 ? [...libres, ...g.noeuds] : g.noeuds), essentiel: true }));
    return auPlusTrois(chapitres);
  }

  const chemin = [...carte.noeuds].sort(parOrdre).map((n) => n.id);
  const k = Math.min(3, Math.max(2, Math.ceil(chemin.length / 5)));
  return enBlocs(chemin, k).map((ids) => ({ titre: titreDe(undefined, ids), noeuds: ids, essentiel: true }));
}

/** Complexité, classe, durée visée et chapitres d'une carte (§ 3). */
export function complexiteDe(carte: CarteCalcul): ComplexiteCarte {
  const type = typesDeLaCarte(carte)[0];
  const decs = decisions(carte);
  const B = decs.reduce((s, n) => s + sortants(carte, n.id), 0);
  const D = niveaux(carte);
  const N = carte.noeuds.length;
  const C = chiffresADire(carte);
  const U = unites(carte, B);
  const classe = classeDe(type, {
    U,
    C,
    B,
    D,
    N,
    benefices: carte.noeuds.filter((n) => n.role === "benefice").length,
    chiffre: carte.chiffres.length > 0,
  });
  const { corpsSec } = BORNES_CLASSE[classe];
  const [bas, haut] = corpsSec;
  const dureeCibleSec = Math.round(bas + (haut - bas) * Math.min(1, (U / 9 + C / 12) / 2));
  return {
    noeuds: N,
    liens: carte.liens.length,
    branches: B,
    niveauxDecision: D,
    chiffresADire: C,
    unitesNarratives: U,
    classe,
    dureeCibleSec,
    fourchetteSec: [bas, haut],
    motsCorps: [motsPour(bas), motsPour(haut)],
    chapitres: classe === "tres-complexe" ? chapitresDe(carte) : [],
  };
}

/** Durée estimée d'un texte dit, au débit de référence. */
export function dureeEstimeeSec(mots: number): number {
  return mots / DEBIT_MOTS_PAR_SEC;
}

/** Vrai si la durée estimée du script tombe dans la cible ±10 % (sinon le script est refusé, § 3). */
export function dureeScriptAcceptable(c: Pick<ComplexiteCarte, "dureeCibleSec">, dureeSec: number): boolean {
  return Math.abs(dureeSec - c.dureeCibleSec) <= c.dureeCibleSec * TOLERANCE_SCRIPT;
}
