/**
 * IMP-3 — RETRAIT DES JUMEAUX, PROMOTION ET RAPPROCHEMENT. Lancé plus tard sur le serveur par la session déployeuse.
 * Tout est « à blanc » (--dry-run) PAR DÉFAUT. RÈGLE ABSOLUE : aucun post Buffer n'est jamais supprimé.
 *
 *   pnpm exec tsx outils/import-buffer/jumeaux.mts retrait       --liste <fichier.csv> [--journal-retraits <fichier>] [--confirmer-retrait]
 *   pnpm exec tsx outils/import-buffer/jumeaux.mts promotion     [--executer] [--journal-promotions <fichier>]
 *   pnpm exec tsx outils/import-buffer/jumeaux.mts rapprochement [--attendus 92]
 *
 * ORDRE : brouillons vérifiés (IMP-2) → retrait du jumeau Buffer (à la main, liste) → promotion → rapprochement.
 * Le dépôt n'offre aucune mutation Buffer sûre : --confirmer-retrait est refusé (sortie en code 3) et la liste à retirer à la main est produite.
 * --liste est OBLIGATOIRE (la liste contient des identifiants réels : l'écrire HORS du dépôt, par ex. dans /tmp).
 * BUFFER_API_KEY et ZERNIO_API_KEY dans l'environnement du serveur.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { creerClientZernio } from "../../src/fournisseurs/publication/zernio-client";
import { filtrerPostsAVenir } from "../../src/services/import-buffer/exclusions";
import { clientDepuisEnv, lireBuffer } from "../../src/services/import-buffer/lire-buffer";
import { promouvoirBrouillons } from "../../src/services/import-buffer/promotion";
import { ATTENDUS_PAR_DEFAUT, formaterDelta, rapprocherDepuisZernio } from "../../src/services/import-buffer/rapprochement";
import { listeCsv, retirerJumeaux } from "../../src/services/import-buffer/retrait-jumeau";

const [commande, ...args] = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const lignesJournal = (f: string | undefined, cle: "bufferId" | "zernioId", etats: string[]): Set<string> =>
  new Set(f && existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>).filter((l) => etats.includes(l.etat)).map((l) => l[cle]) : []);

async function main() {
  if (!["retrait", "promotion", "rapprochement"].includes(commande ?? "")) throw new Error("Commande attendue : retrait, promotion ou rapprochement.");
  const cleZernio = process.env.ZERNIO_API_KEY;
  if (!cleZernio) throw new Error("ZERNIO_API_KEY absente.");
  const client = creerClientZernio({ cle: cleZernio });
  const maintenant = () => Date.now();
  const lu = await lireBuffer(clientDepuisEnv(), { depuis: new Date(maintenant()).toISOString() });
  if (lu.tronque) throw new Error("Lecture Buffer tronquée : arrêt.");
  const { retenus } = filtrerPostsAVenir(lu.posts, new Date(maintenant()));

  if (commande === "retrait") {
    const sortie = valeur("--liste");
    if (!sortie) throw new Error("--liste <fichier.csv> est exigé (écrire HORS du dépôt : la liste contient des identifiants réels). Rien n'a été fait.");
    const f = valeur("--journal-retraits");
    const res = await retirerJumeaux({
      client, posts: retenus,
      dejaRetires: lignesJournal(f, "bufferId", ["retire", "deja-retire"]),
      journaliser: (l) => { if (f) appendFileSync(f, `${JSON.stringify(l)}\n`); },
    });
    writeFileSync(sortie, `${listeCsv(res.liste)}\n`);
    const n: Record<string, number> = {};
    for (const l of res.lignes) n[l.etat] = (n[l.etat] ?? 0) + 1;
    console.log(`Retrait · ${res.lignes.length} posts · ${JSON.stringify(n)} · liste à la main : ${res.liste.length} (${sortie}). Aucun post supprimé.`);
    for (const l of res.lignes.filter((x) => ["sans-jumeau", "jumeau-different", "echec"].includes(x.etat))) console.log(`  ${l.bufferId} : ${l.etat} — ${l.raison ?? ""}`);
    if (res.lignes.some((x) => x.etat === "jumeau-different")) console.log("  Rappel : un jumeau différent sera AUSSI refusé à la promotion (état « jumeau-different »).");
    if (args.includes("--confirmer-retrait")) {
      console.error("--confirmer-retrait : aucun passage en brouillon sûr n'est disponible dans le dépôt (aucune écriture Buffer). Le retrait n'est PAS fait : liste à retirer à la main produite à la place.");
      process.exitCode = 3;
    }
  } else if (commande === "promotion") {
    const f = valeur("--journal-promotions");
    const aBlanc = !args.includes("--executer");
    const res = await promouvoirBrouillons({
      client, postsBuffer: lu.posts, aBlanc, maintenant,
      dejaPromus: lignesJournal(f, "zernioId", ["programme", "deja-fait"]),
      journaliser: (l) => { if (f) appendFileSync(f, `${JSON.stringify(l)}\n`); },
    });
    const n: Record<string, number> = {};
    for (const l of res.lignes) n[l.etat] = (n[l.etat] ?? 0) + 1;
    console.log(`${aBlanc ? "À BLANC : aucune promotion" : "PROMOTION"} · ${res.lignes.length} brouillons · ${JSON.stringify(n)}`);
    if (res.refusLot) console.log(`LOT REFUSÉ : ${res.refusLot}`);
    for (const v of res.violations) console.log(`GRILLE ${v.compte} : ${v.detail}`);
    for (const l of res.lignes.filter((x) => ["refuse", "a-verifier", "buffer-actif", "jumeau-different", "a-reprogrammer"].includes(x.etat))) console.log(`  ${l.bufferId} : ${l.etat} — ${l.raison ?? ""}`);
  } else {
    const attendus = Number(valeur("--attendus") ?? ATTENDUS_PAR_DEFAUT);
    const d = await rapprocherDepuisZernio(client, retenus, attendus);
    console.log(formaterDelta(d));
    if (!d.zeroEcart) process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Échec.");
  process.exit(1);
});
