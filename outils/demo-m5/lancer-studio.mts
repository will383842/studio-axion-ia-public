/**
 * Lance le studio EN LOCAL pour les captures du lot A2 : banques réelles (Pexels, Pixabay : gratuites), moteur
 * avocat, AUCUNE clé fal.ai (rien ne peut être payé depuis ce serveur). Les clés passent par l'environnement du
 * processus, jamais par la ligne de commande. Usage : `pnpm exec tsx outils/demo-m5/lancer-studio.mts [port]`
 */
import { spawn } from "node:child_process";
import { chargerCles } from "./cles.ts";

chargerCles(["PEXELS_API_KEY", "PIXABAY_API_KEY"]);
const port = process.argv[2] ?? "3172";
const enfant = spawn("pnpm", ["exec", "next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FOURNISSEUR_ILLUSTRATION: "reel", MOTEUR_AVOCAT: "montage-avocat", NEXT_DIST_DIR: ".next-a2", FAL_KEY: "" },
});
enfant.on("exit", (code) => process.exit(code ?? 0));
