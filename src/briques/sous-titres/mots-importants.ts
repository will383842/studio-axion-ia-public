/**
 * MOTS IMPORTANTS des sous-titres : UNE règle unique avec repli, pour tous les générateurs (décision du propriétaire :
 * la mise en valeur est toujours active, à l'intérieur du style choisi).
 * Ordre de repli : emphase du script, sinon mots orange de la fiche, sinon mots forts de la transcription (chiffres,
 * nombres dits, lexique). Plafond commun : 40 % des groupes au plus, 2 mots au plus par groupe.
 * Fichier PUR : copié dans l'image Docker du rendu, aucun import (ni alias, ni autre dossier).
 */

/** Source retenue pour les mots importants. */
export type SourceMotsImportants = "script" | "fiche" | "transcription";

/** Part des groupes mis en valeur au plus. */
export const PART_GROUPES_MAX = 0.4;
/** Mots mis en valeur au plus dans un groupe. */
export const MOTS_PAR_GROUPE_MAX = 2;

const BORDS = /^[\s.,;:!?…«»"“”()[\]—–-]+|[\s.,;:!?…«»"“”()[\]—–-]+$/g;

/** Le mot sans sa ponctuation de bord (« fuite. » → « fuite »). */
function nettoyerMot(w: string): string {
  return w.replace(BORDS, "");
}

/** Minuscules sans accents (comparaisons). */
function simplifierMot(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Retire l'élision de tête (« l'IA » → « IA »). */
function sansElisionMot(w: string): string {
  return w.replace(/^(jusqu|lorsqu|puisqu|qu|l|d|n|s|c|j|m|t)['’]/i, "").replace(/^['’]+/, "");
}

const NOMBRES_LETTRES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  cent: 100, cents: 100, mille: 1000,
  premier: 1, premiere: 1, second: 2, seconde: 2, deuxieme: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7,
  huitieme: 8, neuvieme: 9, dixieme: 10,
};

/** Valeur d'un nombre écrit en lettres (« quarante-cinq » → 45, « troisième » → 3), ou null. */
function valeurEnLettresMot(w: string): number | null {
  const n = simplifierMot(nettoyerMot(w));
  if (!n) return null;
  if (NOMBRES_LETTRES[n] !== undefined) return NOMBRES_LETTRES[n];
  const parts = n.split("-").filter((p) => p && p !== "et");
  if (parts.length < 2 || parts.some((p) => NOMBRES_LETTRES[p] === undefined)) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const v = NOMBRES_LETTRES[parts[i]];
    if (parts[i] === "quatre" && (parts[i + 1] === "vingt" || parts[i + 1] === "vingts")) {
      total += 80;
      i++;
    } else if (v === 100) total = (total || 1) * 100;
    else total += v;
  }
  return total;
}

/** Lexique des mots forts par défaut (forme simplifiée : minuscules, sans accents). */
export const LEXIQUE_FORTS = new Set(
  (
    "temps argent euro euros devis relance relances facture factures client clients chiffre chiffres equipe equipes outil outils ia " +
    "automatiser automatise automatisez automatisation diagnostic gratuit gratuite fuite travail soiree soirees journee journees week-end " +
    "apres-midi dirigeant dirigeants entreprise entreprises recruter recrutement embauche gagner gagnez reservez reserver commentez " +
    "former forme formation audit audite auditer accompagne accompagnement priorites minutes heures jours semaine mois resultat " +
    "resultats vente ventes prospects rendez-vous appel mail mails email emails telephone stack logiciel site miracle"
  ).split(/\s+/),
);

/** Vrai pour un mot fort : chiffre ou nombre dit (sauf l'article « un/une »), mot du lexique ou de la liste fournie. */
export function estMotFort(w: string, motsForts: ReadonlySet<string> = new Set()): boolean {
  const propre = nettoyerMot(w);
  if (!propre) return false;
  if (/\d/.test(propre)) return true;
  const s = simplifierMot(propre);
  const lettres = valeurEnLettresMot(propre);
  if (lettres !== null && s !== "un" && s !== "une") return true;
  const base = simplifierMot(sansElisionMot(propre));
  return motsForts.has(s) || motsForts.has(base) || LEXIQUE_FORTS.has(s) || LEXIQUE_FORTS.has(base);
}

/** Forme de comparaison d'un mot : sans ponctuation, casse ni accents. */
function cle(w: string): string {
  return simplifierMot(sansElisionMot(nettoyerMot(w)));
}

/** Ensemble des mots de plusieurs expressions (chaque mot de chaque expression). */
function ensemble(expressions: readonly string[]): Set<string> {
  const e = new Set<string>();
  for (const x of expressions) for (const morceau of x.split(/\s+/)) {
    const k = cle(morceau);
    if (k) e.add(k);
  }
  return e;
}

export interface EntreeMotsImportants {
  /** Emphase du script (générateur central) : prioritaire si non vide. */
  emphaseScript?: readonly string[];
  /** Mots orange de la fiche : utilisés si l'emphase du script est vide. */
  motsOrange?: readonly string[];
  /** Mots de la transcription (ou du texte affiché), pour le repli. */
  mots: readonly string[];
}

export interface ResultatMotsImportants {
  /** Mots à mettre en valeur, en forme de comparaison (sans casse, accents ni ponctuation). */
  mots: Set<string>;
  source: SourceMotsImportants;
}

/** La règle unique : script, sinon fiche, sinon mots forts de la transcription. */
export function motsImportants(entree: EntreeMotsImportants): ResultatMotsImportants {
  const script = ensemble(entree.emphaseScript ?? []);
  if (script.size > 0) return { mots: script, source: "script" };
  const fiche = ensemble(entree.motsOrange ?? []);
  if (fiche.size > 0) return { mots: fiche, source: "fiche" };
  const forts = new Set<string>();
  for (const m of entree.mots) if (estMotFort(m)) forts.add(cle(m));
  forts.delete("");
  return { mots: forts, source: "transcription" };
}

/**
 * Marque `enValeur` les mots importants des groupes : 2 mots au plus par groupe, 40 % des groupes au plus (les premiers
 * dans l'ordre). Le texte, l'ordre et les groupes ne changent pas ; un mot déjà en valeur le reste.
 */
export function marquerMotsImportants<S extends { mots: { mot: string; enValeur?: boolean }[] }>(
  segments: readonly S[],
  entree: Omit<EntreeMotsImportants, "mots">,
): { segments: S[]; source: SourceMotsImportants } {
  const { mots: cibles, source } = motsImportants({ ...entree, mots: segments.flatMap((s) => s.mots.map((m) => m.mot)) });
  let restant = Math.floor(segments.length * PART_GROUPES_MAX);
  const sortie = segments.map((s) => {
    if (restant <= 0) return s;
    let n = 0;
    const mots = s.mots.map((m) => {
      if (n >= MOTS_PAR_GROUPE_MAX || !cibles.has(cle(m.mot))) return m;
      n++;
      return { ...m, enValeur: true };
    });
    if (n === 0) return s;
    restant--;
    return { ...s, mots } as S;
  });
  return { segments: sortie, source };
}
