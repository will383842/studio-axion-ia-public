/**
 * TÉMOIN DES PETITS OBJETS (C9-41-a-v19c). Lancé à la main, jamais en CI ; aucun générateur n'importe ce fichier ; rien n'est allumé.
 * Usage (racine) : `pnpm exec tsx outils/temoin-objets-plan/lancer.mts [dossier]` (défaut : dossier temporaire du système).
 * Écrit `temoin-objets.html` (3 textes fixes, plan sans / avec objets). Règles fixes : 0 €.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

// `server-only` (tiré par le générateur de plan) refuse de se charger hors serveur Next : on le neutralise dans CE processus seulement.
const exiger = createRequire(import.meta.url);
const serveur = exiger.resolve("server-only");
exiger.cache[serveur] = { id: serveur, filename: serveur, loaded: true, exports: {} } as unknown as NodeJS.Module;
const { pageTemoin, temoinObjets } = await import("./temoin");

const SORTIE = resolve(process.argv[2] ?? join(tmpdir(), "temoin-objets-plan"));
mkdirSync(SORTIE, { recursive: true });
const fichier = join(SORTIE, "temoin-objets.html");
writeFileSync(fichier, pageTemoin(await temoinObjets()));
console.log(fichier);
