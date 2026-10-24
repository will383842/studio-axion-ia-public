/**
 * IMPORT DU STOCK DE CAS PAR MÉTIER (lot K6). Lit l'export des fiches (`stock-cas-metiers.json`), garde celles que Will a
 * retenues et écrit `src/formats/cas-concret/stock-metiers/stock.json`.
 *
 *   npx tsx scripts/importer-stock-cas.ts <chemin/stock-cas-metiers.json> [--sortie <stock.json>] [--essai]
 *
 *   --sortie  autre fichier à écrire (défaut : le `stock.json` du dépôt) ; il sert aussi de lecture des versions déjà importées ;
 *   --essai   fait tous les contrôles et affiche le bilan, sans rien écrire.
 *
 * Règles :
 *   - seules les fiches `statut = "retenu-will"` sont importées ; `statut`, `qualite` et `descriptionPorteB` sont retirés ;
 *   - chaque cas passe les contrôles du chargeur du stock (`verifierCas`, rangement, id absent du catalogue, mot unique)
 *     PLUS `refusAvantPrix` en contexte neutre (tous réseaux, essai, sans mot) ;
 *   - AU MOINDRE REFUS, rien n'est écrit : tous les refus sont listés (fiche, cas, raisons) ;
 *   - `stock.json` est trié par numéro de fiche ; il est REMPLACÉ en entier (une fiche qui n'est plus retenue en sort) ;
 *   - un cas déjà importé dont le contenu change voit sa `version` augmenter de 1 (il redevient « à valider » dans le studio) ;
 *     inchangé, il garde sa version. Un cas nouveau garde la version de sa fiche ;
 *   - les cas retirés (présents dans le stock actuel, absents du nouveau fichier) sont AFFICHÉS et notés dans `retires`
 *     (`[{ id, derniereVersion }]`, champ facultatif ignoré par le chargeur) ; un cas qui revient reprend au moins
 *     `derniereVersion + 1`, jamais une version plus basse que sa dernière version vue ;
 *   - un `stock.json` absent (ENOENT) vaut « aucun cas importé » ; toute autre erreur de lecture ou JSON invalide : code 1, rien d'écrit.
 * Aucune dépense, aucun appel réseau. Codes de sortie : 0 fait, 1 arguments ou lecture, 2 refus (rien d'écrit).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { empreinteCas, type CasConcret } from "@/formats/cas-concret/cas";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { chargerStock, type RefusStock } from "@/formats/cas-concret/stock-metiers/charger";
import type { Rangement } from "@/formats/cas-concret/stock-metiers/schema";
import { refusAvantPrix } from "@/moteurs/montage-cas-concret/avant-prix";

export const STATUT_RETENU = "retenu-will";
/** Champs de relecture de la fiche, qui n'entrent pas dans le studio. */
const CHAMPS_RETIRES = ["statut", "qualite", "descriptionPorteB"] as const;
const RESEAUX_NEUTRES = ["facebook", "instagram", "tiktok", "linkedin"] as const;

export const CHEMIN_STOCK = fileURLToPath(new URL("../src/formats/cas-concret/stock-metiers/stock.json", import.meta.url));

export interface LigneStockJson {
  rangement: Rangement;
  cas: CasConcret;
}
export interface FichierStock {
  version: 1;
  cas: LigneStockJson[];
  /** Cas sortis du stock, avec la dernière version vue (facultatif, ignoré par le chargeur). */
  retires?: Retire[];
}
export interface Retire {
  id: string;
  derniereVersion: number;
}
export interface ChangementVersion {
  id: string;
  avant: number;
  apres: number;
}

export type ResultatImport =
  | { ok: true; fichier: FichierStock; versionsAugmentees: ChangementVersion[]; nouveaux: string[]; retires: string[] }
  | { ok: false; refus: RefusStock[] };

const empreinteSansVersion = (cas: CasConcret): string => empreinteCas({ ...cas, version: 1 });

/** Les cas sortis du stock lors d'un import précédent, par id (forme inattendue : aucun). */
function retiresExistants(existant: unknown): Map<string, number> {
  const sortie = new Map<string, number>();
  const liste = (existant as { retires?: unknown } | null)?.retires;
  if (!Array.isArray(liste)) return sortie;
  for (const r of liste) {
    const { id, derniereVersion } = (r ?? {}) as Partial<Retire>;
    if (typeof id === "string" && typeof derniereVersion === "number") sortie.set(id, Math.max(derniereVersion, sortie.get(id) ?? 0));
  }
  return sortie;
}

