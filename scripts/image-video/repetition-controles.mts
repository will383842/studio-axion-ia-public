/**
 * RÉPÉTITION GÉNÉRALE DES CONTRÔLES DE FIN DE FABRICATION « IMAGE → VIDÉO », HORS LIGNE ET EN LECTURE SEULE.
 *
 *   npx tsx scripts/image-video/repetition-controles.mts trav-xxxxxxxxxxxx [--json] [--images]
 *   npx tsx scripts/image-video/repetition-controles.mts --tous [--depuis 2026-10-20] [--json] [--images]
 *   npx tsx scripts/image-video/repetition-controles.mts --fichier <etat.json> [--json] [--images]
 *
 * - Lit les documents de travail dans la base du studio (`DATABASE_URL`, table `documents`, collection `travaux`) dans
 *   une transaction Postgres READ ONLY : aucune écriture possible. `--fichier` : un état déjà copié.
 * - `--tous` : tous les travaux qui portent un état « image → vidéo » (les plus récents d'abord) ; `--depuis` : seulement
 *   ceux modifiés à cette date (ISO) ou après.
 * - Rejoue la porte unique sur les données enregistrées (code de CETTE branche) et dit l'écart avec le verdict enregistré.
 *   Les transcriptions et relectures déjà payées sont reprises ; tout appel payant manquant est BLOQUÉ et compté.
 * - `--images` : détaille, version par version, les images finales que la relecture lirait (instants clés).
 * - `--json` : le résultat complet en JSON.
 *
 * Codes de sortie : 0 répétition faite · 1 arguments · 2 aucun travail avec un état « image → vidéo » (ou travail introuvable).
 */
import { readFile } from "node:fs/promises";
import pg from "pg";
import type { EtatFabricationIV } from "../../src/moteurs/montage-image-video/fabrication";
import { repeterControlesIV, type RepetitionControlesIV } from "../../src/moteurs/montage-image-video/repetition-controles";

const args = process.argv.slice(2);
const json = args.includes("--json");
const tous = args.includes("--tous");
const images = args.includes("--images");
const iFichier = args.indexOf("--fichier");
const fichier = iFichier >= 0 ? args[iFichier + 1] : undefined;
const iDepuis = args.indexOf("--depuis");
const depuis = iDepuis >= 0 ? args[iDepuis + 1] : undefined;
const valeurs = new Set([iFichier >= 0 ? iFichier + 1 : -1, iDepuis >= 0 ? iDepuis + 1 : -1]);
const id = args.find((a, i) => !a.startsWith("--") && !valeurs.has(i));

if ((!fichier && !id && !tous) || (depuis !== undefined && (!tous || Number.isNaN(Date.parse(depuis)))) || (fichier !== undefined && !fichier)) {
  console.error("Usage : repetition-controles.mts trav-xxxxxxxxxxxx | --tous [--depuis <date ISO>] | --fichier <etat.json>  [--json] [--images]");
  process.exit(1);
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
          "SELECT id, data FROM documents WHERE collection = 'travaux' AND data->'parametres'->'imageVideo' IS NOT NULL AND ($1::timestamptz IS NULL OR modifie_le >= $1::timestamptz) ORDER BY modifie_le DESC",
          [depuis ?? null],
        )
      : await client.query<{ id: string; data: unknown }>("SELECT id, data FROM documents WHERE collection = 'travaux' AND id = $1", [id]);
    await client.query("ROLLBACK");
    return rows;
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

function lignesDe(nom: string, e: EtatFabricationIV, r: RepetitionControlesIV): string[] {
  const tete = `Répétition des contrôles · ${nom} · vidéo ${e.demande.videoId}`;
  if (!r.applicable) return [tete, `  non rejouable : ${r.raison}`];
  const lignes = [tete, `  verdict rejoué : ${r.verdict.ok ? "prête" : "refusée"} · ${r.verdict.phrase}`];
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

const resultats = [];
for (const c of cibles) resultats.push({ nom: c.nom, etat: c.etat, repetition: await repeterControlesIV(c.etat) });
if (json) console.log(JSON.stringify(resultats.map((r) => ({ travail: r.nom, videoId: r.etat.demande.videoId, ...r.repetition })), null, 2));
else console.log(resultats.map((r) => lignesDe(r.nom, r.etat, r.repetition).join("\n")).join("\n\n"));
