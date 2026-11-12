/** Vignettes : titre de couverture fixé par Williams, proposition depuis l'accroche, miniature affichée dans la liste. */
import { describe, expect, it } from "vitest";
import { miniatureAAfficher, proposerCouverture, verifierCouverture } from "@/domaine/couverture-vignette";

const mots = (t: string) => t.split(/\s+/).filter(Boolean);

describe("vignettes · proposition de titre depuis l'accroche", () => {
  it("jamais une coupe de fin de phrase (« comment les faire… »)", () => {
    const p = proposerCouverture("Comment les faire payer sans perdre le client, voilà ce que personne ne vous dit.");
    expect(p.texte).not.toMatch(/…|\.\.\./);
    expect(p.texte.toLowerCase()).not.toMatch(/^comment les faire/);
    expect(mots(p.texte).length).toBeGreaterThanOrEqual(3);
    expect(mots(p.texte).length).toBeLessThanOrEqual(5);
  });

  it("3 à 5 mots, sans mot outil en dernier, mot-clé présent dans le titre", () => {
    for (const a of ["Votre amende de 135 € n'est pas définitive, contestez-la dans les 45 jours.", "Pourquoi votre devis reste sans réponse depuis trois semaines ?", "Stop. Vous perdez des clients à cause d'un seul réflexe."]) {
      const p = proposerCouverture(a);
      const n = mots(p.texte).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
      expect(p.texte).not.toMatch(/\s(?:le|la|les|un|une|des|de|du|à|et|ou|que|pour|dans|sur|avec)$/i);
      expect(p.motCle).not.toBe("");
      expect(p.texte.toLowerCase()).toContain(p.motCle.toLowerCase());
    }
  });

  it("un nombre devient le mot-clé", () => {
    const p = proposerCouverture("Cette erreur coûte 135 € à chaque dossier que vous traitez.");
    expect(p.motCle).toContain("135");
    expect(p.texte).toContain("135");
  });

  it("accroche vide : le repli (titre) est utilisé, jamais de code interne", () => {
    const p = proposerCouverture("", "0005-FC-TT-L · Les trois erreurs de devis — v5");
    expect(p.texte).not.toMatch(/0005|FC-TT/);
    expect(p.texte.length).toBeGreaterThan(0);
  });
});

describe("vignettes · contrôle du titre saisi par Williams", () => {
  it("accepte 3 à 5 mots", () => expect(verifierCouverture("Vos devis sans réponse", "devis")).toEqual([]));
  it("refuse moins de 3 mots et plus de 5", () => {
    expect(verifierCouverture("Devis", "")).not.toEqual([]);
    expect(verifierCouverture("Un deux trois quatre cinq six", "")).not.toEqual([]);
  });
  it("le mot à mettre en valeur doit être dans le titre", () => {
    expect(verifierCouverture("Vos devis sans réponse", "facture")).not.toEqual([]);
    expect(verifierCouverture("Vos devis sans réponse", "")).toEqual([]);
  });
  it("refuse un mot interdit de la charte", () => expect(verifierCouverture("Faites-le vous-même vite", "")).not.toEqual([]));
});

describe("vignettes · la liste montre la miniature CHOISIE", () => {
  const m = (id: string, choisie: boolean) => ({ id, choisie, fichierId: `f-${id}` });
  it("miniatureChoisieId d'abord", () => expect(miniatureAAfficher({ miniatureChoisieId: "b" }, [m("a", true), m("b", false)])?.id).toBe("b"));
  it("sinon la marquée choisie", () => expect(miniatureAAfficher({}, [m("a", false), m("b", true)])?.id).toBe("b"));
  it("sinon aucune (jamais une image au hasard)", () => expect(miniatureAAfficher({}, [m("a", false), m("b", false)])).toBeNull());
  it("identifiant disparu : retombe sur la marquée choisie", () => expect(miniatureAAfficher({ miniatureChoisieId: "zz" }, [m("a", true)])?.id).toBe("a"));
});