/** Les lignes déjà importées, par id de cas (forme inattendue : aucune). */
function lignesExistantes(existant: unknown): Map<string, CasConcret> {
  const sortie = new Map<string, CasConcret>();
  const lignes = (existant as { cas?: unknown } | null)?.cas;
  if (!Array.isArray(lignes)) return sortie;
  for (const l of lignes) {
    const cas = (l as { cas?: CasConcret } | null)?.cas;
    if (cas && typeof cas.id === "string" && typeof cas.version === "number") sortie.set(cas.id, cas);
  }
  return sortie;
}

/** Numéro de fiche : compare secteur puis rang (« IN-02 » avant « IN-10 »). */
const parNumero = (a: string, b: string): number => a.localeCompare(b, "fr", { numeric: true });

/**
 * PUR : de l'export des fiches et du `stock.json` actuel, calcule le nouveau `stock.json`, ou la liste de TOUS les refus.
 * Ne lit ni n'écrit aucun fichier.
 */
export function importerStock(exporte: unknown, existant: unknown = null): ResultatImport {
  const fiches = (exporte as { fiches?: unknown } | null)?.fiches;
  if (!Array.isArray(fiches)) return { ok: false, refus: [{ fiche: "export", raisons: ["l'export n'a pas de liste « fiches »"] }] };
  const retenues = (fiches as Array<Record<string, unknown>>).filter((f) => f?.statut === STATUT_RETENU);
  if (!retenues.length) return { ok: false, refus: [{ fiche: "export", raisons: [`aucune fiche au statut « ${STATUT_RETENU} » : rien à importer`] }] };

  const avant = lignesExistantes(existant);
  const dejaRetires = retiresExistants(existant);
  const versionsAugmentees: ChangementVersion[] = [];
  const nouveaux: string[] = [];
  const lignes = retenues
    .map((f) => {
      const rangement = { ...((f.rangement ?? {}) as Record<string, unknown>) };
      for (const c of CHAMPS_RETIRES) delete rangement[c];
      return { numero: typeof f.numero === "string" ? f.numero : String((rangement as { fiche?: unknown }).fiche ?? ""), rangement, cas: f.cas };
    })
    .sort((a, b) => parNumero(a.numero, b.numero))
    .map(({ rangement, cas }) => ({ rangement, cas }) as unknown as LigneStockJson);

  // Versions : décidées sur des cas qui ont une forme de cas (les autres seront refusés par le chargeur).
  for (const l of lignes) {
    const cas = l.cas as CasConcret | undefined;
    if (!cas || typeof cas.id !== "string") continue;
    const ancien = avant.get(cas.id);
    if (!ancien) {
      nouveaux.push(cas.id);
      // Revenu après un retrait : jamais sous sa dernière version vue.
      const derniere = dejaRetires.get(cas.id);
      if (derniere !== undefined && cas.version <= derniere) {
        l.cas = { ...cas, version: derniere + 1 };
        versionsAugmentees.push({ id: cas.id, avant: derniere, apres: derniere + 1 });
      }
      continue;
    }
    if (empreinteSansVersion(ancien) === empreinteSansVersion(cas)) l.cas = { ...cas, version: ancien.version };
    else {
      l.cas = { ...cas, version: ancien.version + 1 };
      versionsAugmentees.push({ id: cas.id, avant: ancien.version, apres: ancien.version + 1 });
    }
  }

  const charge = chargerStock(lignes, { ids: CATALOGUE_TS.map((c) => c.id), mots: CATALOGUE_TS.map((c) => c.mot) });
  const refus: RefusStock[] = [...charge.refuses];
  // Refus avant le prix, contexte neutre : tous les réseaux, essai (ni validation ni voix), sans mot.
  for (const cas of charge.cas) {
    const phrase = refusAvantPrix({ cas, reseaux: RESEAUX_NEUTRES, mot: cas.mot, avecMot: false, motSur: [], essai: true });
    if (phrase) refus.push({ fiche: charge.rangement[cas.id]?.fiche ?? cas.id, id: cas.id, raisons: [`refus avant le prix : ${phrase}`] });
  }
  // Un cas qui avait un récit (clarté des scripts) ne le perd jamais par un import : la source de l'export n'a pas été mise à jour.
  for (const cas of charge.cas) {
    if (avant.get(cas.id)?.recit && !cas.recit) refus.push({ fiche: charge.rangement[cas.id]?.fiche ?? cas.id, id: cas.id, raisons: ["le cas avait un récit (« recit ») et l'export n'en a plus : reportez le récit dans le fichier source avant d'importer"] });
  }
  if (refus.length) return { ok: false, refus };

  // Cas retirés : dans le stock actuel, absents du nouveau. On garde la plus haute version vue, y compris des retraits passés.
  const presents = new Set(charge.cas.map((c) => c.id));
  const memoire = new Map<string, number>();
  for (const [id, v] of dejaRetires) if (!presents.has(id)) memoire.set(id, v);
  const retires: string[] = [];
  for (const [id, cas] of avant) {
    if (presents.has(id)) continue;
    retires.push(id);
    memoire.set(id, Math.max(cas.version, memoire.get(id) ?? 0));
  }
  const fichier: FichierStock = { version: 1, cas: charge.cas.map((cas) => ({ rangement: charge.rangement[cas.id], cas })) };
  if (memoire.size) fichier.retires = [...memoire].map(([id, derniereVersion]) => ({ id, derniereVersion })).sort((a, b) => a.id.localeCompare(b.id));
  return { ok: true, fichier, versionsAugmentees, nouveaux, retires };
}

