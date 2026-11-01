/**
 * NAV · données FICTIVES de l'écran Migration (aucun compte, aucun identifiant réel, aucun nom de personne).
 * Les dates sont fixes : le lot se décide d'après le 20/11/2026 (voir src/components/migration/logique.ts).
 */
import type { EtatMigrationEssai } from "./demarrage";

type Reseau = "instagram" | "facebook" | "linkedin" | "tiktok";
const post = (id: string, reseau: Reseau, titre: string, datePrevue: string, etat: string, cJuste?: boolean) => ({ id, reseau, titre, datePrevue, etat, ...(cJuste === undefined ? {} : { cJuste }) });

export const POSTS_NORMAL = [
  post("exemple-a1", "instagram", "Exemple post A1", "2026-11-12T10:00:00Z", "verifie-zernio"),
  post("exemple-a2", "facebook", "Exemple post A2", "2026-11-13T10:00:00Z", "a-verifier", true),
  post("exemple-a3", "instagram", "Exemple post A3", "2026-11-14T10:00:00Z", "a-verifier"),
  post("exemple-b1", "linkedin", "Exemple post B1", "2026-11-15T10:00:00Z", "laisse-buffer"),
  post("exemple-b2", "linkedin", "Exemple post B2", "2026-11-16T10:00:00Z", "verifie-zernio"),
  post("exemple-c1", "tiktok", "Exemple post C1", "2026-11-25T10:00:00Z", "restant"),
  post("exemple-c2", "instagram", "Exemple post C2", "2026-11-26T10:00:00Z", "restant"),
  // Date passée : à reprogrammer par vous, jamais publié seul.
  post("exemple-p1", "facebook", "Exemple post passé", "2026-10-30T09:00:00Z", "a-verifier"),
];

const publication = (jour: string, premierCommentaire: boolean, lienVerifie = true, aVerifier = false) => ({ jour, premierCommentaire, lienVerifie, aVerifier });
const compte = (id: string, libelle: string, reseau: Reseau, publications: ReturnType<typeof publication>[]) => ({ id, libelle, reseau, publications });

export const COMPTES_NORMAL = [
  compte("exemple-c-fb1", "Exemple Facebook A", "facebook", [publication("2026-11-02", true), publication("2026-11-06", false)]),
  compte("exemple-c-fb2", "Exemple Facebook B", "facebook", [publication("2026-11-02", false)]),
  compte("exemple-c-ig", "Exemple Instagram", "instagram", [publication("2026-11-03", true), publication("2026-11-08", true)]),
  compte("exemple-c-lip", "Exemple LinkedIn page", "linkedin", []),
  compte("exemple-c-liu", "Exemple LinkedIn profil", "linkedin", [publication("2026-11-03", true, false), publication("2026-11-04", false, true, true)]),
  compte("exemple-c-tt", "Exemple TikTok", "tiktok", [publication("2026-11-02", false), publication("2026-11-07", false)]),
];

export const ETAT_NORMAL: EtatMigrationEssai = { posts: POSTS_NORMAL, comptes: COMPTES_NORMAL };
/** Un post dont l'état n'est dans aucune des 4 cases : la somme ne retombe plus sur le total (écart de rapprochement). */
export const ETAT_ECART: EtatMigrationEssai = { posts: [...POSTS_NORMAL, post("exemple-x1", "instagram", "Exemple post hors case", "2026-11-18T10:00:00Z", "inconnu")], comptes: COMPTES_NORMAL };
/** Tout est encore à faire : « en cours » n'existe pas, le lot A est « À faire ». */
export const ETAT_A_FAIRE: EtatMigrationEssai = {
  posts: [post("exemple-a1", "instagram", "Exemple post A1", "2026-11-12T10:00:00Z", "restant"), post("exemple-a2", "facebook", "Exemple post A2", "2026-11-13T10:00:00Z", "restant")],
  comptes: COMPTES_NORMAL,
};
export const ETAT_PANNE: EtatMigrationEssai = { lecteur: "panne" };
export const ETAT_LENT = { ...(ETAT_NORMAL as object), delaiMs: 4000 } as unknown as EtatMigrationEssai;
