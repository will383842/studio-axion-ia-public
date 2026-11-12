/**
 * NAV · contrôles transversaux (exigences « partout » du plan, section 7 b) : clavier, focus visible, cibles 48 px,
 * textes 16 px minimum, mouvement réduit, aucun mot anglais, vouvoiement, mots interdits absents.
 * Chaque contrôle RENVOIE la liste des écarts (vide = conforme) : le parcours décide quoi en faire.
 */
import type { Locator, Page } from "@playwright/test";
import { MOTS_ANGLAIS, MOTS_INTERDITS } from "./demarrage";

/** Boutons, liens et champs visibles de la zone, plus petits que 48 px (hauteur) — hors liens au fil du texte. */
export async function ciblesTropPetites(zone: Locator, minimum = 48): Promise<string[]> {
  return zone.evaluate((racine, min) => {
    const visibles = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const cibles = [...racine.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=radio], [role=tab]")].filter(visibles);
    return cibles
      .filter((el) => el.getBoundingClientRect().height < min - 0.5 || el.getBoundingClientRect().width < min - 0.5)
      // Un lien au fil d'une phrase n'est pas une cible isolée.
      .filter((el) => !(el.tagName === "A" && getComputedStyle(el).display === "inline"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        const nom = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
        return `${el.tagName.toLowerCase()} « ${nom} » ${Math.round(r.width)}×${Math.round(r.height)}`;
      });
  }, minimum);
}

/** Textes visibles dont la taille calculée est inférieure à 16 px. */
export async function textesTropPetits(zone: Locator, minimum = 16): Promise<string[]> {
  return zone.evaluate((racine, min) => {
    const trouves = new Set<string>();
    const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    while (marcheur.nextNode()) {
      const n = marcheur.currentNode;
      const texte = (n.textContent ?? "").trim();
      const el = n.parentElement;
      if (!texte || !el) continue;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.visibility === "hidden" || st.display === "none" || r.width === 0 || r.height === 0) continue;
      // Texte réservé aux lecteurs d'écran (sr-only) : hors sujet.
      if (r.width <= 1 && r.height <= 1) continue;
      if (parseFloat(st.fontSize) < min - 0.01) trouves.add(`${st.fontSize} : « ${texte.slice(0, 50)} »`);
    }
    return [...trouves];
  }, minimum);
}

/** Mots anglais courants (listés dans demarrage.ts) présents dans le texte visible. */
export async function motsAnglais(page: Page): Promise<string[]> {
  const texte = await page.locator("main, body").first().innerText();
  return MOTS_ANGLAIS.filter((m) => new RegExp(`(^|[^\\p{L}])${m}([^\\p{L}]|$)`, "u").test(texte));
}

/** Tutoiement : « tu », « ton », « ta », « tes », « toi », « te » en mots entiers (le vouvoiement est la règle). */
export async function tutoiement(page: Page): Promise<string[]> {
  const texte = await page.locator("main, body").first().innerText();
  const motifs = ["tu", "ton", "ta", "tes", "toi", "t'es", "viens"];
  return motifs.filter((m) => new RegExp(`(^|[^\\p{L}'’])${m}([^\\p{L}]|$)`, "iu").test(texte));
}

/** Mots interdits (jamais écrits en clair dans le dépôt : construits par jetons). */
export async function motsInterditsVisibles(page: Page): Promise<string[]> {
  const texte = (await page.locator("body").innerText()).toLowerCase();
  return MOTS_INTERDITS.filter((m) => texte.includes(m.toLowerCase()));
}

/** Animations qui tournent encore (infinies ou en cours) : doit être vide en mouvement réduit. */
export async function animationsEnCours(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => {
        const cible = (a as CSSAnimation).effect && "target" in (a as CSSAnimation).effect! ? ((a as CSSAnimation).effect as KeyframeEffect).target : null;
        const nom = (a as CSSAnimation).animationName ?? a.constructor.name;
        return `${nom} sur ${cible ? (cible as Element).tagName.toLowerCase() : "?"}`;
      }),
  );
}

/** L'élément qui a le focus montre-t-il quelque chose (contour ou ombre) ? */
export async function focusVisible(page: Page): Promise<{ ok: boolean; description: string }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, description: "aucun élément ne porte le focus" };
    const st = getComputedStyle(el);
    const contour = st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0;
    const ombre = st.boxShadow !== "none";
    const nom = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return { ok: contour || ombre, description: `${el.tagName.toLowerCase()} « ${nom} »` };
  });
}

/** Appuie sur Tab jusqu'à atteindre un élément dont le nom contient `nom` (clavier seul). Faux si introuvable. */
export async function atteindreAuClavier(page: Page, nom: RegExp | string, maxTabs = 80): Promise<boolean> {
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const courant = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el !== document.body ? `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`.replace(/\s+/g, " ").trim() : "";
    });
    if (typeof nom === "string" ? courant.includes(nom) : nom.test(courant)) return true;
  }
  return false;
}
