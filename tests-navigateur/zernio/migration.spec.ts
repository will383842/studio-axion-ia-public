/**
 * NAV · /reglages/migration après BF-02 : l'écran de migration n'est plus affiché, l'adresse renvoie vers les Réglages.
 * SIMULATION : serveur de développement, faux Zernio, données fictives, aucun réseau sortant (voir tests-navigateur/aides).
 * Bureau 1440 px et téléphone 390 px. Rien ici n'écrit chez Zernio ni chez l'ancien outil : on ne fait que lire.
 * Les états de l'écran lui-même (lots, écart, erreur, chargement, boutons inactifs, clavier) restent vérifiés en rendu
 * direct du composant par tests/zernio/z3m-migration.test.tsx et tests/migration/buffer-resilie.test.tsx.
 */
import { expect, test, type Page } from "@playwright/test";
import { motsInterditsVisibles, tutoiement } from "../aides/controles";
import { appelsFaux, ecrireMigration, regler, seConnecter, viderAppels } from "../aides/demarrage";
import { ETAT_A_FAIRE, ETAT_ECART, ETAT_LENT, ETAT_NORMAL, ETAT_PANNE } from "../aides/donnees-migration";

const SCHEMAS = ["clair", "sombre"] as const;
const ETATS = { vide: null, normal: ETAT_NORMAL, "à faire": ETAT_A_FAIRE, écart: ETAT_ECART, panne: ETAT_PANNE, lent: ETAT_LENT } as const;

test.beforeEach(async ({ page }) => {
  await regler("normal");
  await viderAppels();
  ecrireMigration(null);
  await seConnecter(page);
});
test.afterAll(() => ecrireMigration(null));

async function ouvrir(page: Page, schema: (typeof SCHEMAS)[number] = "sombre") {
  await page.emulateMedia({ colorScheme: schema === "clair" ? "light" : "dark" });
  await page.goto("/reglages/migration");
  await page.waitForURL((u) => u.pathname === "/reglages", { timeout: 30_000 });
}

async function verifierEcranRetire(page: Page) {
  await expect(page.getByRole("heading", { name: "Migration", level: 1 })).toHaveCount(0);
  for (const titre of ["Avancement", "Bascule réseau par réseau", "La bascule n’a pas commencé"]) await expect(page.getByRole("heading", { name: titre })).toHaveCount(0);
  const corps = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  expect(corps, "date de fin de l'ancien outil visible").not.toMatch(/18\/11|20\/11|18 novembre|20 novembre/);
  expect(corps, "mot interdit visible").not.toMatch(/Buffer/);
}

for (const schema of SCHEMAS) {
  for (const [nom, etat] of Object.entries(ETATS)) {
    test(`état « ${nom} » : /reglages/migration renvoie vers les Réglages, sans écran de migration (${schema})`, async ({ page }) => {
      ecrireMigration(etat);
      await ouvrir(page, schema);
      expect(new URL(page.url()).pathname).toBe("/reglages");
      await verifierEcranRetire(page);
      await expect(page.getByText(/Error|Exception|Traceback/)).toHaveCount(0);
    });
  }

  test(`exigences transversales sur la page d'arrivée (${schema}) : tutoiement et mots interdits`, async ({ page }) => {
    ecrireMigration(ETAT_NORMAL);
    await ouvrir(page, schema);
    expect(await tutoiement(page), "tutoiement visible").toEqual([]);
    expect(await motsInterditsVisibles(page), "mots interdits visibles").toEqual([]);
  });
}

test("écritures INACTIVES : aller sur l'ancienne adresse n'envoie aucune écriture, nulle part", async ({ page }) => {
  ecrireMigration(ETAT_NORMAL);
  const ecritures: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method()) && u.hostname === "localhost") ecritures.push(`${r.method()} ${u.pathname}`);
  });
  await ouvrir(page);
  await verifierEcranRetire(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /supprimer|effacer|détruire|Retirer de/i })).toHaveCount(0);
  expect(ecritures).toEqual([]);
  expect((await appelsFaux()).filter((a) => a.ecriture)).toEqual([]);
});
