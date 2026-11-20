/**
 * Écrit `scripts/visuels/consigne-session-toile.md` depuis les registres de la toile continue (sans réseau ni coût).
 * Usage : npx tsx scripts/visuels/ecrire-consigne-toile.ts
 */
import { writeFileSync } from "node:fs";
import { genererConsigneToile } from "../../src/visuels/continu/texte/consigne-toile.js";

const chemin = new URL("./consigne-session-toile.md", import.meta.url);
writeFileSync(chemin, genererConsigneToile());
console.log("Consigne écrite : scripts/visuels/consigne-session-toile.md");
