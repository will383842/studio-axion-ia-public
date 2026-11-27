/**
 * Format de l'import en lot d'épingles, version 1 (PUR). Un lot = un JSON ; chaque épingle est contrôlée ligne par ligne :
 * une ligne fausse est refusée avec sa raison, les autres passent ; un fichier de mauvaise forme n'écrit rien.
 *
 * { "version": 1, "epingles": [{ "cle"?, "titre", "description", "url", "tableau", "texteAlternatif", "contenuIA", "image" }] }
 */
import { z } from "zod";
import { motsInterditsEnvoiZernio } from "../../fournisseurs/publication/mots-interdits-envoi";
import { lienDuSite } from "../../fournisseurs/publication/liens-du-site";

export const LOT_EPINGLES_LIGNES_MAX = 500;
export const LOT_EPINGLES_OCTETS_MAX = 1024 * 1024;
export const NOM_IMAGE_EPINGLE = /^[\w.-]{1,120}\.(jpe?g|png|webp)$/i;

export interface EpingleDuLot {
  cle?: string;
  titre: string;
  description: string;
  url: string;
  tableau: string;
  texteAlternatif: string;
  contenuIA: boolean;
  image: string;
}

export interface LigneLue {
  /** Numéro de la ligne (la première est la 1). */
  numero: number;
  epingle?: EpingleDuLot;
  /** Raisons du refus de CETTE ligne (le reste du lot passe). */
  erreurs: string[];
}

export type LotLu = { ok: true; lignes: LigneLue[] } | { ok: false; erreur: string };

const normaliser = (s: string): string => s.replace(/\s+/g, " ").trim();
const sansMotInterdit = (s: string) => motsInterditsEnvoiZernio(s).length === 0;

/** Schéma d'UNE ligne ; le domaine du site (réglage) sert à contrôler le lien. */
export function schemaEpingle(domaineSite: string) {
  return z
    .object({
      cle: z.string().trim().regex(/^[A-Za-z0-9_-]{1,80}$/, "clé : lettres, chiffres, - et _ (80 au plus)").optional(),
      titre: z.string().transform(normaliser).pipe(z.string().min(1, "titre vide").max(100, "titre : 100 signes au plus").refine(sansMotInterdit, "titre : mot interdit")),
      description: z.string().trim().min(1, "description vide").max(800, "description : 800 signes au plus").refine(sansMotInterdit, "description : mot interdit"),
      url: z.string().trim().max(2000, "lien trop long").refine((u) => lienDuSite(u, domaineSite), "lien : https vers le site, domaine exact, sans identifiants ni port"),
      tableau: z.string().trim().min(1, "tableau manquant"),
      texteAlternatif: z.string().transform(normaliser).pipe(z.string().min(1, "texte alternatif vide").max(500, "texte alternatif : 500 signes au plus").refine(sansMotInterdit, "texte alternatif : mot interdit")),
      contenuIA: z.boolean({ message: "contenuIA : vrai ou faux, obligatoire" }),
      image: z.string().trim().regex(NOM_IMAGE_EPINGLE, "image : nom de fichier .jpg, .png ou .webp (pas d'adresse)"),
    })
    .strict();
}

/** Lit le JSON du lot : forme du fichier d'abord (sinon rien n'est lu), puis chaque ligne. Ne lève jamais. */
export function lireLotEpingles(brut: string, domaineSite: string): LotLu {
  if (new TextEncoder().encode(brut).length > LOT_EPINGLES_OCTETS_MAX) return { ok: false, erreur: "Le fichier dépasse 1 Mo." };
  let json: unknown;
  try {
    json = JSON.parse(brut);
  } catch {
    return { ok: false, erreur: "Le fichier n'est pas un JSON lisible." };
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return { ok: false, erreur: "Le fichier doit être un objet { version, epingles }." };
  const o = json as Record<string, unknown>;
  if (o.version !== 1) return { ok: false, erreur: "Version du format : 1 attendue." };
  if (!Array.isArray(o.epingles)) return { ok: false, erreur: "« epingles » doit être une liste." };
  if (o.epingles.length === 0) return { ok: false, erreur: "Le lot est vide." };
  if (o.epingles.length > LOT_EPINGLES_LIGNES_MAX) return { ok: false, erreur: `Au plus ${LOT_EPINGLES_LIGNES_MAX} épingles par lot.` };
  const schema = schemaEpingle(domaineSite);
  const lignes = o.epingles.map((brute, i): LigneLue => {
    const r = schema.safeParse(brute);
    return r.success ? { numero: i + 1, epingle: r.data as EpingleDuLot, erreurs: [] } : { numero: i + 1, erreurs: r.error.issues.map((x) => x.message) };
  });
  return { ok: true, lignes };
}
