/**
 * ESSAI DE LA CARTE SUR MESURE (facecam lot C) : une carte HTML / CSS / GSAP d'exemple (« 3 étapes en escalier »),
 * contrôlée par les garde-fous puis rendue en images fixes (et en vidéo avec `--video`), mode contrôle compris.
 * Usage (depuis `studio-rendu/`) : `npx tsx scripts/essai-sur-mesure.ts [--video] [--controle]`.
 */
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { miseEnPage, parametresCarteSurMesure } from "../../src/briques/motion/demande";
import { verifierSurMesure, type CodeSurMesure } from "../../src/briques/motion/sur-mesure";

export const EXEMPLE_ESCALIER: CodeSurMesure = {
  html: `<div class="titre">Votre devis en <b>3 marches</b></div>
<div class="escalier">
  <div class="marche m1"><span class="n">1</span><span class="t">Photo de la fuite</span></div>
  <div class="marche m2"><span class="n">2</span><span class="t">Devis prérempli</span></div>
  <div class="marche m3"><span class="n">3</span><span class="t">Envoyé en 10 min</span></div>
</div>
<svg class="fleche" viewBox="0 0 600 600"><path id="trajet" d="M40 520 C 200 520, 220 380, 300 360 S 460 200, 560 80" fill="none" stroke="var(--axion-orange)" stroke-width="10" stroke-linecap="round"/></svg>`,
  css: `.titre{position:absolute;left:84px;top:300px;width:820px;font-size:var(--axion-taille-titre);font-weight:800;line-height:1.05;letter-spacing:-0.02em}
.titre b{color:var(--axion-orange-vif)}
.escalier{position:absolute;left:84px;top:560px;width:820px;height:700px}
.marche{position:absolute;display:flex;align-items:center;gap:22px;height:150px;padding:0 30px;border-radius:var(--axion-rayon);background:linear-gradient(180deg,var(--axion-surface-haute),var(--axion-surface));box-shadow:0 0 0 2px var(--axion-filet)}
.m1{left:0;top:470px;width:560px}.m2{left:110px;top:270px;width:600px}.m3{left:220px;top:70px;width:600px}
.n{display:flex;align-items:center;justify-content:center;width:92px;height:92px;border-radius:50%;background:var(--axion-orange);font-size:var(--axion-taille-corps);font-weight:800}
.t{font-size:var(--axion-taille-legende);font-weight:600}
.fleche{position:absolute;left:300px;top:560px;width:600px;height:600px;opacity:.9}`,
  js: `const tl = gsap.timeline({ paused: true, defaults: { ease: "expo.out", duration: 0.45 } });
const titre = new SplitText(racine.querySelector(".titre"), { type: "words" });
tl.from(titre.words, { y: 60, rotateX: -40, opacity: 0, stagger: 0.07 }, 0.1);
tl.from(".fleche path", { drawSVG: "0%", duration: 1.6, ease: "power2.inOut" }, 0.5);
racine.querySelectorAll(".marche").forEach((m, i) => {
  tl.from(m, { y: 80, opacity: 0, scale: 0.92, ease: "back.out(1.6)" }, 0.7 + i * 0.55);
  tl.to(m, { boxShadow: "0 0 0 3px #C65A2E, 0 0 60px rgba(224, 112, 64, 0.45)", duration: 0.3 }, 0.8 + i * 0.55);
  if (i > 0) tl.to(racine.querySelectorAll(".marche")[i - 1], { boxShadow: "0 0 0 2px #3A322B", opacity: 0.75, duration: 0.3 }, 0.8 + i * 0.55);
});
tl.to(".escalier", { y: -20, duration: 3, ease: "none" }, 0.5);
tl.to([".titre", ".escalier", ".fleche"], { opacity: 0, y: -40, duration: 0.25, ease: "power3.in", stagger: 0.04 }, AXION.duree - 0.4);
AXION.enregistrer(tl);`,
};

const racine = resolve(import.meta.dirname, "..");
const video = process.argv.includes("--video");
const controle = process.argv.includes("--controle");
const verdict = verifierSurMesure(EXEMPLE_ESCALIER, 5);
console.log("garde-fous :", JSON.stringify(verdict));
if (!verdict.ok) process.exit(1);
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR ?? ["/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((c) => existsSync(c));
const reglages = { browserExecutable: navigateur ?? null, chromiumOptions: { gl: "swangle" as const } };
const p = parametresCarteSurMesure(EXEMPLE_ESCALIER, miseEnPage("9:16", "plein-ecran", 5));
const proprietes = { ...p.proprietes, ...(controle ? { controle: true } : {}) } as unknown as Record<string, unknown>;
const serveUrl = await bundle({ entryPoint: resolve(racine, "compositions/index.ts") });
const composition = await selectComposition({ serveUrl, id: p.composition, inputProps: proprietes, ...reglages });
const dossier = resolve(racine, ".planche-images");
mkdirSync(dossier, { recursive: true });
if (video) {
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 21, outputLocation: resolve(racine, "../docs/facecam/planche-motion/sur-mesure.mp4"), inputProps: proprietes, muted: true, concurrency: 4, ...reglages });
  console.log("vidéo écrite");
} else {
  for (const s of [0.3, 1, 2, 3, 4.8]) await renderStill({ composition, serveUrl, output: resolve(dossier, `sur-mesure-${Math.round(s * 10)}.png`), frame: Math.round(s * 25), inputProps: proprietes, ...reglages });
  console.log("images écrites");
}
