/**
 * REGISTRE DES CODES DE FORMAT (générateur, plan v5 B.2.4, B.0 n° 31). PUR : importable côté client.
 *
 * Un code de classement = 2 ou 3 lettres majuscules, unique, JAMAIS réattribué : la liste est en AJOUT SEUL, un code
 * archivé reste réservé. Le code est rattaché à l'identifiant du format (pas à son nom) : renommer un format ne change
 * pas son code. Il entre dans le code de chaque version par réseau (« 0042-AV-TT ») et dans les noms de fichiers.
 *
 * TST est réservé aux essais : le format fictif « test » n'est inscrit QUE depuis `tests/` (plan B.4.0).
 */

export interface EntreeCodeFormat {
  code: string;
  formatId: string;
  creeLe: string;
  archiveLe?: string;
  /** Réservé pour un format à venir (aucune définition dans `formats/` aujourd'hui). */
  reserve?: boolean;
}

const SEME_LE = "2026-10-02";

/** Semé le 02/10/2026 (B.2.4) : AV, PO, EP, UG, SE, MO, WC, SAR, BUR, TE, TST. */
const REGISTRE: EntreeCodeFormat[] = [
  { code: "AV", formatId: "avocat", creeLe: SEME_LE },
  { code: "PO", formatId: "podcast", creeLe: SEME_LE },
  { code: "EP", formatId: "ecran-partage", creeLe: SEME_LE },
  { code: "UG", formatId: "ugc", creeLe: SEME_LE },
  { code: "SE", formatId: "selfie", creeLe: SEME_LE },
  { code: "MO", formatId: "motion", creeLe: SEME_LE },
  { code: "WC", formatId: "createur-b", creeLe: SEME_LE },
  { code: "SAR", formatId: "podcast-a-deux", creeLe: SEME_LE, reserve: true },
  { code: "BUR", formatId: "derriere-un-bureau", creeLe: SEME_LE, reserve: true },
  { code: "TE", formatId: "avis-client", creeLe: SEME_LE, reserve: true },
  { code: "TST", formatId: "test", creeLe: SEME_LE, reserve: true },
  // Plan facecam v4 (09/10) : format « Face caméra » filmé à l'iPhone (famille `face-camera`, inchangée).
  { code: "FC", formatId: "facecam", creeLe: "2026-10-09" },
  // Format « Tableau animé » (TB-10). « TA » est le compte régie TikTok de l'Usine : TB est libre des deux côtés.
  { code: "TB", formatId: "tableau-anime", creeLe: "2026-10-11" },
  { code: "CC", formatId: "cas-concret", creeLe: "2026-10-12" },
  // Format « Face caméra animée » (réf. LinkedIn, plan du 14/10) : nouveau générateur, indépendant du face caméra.
  { code: "FA", formatId: "facecam-animee", creeLe: "2026-10-14" },
  { code: "IV", formatId: "image-video", creeLe: "2026-10-15" },
];

export const MOTIF_CODE_FORMAT = /^[A-Z]{2,3}$/;

export function listerCodes(): readonly EntreeCodeFormat[] {
  return REGISTRE;
}

/** Code d'un format (null s'il n'a pas encore de code). */
export function codeDuFormat(formatId: string): string | null {
  return REGISTRE.find((e) => e.formatId === formatId)?.code ?? null;
}

export function entreeDuCode(code: string): EntreeCodeFormat | undefined {
  return REGISTRE.find((e) => e.code === code);
}

/**
 * Ajoute un code (ajout seul). Refusé si le code est mal formé, déjà pris (même archivé) ou si le format a déjà un code.
 * Ne change rien d'existant.
 */
export function inscrireCodeFormat(entree: Omit<EntreeCodeFormat, "creeLe"> & { creeLe?: string }): EntreeCodeFormat {
  if (!MOTIF_CODE_FORMAT.test(entree.code)) throw new Error(`Code de format mal formé : ${entree.code} (2 ou 3 lettres majuscules)`);
  if (entreeDuCode(entree.code)) throw new Error(`Code déjà réservé : ${entree.code}`);
  if (codeDuFormat(entree.formatId)) throw new Error(`Le format ${entree.formatId} a déjà un code`);
  const e: EntreeCodeFormat = { ...entree, creeLe: entree.creeLe ?? new Date().toISOString().slice(0, 10) };
  REGISTRE.push(e);
  return e;
}

function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Propose 2 ou 3 lettres LIBRES pour un nouveau format (jamais un code déjà réservé, même archivé). */
export function proposerCode(nom: string, nombre = 3): string[] {
  const mots = sansAccents(nom)
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((m) => m.length > 0 && !["DE", "DU", "LA", "LE", "LES", "UN", "UNE", "A", "AU", "ET", "TYPE"].includes(m));
  const lettres = mots.join("");
  const consonnes = lettres.replace(/[AEIOUY]/g, "");
  const candidats = [
    mots.map((m) => m[0]).join("").slice(0, 3),
    mots.map((m) => m[0]).join("").slice(0, 2),
    lettres.slice(0, 2),
    lettres.slice(0, 3),
    (lettres[0] ?? "") + consonnes.slice(1, 3),
    (lettres[0] ?? "") + consonnes.slice(1, 2),
    consonnes.slice(0, 3),
  ];
  // Repli : première lettre + toutes les lettres de l'alphabet (toujours une proposition libre).
  for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") candidats.push((lettres[0] ?? "X") + a, (lettres[0] ?? "X") + (lettres[1] ?? "X") + a);
  const libres: string[] = [];
  for (const c of candidats) {
    if (MOTIF_CODE_FORMAT.test(c) && !entreeDuCode(c) && !libres.includes(c)) libres.push(c);
    if (libres.length >= nombre) break;
  }
  return libres;
}
