import { describe, expect, it } from "vitest";
import { schemaPlanBrut, schemaPlanStrict, VERSION_PLAN_SCENES } from "@/briques/plan-scenes/schema";
import { empreinteScene, scenesARerendre, avecEmpreintes } from "@/briques/plan-scenes/empreinte";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

describe("plan de scènes : schéma", () => {
  it("le plan de démo respecte le schéma strict (15 s, 3 scènes, niveaux 1 et 2)", () => {
    const r = schemaPlanStrict.safeParse(PLAN_DEMO);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(PLAN_DEMO.version).toBe(VERSION_PLAN_SCENES);
    expect(PLAN_DEMO.dureeMs).toBe(15_000);
    expect(PLAN_DEMO.scenes).toHaveLength(3);
    expect(new Set(PLAN_DEMO.scenes.map((s) => s.niveau))).toEqual(new Set([1, 2]));
  });

  it("le schéma strict refuse une pièce inconnue ; le schéma brut l'accepte (le validateur répare)", () => {
    const faux = { ...PLAN_DEMO, scenes: [{ ...PLAN_DEMO.scenes[0]!, piece: "licorne" }] };
    expect(schemaPlanStrict.safeParse(faux).success).toBe(false);
    expect(schemaPlanBrut.safeParse(faux).success).toBe(true);
  });

  it("les scènes sont liées aux mots du script (indices premier/dernier)", () => {
    for (const s of PLAN_DEMO.scenes) {
      expect(s.mots.premier).toBeLessThanOrEqual(s.mots.dernier);
      expect(PLAN_DEMO.mots[s.mots.premier]!.debutMs).toBe(s.debutMs);
    }
  });
});

describe("plan de scènes : empreinte par scène", () => {
  it("même contenu = même empreinte, stable et courte", () => {
    const s = PLAN_DEMO.scenes[0]!;
    expect(empreinteScene(s, PLAN_DEMO)).toBe(empreinteScene(structuredClone(s), PLAN_DEMO));
    expect(empreinteScene(s, PLAN_DEMO)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("l'ordre des clés ne change pas l'empreinte", () => {
    const s = PLAN_DEMO.scenes[0]!;
    const inverse = Object.fromEntries(Object.entries(s).reverse()) as typeof s;
    expect(empreinteScene(inverse, PLAN_DEMO)).toBe(empreinteScene(s, PLAN_DEMO));
  });

  it("seule la scène changée est à re-rendre", () => {
    const ancien = avecEmpreintes(PLAN_DEMO);
    const modifie = structuredClone(PLAN_DEMO);
    modifie.scenes[1]!.texte = "Un autre texte";
    const nouveau = avecEmpreintes(modifie);
    expect(scenesARerendre(ancien, nouveau)).toEqual([PLAN_DEMO.scenes[1]!.id]);
    expect(nouveau.scenes[0]!.empreinte).toBe(ancien.scenes[0]!.empreinte);
  });

  it("une scène ajoutée est à rendre ; l'empreinte ignore son propre champ et la version", () => {
    const ancien = avecEmpreintes(PLAN_DEMO);
    const s = { ...ancien.scenes[0]!, empreinte: "0000000000000000", version: 9 };
    expect(empreinteScene(s, PLAN_DEMO)).toBe(ancien.scenes[0]!.empreinte);
    const plus = avecEmpreintes({ ...PLAN_DEMO, scenes: [...PLAN_DEMO.scenes, { ...PLAN_DEMO.scenes[2]!, id: "s4" }] });
    expect(scenesARerendre(ancien, plus)).toEqual(["s4"]);
  });
});
