import { describe, expect, it } from "vitest";
import {
  accroches,
  appelDepuisLigne,
  appels,
  casUsage,
  faits,
  formats,
  interdits,
  metier,
  metiers,
  reseaux,
  sourceDesBases,
  sujets,
  tailles,
  tousLesAppels,
  voix,
} from "./index";

describe("source", () => {
  it("garde le commit et la date de la copie lue", () => {
    const s = sourceDesBases();
    expect(s.commit).toBeNull();
    expect(s.date).toBeNull();
    expect(Object.keys(s.fichiers)).toHaveLength(9);
  });
});

describe("tailles", () => {
  it("rend les quatre tailles du contrat, listes découpées", () => {
    const t = tailles();
    expect(t.map((x) => x.code)).toEqual(["TPE", "PME", "ETI", "GE"]);
    expect(t[1].reseauxPrivilegies).toContain("linkedin");
    expect(t[0].poids).toBeGreaterThan(0);
  });
});

describe("métiers", () => {
  it("rend les métiers avec mots, douleurs et objections ; retire est exclu par défaut", () => {
    const tous = metiers();
    expect(tous.length).toBeGreaterThanOrEqual(3);
    expect(tous.every((m) => m.etat !== "retire")).toBe(true);
    const m = metier("compta.expert-comptable");
    expect(m).not.toBeNull();
    expect(m!.mots).toContain("rapprochement bancaire");
    expect(m!.douleurs.length).toBeGreaterThan(0);
    expect(m!.douleurs.every((d) => d.cible === m!.code)).toBe(true);
    expect(m!.objections.every((o) => o.cible === m!.code)).toBe(true);
  });

  it("filtre par état", () => {
    expect(metiers({ etats: ["valide"] })).toEqual([]);
    expect(metiers({ etats: ["retire"] }).length).toBeGreaterThan(0);
    expect(metier("compta.expert-comptable", { etats: ["valide"] })).toBeNull();
    expect(metier("n-existe.pas")).toBeNull();
  });
});

describe("cas d'usage", () => {
  it("rend les cas d'un métier, filtrés par état", () => {
    const cas = casUsage("compta.expert-comptable");
    expect(cas.length).toBeGreaterThan(0);
    expect(cas.every((c) => c.cible === "compta.expert-comptable")).toBe(true);
    expect(cas.every((c) => c.etat !== "retire")).toBe(true);
    expect(casUsage("compta.expert-comptable", { etats: ["retire"] }).every((c) => c.etat === "retire")).toBe(true);
    expect(casUsage("n-existe.pas")).toEqual([]);
  });
});

describe("appels", () => {
  it("lit la base 7 : réseaux, publics, linkedin_page, post_texte", () => {
    const tous = tousLesAppels({ etats: ["brouillon", "propose", "valide", "retire"] });
    expect(tous).toHaveLength(124);
    const li = tous.find((a) => a.code === "fin-li-question")!;
    expect(li.reseaux).toEqual(["linkedin"]);
    expect(li.naturesLinkedin).toEqual(["profil", "page"]);
    expect(tous.find((a) => a.code === "fin-li-mot-texte")!.naturesLinkedin).toEqual(["profil"]);
    expect(tous.some((a) => a.typeContenu === "texte")).toBe(true);
    expect(tous.find((a) => a.code === "fin-ig-rdv-seul")!.public).toBe("public.clients");
    expect(tous.find((a) => a.code === "fin-ty-question")!.reseaux).toEqual(["tiktok", "youtube-shorts"]);
    expect(tous.find((a) => a.code === "fin-ig-rdv-seul")!.naturesLinkedin).toBeUndefined();
  });

  it("filtre par réseau et objectif", () => {
    const a = appels("instagram", "RENDEZ_VOUS");
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((x) => x.reseaux.includes("instagram") && x.objectif === "RENDEZ_VOUS")).toBe(true);
    expect(appels("tiktok", "CANDIDATURE").every((x) => x.public !== "public.clients")).toBe(true);
  });

  it("appelDepuisLigne : linkedin_page seul = page ; cible nue = public.<cible>", () => {
    const base = { code: "x", cible: "apporteurs", type_contenu: "post_texte", type: "lien", objectif: "CANDIDATURE", dit: "", ecran: "", legende: "é", mot: "", lien: "", emplacement: "", etat: "valide", version: "2", origine: "propose", source: "s", valide_le: "" };
    const a = appelDepuisLigne({ ...base, reseaux: "linkedin_page" });
    expect(a.reseaux).toEqual(["linkedin"]);
    expect(a.naturesLinkedin).toEqual(["page"]);
    expect(a.public).toBe("public.apporteurs");
    expect(a.typeContenu).toBe("texte");
    expect(a.version).toBe(2);
  });
});

describe("autres bases", () => {
  it("reseaux() : règles par réseau", () => {
    const toutes = reseaux();
    expect(toutes.length).toBeGreaterThan(0);
    expect(reseaux("instagram").every((r) => r.reseau === "instagram")).toBe(true);
  });
  it("voix, interdits, faits (vide), accroches, sujets, formats", () => {
    expect(voix().length).toBeGreaterThan(0);
    expect(interdits().some((i) => i.expression === "Aucun gain garanti")).toBe(true);
    expect(faits()).toEqual([]);
    const a = accroches({ etats: ["valide"] });
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].typesContenu.length).toBeGreaterThan(0);
    expect(sujets().some((s) => s.code === "a.audit" && s.actif === false)).toBe(true);
    const f = formats();
    expect(f.video.find((v) => v.code === "tableau-anime")?.codeClassement).toBe("TB");
    expect(f.autres.length).toBeGreaterThan(0);
  });
});
