/**
 * PLANCHE D'ATTENTE (BR-POIDS-PLANCHE-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-poids-variable/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit deux pages HTML (ivoire, noir) à ouvrir dans un navigateur. Ne copie aucun fichier, n'appelle rien.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanchePoidsVariable } from "./PlanchePoidsVariable";

const FAMILLE = "Axion Manrope Variable";
const POLICE = pathToFileURL(resolve("src/briques/sous-titres/polices/Manrope-Variable.ttf")).href;
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-poids-variable"));
mkdirSync(SORTIE, { recursive: true });

for (const fond of ["ivoire", "noir"] as const) {
  const corps = renderToStaticMarkup(React.createElement(PlanchePoidsVariable, { fond, famille: `"${FAMILLE}"` }));
  const police = `@font-face{font-family:"${FAMILLE}";src:url("${POLICE}");font-weight:200 800;}`;
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche poids variable ${fond}</title><style>${police}body{margin:0}</style></head><body>${corps}</body></html>`;
  const sortie = join(SORTIE, `poids-variable-${fond}.html`);
  writeFileSync(sortie, page);
  console.log(sortie);
}
