/**
 * APPRENTISSAGE (plan « socle qualité », § 5.6 : L1, L2 et mémoire de la voix de Will). PUR, sans réseau.
 *
 * ÉTEINT PAR DÉFAUT : le réglage `generateur.apprentissage` est faux tant que Will ne l'allume pas ; rien ne change
 * alors (les services ne lisent même pas les mesures).
 *  - L1 : les 3 à 5 vidéos les mieux rangées d'un format donnent un bloc `<gagnants>` de FORME (accroche, structure,
 *    rythme), sans reprendre leur contenu. Moins de `MINIMUM_GROUPE` vidéos mesurées : repli sur les extraits de Will.
 *  - L2 : « ce qui marche » devient un poids de choix (×1,5 au plus), jamais une pénalité ; les limites de série (C43)
 *    restent le garde-fou.
 *  - Mémoire de la voix : les phrases que Will a modifiées à la relecture (généré → validé), et les tournures à éviter
 *    et préférées qu'on en tire. Rien n'en est envoyé à Claude ici.
 */
import { MINIMUM_GROUPE, type Groupe, type RangVideo } from "./mesures-rangs";
import type { CorrectionWill } from "./types";

/** Réglage d'allumage (faux par défaut). */
export const PARAM_APPRENTISSAGE = "generateur.apprentissage";

/** Au plus 5 modèles, au moins `MINIMUM_GROUPE` (3). */
export const GAGNANTS_MAX = 5;
/** Poids maximal donné à ce qui marche. */
export const POIDS_APPRENTISSAGE_MAX = 1.5;

/** Jour (AAAA-MM-JJ, UTC) d'un instant ISO : le bloc `<gagnants>` n'est recalculé qu'une fois par jour. */
export const jourDe = (instant: string): string => instant.slice(0, 10);

/* ------------------------------------------------------------------ */
/* L1 · Gagnants mesurés                                               */
/* ------------------------------------------------------------------ */

/** La forme d'une vidéo qui a marché : jamais son texte. */
export interface ProfilGagnant {
  code: string;
  rang: number;
  sur: number;
  structure?: string;
  /** Famille d'accroche. */
  ouverture?: string;
  /** Mots de la première phrase dite. */
  motsAccroche: number;
  formeAccroche: "question" | "affirmation" | "chiffre";
  /** Mots par phrase, moyenne arrondie. */
  motsParPhrase: number;
  /** Part des mots dite avant le corps (fin de l'ouverture), en %. */
  livraisonPct: number;
}

export interface PhrasesVersion {
  ouverture: string[];
  corps: string[];
  fin: string[];
}

const mots = (t: string): number => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;

/** Forme d'une version, calculée sur ses phrases dites. Entier uniquement : aucune citation. */
export function formeDe(p: PhrasesVersion): Pick<ProfilGagnant, "motsAccroche" | "formeAccroche" | "motsParPhrase" | "livraisonPct"> {
  const toutes = [...p.ouverture, ...p.corps, ...p.fin].map((x) => x.trim()).filter(Boolean);
  const premiere = (p.ouverture[0] ?? toutes[0] ?? "").trim();
  const total = toutes.reduce((s, x) => s + mots(x), 0);
  const avantCorps = p.ouverture.reduce((s, x) => s + mots(x), 0);
  return {
    motsAccroche: mots(premiere),
    formeAccroche: /\?\s*$/.test(premiere) ? "question" : /\d/.test(premiere) ? "chiffre" : "affirmation",
    motsParPhrase: toutes.length ? Math.round(total / toutes.length) : 0,
    livraisonPct: total ? Math.round((avantCorps / total) * 100) : 0,
  };
}

/**
 * Les vidéos gagnantes d'un format : les mieux rangées parmi les vidéos MESURÉES de ce format (exemples de démonstration
 * exclus). Moins de `MINIMUM_GROUPE` vidéos mesurées : liste vide (repli). Ordre stable (rang, puis code).
 */
export function gagnantsDuFormat(rangs: readonly RangVideo[], formatId: string, nombre = GAGNANTS_MAX): RangVideo[] {
  const du = rangs.filter((r) => r.video.formatId === formatId && !r.video.exemple);
  if (du.length < MINIMUM_GROUPE) return [];
  return [...du].sort((a, b) => b.position - a.position || a.rang - b.rang || a.video.code.localeCompare(b.video.code)).slice(0, Math.min(Math.max(nombre, MINIMUM_GROUPE), GAGNANTS_MAX));
}

