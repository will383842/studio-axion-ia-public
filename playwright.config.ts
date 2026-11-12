import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashSync } from "@node-rs/argon2";
import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours principaux (B.9), mobile ET bureau, sur le serveur de production local.
 * Prérequis : `pnpm build`. Le mot de passe est lu dans E2E_MDP (jamais écrit dans un fichier).
 *
 * NAV (parcours navigateur Zernio, niveau b) : lancé à la main par la routine, JAMAIS en CI.
 * `pnpm exec playwright test tests-navigateur/zernio --project=bureau --project=telephone`
 * Serveur de développement en SIMULATION + faux Zernio local, tout réseau sortant bloqué (tests-navigateur/aides).
 */
// E2E_PORT : pointer une autre instance (ex. 3200) sans toucher au serveur déjà lancé sur 3100.
const PORT = Number(process.env.E2E_PORT ?? 3100);

// Les ouvriers n'ont pas les mêmes arguments : le processus principal laisse un drapeau dans l'environnement.
const NAV = process.env.NAV_ACTIF === "1" || process.argv.some((a) => a.replace(/\\/g, "/").includes("tests-navigateur"));
if (NAV) process.env.NAV_ACTIF = "1";
const PORT_NAV = Number(process.env.NAV_PORT ?? 3411);
const PORT_FAUX = Number(process.env.NAV_FAUX_ZERNIO_PORT ?? 3921);
// Dossier et mot de passe d'essai FABRIQUÉS une fois (le processus principal les transmet aux ouvriers) : rien n'est écrit dans le dépôt.
if (NAV) {
  process.env.NAV_DOSSIER ??= mkdtempSync(join(tmpdir(), "nav-zernio-"));
  process.env.NAV_MDP ??= `essai-${randomBytes(9).toString("hex")}`;
}

/** Faux Zernio puis serveur de développement en simulation (aucune clé réelle ; le préchargement bloque le réseau sortant). */
function navServeurs() {
  const dossier = process.env.NAV_DOSSIER ?? "";
  const env = {
    STUDIO_SANS_BASE: "1",
    STUDIO_VEILLE: "0",
    STUDIO_PASSWORD_HASH_B64: Buffer.from(hashSync(process.env.NAV_MDP ?? "")).toString("base64"),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    NEXT_TELEMETRY_DISABLED: "1",
    NAV_FAUX_ZERNIO_PORT: String(PORT_FAUX),
    NAV_ETAT_MIGRATION: `${dossier}/migration.json`,
    ZERNIO_API_KEY: "exemple-cle-fictive-ne-pas-utiliser-0001",
    NODE_OPTIONS: `--require ${process.cwd()}/tests-navigateur/aides/precharge.cjs`,
  };
  return [
    { command: "pnpm exec tsx tests-navigateur/aides/faux-zernio-serveur.ts", env: { NAV_FAUX_ZERNIO_PORT: String(PORT_FAUX) }, url: `http://127.0.0.1:${PORT_FAUX}/__sante`, reuseExistingServer: true, timeout: 60_000 },
    { command: `pnpm exec next dev -p ${PORT_NAV}`, env, url: `http://localhost:${PORT_NAV}/api/sante`, reuseExistingServer: false, timeout: 240_000 },
  ];
}

export default defineConfig({
  testDir: NAV ? "tests-navigateur" : "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${NAV ? PORT_NAV : PORT}`,
    locale: "fr-FR",
    colorScheme: "dark",
    trace: "retain-on-failure",
    // NAV : aucune capture dans le dépôt public (elles vont au dépôt privé, voir docs/zernio/NAV-CAPTURES.md).
    screenshot: NAV ? "off" : "only-on-failure",
  },
  projects: [
    // iPhone 13 (taille, tactile, agent) dans Chromium : WebKit refuse le cookie « Secure » de la
    // session sur http://localhost (en ligne, le site est en https).
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "bureau", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // NAV : téléphone 390 px (Chromium, tactile) ; clair et sombre sont choisis dans chaque parcours.
    { name: "telephone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", viewport: { width: 390, height: 844 } } },
  ],
  webServer: NAV
    ? navServeurs()
    : {
        command: `pnpm start -p ${PORT}`,
        // Serveur construit SANS base pour les essais : sans ce drapeau, il refuse de démarrer (E2E-2 données n° 7).
        env: { STUDIO_SANS_BASE: "1" },
        url: `http://localhost:${PORT}/api/sante`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
