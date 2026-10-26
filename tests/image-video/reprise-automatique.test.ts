/**
 * Reprise automatique · Image → vidéo. La génération ne bloque jamais et ne demande pas à Will de reprendre à la main :
 * 1) panne passagère → même étape relancée jusqu'à 3 fois, attente croissante, rien de repayé ;
 * 2) refus de forme réessayable → une relance en mode réparé avant d'échouer ;
 * 3) échec réel → cause en français simple + ce qui a été essayé, « Refaire cette partie » reste possible ;
 * 4) le prix annoncé ne bloque jamais tant que le crédit réel suffit.
 * Doubles du monde, rien n'est payé.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, engageCentimes, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV } from "@/moteurs/montage-image-video";
import type { DecisionCarteIV, DecisionScriptIV, EtatFabricationIV, OutilsFabricationIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai, monde, outilsSimules, type OptionsMonde } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const decisionCarte = (e: EtatFabricationIV): DecisionCarteIV => ({ proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" });
const decisionScript = (e: EtatFabricationIV): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
});

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    else break;
  }
  return e;
}

function monter(options: OptionsMonde = {}, plus: Parameters<typeof demandeEssai>[1] = {}) {
  const carte = carteFixe("C");
  const m = monde();
  const pauses: number[] = [];
  const base = outilsSimules(carte, m, options);
  const o: OutilsFabricationIV = { ...base, pause: async (ms) => void pauses.push(ms) };
  return { carte, m, base, o, pauses, e: etatInitialIV(demandeEssai(carte, plus)) };
}

describe("reprise automatique", () => {
  it("1 · panne passagère : même étape relancée seule (attente croissante), la voix payée n'est pas repayée", async () => {
    const x = monter({ pannesVoix: [1, 2] });
    const e = await jusquAuBout(x.e, x.o);
    expect(e.etape).toBe("prete");
    expect(x.pauses).toEqual([2000, 5000]);
    expect(e.tentatives.voix).toBe(1);
    const cles = e.caisse.reservations.map((r) => r.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(new Set(x.m.lus).size).toBe(x.m.lus.length);
  });

  it("1 · au-delà de 3 relances, la panne devient un échec réessayable qui dit ce qui a été essayé", async () => {
    const x = monter({ pannesVoix: [1, 2, 3, 4] });
    const e = await jusquAuBout(x.e, x.o);
    expect(e.etape).toBe("refusee");
    expect(x.pauses).toEqual([2000, 5000, 10000]);
    expect(e.refus).toMatchObject({ code: "IV_PANNE", etape: "voix", reessayable: true });
    expect(e.refus!.message).toMatch(/Essayé automatiquement : .*relancée automatiquement \(3\/3/);
  });

  it("2 · refus de forme réessayable : relancé une fois en mode réparé avant d'échouer", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let appels = 0;
    // La 1re tentative d'écriture (2 appels) rend un texte vide ; la relance réparée reçoit une vraie réponse.
    const o: OutilsFabricationIV = { ...base, pause: async () => undefined, ecriture: { appeler: async (role, entree) => (++appels <= 2 ? { ok: true, simule: true, texte: "" } : base.ecriture.appeler(role, entree)) } };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toBeUndefined();
    expect(e.tentatives.ecriture).toBe(2);
    expect(e.journal.some((l) => /refaite une fois en mode réparé/.test(l))).toBe(true);
  });

  it("2 · jamais pour une vraie cause : une image introuvable n'est ni relancée ni réparée", async () => {
    const x = monter();
    const o: OutilsFabricationIV = { ...x.o, lireImageSource: async () => null };
    const e = await avancerJusquAArretIV(x.e, o);
    expect(e.refus).toMatchObject({ code: "IV_IMAGE", reessayable: false });
    expect(x.pauses).toEqual([]);
    expect(e.refus!.message).not.toMatch(/Essayé automatiquement/);
  });

  it("3 · échec réel : cause en français simple + essais automatiques, « Refaire » reste disponible", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const o: OutilsFabricationIV = { ...base, pause: async () => undefined, ecriture: { appeler: async () => ({ ok: true, simule: true, texte: "" }) } };
    let e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "ecriture", code: "IV_ECRITURE", reessayable: true });
    expect(e.refus!.message).toMatch(/Essayé automatiquement : étape « ecriture » refaite une fois en mode réparé/);
    expect(e.refus!.message).toMatch(/Refaire cette partie/);
    // « Refaire cette partie » : la reprise manuelle marche encore, sur la bonne étape.
    const repris = reprendreIV(e);
    expect(repris.etape).toBe("ecriture");
    expect(repris.refus).toBeUndefined();
    e = await jusquAuBout(repris, outilsSimules(carte, m));
    expect(e.etape).toBe("prete");
  });

  it("4 · le prix annoncé ne bloque jamais quand le crédit réel suffit ; seul un crédit réel refusé arrête (IV_BUDGET)", async () => {
    const ok = monter({}, { plafondCentimes: 1 });
    const e = await jusquAuBout(ok.e, ok.o);
    expect(e.etape).toBe("prete");
    expect(engageCentimes(e)).toBeGreaterThan(1);
    expect(e.journal.some((l) => /Avertissement : cette vidéo dépasse son prix annoncé/.test(l))).toBe(true);

    const vide = monter({ refuserDepense: () => "Crédit insuffisant." }, { plafondCentimes: 1 });
    const arret = await jusquAuBout(vide.e, vide.o);
    expect(arret.refus).toMatchObject({ code: "IV_BUDGET", reessayable: true });
  });
});
