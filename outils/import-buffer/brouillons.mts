/**
 * IMP-2 — BROUILLONS ZERNIO DE L'IMPORT BUFFER. Lancé plus tard sur le serveur par la session déployeuse.
 *
 * Par défaut : « à blanc » (--a-blanc) — AUCUN POST : corps construits et contrôlés, résumé affiché.
 * Les vraies créations exigent --creer ET une table des cibles confirmée par Will (« C'est juste »).
 * La table des cibles est un fichier JSON local au serveur (identifiants réels : jamais dans le dépôt).
 *
 * Usage (racine du dépôt), BUFFER_API_KEY et ZERNIO_API_KEY dans l'environnement du serveur :
 *   pnpm exec tsx outils/import-buffer/brouillons.mts --table <table.json> --lot A|B|D [--a-blanc] [--creer] [--verifier] [--journal <journal.json de l'export>]
 */
import { readFileSync } from "node:fs";
import { configR2, creerStockageR2 } from "../../src/fournisseurs/r2/stockage";
import { creerClientZernio } from "../../src/fournisseurs/publication/zernio-client";
import { lecteurMediaParDefaut } from "../../src/fournisseurs/publication/zernio-medias";
import { estConfirmee, lireTable } from "../../src/services/import-buffer/cibles";
import { creerBrouillons, type LotImport } from "../../src/services/import-buffer/creer-brouillons";
import { clientDepuisEnv, lireBuffer } from "../../src/services/import-buffer/lire-buffer";
import { formaterVerification, verifierBrouillons } from "../../src/services/import-buffer/verifier";
import type { DocumentJournalImport } from "../../src/services/import-buffer/journal";
import type { MediaCopie } from "../../src/services/import-buffer/medias-prives";

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const veutCreer = args.includes("--creer") && !args.includes("--a-blanc");
const aBlanc = !veutCreer;

async function main() {
  const chemin = valeur("--table");
  if (!chemin) throw new Error("--table <fichier JSON de la table des cibles> est exigé.");
  const lot = valeur("--lot") as LotImport | undefined;
  if (lot !== "A" && lot !== "B" && lot !== "D") throw new Error("--lot A, B ou D est exigé.");
  const table = lireTable(JSON.parse(readFileSync(chemin, "utf8")));
  if (veutCreer && !estConfirmee(table)) throw new Error("La table des cibles n'est pas confirmée par Will : aucune création.");

  const maintenant = () => Date.now();
  const lu = await lireBuffer(clientDepuisEnv(), { depuis: new Date(maintenant()).toISOString() });
  const cleZernio = process.env.ZERNIO_API_KEY;
  if (!cleZernio) throw new Error("ZERNIO_API_KEY absente.");
  const client = creerClientZernio({ cle: cleZernio });
  const config = configR2();
  if (!config) throw new Error("Variables R2_* absentes.");
  const stockage = creerStockageR2(config);

  // Médias copiés (IMP-1) : le journal.json de l'export (--journal) donne clé R2, taille et empreinte par rang ;
  // le texte alternatif et le titre viennent du post Buffer. Sans journal, un post reste à Buffer (refus lisible).
  const copies = new Map<string, MediaCopie[]>();
  const fichierJournal = valeur("--journal");
  if (fichierJournal) {
    const journal = JSON.parse(readFileSync(fichierJournal, "utf8")) as DocumentJournalImport;
    for (const e of journal.posts) {
      const post = lu.posts.find((p) => p.id === e.bufferId);
      if (!post) continue;
      copies.set(e.bufferId, e.medias.map((m) => {
        const src = post.medias[m.rang];
        return { rang: m.rang, type: m.type as MediaCopie["type"], mime: src?.mime ?? "", taille: m.taille, sha256: m.sha256, cleStockage: m.cleStockage, texteAlternatif: src?.texteAlternatif, titre: src?.titre };
      }));
    }
  }
  const res = await creerBrouillons({
    client, table, posts: lu.posts, copies, lot, aBlanc, maintenant,
    urlLecture: async (cle) => stockage.urlLectureDuree?.(cle, 3600) ?? stockage.urlLecture(cle),
    lecteur: lecteurMediaParDefaut,
  });

  const compte: Record<string, number> = {};
  for (const l of res.lignes) compte[l.etat] = (compte[l.etat] ?? 0) + 1;
  console.log(`${aBlanc ? "À BLANC : aucun POST" : "CRÉATION"} · lot ${lot} · ${res.lignes.length} posts · ${JSON.stringify(compte)}`);
  for (const v of res.violations) console.log(`GRILLE ${v.compte} : ${v.detail}`);
  for (const l of res.lignes.filter((x) => x.etat === "refuse" || x.etat === "a-verifier" || x.etat === "arret")) console.log(`  ${l.bufferId} : ${l.etat} — ${l.raison ?? ""}`);

  if (args.includes("--verifier")) {
    const attendus = res.lignes.filter((l) => l.zernioId && res.corps.has(l.bufferId)).map((l) => ({ bufferId: l.bufferId, zernioId: l.zernioId!, corps: res.corps.get(l.bufferId)! }));
    console.log(formaterVerification(await verifierBrouillons(client, attendus)));
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Échec de l'import.");
  process.exit(1);
});
