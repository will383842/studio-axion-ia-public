/**
 * PLANCHE-C11-T4-v21s : images de la planche « apparition au mot » en vraie police Manrope. Lancé à la main, jamais en CI ;
 * aucun générateur n'importe ce fichier ; rien n'est allumé ; 0 €, aucun réseau, rien de téléchargé.
 * Usage (racine) : `pnpm exec tsx outils/planche-apparition-images/images.mts --navigateur <chemin> [--sortie <dossier>]`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlancheApparition } from "../planche-apparition/PlancheApparition";

const RACINE = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const POLICE = join(RACINE, "src", "briques", "sous-titres", "polices", "Manrope-Variable.ttf");

export function lireArguments(args: string[]): { navigateur?: string; sortie: string } {
  let navigateur: string | undefined;
  let sortie = join(RACINE, "docs", "captures", "apparition");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--navigateur" && args[i + 1]) navigateur = args[++i];
    else if (args[i] === "--sortie" && args[i + 1]) sortie = resolve(args[++i]);
  }
  return { navigateur, sortie };
}

export function pageHtml(fond: "ivoire" | "noir", cheminPolice: string): string {
  const corps = renderToStaticMarkup(React.createElement(PlancheApparition, { fond }));
  const police = pathToFileURL(cheminPolice).href;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche apparition ${fond}</title><style>@font-face{font-family:Manrope;src:url("${police}");font-weight:200 800}body{margin:0}</style></head><body>${corps}</body></html>`;
}

export function argumentsNavigateur(html: string, png: string): string[] {
  return ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1080,1920", "--virtual-time-budget=3000", `--screenshot=${png}`, pathToFileURL(html).href];
}

function main(): number {
  const { navigateur, sortie } = lireArguments(process.argv.slice(2));
  if (!navigateur) {
    console.error("Il faut --navigateur <chemin d'un Chrome ou Chromium local> (rien n'est téléchargé).");
    return 1;
  }
  mkdirSync(sortie, { recursive: true });
  const tmp = mkdtempSync(join(tmpdir(), "planche-apparition-"));
  try {
    for (const fond of ["ivoire", "noir"] as const) {
      const html = join(tmp, `apparition-${fond}.html`);
      writeFileSync(html, pageHtml(fond, POLICE));
      const png = join(sortie, `apparition-${fond}.png`);
      const r = spawnSync(navigateur, [...argumentsNavigateur(html, png), "--no-sandbox"], { stdio: "inherit" });
      if (r.status !== 0) return r.status ?? 1;
      console.log(png);
    }
    return 0;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
