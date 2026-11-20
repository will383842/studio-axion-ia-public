/* eslint-disable @typescript-eslint/no-explicit-any -- pièce factice injectée dans le catalogue, le temps du test */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { appliquerOperations } from "@/services/retouche-chat/appliquer";
import type { OperationRetouche } from "@/briques/operations";

const catalogue = CATALOGUE_BRIQUES as unknown as Record<string, any>;
const toiles = TOILES as unknown as Record<string, unknown>;
const plan0 = () => validerPlan(structuredClone(PLAN_DEMO), { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam }).plan;
const ops = (...o: unknown[]) => o as OperationRetouche[];
const VALIDES = { texte: "Essai", sousTexte: "", style: "bandeau" };

beforeEach(() => {
  catalogue["objet-test"] = { ...catalogue["legende"], id: "objet-test", nom: "Objet test", famille: "objet", alias: [] };
  toiles["objet-test"] = { largeur: 800, hauteur: 460 };
});
afterEach(() => {
  delete catalogue["objet-test"];
  delete toiles["objet-test"];
});

describe("C9-38-a : appliquerOperations et la liste des objets permis", () => {
  it("a) éteint = identique : sans option, {} et liste vide donnent le même résultat", () => {
    const p = plan0();
    const s = p.scenes;
    const lot = ops(
      { type: "changer-mot", sceneId: s[0]!.id, ancien: "Axion", nouveau: "Studio" },
      { type: "changer-brique", sceneId: s[1]!.id, piece: "carte-kpi" },
      { type: "ajouter-piece", sceneId: s[2]!.id, piece: "legende" },
      { type: "changer-transition", sceneId: s[2]!.id, dureeMs: 400 },
      { type: "retirer-scene", sceneId: s[s.length - 1]!.id },
    );
    const base = appliquerOperations(p, lot);
    expect(appliquerOperations(p, lot, {})).toEqual(base);
    expect(appliquerOperations(p, lot, { objetsPermis: [] })).toEqual(base);
  });

  it("b) avec la liste, un objet aux paramètres valides est gardé ; sans, il est remplacé", () => {
    const p = plan0();
    const o = ops({ type: "changer-brique", sceneId: p.scenes[0]!.id, piece: "objet-test", parametres: VALIDES });
    const avec = appliquerOperations(p, o, { objetsPermis: ["objet-test"] });
    expect(avec.plan.scenes[0]!.piece).toBe("objet-test");
    const sans = appliquerOperations(p, o);
    expect(sans.plan.scenes[0]!.piece).not.toBe("objet-test");
    expect(sans.remarques.some((r) => /objet non permis/i.test(r.message))).toBe(true);
  });

  it("c) avec la liste, sans paramètres : ignoré, scène inchangée, jamais l'exemple", () => {
    const p = plan0();
    const id = p.scenes[0]!.id;
    const avant = structuredClone(p.scenes[0]!);
    const cas = [
      ops({ type: "changer-brique", sceneId: id, piece: "objet-test" }),
      ops({ type: "ajouter-piece", sceneId: id, piece: "objet-test" }),
      ops({ type: "remplacer-piece", sceneId: id, ancienne: avant.piece, nouvelle: "objet-test" }),
    ];
    for (const o of cas) {
      const r = appliquerOperations(p, o, { objetsPermis: ["objet-test"] });
      expect(r.operations).toEqual([]);
      expect(r.remarques.some((x) => x.code === "OPERATION_IGNOREE" && /paramètres écrits/.test(x.message))).toBe(true);
      const s = r.plan.scenes[0]!;
      expect({ piece: s.piece, parametres: s.parametres, version: s.version, calques: (s as any).calques }).toEqual({ piece: avant.piece, parametres: avant.parametres, version: avant.version, calques: (avant as any).calques });
    }
  });

  it("d) sans la liste, les mêmes opérations donnent le résultat d'aujourd'hui (aucune remarque « paramètres écrits »)", () => {
    const p = plan0();
    const id = p.scenes[0]!.id;
    const o = ops({ type: "changer-brique", sceneId: id, piece: "objet-test" });
    const r = appliquerOperations(p, o);
    expect(r.remarques.some((x) => /paramètres écrits/.test(x.message))).toBe(false);
    expect(appliquerOperations(p, o, { objetsPermis: [] })).toEqual(r);
  });

  // C9-38-b-a (20/11, seconde lecture du pilote) : attente DÉPLACÉE, pas retirée. CollerOperations.tsx reste à exactement
  // 2 arguments ; service.ts passe la liste portée par la version lue (jamais une liste écrite en dur), 3e argument exact.
  it("e) les appelants : CollerOperations.tsx exactement 2 arguments ; service.ts 3e argument = la liste de la version lue", () => {
    const t = readFileSync("src/components/retouche-chat/CollerOperations.tsx", "utf8");
    const appels = [...t.matchAll(/appliquerOperations\(([^)]*)\)/g)];
    expect(appels.length).toBeGreaterThan(0);
    for (const a of appels) expect(a[1]!.split(",")).toHaveLength(2);

    const s = readFileSync("src/services/retouche-chat/service.ts", "utf8");
    const attendu = "appliquerOperations(courante.plan, f.operations, courante.objetsPermis?.length ? { objetsPermis: courante.objetsPermis } : {})";
    expect(s.split(attendu)).toHaveLength(3); // exactement 2 occurrences
    expect([...s.matchAll(/appliquerOperations\(/g)]).toHaveLength(2); // aucun autre appel
  });
});
