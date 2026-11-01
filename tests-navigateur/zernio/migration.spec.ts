/**
 * NAV · parcours navigateur de l'écran Migration (Réglages › Migration), en SIMULATION : serveur de développement,
 * faux Zernio, données fictives, aucun réseau sortant (voir tests-navigateur/aides). Bureau 1440 px et téléphone 390 px.
 * Rien ici n'écrit chez Zernio ni chez Buffer : l'écran n'a que des lectures, et c'est ce que ces essais vérifient.
 */
import { expect, test, type Page } from "@playwright/test";
import { animationsEnCours, atteindreAuClavier, ciblesTropPetites, focusVisible, motsAnglais, motsInterditsVisibles, textesTropPetits, tutoiement } from "../aides/controles";
import { appelsFaux, ecrireMigration, regler, seConnecter, viderAppels } from "../aides/demarrage";
import { ETAT_A_FAIRE, ETAT_ECART, ETAT_LENT, ETAT_NORMAL, ETAT_PANNE } from "../aides/donnees-migration";

const SCHEMAS = ["clair", "sombre"] as const;

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
  await expect(page.getByRole("heading", { name: "Migration", level: 1 })).toBeVisible();
}

for (const schema of SCHEMAS) {
  test.describe(`Migration · ${schema}`, () => {
    test(`état « pas commencé » : message clair et chemin vers les connexions (${schema})`, async ({ page }) => {
      await ouvrir(page, schema);
      await expect(page.getByRole("heading", { name: "La bascule n’a pas commencé" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voir les connexions" })).toHaveAttribute("href", "/reglages");
      await expect(page.getByText("Rien n’est retiré de Buffer sans votre ordre.")).toBeVisible();
    });

    test(`état normal : avancement, lots, comptes, critères et reprogrammation (${schema})`, async ({ page }) => {
      ecrireMigration(ETAT_NORMAL);
      await ouvrir(page, schema);
      await expect(page.getByRole("heading", { name: "Avancement" })).toBeVisible();
      await expect(page.getByText(/\d+ sur 8 posts en règle/)).toBeVisible();
      // Les trois lots, avec leur état.
      for (const lot of ["Lot A · Instagram et Facebook", "Lot B · LinkedIn", "Lot C · tous réseaux"]) await expect(page.getByRole("heading", { name: lot })).toBeVisible();
      await expect(page.getByText("Total vérifié :")).toBeVisible();
      // « Confirmer les comptes » : les 6 comptes sont lisibles dans le tableau des critères, aucun n'est coché d'office.
      const lignes = page.locator("table tbody tr");
      await expect(lignes).toHaveCount(6);
      await expect(page.getByText(/Critères remplis : \d+ comptes? sur 6\./)).toBeVisible();
      // Liste « À reprogrammer » : le post à date passée, jamais publié seul.
      await expect(page.getByRole("heading", { name: /À reprogrammer par vous · 1/ })).toBeVisible();
      await expect(page.getByText(/Exemple post passé/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Critères pour résilier Buffer" })).toBeVisible();
    });

    test(`état « en cours » et « à faire » des lots (${schema})`, async ({ page }) => {
      ecrireMigration(ETAT_NORMAL);
      await ouvrir(page, schema);
      await expect(page.locator("article", { hasText: "Lot A · Instagram et Facebook" }).getByText("En cours")).toBeVisible();
      await expect(page.locator("article", { hasText: "Lot B · LinkedIn" }).getByText("Terminé")).toBeVisible();
      await expect(page.locator("article", { hasText: "Lot C · tous réseaux" }).getByText("À faire")).toBeVisible();
      ecrireMigration(ETAT_A_FAIRE);
      await page.reload();
      await expect(page.locator("article", { hasText: "Lot A · Instagram et Facebook" }).getByText("À faire")).toBeVisible();
    });

    test(`écart de rapprochement : l'écran le dit en toutes lettres (${schema})`, async ({ page }) => {
      ecrireMigration(ETAT_ECART);
      await ouvrir(page, schema);
      await expect(page.getByRole("alert").filter({ hasText: /Écart de 1 post/ })).toBeVisible();
      await expect(page.getByText("Aucun doublon.")).toHaveCount(0);
    });

    test(`Buffer ou données illisibles : message simple, pas de plantage (${schema})`, async ({ page }) => {
      ecrireMigration(ETAT_PANNE);
      await ouvrir(page, schema);
      await expect(page.getByRole("alert").filter({ hasText: "Lecture impossible. Réessayez plus tard." })).toBeVisible();
      await expect(page.getByText(/Error|Exception|Traceback/)).toHaveCount(0);
    });
  });
}

test("état de chargement : un squelette annoncé s'affiche pendant la lecture lente", async ({ page }) => {
  ecrireMigration(ETAT_LENT);
  await page.goto("/reglages/migration", { waitUntil: "commit" });
  await expect(page.getByRole("status", { name: "Chargement" }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Avancement" })).toBeVisible({ timeout: 30_000 });
});

test("écritures INACTIVES : créer les brouillons, retirer de Buffer et programmer — la raison est affichée, rien ne part", async ({ page }) => {
  ecrireMigration(ETAT_NORMAL);
  const ecritures: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method()) && u.hostname === "localhost") ecritures.push(`${r.method()} ${u.pathname}`);
  });
  await ouvrir(page);
  await page.getByRole("button", { name: /^Vérifier le lot A/ }).click();
  const fenetre = page.getByRole("dialog");
  await expect(fenetre).toBeVisible();
  const retirer = fenetre.getByRole("button", { name: "Retirer de Buffer et programmer" });
  await expect(retirer).toBeDisabled();
  await expect(fenetre.getByText("Disponible après l’import des brouillons").first()).toBeVisible();
  // « C’est juste » est inactif tant que la comparaison n'existe pas : on ne peut rien valider à l'aveugle.
  for (const bouton of await fenetre.getByRole("button", { name: /C’est juste|Vérifié/ }).all()) await expect(bouton).toBeDisabled();
  // Aucun bouton de suppression chez Buffer, nulle part sur l'écran.
  await expect(page.getByRole("button", { name: /supprimer|effacer|détruire/i })).toHaveCount(0);
  // Cliquer de force sur le bouton inactif n'envoie rien.
  await retirer.click({ force: true, trial: true }).catch(() => undefined);
  await expect(fenetre.getByRole("alertdialog")).toHaveCount(0);
  expect(ecritures).toEqual([]);
  expect((await appelsFaux()).filter((a) => a.ecriture)).toEqual([]);
});

test("liste « À reprogrammer » : le bouton « Choisir une date » est présent par post à date passée", async ({ page }) => {
  ecrireMigration(ETAT_NORMAL);
  await ouvrir(page);
  const section = page.locator("section", { has: page.getByRole("heading", { name: /À reprogrammer par vous/ }) });
  await expect(section.getByRole("button", { name: "Choisir une date" })).toHaveCount(1);
  await expect(section.getByText("nous ne les publions jamais seuls")).toBeVisible();
});

test("clavier seul : Tab atteint « Vérifier le lot », Entrée ouvre la fenêtre, Échap la ferme, le focus se voit", async ({ page }) => {
  ecrireMigration(ETAT_NORMAL);
  await ouvrir(page);
  expect(await atteindreAuClavier(page, /Vérifier le lot A/)).toBe(true);
  const f = await focusVisible(page);
  expect(f.ok, `focus invisible sur ${f.description}`).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

for (const schema of SCHEMAS) {
  test(`exigences transversales (${schema}) : mots, tutoiement, mots interdits, mouvement réduit`, async ({ page }) => {
    ecrireMigration(ETAT_NORMAL);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ouvrir(page, schema);
    expect(await motsAnglais(page), "mots anglais visibles").toEqual([]);
    expect(await tutoiement(page), "tutoiement visible").toEqual([]);
    expect(await motsInterditsVisibles(page), "mots interdits visibles").toEqual([]);
    await page.waitForTimeout(400);
    expect(await animationsEnCours(page), "animations encore en cours en mouvement réduit").toEqual([]);
    await expect(page.getByText(/vous|votre|vos/i).first()).toBeVisible();
  });

  test(`cibles de 48 px et textes de 16 px minimum (${schema})`, async ({ page }) => {
    ecrireMigration(ETAT_NORMAL);
    await ouvrir(page, schema);
    const main = page.locator("main").first();
    expect(await ciblesTropPetites(main), "cibles plus petites que 48 px").toEqual([]);
    expect(await textesTropPetits(main), "textes plus petits que 16 px").toEqual([]);
  });
}
