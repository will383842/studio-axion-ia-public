/**
 * Budget INDICATIF · Image → vidéo (moteur pur, doubles du monde, rien n'est payé).
 * Mode indicatif : le plafond de la vidéo est un repère. La caisse prévient (`signaler`) et laisse passer jusqu'à 5 × le
 * plafond ; au-delà, arrêt de sécurité (IV_PLAFOND). Sans l'outil `indicatif` (mode bloquant), le moteur est inchangé.
 * Une étape déjà payée n'est JAMAIS repayée par une relance.
 */
import { describe, expect, it } from "vitest";
import { avancerJusquAArretIV, engageCentimes, miseDeCoteScriptIV, reprendreIV } from "@/moteurs/montage-image-video";
import type { OutilsFabricationIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";
import { etatInitialIV } from "@/moteurs/montage-image-video";

function demarrer(plafondCentimes: number, indicatif?: { facteurSecurite: number }) {
  const carte = carteFixe("C");
  const m = monde();
  const signaux: string[] = [];
  const base = outilsSimules(carte, m, {});
  const o: OutilsFabricationIV = indicatif
    ? { ...base, budget: { ...base.budget, indicatif: { facteurSecurite: indicatif.facteurSecurite, signaler: async (message: string) => void signaux.push(message) } } }
    : base;
  return { m, o, signaux, e: etatInitialIV(demandeEssai(carte, { plafondCentimes })) };
}

describe("caisse Image → vidéo en mode indicatif", () => {
  it("bloquant (pas d'outil indicatif) : plafond trop bas → arrêt net, comme avant", async () => {
    const x = demarrer(10);
    const apres = await avancerJusquAArretIV(x.e, x.o);
    expect(apres.refus).toMatchObject({ code: "IV_PLAFOND", etape: "lecture" });
    expect(x.m.appelsClaude).toEqual([]);
  });

  it("indicatif : au-dessus du plafond mais sous 5 ×, la lecture part et Will est prévenu", async () => {
    const x = demarrer(10, { facteurSecurite: 5 });
    const apres = await avancerJusquAArretIV(x.e, x.o);
    expect(x.signaux.length).toBeGreaterThan(0);
    expect(x.m.appelsClaude.length).toBeGreaterThan(0);
    // La comptabilité continue : ce qui est réservé reste compté.
    expect(engageCentimes(apres)).toBeGreaterThan(10);
  });

  it("indicatif : au-delà de 5 × le plafond, arrêt de sécurité, aucun appel de plus", async () => {
    const x = demarrer(1, { facteurSecurite: 5 });
    const apres = await avancerJusquAArretIV(x.e, x.o);
    expect(apres.refus).toMatchObject({ code: "IV_PLAFOND" });
    expect(apres.refus?.message).toMatch(/Arrêt de sécurité/);
    expect(x.m.appelsClaude).toEqual([]);
  });

  it("une relance après l'arrêt de sécurité ne repaie jamais l'étape déjà payée", async () => {
    const x = demarrer(40, { facteurSecurite: 5 });
    const arret = await avancerJusquAArretIV(x.e, x.o);
    const depenses = x.m.depenses.length;
    expect(depenses).toBeGreaterThan(0);
    const engage = engageCentimes(arret);
    // Relance sans rien changer, puis après un relèvement du plafond : l'étape déjà payée (même clé de caisse) n'est jamais repayée.
    const rejeu = await avancerJusquAArretIV(reprendreIV(arret), x.o);
    const fin = await avancerJusquAArretIV(reprendreIV(rejeu, { plafondCentimes: 500 }), x.o);
    const ids = x.m.depenses.map((d) => `${d.etape}|${d.appelId}`);
    expect(new Set(ids).size).toBe(ids.length); // aucun appel réservé deux fois
    expect(engageCentimes(fin)).toBeGreaterThanOrEqual(engage);
    // La lecture de l'image (étape payée avant l'arrêt) n'est faite qu'une fois.
    const lectures = x.m.depenses.filter((d) => d.etape === "lecture");
    expect(new Set(lectures.map((d) => d.appelId)).size).toBe(lectures.length);
  });
});

describe("miseDeCoteScriptIV en mode indicatif", () => {
  const prop = (engage: number, auPlus: number, plafond: number) =>
    ({ formules: [], aTrancher: [], prix: { engageCentimes: engage, auPlusCentimes: auPlus, habituelCentimes: 0, plafondCentimes: plafond } }) as unknown as Parameters<typeof miseDeCoteScriptIV>[0];

  it("bloquant : la voix qui dépasse le prix accordé met le script de côté", () => {
    expect(miseDeCoteScriptIV(prop(100, 100, 150))).not.toBeNull();
  });
  it("indicatif : jusqu'à 5 × le prix accordé, le script passe ; au-delà, mis de côté", () => {
    expect(miseDeCoteScriptIV(prop(100, 100, 150), 5)).toBeNull();
    expect(miseDeCoteScriptIV(prop(400, 400, 150), 5)).not.toBeNull();
  });
});