/**
 * Le texte du bloc `<gagnants>` mesuré. Déterministe (mêmes profils, mêmes octets). `libelle` donne un nom lisible à une
 * structure ou une famille d'accroche. Aucun profil : chaîne vide (l'appelant retombe sur les extraits de Will).
 */
export function rendreGagnantsMesures(profils: readonly ProfilGagnant[], libelle: (axe: "structure" | "ouverture", valeur: string) => string = (_a, v) => v): string {
  if (!profils.length) return "";
  const lignes = profils.map((p) => {
    const morceaux = [
      p.ouverture ? `accroche « ${libelle("ouverture", p.ouverture)} »` : "accroche",
      `${p.formeAccroche} de ${p.motsAccroche} mots`,
      p.structure ? `structure « ${libelle("structure", p.structure)} »` : "",
      `phrases de ${p.motsParPhrase} mots en moyenne`,
      `livraison après ${p.livraisonPct} % du texte`,
    ].filter(Boolean);
    return `- n° ${p.rang} sur ${p.sur} : ${morceaux.join(" ; ")}.`;
  });
  return ["Les vidéos de Will qui ont le mieux marché (mesurées) : des modèles de FORME (accroche, structure, rythme), jamais un contenu à reprendre.", ...lignes].join("\n");
}

/* ------------------------------------------------------------------ */
/* L2 · Pondération                                                    */
/* ------------------------------------------------------------------ */

/**
 * Poids de choix tirés de « ce qui marche » : un groupe lu (≥ 3 vidéos) dont la position médiane dépasse la moitié
 * gagne jusqu'à ×1,5 (position 1) ; les autres restent à 1 (jamais en dessous : aucune pénalité nouvelle).
 */
export function poidsDepuisGroupes(groupes: readonly Groupe[]): Record<string, number> {
  const poids: Record<string, number> = {};
  for (const g of groupes) {
    if (g.tropTot || g.positionMediane === undefined || g.positionMediane <= 0.5) continue;
    poids[g.valeur] = +Math.min(POIDS_APPRENTISSAGE_MAX, 1 + (g.positionMediane - 0.5)).toFixed(3);
  }
  return poids;
}

/* ------------------------------------------------------------------ */
/* Mémoire de la voix de Will                                          */
/* ------------------------------------------------------------------ */

type PaireCorrection = Pick<CorrectionWill, "phraseAvant" | "phraseApres">;

const net = (s: string) => s.replace(/\s+/g, " ").trim();

/** Les phrases changées par Will : (avant, après) pour chaque ligne dite dont le texte diffère. */
export function correctionsDeLignes(avant: readonly { id: string; dit: string }[], apres: readonly { id: string; dit: string }[]): PaireCorrection[] {
  const r: PaireCorrection[] = [];
  for (const a of avant) {
    const b = apres.find((x) => x.id === a.id);
    if (b && net(b.dit) && net(b.dit) !== net(a.dit)) r.push({ phraseAvant: net(a.dit), phraseApres: net(b.dit) });
  }
  return r;
}

const motsMinuscules = (t: string): string[] => (t.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? []).filter((m) => m.length > 2);

export interface TournuresApprises {
  /** Mots ou expressions que Will enlève de façon répétée. */
  aEviter: string[];
  /** Mots ou expressions qu'il met à la place de façon répétée. */
  preferees: string[];
}

/**
 * Tournures à éviter et préférées, tirées des corrections de Will : un mot (ou deux mots de suite) retiré dans au moins
 * `seuil` corrections différentes est « à éviter » ; un mot ajouté dans au moins `seuil` corrections est « préféré ».
 * Ordre : du plus fréquent au moins fréquent, puis alphabétique. Pur ; rien n'est envoyé à Claude.
 */
export function tournuresDesCorrections(corrections: readonly PaireCorrection[], seuil = 2): TournuresApprises {
  const retires = new Map<string, number>();
  const ajoutes = new Map<string, number>();
  const unites = (t: string) => {
    const m = motsMinuscules(t);
    return new Set([...m, ...m.slice(1).map((x, i) => `${m[i]} ${x}`)]);
  };
  for (const c of corrections) {
    const avant = unites(c.phraseAvant);
    const apres = unites(c.phraseApres);
    for (const u of avant) if (!apres.has(u)) retires.set(u, (retires.get(u) ?? 0) + 1);
    for (const u of apres) if (!avant.has(u)) ajoutes.set(u, (ajoutes.get(u) ?? 0) + 1);
  }
  const retenir = (m: Map<string, number>) =>
    [...m]
      .filter(([, n]) => n >= seuil)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([u]) => u);
  return { aEviter: retenir(retires), preferees: retenir(ajoutes) };
}
