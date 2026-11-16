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
/** HTML témoin figé : rendu par le code de master 7611c14 (avant R1-09), `videoId: "v"`, générateur « avocat », réglage absent. */
const TEMOIN_CHAT = "<section aria-label=\"Retoucher la vidéo\" class=\"flex flex-col gap-3\"><ol aria-live=\"polite\" class=\"flex flex-col gap-2\"></ol><form class=\"flex gap-2\"><label class=\"sr-only\" for=\"retouche-v\">Que voulez-vous changer ?</label><input id=\"retouche-v\" placeholder=\"Que voulez-vous changer ?\" class=\"min-h-11 flex-1 rounded-lg border border-trait bg-surface-1 px-3 text-sm\" value=\"\"/><button type=\"submit\" class=\"relative inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-studio active:scale-[0.98] disabled:pointer-events-none disabled:border-surface-3 disabled:bg-surface-3 disabled:text-texte-faible disabled:shadow-none disabled:opacity-100 bg-surface-1 text-texte hover:bg-surface-2 border border-trait-fort min-h-11 px-4 text-sm gap-2\" disabled=\"\">Envoyer</button></form></section>";
const TEMOIN_GENERATEUR = "<section aria-labelledby=\"retoucher-v\" class=\"space-y-3\"><h2 id=\"retoucher-v\" class=\"text-xs font-bold uppercase tracking-wider text-texte-faible\">Retoucher par message</h2><section aria-label=\"Retoucher la vidéo\" class=\"flex flex-col gap-3\"><ol aria-live=\"polite\" class=\"flex flex-col gap-2\"></ol><form class=\"flex gap-2\"><label class=\"sr-only\" for=\"retouche-v\">Que voulez-vous changer ?</label><input id=\"retouche-v\" placeholder=\"Que voulez-vous changer ?\" class=\"min-h-11 flex-1 rounded-lg border border-trait bg-surface-1 px-3 text-sm\" value=\"\"/><button type=\"submit\" class=\"relative inline-flex select-none items-center justify-center rounded-full font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-studio active:scale-[0.98] disabled:pointer-events-none disabled:border-surface-3 disabled:bg-surface-3 disabled:text-texte-faible disabled:shadow-none disabled:opacity-100 bg-surface-1 text-texte hover:bg-surface-2 border border-trait-fort min-h-11 px-4 text-sm gap-2\" disabled=\"\">Envoyer</button></form></section></section>";
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
    expect(temoin).toBe(TEMOIN_CHAT);
    expect(renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat", coller: undefined }))).toBe(TEMOIN_CHAT);
    const avec = renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat", coller: { plan } }));
    expect(avec).toContain("Collez ici les opérations");
    expect(avec).toContain("Copier le plan");
  });
});

describe("RetoucheChatGenerateur et réglage retoucheChat.coller", () => {
  it("absent : même HTML qu'aujourd'hui, aucune lecture de plan", async () => {
    expect(await rendre()).toBe(TEMOIN_GENERATEUR);
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
  it("tableau nu collé : lu comme la liste d'opérations", () => {
    const r = apercuCollage(plan, `[{"type":"ajuster-zoom","sceneId":"${id0}","facteur":1.5},{"type":"ajuster-zoom","sceneId":"${id0}","facteur":1.2}]`);
    expect(r.ok && r.operations).toHaveLength(2);
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
