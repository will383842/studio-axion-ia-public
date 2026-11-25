/**
 * X2-11b-b · option `refusCommun` du tirage (variété commune du réseau) : éteint = tirage identique ; une ouverture refusée
 * n'est plus tirée (sauf au dernier niveau de relâche) ; jamais de blocage ni d'exception ; aucun appelant dans le Studio.
 */
import { describe, expect, it } from "vitest";
import { NIVEAUX_DE_RELACHE, OUVERTURES, contraintesNonTenues, entreeHistorique, tirer, type DemandeTirage, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import { outilsVarieteDuStudio } from "@/services/cas-concret-variete";

const LE = "2026-10-15T12:00:00.000Z";
const CANAUX = ["linkedin"] as const;
const DERNIER = NIVEAUX_DE_RELACHE.length - 1;
const IDS = Array.from({ length: 20 }, (_, i) => `v-refus-${i}`);

/** Historique de départ : une série de tirages d'autres vidéos, comme dans variete.test.ts (hasard semé, sans refus). */
function historiqueDe(): ReturnType<typeof entreeHistorique>[] {
  const h: ReturnType<typeof entreeHistorique>[] = [];
  for (let i = 0; i < 6; i++) {
    const t = tirer({ videoId: `v-passe-${i}`, canaux: ["linkedin"], historique: h });
    h.push(entreeHistorique(`v-passe-${i}`, ["linkedin"], t, LE));
  }
  return h;
}
const demande = (videoId: string, extra: Partial<DemandeTirage> = {}): DemandeTirage => ({ videoId, canaux: CANAUX, historique: historiqueDe(), ...extra });

describe("X2-11b-b · refusCommun du tirage", () => {
  it("(a) éteint = identique : sans option, undefined, ou () => null → trois tirages égaux", () => {
    for (const id of IDS) {
      const sans = tirer(demande(id));
      expect(tirer(demande(id, { refusCommun: undefined }))).toEqual(sans);
      expect(tirer(demande(id, { refusCommun: () => null }))).toEqual(sans);
    }
  });

  it("(b) une ouverture refusée n'est plus tirée, sauf au dernier niveau de relâche", () => {
    const refus = (t: Tirage) => (t.ouverture === "chiffre-choc" ? "même ouverture que le réseau" : null);
    // Garde : sur master (sans refus) cette ouverture sort bien pour certaines des 20 vidéos.
    const de_toujours = IDS.map((id) => tirer(demande(id)));
    expect(de_toujours.some((t) => t.ouverture === "chiffre-choc")).toBe(true);
    for (const id of IDS) {
      const t = tirer(demande(id, { refusCommun: refus }));
      if (t.relache < DERNIER) expect(t.ouverture).not.toBe("chiffre-choc");
    }
    expect(IDS.map((id) => tirer(demande(id, { refusCommun: refus }))).filter((t) => t.ouverture === "chiffre-choc" && t.relache < DERNIER)).toEqual([]);
  });

  it("(c) un refus qui rejette tout : le tirage rend quand même, au dernier niveau ou au repli", () => {
    for (const id of IDS) {
      const t = tirer(demande(id, { refusCommun: () => "tout est refusé" }));
      expect(t.relache).toBe(DERNIER);
      expect(OUVERTURES).toContain(t.ouverture);
    }
  });

  it("(d) un refus qui lève : même tirage qu'éteint", () => {
    for (const id of IDS) {
      const sans = tirer(demande(id));
      expect(tirer(demande(id, { refusCommun: () => { throw new Error("panne"); } }))).toEqual(sans);
    }
  });

  it("(e) contraintesNonTenues : « variété commune » au niveau 0, jamais au dernier niveau", () => {
    const t = tirer(demande("v-refus-e"));
    const contexte = { videoId: "v-refus-e", canaux: CANAUX, historique: [], refusCommun: () => "trop proche" };
    expect(contraintesNonTenues(t, contexte, 0)).toContain("variété commune : trop proche");
    expect(contraintesNonTenues(t, contexte, DERNIER).some((r) => r.startsWith("variété commune"))).toBe(false);
    expect(contraintesNonTenues(t, { ...contexte, refusCommun: () => null }, 0)).toEqual(contraintesNonTenues(t, { videoId: "v-refus-e", canaux: CANAUX, historique: [] }, 0));
  });

  it("(f) un OutilsVariete sans refusCommun compile ; outilsVarieteDuStudio() en porte un (X2-11b-c)", () => {
    const sans = { lireHistorique: async () => [], ajouter: async () => {} } satisfies OutilsVariete;
    expect(sans).not.toHaveProperty("refusCommun");
    expect(Object.keys(outilsVarieteDuStudio())).toContain("refusCommun");
  });
});
