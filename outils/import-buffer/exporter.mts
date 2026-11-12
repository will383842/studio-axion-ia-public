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
 *
 * Mode archive (L0-04, Buffer résilié) : --archive lit les Publications directement dans les dépôts du Studio (DATABASE_URL
 *   requis, comme le serveur) et retrouve le média de chaque publication (clé de stockage de la vidéo ou du visuel).
 *   Variante : --archive <publications.json> (lignes { publication, media? }) pour travailler sur un fichier.
 *   Une seule tentative de lecture Buffer (son échec n'est pas une erreur), puis archive datée + rapport des champs
 *   absents + comparaison aux 92 posts programmés. À blanc par défaut ; --ecrire <dossier> écrit archive et rapport ;
 *   --medias (avec --ecrire et R2_*) copie les médias vers R2 et les vérifie.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configR2, creerStockageR2 } from "../../src/fournisseurs/r2/stockage";
import { filtrerPostsAVenir } from "../../src/services/import-buffer/exclusions";
import { ajouterEntree, entreeDepuisCopie, entreeExclue, nouveauJournal, resumeJournal } from "../../src/services/import-buffer/journal";
import { clientDepuisEnv, lireBuffer } from "../../src/services/import-buffer/lire-buffer";
import { copierMediasDuPost } from "../../src/services/import-buffer/medias-prives";
import { construireRapport, formaterRapport, PERIODE_DEFAUT } from "../../src/services/import-buffer/rapport";
import { archiveDepuisPublications, copierEtVerifierMedias, formaterRapportArchive, lignesDepuisStudio, tenterLectureBuffer, type LignePublication } from "../../src/services/import-buffer/lire-publies";
import { lireStatistiquesPassees, statistiquesEnCsv } from "../../src/services/import-buffer/statistiques-buffer";

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const dossier = valeur("--ecrire");
const aBlanc = !dossier;
const veutMedias = args.includes("--medias");

async function lignesDuStudio(): Promise<LignePublication[]> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absente : les Publications du Studio sont illisibles (ou donnez un fichier : --archive <publications.json>).");
  const { depots } = await import("../../src/donnees/memoire");
  return lignesDepuisStudio(depots());
}

async function archiver(fichier: string | undefined) {
  if (veutMedias && aBlanc) throw new Error("--medias exige --ecrire <dossier> (le mode à blanc n'écrit rien).");
  let lignes: LignePublication[];
  if (fichier) {
    const brut: unknown = JSON.parse(readFileSync(resolve(fichier), "utf8"));
    if (!Array.isArray(brut)) throw new Error("Le fichier des publications doit contenir une liste.");
    lignes = brut as LignePublication[];
  } else lignes = await lignesDuStudio();
  const maintenant = new Date();
  let client;
  try {
    client = clientDepuisEnv();
  } catch {
    client = undefined; // pas de clé : l'archive vient des Publications du Studio
  }
  const buffer = await tenterLectureBuffer(client, { secrets: [process.env.BUFFER_API_KEY ?? ""] });
  const archive = archiveDepuisPublications(lignes, maintenant, buffer);
  const rapport = formaterRapportArchive(archive);
  console.log(`${rapport}\n(${aBlanc ? "à blanc : rien n'est écrit" : "écriture locale"})`);
  let medias;
  if (veutMedias) {
    const config = configR2();
    if (!config) throw new Error("Variables R2_* absentes : copie des médias impossible.");
    medias = await copierEtVerifierMedias(lignes, creerStockageR2(config));
    console.log(`Médias : ${medias.copies} copiés, ${medias.verifies} vérifiés, ${medias.echecs.length} échec(s).`);
  }
  if (dossier) {
    const sortie = resolve(dossier);
    mkdirSync(sortie, { recursive: true });
    writeFileSync(join(sortie, `${archive.nom}.json`), JSON.stringify({ ...archive, ...(medias ? { medias } : {}) }, null, 2));
    writeFileSync(join(sortie, `${archive.nom}-rapport.txt`), rapport);
    console.log(`Fichiers écrits dans ${sortie}.`);
  }
}

async function main() {
  if (args.includes("--archive")) {
    const suivant = valeur("--archive");
    return archiver(suivant && !suivant.startsWith("--") ? suivant : undefined);
  }
  if (veutMedias && aBlanc) throw new Error("--medias exige --ecrire <dossier> (le mode à blanc n'écrit rien).");
  const periode = { du: valeur("--du") ?? PERIODE_DEFAUT.du, au: valeur("--au") ?? PERIODE_DEFAUT.au };
  const maintenant = new Date();
  const client = clientDepuisEnv();
  const lu = await lireBuffer(client, { depuis: maintenant.toISOString() });
  const { retenus, exclus } = filtrerPostsAVenir(lu.posts, maintenant);
  const rapport = formaterRapport(construireRapport(retenus, lu.canaux, periode));
  console.log(`${lu.posts.length} posts lus, ${retenus.length} retenus, ${exclus.length} exclus (${aBlanc ? "à blanc : rien n'est écrit" : "écriture locale"}).\n`);
  if (lu.tronque) console.log("ATTENTION : lecture tronquée (plafond de pages atteint), la liste est incomplète.");
  console.log(rapport);

  let journal = nouveauJournal(maintenant, aBlanc);
  for (const e of exclus) journal = ajouterEntree(journal, entreeExclue(e));
  if (!veutMedias) {
    for (const p of retenus) journal = ajouterEntree(journal, { bufferId: p.id, etat: "lu", medias: [], echecsMedias: 0 });
  } else {
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
