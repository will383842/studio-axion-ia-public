/**
 * DIAGNOSTIC D'UN REFUS DE LA MISE EN SCÈNE « IMAGE → VIDÉO » (IV_MISE_EN_SCENE), EN LECTURE SEULE.
 *
 *   npx tsx scripts/image-video/diagnostic-mise-en-scene.mts trav-xxxxxxxxxxxx [--json]
 *   npx tsx scripts/image-video/diagnostic-mise-en-scene.mts --fichier <etat.json> [--json]
 *
 * - Lit le document de travail `trav-…` dans la base du studio (`DATABASE_URL`, table `documents`, collection
 *   `travaux`) dans une transaction Postgres READ ONLY : aucune écriture possible (ni bail, ni création de table, ni
 *   données de démonstration : le dépôt du studio n'est PAS ouvert). `--fichier` : un état déjà copié (`etat.json` du
 *   lanceur, ou `parametres.imageVideo` d'un travail).
 * - Rejoue la mise en scène de chaque version (code de CETTE branche), avec la voix gardée PUIS avec une voix simulée
 *   parfaitement calée : un refus qui reste vient de la fiche, un refus qui disparaît vient de la voix. Imprime le
 *   calage (mots retrouvés, mots du corps), les écrans dans le désordre, et écran par écran la scène, les blocs cités et
 *   ceux qui ne sont jamais posés.
 * - Aucun appel payant (ni Claude, ni HeyGen, ni rendu), aucun fichier écrit.
 *
 * Codes de sortie : 0 diagnostic imprimé · 1 arguments · 2 travail introuvable ou sans état « image → vidéo ».
 */
import { readFile } from "node:fs/promises";
import pg from "pg";
import { diagnostiquerMiseEnSceneIV } from "../../src/moteurs/montage-image-video/diagnostic";
import type { EtatFabricationIV } from "../../src/moteurs/montage-image-video/fabrication";

const args = process.argv.slice(2);
const json = args.includes("--json");
const iFichier = args.indexOf("--fichier");
const fichier = iFichier >= 0 ? args[iFichier + 1] : undefined;
const id = args.find((a, i) => !a.startsWith("--") && (iFichier < 0 || i !== iFichier + 1));

if (!fichier && !id) {
  console.error("Usage : diagnostic-mise-en-scene.mts trav-xxxxxxxxxxxx [--json]  |  --fichier <etat.json> [--json]");
  process.exit(1);
}

/** Lit le travail dans une transaction READ ONLY (Postgres refuse toute écriture), puis la referme sans rien valider. */
async function lireTravail(idTravail: string): Promise<unknown> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL absente : lancez le script sur le serveur du studio, ou passez --fichier.");
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, statement_timeout: 20_000 });
  await client.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const { rows } = await client.query<{ data: unknown }>("SELECT data FROM documents WHERE collection = 'travaux' AND id = $1", [idTravail]);
    await client.query("ROLLBACK");
    return rows[0]?.data ?? null;
  } finally {
    await client.end();
  }
}

/** L'état de fabrication : un travail (`parametres.imageVideo`) ou l'état lui-même. */
function etatDe(x: unknown): EtatFabricationIV | null {
  const o = x as { version?: string; parametres?: { imageVideo?: unknown } } | null;
  if (o?.version === "fabrication-iv/1") return o as EtatFabricationIV;
  const e = o?.parametres?.imageVideo as EtatFabricationIV | undefined;
  return e?.version === "fabrication-iv/1" ? e : null;
}

const brut = fichier ? JSON.parse(await readFile(fichier, "utf8")) : await lireTravail(id!);
const etat = etatDe(brut);
if (!etat) {
  console.error(brut ? "Ce document n'a pas d'état « image → vidéo » (parametres.imageVideo)." : `Travail ${id} introuvable.`);
  process.exit(2);
}
const d = diagnostiquerMiseEnSceneIV(etat);
if (json) console.log(JSON.stringify(d, null, 2));
else console.log([`Diagnostic de la mise en scène · ${fichier ?? id} · vidéo ${etat.demande.videoId}`, ...d.lignes].join("\n"));
