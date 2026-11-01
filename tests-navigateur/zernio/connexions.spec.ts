/**
 * NAV · parcours navigateur de l'écran Connexions Zernio (Z3-C), en SIMULATION : serveur de développement, faux Zernio
 * local, comptes fictifs, aucune clé réelle, aucun réseau sortant (voir tests-navigateur/aides).
 * Bureau 1440 px et téléphone 390 px, clair et sombre.
 *
 * ATTENTION — l'écran n'est monté sur aucune page du Studio à ce jour (« à brancher par Z3-E/NAV », voir
 * src/components/reglages/Connexions.tsx). Tant qu'il ne l'est pas, le premier essai le dit (défaut D1 de
 * docs/zernio/NAV-DEFAUTS.md) et les autres sont marqués « fixme » avec cette raison : ils se lancent seuls dès le branchement.
 * L'adresse de l'écran se règle par NAV_URL_CONNEXIONS (par défaut /reglages).
 */
import { expect, test, type Page } from "@playwright/test";
import { animationsEnCours, atteindreAuClavier, focusVisible, motsAnglais, motsInterditsVisibles, tutoiement } from "../aides/controles";
import { appelsFaux, ecrireMigration, regler, seConnecter, viderAppels } from "../aides/demarrage";
import { ETAT_NORMAL } from "../aides/donnees-migration";

const URL_ECRAN = process.env.NAV_URL_CONNEXIONS ?? "/reglages";
const ECRAN = '[data-ecran="connexions-zernio"]';
const SCHEMAS = ["clair", "sombre"] as const;
const RAISON = "L’écran Connexions Zernio n’est monté sur aucune page (défaut D1, docs/zernio/NAV-DEFAUTS.md) : à lancer après son branchement.";

let branche = false;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await regler("normal");
    await seConnecter(page);
    await page.goto(URL_ECRAN);
    await page.waitForLoadState("networkidle");
    branche = (await page.locator(ECRAN).count()) > 0;
  } finally {
    await page.close();
  }
});

test.beforeEach(async ({ page }) => {
  await regler("normal");
  await viderAppels();
  await seConnecter(page);
});

async function ouvrir(page: Page, schema: (typeof SCHEMAS)[number] = "sombre") {
  await page.emulateMedia({ colorScheme: schema === "clair" ? "light" : "dark" });
  await page.goto(URL_ECRAN);
  await expect(page.locator(ECRAN)).toBeVisible();
}
const ecran = (page: Page) => page.locator(ECRAN);
const tester = (page: Page) => ecran(page).getByRole("button", { name: "Tester les 6 comptes" });

/** Le premier essai ne se saute pas : c'est lui qui annonce le défaut. */
test("l'écran Connexions Zernio est monté dans le Studio (D1, défaut connu)", async ({ page }) => {
  test.fail(true, "D1 : écran non monté — retirer cette ligne quand Z3-E/NAV l'aura branché");
  await page.goto(URL_ECRAN);
  await expect(ecran(page), "écran Connexions Zernio absent de la page").toHaveCount(1);
});

