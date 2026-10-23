/** S2.5 — sous-titres (SITE-08), vignette (SITE-09), page pauvre (SITE-10), titre web (SITE-11). */
import { describe, expect, it } from "vitest";
import { controlerAvantSite, type EntreeControlesSite } from "@/domaine/site-videos/controles";
import { entreeOk, passeportOk } from "./helpers-controles";

const echecs = (e: EntreeControlesSite, code: string) => controlerAvantSite(e).controles.filter((c) => c.code === code && !c.ok);

describe("S2.5 SITE-08 : sous-titres", () => {
  it("sans sous-titres → bloqué", () => {
    const e = echecs(entreeOk({ sousTitres: false }), "SITE-08");
    expect(e).toHaveLength(1);
    expect(e[0].message).toBe("Il faut des sous-titres pour le site.");
    expect(controlerAvantSite(entreeOk({ sousTitres: false })).publiable).toBe(false);
  });
  it("avec sous-titres → vert", () => expect(echecs(entreeOk(), "SITE-08")).toEqual([]));
});

describe("S2.5 SITE-09 : vignette 16:9 d'au moins 1200 px", () => {
  it("sans vignette → bloqué", () => {
    const e = echecs(entreeOk({ vignette: null }), "SITE-09");
    expect(e[0].message).toBe("Il manque la vignette du site.");
  });
  it("vignette 1080×1920 seule (pas d'affiche 16:9) → bloqué", () => {
    const e = echecs(entreeOk({ vignette: { largeur: 1080, hauteur: 1920 } }), "SITE-09");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("1200");
    expect(controlerAvantSite(entreeOk({ vignette: { largeur: 1080, hauteur: 1920 } })).publiable).toBe(false);
  });
  it("1280×720 et 1200×675 → vert", () => {
    expect(echecs(entreeOk({ vignette: { largeur: 1280, hauteur: 720 } }), "SITE-09")).toEqual([]);
    expect(echecs(entreeOk({ vignette: { largeur: 1200, hauteur: 675 } }), "SITE-09")).toEqual([]);
  });
});

describe("S2.5 SITE-10 : une page qui n'est pas pauvre", () => {
  const p = passeportOk();
  it("2 « À retenir » → bloqué", () => {
    const e = echecs(entreeOk({ passeport: { ...p, aRetenir: p.aRetenir.slice(0, 2) } }), "SITE-10");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("3 points « À retenir »");
  });
  it("0 ou 4 questions → bloqué ; 2 ou 3 → vert", () => {
    expect(echecs(entreeOk({ passeport: { ...p, questions: [] } }), "SITE-10")).toHaveLength(1);
    expect(echecs(entreeOk({ passeport: { ...p, questions: [...p.questions, ...p.questions] } }), "SITE-10")).toHaveLength(1);
    expect(echecs(entreeOk({ passeport: { ...p, questions: [...p.questions, p.questions[0]] } }), "SITE-10")).toEqual([]);
    expect(echecs(entreeOk({ passeport: { ...p, questions: [p.questions[0]] } }), "SITE-10")).toHaveLength(1);
  });
  it("une question sans réponse, un « À retenir » vide, un résumé vide, une rubrique vide → bloqué", () => {
    expect(echecs(entreeOk({ passeport: { ...p, questions: [{ question: "Combien ?", reponse: " " }, p.questions[1]] } }), "SITE-10")).toHaveLength(1);
    expect(echecs(entreeOk({ passeport: { ...p, aRetenir: ["a", "b", " "] } }), "SITE-10")).toHaveLength(1);
    expect(echecs(entreeOk({ passeport: { ...p, resume: "" } }), "SITE-10")).toHaveLength(1);
    expect(echecs(entreeOk({ passeport: { ...p, rubrique: "" } }), "SITE-10")).toHaveLength(1);
  });
  it("le passeport d'essai (À retenir, questions, rubrique vides) est toujours bloqué", () => {
    const essai = { ...p, aRetenir: [], questions: [], rubrique: "", motsCles: [] };
    const e = echecs(entreeOk({ passeport: essai }), "SITE-10");
    expect(e[0].message).toContain("À retenir");
    expect(e[0].message).toContain("questions");
    expect(e[0].message).toContain("rubrique");
  });
  it("complet → vert", () => expect(echecs(entreeOk(), "SITE-10")).toEqual([]));
});

describe("S2.5 SITE-11 : titre web", () => {
  it("61 caractères → bloqué, le message donne le nombre", () => {
    const e = echecs(entreeOk({ passeport: passeportOk({ titreWeb: "x".repeat(61) }) }), "SITE-11");
    expect(e[0].message).toBe("Le titre fait 61 caractères : 60 au plus.");
    expect(e[0].champ).toBe("titreWeb");
  });
  it("60 caractères → vert", () => expect(echecs(entreeOk({ passeport: passeportOk({ titreWeb: "x".repeat(60) }) }), "SITE-11")).toEqual([]));
  it("vide → bloqué", () => expect(echecs(entreeOk({ passeport: passeportOk({ titreWeb: "  " }) }), "SITE-11")).toHaveLength(1));
  it("code interne au début → bloqué", () => {
    const e = echecs(entreeOk({ passeport: passeportOk({ titreWeb: "0005-FC-TT-L · Automatiser ses devis" }) }), "SITE-11");
    expect(e).toHaveLength(1);
    expect(e[0].message).toContain("code");
  });
});
