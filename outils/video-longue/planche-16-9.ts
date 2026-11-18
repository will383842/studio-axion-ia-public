/**
 * VL-00 · Planche de 3 images 1920×1080 de pièces du plan de scènes et mesure de la vitesse de rendu de 60 s en 16:9.
 * Outil LOCAL, hors CI ; zéro euro (rendu sur la machine, aucun appel payant, aucun appel à Claude, aucun envoi) ;
 * aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Commande : pnpm exec tsx outils/video-longue/planche-16-9.ts [dossier-de-sortie]   (défaut : dossier temporaire du système)
 *            pnpm exec tsx outils/video-longue/planche-16-9.ts --aide                (n'affiche que l'aide, ne rend rien)
 * Navigateur : variable VL00_NAVIGATEUR (chemin d'un Chromium déjà installé) pour éviter tout téléchargement.
 * Sortie : 3 images PNG (carte chiffrée, schéma de flux, fenêtre d'application) et `mesure.md`
 * (secondes de rendu par seconde de vidéo). Le plan d'essai est `plan-essai-16-9.json` (même dossier).
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validerPlan } from "../../src/briques/plan-scenes/validateur";
import type { PlanValide } from "../../src/briques/plan-scenes/schema";

export const LARGEUR_16_9 = 1920;
export const HAUTEUR_16_9 = 1080;
export const DUREE_ESSAI_S = 60;

export interface PieceDePlanche {
  /** Nom du fichier image, sans extension. */
  nom: string;
  /** Identifiant de la pièce du plan de scènes. */
  piece: "carte-kpi" | "etapes" | "fenetre-app";
  /** Légende en français, pour Williams. */
  legende: string;
}

export const PIECES_PLANCHE: readonly PieceDePlanche[] = [
  { nom: "1-carte-chiffree", piece: "carte-kpi", legende: "Carte chiffrée" },
  { nom: "2-schema-de-flux", piece: "etapes", legende: "Schéma de flux" },
  { nom: "3-fenetre-application", piece: "fenetre-app", legende: "Fenêtre d'application" },
];

/** Après ce délai (ms) dans la scène, la pièce est entièrement apparue (dernière étape à 5 400 ms). */
export const DELAI_IMAGE_FIXE_MS = 8000;

const ICI = dirname(fileURLToPath(import.meta.url));

/** Plan d'essai validé, tel que le rendu le recevra. Ne lève pas ; les remarques sont rendues. */
export function chargerPlanEssai(chemin: string = join(ICI, "plan-essai-16-9.json")) {
  return validerPlan(JSON.parse(readFileSync(chemin, "utf8")));
}

/** Numéro d'image (25 i/s) où photographier la première scène portant la pièce demandée. */
export function imageDeLaPiece(plan: PlanValide, piece: PieceDePlanche["piece"]): number {
  const scene = plan.scenes.find((s) => s.piece === piece);
  if (!scene) throw new Error(`Aucune scène « ${piece} » dans le plan d'essai.`);
  const ms = Math.min(scene.debutMs + DELAI_IMAGE_FIXE_MS, scene.finMs - 40);
  return Math.round((ms / 1000) * plan.format.fps);
}

export interface MesureVitesse {
  /** Durée de la vidéo rendue (s). */
  dureeVideoS: number;
  /** Temps de rendu mesuré (s). */
  dureeRenduS: number;
}

/** Secondes de rendu par seconde de vidéo ; null si la durée de vidéo est nulle. Pure. */
export function secondesParSeconde(m: MesureVitesse): number | null {
  return m.dureeVideoS > 0 ? m.dureeRenduS / m.dureeVideoS : null;
}

/** Rendu Markdown de la mesure. Pur. */
export function mesureEnMarkdown(m: MesureVitesse, images: number, machine: string): string {
  const v = secondesParSeconde(m);
  return [
    "# VL-00 · Vitesse de rendu en 16:9 (1920×1080, 25 i/s)",
    "",
    `- Machine : ${machine}`,
    `- Vidéo rendue : ${m.dureeVideoS} s (${images} images)`,
    `- Temps de rendu : ${m.dureeRenduS.toFixed(1)} s`,
    `- **Secondes de rendu par seconde de vidéo : ${v === null ? "n/a" : v.toFixed(2)}**`,
    v === null ? "" : `- Pour 5 min de vidéo, à cette vitesse : environ ${((v * 300) / 60).toFixed(0)} min de rendu.`,
    "- Coût : 0 € (rendu local).",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

const AIDE = `VL-00 · planche 16:9 et mesure de rendu. Outil local, 0 €, hors CI.
Commande : pnpm exec tsx outils/video-longue/planche-16-9.ts [dossier-de-sortie]
Sortie : 3 images PNG 1920×1080 et mesure.md. Rien n'est envoyé.`;

async function principal(args: string[]): Promise<void> {
  if (args.includes("--aide") || args.includes("--help")) {
    console.log(AIDE);
    return;
  }
  const { mkdirSync, statSync, mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir, cpus } = await import("node:os");
  const { createRequire } = await import("node:module");
  const sortie = resolve(args[0] ?? join(tmpdir(), "planche-16-9"));
  mkdirSync(sortie, { recursive: true });

  const { plan, remarques } = chargerPlanEssai();
  if (remarques.length > 0) throw new Error(`Le plan d'essai n'est pas propre : ${remarques.map((r) => r.message).join(" ; ")}`);

  const racine = resolve(ICI, "..", "..");
  const exigerRendu = createRequire(join(racine, "studio-rendu", "package.json"));
  const { bundle } = exigerRendu("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
  const { renderMedia, renderStill, selectComposition } = exigerRendu("@remotion/renderer") as {
    renderMedia: (o: Record<string, unknown>) => Promise<unknown>;
    renderStill: (o: Record<string, unknown>) => Promise<unknown>;
    selectComposition: (o: Record<string, unknown>) => Promise<{ durationInFrames: number; fps: number } & Record<string, unknown>>;
  };
  const inputProps = { plan };
  const navigateur = process.env.VL00_NAVIGATEUR ? { browserExecutable: process.env.VL00_NAVIGATEUR } : {};
  const serveUrl = await bundle({ entryPoint: join(racine, "studio-rendu", "compositions", "index.ts") });
  const composition = await selectComposition({ serveUrl, id: "PlanDeScenes", inputProps, ...navigateur });
  const chromiumOptions = { gl: "swangle" };

  for (const p of PIECES_PLANCHE) {
    const output = join(sortie, `${p.nom}.png`);
    await renderStill({ composition, serveUrl, output, frame: imageDeLaPiece(plan, p.piece), inputProps, chromiumOptions, ...navigateur });
    console.log(`${p.legende} : ${output}`);
  }

  const tmp = mkdtempSync(join(tmpdir(), "vl00-"));
  try {
    const t0 = Date.now();
    await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: join(tmp, "essai.mp4"), inputProps, chromiumOptions, ...navigateur });
    const m: MesureVitesse = { dureeVideoS: composition.durationInFrames / composition.fps, dureeRenduS: (Date.now() - t0) / 1000 };
    const machine = `${cpus().length} cœurs, ${cpus()[0]?.model ?? "inconnu"} ; fichier de ${(statSync(join(tmp, "essai.mp4")).size / 1e6).toFixed(1)} Mo`;
    const texte = mesureEnMarkdown(m, composition.durationInFrames, machine);
    writeFileSync(join(sortie, "mesure.md"), `${texte}\n`);
    console.log(`\n${texte}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
