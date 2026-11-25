/**
 * ESSAI LOCAL DE LA VIDÉO LONGUE SANS VOIX (lot F, qualité) : la VRAIE chaîne, de bout en bout, sans réseau ni dépense.
 *   script collé → `chapitresDuScript` (écran) → entrées → `estimerMotsSansVoix` → `chapitresDepuisVoix`
 *   → `monterVideoLongue` (plan, sous-titres, une plage à la fois) → vrai serveur `studio-rendu` (opérations `composition`
 *   et `collage-chapitres`, Remotion + FFmpeg) → MP4 final.
 * Usage (depuis la racine du dépôt) : `npx tsx studio-rendu/scripts/essai-video-longue.ts [script.txt] [sortie.mp4]`.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, resolve } from "node:path";
import { composition } from "../src/operations/composition.js";
import { collageChapitres } from "../src/operations/collage-chapitres.js";
import { FilesRendu } from "../src/files.js";
import { creerServeur } from "../src/serveur.js";
import { chapitresDuScript, decouperEnPhrases } from "../../src/components/formats/video-longue/PlanChapitres";
import { lireEntreesVideoLongue } from "../../src/moteurs/montage-video-longue/entrees";
import { chapitresDepuisVoix, estimerMotsSansVoix } from "../../src/moteurs/montage-video-longue/chaine";
import { monterVideoLongue, type PlageNotee } from "../../src/services/video-longue-montage";
import type { CommandeFabrication } from "../../src/domaine/types";

process.env.STUDIO_RENDU_ESSAI ??= "1";

export const SCRIPT_ESSAI = `Le problème : compter à la main

Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main. Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères. Les chiffres sont faux dès le lendemain. Une rupture se découvre quand un client appelle. On commande alors en urgence, plus cher. Et personne ne sait vraiment ce qui dort au fond de l'entrepôt.

La solution : un tableau de bord qui se met à jour seul

Le tableau de bord lit chaque vente et chaque livraison au moment où elles arrivent. En haut, trois chiffres : la valeur du stock, les articles bientôt épuisés, et les commandes en attente. Juste en dessous, la liste des articles à commander, triée par urgence. Un clic sur un article montre son historique sur douze mois. Plus besoin de compter : le stock est juste à chaque instant.

Les alertes : savoir avant de manquer

Pour chaque article, vous fixez un seuil minimum. Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne. Le message dit quoi commander et en quelle quantité. Chaque lundi matin, un résumé de la semaine arrive dans votre boîte. Vous savez avant de manquer, et plus jamais par un client mécontent.

Par où commencer

Commencez petit. Choisissez les vingt articles qui se vendent le plus. Reliez le tableau de bord à votre outil de vente pour ces vingt articles. Vérifiez pendant deux semaines que les chiffres sont justes. Ajoutez ensuite le reste du catalogue, famille par famille. Pour en parler avec nous, prenez rendez-vous.`;

const racine = resolve(import.meta.dirname, "../..");
const fichierScript = process.argv[2];
const sortieFinale = resolve(process.argv[3] ?? join(racine, "out/video-longue-essai.mp4"));
const script = fichierScript && existsSync(fichierScript) ? readFileSync(fichierScript, "utf8") : SCRIPT_ESSAI;
const dossier = resolve(racine, "out/essai-video-longue");
mkdirSync(dossier, { recursive: true });
mkdirSync(dirname(sortieFinale), { recursive: true });

// Écran : le script collé est découpé comme dans le formulaire, puis « validé » tel quel (phrases du texte collé).
const propose = chapitresDuScript(script);
const valide = propose.map((c) => ({ id: c.id, titre: c.titre, texte: decouperEnPhrases(c.texte).join(" ") }));
console.log(`chapitres proposés par l'écran : ${propose.length}`);
for (const c of propose) console.log(`  - « ${c.titre || "(sans titre)"} » : ${c.texte.split(/\s+/).filter(Boolean).length} mots`);

const commande = { videoId: "v-essai-longue", ratios: ["16:9"], entrees: { videoLongue: { chapitres: valide, sansVoix: true } } } as unknown as CommandeFabrication;
const entrees = lireEntreesVideoLongue(commande);
const voix = estimerMotsSansVoix(entrees);
const chapitres = chapitresDepuisVoix(entrees, voix.mots, voix.dureeSec);
console.log(`durée : ${voix.dureeSec} s ; chapitres : ${chapitres.map((c) => `${c.libelle} [${c.debutSec}-${c.finSec}]`).join(" | ")}`);

// Faux seau : GET /lire/{nom} sert un fichier déposé ; PUT /depot/{nom} écrit le fichier reçu.
const seau = createServer((req, res) => {
  const url = decodeURIComponent(req.url ?? "");
  if (req.method === "GET" && url.startsWith("/lire/")) {
    const f = join(dossier, url.slice(6).replace(/\//g, "__"));
    if (!existsSync(f)) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": "video/mp4" });
    createReadStream(f).pipe(res);
    return;
  }
  if (req.method === "PUT" && url.startsWith("/depot/")) {
    const f = createWriteStream(join(dossier, url.slice(7).replace(/\//g, "__")));
    req.pipe(f);
    f.on("finish", () => res.writeHead(200, { etag: '"essai"' }).end());
    return;
  }
  res.writeHead(404).end();
});
await new Promise<void>((ok) => seau.listen(0, "127.0.0.1", ok));
const baseSeau = `http://127.0.0.1:${(seau.address() as AddressInfo).port}`;

const files = new FilesRendu({ operations: { composition, "collage-chapitres": collageChapitres }, delaiCourteMs: 180_000 });
const serveur = creerServeur(files);
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;

let notees: Record<string, PlageNotee> = {};
const debut = Date.now();
const r = await monterVideoLongue(commande, "essai", { chapitres, mots: voix.mots, dureeSec: voix.dureeSec }, {
  rendu: {
    async soumettre(d) {
      const rep = await fetch(`${base}/rendus`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
      if (!rep.ok) throw new Error(`soumission refusée ${rep.status} ${await rep.text()}`);
      console.log(`  soumis ${d.idRendu} (${((Date.now() - debut) / 1000).toFixed(0)} s)`);
      return { idRendu: d.idRendu };
    },
    async etat(id) {
      return (await (await fetch(`${base}/rendus/${id}`)).json()) as never;
    },
  },
  signer: async (lectures, depots) => ({
    lectures: Object.fromEntries(Object.entries(lectures).map(([n, cle]) => [n, `${baseSeau}/lire/${encodeURIComponent(cle)}`])),
    depots: Object.fromEntries(depots.map((d) => [d.cle, `${baseSeau}/depot/${encodeURIComponent(d.cle)}`])),
  }),
  cle: (_c, nom) => `videos/v-essai-longue/${nom}`,
  lirePlages: async () => notees,
  ecrirePlages: async (_v, p) => void (notees = p),
  attendre: (ms) => new Promise((ok) => setTimeout(ok, Math.min(ms, 500))),
  intervalleMs: 500,
});
copyFileSync(join(dossier, r.fichierCle.replace(/\//g, "__")), sortieFinale);
console.log(`vidéo : ${sortieFinale} en ${((Date.now() - debut) / 1000).toFixed(0)} s`);
serveur.close();
seau.close();
process.exit(0);
