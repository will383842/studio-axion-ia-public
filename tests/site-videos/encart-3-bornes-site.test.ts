/** Encart vidéo, PR 3 : thèmes fermés et bornes de longueur du site, en contrôle pur (éteint par défaut). */
import { describe, expect, it } from "vitest";
import { BORNES_SITE, THEMES_SITE, controlerBornesSite, themeDeRubrique } from "@/domaine/site-videos/bornes-site";
import { controlerAvantSite } from "@/domaine/site-videos/controles";
import { entreeOk, passeportOk } from "./helpers-controles";

const texte = (n: number) => "a".repeat(n);
const passeportConforme = () =>
  passeportOk({
    titreWeb: "Automatiser ses devis en dix minutes",
    resume: texte(450),
    aRetenir: [texte(25), texte(25), texte(25)],
    questions: [
      { question: "Faut-il un logiciel pour cela ?", reponse: texte(50) },
      { question: "Combien de temps faut-il ?", reponse: texte(50) },
    ],
    rubrique: "Automatisation",
  });

describe("encart PR 3 : thèmes fermés", () => {
  it("la liste est celle du site (5 thèmes)", () => {
    expect(THEMES_SITE).toEqual(["formations-ia", "coaching-ia", "audit-ia", "automatisation", "sites-web-ia"]);
  });
  it("la rubrique saisie à la main se ramène à un thème, sinon null", () => {
    expect(themeDeRubrique("Automatisation")).toBe("automatisation");
    expect(themeDeRubrique("  audit IA ")).toBe("audit-ia");
    expect(themeDeRubrique("Formations IA")).toBe("formations-ia");
    expect(themeDeRubrique("sites-web-ia")).toBe("sites-web-ia");
    expect(themeDeRubrique("Coaching IA 1-to-1")).toBe("coaching-ia");
    expect(themeDeRubrique("Cuisine")).toBeNull();
    expect(themeDeRubrique("")).toBeNull();
  });
});

describe("encart PR 3 : bornes de longueur", () => {
  it("les bornes sont celles du site", () => {
    expect(BORNES_SITE).toMatchObject({ titre: [20, 60], resume: [400, 1500], aRetenir: [20, 200], question: [10, 160], reponse: [40, 600] });
  });
  it("un passeport conforme n'a aucun échec", () => {
    const r = controlerBornesSite(passeportConforme());
    expect(r.every((c) => c.ok && c.gravite === "bloquant" && c.code === "SITE-18")).toBe(true);
  });
  it("chaque borne manquée donne un échec bloquant qui dit OÙ", () => {
    const p = passeportConforme();
    const echecs = controlerBornesSite({ ...p, titreWeb: "Court", resume: texte(100), aRetenir: [texte(5), texte(25), texte(250)], questions: [{ question: "Q ?", reponse: texte(10) }, { question: texte(30), reponse: texte(700) }], rubrique: "Cuisine" }).filter((c) => !c.ok);
    const messages = echecs.map((c) => c.message).join("\n");
    expect(messages).toMatch(/titre/i);
    expect(messages).toMatch(/résumé/i);
    expect(messages).toMatch(/À retenir/);
    expect(messages).toMatch(/question/i);
    expect(messages).toMatch(/réponse/i);
    expect(messages).toMatch(/rubrique/i);
    expect(echecs.every((c) => c.gravite === "bloquant" && c.code === "SITE-18")).toBe(true);
    expect(echecs.find((c) => c.champ === "titreWeb")).toBeDefined();
  });
  it("borne exacte : 20 caractères de titre passent, 19 échouent ; 60 passent, 61 échouent", () => {
    const ok = (n: number) => controlerBornesSite({ ...passeportConforme(), titreWeb: texte(n) }).every((c) => c.ok);
    expect([ok(19), ok(20), ok(60), ok(61)]).toEqual([false, true, true, false]);
  });
  it("longueur brute, comme le site : les espaces autour comptent", () => {
    expect(controlerBornesSite({ ...passeportConforme(), titreWeb: `${texte(60)}  ` }).some((c) => !c.ok && c.champ === "titreWeb")).toBe(true);
    expect(controlerBornesSite({ ...passeportConforme(), resume: `${texte(1500)}\n` }).some((c) => !c.ok && c.champ === "resume")).toBe(true);
  });
  it("chaque texte : borne basse et haute, avec le bon champ", () => {
    const echec = (surcharge: object) => controlerBornesSite({ ...passeportConforme(), ...surcharge }).filter((c) => !c.ok).map((c) => c.champ);
    expect(echec({ resume: texte(399) })).toEqual(["resume"]);
    expect(echec({ resume: texte(400) })).toEqual([]);
    expect(echec({ resume: texte(1501) })).toEqual(["resume"]);
    expect(echec({ aRetenir: [texte(19), texte(25), texte(25)] })).toEqual(["aRetenir"]);
    expect(echec({ aRetenir: [texte(25), texte(25), texte(201)] })).toEqual(["aRetenir"]);
    expect(echec({ questions: [{ question: texte(9), reponse: texte(50) }, { question: texte(10), reponse: texte(50) }] })).toEqual(["questions"]);
    expect(echec({ questions: [{ question: texte(161), reponse: texte(50) }, { question: texte(10), reponse: texte(50) }] })).toEqual(["questions"]);
    expect(echec({ questions: [{ question: texte(10), reponse: texte(39) }, { question: texte(10), reponse: texte(601) }] })).toEqual(["questions", "questions"]);
  });
  it("le libellé exact du site est reconnu", () => {
    expect(themeDeRubrique("Sites web et SaaS IA")).toBe("sites-web-ia");
  });
});

