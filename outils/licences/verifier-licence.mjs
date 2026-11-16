#!/usr/bin/env node
// Lecture seule, aucun réseau : reconnaît la licence d'un fichier LICENSE local.
// Usage : node outils/licences/verifier-licence.mjs <fichier>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Chaque espace est un \s+ : un LICENSE réel est souvent coupé à 72 colonnes.
const MOTIFS = [
  ["Apache-2.0", /apache\s+license[\s,]*version\s+2\.0/i],
  // « of this software » : le texte OFL dit « of the Font Software » et ne doit pas compter comme MIT.
  ["MIT", /permission\s+is\s+hereby\s+granted,\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy\s+of\s+this\s+software/i],
  ["ISC", /permission\s+to\s+use,\s+copy,\s+modify,\s+and\/or\s+distribute\s+this\s+software\s+for\s+any\s+purpose\s+with\s+or\s+without\s+fee/i],
  ["CC0-1.0", /cc0\s+1\.0\s+universal|creative\s+commons\s+zero/i],
  ["Unlicense", /this\s+is\s+free\s+and\s+unencumbered\s+software\s+released\s+into\s+the\s+public\s+domain/i],
  ["OFL-1.1", /sil\s+open\s+font\s+license,?\s+version\s+1\.1/i],
];
// Marqueurs de crédit ou de copyleft. Pas de « attribution » seul : le texte Apache-2.0 contient « attribution notices ».
const REFUS = /\bCC[\s-]?BY\b|creative\s+commons\s+attribution|attribution[-\s](sharealike|noncommercial|noderivs)|sharealike|noncommercial|noderiv|gnu\s+(general|lesser|affero)\s+public|mozilla\s+public/i;

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
