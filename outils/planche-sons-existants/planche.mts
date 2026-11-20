/**
 * PLANCHE D'ÉCOUTE (SONS-PLANCHE-ECOUTE-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier.
 * Usage (racine) : `pnpm exec tsx outils/planche-sons-existants/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit deux pages HTML (ivoire, noir) ; les lecteurs pointent vers les sons du dépôt. Aucun fichier audio n'est copié ni écrit.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlancheSonsExistants } from "./PlancheSonsExistants";

const DEPOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const RACINE = pathToFileURL(DEPOT).href.replace(/\/$/, "");
const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-sons-existants"));
mkdirSync(SORTIE, { recursive: true });

for (const fond of ["ivoire", "noir"] as const) {
  const corps = renderToStaticMarkup(React.createElement(PlancheSonsExistants, { racine: RACINE, fond }));
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Sons existants ${fond}</title><style>body{margin:0}</style></head><body>${corps}</body></html>`;
  const sortie = join(SORTIE, `sons-existants-${fond}.html`);
  writeFileSync(sortie, page);
  console.log(sortie);
}
