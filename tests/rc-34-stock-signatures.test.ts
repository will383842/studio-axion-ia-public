/**
 * RC-34 : empreinte hachée (L3-11) des messages planifiés ou publiés, rangée dans une mémoire propre au stock.
 * Filtre côté Studio ; rien n'est envoyé à l'usine. Données fictives, aucun appel réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { lireParametre, ecrireParametre } = await import("@/services/_commun");
const stock = await import("@/services/stock-signatures");

const MESSAGE = "Comment relancer un client qui ne répond plus après le devis";
const PROCHE = "Relancer un client qui ne répond plus après un devis";
const LOIN = "Recette de gâteau au chocolat pour le goûter des enfants";

beforeEach(() => {
  reinitialiserDepots();
  vi.unstubAllGlobals();
});

describe("RC-34 signatures du stock", () => {
  it("écarte un sujet de l'usine proche d'un message planifié, mémoire centrale coupée", async () => {
    expect(await lireParametre("ecriture.memoireCentrale", false)).toBe(false);
    expect(await stock.rangerSignatureStock({ id: "m1", texte: MESSAGE, etat: "planifie" })).toBe(true);
    const r = await stock.ecarterSujetsProches([
      { id: "s-proche", sujet: PROCHE },
      { id: "s-loin", sujet: LOIN },
    ]);
    expect(r.ecartes.map((x) => x.id)).toEqual(["s-proche"]);
    expect(r.gardes.map((x) => x.id)).toEqual(["s-loin"]);
  });

  it("garde l'écart au-delà de 60 messages (aucune fenêtre glissante)", async () => {
    await stock.rangerSignatureStock({ id: "m-ancien", texte: MESSAGE, etat: "publie" });
    for (let i = 0; i < 80; i++) await stock.rangerSignatureStock({ id: `m${i}`, texte: `Sujet numéro${i} totalement différent zorglub${i} quux${i}`, etat: "planifie" });
    expect((await stock.signaturesDuStock()).length).toBe(81);
    const r = await stock.ecarterSujetsProches([{ id: "s-proche", sujet: PROCHE }]);
    expect(r.ecartes.map((x) => x.id)).toEqual(["s-proche"]);
  });

  it("ne range que l'empreinte hachée : aucun mot du message en clair, aucune écriture dans la mémoire centrale", async () => {
    await stock.rangerSignatureStock({ id: "m1", texte: MESSAGE, signatureUsine: "sig-usine-secrete", etat: "planifie" });
    const brut = JSON.stringify(await lireParametre(stock.CLE_SIGNATURES_STOCK, null)).toLowerCase();
    for (const mot of ["relancer", "client", "devis", "répond", "repond", "sig-usine-secrete"]) expect(brut).not.toContain(mot);
    expect(brut).toMatch(/[0-9a-f]{64}/);
    for (const cle of ["ecriture.scriptsCentraux", "ecriture.memoirePosts", "ecriture.tiragesCommuns"]) expect(await lireParametre(cle, "vide")).toBe("vide");
  });

  it("n'enregistre pas un message encore en stock ni un texte sans mot plein", async () => {
    expect(await stock.rangerSignatureStock({ id: "a", texte: MESSAGE, etat: "en-stock" })).toBe(false);
    expect(await stock.rangerSignatureStock({ id: "b", texte: "  ", etat: "planifie" })).toBe(false);
    expect(await stock.signaturesDuStock()).toEqual([]);
  });

  it("aucun appel vers l'usine : pas de réseau, le résultat ne porte ni texte ni empreinte", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await stock.rangerSignatureStock({ id: "m1", texte: MESSAGE, etat: "planifie" });
    const r = await stock.ecarterSujetsProches([{ id: "s-proche", sujet: PROCHE }]);
    expect(f).not.toHaveBeenCalled();
    const sortie = JSON.stringify(r).toLowerCase();
    expect(sortie).not.toMatch(/[0-9a-f]{64}/);
    expect(sortie).not.toContain("devis");
  });

  it("jamais de suppression : rejeu sans doublon, passage à « publié » sans perte, liste illisible tolérée", async () => {
    await stock.rangerSignatureStock({ id: "m1", texte: MESSAGE, etat: "planifie" });
    await stock.rangerSignatureStock({ id: "m1", texte: MESSAGE, etat: "publie" });
    const l = (await stock.signaturesDuStock()) as { id: string; etat: string }[];
    expect(l).toHaveLength(1);
    expect(l[0].etat).toBe("publie");
    expect(Object.keys(stock).filter((k) => /suppr|retir|purg|vider|effac/i.test(k))).toEqual([]);
    await ecrireParametre(stock.CLE_SIGNATURES_STOCK, "illisible");
    expect(await stock.signaturesDuStock()).toEqual([]);
  });
});
