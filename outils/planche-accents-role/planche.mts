/**
 * PLANCHE D'ATTENTE (C11-T12-PLANCHE-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/planche-accents-role/planche.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit `accents-role.html`, à ouvrir dans un navigateur.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlancheAccentsRole } from "./PlancheAccentsRole";

const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "planche-accents-role"));
mkdirSync(SORTIE, { recursive: true });
const corps = renderToStaticMarkup(React.createElement(PlancheAccentsRole));
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Planche accents par rôle</title><style>body{margin:0}</style></head><body>${corps}</body></html>`;
const sortie = join(SORTIE, "accents-role.html");
writeFileSync(sortie, page);
console.log(sortie);
