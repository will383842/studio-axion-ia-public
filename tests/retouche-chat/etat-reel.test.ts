/**
 * C7-01 : FIGE l'état réel du chat de retouche (constat, aucune correction).
 * C7-02 changera les attentes 1 (porte fermée par défaut) : aujourd'hui la voie sans `generateur` répond sans aucun interrupteur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const etat = vi.hoisted(() => ({ actif: false, appelsGenerateur: [] as string[], versions: new Map<string, Record<string, unknown>>(), videos: new Map<string, Record<string, unknown>>(), choix: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ sessionApi: async () => ({ id: "s" }) }));
vi.mock("@/services/retouche-chat/generateurs-studio", () => ({
  retoucheChatActifServeur: async () => etat.actif,
  portsGenerateurStudio: (g: string) => {
    etat.appelsGenerateur.push(g);
    return { appeler: async () => ({ texte: "" }), lireVersionChoisie: async () => null, enregistrerVersion: async () => ({ versionId: "x" }), choisirVersion: async () => undefined };
  },
}));
vi.mock("@/services/_commun", () => ({
  horodatage: () => ({ creeLe: "2026-11-08T00:00:00.000Z", modifieLe: "2026-11-08T00:00:00.000Z" }),
  depots: () => ({
    videos: { obtenir: async (id: string) => etat.videos.get(id) ?? null },
    versions: { obtenir: async (id: string) => etat.versions.get(id) ?? null, enregistrer: async (v: Record<string, unknown>) => void etat.versions.set(v.id as string, v) },
  }),
}));
vi.mock("@/services/videos", () => ({ choisirVersion: async (_v: string, id: string) => void etat.choix.push(id) }));
vi.mock("@/services/fabrication", () => ({ prochainNumero: async () => 2 }));

import { POST } from "@/app/api/retouche-chat/route";
import { portsStudio } from "@/services/retouche-chat/studio";
import { appliquerRetouche, apercevoirRetouche } from "@/services/retouche-chat/service";

const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;

describe("état réel du chat de retouche (constat)", () => {
  beforeEach(() => {
    etat.actif = false;
    etat.appelsGenerateur = [];
    etat.versions.clear();
    etat.videos.clear();
    etat.choix = [];
    etat.videos.set("vid", { id: "vid", versionChoisieId: "v1" });
    etat.versions.set("v1", { id: "v1", videoId: "vid", numero: 1, commande: {}, projetMontage: { tutoriel: { plan: { plan: PLAN_DEMO } } } });
  });

  it("1. sans générateur : la route répond (aperçu, appliquer, revenir) par portsStudio(), sans aucun interrupteur", async () => {
    const a = await POST(requete({ action: "apercu", videoId: "vid", demande: "ajoute du dynamisme" }));
    expect(a.status).toBe(200);
    const r = await POST(requete({ action: "revenir", videoId: "vid", versionId: "v1" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ statut: "revenue", versionId: "v1" });
    expect(etat.choix).toEqual(["v1"]);
    expect(etat.appelsGenerateur).toEqual([]);
  });

  it("2. ports du studio : aperçu = lecture simple ; appliquer répond plan-pret sans écrire de version", async () => {
    const ports = portsStudio();
    expect(ports.rendreScenes).toBeUndefined();
    const ap = await apercevoirRetouche("vid", "ajoute du dynamisme", ports);
    expect(ap.impact.phrase).toBe("3 scènes sur 3 seront refaites, la voix ne change pas.");
    const r = await appliquerRetouche("vid", { demande: "ajoute du dynamisme", operations: ap.operations }, ports);
    expect(r.statut).toBe("plan-pret");
    expect(etat.versions.size).toBe(1);
    expect(etat.choix).toEqual([]);
  });

  it("3. générateur nommé mais réglage retoucheChat.* éteint : 403, aucun port construit", async () => {
    const r = await POST(requete({ action: "apercu", videoId: "vid", demande: "zoom", generateur: "avocat" }));
    expect(r.status).toBe(403);
    expect(etat.appelsGenerateur).toEqual([]);
  });
});
