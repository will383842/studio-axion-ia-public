// Refonte du Studio, fiche REF-RA3d : kit de publication, relecture de script, boutons d'arrêt, un seul orange plein sur la fiche d'un sujet.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (f: string) => readFileSync(join(process.cwd(), "src/components", f), "utf8");
const CLASSE_ORANGE = /(?:bg|text|border|ring|outline)-orange(?:-vif|-doux)?\b/;

describe("kit de publication et relecture de script : accent, pas d'orange d'interface", () => {
  it.each(["publication/KitPublication.tsx", "script/RelireScript.tsx"])("%s n'a plus de classe orange d'accent ni de pastille orange", (f) => {
    const s = lire(f);
    expect(s).not.toMatch(CLASSE_ORANGE);
    expect(s).not.toMatch(/ton="orange"/);
    expect(s).toMatch(/accent/);
  });
  it("« Valider ce script » reste le bouton principal de la relecture (pas de variante)", () => {
    expect(lire("script/RelireScript.tsx")).toMatch(/<Bouton taille="lg" icone=\{action\?\.icone \?\? iconeLancer \?\? "film"\}/);
  });
});

describe("boutons d'arrêt : jamais un orange plein", () => {
  it.each(["videos/BoutonAnnuler.tsx", "videos/BoutonArreter.tsx"])("%s : déclencheur secondaire, confirmation en danger", (f) => {
    const s = lire(f);
    expect(s).toMatch(/compact \? "fantome" : "secondaire"/);
    expect(s).toMatch(/variante="danger"/);
    expect(s).not.toMatch(/variante="principal"/);
  });
});

describe("fiche d'un sujet : un seul orange plein (la barre collée)", () => {
  it("« Reprendre l'écriture » est secondaire", () => {
    expect(lire("generateur/FicheSujet.tsx")).toMatch(/className="mt-3"\n\s+variante="secondaire"\n\s+pleineLargeur\n\s+icone="repeter"/);
  });
  it("« Fabriquer les N » est secondaire", () => {
    expect(lire("generateur/FabricationReseaux.tsx")).toMatch(/variante="secondaire"\n\s+pleineLargeur\n\s+icone="film"/);
  });
});
