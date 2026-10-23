/** Lot A2 : aucune fin des tables (base 7, tableau, diagnostic) n'enfreint le positionnement de Will. */
import { describe, expect, it } from "vitest";
import { BANQUE_APPELS, TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/banque";
import { TABLE_FINS } from "@/briques/fins/table";
import { diyImperatif, faitLeVousMeme, NOUVEAUTE_OUTIL } from "@/domaine/positionnement";

const norm = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’`]/g, "'");

describe("les tables de fins respectent le positionnement", () => {
  const toutes = [...BANQUE_APPELS.map((a) => ({ id: a.code, dit: a.dit })), ...TABLE_FINS.map((f) => ({ id: f.id, dit: f.dit })), ...TABLE_FINS_DIAGNOSTIC.map((f) => ({ id: f.id, dit: f.dit }))];
  it("il y a des fins à vérifier", () => expect(toutes.length).toBeGreaterThan(10));
  for (const f of toutes) {
    it(`${f.id}`, () => {
      expect(faitLeVousMeme(f.dit), f.dit).toBeUndefined();
      expect(diyImperatif(f.dit), f.dit).toBeUndefined();
      expect(NOUVEAUTE_OUTIL.test(norm(f.dit)), f.dit).toBe(false);
    });
  }
});
