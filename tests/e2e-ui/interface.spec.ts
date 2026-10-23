/**
 * VÉRIF V3 — INTERFACE (simulation : base en mémoire, fournisseurs simulés, aucun appel réel), 390 px et 1440 px.
 * Chaque test a d'abord été vu ROUGE sur master, puis vert avec son correctif (docs/verification/V3-INTERFACE.md).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, type Page } from "@playwright/test";

const MDP = process.env.E2E_MDP;

async function seConnecter(page: Page) {
  test.skip(!MDP, "E2E_MDP manquant");
  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP!);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
}

/** Erreurs de la console, exceptions et réponses ≥ 400 pendant le test. */
function surveiller(page: Page) {
  const erreurs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(`console : ${m.text()}`);
  });
  page.on("pageerror", (e) => erreurs.push(`exception : ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) erreurs.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return erreurs;
}

test("Bibliothèque › Mes animations : s'ouvre en chargement direct (pas de 404) et depuis la Bibliothèque", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  const r = await page.goto("/bibliotheque/animations");
  expect(r?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Mes animations", level: 1 })).toBeVisible();
  // La Bibliothèque précharge le lien : aucune requête en échec.
  await page.goto("/bibliotheque");
  await page.waitForLoadState("networkidle");
  expect(erreurs).toEqual([]);
});

test("Face caméra : « J'ai déjà filmé ma vidéo » mène à l'envoi, sans écriture", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/nouvelle/facecam");
  await page.getByRole("button", { name: "J'ai déjà filmé ma vidéo" }).click();
  await page.getByLabel("Le texte que vous avez dit").fill("Bonjour, aujourd'hui je vous explique comment gagner du temps sur vos devis, en trois étapes simples.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/envoyer\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Choisir ma vidéo/ })).toBeVisible();
  expect(erreurs).toEqual([]);
});

/** Nombre de lignes occupées par un nœud texte (rectangles de la plage, regroupés par hauteur). */
async function lignesDuTexte(page: Page, selecteur: string, texte: string) {
  return page.locator(selecteur).first().evaluate((el, t) => {
    const marcheur = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (marcheur.nextNode()) {
      const n = marcheur.currentNode;
      if (n.textContent?.trim() !== t) continue;
      const plage = document.createRange();
      plage.selectNodeContents(n);
      return new Set([...plage.getClientRects()].map((r) => Math.round(r.top))).size;
    }
    return -1;
  }, texte);
}

test("Accueil : « Nouvelle vidéo » tient sans couper le mot (390 px comme 1440 px)", async ({ page }) => {
  await seConnecter(page);
  await page.goto("/");
  await expect(page.locator('main a[href="/nouvelle"]').first()).toBeVisible();
  expect(await lignesDuTexte(page, 'main a[href="/nouvelle"] p', "Nouvelle")).toBe(1);
});

/** Vidéo d'essai qui passe le contrôle de l'envoi (côté long ≥ 2560 px, ≥ 8 Mb/s, ≥ 5 s), fabriquée par ffmpeg. */
function videoEssai(): string | null {
  const chemin = join(tmpdir(), "studio-v3-prise.mp4");
  if (existsSync(chemin)) return chemin;
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=2560x1440:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "12M", "-minrate", "12M", "-maxrate", "12M", "-bufsize", "12M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", chemin]);
  return r.status === 0 ? chemin : null;
}

test("Sujet face caméra : le code de la prise reste lisible à côté de « Monter ma prise »", async ({ page }) => {
  const video = videoEssai();
  test.skip(!video, "ffmpeg absent : pas de vidéo d'essai");
  await seConnecter(page);
  const titre = `Prise lisible ${Date.now()}`;
  await page.goto("/nouvelle/facecam");
  await page.getByRole("button", { name: "J'ai déjà filmé ma vidéo" }).click();
  await page.getByLabel("Le texte que vous avez dit").fill("Trois conseils pour relancer un devis sans paraître insistant, testés avec de vrais clients.");
  await page.getByLabel("Titre (facultatif)").fill(titre);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/envoyer\//, { timeout: 30_000 });
  // Envoi simulé (stockage local d'essai) : la prise est rangée, prête à monter.
  await page.locator("input[type=file]").first().setInputFiles(video!);
  await expect(page).not.toHaveURL(/\/envoyer\//, { timeout: 120_000 });
  await page.goto("/ecrire");
  await page.getByRole("link", { name: new RegExp(titre) }).first().click();
  await expect(page).toHaveURL(/\/ecrire\/sujets\//);
  const code = page.getByRole("status").locator("span.font-mono").first();
  await expect(code).toBeVisible();
  // Le texte entier tient dans sa boîte (pas de « 000… »).
  expect(await code.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("Fiche vidéo : « Lire » sur une source illisible ne lève pas d'exception et le dit en français", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/videos/v-01");
  // Source volontairement illisible (ex. lien expiré) : le lecteur doit le dire, pas planter.
  await page.locator("video").first().evaluate((v: HTMLVideoElement) => {
    v.src = "data:video/mp4;base64,AAAA";
  });
  await page.getByRole("button", { name: /^Lire « / }).first().click();
  await expect(page.getByText("Cette vidéo ne se lit pas pour l'instant.").first()).toBeVisible();
  expect(erreurs.filter((e) => e.startsWith("exception"))).toEqual([]);
});

test("Accueil › En cours : le pourcentage tient sur une ligne (« 100 % », pas « 100 / % »)", async ({ page }) => {
  await seConnecter(page);
  // Une fabrication simulée (avocat) pour que la rangée « En cours » existe.
  await page.goto("/nouvelle/avocat");
  await page.getByRole("textbox", { name: "Votre texte", exact: true }).fill(
    "Votre patron peut-il lire vos mails ? Un mail envoyé depuis la messagerie du travail est présumé professionnel. Votre employeur peut donc l'ouvrir, sauf s'il porte la mention personnel. Retenez ce mot : personnel.",
  );
  await page.getByRole("button", { name: "Utiliser ce texte" }).click();
  const fabriquer = page.getByRole("button", { name: /^Fabriquer · (≈|Essai gratuit)/ });
  await expect(fabriquer).toBeEnabled({ timeout: 30_000 });
  await fabriquer.click();
  // Relire le script (brique 6) : la relecture s'ouvre, puis « Lancer la vidéo » et l'accord sur le prix.
  await expect(page.getByRole("heading", { name: "Relire le script" })).toBeVisible();
  const lancer = page.getByRole("button", { name: /^Lancer la vidéo/ });
  await expect(lancer).toBeEnabled({ timeout: 15_000 });
  await lancer.click();
  const confirmer = page.getByRole("button", { name: /^Confirmer/ });
  if (await confirmer.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmer.click();
  await expect(page.getByRole("heading", { name: "Relire le script" })).toBeHidden({ timeout: 30_000 });
  await page.goto("/");
  const section = page.locator("main section").filter({ has: page.getByRole("heading", { name: /^En cours/ }) });
  // Le cas le plus large : « 100 % », gardé quelques instants quand la vidéo est prête.
  const pourcentage = section.locator("li span.tabular-nums").filter({ hasText: /^100\s?%$/ }).first();
  await expect(pourcentage).toBeVisible({ timeout: 150_000 });
  expect(await pourcentage.evaluate((el) => el.getBoundingClientRect().height < parseFloat(getComputedStyle(el).lineHeight) * 1.5)).toBe(true);
});
