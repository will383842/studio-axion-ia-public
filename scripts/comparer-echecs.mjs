#!/usr/bin/env node
// Compare un rapport vitest (--reporter=json) à scripts/echecs-connus.json.
// Rouge (code 1) si un échec n'est pas dans la liste, ou si aucun test n'a été lancé.
// Usage : node scripts/comparer-echecs.mjs <rapport.json> [echecs-connus.json]
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const relatif = (chemin) => {
  const p = String(chemin).replaceAll("\\", "/");
  const i = p.search(/(^|\/)(tests|src)\//);
  return i < 0 ? p : p.slice(p[i] === "/" ? i + 1 : i);
};

function verifierRapport(rapportVitest) {
  if (!rapportVitest || !Array.isArray(rapportVitest.testResults)) {
    throw new Error("rapport vitest illisible (testResults absent)");
  }
}

export function extraireEchecs(rapportVitest) {
  verifierRapport(rapportVitest);
  const echecs = [];
  for (const f of rapportVitest.testResults) {
    const fichier = relatif(f.name);
    const cas = Array.isArray(f.assertionResults) ? f.assertionResults : [];
    const rates = cas.filter((c) => c.status === "failed");
    for (const c of rates) echecs.push({ fichier, nom: c.fullName ?? c.title ?? "(sans nom)" });
    if (f.status === "failed" && cas.length === 0) echecs.push({ fichier, nom: "(fichier)" });
  }
  return echecs;
}

export function compterLances(rapportVitest) {
  verifierRapport(rapportVitest);
  return rapportVitest.testResults.reduce(
    (n, f) => n + (Array.isArray(f.assertionResults) ? f.assertionResults.length : 0),
    0,
  );
}

export function comparer(rapportVitest, connus) {
  if (!connus || !Array.isArray(connus.echecs)) throw new Error("echecs-connus.json illisible (echecs absent)");
  const echecs = extraireEchecs(rapportVitest);
  const cle = (e) => `${e.fichier}\u0000${e.nom}`;
  const listeConnue = new Set(connus.echecs.map(cle));
  const vus = new Set(echecs.map(cle));
  const lances = compterLances(rapportVitest);
  const nouveaux = echecs.filter((e) => !listeConnue.has(cle(e)));
  const connusVus = echecs.filter((e) => listeConnue.has(cle(e)));
  // « corrigé » seulement si le fichier a tourné et que le cas est passé : un fichier non lancé n'est pas jugé.
  const fichiersLances = new Set(rapportVitest.testResults.map((f) => relatif(f.name)));
  const corriges = connus.echecs.filter((e) => fichiersLances.has(e.fichier) && !vus.has(cle(e)));
  return { ok: nouveaux.length === 0 && lances > 0, lances, nouveaux, connus: connusVus, corriges };
}

export function rapport(res) {
  const l = [`${res.lances} tests lancés`];
  if (res.lances === 0) l.push("ROUGE : aucun test lancé.");
  for (const e of res.nouveaux) l.push(`ROUGE : échec absent de echecs-connus.json : ${e.fichier} › ${e.nom}`);
  for (const e of res.connus) l.push(`connu : ${e.fichier} › ${e.nom}`);
  for (const e of res.corriges) l.push(`corrigé (à retirer de la liste) : ${e.fichier} › ${e.nom}`);
  l.push(res.ok ? "VERT" : "ROUGE");
  return l.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , chemRapport, chemConnus = "scripts/echecs-connus.json"] = process.argv;
  if (!chemRapport) {
    console.error("Usage : node scripts/comparer-echecs.mjs <rapport.json> [echecs-connus.json]");
    process.exit(2);
  }
  try {
    const res = comparer(JSON.parse(readFileSync(chemRapport, "utf8")), JSON.parse(readFileSync(chemConnus, "utf8")));
    console.log(rapport(res));
    process.exit(res.ok ? 0 : 1);
  } catch (e) {
    console.error(`ROUGE : ${e.message}`);
    process.exit(1);
  }
}
