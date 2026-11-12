import { describe, expect, it } from "vitest";
import { confirmerTable, estConfirmee, exigerTableConfirmee, lireTable, proposerTable } from "../../src/services/import-buffer/cibles";

const CANAUX = [
  { id: "canal-ig", nom: "Exemple IG", service: "instagram" },
  { id: "canal-fb", nom: "Exemple FB", service: "facebook" },
  { id: "canal-li", nom: "Exemple LI", service: "linkedin" },
  { id: "canal-tt", nom: "Exemple TT", service: "tiktok" },
];
const CHOIX = { "canal-ig": "exemple-compte-1", "canal-fb": "exemple-compte-2:fb:exemple-page-1", "canal-li": "exemple-compte-3:li:123" };

describe("IMP-2 table des cibles", () => {
  it("propose une table, ignore TikTok, signale les canaux sans cible", () => {
    const { table, sansCible } = proposerTable(CANAUX, CHOIX);
    expect(table.lignes.map((l) => l.canalId)).toEqual(["canal-ig", "canal-fb", "canal-li"]);
    expect(sansCible).toEqual([]);
    expect(proposerTable(CANAUX, { "canal-ig": "exemple-compte-1" }).sansCible).toEqual(["canal-fb", "canal-li"]);
  });
  it("Facebook sans page : refusé (jamais la page par défaut)", () => {
    expect(() => proposerTable(CANAUX, { ...CHOIX, "canal-fb": "exemple-compte-2" })).toThrow(/page/i);
  });
  it("sans confirmation, aucune création", () => {
    const { table } = proposerTable(CANAUX, CHOIX);
    expect(estConfirmee(table)).toBe(false);
    expect(() => exigerTableConfirmee(table)).toThrow(/pas confirmée/);
    expect(() => exigerTableConfirmee(undefined)).toThrow();
  });
  it("seul « C'est juste » confirme ; une modification ensuite annule la confirmation", () => {
    const { table } = proposerTable(CANAUX, CHOIX);
    expect(() => confirmerTable(table, "ok", new Date())).toThrow();
    const c = confirmerTable(table, "C'est juste", new Date("2026-11-01T08:00:00Z"));
    expect(exigerTableConfirmee(c)).toBe(c);
    const touchee = { ...c, lignes: [{ ...c.lignes[0], cible: "exemple-compte-9" }, ...c.lignes.slice(1)] };
    expect(estConfirmee(touchee)).toBe(false);
  });
  it("relecture : forme illisible refusée, table valide relue", () => {
    expect(() => lireTable({})).toThrow();
    const { table } = proposerTable(CANAUX, CHOIX);
    expect(lireTable(JSON.parse(JSON.stringify(confirmerTable(table, "C'est juste", new Date())))).lignes).toHaveLength(3);
  });
});
