/**
 * Z3-M · logique PURE de l'écran Migration (aucun réseau, aucune horloge cachée) :
 * comptages, écart de somme, critères de résiliation, lots, confirmation. Tout vient des données reçues.
 */

export type Reseau = "instagram" | "facebook" | "linkedin" | "tiktok";
export type EtatPost = "laisse-buffer" | "verifie-zernio" | "a-verifier" | "restant";
export type CodeLot = "A" | "B" | "C";

export interface PostMigration {
  id: string;
  reseau: Reseau;
  titre: string;
  /** Date prévue, ISO 8601 UTC. */
  datePrevue: string;
  etat: EtatPost;
  /** « C'est juste » donné par vous sur ce brouillon. */
  cJuste?: boolean;
}

export interface PublicationReelle {
  /** Jour AAAA-MM-JJ. */
  jour: string;
  premierCommentaire: boolean;
  lienVerifie: boolean;
  aVerifier: boolean;
}

export interface CompteMigration {
  id: string;
  libelle: string;
  reseau: Reseau;
  publications: PublicationReelle[];
}

export interface DonneesMigration {
  posts: PostMigration[];
  comptes: CompteMigration[];
  /** Posts dont la date est passée, à reprogrammer par vous. */
  apresDate?: string[];
}

export const DATE_LIMITE_RESILIATION = "2026-11-18";
export const BASCULE_LOT_C = "2026-11-20";
export const DELAI_MIN_MS = 30 * 60_000;
export const REQUIS = { publications: 2, jours: 5 } as const;

export interface Comptage {
  total: number;
  laissesBuffer: number;
  verifies: number;
  aVerifier: number;
  restants: number;
  enRegle: number;
  pourcent: number;
  somme: number;
  ecart: number;
}

export function compter(posts: PostMigration[]): Comptage {
  const n = (e: EtatPost) => posts.filter((p) => p.etat === e).length;
  const laissesBuffer = n("laisse-buffer"), verifies = n("verifie-zernio"), aVerifier = n("a-verifier"), restants = n("restant");
  const total = posts.length;
  const somme = laissesBuffer + verifies + aVerifier + restants;
  const enRegle = laissesBuffer + verifies;
  return { total, laissesBuffer, verifies, aVerifier, restants, enRegle, pourcent: total ? Math.round((enRegle / total) * 100) : 0, somme, ecart: total - somme };
}

export function lotDe(p: Pick<PostMigration, "reseau" | "datePrevue">): CodeLot | null {
  if (p.datePrevue.slice(0, 10) > BASCULE_LOT_C) return "C";
  if (p.reseau === "instagram" || p.reseau === "facebook") return "A";
  if (p.reseau === "linkedin") return "B";
  return null;
}

export interface ResumeLot {
  code: CodeLot;
  intitule: string;
  plage: string;
  faits: number;
  total: number;
  statut: "vide" | "a-faire" | "en-cours" | "termine";
}

const INFO_LOT: Record<CodeLot, { intitule: string; plage: string }> = {
  A: { intitule: "Lot A · Instagram et Facebook", plage: "du 8 au 20/11" },
  B: { intitule: "Lot B · LinkedIn", plage: "du 9 au 20/11" },
  C: { intitule: "Lot C · tous réseaux", plage: "après le 20/11, recréation le sam. 14/11" },
};

export function resumerLots(posts: PostMigration[]): ResumeLot[] {
  return (["A", "B", "C"] as const).map((code) => {
    const l = posts.filter((p) => lotDe(p) === code);
    const faits = l.filter((p) => p.etat === "verifie-zernio" || p.etat === "laisse-buffer").length;
    const statut = !l.length ? "vide" : faits === l.length ? "termine" : faits > 0 || l.some((p) => p.etat === "a-verifier") ? "en-cours" : "a-faire";
    return { code, ...INFO_LOT[code], faits, total: l.length, statut };
  });
}

export type Cellule = "oui" | "non" | "sans-objet";
export interface ResultatCritere {
  publications: { n: number; requis: number; ok: boolean };
  premierComm: Cellule;
  lien: Cellule;
  rienAVerifier: Cellule;
  jours: { n: number; requis: number; ok: boolean };
  rempli: boolean;
}

const jourEnMs = (j: string) => Date.parse(`${j}T00:00:00Z`);

/** Chaque compte : 2 vraies publications, dont une avec premier commentaire, liens vérifiés, rien « à vérifier », sur ≥ 5 jours. */
export function critereResiliation(compte: Pick<CompteMigration, "reseau" | "publications">): ResultatCritere {
  const pubs = compte.publications;
  const nb = pubs.length;
  const jours = nb ? Math.min(REQUIS.jours, Math.floor((Math.max(...pubs.map((p) => jourEnMs(p.jour))) - Math.min(...pubs.map((p) => jourEnMs(p.jour)))) / 86_400_000) + 1) : 0;
  const pubOk = nb >= REQUIS.publications;
  const sansObjet = compte.reseau === "tiktok";
  const premierComm: Cellule = sansObjet ? "sans-objet" : pubs.some((p) => p.premierCommentaire) ? "oui" : "non";
  const lien: Cellule = nb > 0 && pubs.every((p) => p.lienVerifie) ? "oui" : "non";
  const rien: Cellule = nb > 0 && pubs.every((p) => !p.aVerifier) ? "oui" : "non";
  const joursOk = jours >= REQUIS.jours;
  return {
    publications: { n: nb, requis: REQUIS.publications, ok: pubOk },
    premierComm, lien, rienAVerifier: rien,
    jours: { n: jours, requis: REQUIS.jours, ok: joursOk },
    rempli: pubOk && premierComm !== "non" && lien === "oui" && rien === "oui" && joursOk,
  };
}

export function joursAvantDateLimite(maintenant: Date): number {
  const auj = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Math.max(0, Math.round((jourEnMs(DATE_LIMITE_RESILIATION) - auj) / 86_400_000));
}

export function formaterDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Seuls les posts « C'est juste » et programmés au moins 30 min plus tard sont proposés. */
export function postsConfirmables(posts: PostMigration[], maintenant: Date): PostMigration[] {
  return posts.filter((p) => p.cJuste === true && p.etat === "a-verifier" && Date.parse(p.datePrevue) - maintenant.getTime() >= DELAI_MIN_MS);
}

export type MotifRefus = "non-verifie" | "date-trop-proche" | "introuvable";
export function refuserPosts(ids: string[], posts: PostMigration[], maintenant: Date): { acceptes: PostMigration[]; refuses: { id: string; motif: MotifRefus }[] } {
  const ok = new Set(postsConfirmables(posts, maintenant).map((p) => p.id));
  const acceptes: PostMigration[] = [];
  const refuses: { id: string; motif: MotifRefus }[] = [];
  for (const id of ids) {
    const p = posts.find((x) => x.id === id);
    if (!p) refuses.push({ id, motif: "introuvable" });
    else if (ok.has(id)) acceptes.push(p);
    else refuses.push({ id, motif: p.cJuste === true ? "date-trop-proche" : "non-verifie" });
  }
  return { acceptes, refuses };
}
