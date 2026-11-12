/**
 * RÉPÉTITION GÉNÉRALE DES CONTRÔLES DE FIN DE FABRICATION « IMAGE → VIDÉO », HORS LIGNE ET EN LECTURE SEULE.
 *
 *   npx tsx scripts/image-video/repetition-controles.mts trav-xxxxxxxxxxxx [--json] [--images]
 *   npx tsx scripts/image-video/repetition-controles.mts --tous [--depuis 2026-10-20] [--limite 20] [--json] [--images]
 *   npx tsx scripts/image-video/repetition-controles.mts --fichier <etat.json> [--json] [--images]
 *
 * - Lit les documents de travail dans la base du studio (`DATABASE_URL`, table `documents`, collection `travaux`) dans
 *   une transaction Postgres READ ONLY : aucune écriture possible. `--fichier` : un état déjà copié.
 * - `--tous` : tous les travaux qui portent un état « image → vidéo » (les plus récents d'abord) ; `--depuis` : seulement
 *   ceux modifiés à cette date (ISO) ou après ; `--limite` : au plus ce nombre de travaux. Seuls `id` et `parametres.imageVideo`
 *   sont chargés (jamais le document entier).
 * - La piste voix seule est relue dans le stockage (URL signée de lecture, aucune écriture) : Q17, Q18 et Q19 sont rejoués. Sans
 *   stockage réel configuré, ils sont ignorés dans l'écart et la sortie le dit (écoute non rejouée).
 * - Rejoue la porte unique sur les données enregistrées (code de CETTE branche) et dit l'écart avec le verdict enregistré.
 *   Les transcriptions et relectures déjà payées sont reprises ; tout appel payant manquant est BLOQUÉ et compté.
 * - `--images` : détaille, version par version, les images finales que la relecture lirait (instants clés).
 * - `--json` : le résultat complet en JSON.
 *
 * Codes de sortie : 0 répétition faite · 1 arguments · 2 aucun travail avec un état « image → vidéo » (ou travail introuvable).
 */
import { readFile } from "node:fs/promises";
import pg from "pg";
import { stockageR2DepuisEnv } from "../../src/fournisseurs/r2/stockage";
import type { EtatFabricationIV } from "../../src/moteurs/montage-image-video/fabrication";
import { repeterControlesIV, type RepetitionControlesIV } from "../../src/moteurs/montage-image-video/repetition-controles";
import { ErreurArgumentsRepetition, etatDe, lireArgumentsRepetition, USAGE_REPETITION, type ArgumentsRepetition } from "./repetition-controles-args";

let a: ArgumentsRepetition;
try {
  a = lireArgumentsRepetition(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof ErreurArgumentsRepetition)) throw err;
  console.error(`${err.message}\n${USAGE_REPETITION}`);
  process.exit(1);
}
const { id, tous, fichier, depuis, limite, json, images } = a;

/** Lit un fichier en entier par une adresse signée (`null` : illisible, vide ou trop gros). Lecture seule. */
async function lireOctets(adresse: string, max = 32 * 1024 * 1024): Promise<Uint8Array | null> {
  try {
    const r = await fetch(adresse, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const annonce = Number(r.headers.get("content-length"));
    if (Number.isFinite(annonce) && annonce > max) return null;
    const o = new Uint8Array(await r.arrayBuffer());
    return o.byteLength && o.byteLength <= max ? o : null;
  } catch {
    return null;
  }
}

/** Lecture SEULE de la piste voix rangée (signerLecture puis lireOctets, comme `lireStockage` du service) ; `undefined` sans stockage réel. */
function lireSonDuStockage(): ((cle: string) => Promise<Uint8Array | null>) | undefined {
  const stockage = stockageR2DepuisEnv();
  if (!stockage || stockage.mode === "simulation") return undefined;
  const signerLecture = async (cle: string) => (stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, 3600) : stockage.urlLecture(cle));
  return async (cle) => lireOctets(await signerLecture(cle));
}

