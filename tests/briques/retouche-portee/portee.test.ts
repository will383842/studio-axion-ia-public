import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TYPES_OPERATIONS_RETOUCHE } from "@/briques/operations";
import { CATALOGUE_RETOUCHES } from "@/moteurs/montage-tableau/retouches";
import { estGratuite, garderPortee, PHRASES, porteesDe, PORTEE_CAS_CONCRET, PORTEE_CHAT, PORTEE_MOTEURS, PORTEE_TABLEAU } from "@/briques/retouche-portee";

const cles = (o: object) => Object.keys(o).sort();

describe("exhaustivité des catalogues", () => {
  it("chat = liste réelle", () => expect(cles(PORTEE_CHAT)).toEqual([...TYPES_OPERATIONS_RETOUCHE].sort()));
  it("tableau = CATALOGUE_RETOUCHES, avec la correspondance pages/fin/voix", () => {
    expect(cles(PORTEE_TABLEAU)).toEqual(cles(CATALOGUE_RETOUCHES));
    const attendu = { pages: "scenes", fin: "final", voix: "voix" } as const;
    for (const [type, d] of Object.entries(CATALOGUE_RETOUCHES)) expect(PORTEE_TABLEAU[type as keyof typeof PORTEE_TABLEAU]).toBe(attendu[d.refait]);
  });
  it("moteurs = liste écrite", () =>
    expect(cles(PORTEE_MOTEURS)).toEqual(["ajusterRythme", "changerAngle", "changerCadrage", "corrigerMot", "deplacerIncrustation", "modifierTitre", "planScenes", "plaquettesV4", "refaireSegmentVoix", "reglagesFilm", "remplacerIllustration"]));
  it("cas concret = liste écrite", () =>
    expect(cles(PORTEE_CAS_CONCRET)).toEqual(["changer-chiffre", "changer-mot", "changer-phrase", "deplacer-etape", "retirer-etape", "sans-le-mot"]));
});

describe("garde", () => {
  it("refuse modifier-script (chat)", () => {
    const r = garderPortee("chat", ["modifier-script"]);
    expect(r.ok).toBe(false);
    expect(r.portees).toEqual(["voix"]);
  });
  it("laisse passer ajuster-zoom et changer-mot (chat)", () => expect(garderPortee("chat", ["ajuster-zoom", "changer-mot"])).toEqual({ ok: true, portees: ["scenes"] }));
  it("refuse modifierTexteDit (tableau), accepte changerFin", () => {
    expect(garderPortee("tableau", ["modifierTexteDit"]).ok).toBe(false);
    expect(garderPortee("tableau", ["changerFin"])).toEqual({ ok: true, portees: ["final"] });
  });
  it("accepte des opérations en objet", () => expect(garderPortee("moteurs", [{ type: "corrigerMot" }]).ok).toBe(true));
  it("voixPermise laisse passer la voix, jamais l'IA", () => {
    expect(garderPortee("chat", ["modifier-script"], { voixPermise: true }).ok).toBe(true);
    expect(garderPortee("moteurs", ["refaireSegmentVoix", "remplacerIllustration"], { voixPermise: true }).ok).toBe(false);
  });
  it("refuse changerAngle (moteurs) : second angle rendu par passages", () => expect(garderPortee("moteurs", [{ type: "changerAngle" }]).ok).toBe(false));
  it("phrases sans € ni chiffre", () => {
    for (const t of ["refaireSegmentVoix", "remplacerIllustration"] as const) {
      const r = garderPortee("moteurs", [t]);
      expect(r.ok).toBe(false);
      expect(r.ok ? "" : r.phrase).not.toMatch(/[€$\d]/);
    }
    expect(Object.keys(PHRASES).sort()).toEqual(["claude", "ia", "voix"]);
    for (const p of Object.values(PHRASES)) {
      expect(p).toMatch(/payante/);
      expect(p).not.toMatch(/[€$\d]/);
    }
  });
  it("porteesDe et estGratuite", () => {
    expect(porteesDe("tableau", ["changerFin", "changerGeste", "changerFin"])).toEqual(["scenes", "final"]);
    expect(estGratuite(["scenes", "final"])).toBe(true);
    expect(estGratuite(["scenes", "voix"])).toBe(false);
    expect(estGratuite([])).toBe(true);
  });
});

describe("test statique", () => {
  it("aucun import interdit", () => {
    const dossier = join(process.cwd(), "src/briques/retouche-portee");
    const interdit = /voix|heygen|image-video|credits|budget-mensuel|mode-budget|couts|generation-claude|depense-claude|fournisseurs\/|server-only/i;
    for (const f of readdirSync(dossier)) {
      const imports = readFileSync(join(dossier, f), "utf8").split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
      for (const l of imports) expect(l, `${f}: ${l}`).not.toMatch(interdit);
    }
  });
});
