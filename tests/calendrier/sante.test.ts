import { describe, expect, it } from "vitest";
import { evaluerSante } from "@/services/calendrier-sante";

const H = "2026-12-01T09:00:00.000Z";
const min = (n: number) => new Date(Date.parse(H) + n * 60000).toISOString();
const c = (o = {}) => ({ id: "c1", statut: "programme" as const, heuresParReseau: { instagram: H }, ...o });

describe("evaluerSante", () => {
  it("+21 min → une alerte", () => {
    const a = evaluerSante([c()], min(21));
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ creneauId: "c1", cle: "alerte:c1" });
  });
  it("+19 min → rien", () => {
    expect(evaluerSante([c()], min(19))).toEqual([]);
  });
  it("une seule alerte par créneau même avec plusieurs réseaux en retard", () => {
    const x = c({ heuresParReseau: { instagram: H, tiktok: min(1) } });
    expect(evaluerSante([x], min(60))).toHaveLength(1);
  });
  it("pas de nouvelle alerte si déjà alerté", () => {
    expect(evaluerSante([c()], min(60), new Set(["alerte:c1"]))).toEqual([]);
  });
  it("publié, échec, archivé, proposé : aucune alerte", () => {
    for (const statut of ["publie", "echec", "archive", "propose"] as const) expect(evaluerSante([c({ statut })], min(60))).toEqual([]);
  });
  it("valide jamais programmé en retard : alerte « jamais envoyé »", () => {
    const a = evaluerSante([c({ statut: "valide" })], min(30));
    expect(a[0].motif).toMatch(/Jamais/);
  });
  it("avant l'heure : rien", () => {
    expect(evaluerSante([c()], min(-5))).toEqual([]);
  });
  it("instant « maintenant » invalide : erreur, pas d'alerte en masse", () => {
    expect(() => evaluerSante([c()], "pas-une-date")).toThrow(/invalide/);
  });
});
