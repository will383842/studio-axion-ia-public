import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationRetouche } from "@/briques/operations";
import { CLES_REGLAGE_RETOUCHE, adaptateurRetouche, estGenerateurRetouche, filtrerOperationsGenerateur, retoucheChatActif, scriptEstValide } from "@/services/retouche-chat/generateurs";
import { chapitresTouches, garderUnChapitre, messageChapitre, scenesARefaire, scenesDuChapitre, type ChapitreRetouche } from "@/services/retouche-chat/video-longue";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const ids = plan.scenes.map((s) => s.id);
const coupe = Math.floor(plan.scenes.length / 2);
const chapitres: ChapitreRetouche[] = [
  { id: "c1", debutMs: 0, finMs: plan.scenes[coupe].debutMs },
  { id: "c2", debutMs: plan.scenes[coupe].debutMs, finMs: plan.scenes.at(-1)!.finMs },
];

describe("vidéo longue : inscription éteinte", () => {
  it("inscrite, clé propre, script validé, jamais modifier-script", async () => {
    expect(estGenerateurRetouche("video-longue")).toBe(true);
    expect(CLES_REGLAGE_RETOUCHE["video-longue"]).toBe("retoucheChat.videoLongue");
    expect(scriptEstValide("video-longue")).toBe(true);
    expect(adaptateurRetouche("video-longue").operations).not.toContain("modifier-script");
    expect(await retoucheChatActif("video-longue", async (_c, d) => d)).toBe(false);
    expect(await retoucheChatActif("video-longue", async () => "true")).toBe(false);
    expect(await retoucheChatActif("video-longue", async () => true)).toBe(true);
  });
  it("modifier-script écarté même sur demande explicite", () => {
    const r = filtrerOperationsGenerateur("video-longue", [{ type: "modifier-script", ancien: "a", nouveau: "b" }], "modifie le script");
    expect(r.operations).toEqual([]);
  });
});

describe("chapitre = groupe de scènes", () => {
  it("les chapitres se partagent les scènes sans reste ni doublon", () => {
    const a = scenesDuChapitre(plan, chapitres[0]);
    const b = scenesDuChapitre(plan, chapitres[1]);
    expect([...a, ...b]).toEqual(ids);
  });

  it("seules les retouches du chapitre choisi passent", () => {
    const [dedans] = scenesDuChapitre(plan, chapitres[0]);
    const dehors = scenesDuChapitre(plan, chapitres[1])[0];
    const ops: OperationRetouche[] = [
      { type: "ajuster-zoom", sceneId: dedans, facteur: 1.1 },
      { type: "ajuster-zoom", sceneId: dehors, facteur: 1.1 },
    ];
    const r = garderUnChapitre(ops, plan, chapitres, "c1");
    expect(r.operations).toEqual([ops[0]]);
    expect(r.remarques).toHaveLength(1);
    expect(chapitresTouches(r.operations, plan, chapitres).map((c) => c.id)).toEqual(["c1"]);
    expect(scenesARefaire(r.operations, plan, chapitres)).toEqual(scenesDuChapitre(plan, chapitres[0]));
  });

  it("dynamisme sans scène : ramené au chapitre ; chapitre inconnu : rien ne passe", () => {
    const r = garderUnChapitre([{ type: "ajouter-dynamisme", intensite: "leger" }], plan, chapitres, "c2");
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "leger", sceneIds: scenesDuChapitre(plan, chapitres[1]) }]);
    const v = garderUnChapitre([{ type: "ajouter-dynamisme", intensite: "leger" }], plan, chapitres, "zz");
    expect(v.operations).toEqual([]);
    expect(v.remarques).toHaveLength(1);
  });

  it("habillage global écarté", () => {
    expect(garderUnChapitre([{ type: "changer-habillage", habillage: { fond: "noir" } }], plan, chapitres, "c1").operations).toEqual([]);
  });

  it("dynamisme avec sceneIds vide : ramené au chapitre (pas « toute la vidéo »)", () => {
    const r = garderUnChapitre([{ type: "ajouter-dynamisme", intensite: "fort", sceneIds: [] }], plan, chapitres, "c1");
    expect(r.operations).toEqual([{ type: "ajouter-dynamisme", intensite: "fort", sceneIds: scenesDuChapitre(plan, chapitres[0]) }]);
    expect(chapitresTouches(r.operations, plan, chapitres).map((c) => c.id)).toEqual(["c1"]);
  });

  it("habillage + transition : habillage global, écarté avec remarque", () => {
    const dedans = scenesDuChapitre(plan, chapitres[0])[0];
    const r = garderUnChapitre([{ type: "changer-habillage", habillage: { fond: "noir" }, transition: { sceneId: dedans } } as OperationRetouche], plan, chapitres, "c1");
    expect(r.operations).toEqual([]);
    expect(r.remarques).toHaveLength(1);
  });

  it("transition dans le chapitre + position hors chapitre : écartée", () => {
    const dedans = scenesDuChapitre(plan, chapitres[0])[0];
    const dehors = scenesDuChapitre(plan, chapitres[1])[0];
    const op = { type: "changer-habillage", transition: { sceneId: dedans }, position: { sceneId: dehors } } as OperationRetouche;
    const r = garderUnChapitre([op], plan, chapitres, "c1");
    expect(r.operations).toEqual([]);
    expect(r.remarques).toHaveLength(1);
  });

  it("decaler-scene écarté : des mots du chapitre 2 pour une scène du chapitre 1 ne passent pas, et rien n'est marqué à refaire", () => {
    const dedans = scenesDuChapitre(plan, chapitres[0])[0];
    const dehors = scenesDuChapitre(plan, chapitres[1])[0];
    const sortant = { type: "decaler-scene", sceneId: dedans, mots: { premier: 18, dernier: 28 } } as OperationRetouche;
    const r = garderUnChapitre([sortant], plan, chapitres, "c1");
    expect(r.operations).toEqual([]);
    expect(r.remarques).toHaveLength(1);
    expect(chapitresTouches(r.operations, plan, chapitres)).toEqual([]);
    // Décalage par durée, même pour une scène du chapitre : écarté aussi (le validateur recale les voisines).
    const decale = garderUnChapitre([{ type: "decaler-scene", sceneId: dehors, decalageMs: 200 } as OperationRetouche], plan, chapitres, "c2");
    expect(decale.operations).toEqual([]);
  });

  it("message : voix inchangée, autres chapitres intacts, aucun montant", () => {
    const m = messageChapitre(chapitres, "c2")!;
    expect(m).toBe("Seul le chapitre 2 sera refait. La voix ne change pas. L'autre reste tel quel.");
    expect(m).not.toMatch(/[€$]/);
    expect(messageChapitre(chapitres, "zz")).toBeNull();
  });
});
