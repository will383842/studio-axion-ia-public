/** L5-26 · jointure mot × publication (clé post_ref) et contrat utm_campaign. Aucune donnée de personne. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construireLienSuivi } from "@/domaine/mesures";
import { corpsSansEmail, jointureMotPublication, rattacherContact, utmCampaignDuLien } from "@/domaine/publications/attribution-post";

describe("L5-26 · rattachement d'un contact", () => {
  it("sans post_ref : non rattaché", () => {
    expect(rattacherContact({ mot: "GUIDE", reseau: "instagram" })).toEqual({ statut: "non_rattache" });
    expect(rattacherContact({ mot: "GUIDE", reseau: "instagram", post_ref: "  " })).toEqual({ statut: "non_rattache" });
  });
  it("avec post_ref : rattaché au couple mot × publication", () => {
    expect(rattacherContact({ mot: "GUIDE", reseau: "instagram", post_ref: "post_ref_test_01" })).toEqual({
      statut: "rattache",
      cle: { mot: "GUIDE", postRef: "post_ref_test_01" },
    });
  });
});

describe("L5-26 · mot normalisé", () => {
  it("« GUIDE », « guide » et « Guide » donnent une seule ligne", () => {
    const t = jointureMotPublication([
      { mot: "GUIDE", reseau: "instagram", post_ref: "p1" },
      { mot: " guide ", reseau: "instagram", post_ref: "p1" },
      { mot: "Guide", reseau: "instagram", post_ref: "p1" },
    ]);
    expect(t.lignes).toEqual([{ mot: "GUIDE", postRef: "p1", contacts: 3 }]);
  });
});

describe("L5-26 · corps sans e-mail", () => {
  it("refuse un corps qui contient une adresse e-mail", () => {
    expect(corpsSansEmail("écris-moi à personne@exemple.fr")).toEqual({ ok: false, motif: "email_interdit" });
  });
  it("refuse aussi une adresse sans domaine de premier niveau, mais pas une mention @compte", () => {
    expect(corpsSansEmail("écris à contact@exemple")).toEqual({ ok: false, motif: "email_interdit" });
    expect(corpsSansEmail("suis @compte_fictif")).toEqual({ ok: true });
  });
  it("accepte un corps sans e-mail", () => {
    expect(corpsSansEmail("Commente GUIDE pour le recevoir")).toEqual({ ok: true });
  });
});

describe("L5-26 · table mot × publication", () => {
  it("compte les contacts rattachés et sépare les non rattachés", () => {
    const t = jointureMotPublication([
      { mot: "GUIDE", reseau: "instagram", post_ref: "p1" },
      { mot: "GUIDE", reseau: "instagram", post_ref: "p1" },
      { mot: "AUDIT", reseau: "linkedin", post_ref: "p2" },
      { mot: "GUIDE", reseau: "instagram" },
    ]);
    expect(t.lignes).toEqual([
      { mot: "AUDIT", postRef: "p2", contacts: 1 },
      { mot: "GUIDE", postRef: "p1", contacts: 2 },
    ]);
    expect(t.nonRattaches).toBe(1);
  });
});

describe("L5-26 · contrat utm_campaign (fixture)", () => {
  const charge = JSON.parse(readFileSync("contrats/charge-crm-v3.json", "utf8"));
  it("la charge CRM v3 porte utm_campaign dans chaque origine", () => {
    for (const o of charge.payload.origines) expect(typeof o.utm_campaign).toBe("string");
  });
  it("chaque utm_campaign de la fixture est un code de lien accepté par construireLienSuivi", () => {
    for (const o of charge.payload.origines) {
      const typeLien = /^mot-/.test(o.utm_campaign) ? "message" : "video";
      expect(() => construireLienSuivi({ typeLien, reseau: o.reseau, code: o.utm_campaign, activite: "clients", page: "/fr/guide-ia" }), `utm_campaign « ${o.utm_campaign} »`).not.toThrow();
    }
  });
  it("utm_campaign du lien suivi = code du lien (vidéo et mot)", () => {
    const video = construireLienSuivi({ typeLien: "video", reseau: "instagram", code: "0042-TB-IG", activite: "clients", page: "/fr/diagnostic" });
    expect(utmCampaignDuLien(video)).toBe("0042-TB-IG");
    const mot = construireLienSuivi({ typeLien: "message", reseau: "instagram", code: "mot-guide", activite: "clients", page: "/fr/guide-ia" });
    expect(utmCampaignDuLien(mot)).toBe("mot-guide");
  });
  it("fragment ignoré et pourcentage décodé", () => {
    expect(utmCampaignDuLien("https://axion-ia.com/fr/appel?utm_source=x&utm_campaign=mot-guide#x")).toBe("mot-guide");
    expect(utmCampaignDuLien("https://axion-ia.com/fr/appel?utm_campaign=mot%2Dguide")).toBe("mot-guide");
    expect(utmCampaignDuLien("pas un lien")).toBeNull();
  });
  it("un lien sans utm_campaign donne null", () => {
    expect(utmCampaignDuLien("https://axion-ia.com/fr/appel?utm_source=x")).toBeNull();
  });
});
