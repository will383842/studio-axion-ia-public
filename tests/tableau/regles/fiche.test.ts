/**
 * Fiche du tableau animé (TB-01) : schéma des 6 éléments branché sur la fiche commune (règle 1), références internes,
 * fiches d'exemple des 4 structures, et isolement du moteur (aucun autre moteur importé).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formesAdresse } from "../../../src/domaine/controles-script";
import {
  DESCRIPTIONS_STRUCTURES,
  FORMAT_TABLEAU,
  STRUCTURES_TABLEAU,
  TYPES_ELEMENT,
  extensionTableau,
  validerFicheTableau,
} from "../../../src/moteurs/montage-tableau/fiche";
import { textesEcrits } from "../../../src/moteurs/montage-tableau/regles";
import { EXEMPLES, contexteExemple, copie, ficheErreurCorrigee } from "./exemples";
import { accepte, element, refuse, scene, valider } from "./outils";

const base = () => copie(ficheErreurCorrigee);

describe("fiches d'exemple", () => {
  it("une fiche valide par structure, chacune de sa structure", () => {
    expect(Object.keys(EXEMPLES).sort()).toEqual([...STRUCTURES_TABLEAU].sort());
    for (const [structure, fiche] of Object.entries(EXEMPLES)) {
      expect(fiche.structure).toBe(structure);
      accepte(fiche);
    }
  });

  it("les 6 types d'éléments sont montrés par les exemples", () => {
    const types = new Set(Object.values(EXEMPLES).flatMap((f) => f.scenes.flatMap((s) => s.elements.map((e) => e.type))));
    expect([...types].sort()).toEqual([...TYPES_ELEMENT].sort());
  });

  it("textes en vouvoiement, sans prix", () => {
    for (const f of Object.values(EXEMPLES)) {
      const textes = JSON.stringify(f);
      expect(textes).not.toMatch(/€|\beuros?\b|\bdollars?\b|\$/i);
      const ecrits = [f.douleur, f.gesteMinute, ...f.scenes.flatMap((s) => [s.texteDit, ...s.elements.flatMap(textesEcrits)])];
      for (const t of ecrits) expect(formesAdresse(t), t).toEqual({ tu: false, vous: expect.any(Boolean) });
    }
  });

  it("la validation ne modifie pas la fiche et la rend telle quelle", () => {
    const f = base();
    const avant = JSON.stringify(f);
    const r = valider(f);
    expect(JSON.stringify(f)).toBe(avant);
    expect(r.ok && r.fiche).toEqual(f);
  });
});

describe("structures", () => {
  it("les 4 structures du plan, décrites", () => {
    expect([...STRUCTURES_TABLEAU]).toEqual(["erreur-corrigee", "avant-apres", "demonstration", "question-abonne"]);
    for (const s of STRUCTURES_TABLEAU) expect(DESCRIPTIONS_STRUCTURES[s].roles).toContain("preuve");
  });

  it("l'extension déclare le format", () => {
    expect(extensionTableau(contexteExemple(base())).formatId).toBe(FORMAT_TABLEAU);
  });
});

describe("règle 1 · schéma exact (fiche commune et éléments du tableau)", () => {
  const schema = "schéma exact";

  it("refuse un type d'élément inconnu", () => {
    const f = base() as unknown as { scenes: { elements: Record<string, unknown>[] }[] };
    f.scenes[1].elements[0] = { id: "e03", type: "photo", ancre: 0 };
    const [p] = refuse(f, schema);
    expect(p.message).toContain("Scène s02 · règle « schéma exact » : élément 1");
  });

  it("refuse un champ inconnu dans un élément", () => {
    const f = base();
    Object.assign(element(f, "e01", "ligne"), { couleur: "rouge" });
    expect(refuse(f, schema)[0].message).toContain("« couleur »");
  });

  it("refuse une mention autre que « Exemple illustratif », une preuve de 3 lignes, un chiffre sans source", () => {
    const f = base();
    scene(f, "s02").elements.push({ id: "m1", type: "mention", texte: "Cas réel" as "Exemple illustratif" });
    expect(refuse(f, schema)[0].sceneId).toBe("s02");

    const g = base();
    element(g, "e08", "preuve").lignes = ["Un", "Deux", "Trois"];
    expect(refuse(g, schema)[0].sceneId).toBe("s05");

    const h = base();
    scene(h, "s02").elements.push({ id: "c1", type: "chiffre", valeur: "5", ancre: 0 } as never);
    expect(refuse(h, schema)[0].message).toContain("champ « sourceId » : champ obligatoire absent");
  });

  it("refuse une fiche d'un autre format", () => {
    const f = { ...base(), formatId: "motion" };
    expect(refuse(f, "format attendu")[0].message).toContain("le format « tableau-anime » était attendu");
  });

  it("refuse une version inconnue sans la deviner", () => {
    const r = validerFicheTableau({ ...base(), version: "fiche-scenes/9" }, contexteExemple(base()));
    expect(r.ok).toBe(false);
  });
});

describe("règle 1 · références internes", () => {
  const nom = "références internes";

  it("refuse une ancre au-delà du texte dit", () => {
    const f = base();
    element(f, "e04", "dessin").ancre = 10;
    expect(refuse(f, nom, {}, false)[0].message).toBe("Scène s02 · règle « références internes » : l'élément « e04 » part du mot 11, mais le texte dit n'a que 10 mots.");
  });

  it("refuse un geste qui vise un élément d'une autre scène, et un identifiant en double", () => {
    const f = base();
    element(f, "e11", "geste").cibleId = "e01";
    expect(refuse(f, nom, {}, false)[0].message).toContain("le geste « e11 » vise « e01 », absent de la scène");
    const g = base();
    element(g, "e04", "dessin").id = "e03";
    expect(refuse(g, nom, {}, false)[0].message).toContain("l'identifiant d'élément « e03 » est déjà pris");
  });
});

describe("isolement du moteur", () => {
  it("src/moteurs/montage-tableau n'importe aucun autre moteur", () => {
    const dossier = join(process.cwd(), "src/moteurs/montage-tableau");
    for (const fichier of readdirSync(dossier).filter((n) => n.endsWith(".ts"))) {
      const source = readFileSync(join(dossier, fichier), "utf8");
      const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${fichier} importe ${i}`).not.toMatch(/^@\/moteurs\/|^\.\.\//);
      }
    }
  });
});