/** Une ligne par refus, lisible dans un terminal. */
export const decrireRefus = (refus: readonly RefusStock[]): string[] => refus.flatMap((r) => [`  ${r.fiche}${r.id ? ` (${r.id})` : ""}`, ...r.raisons.map((x) => `    - ${x}`)]);

async function lireJson(chemin: string): Promise<unknown> {
  return JSON.parse((await readFile(chemin, "utf8")).replace(/^﻿/, ""));
}

/** Le `stock.json` actuel : absent (ENOENT) = aucun cas importé ; toute autre erreur est remontée. */
export async function lireExistant(chemin: string): Promise<unknown> {
  try {
    return await lireJson(chemin);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Point d'entrée en ligne de commande. Renvoie le code de sortie. */
export async function principal(argv: readonly string[]): Promise<number> {
  const essai = argv.includes("--essai");
  const iSortie = argv.indexOf("--sortie");
  const sortie = iSortie >= 0 ? argv[iSortie + 1] : CHEMIN_STOCK;
  const entree = argv.find((a, i) => !a.startsWith("--") && (iSortie < 0 || i !== iSortie + 1));
  if (!entree || !sortie) {
    console.error("Usage : npx tsx scripts/importer-stock-cas.ts <stock-cas-metiers.json> [--sortie <stock.json>] [--essai]");
    return 1;
  }
  let exporte: unknown;
  try {
    exporte = await lireJson(entree);
  } catch (e) {
    console.error(`Lecture impossible de ${entree} : ${(e as Error).message}`);
    return 1;
  }
  let existant: unknown;
  try {
    existant = await lireExistant(sortie);
  } catch (e) {
    console.error(`Lecture impossible de ${sortie} (rien n'est écrit) : ${(e as Error).message}`);
    return 1;
  }
  const r = importerStock(exporte, existant);
  if (!r.ok) {
    console.error(`IMPORT REFUSÉ, rien n'est écrit (${r.refus.length} refus) :`);
    console.error(decrireRefus(r.refus).join("\n"));
    return 2;
  }
  console.log(`${r.fichier.cas.length} cas prêts (${r.nouveaux.length} nouveaux, ${r.versionsAugmentees.length} dont la version augmente).`);
  for (const v of r.versionsAugmentees) console.log(`  ${v.id} : version ${v.avant} -> ${v.apres} (redevient « à valider »)`);
  if (r.retires.length) console.log(`${r.retires.length} cas retiré(s) du stock : ${r.retires.join(", ")}`);
  else console.log("Aucun cas retiré.");
  if (essai) {
    console.log("Essai : rien n'est écrit.");
    return 0;
  }
  await writeFile(sortie, `${JSON.stringify(r.fichier, null, 2)}\n`, "utf8");
  console.log(`Écrit : ${sortie}`);
  return 0;
}

// Lancé directement (et non importé par un test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
    console.error(e);
    process.exit(1);
  });
}
