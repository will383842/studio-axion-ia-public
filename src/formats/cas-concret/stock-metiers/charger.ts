/**
 * STOCK DE CAS PAR MÉTIER (lot K1) : le chargeur, PUR (aucun import du catalogue, donc aucun cycle). Il valide chaque ligne
 * brute et sépare ce qui est montrable de ce qui est écarté. Un cas invalide n'est JAMAIS affiché : il est listé dans
 * `refuses`, avec sa fiche, son id et les raisons en français. Les mêmes contrôles servent à l'import (lot K6).
 */
import { PREFIXE_CAS_AJOUTE, verifierCas, type CasConcret } from "../cas";
import { schemaLigneStock, verifierRangement, type Rangement } from "./schema";

export interface RefusStock {
  /** Numéro de la fiche si on a pu le lire, sinon la position de la ligne (« ligne 3 »). */
  fiche: string;
  /** Identifiant du cas si on a pu le lire. */
  id?: string;
  raisons: string[];
}

export interface StockCharge {
  cas: CasConcret[];
  /** Rangement de chaque cas retenu, par id du cas. */
  rangement: Record<string, Rangement>;
  refuses: RefusStock[];
}

/** Même normalisation du mot que `motNormalise` des mots branchés (majuscules, sans espace autour). */
const normaliserMot = (m: string): string => m.trim().toUpperCase();

export interface DejaPris {
  /** Identifiants des cas déjà au catalogue (les 22 cas TypeScript). */
  ids: Iterable<string>;
  /** Mots des cas déjà au catalogue. */
  mots: Iterable<string>;
}

/**
 * Valide les lignes `{ rangement, cas }` : contrat du cas (`verifierCas`), contrat du rangement, id absent du catalogue et
 * des lignes déjà retenues, mot unique (catalogue et lignes déjà retenues), fiche unique. En cas de doublon, la PREMIÈRE
 * ligne reste, les suivantes sont écartées. L'ordre des lignes est conservé.
 */
export function chargerStock(lignes: readonly unknown[], dejaPris: DejaPris): StockCharge {
  const ids = new Set(dejaPris.ids);
  const mots = new Set([...dejaPris.mots].map(normaliserMot));
  const fiches = new Set<string>();
  const sortie: StockCharge = { cas: [], rangement: {}, refuses: [] };
  lignes.forEach((brut, i) => {
    const lisible = (brut ?? {}) as { rangement?: { fiche?: unknown }; cas?: { id?: unknown } };
    const fiche = typeof lisible.rangement?.fiche === "string" ? lisible.rangement.fiche : `ligne ${i + 1}`;
    const id = typeof lisible.cas?.id === "string" ? lisible.cas.id : undefined;
    const refuser = (raisons: string[]) => void sortie.refuses.push({ fiche, ...(id ? { id } : {}), raisons });
    const lue = schemaLigneStock.safeParse(brut);
    if (!lue.success) return refuser(["ligne mal formée : { rangement, cas } attendus, rien d'autre"]);
    const cas = verifierCas(lue.data.cas);
    const rang = verifierRangement(lue.data.rangement);
    const raisons = [...(cas.ok ? [] : cas.raisons), ...(rang.ok ? [] : rang.raisons)];
    if (cas.ok && rang.ok) {
      if (cas.cas.id.startsWith(PREFIXE_CAS_AJOUTE)) raisons.push(`id « ${cas.cas.id} » : le préfixe « ${PREFIXE_CAS_AJOUTE} » est réservé aux cas ajoutés à la main`);
      if (ids.has(cas.cas.id)) raisons.push(`id « ${cas.cas.id} » déjà pris (catalogue ou fiche précédente)`);
      if (mots.has(normaliserMot(cas.cas.mot))) raisons.push(`mot « ${cas.cas.mot} » déjà pris (catalogue ou fiche précédente)`);
      if (fiches.has(rang.rangement.fiche)) raisons.push(`fiche « ${rang.rangement.fiche} » déjà présente`);
    }
    if (!cas.ok || !rang.ok || raisons.length) return refuser(raisons);
    ids.add(cas.cas.id);
    mots.add(normaliserMot(cas.cas.mot));
    fiches.add(rang.rangement.fiche);
    sortie.cas.push(cas.cas);
    sortie.rangement[cas.cas.id] = rang.rangement;
  });
  return sortie;
}
