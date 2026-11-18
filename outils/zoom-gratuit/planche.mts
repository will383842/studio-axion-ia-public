/**
 * C8-Z05b : planche avant/après du zoom gratuit du cas concret (1,035 contre `casConcret.cameraPlus`) et rapport de comptage.
 * Lancé À LA MAIN par la session de mise en ligne (`pnpm exec tsx outils/zoom-gratuit/planche.mts <dossier-de-sortie> [--videos <fichier.json>]`).
 * Jamais importé par `src/` ni `studio-rendu/`. 0 € : rendu local. Aucun son.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CAMERA_PLUS_MAX } from "../../src/moteurs/montage-cas-concret/variete";
import { ligneRapport, zoomsAvocat, zoomsClassique } from "./compter";

/** Caméra d'aujourd'hui (`CAMERA_BASE_MAX` de variete.ts, non exporté : recopié, un test vérifie l'égalité). */
const CAMERA_BASE_MAX = 1.035;

export interface VideoCompte { nom: string; genre: "classique" | "avocat"; dureeSec: number; plans: unknown[] }

/** Avant = 1,035 ; après = 1,040 et le plafond 1,048. */
export function cellulesPlanche(): { nom: string; echelle: number }[] {
  return [
    { nom: "avant", echelle: CAMERA_BASE_MAX },
    { nom: "apres-1040", echelle: 1.04 },
    { nom: "apres-plafond", echelle: CAMERA_PLUS_MAX },
  ];
}

/** Une ligne par vidéo, puis une ligne de moyenne (zooms par minute). */
export function rapportComptage(videos: VideoCompte[]): string[] {
  const comptes = videos.map((v) => ({
    ligne: v.genre === "avocat" ? zoomsAvocat(v.plans as never, v.dureeSec) : zoomsClassique(v.plans as never, v.dureeSec),
    nom: `${v.nom} (${v.genre})`,
  }));
  const lignes = comptes.map((c) => ligneRapport(c.nom, c.ligne));
  const moy = comptes.length ? Math.round((comptes.reduce((s, c) => s + c.ligne.parMinute, 0) / comptes.length) * 100) / 100 : 0;
  lignes.push(`moyenne : ${String(moy).replace(".", ",")} par minute sur ${comptes.length} vidéo(s)`);
  return lignes;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iv = args.indexOf("--videos");
  const fichierVideos = iv >= 0 ? args[iv + 1] : undefined;
  const sortie = args.find((a, i) => !a.startsWith("--") && i !== iv + 1);
  if (!sortie) { console.error("Usage : pnpm exec tsx outils/zoom-gratuit/planche.mts <dossier-de-sortie> [--videos <fichier.json>]"); process.exit(1); }
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const dossier = resolve(sortie);
  mkdirSync(dossier, { recursive: true });
  const cellules = cellulesPlanche();

  if (!existsSync(join(racine, "studio-rendu", "node_modules", "@remotion"))) {
    console.error("Outil manquant : @remotion/bundler et @remotion/renderer (studio-rendu). Rien n'est téléchargé ni installé ; installer à la main puis relancer.");
    process.exit(1);
  }
  const exiger = createRequire(join(racine, "studio-rendu", "package.json"));
  let bundle: (o: { entryPoint: string }) => Promise<string>;
  let renderer: { selectComposition: (o: object) => Promise<{ width: number; height: number }>; renderStill: (o: object) => Promise<unknown> };
  try {
    bundle = (exiger("@remotion/bundler") as { bundle: typeof bundle }).bundle;
    renderer = exiger("@remotion/renderer");
  } catch (e) {
    console.error(`Rendu impossible (Chromium ou Remotion absent) : ${(e as Error).message}`);
    process.exit(1);
  }
  const tmp = join(racine, "studio-rendu", ".planche-zoom-gratuit-tmp");
  mkdirSync(tmp, { recursive: true });
  const entree = join(tmp, "index.tsx");
  writeFileSync(entree, `import React from "react";
import { Composition, registerRoot } from "remotion";
const Cellule: React.FC<{ echelle: number; nom: string }> = ({ echelle, nom }) => (
  <div style={{ width: "100%", height: "100%", background: "#111", overflow: "hidden", position: "relative", fontFamily: "Manrope, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, transform: "scale(" + echelle + ")", transformOrigin: "50% 50%", border: "6px solid #fff", boxSizing: "border-box", background: "linear-gradient(135deg,#2a3a5a,#5a3a2a)" }} />
    <div style={{ position: "absolute", left: 24, bottom: 24, color: "#fff", fontSize: 48 }}>{nom} · x{String(echelle).replace(".", ",")}</div>
  </div>
);
registerRoot(() => <Composition id="cellule" component={Cellule} width={1080} height={1920} fps={25} durationInFrames={25} defaultProps={{ echelle: 1, nom: "" }} />);
`);
  try {
    const serveUrl = await bundle({ entryPoint: entree });
    const txt: string[] = [];
    for (const c of cellules) {
      const inputProps = { echelle: c.echelle, nom: c.nom };
      const composition = await renderer.selectComposition({ serveUrl, id: "cellule", inputProps });
      const output = join(dossier, `${c.nom}.png`);
      await renderer.renderStill({ composition, serveUrl, output, frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
      txt.push(`${c.nom} : échelle ${String(c.echelle).replace(".", ",")} → ${output}`);
    }
    if (fichierVideos) txt.push("", ...rapportComptage(JSON.parse(readFileSync(fichierVideos, "utf8")) as VideoCompte[]));
    writeFileSync(join(dossier, "planche.txt"), txt.join("\n") + "\n");
    console.log(txt.join("\n"));
  } catch (e) {
    console.error(`Rendu impossible : ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
