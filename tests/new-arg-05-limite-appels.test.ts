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

const COMITE = "comité éditorial";
const MOT = "parcours mot → guide";
const envoye = { etat: "envoye", lotId: "l", idees: 3, pireUsd: 0 };
const compte = async () => ((await lireParametre<{ n: number } | null>(L.PARAM_COMPTE_APPELS, null))?.n ?? 0);
/** Lance comme la boucle (même chemin que `lancerAnnexe`) et rend ce que la tâche a fait. */
async function viaBoucle(nom: string, resultat: unknown, instant = T0) {
  const f = vi.fn(async () => resultat);
  await L.lancerSousLimite(nom, f, instant);
  return f.mock.calls.length;
}

describe("NEW-ARG-05 · limite d'appels", () => {
  it("éteinte par défaut : tout part, rien n'est écrit", async () => {
    for (let i = 0; i < 50; i++) expect(await viaBoucle(COMITE, envoye)).toBe(1);
    expect(await lireParametre(L.PARAM_COMPTE_APPELS, null)).toBeNull();
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(false);
  });
  it("allumée : l'automatique s'arrête une fois la limite atteinte (vrais appels comptés)", async () => {
    await allumer(3);
    const r: number[] = [];
    for (let i = 0; i < 5; i++) r.push(await viaBoucle(COMITE, envoye));
    expect(r).toEqual([1, 1, 1, 0, 0]);
    expect(await compte()).toBe(3);
    expect((await L.etatLimiteAppels(T0)).atteinte).toBe(true);
  });
  it("tours à vide : 1 000 passages sans travail ne bougent pas le compte et n'écrivent rien", async () => {
    await allumer(3);
    for (let i = 0; i < 1000; i++) {
      await viaBoucle(COMITE, { etat: "rien-a-juger" });
      await viaBoucle(MOT, { actif: true, traites: 0, envoyes: 0, definitifs: 0, aReessayer: 0, ecartes: 0 });
    }
    expect(await lireParametre(L.PARAM_COMPTE_APPELS, null)).toBeNull();
    expect(await viaBoucle(COMITE, envoye)).toBe(1); // la limite n'est pas entamée
    expect(await compte()).toBe(1);
  });
  it("parcours mot : on compte les envois réels", async () => {
    await allumer(5);
    await viaBoucle(MOT, { actif: true, traites: 4, envoyes: 4, definitifs: 0, aReessayer: 0, ecartes: 0 });
    expect(await compte()).toBe(4);
  });
  it("jamais le manuel : limite atteinte, les réveils manuels du tableau et des lots partent par `lancerAnnexe`", async () => {
    await allumer(1);
    expect(await viaBoucle(COMITE, envoye)).toBe(1);
    expect(await viaBoucle(COMITE, envoye)).toBe(0); // limite atteinte : l'automatique est freiné
    const { lancerAnnexe } = await import("@/services/boucle");
    for (const nom of ["tâches du tableau animé", "lots d'images", "parcours de conversation", "notifications", "surveillance des crédits"]) {
      const f = vi.fn(async () => undefined);
      await lancerAnnexe(nom, f, 5_000); // chemin réel, même appel que `reveillerTaches`
      expect(f, nom).toHaveBeenCalledTimes(1);
    }
    for (const nom of ["tâches du tableau animé", "lots d'images", "parcours de conversation"]) expect(L.ANNEXES_AUTOMATIQUES).not.toContain(nom);
  }, 60_000);
  it("le compte repart à zéro au changement de jour à Paris (pas à minuit UTC)", async () => {
    await allumer(1);
    const soir = Date.parse("2027-03-10T22:30:00Z"); // 23 h 30 à Paris
    expect(await viaBoucle(COMITE, envoye, soir)).toBe(1);
    expect(await viaBoucle(COMITE, envoye, Date.parse("2027-03-10T23:30:00Z"))).toBe(1); // 00 h 30 le 11 : nouveau jour
    expect(await viaBoucle(COMITE, envoye, Date.parse("2027-03-11T00:30:00Z"))).toBe(0);
    expect(await viaBoucle(COMITE, envoye, soir + 2 * JOUR)).toBe(1);
  });
  it("une lecture en erreur n'arrête jamais rien", async () => {
    await allumer(1);
    const f = vi.fn(async () => envoye);
    await L.lancerSousLimite(COMITE, f, T0, { lire: async () => { throw new Error("x"); } });
    expect(f).toHaveBeenCalledTimes(1);
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
    expect(src.match(/lancerSousLimite/g)).toHaveLength(2);
    expect(L.PARAM_LIMITE_ACTIVE).toBe("limite_appels.active");
  });
});
