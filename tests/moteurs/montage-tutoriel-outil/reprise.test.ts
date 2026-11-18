/** T-EXT-45a : registre des dépenses et règle de reprise (pur, 0 €, aucun appel réel). */
import { describe, expect, it, vi } from "vitest";
import type { RenduTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { bilanReprise, cleAppel, dejaPaye, payerUneFois, relancerRendusTombes, type RegistrePaye } from "@/moteurs/montage-tutoriel-outil/reprise";

const MAINTENANT = "2026-11-18T10:00:00.000Z";

describe("payerUneFois", () => {
  it("même entrée deux fois : faire appelé 1 fois, repris à la 2e", async () => {
    const faire = vi.fn(async () => ({ texte: "payé" }));
    const a = await payerUneFois(undefined, "script", "e1", faire, MAINTENANT);
    expect(a.repris).toBe(false);
    const b = await payerUneFois(a.registre, "script", "e1", faire, MAINTENANT);
    expect(b.repris).toBe(true);
    expect(b.resultat).toEqual({ texte: "payé" });
    expect(faire).toHaveBeenCalledTimes(1);
  });

  it("entrée changée : nouvel appel légitime", async () => {
    const faire = vi.fn(async () => 1);
    const a = await payerUneFois(undefined, "plan", "e1", faire, MAINTENANT);
    const b = await payerUneFois(a.registre, "plan", "e2", faire, MAINTENANT);
    expect(b.repris).toBe(false);
    expect(faire).toHaveBeenCalledTimes(2);
    expect(Object.keys(b.registre)).toHaveLength(2);
  });

  it("autre étape, même empreinte : nouvel appel", async () => {
    const faire = vi.fn(async () => 1);
    const a = await payerUneFois(undefined, "script", "e1", faire, MAINTENANT);
    await payerUneFois(a.registre, "plan", "e1", faire, MAINTENANT);
    expect(faire).toHaveBeenCalledTimes(2);
  });

  it("faire qui lève : registre inchangé, erreur remontée telle quelle", async () => {
    const registre: RegistrePaye = {};
    const erreur = new Error("Claude en panne");
    await expect(payerUneFois(registre, "script", "e1", async () => { throw erreur; }, MAINTENANT)).rejects.toBe(erreur);
    expect(registre).toEqual({});
  });

  it("ne modifie pas le registre reçu", async () => {
    const registre: RegistrePaye = {};
    await payerUneFois(registre, "script", "e1", async () => 1, MAINTENANT);
    expect(registre).toEqual({});
  });

  it("le registre garde étape, empreinte, résultat et date", async () => {
    const r = await payerUneFois(undefined, "script", "e1", async () => "ok", MAINTENANT);
    expect(r.registre[cleAppel("script", "e1")]).toEqual({ etape: "script", empreinteEntree: "e1", resultat: "ok", faitLe: MAINTENANT });
  });
});

describe("dejaPaye", () => {
  it("rend le résultat gardé, ou null", async () => {
    const r = await payerUneFois(undefined, "script", "e1", async () => "ok", MAINTENANT);
    expect(dejaPaye(r.registre, "script", "e1")).toBe("ok");
    expect(dejaPaye(r.registre, "script", "e2")).toBeNull();
    expect(dejaPaye(r.registre, "plan", "e1")).toBeNull();
    expect(dejaPaye(undefined, "script", "e1")).toBeNull();
  });
});

const demande = { idRendu: "t-4:5-0" } as unknown as RenduTutoriel["demande"];
const fini: RenduTutoriel = { ratio: "4:5", demande, essai: 1, sortie: { fichierCle: "a.mp4", dureeSec: 45, taille: 10 } };
const tombe: RenduTutoriel = { ratio: "9:16", demande, essai: 3 };

describe("relancerRendusTombes", () => {
  it("rendu fini intact, rendu tombé en série 1, essai 0, à soumettre", () => {
    const etat = relancerRendusTombes({ rendus: [fini, tombe] });
    expect(etat.rendus[0]).toBe(fini);
    expect(etat.rendus[1]).toMatchObject({ ratio: "9:16", essai: 0, serie: 1, aSoumettre: true });
    expect(etat.rendus[1]!.sortie).toBeUndefined();
  });

  it("une série déjà là est incrémentée", () => {
    const une = relancerRendusTombes({ rendus: [tombe] });
    const deux = relancerRendusTombes({ rendus: [{ ...une.rendus[0]!, essai: 3 }] });
    expect(deux.rendus[0]).toMatchObject({ serie: 2, essai: 0, aSoumettre: true });
  });

  it("ne modifie pas l'état reçu", () => {
    const etat = { rendus: [tombe] };
    relancerRendusTombes(etat);
    expect(etat.rendus[0]).toBe(tombe);
    expect((tombe as { serie?: number }).serie).toBeUndefined();
  });
});

describe("bilanReprise", () => {
  const audio = { dureeSec: 45, mots: [], empreinte: "x", reutilise: false };
  const etat = { audio, rendus: [fini, tombe] } as unknown as Parameters<typeof bilanReprise>[0];

  it("dit ce qui est gardé et ce qui est refait", () => {
    const b = bilanReprise(etat, ["exports"]);
    expect(b.garde).toContain("voix");
    expect(b.garde).toContain("rendu 4:5");
    expect(b.refait).toEqual(["rendu 9:16"]);
    expect(b.phrase).toContain("La voix déjà lue est gardée : elle ne sera pas payée une deuxième fois.");
    expect(b.phrase).toContain("Seul le rendu 9:16 est refait.");
  });

  it("aucune phrase ne contient de montant", () => {
    const cas = [
      bilanReprise(etat, ["exports"]),
      bilanReprise(etat, ["voix"]),
      bilanReprise({ rendus: [] } as unknown as Parameters<typeof bilanReprise>[0], ["plan"]),
      bilanReprise({ rendus: [] } as unknown as Parameters<typeof bilanReprise>[0], []),
    ];
    for (const b of cas) {
      expect(b.phrase).not.toMatch(/\d\s*(€|euro|\$)/i);
      expect(b.phrase).not.toMatch(/euro|€|\$/i);
    }
  });
});
