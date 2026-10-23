/**
 * ESSAI LOCAL de `studio-rendu` (sans Docker) : démarre le vrai serveur avec les vraies opérations, un faux
 * « seau » HTTP local (lecture des entrées, réception des dépôts), puis soumet :
 *   - une analyse ffprobe (file courte) d'une vidéo de démonstration du studio,
 *   - une image fixe Remotion (file courte),
 *   - un montage d'essai Remotion (file longue).
 * Usage : `npx tsx scripts/essai-local.ts [vidéo.mp4]` — résultats dans `.essai-local/`.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { analyseMedia } from "../src/operations/analyse-media.js";
import { composition } from "../src/operations/composition.js";
import { imageFixe } from "../src/operations/image-fixe.js";
import { FilesRendu } from "../src/files.js";
import { creerServeur } from "../src/serveur.js";
import type { DemandeRendu, EtatRendu } from "../src/contrat.js";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const sortie = resolve(".essai-local");
mkdirSync(sortie, { recursive: true });
const video = resolve(process.argv[2] ?? "../public/demo/avocat-droits.mp4");
if (!existsSync(video)) throw new Error(`Vidéo introuvable : ${video}`);

// Faux seau : GET /entree.mp4 sert la vidéo ; PUT /depot/{nom} écrit le fichier reçu.
const seau = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/entree.mp4") {
    res.writeHead(200, { "content-type": "video/mp4" });
    createReadStream(video).pipe(res);
    return;
  }
  if (req.method === "PUT" && req.url?.startsWith("/depot/")) {
    const f = createWriteStream(join(sortie, req.url.slice(7)));
    req.pipe(f);
    f.on("finish", () => {
      res.writeHead(200, { etag: '"essai"' });
      res.end();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise<void>((ok) => seau.listen(0, "127.0.0.1", ok));
const baseSeau = `http://127.0.0.1:${(seau.address() as AddressInfo).port}`;

const files = new FilesRendu({ operations: { "analyse-media": analyseMedia, "image-fixe": imageFixe, composition }, delaiCourteMs: 180_000 });
const serveur = creerServeur(files);
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;

const demandes: DemandeRendu[] = [
  { idRendu: "essai-montage", operation: "composition", file: "longue", entrees: {}, sortie: { urlDepot: `${baseSeau}/depot/essai.mp4`, cle: "essai.mp4" }, parametres: { composition: "Essai", proprietes: { titre: "Montage d'essai" } } },
  { idRendu: "essai-analyse", operation: "analyse-media", file: "courte", entrees: { media: `${baseSeau}/entree.mp4` }, sortie: { urlDepot: `${baseSeau}/depot/analyse.json`, cle: "analyse.json" }, parametres: {} },
  { idRendu: "essai-image", operation: "image-fixe", file: "courte", entrees: {}, sortie: { urlDepot: `${baseSeau}/depot/image.png`, cle: "image.png" }, parametres: { composition: "Essai", image: 60, proprietes: { titre: "Image d'essai" } } },
];
const debut = Date.now();
for (const d of demandes) {
  const r = await fetch(`${base}/rendus`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
  console.log(`soumis ${d.idRendu} → ${r.status}`);
}
const fins: Record<string, number> = {};
const ordreDepart: string[] = [];
while (Object.keys(fins).length < demandes.length) {
  for (const d of demandes) {
    if (fins[d.idRendu]) continue;
    const etat = (await (await fetch(`${base}/rendus/${d.idRendu}`)).json()) as EtatRendu;
    if (etat.statut === "en_cours" && !ordreDepart.includes(d.idRendu)) ordreDepart.push(d.idRendu);
    if (etat.statut === "termine" || etat.statut === "echec") {
      fins[d.idRendu] = Date.now() - debut;
      console.log(`${d.idRendu} : ${etat.statut} en ${(fins[d.idRendu] / 1000).toFixed(1)} s`, etat.statut === "termine" ? (etat.mesures ?? "") : etat.erreur.message);
    }
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log("ordre de départ :", ordreDepart.join(" → "));
console.log("inconnu (404) :", (await fetch(`${base}/rendus/jamais-vu`)).status);
serveur.close();
seau.close();
