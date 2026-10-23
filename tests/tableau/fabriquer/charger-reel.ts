/**
 * Lancé par `chemin-reel.test.ts` dans un VRAI processus `tsx --conditions=react-server` (comme le lanceur) : charge
 * le chemin `--reel` jusqu'aux imports (services du studio, `credits` → `auth` → `next/*`), sans rien appeler.
 */
import { chargerCheminReel } from "../../../scripts/tableau/fabriquer";

chargerCheminReel()
  .then((noms) => {
    console.log(`CHARGE ${noms.join(",")}`);
  })
  .catch((e: unknown) => {
    console.error(`ECHEC ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
