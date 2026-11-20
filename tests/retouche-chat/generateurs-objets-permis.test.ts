import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";

vi.mock("server-only", () => ({}));

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;
const etat: { deja: { versionId: string; plan: PlanValide; objetsPermis?: readonly string[] } | null; entrees: unknown } = { deja: null, entrees: undefined };

vi.mock("@/briques/plan-scenes-generateurs/adaptateur", () => ({ adapterPlan: async () => ({ plan }) }));
vi.mock("@/services/_commun", () => ({
  lireParametre: async (_id: string, defaut: unknown) => defaut,
  depots: () => ({
    videos: { obtenir: async () => ({ versionChoisieId: "v1" }) },
    versions: { obtenir: async () => ({ id: "v1", commande: { entrees: etat.entrees } }) },
    plans: { lister: async () => [{ versionId: "v1", ordre: 1, texte: "Bonjour", debutSec: 0, finSec: 2 }] },
    travaux: { lister: async () => [] },
  }),
}));
vi.mock("@/services/retouche-chat/studio", () => ({
  planDuProjet: () => null,
  portsStudio: () => ({ appeler: async () => { throw new Error("pas d'appel réel"); }, lireVersionChoisie: async () => etat.deja, enregistrerVersion: async () => ({ versionId: "x" }), choisirVersion: async () => undefined }),
}));

function entreesAvec(capacites: Record<string, { permis: boolean }>) {
  const base = profilNeutre("format-essai");
  const profil: ProfilVideo = { ...base, capacites: capacites as ProfilVideo["capacites"], verrous: [] };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-16" };
  return { bibliothequeVideo: e };
}

async function lire() {
  const { portsGenerateurStudio } = await import("@/services/retouche-chat/generateurs-studio");
  return portsGenerateurStudio("avocat").lireVersionChoisie("vid");
}

beforeEach(() => {
  etat.deja = null;
  etat.entrees = undefined;
});

describe("repli « plan de départ » : liste des petits objets permis (C9-38-b-b2)", () => {
  it("éteint = identique : aucune entrée qui permet → { versionId, plan } exact, sans clé objetsPermis", async () => {
    for (const e of [undefined, {}, entreesAvec({})]) {
      etat.entrees = e;
      const r = await lire();
      expect(r).not.toBeNull();
      expect(Object.keys(r!).sort()).toEqual(["plan", "versionId"]);
      expect(r!.versionId).toBe("v1");
      expect(r!.plan).toEqual(plan);
    }
  });

  it("entrée qui permet objet.chiffre → objetsPermis contient objet-gros-chiffre, plan inchangé", async () => {
    etat.entrees = entreesAvec({ [ID.objetChiffre]: { permis: true } });
    const r = await lire();
    expect(r!.objetsPermis).toContain("objet-gros-chiffre");
    expect(r!.versionId).toBe("v1");
    expect(r!.plan).toEqual(plan);
  });

  it("chemin « deja » : rendu tel quel, sans ajout ni retrait", async () => {
    const deja = { versionId: "v9", plan };
    etat.deja = deja;
    etat.entrees = entreesAvec({ [ID.objetChiffre]: { permis: true } });
    expect(await lire()).toBe(deja);
    expect(Object.keys((await lire())!).sort()).toEqual(["plan", "versionId"]);
  });
});
