/**
 * GV-EC-06 · Williams peut valider tel quel un script « à relire » pour des points de FORME seulement.
 * Les points « jamais faux » (chiffre, nom inventé, mot interdit, phrase-choc, question…) restent bloquants.
 * Tout est SIMULÉ : aucun appel réel.
 */
import { describe, expect, it, vi } from "vitest";
import { CODES_REGLES_JAMAIS_FAUX } from "@/moteurs/montage-image-video/ecriture";
import { avancerJusquAArretIV, controleAutomatiqueScriptIV, etatInitialIV, validerCarteIV, validerScriptIV, type DecisionScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

async function auScript(): Promise<EtatFabricationIV> {
  const o = outilsSimules(carteFixe("C"), monde());
  const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carteFixe("C"))), o);
  const arret = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
  expect(arret.etape).toBe("script-a-valider");
  return arret;
}
const decision = (e: EtatFabricationIV, plus: Partial<DecisionScriptIV> = {}): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
  ...plus,
});
/** Un point de FORME seulement : un chiffre écrit en chiffres dans un écran (règle Q09, hors liste « jamais faux »). */
function avecPointDeForme(e: EtatFabricationIV) {
  const fiche = structuredClone(e.propositionScript!.fiche);
  fiche.ecrans[1] = { ...fiche.ecrans[1]!, texteDit: `${fiche.ecrans[1]!.texteDit.replace(/\.$/, "")} 3.` };
  return fiche;
}
const phrasesDe = (f: () => unknown): string => {
  try {
    f();
  } catch (err) {
    return [(err as Error).message, ...((err as { phrases?: string[] }).phrases ?? [])].join(" ");
  }
  return "";
};

describe("GV-EC-06 · points de forme acceptés par Williams", () => {
  it("le script de départ passe sans drapeau (base saine) et le point de forme n'est pas « jamais faux »", async () => {
    const e = await auScript();
    expect(() => validerScriptIV(e, decision(e))).not.toThrow();
    expect(CODES_REGLES_JAMAIS_FAUX).not.toContain("Q09");
  });

  it("point de forme SANS drapeau : refus comme avant", async () => {
    const e = await auScript();
    expect(() => validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e) }))).toThrow(/ne passe pas encore/);
    expect(() => validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e), formeAcceptee: false }))).toThrow(/ne passe pas encore/);
  });

  it("point de forme AVEC drapeau : validé, étape voix, journal présent", async () => {
    const e = await auScript();
    const v = validerScriptIV(e, decision(e, { fiche: avecPointDeForme(e), formeAcceptee: true }));
    expect(v.etape).toBe("voix");
    expect(v.script).toBeDefined();
    expect(v.journal.join("\n")).toMatch(/Script validé par Williams malgré 1 point\(s\) de forme : /);
  });

  it("mot interdit (jamais faux) AVEC drapeau : refus qui nomme le point", async () => {
    const e = await auScript();
    const fiche = structuredClone(e.propositionScript!.fiche);
    fiche.ecrans[1] = { ...fiche.ecrans[1]!, texteDit: `${fiche.ecrans[1]!.texteDit.replace(/\.$/, "")}, comme une machine.` };
    const texte = phrasesDe(() => validerScriptIV(e, decision(e, { fiche, formeAcceptee: true })));
    expect(texte).toMatch(/Ce point ne peut pas être accepté tel quel/);
    expect(texte).toMatch(/machine/);
  });

  it("point de forme ET point « jamais faux » ensemble, avec drapeau : refus, rien n'est accepté", async () => {
    const e = await auScript();
    const fiche = avecPointDeForme(e);
    fiche.ecrans[2] = { ...fiche.ecrans[2]!, texteDit: `${fiche.ecrans[2]!.texteDit.replace(/\.$/, "")}, comme une machine.` };
    expect(() => validerScriptIV(e, decision(e, { fiche, formeAcceptee: true }))).toThrow(/Ce point ne peut pas être accepté tel quel/);
  });

  it("formule absolue non tranchée (Q05bis) reste bloquante, même avec drapeau", async () => {
    const e = await auScript();
    expect(e.propositionScript!.formules.length).toBeGreaterThan(0);
    expect(() => validerScriptIV(e, { proposition: e.propositionScript!.empreinte, formeAcceptee: true })).toThrow(/Ce point ne peut pas être accepté tel quel/);
  });

  it("lot automatique : le contrôle ne pose jamais le drapeau, le point de forme met le script de côté", async () => {
    const e = await auScript();
    const mauvais = structuredClone(e);
    mauvais.propositionScript!.fiche = avecPointDeForme(e);
    const apres = controleAutomatiqueScriptIV(mauvais);
    expect(apres.etape).not.toBe("voix");
    expect(apres.script).toBeUndefined();
  });
});
