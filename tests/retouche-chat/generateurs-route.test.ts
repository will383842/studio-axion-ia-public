import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const etat = vi.hoisted(() => ({ actif: false, appels: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ sessionApi: async () => ({ id: "s" }) }));
vi.mock("@/services/retouche-chat/generateurs-studio", () => ({
  retoucheChatActifServeur: async () => etat.actif,
  portsGenerateurStudio: (g: string) => {
    etat.appels.push(g);
    return {
      appeler: async () => ({ texte: '{"operations":[]}' }),
      lireVersionChoisie: async () => null,
      enregistrerVersion: async () => ({ versionId: "x" }),
      choisirVersion: async () => undefined,
    };
  },
}));
vi.mock("@/services/retouche-chat/studio", () => ({ portsStudio: () => ({ appeler: async () => ({ texte: "" }), lireVersionChoisie: async () => null, enregistrerVersion: async () => ({ versionId: "x" }), choisirVersion: async () => undefined }) }));

import { POST } from "@/app/api/retouche-chat/route";
import { ChatRetouche } from "@/components/retouche-chat/ChatRetouche";
import { RetoucheChatGenerateur } from "@/components/retouche-chat/RetoucheChatGenerateur";

const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;

describe("route du chat de retouche avec un générateur", () => {
  beforeEach(() => {
    etat.actif = false;
    etat.appels = [];
  });

  it("réglage éteint : 403, aucun port du générateur n'est construit", async () => {
    const r = await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "avocat" }));
    expect(r.status).toBe(403);
    expect(etat.appels).toEqual([]);
  });

  it("générateur inconnu : 400", async () => {
    etat.actif = true;
    expect((await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "tableau-anime" }))).status).toBe(400);
  });

  it("réglage allumé : l'aperçu passe par les ports du générateur ; sans générateur, route R1 inchangée", async () => {
    etat.actif = true;
    const r = await POST(requete({ action: "apercu", videoId: "v", demande: "zoom", generateur: "image-video" }));
    expect(r.status).toBe(200);
    expect(etat.appels).toEqual(["image-video"]);
    etat.actif = false;
    expect((await POST(requete({ action: "apercu", videoId: "v", demande: "zoom" }))).status).toBe(200);
  });
});

describe("chat posé sur l'écran résultat", () => {
  it("éteint par défaut : rien n'est rendu ; format hors liste : rien", async () => {
    etat.actif = false;
    expect(await RetoucheChatGenerateur({ videoId: "v", formatId: "avocat" })).toBeNull();
    etat.actif = true;
    expect(await RetoucheChatGenerateur({ videoId: "v", formatId: "tableau-anime" })).toBeNull();
  });

  it("allumé : le chat est rendu, sans prix", async () => {
    etat.actif = true;
    const el = await RetoucheChatGenerateur({ videoId: "v", formatId: "facecam-animee", versionId: "v1" });
    const html = renderToStaticMarkup(el!);
    expect(html).toContain("Que voulez-vous changer ?");
    expect(html).not.toMatch(/€|prix/i);
    expect(renderToStaticMarkup(createElement(ChatRetouche, { videoId: "v", generateur: "avocat" }))).toContain("Retoucher la vidéo");
  });
});
