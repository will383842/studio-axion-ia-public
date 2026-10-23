/**
 * GARDE EXTERNE DES BASES (ADR 0001 § 4b) : compare `source.json` au manifeste actuel de depot-prive.
 *
 *   BASES_PRIVEES_LECTURE=<jeton lecture seule> npx tsx scripts/bases/controler-ecart-externe.mts [--informatif] [--fork]
 *
 * - sortie 0 = à jour ; 1 = écart, jeton absent ou manifeste inaccessible (ROUGE, jamais vert par défaut) ;
 * - `--informatif` : affiche le résultat mais sort 0 (PR : ne bloque pas un travail sans rapport avec les bases) ;
 * - `--fork` : PR d'un dépôt tiers sans accès aux secrets : saut affiché explicitement, jamais compté comme un succès.
 * Le jeton n'est jamais écrit dans la sortie.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SourceBases } from "../../src/donnees/bases-usine/empreintes";
import { gardeExterne } from "../../src/donnees/bases-usine/garde-externe";

const ici = dirname(fileURLToPath(import.meta.url));
const informatif = process.argv.includes("--informatif");
const source = JSON.parse(readFileSync(join(ici, "../../src/donnees/bases-usine/donnees/source.json"), "utf8")) as SourceBases;

const r = await gardeExterne(source, {
  jeton: process.env.BASES_PRIVEES_LECTURE?.trim() || undefined,
  sauteParFork: process.argv.includes("--fork"),
  lire: async (url, entetes) => {
    const rep = await fetch(url, { headers: entetes, signal: AbortSignal.timeout(20_000) });
    return { status: rep.status, texte: await rep.text() };
  },
});

if (r.statut === "vert") console.log(`Bases à jour : empreinte ${source.empreinte} = manifeste de depot-prive.`);
else if (r.statut === "saute") console.log(`SAUTÉ : ${r.raison}`);
else {
  console.error(`ÉCART DES BASES (${informatif ? "informatif" : "bloquant"}) :\n- ${r.raisons.join("\n- ")}\nS'il s'agit d'un écart de contenu : resynchroniser (scripts/bases/synchroniser-bases.mts), jamais à la main.`);
  if (!informatif) process.exit(1);
}
