/**
 * Mesure la densité d'événements SUR LE RENDU d'un plan v4 : rend le plan SANS la prise (fond gris uni) et SANS sous-titres, en basse
 * définition (ECHELLE 0,25), puis passe `mesurer-densite.mjs`.
 *   node outils/facecam-animee-v4/mesurer-rendu.mjs <plan.json> [dossier-de-travail] [seuil=0.35]
 * (depuis la racine du dépôt ; il faut `studio-rendu/node_modules`.)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [fichierPlan, travailArg, seuil] = process.argv.slice(2);
if (!fichierPlan) throw new Error("Usage : node mesurer-rendu.mjs <plan.json> [dossier-de-travail] [seuil]");
const travail = resolve(travailArg ?? "/tmp/mesure-rendu-v4");
mkdirSync(travail, { recursive: true });
const plan = JSON.parse(readFileSync(resolve(fichierPlan), "utf8"));
plan.groupes = [];
plan.prise.src = "prise-grise.mp4";
writeFileSync(`${travail}/plan-mesure.json`, JSON.stringify(plan));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${process.env.COULEUR_PRISE ?? "0xFF00FF"}:s=1080x1920:r=30:d=${plan.duree}`, "-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono:d=${plan.duree}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", `${travail}/prise-grise.mp4`]);
execFileSync("node", [resolve("studio-rendu/compositions/interface-claire/motion-v4/rendre-repetition.mjs"), `${travail}/plan-mesure.json`, `${travail}/prise-grise.mp4`, `${travail}/sans-prise.mp4`, `${travail}/travail`], {
  stdio: "inherit", cwd: resolve("studio-rendu"), env: { ...process.env, ECHELLE: "0.25", CRF: "28", GARDER_TRAVAIL: "1" },
});
console.log(execFileSync("node", [resolve("outils/facecam-animee-v4/mesurer-densite.mjs"), `${travail}/sans-prise.mp4`, seuil ?? "0.35"], { encoding: "utf8" }));
