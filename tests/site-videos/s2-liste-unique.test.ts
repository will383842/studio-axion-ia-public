/** S2.2 — garde-fou « liste unique » : les contrôles LISENT la liste des interdits, ils n'en recopient aucune. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { entreeOk, passeportOk } from "./helpers-controles";

describe("S2.2 liste unique des interdits", () => {
  it("controles.ts n'écrit aucun mot interdit (lecture du fichier source, casse ignorée)", () => {
    const source = readFileSync("src/domaine/site-videos/controles.ts", "utf8").toLowerCase();
    for (const mot of ["villeexemple", "gain garanti", "certifexemple", "témoignage"]) expect(source, mot).not.toContain(mot);
  });

  it("aucun autre fichier du dossier site-videos n'écrit ces mots non plus", () => {
    for (const f of ["chapitres", "passeport", "types", "constantes", "index"]) {
      const source = readFileSync(`src/domaine/site-videos/${f}.ts`, "utf8").toLowerCase();
      for (const mot of ["villeexemple", "gain garanti"]) expect(source, `${f}: ${mot}`).not.toContain(mot);
    }
  });

  it("ajouter une entrée à la liste unique (double de module) change le verdict", async () => {
    const texte = "Le zébulon est interdit ici.";
    const avant = (await import("@/domaine/site-videos/controles")).controlerAvantSite(entreeOk({ passeport: passeportOk({ resume: texte }) }));
    expect(avant.publiable).toBe(true);

    vi.resetModules();
    vi.doMock("@/domaine/qualite-script/regles/interdits", async (original) => {
      const m = await original<typeof import("@/domaine/qualite-script/regles/interdits")>();
      const test = (t: string) => t.toLowerCase().includes("zébulon");
      const extra = { cle: "zebulon", libelle: "« zébulon »", sources: ["test"], portee: ["ecrire", "tableau", "cas-concret", "image-video"] as ("ecrire" | "tableau" | "cas-concret" | "image-video")[], tests: { ecrire: test, tableau: test, "cas-concret": test, "image-video": test } };
      return { ...m, LISTE_INTERDITS: [...m.LISTE_INTERDITS, extra], interditsCommuns: () => [...m.interditsCommuns(), extra] };
    });
    const { controlerAvantSite } = await import("@/domaine/site-videos/controles");
    const apres = controlerAvantSite(entreeOk({ passeport: passeportOk({ resume: texte }) }));
    vi.doUnmock("@/domaine/qualite-script/regles/interdits");
    vi.resetModules();
    expect(apres.publiable).toBe(false);
    expect(apres.controles.some((c) => c.code === "SITE-01" && !c.ok && c.message.includes("zébulon"))).toBe(true);
  });
});
