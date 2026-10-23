/**
 * Écrit `mots-demo/<id>.json` (mots de démonstration horodatés, standard § I.1) et `controle-lot5.json` (mesures de rythme) dans le dossier donné.
 * Usage : `npx tsx ecrire-donnees-lot5.ts <dossier-sortie>`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { planEnchainement, planExtrait } from "./plan-lot5";
import { controler } from "./controle-lot5";

const sortie = resolve(process.argv[2] ?? ".");
mkdirSync(resolve(sortie, "mots-demo"), { recursive: true });
const ids = ["dalle-claquee", "rafale-trois-mots", "duel-video", "mot-derriere", "element-barre", "element-barre-pictos", "appel-final-pile", "panneau-fin"];
const plans = [...ids.map(planExtrait), planEnchainement()];
const mesures: unknown[] = [];
for (const p of plans) {
  const json = p.mots.map((m) => ({ mot: m.mot.toUpperCase(), debut: m.debut, fin: m.fin, fort: !!m.fort || !!m.chiffre }));
  writeFileSync(resolve(sortie, "mots-demo", `${p.id === "enchainement" ? "lot5-enchainement-15s" : p.id}.json`), JSON.stringify(json, null, 1));
  mesures.push(controler(p));
}
writeFileSync(resolve(sortie, "controle-lot5.json"), JSON.stringify(mesures, null, 1));
console.log("ok", plans.length, "plans");
