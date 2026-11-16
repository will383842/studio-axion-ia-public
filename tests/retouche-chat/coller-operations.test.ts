import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const etat = vi.hoisted(() => ({ actif: true, coller: undefined as unknown, plan: null as unknown, lectures: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/retouche-chat/generateurs-studio", () => ({
  retoucheChatActifServeur: async () => etat.actif,
  portsGenerateurStudio: () => ({
    lireVersionChoisie: async () => {
      etat.lectures++;
      return etat.plan ? { versionId: "v1", plan: etat.plan } : null;
    },
  }),
}));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (id: string, defaut: unknown) => (id === "retoucheChat.coller" && etat.coller !== undefined ? etat.coller : defaut),
}));

import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { ChatRetouche } from "@/components/retouche-chat/ChatRetouche";
import { apercuCollage } from "@/components/retouche-chat/CollerOperations";
import { RetoucheChatGenerateur } from "@/components/retouche-chat/RetoucheChatGenerateur";

const plan = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const rendre = async () => renderToStaticMarkup((await RetoucheChatGenerateur({ videoId: "v", formatId: "avocat" }))!);
const id0 = plan.scenes[0]!.id;

beforeEach(() => {
  etat.actif = true;
  etat.coller = undefined;
  etat.plan = plan;
  etat.lectures = 0;
});

describe("ChatRetouche", () => {
  it("sans `coller` : HTML identique au témoin ; avec : la zone apparaît", () => {
    const temoin = renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat" }));
    expect(renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat", coller: undefined }))).toBe(temoin);
    expect(temoin).not.toContain("Collez ici les opérations");
    const avec = renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat", coller: { plan } }));
    expect(avec).toContain("Collez ici les opérations");
    expect(avec).toContain("Copier le plan");
  });
});

describe("RetoucheChatGenerateur et réglage retoucheChat.coller", () => {
  it("absent : même HTML qu'aujourd'hui, aucune lecture de plan", async () => {
    const h = await rendre();
    expect(h).toContain("Que voulez-vous changer ?");
    expect(h).not.toContain("Collez ici les opérations");
    expect(etat.lectures).toBe(0);
  });
  it("`true` : la zone est présente ; `\"true\"` (chaîne) : absente", async () => {
    etat.coller = true;
    expect(await rendre()).toContain("Collez ici les opérations");
    etat.coller = "true";
    expect(await rendre()).not.toContain("Collez ici les opérations");
  });
  it("`true` mais aucun plan trouvé : rien de plus", async () => {
    etat.coller = true;
    etat.plan = null;
    expect(await rendre()).not.toContain("Collez ici les opérations");
  });
});

describe("aperçu du collage (dans le navigateur)", () => {
  it("JSON valide : opérations lues, phrase d'impact", () => {
    const r = apercuCollage(plan, `Voici :\n\`\`\`json\n{"operations":[{"type":"ajuster-zoom","sceneId":"${id0}","facteur":1.5}]}\n\`\`\``);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operations).toHaveLength(1);
      expect(r.impact.phrase).toMatch(/scène/);
    }
  });
  it("texte illisible : message de relecture", () => {
    const r = apercuCollage(plan, "pas du json");
    expect(r).toEqual({ ok: false, message: "Je n'ai pas pu lire ces opérations : collez le bloc entier." });
  });
  it("modifier-script : lu par l'aperçu (c'est la route qui l'écarte sans demande explicite)", () => {
    const r = apercuCollage(plan, '{"operations":[{"type":"modifier-script","ancien":"devis","nouveau":"offres"}]}');
    expect(r.ok && r.operations[0]!.type).toBe("modifier-script");
  });
  it("plus de 20 opérations : remarque", () => {
    const ops = Array.from({ length: 21 }, () => ({ type: "ajuster-zoom", sceneId: id0, facteur: 1.2 }));
    const r = apercuCollage(plan, JSON.stringify({ operations: ops }));
    expect(r.ok && r.operations).toHaveLength(20);
    expect(r.ok && r.remarques.join(" ")).toMatch(/Au plus 20/);
  });
});
