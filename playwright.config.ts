import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours principaux (B.9), mobile ET bureau, sur le serveur de production local.
 * Prérequis : `pnpm build`. Le mot de passe est lu dans E2E_MDP (jamais écrit dans un fichier).
 */
// E2E_PORT : pointer une autre instance (ex. 3200) sans toucher au serveur déjà lancé sur 3100.
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // iPhone 13 (taille, tactile, agent) dans Chromium : WebKit refuse le cookie « Secure » de la
    // session sur http://localhost (en ligne, le site est en https).
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "bureau", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    // Serveur construit SANS base pour les essais : sans ce drapeau, il refuse de démarrer (E2E-2 données n° 7).
    env: { STUDIO_SANS_BASE: "1" },
    url: `http://localhost:${PORT}/api/sante`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
