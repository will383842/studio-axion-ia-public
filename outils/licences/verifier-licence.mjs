#!/usr/bin/env node
// Lecture seule, aucun réseau : reconnaît la licence d'un fichier LICENSE local.
// Usage : node outils/licences/verifier-licence.mjs <fichier>
import { readFileSync } from "node:fs";

const MOTIFS = [
  ["Apache-2.0", /apache license[\s,]*version 2\.0/i],
  ["MIT", /permission is hereby granted, free of charge/i],
  ["ISC", /permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i],
  ["CC0-1.0", /cc0 1\.0 universal|creative commons zero/i],
  ["Unlicense", /this is free and unencumbered software released into the public domain/i],
  ["OFL-1.1", /sil open font license,? version 1\.1/i],
];
const REFUS = /attribution|sharealike|noncommercial|noderivative|gnu (general|lesser) public|mozilla public|creative commons/i;

export function reconnaitre(texte) {
  for (const [nom, re] of MOTIFS) if (re.test(texte)) return nom;
  return null;
}

const fichier = process.argv[2];
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!fichier) { console.error("Usage : verifier-licence.mjs <fichier LICENSE>"); process.exit(2); }
  let texte;
  try { texte = readFileSync(fichier, "utf8"); } catch (e) { console.error(`REFUS : lecture impossible (${e.message})`); process.exit(2); }
  const nom = reconnaitre(texte);
  if (nom) { console.log(`ADMIS : ${nom}`); process.exit(0); }
  console.log(`REFUS : licence non reconnue${REFUS.test(texte) ? " (exige crédit ou copyleft)" : ""}`);
  process.exit(1);
}
