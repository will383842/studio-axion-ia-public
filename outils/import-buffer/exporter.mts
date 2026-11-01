/**
 * IMP-1 — EXPORT DES POSTS À VENIR DE BUFFER (LECTURE SEULE). Lancé plus tard sur le serveur par la session déployeuse.
 *
 * Par défaut : « à blanc » — n'écrit RIEN (ni fichier, ni R2, ni base), affiche le rapport. Aucune écriture chez Buffer
 * ni chez Zernio (les requêtes contenant « mutation » sont refusées par le client).
 *
 * Usage (racine du dépôt), BUFFER_API_KEY dans l'environnement du serveur :
 *   pnpm exec tsx outils/import-buffer/exporter.mts [--du AAAA-MM-JJ] [--au AAAA-MM-JJ] [--statistiques]
 *   Options qui écrivent (jamais par défaut) : --ecrire <dossier> (rapport, journal, statistiques en fichiers locaux)
 *   et --medias (copie privée vers R2 ; exige --ecrire et les variables R2_*).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configR2, creerStockageR2 } from "../../src/fournisseurs/r2/stockage";
import { filtrerPostsAVenir } from "../../src/services/import-buffer/exclusions";
import { ajouterEntree, entreeDepuisCopie, entreeExclue, nouveauJournal, resumeJournal } from "../../src/services/import-buffer/journal";
import { clientDepuisEnv, lireBuffer } from "../../src/services/import-buffer/lire-buffer";
import { copierMediasDuPost } from "../../src/services/import-buffer/medias-prives";
import { construireRapport, formaterRapport, PERIODE_DEFAUT } from "../../src/services/import-buffer/rapport";
import { lireStatistiquesPassees, statistiquesEnCsv } from "../../src/services/import-buffer/statistiques-buffer";

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const dossier = valeur("--ecrire");
const aBlanc = !dossier;
const veutMedias = args.includes("--medias");

async function main() {
  if (veutMedias && aBlanc) throw new Error("--medias exige --ecrire <dossier> (le mode à blanc n'écrit rien).");
  const periode = { du: valeur("--du") ?? PERIODE_DEFAUT.du, au: valeur("--au") ?? PERIODE_DEFAUT.au };
  const maintenant = new Date();
  const client = clientDepuisEnv();
  const lu = await lireBuffer(client, { depuis: maintenant.toISOString() });
  const { retenus, exclus } = filtrerPostsAVenir(lu.posts, maintenant);
  const rapport = formaterRapport(construireRapport(retenus, lu.canaux, periode));
  console.log(`${lu.posts.length} posts lus, ${retenus.length} retenus, ${exclus.length} exclus (${aBlanc ? "à blanc : rien n'est écrit" : "écriture locale"}).\n`);
  console.log(rapport);

  let journal = nouveauJournal(maintenant, aBlanc);
  for (const e of exclus) journal = ajouterEntree(journal, entreeExclue(e));
  if (veutMedias) {
    const config = configR2();
    if (!config) throw new Error("Variables R2_* absentes : copie des médias impossible.");
    const stockage = creerStockageR2(config);
    for (const p of retenus) journal = ajouterEntree(journal, entreeDepuisCopie(await copierMediasDuPost(p, stockage)));
  }
  const stats = args.includes("--statistiques") ? await lireStatistiquesPassees(client, lu.organisationId) : undefined;
  if (stats) console.log(`\nStatistiques passées lues pour ${stats.length} posts.`);

  if (dossier) {
    const sortie = resolve(dossier);
    mkdirSync(sortie, { recursive: true });
    writeFileSync(join(sortie, "rapport.txt"), rapport);
    writeFileSync(join(sortie, "journal.json"), JSON.stringify(journal, null, 2));
    if (stats) writeFileSync(join(sortie, "statistiques.csv"), statistiquesEnCsv(stats));
    console.log(`\nFichiers écrits dans ${sortie} (journal : ${JSON.stringify(resumeJournal(journal))}).`);
  }
}

main().catch((e) => {
  console.error(`Échec : ${e instanceof Error ? e.message : "erreur inconnue"}`);
  process.exit(1);
});
