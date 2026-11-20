/**
 * PLANCHE D'ATTENTE (C10-07-PLANCHE-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-fond-clair/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit une page HTML (fond-clair.html) à ouvrir dans un navigateur.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlancheFondClair } from "./PlancheFondClair";

const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-fond-clair"));
mkdirSync(SORTIE, { recursive: true });

const corps = renderToStaticMarkup(React.createElement(PlancheFondClair));
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche fond clair</title><style>body{margin:0}</style></head><body>${corps}</body></html>`;
const sortie = join(SORTIE, "fond-clair.html");
writeFileSync(sortie, page);
console.log(sortie);
