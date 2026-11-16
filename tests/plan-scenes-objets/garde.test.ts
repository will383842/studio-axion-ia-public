/** C9-04 — garde d'honnêteté des petits objets, côté Studio. Phrases tirées de tests/briques/faits-script/dix-scripts.ts. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { garderObjet } from "../../src/briques/plan-scenes-objets";
import type { DefinitionObjet } from "../../src/briques/motion/petits-objets/contrat";
import { DIX_SCRIPTS, motsHorodates } from "../briques/faits-script/dix-scripts";

const mots = motsHorodates(DIX_SCRIPTS[0]!).map((m) => ({ texte: m.texte, debutMs: m.debutMs, finMs: m.finMs }));
const ctx = { mots: mots as never, premier: 0, dernier: mots.length - 1 };
const def = (id: string, donnees: DefinitionObjet<unknown>["donnees"]) => ({ id, donnees }) as unknown as DefinitionObjet<unknown>;
const refus = (r: unknown) => typeof r === "object" && r !== null && "refus" in r;

describe("C9-04 garderObjet", () => {
  it("« +49 505 » non dit → refus", () => {
    expect(refus(garderObjet(def("objet-chiffre", "nombres-dits"), { valeur: 49505 }, ctx))).toBe(true);
  });
  it("« 20 minutes » dit → ok", () => {
    expect(garderObjet(def("objet-chiffre", "nombres-dits"), { valeur: 20 }, ctx)).toBe("ok");
  });
  it("nombre saisi sans source → refus, avec source → ok", () => {
    const d = def("objet-chiffre", "source-saisie");
    expect(refus(garderObjet(d, { valeur: 4321 }, { ...ctx, saisies: [{ valeur: 4321, source: "" }] }))).toBe(true);
    expect(garderObjet(d, { valeur: 4321 }, { ...ctx, saisies: [{ valeur: 4321, source: "Facture 12" }] })).toBe("ok");
  });
  it("texte de 5 mots → refus ; 4 mots contigus (sans accents ni casse) → ok ; non contigus → refus", () => {
    const d = def("objet-etiquette", "mots-dits");
    expect(refus(garderObjet(d, { texte: "Vous perdez deux heures par" }, ctx))).toBe(true);
    expect(garderObjet(d, { texte: "VOUS PERDEZ DEUX HEURES" }, ctx)).toBe("ok");
    expect(garderObjet(d, { texte: "perdez heures" }, ctx)).not.toBe("ok");
    expect(garderObjet(def("objet-etiquette", "mots-dits"), { texte: "assistant mails" }, ctx)).not.toBe("ok");
  });
  it("commande de terminal : mots dits aussi", () => {
    expect(refus(garderObjet(def("objet-ecran", "aucune"), { commande: "rm -rf" }, ctx))).toBe(true);
    expect(garderObjet(def("objet-ecran", "aucune"), { commande: "Essayez dès lundi" }, ctx)).toBe("ok");
  });
  it("« VALIDÉ » sans preuve → refus ; avec preuve → ok", () => {
    const d = def("objet-etape", "aucune");
    expect(refus(garderObjet(d, { texte: "VALIDÉ" }, ctx))).toBe(true);
    expect(refus(garderObjet(d, { valide: true, preuve: "  " }, ctx))).toBe(true);
    expect(garderObjet(d, { valide: true, preuve: "capture-12" }, ctx)).toBe("ok");
  });
  it("profil / commentaires : aucun nombre, illustration obligatoire", () => {
    const d = def("objet-profil", "aucune");
    expect(refus(garderObjet(d, { nom: "Marie", abonnes: 12000, illustration: true }, ctx))).toBe(true);
    expect(refus(garderObjet(d, { nom: "Marie" }, ctx))).toBe(true);
    expect(garderObjet(d, { nom: "Marie", illustration: true }, ctx)).toBe("ok");
    expect(refus(garderObjet(def("objet-commentaires", "aucune"), { texte: "Super", illustration: true, jaime: 3 }, ctx))).toBe(true);
  });
  it("aucune : ok", () => {
    expect(garderObjet(def("objet-trait", "aucune"), { x: 1 }, ctx)).toBe("ok");
  });
  it("jamais d'exception sur des entrées folles", () => {
    for (const d of ["nombres-dits", "mots-dits", "source-saisie", "aucune"] as const)
      for (const p of [null, undefined, {}, [], 5, "x", { texte: null }, { valeur: NaN }, { a: { b: [1, null] } }])
        for (const c of [null, undefined, {}, ctx, { ...ctx, mots: null }])
          expect(() => garderObjet(def("objet-x", d), p, c as never)).not.toThrow();
    expect(() => garderObjet(null as never, {}, ctx)).not.toThrow();
  });
  it("garde statique : le rendu n'importe pas plan-scenes-objets", () => {
    const racines = [join(__dirname, "..", "..", "src"), join(__dirname, "..", "..", "studio-rendu")];
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.tsx?$/.test(n)) fichiers.push(p);
      }
    };
    racines.forEach(parcourir);
    const fautifs = fichiers.filter((f) => !f.includes("plan-scenes-objets") && /studio-rendu|briques[\\/]motion/.test(f) && readFileSync(f, "utf8").includes("plan-scenes-objets"));
    expect(fautifs).toEqual([]);
  });
});