/** Lit les travaux dans une transaction READ ONLY (Postgres refuse toute écriture), puis la referme sans rien valider. */
async function lireTravaux(): Promise<{ id: string; data: unknown }[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absente : lancez le script sur le serveur du studio, ou passez --fichier.");
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 20_000 });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const { rows } = tous
      ? await client.query<{ id: string; data: unknown }>(
          "SELECT id, jsonb_build_object('parametres', jsonb_build_object('imageVideo', data->'parametres'->'imageVideo')) AS data FROM documents WHERE collection = 'travaux' AND data->'parametres'->'imageVideo' IS NOT NULL AND ($1::timestamptz IS NULL OR modifie_le >= $1::timestamptz) ORDER BY modifie_le DESC LIMIT $2::int",
          [depuis ?? null, limite ?? null],
        )
      : await client.query<{ id: string; data: unknown }>("SELECT id, jsonb_build_object('parametres', jsonb_build_object('imageVideo', data->'parametres'->'imageVideo')) AS data FROM documents WHERE collection = 'travaux' AND id = $1", [id]);
    await client.query("ROLLBACK");
    return rows;
  } finally {
    await client.end();
  }
}

function lignesDe(nom: string, e: EtatFabricationIV, r: RepetitionControlesIV): string[] {
  const tete = `Répétition des contrôles · ${nom} · vidéo ${e.demande.videoId}`;
  if (!r.applicable) return [tete, `  non rejouable : ${r.raison}`];
  const notes = r.ecouteRejouee ? [] : [`  écoute non rejouée (pas de stockage relié) : ignorés dans l'écart : ${r.controlesIgnores.join(", ")}.`];
  const lignes = [tete, ...notes, `  verdict rejoué : ${r.verdict.ok ? "prête" : "refusée"} · ${r.verdict.phrase}`];
  lignes.push(r.ecart.length ? "  écart avec l'état enregistré :" : "  identique au verdict enregistré.", ...r.ecart.map((x) => `    - ${x}`));
  lignes.push(`  appels payants bloqués : ${r.appelsBloques} · payés : ${r.verdict.appelsPayes}`);
  for (const v of r.versions) {
    lignes.push(`  version ${v.version} (${v.reseaux.join(", ")}${v.courte ? ", courte" : ""}) : ${v.ok ? "ok" : "refusée"}`);
    for (const l of v.lignes.filter((x) => x.etat !== "reussi")) lignes.push(`    ${l.bloquant ? "✗" : "·"} ${l.phrase}`);
    if (images) for (const i of v.instants) lignes.push(`    image à relire : ${JSON.stringify(i)}`);
  }
  return lignes;
}

const sources: { nom: string; brut: unknown }[] = fichier
  ? [{ nom: fichier, brut: JSON.parse(await readFile(fichier, "utf8")) }]
  : (await lireTravaux()).map((t) => ({ nom: t.id, brut: t.data }));
const cibles = sources.flatMap((s) => {
  const etat = etatDe(s.brut);
  return etat ? [{ nom: s.nom, etat }] : [];
});
if (!cibles.length) {
  console.error(tous ? "Aucun travail avec un état « image → vidéo »." : `${id ?? fichier} : introuvable ou sans état « image → vidéo » (parametres.imageVideo).`);
  process.exit(2);
}

const lireSon = lireSonDuStockage();
if (!lireSon) console.error("Stockage non relié : l'écoute (Q17, Q18, Q19) n'est pas rejouée, ces contrôles sont ignorés dans l'écart.");
const resultats = [];
for (const c of cibles) resultats.push({ nom: c.nom, etat: c.etat, repetition: await repeterControlesIV(c.etat, lireSon ? { lireSon } : {}) });
if (json) console.log(JSON.stringify(resultats.map((r) => ({ travail: r.nom, videoId: r.etat.demande.videoId, ...r.repetition })), null, 2));
else console.log(resultats.map((r) => lignesDe(r.nom, r.etat, r.repetition).join("\n")).join("\n\n"));