test.describe("parcours Connexions", () => {
  test.beforeEach(() => test.fixme(!branche, RAISON));

  for (const schema of SCHEMAS) {
    test(`Tester : les 6 comptes apparaissent, lecture seule chez Zernio (${schema})`, async ({ page }) => {
      await ouvrir(page, schema);
      await tester(page).click();
      await expect(ecran(page).locator("li[data-compte]")).toHaveCount(6);
      for (const nom of ["Exemple Facebook A", "Exemple Facebook B", "Exemple Instagram", "Exemple LinkedIn page", "Exemple LinkedIn profil", "Exemple TikTok"]) {
        await expect(ecran(page).getByRole("heading", { name: nom })).toBeVisible();
      }
      const appels = await appelsFaux();
      expect(appels.length).toBeGreaterThan(0);
      expect(appels.filter((a) => a.ecriture)).toEqual([]);
    });
  }

  test("Instagram : passer sur Zernio puis revenir sur Buffer", async ({ page }) => {
    await ouvrir(page);
    await tester(page).click();
    const carte = ecran(page).locator("li[data-compte^='instagram']");
    await expect(carte).toBeVisible();
    const publiePar = carte.getByRole("radiogroup", { name: "Publie par" });
    await publiePar.getByRole("radio", { name: "Zernio" }).click();
    await expect(publiePar.getByRole("radio", { name: "Zernio" })).toHaveAttribute("aria-checked", "true");
    const buffer = publiePar.getByRole("radio", { name: "Buffer" });
    test.skip(await buffer.isDisabled(), "Ce compte n'existe pas chez Buffer en simulation : le retour n'est pas offert.");
    await buffer.click();
    await expect(buffer).toHaveAttribute("aria-checked", "true");
  });

  test("Tout arrêter coupe vraiment, Tout reprendre rétablit ; Zernio n'est jamais contacté en écriture", async ({ page }) => {
    await ouvrir(page);
    await tester(page).click();
    await expect(ecran(page).locator("li[data-compte]")).toHaveCount(6);
    await ecran(page).getByRole("button", { name: "Tout arrêter" }).click();
    const fenetre = page.getByRole("dialog", { name: "Tout arrêter ?" });
    await expect(fenetre).toBeVisible();
    await fenetre.getByRole("button", { name: "Oui, tout arrêter" }).click();
    await expect(ecran(page).getByText("Tout est à l’arrêt.").first()).toBeVisible();
    await viderAppels();
    // Lecture permise pendant l'arrêt ; aucune écriture n'est partie.
    await tester(page).click();
    await expect.poll(async () => (await appelsFaux()).length).toBeGreaterThan(0);
    expect((await appelsFaux()).filter((a) => a.ecriture)).toEqual([]);
    await ecran(page).getByRole("button", { name: "Tout reprendre" }).click();
    await expect(ecran(page).getByRole("button", { name: "Tout arrêter" })).toBeVisible();
  });

  test("arrêt actif : un bandeau le dit sur tous les écrans (D2, défaut connu)", async ({ page }) => {
    test.fail(true, "D2 : aucun bandeau d'arrêt hors de l'écran Connexions");
    ecrireMigration(ETAT_NORMAL);
    await ouvrir(page);
    await ecran(page).getByRole("button", { name: "Tout arrêter" }).click();
    await page.getByRole("dialog", { name: "Tout arrêter ?" }).getByRole("button", { name: "Oui, tout arrêter" }).click();
    await expect(ecran(page).getByText("Tout est à l’arrêt.").first()).toBeVisible();
    try {
      for (const chemin of ["/", "/reglages/migration", "/a-publier", "/calendrier"]) {
        await page.goto(chemin);
        await expect(page.getByRole("status").or(page.getByRole("alert")).filter({ hasText: /arrêt/i }), `bandeau d'arrêt absent sur ${chemin}`).toBeVisible({ timeout: 5_000 });
      }
    } finally {
      await page.goto(URL_ECRAN);
      await ecran(page).getByRole("button", { name: "Tout reprendre" }).click();
      ecrireMigration(null);
    }
  });

  test("état vide : aucun compte relié, avec le chemin pour les relier", async ({ page }) => {
    await regler("vide");
    await ouvrir(page);
    await tester(page).click();
    await expect(ecran(page).locator("[data-etat='vide']")).toBeVisible();
    await expect(ecran(page).getByRole("heading", { name: "Aucun compte relié à Zernio" })).toBeVisible();
    await expect(ecran(page).getByRole("button", { name: "J’ai relié mes comptes" })).toBeVisible();
    await expect(ecran(page).getByRole("link", { name: "Ouvrir Zernio" })).toHaveAttribute("rel", /noopener/);
  });

  test("état de chargement : un squelette annoncé pendant la lecture", async ({ page }) => {
    await page.route(/\/reglages/, async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto(URL_ECRAN);
    await expect(ecran(page).locator("[data-etat='chargement']")).toBeVisible({ timeout: 10_000 });
    await expect(ecran(page).getByText("Interrogation des 6 comptes…")).toBeVisible();
    await expect(ecran(page).locator("[data-etat='chargement']")).toHaveCount(0, { timeout: 15_000 });
  });

  test("Zernio ne répond pas : un message en français s'affiche (rien ne casse)", async ({ page }) => {
    await ouvrir(page);
    await regler("erreur");
    await tester(page).click();
    const message = page.locator("[data-sonner-toast]").first();
    await expect(message).toBeVisible();
    expect(await message.innerText()).toMatch(/Zernio/);
    await expect(ecran(page)).toBeVisible();
  });

  // D3 : l'état « Zernio ne répond pas » + « Réessayer maintenant » n'apparaît que si la LECTURE EN BASE échoue ;
  // un Zernio muet ne le déclenche pas. Défaut connu : l'essai échoue tant que ce n'est pas corrigé (test.fail).
  test("Zernio ne répond pas : l'écran propose « Réessayer maintenant » (D3, défaut connu)", async ({ page }) => {
    test.fail(true, "D3 : l'état erreur n'est pas atteint quand Zernio ne répond pas");
    await ouvrir(page);
    await regler("erreur");
    await tester(page).click();
    await expect(ecran(page).getByRole("button", { name: "Réessayer maintenant" })).toBeVisible({ timeout: 5_000 });
  });

  test("clé refusée : le message le dit en français, sans montrer la clé", async ({ page }) => {
    await regler("cle-refusee");
    await ouvrir(page);
    await tester(page).click();
    const message = page.getByText(/Zernio refuse l.accès/).first();
    await expect(message).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain("exemple-cle-fictive");
  });

  test("clavier seul : Tab atteint « Tout arrêter », Entrée ouvre la fenêtre, Échap la ferme, le focus se voit", async ({ page }) => {
    await ouvrir(page);
    expect(await atteindreAuClavier(page, "Tout arrêter", 200)).toBe(true);
    const f = await focusVisible(page);
    expect(f.ok, `focus invisible sur ${f.description}`).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Tout arrêter ?" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(ecran(page).getByRole("button", { name: "Tout arrêter" })).toBeVisible();
  });

  for (const schema of SCHEMAS) {
    test(`exigences transversales (${schema}) : mots, tutoiement, mots interdits, mouvement réduit`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await ouvrir(page, schema);
      await tester(page).click();
      await expect(ecran(page).locator("li[data-compte]")).toHaveCount(6);
      const texte = await ecran(page).innerText();
      expect(await motsAnglais(page), "mots anglais").toEqual([]);
      expect(await tutoiement(page), "tutoiement").toEqual([]);
      expect(await motsInterditsVisibles(page), "mots interdits").toEqual([]);
      expect(texte).toMatch(/vous|vos|votre/i);
      await page.waitForTimeout(400);
      expect(await animationsEnCours(page), "animations en cours en mouvement réduit").toEqual([]);
    });
  }
});