describe("encart PR 3 : l'interrupteur", () => {
  it("éteint par défaut : rien ne change pour les contrôles existants", () => {
    const sans = controlerAvantSite(entreeOk());
    expect(sans.controles.some((c) => c.code === "SITE-18")).toBe(false);
    expect(sans.publiable).toBe(true);
  });
  it("allumé : un titre de plus de 60 caractères n'est signalé qu'une fois (SITE-11)", () => {
    const r = controlerAvantSite(entreeOk({ bornesDuSite: true, passeport: { ...passeportConforme(), titreWeb: texte(70) } }));
    expect(r.controles.filter((c) => !c.ok && c.champ === "titreWeb").map((c) => c.code)).toEqual(["SITE-11"]);
  });
  it("allumé : titre vide ou résumé vide : un seul signalement par champ (SITE-11, SITE-10)", () => {
    const sur = (surcharge: object) => controlerAvantSite(entreeOk({ bornesDuSite: true, passeport: { ...passeportConforme(), ...surcharge } })).controles.filter((c) => !c.ok).map((c) => `${c.code}:${c.champ}`);
    expect(sur({ titreWeb: "" })).toEqual(["SITE-11:titreWeb"]);
    expect(sur({ resume: "" })).toEqual(["SITE-10:resume"]);
  });
  it("allumé : un titre de 60 caractères suivi d'espaces est signalé par SITE-18 (longueur brute)", () => {
    const sur = controlerAvantSite(entreeOk({ bornesDuSite: true, passeport: { ...passeportConforme(), titreWeb: `${texte(60)}  ` } })).controles.filter((c) => !c.ok).map((c) => `${c.code}:${c.champ}`);
    expect(sur).toEqual(["SITE-18:titreWeb"]);
  });
  it("allumé : un passeport trop court n'est plus publiable ; un passeport conforme l'est", () => {
    expect(controlerAvantSite(entreeOk({ bornesDuSite: true })).publiable).toBe(false);
    const conforme = controlerAvantSite(entreeOk({ bornesDuSite: true, passeport: passeportConforme() }));
    expect(conforme.controles.filter((c) => c.code === "SITE-18").every((c) => c.ok)).toBe(true);
  });
});
