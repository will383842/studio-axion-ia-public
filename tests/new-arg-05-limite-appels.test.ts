/** NEW-ARG-05 · limite technique d'appels par jour (heure de Paris) : horloge simulée, aucun appel réel. */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const L = await import("@/services/limite-appels");
const { BandeauLimiteAppels } = await import("@/app/(studio)/_accueil/BandeauLimiteAppels");

const T0 = Date.parse("2027-03-10T10:00:00Z");
const JOUR = 24 * 3_600_000;

beforeEach(() => reinitialiserDepots());

async function allumer(limite: number) {
  await ecrireParametre(L.PARAM_LIMITE_ACTIVE, true);
  await ecrireParametre(L.PARAM_LIMITE_PAR_JOUR, limite);
}

describe("NEW-ARG-05 · limite d'appels", () => {
  it("éteinte par défaut : tout passe, rien n'est écrit", async () => {
    for (let i = 0; i < 500; i++) expect(await L.annexeAutorisee("lots d'images", T0)).toBe(true);
    expect(await lireParametre(L.PARAM_COMPTE_APPELS, null)).toBeNull();
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(false);
  });
  it("allumée : l'automatique s'arrête une fois la limite atteinte", async () => {
    await allumer(3);
    const r: boolean[] = [];
    for (let i = 0; i < 5; i++) r.push(await L.annexeAutorisee("lots d'images", T0));
    expect(r).toEqual([true, true, true, false, false]);
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(true);
  });
  it("jamais le manuel ni les tâches qui ne sont pas de la fabrication automatique", async () => {
    await allumer(1);
    await L.annexeAutorisee("lots d'images", T0);
    expect(await L.annexeAutorisee("lots d'images", T0)).toBe(false);
    for (const nom of ["notifications", "surveillance des crédits", "synchronisation Zernio", "surveillance heure H"]) expect(await L.annexeAutorisee(nom, T0)).toBe(true);
    expect(L.ANNEXES_AUTOMATIQUES).not.toContain("notifications");
  });
  it("le compte repart à zéro au changement de jour à Paris (pas à minuit UTC)", async () => {
    await allumer(1);
    const soir = Date.parse("2027-03-10T22:30:00Z"); // 23 h 30 à Paris
    expect(await L.annexeAutorisee("comité éditorial", soir)).toBe(true);
    expect(await L.annexeAutorisee("comité éditorial", Date.parse("2027-03-10T23:30:00Z"))).toBe(true); // 00 h 30 le 11 : nouveau jour
    expect(await L.annexeAutorisee("comité éditorial", Date.parse("2027-03-11T00:30:00Z"))).toBe(false);
    expect(await L.annexeAutorisee("comité éditorial", soir + 2 * JOUR)).toBe(true);
  });
  it("une lecture en erreur n'arrête jamais rien", async () => {
    await allumer(1);
    expect(await L.annexeAutorisee("lots d'images", T0, { lire: async () => { throw new Error("x"); } })).toBe(true);
  });
  it("bandeau : rien tant que la limite n'est pas atteinte ; sinon un message qui vouvoie, sans montant", () => {
    expect(renderToStaticMarkup(createElement(BandeauLimiteAppels, { atteinte: false }))).toBe("");
    const html = renderToStaticMarkup(createElement(BandeauLimiteAppels, { atteinte: true }));
    expect(html).toMatch(/vous/i);
    const texte = html.replace(/<svg[\s\S]*?<\/svg>/, "").replace(/<[^>]+>/g, "").replace(/&#x27;/g, "");
    expect(texte).not.toMatch(/[€$]|euro|dollar|\d/i);
  });
  it("boucle.ts : un import et un appel seulement, aucune logique", () => {
    const src = readFileSync("src/services/boucle.ts", "utf8");
    expect(src.match(/limite-appels/g)).toHaveLength(1);
    expect(src.match(/annexeAutorisee/g)).toHaveLength(2);
    expect(L.PARAM_LIMITE_ACTIVE).toBe("limite_appels.active");
  });
});
