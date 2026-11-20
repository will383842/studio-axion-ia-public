/**
 * PLANCHE D'ATTENTE (C11-T2-PLANCHE-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-selectif/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit deux pages HTML (selectif-ivoire.html, selectif-noir.html) à ouvrir dans un navigateur.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlancheSelectif } from "./PlancheSelectif";

const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-selectif"));
mkdirSync(SORTIE, { recursive: true });

for (const fond of ["ivoire", "noir"] as const) {
  const corps = renderToStaticMarkup(React.createElement(PlancheSelectif, { fond }));
  const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche sélectif ${fond}</title><style>body{margin:0}</style></head><body>${corps}</body></html>`;
  const sortie = join(SORTIE, `selectif-${fond}.html`);
  writeFileSync(sortie, page);
  console.log(sortie);
}
