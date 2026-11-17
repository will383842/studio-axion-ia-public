/** C11-E4 — garde des textes affichés par les pièces d'écrans composés (aucune marque, aucun pseudo, aucun dénigrement). */
import { describe, expect, it } from "vitest";
import { MARQUES_INTERDITES, texteGenerique, textesGeneriques } from "../../../src/briques/motion/ecrans-couverture/textes-generiques";
import { NOMS_OUTILS } from "../../../src/briques/sous-titres/noms-outils";

describe("C11-E4 · textes génériques", () => {
  it("refuse chaque nom d'outil, sous toutes les casses et sans accent", () => {
    for (const o of NOMS_OUTILS) {
      for (const t of [o.affiche, o.affiche.toUpperCase(), o.affiche.toLowerCase(), `avec ${o.affiche} aujourd'hui`]) expect(texteGenerique(t).ok).toBe(false);
    }
    expect(texteGenerique("ÎnstagrAm").ok).toBe(false);
    expect(texteGenerique("INSTAGRAM").ok).toBe(false);
  });

  it("refuse réseaux, pseudo, mot-dièse, adresse, mentions commerciales, dénigrement, texte trop long", () => {
    for (const t of ["Instagram", "TikTok", "@marie", "#ia", "www.exemple.fr", "exemple.com", "https://x", "partenaire officiel", "Certifié", "Sponsorisé", "meilleur que l'autre", "PIRE QUE", "a".repeat(121)]) {
      expect(texteGenerique(t).ok).toBe(false);
    }
    const r = texteGenerique("@marie");
    expect(r.ok === false && r.raison.length > 0).toBe(true);
  });

  it("accepte les textes anonymes", () => {
    for (const t of ["À la main", "Avec l'IA", "Avant", "Après", "2 heures", "10 minutes", "a".repeat(120)]) expect(texteGenerique(t)).toEqual({ ok: true });
  });

  it("textesGeneriques rend la liste des refus", () => {
    expect(textesGeneriques(["Avant", "Après"])).toEqual([]);
    expect(textesGeneriques(["Avant", "@x", "Instagram"])).toHaveLength(2);
  });

  it("la liste des marques contient les réseaux et les formes d'outils", () => {
    for (const m of ["instagram", "tiktok", "google", "openai", "chatgpt", "whatsapp"]) expect(MARQUES_INTERDITES).toContain(m);
  });
});
