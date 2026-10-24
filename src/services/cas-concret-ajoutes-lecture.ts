/**
 * CAS AJOUTÉS À LA MAIN : LECTURE seule. SERVEUR UNIQUEMENT. Réglage durable `casConcret.casAjoutes`
 * (`{ [id]: { cas, secteur?, taille?, ajouteLe, historique } }`). Séparé de l'écriture (`cas-concret-ajoutes.ts`) pour que les
 * services qui ne font que LIRE le catalogue (accès par identifiant, listes) ne dépendent pas des services d'écriture.
 * Chaque cas lu repasse par `verifierCas` : un enregistrement illisible est ignoré, jamais servi.
 */
import "server-only";
import { verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import { estIdCasAjoute, TAILLES_AJOUT, SECTEURS_AJOUT } from "@/moteurs/montage-cas-concret/cas-ajoutes";
import { lireParametre } from "./_commun";

export const CLE_CAS_AJOUTES = "casConcret.casAjoutes";
/** Plafond de cas ajoutés (anti-abus). */
export const CAS_AJOUTES_MAX = 200;

export interface VersionCasAjoute {
  version: number;
  cas: CasConcret;
  le: string;
}

export interface EntreeCasAjoute {
  cas: CasConcret;
  secteur?: string;
  taille?: string;
  ajouteLe: string;
  /** Les versions d'avant (on ajoute, on n'efface jamais). */
  historique: VersionCasAjoute[];
}

export type CasAjoutes = Record<string, EntreeCasAjoute>;

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Lecture tolérante d'une entrée : cas valide dont l'identifiant est la clé ; le reste est ignoré. */
export function lireEntreeCasAjoute(id: string, brut: unknown): EntreeCasAjoute | null {
  if (!estIdCasAjoute(id)) return null;
  const b = objet(brut);
  const lu = verifierCas(b.cas);
  if (!lu.ok || lu.cas.id !== id) return null;
  const historique = (Array.isArray(b.historique) ? b.historique : []).flatMap((h): VersionCasAjoute[] => {
    const x = objet(h);
    const c = verifierCas(x.cas);
    return c.ok && typeof x.version === "number" && typeof x.le === "string" ? [{ version: x.version, cas: c.cas, le: x.le }] : [];
  });
  return {
    cas: lu.cas,
    ...(typeof b.secteur === "string" && (SECTEURS_AJOUT as readonly string[]).includes(b.secteur) ? { secteur: b.secteur } : {}),
    ...(typeof b.taille === "string" && (TAILLES_AJOUT as readonly string[]).includes(b.taille) ? { taille: b.taille } : {}),
    ajouteLe: typeof b.ajouteLe === "string" ? b.ajouteLe : "",
    historique,
  };
}

/** Le réglage entier, entrées illisibles écartées. Lu frais à chaque appel. */
export async function lireEntreesCasAjoutes(): Promise<CasAjoutes> {
  const brut = objet(await lireParametre<unknown>(CLE_CAS_AJOUTES, {}));
  const sortie: CasAjoutes = {};
  for (const [id, v] of Object.entries(brut)) {
    const e = lireEntreeCasAjoute(id, v);
    if (e) sortie[id] = e;
  }
  return sortie;
}

/** Les cas ajoutés (plus ancien d'abord). */
export async function lireCasAjoutes(): Promise<CasConcret[]> {
  return Object.values(await lireEntreesCasAjoutes())
    .sort((a, b) => a.ajouteLe.localeCompare(b.ajouteLe))
    .map((e) => e.cas);
}

export { estIdCasAjoute as estCasAjoute } from "@/moteurs/montage-cas-concret/cas-ajoutes";
