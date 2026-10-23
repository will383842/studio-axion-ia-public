/** S2.3 — réglages du site : revendication de la certification (SITE-03), avis et témoignages (SITE-04). Inconnu = interdit. */
import { describe, expect, it } from "vitest";
import { controlerAvantSite, type EntreeControlesSite } from "@/domaine/site-videos/controles";
import type { ReglagesDuSite } from "@/domaine/site-videos/reglages-site";
import { entreeOk, passeportOk } from "./helpers-controles";

const echecs = (e: EntreeControlesSite, code: string) => controlerAvantSite(e).controles.filter((c) => c.code === code && !c.ok);
const reglages = (certifexemple: boolean | null, avis: boolean | null): ReglagesDuSite => ({ certifexempleCertificationObtenue: certifexemple, avisPublies: avis });
const avecResume = (resume: string, r: ReglagesDuSite) => entreeOk({ passeport: passeportOk({ resume }), reglagesSite: r });

describe("S2.3 SITE-03 : la certification", () => {
  const seul = "Une formation pensée avec Certifexemple en tête, pour vos équipes.";
  it("le mot seul est refusé si la certification n'est pas obtenue (faux)", () => {
    const e = echecs(avecResume(seul, reglages(false, false)), "SITE-03");
    expect(e).toHaveLength(1);
    expect(e[0].champ).toBe("resume");
    expect(e[0].message).toContain("tant que la certification n'est pas obtenue");
  });
  it("… et si le site est injoignable (null)", () => {
    expect(echecs(avecResume(seul, reglages(null, null)), "SITE-03")).toHaveLength(1);
  });
  it("… accepté si la certification est obtenue (vrai)", () => {
    expect(echecs(avecResume(seul, reglages(true, false)), "SITE-03")).toEqual([]);
    expect(controlerAvantSite(avecResume(seul, reglages(true, false))).publiable).toBe(true);
  });
  it("« certifié » + le nom est refusé MÊME si la certification est obtenue (revendication interdite)", () => {
    const e = avecResume("Une formation certifiée Certifexemple pour vos équipes.", reglages(true, true));
    expect(echecs(e, "SITE-03").length).toBeGreaterThan(0);
    expect(controlerAvantSite(e).publiable).toBe(false);
  });
  it("sans le mot, rien à signaler", () => {
    expect(echecs(avecResume("Une formation pour vos équipes.", reglages(false, false)), "SITE-03")).toEqual([]);
  });
});

describe("S2.3 SITE-04 : avis et témoignages", () => {
  const avis = "Voici un témoignage de client satisfait sur ses devis.";
  it("refusé si les avis sont coupés (faux) ou inconnus (null)", () => {
    for (const r of [reglages(false, false), reglages(true, null)]) {
      const e = echecs(avecResume(avis, r), "SITE-04");
      expect(e.length).toBeGreaterThan(0);
      expect(e[0].message).toContain("Les avis clients sont coupés");
      expect(e[0].champ).toBe("resume");
    }
  });
  it("accepté si les avis sont publiés (vrai)", () => {
    expect(echecs(avecResume(avis, reglages(false, true)), "SITE-04")).toEqual([]);
  });
  it("une vidéo « avis client » ne va pas sur le site tant que les avis sont coupés", () => {
    const e = echecs(entreeOk({ formatId: "avis-client", ecrivain: null, reglagesSite: reglages(false, false) }), "SITE-04");
    expect(e).toHaveLength(1);
    expect(echecs(entreeOk({ formatId: "avis-client", ecrivain: null, reglagesSite: reglages(false, true) }), "SITE-04")).toEqual([]);
  });
  it("un texte sans mot de témoignage passe", () => {
    expect(echecs(entreeOk(), "SITE-04")).toEqual([]);
  });
});
