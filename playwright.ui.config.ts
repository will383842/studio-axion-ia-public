import { defineConfig, devices } from "@playwright/test";

/**
 * VÉRIF V3 — INTERFACE : parcours de l'interface en SIMULATION (base en mémoire, fournisseurs simulés, aucun appel réel),
 * mobile 390 px ET bureau 1440 px. Prérequis : `pnpm build`. Mot de passe d'essai lu dans E2E_MDP (jamais écrit).
 * Lancer : `E2E_MDP=… pnpm test:e2e-ui` (serveur démarré tout seul avec STUDIO_SANS_BASE=1, sans veille des outils).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e-ui",
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
    // Chromium préinstallé (conteneurs de vérification) ; sinon celui de Playwright.
    launchOptions: process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 }, defaultBrowserType: "chromium" } },
    { name: "bureau", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    env: { STUDIO_SANS_BASE: "1", STUDIO_VEILLE: "0" },
    url: `http://localhost:${PORT}/api/sante`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
