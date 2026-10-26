/**
 * Zéro blocage (mise en scène, rendu, livraison) : chaque refus devient une réparation automatique et une remarque.
 * Seul un rendu vraiment impossible (ErreurRenduDefinitifIV) arrête encore la fabrication.
 */
import { describe, expect, it, vi } from "vitest";
import { avancerIV, attendWillIV, avancerJusquAArretIV, ErreurRenduDefinitifIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import type { EntreeMiseEnSceneIV, ResultatMiseEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const mode = vi.hoisted(() => ({ v: "normal" as "normal" | "refus-sauf-texte-seul" | "refus-toujours" | "panne-sauf-texte-seul" }));

vi.mock("@/moteurs/montage-image-video/mise-en-scene", async (orig) => {
  const reel = await orig<typeof import("@/moteurs/montage-image-video/mise-en-scene")>();
  return {
    ...reel,
    mettreEnSceneIV: (entree: EntreeMiseEnSceneIV): ResultatMiseEnSceneIV => {
      const complexe = entree.fiche.ecrans.some((e) => e.scene !== "titre");
      if (mode.v === "panne-sauf-texte-seul" && complexe) throw new Error("panne factice");
      const r = reel.mettreEnSceneIV(entree);
      const refuse = mode.v === "refus-toujours" || (mode.v === "refus-sauf-texte-seul" && complexe);
      return refuse ? { ...r, ok: false, rapport: { ...r.rapport, bloquants: [{ code: "Q99", phrase: "refus factice" } as never] }, phrases: ["refus factice"] } : r;
    },
  };
});

async function prete(): Promise<{ fini: EtatFabricationIV; o: OutilsFabricationIV }> {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { formats: {} })), o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    else break;
  }
  expect(e.etape).toBe("prete");
  return { fini: e, o };
}

const depuis = (fini: EtatFabricationIV, etape: "mise-en-scene" | "rendu"): EtatFabricationIV => {
  const e = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
  e.etape = etape;
  delete e.refus;
  delete e.scenes;
  delete e.ecransAdaptes;
  delete e.rendus;
  delete e.controles;
  delete e.livraison;
  return e;
};

describe("mise en scène : jamais d'arrêt sur un refus", () => {
  it("refus → composition plus simple (texte seul) + remarque, la fabrication continue", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-sauf-texte-seul";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.refus).toBeUndefined();
    expect(e.journal.some((j) => j.startsWith("Remarque · mise en scène") && j.includes("texte seul"))).toBe(true);
    expect(Object.values(e.ecransAdaptes ?? {}).flat().length).toBeGreaterThan(0);
  });

  it("panne de la mise en scène → composition plus simple, pas d'IV_PANNE", async () => {
    const { fini, o } = await prete();
    mode.v = "panne-sauf-texte-seul";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.journal.some((j) => j.includes("panne factice"))).toBe(true);
  });

  it("refus même en texte seul, avec une version précédente → la précédente est gardée", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-toujours";
    const e = await avancerIV({ ...depuis(fini, "mise-en-scene"), scenes: fini.scenes }, o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.scenes).toEqual(fini.scenes);
    expect(e.journal.some((j) => j.includes("version précédente gardée"))).toBe(true);
  });

  it("refus même en texte seul, sans version précédente → la composition simple continue avec une remarque", async () => {
    const { fini, o } = await prete();
    mode.v = "refus-toujours";
    const e = await avancerIV(depuis(fini, "mise-en-scene"), o);
    mode.v = "normal";
    expect(e.etape).toBe("rendu");
    expect(e.refus).toBeUndefined();
    expect(e.journal.some((j) => j.startsWith("Remarque · mise en scène"))).toBe(true);
  });
});

describe("rendu : une panne est refaite, seul l'impossible arrête", () => {
  it("panne passagère → refait une fois, remarque au journal", async () => {
    const { fini, o } = await prete();
    let appels = 0;
    const outils: OutilsFabricationIV = { ...o, rendre: async (d) => (++appels === 1 ? Promise.reject(new Error("serveur de rendu coupé")) : o.rendre(d)) };
    const e = await avancerIV(depuis(fini, "rendu"), outils);
    expect(e.refus).toBeUndefined();
    expect(appels).toBe(2);
    expect(e.journal.some((j) => j.includes("refait automatiquement une fois"))).toBe(true);
  });

  it("rendu vraiment impossible → IV_RENDU, non réessayable", async () => {
    const { fini, o } = await prete();
    const outils: OutilsFabricationIV = { ...o, rendre: async () => Promise.reject(new ErreurRenduDefinitifIV("Irrendable.", ["écran trop long"])) };
    const e = await avancerIV(depuis(fini, "rendu"), outils);
    expect(e.refus?.code).toBe("IV_RENDU");
    expect(e.refus?.reessayable).toBe(false);
  });
});

describe("livraison : un réseau sans fichier ne bloque pas les autres", () => {
  it("rend à nouveau une fois, puis livre les autres réseaux avec une remarque", async () => {
    const { fini, o } = await prete();
    const cible = fini.livraison!.find((l) => l.version !== "aucune")!.reseau;
    const base = JSON.parse(JSON.stringify(fini)) as EtatFabricationIV;
    base.etape = "livraison";
    base.livraison = base.livraison!.map((l) => (l.reseau === cible ? { ...l, fichierCle: undefined } : l));
    // 1) premier passage : retour au rendu, une seule fois.
    const retour = await avancerIV(base, o);
    expect(retour.etape).toBe("rendu");
    expect(retour.tentatives.livraison).toBe(2);
    // 2) toujours sans fichier au second passage : les autres partent, le réseau est noté « aucune ».
    const encore = JSON.parse(JSON.stringify(base)) as EtatFabricationIV;
    encore.tentatives.livraison = 2;
    const e = await avancerIV(encore, o);
    expect(e.etape).toBe("prete");
    expect(e.refus).toBeUndefined();
    expect(e.livraison!.find((l) => l.reseau === cible)!.version).toBe("aucune");
    expect(e.livraison!.filter((l) => l.version !== "aucune").length).toBeGreaterThan(0);
    expect(e.journal.some((j) => j.startsWith("Remarque · aucun fichier"))).toBe(true);
  });
});
