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

/** Habillage RÉEL du rendu du cas concret (fonctions pures, sans `remotion`) : chemin CALCULÉ, type local (PIEGE-REMOTION-TSC.md). */
type PlanHabillage = (p: { jeu: Record<string, unknown>; debutMs: number }, t: number, duree: number) => { echelle: number; camera: { echelle: number } | null };
const CHEMIN_HABILLAGE = [dirname(fileURLToPath(import.meta.url)), "..", "..", "studio-rendu", "compositions", "cas-concret", "plans", "habillage.ts"].join("/");
const { planHabillage } = (await import(/* @vite-ignore */ CHEMIN_HABILLAGE)) as { planHabillage: PlanHabillage };

/** Écran d'essai : 4 s, jamais le premier de la vidéo (`debutMs` > 50). */
export const DUREE_ECRAN_S = 4;
export const IMAGES_PAR_SECONDE = 25;

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

export interface CasePlanche { reglage: string; instant: "debut" | "milieu" | "fin"; t: number; cameraMax: number; echelle: number }

/**
 * Les 9 cases de la planche (3 réglages × 3 instants) : échelle calculée par le vrai `planHabillage` du rendu
 * (caméra « zoom-lent », plafond `plafondCamera(jeu.cameraMax)`), produit entrée × caméra compris. « fin » = t = durée de l'écran (fin de la montée).
 */
export function casesPlanche(): CasePlanche[] {
  const instants: { instant: CasePlanche["instant"]; t: number }[] = [
    { instant: "debut", t: 0 },
    { instant: "milieu", t: DUREE_ECRAN_S / 2 },
    { instant: "fin", t: DUREE_ECRAN_S },
  ];
  return cellulesPlanche().flatMap((c) =>
    instants.map((i) => {
      const h = planHabillage({ jeu: { camera: "zoom-lent", cameraMax: c.echelle }, debutMs: 1000 }, i.t, DUREE_ECRAN_S);
      return { reglage: c.nom, instant: i.instant, t: i.t, cameraMax: c.echelle, echelle: h.echelle * (h.camera?.echelle ?? 1) };
    }),
  );
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

/** Lecture pure des arguments : `--videos` n'écarte l'argument suivant que s'il est présent (sinon `iv + 1` valait 0 et écartait le dossier). */
export function lireArguments(args: string[]): { sortie?: string; fichierVideos?: string } {
  const iv = args.indexOf("--videos");
  const fichierVideos = iv >= 0 ? args[iv + 1] : undefined;
  const sortie = args.find((a, i) => !a.startsWith("--") && (iv < 0 || i !== iv + 1));
  return { sortie, fichierVideos };
}

async function main(): Promise<void> {
  const { sortie, fichierVideos } = lireArguments(process.argv.slice(2));
  if (!sortie) { console.error("Usage : pnpm exec tsx outils/zoom-gratuit/planche.mts <dossier-de-sortie> [--videos <fichier.json>]"); process.exit(1); }
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const dossier = resolve(sortie);
  const cases = casesPlanche();

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
  mkdirSync(dossier, { recursive: true });
  const tmp = join(racine, "studio-rendu", ".planche-zoom-gratuit-tmp");
  mkdirSync(tmp, { recursive: true });
  const entree = join(tmp, "index.tsx");
  writeFileSync(entree, `import React from "react";
import { Composition, registerRoot } from "remotion";
const REPERES = Array.from({ length: 13 }, (_, i) => i * 10);
const Cellule: React.FC<{ echelle: number; nom: string }> = ({ echelle, nom }) => (
  <div style={{ width: "100%", height: "100%", background: "#111", overflow: "hidden", position: "relative", fontFamily: "Manrope, sans-serif" }}>
    <div style={{ position: "absolute", inset: 0, transform: "scale(" + echelle + ")", transformOrigin: "50% 50%", background: "repeating-linear-gradient(0deg,#6a7a9a 0 2px,transparent 2px 60px),repeating-linear-gradient(90deg,#6a7a9a 0 2px,transparent 2px 60px),linear-gradient(135deg,#2a3a5a,#5a3a2a)" }}>
      {REPERES.map((m) => (
        <div key={m} style={{ position: "absolute", inset: m, border: "2px solid " + (m % 20 === 0 ? "#ffd24a" : "#fff"), boxSizing: "border-box" }}>
          {m % 20 === 0 ? <span style={{ position: "absolute", top: 2, left: 8, color: "#ffd24a", fontSize: 22 }}>{m}</span> : null}
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", inset: 40, border: "3px solid #ff3b3b", boxSizing: "border-box" }} />
    <div style={{ position: "absolute", left: 48, bottom: 48, color: "#fff", fontSize: 44, background: "rgba(0,0,0,.6)", padding: "4px 12px" }}>{nom} · x{String(echelle).replace(".", ",")}</div>
  </div>
);
registerRoot(() => <Composition id="cellule" component={Cellule} width={1080} height={1920} fps={25} durationInFrames={25} defaultProps={{ echelle: 1, nom: "" }} />);
`);
  try {
    const serveUrl = await bundle({ entryPoint: entree });
    const txt: string[] = [];
    for (const c of cases) {
      const nom = `${c.reglage}-${c.instant}`;
      const inputProps = { echelle: c.echelle, nom };
      const composition = await renderer.selectComposition({ serveUrl, id: "cellule", inputProps });
      const output = join(dossier, `${nom}.png`);
      await renderer.renderStill({ composition, serveUrl, output, frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
      txt.push(`${nom} : t = ${String(c.t).replace(".", ",")} s, plafond ${String(c.cameraMax).replace(".", ",")}, échelle ${c.echelle.toFixed(4).replace(".", ",")} → ${output}`);
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
