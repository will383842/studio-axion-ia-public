/**
 * Vérifie un paquet de session (carrousel) sans réseau ni coût : lecture stricte, puis porte qualité.
 * Usage : npx tsx scripts/visuels/verifier-paquet.ts <fichier.json>
 * Code de sortie : 0 si le verdict n'est pas rouge, 1 sinon (paquet illisible compris).
 */
import { readFileSync } from "node:fs";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import { interditsTousEcrivains } from "../../src/domaine/qualite-script/regles/interdits.js";
import { lirePaquetSession } from "../../src/visuels/texte/session.js";

const chemin = process.argv[2];
if (!chemin) {
  console.log("Usage : npx tsx scripts/visuels/verifier-paquet.ts <fichier.json>");
  process.exit(1);
}

let contenu: string;
try {
  contenu = readFileSync(chemin, "utf8");
} catch {
  console.log(`Le fichier « ${chemin} » est introuvable ou illisible.`);
  process.exit(1);
}

let paquet: ReturnType<typeof lirePaquetSession>;
try {
  paquet = lirePaquetSession(contenu);
} catch (e) {
  console.log(`Paquet refusé : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const { rapport } = controlerCarrousel(paquet.spec, { faitsDisponibles: false, interditsDans: interditsTousEcrivains });
const libelle = { vert: "VERT (rien à signaler)", orange: "ORANGE (à relire)", rouge: "ROUGE (à corriger)" }[rapport.verdict];
const pages = (paquet.spec as { pages: unknown[] }).pages.length;
console.log(`Paquet : « ${paquet.titre} » (${pages} pages)`);
console.log(`Verdict : ${libelle}`);
for (const c of rapport.controles) console.log(`- [${c.niveau}] ${c.phrase}`);
for (const c of rapport.corrections) console.log(`- Correction de typographie proposée : ${c}`);
if (rapport.controles.length === 0) console.log("Aucun contrôle en défaut.");
process.exit(rapport.verdict === "rouge" ? 1 : 0);
