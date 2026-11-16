#!/usr/bin/env node
// Lecture seule, aucun réseau : reconnaît la licence d'un fichier LICENSE local.
// Usage : node outils/licences/verifier-licence.mjs <fichier>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MOTIFS = [
  ["Apache-2.0", /apache license[\s,]*version 2\.0/i],
  ["MIT", /permission is hereby granted, free of charge/i],
  ["ISC", /permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i],
  ["CC0-1.0", /cc0 1\.0 universal|creative commons zero/i],
  ["Unlicense", /this is free and unencumbered software released into the public domain/i],
  ["OFL-1.1", /sil open font license,? version 1\.1/i],
];
// Marqueurs de crédit ou de copyleft. Pas de « attribution » seul : le texte Apache-2.0 contient « attribution notices ».
const REFUS = /\bCC[ -]?BY\b|creative commons attribution|attribution(-| )(sharealike|noncommercial|noderivs)|sharealike|noncommercial|noderiv|gnu (general|lesser|affero) public|mozilla public/i;

export function reconnaitre(texte) {
  // Un marqueur de crédit ou de copyleft refuse d'office (licence mixte comprise).
  if (REFUS.test(texte)) return null;
  const trouvees = MOTIFS.filter(([, re]) => re.test(texte)).map(([nom]) => nom);
  // Licence multiple : validation humaine, donc refus.
  return trouvees.length === 1 ? trouvees[0] : null;
}

const fichier = process.argv[2];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!fichier) { console.error("Usage : verifier-licence.mjs <fichier LICENSE>"); process.exit(2); }
  let texte;
  try { texte = readFileSync(fichier, "utf8"); } catch (e) { console.error(`REFUS : lecture impossible (${e.message})`); process.exit(2); }
  const nom = reconnaitre(texte);
  if (nom) { console.log(`ADMIS : ${nom}`); process.exit(0); }
  console.log(`REFUS : licence non reconnue${REFUS.test(texte) ? " (exige crédit ou copyleft)" : ""}`);
  process.exit(1);
}
