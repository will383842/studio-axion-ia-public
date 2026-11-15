/** L5-26 : table mot × publication (côté Studio) et contrat utm_campaign. Pur, aucun appel réel, aucune donnée de personne. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attribuerContacts, corpsAcceptable, utmCampaignDuLien } from "@/domaine/publications/attribution-post";
import { construireLienSuivi } from "@/domaine/mesures";

describe("table mot × publication", () => {
  it("un contact sans post_ref est « non rattaché »", () => {
    const t = attribuerContacts([
      { mot: "GUIDE", post_ref: "post_ref_test_01" },
      { mot: "GUIDE" },
      { mot: "GUIDE", post_ref: "" },
    ]);
    expect(t.nonRattaches).toBe(2);
    expect(t.lignes).toEqual([{ mot: "GUIDE", post_ref: "post_ref_test_01", contacts: 1 }]);
  });
  it("compte les contacts par couple mot × publication", () => {
    const t = attribuerContacts([{ mot: "GUIDE", post_ref: "post_a_0001" }, { mot: "GUIDE", post_ref: "post_a_0001" }, { mot: "DIAG", post_ref: "post_a_0001" }]);
    expect(t.lignes).toEqual([{ mot: "DIAG", post_ref: "post_a_0001", contacts: 1 }, { mot: "GUIDE", post_ref: "post_a_0001", contacts: 2 }]);
    expect(t.nonRattaches).toBe(0);
  });
});

describe("corps refusé s'il contient un e-mail", () => {
  it("refuse un corps avec adresse", () => {
    expect(corpsAcceptable('{"a":"x@exemple.test"}')).toEqual({ ok: false, motif: "email_interdit" });
    expect(corpsAcceptable("écrire à Nom.Prenom+t@sous.exemple.fr svp")).toEqual({ ok: false, motif: "email_interdit" });
  });
  it("accepte un corps sans adresse", () => {
    expect(corpsAcceptable('{"mot":"GUIDE","post_ref":"post_ref_test_01"}')).toEqual({ ok: true });
  });
});

describe("contrat utm_campaign = code du lien suivi", () => {
  // Fixture inline : un code de version et un code de mot, tels que le constructeur unique les accepte.
  const fixture = [
    { typeLien: "video", reseau: "instagram", code: "0042-TB-IG" },
    { typeLien: "message", reseau: "instagram", code: "mot-guide" },
  ];
  for (const f of fixture) {
    it(`utm_campaign du lien ${f.typeLien} = code ${f.code}`, () => {
      const lien = construireLienSuivi({ ...f, activite: "clients", page: "/fr/guide-ia" });
      expect(utmCampaignDuLien(lien)).toBe(f.code);
    });
  }
  it("un lien sans utm_campaign donne null", () => {
    expect(utmCampaignDuLien("https://axion-ia.com/fr/appel?utm_source=instagram")).toBeNull();
  });
  it("charge-crm-v3.json : chaque origine porte un utm_campaign de forme valide (contrat de forme)", () => {
    const c = JSON.parse(readFileSync(new URL("../../contrats/charge-crm-v3.json", import.meta.url), "utf8")) as { payload: { origines: { utm_campaign?: string; post_ref?: string }[] } };
    for (const o of c.payload.origines) expect(o.utm_campaign).toMatch(/^[a-z0-9_-]{2,60}$/);
  });
});
