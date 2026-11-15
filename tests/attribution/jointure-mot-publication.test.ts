/** L5-26 : table mot × publication (côté Studio) et contrat utm_campaign. Pur, aucun appel réel, aucune donnée de personne. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { attribuerContacts, corpsAcceptable, utmCampaignDuLien } from "@/domaine/publications/attribution-post";
import { construireLienSuivi, ErreurLienSuivi } from "@/domaine/mesures";

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
  it("post_ref d'espaces seuls ou null : non rattaché ; post_ref entouré d'espaces : même publication", () => {
    const t = attribuerContacts([{ mot: "GUIDE", post_ref: "   " }, { mot: "GUIDE", post_ref: "\t" }, { mot: "GUIDE", post_ref: null }, { mot: "GUIDE", post_ref: "p1" }, { mot: "GUIDE", post_ref: " p1 " }]);
    expect(t.nonRattaches).toBe(3);
    expect(t.lignes).toEqual([{ mot: "GUIDE", post_ref: "p1", contacts: 2 }]);
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
  it.each([
    "nom [at] exemple.fr", "nom(at)exemple.fr", "nom {AT} exemple.fr", "nom @ exemple.fr", "nom@ exemple.fr", "nom@exemple .fr",
    "nom＠exemple.fr", "nom%40exemple.fr", "nom%40EXEMPLE.fr", "nom arobase exemple.fr", "nom[at]exemple[dot]fr", "X@EXEMPLE.FR",
  ])("refuse l'e-mail dissimulé : %s", (corps) => {
    expect(corpsAcceptable(corps)).toEqual({ ok: false, motif: "email_interdit" });
  });
  it.each(["", "rendez-vous à 10 h, merci.", "suivez @compte_test sur le réseau", "prix 5 % de remise", "mot GUIDE, post_ref_test_01"])("accepte un texte sans e-mail : %j", (corps) => {
    expect(corpsAcceptable(corps)).toEqual({ ok: true });
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
  // ÉCART CONNU (contrat figé par empreinte, hors périmètre de L5-26) : le contrat porte « guide_reseau », que
  // construireLienSuivi refuse (code = lettres, chiffres, tirets ; version « 0042-TB-IG » ou mot « mot-guide »).
  const contrat = JSON.parse(readFileSync(new URL("../../contrats/charge-crm-v3.json", import.meta.url), "utf8")) as { payload: { origines: { utm_campaign?: string }[] } };
  const valeurs = contrat.payload.origines.map((o) => o.utm_campaign);
  it("charge-crm-v3.json : chaque origine porte un utm_campaign", () => {
    expect(valeurs.length).toBeGreaterThan(0);
    for (const v of valeurs) expect(typeof v).toBe("string");
  });
  it("charge-crm-v3.json : l'écart avec le constructeur est détecté (la valeur du contrat est refusée par construireLienSuivi)", () => {
    for (const v of valeurs) {
      let refus: unknown;
      try {
        construireLienSuivi({ typeLien: "message", reseau: "instagram", code: v as string, activite: "clients", page: "/fr/guide-ia" });
      } catch (e) {
        refus = e;
      }
      expect(refus).toBeInstanceOf(ErreurLienSuivi);
      expect((refus as ErreurLienSuivi).refus).toBe("caractere_interdit");
    }
  });
  it.todo("charge-crm-v3.json : utm_campaign = code accepté par construireLienSuivi (à activer quand le contrat sera aligné)");
});
