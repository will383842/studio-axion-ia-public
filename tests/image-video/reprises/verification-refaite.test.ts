/**
 * S-04b · IV12 : une vérification « non faite » le dit vrai, et « Reprendre » REMESURE (au lieu de relire des
 * mesures gardées et de refuser à nouveau). Rien de payé n'est refait. Doubles du monde, 0 €.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules, type OptionsMonde } from "../doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script") {
      const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    } else break;
  }
  return e;
}

describe("S-04b · IV12", () => {
  it("la phrase dit « Reprendre » et plus « elle reprend seule »", async () => {
    const carte = carteFixe("E");
    const options: OptionsMonde = { sansMesureFichier: ["hauteur"] };
    const o: OutilsFabricationIV = { ...outilsSimules(carte, monde(), options), relancesAuto: false };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_PANNE", reessayable: true });
    expect(e.refus!.message).toContain("« Reprendre » la refait");
    expect(e.refus!.message).not.toContain("elle reprend seule");
  });

  it("« Reprendre » remesure : la mesure revenue, les contrôles passent, rien de payé refait", async () => {
    const carte = carteFixe("E");
    const options: OptionsMonde = { sansMesureFichier: ["hauteur"] };
    const m = monde();
    const o: OutilsFabricationIV = { ...outilsSimules(carte, m, options), relancesAuto: false };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ code: "IV_PANNE", etape: "controles" });
    // Référence : le même travail sans panne, pour compter ce que coûte un travail complet.
    const mRef = monde();
    await jusquAuBout(etatInitialIV(demandeEssai(carte)), { ...outilsSimules(carte, mRef), relancesAuto: false });
    options.sansMesureFichier = [];
    const fin = await jusquAuBout(reprendreIV(e), o);
    expect(fin.refus).toBeUndefined();
    expect(fin.etape).toBe("prete");
    expect(m.transcriptions.length).toBe(mRef.transcriptions.length);
    expect(m.appelsClaude.length).toBe(mRef.appelsClaude.length);
  });

  it("contre-épreuve : mesure toujours absente après « Reprendre » : même refus réessayable, rien de payé refait", async () => {
    const carte = carteFixe("E");
    const options: OptionsMonde = { sansMesureFichier: ["hauteur"] };
    const m = monde();
    const o: OutilsFabricationIV = { ...outilsSimules(carte, m, options), relancesAuto: false };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    const claude = m.appelsClaude.length;
    const fin = await jusquAuBout(reprendreIV(e), o);
    expect(fin.refus).toMatchObject({ code: "IV_PANNE", reessayable: true });
    expect(m.appelsClaude.length).toBe(claude);
  });
});
