/**
 * GV-EC-05 · Une vérification finale qui n'a pas pu se faire (outil en panne, mesure absente) n'est plus un refus
 * définitif : le verdict de la porte dit « non-fait », la fabrication rend IV_PANNE réessayable, relancé une fois seul,
 * sans refaire ni rendu ni transcription ni relecture payés. Un vrai défaut (chiffre faux) reste IV_CONTROLES, non réessayable.
 * Doubles du monde, rien n'est payé.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules, type OptionsMonde } from "./doubles-fabrication";

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

const FRANCAIS = "Une vérification n'a pas pu se faire. Rien de payé n'est perdu : elle reprend seule.";

describe("GV-EC-05 · contrôles non faits : reprise seule", () => {
  it("écoute impossible, tout le reste bon : IV_PANNE réessayable, une relance, puis succès sans second rendu", async () => {
    const carte = carteFixe("C");
    // Référence : le même travail sans panne, pour compter ce qu'un rendu et une écoute coûtent.
    const mRef = monde();
    await jusquAuBout(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, mRef));

    const m = monde();
    const base = outilsSimules(carte, m);
    const pauses: number[] = [];
    let panne = true;
    const o: OutilsFabricationIV = {
      ...base,
      // La pause précède la relance : l'outil est rétabli à ce moment.
      pause: async (ms) => {
        pauses.push(ms);
        panne = false;
      },
      controles: {
        ...base.controles,
        transcrire: async (d) => {
          if (panne) throw new Error("outil d'écoute indisponible");
          return base.controles.transcrire(d);
        },
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe("prete");
    expect(e.refus).toBeUndefined();
    expect(pauses).toEqual([1500]);
    expect(e.relances?.controles).toBe(1);
    // Aucun second rendu, aucune seconde écoute réussie, aucune seconde relecture payée.
    expect(m.rendus.length).toBe(mRef.rendus.length);
    expect(m.transcriptions.length).toBe(mRef.transcriptions.length);
    expect(m.appelsClaude.filter((a) => a.role === "relecture-finale-iv").length).toBe(mRef.appelsClaude.filter((a) => a.role === "relecture-finale-iv").length);
    // Un appel réservé n'est jamais réservé deux fois.
    const cles = e.caisse.reservations.map((r) => r.cle);
    expect(new Set(cles).size).toBe(cles.length);
  });

  it("écoute impossible sans relance automatique : IV_PANNE réessayable, phrase simple, et « Refaire » termine sans second rendu", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let panne = true;
    const o: OutilsFabricationIV = {
      ...base,
      relancesAuto: false,
      controles: {
        ...base.controles,
        transcrire: async (d) => {
          if (panne) throw new Error("outil d'écoute indisponible");
          return base.controles.transcrire(d);
        },
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_PANNE", reessayable: true, message: FRANCAIS });
    const rendus = m.rendus.length;
    panne = false;
    const fin = await jusquAuBout(reprendreIV(e), o);
    expect(fin.etape).toBe("prete");
    expect(m.rendus.length).toBe(rendus);
  });

  it("chiffre faux : IV_CONTROLES, non réessayable, comme avant, et pas de relance seule", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const pauses: number[] = [];
    const o: OutilsFabricationIV = {
      ...base,
      pause: async (ms) => void pauses.push(ms),
      controles: {
        ...base.controles,
        appeler: async (role, entree) => {
          const r = await base.controles.appeler(role, entree);
          const d = (r as { donnees?: { images?: Array<Record<string, unknown>> } }).donnees;
          if (role.id === "relecture-finale-iv" && d?.images?.length) return { ...r, donnees: { ...d, images: d.images.map((x, i) => (i === 0 ? { ...x, faux: "30 % au lieu de 20 %" } : x)) } } as typeof r;
          return r;
        },
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES", reessayable: false });
    expect(pauses).toEqual([]);
  });

  it("mesure Q24 absente deux fois de suite : la vidéo reste réessayable à la main (jamais définitive)", async () => {
    const carte = carteFixe("E");
    const options: OptionsMonde = { sansMesureFichier: ["hauteur"] };
    const m = monde();
    const base = outilsSimules(carte, m, options);
    const pauses: number[] = [];
    const o: OutilsFabricationIV = { ...base, pause: async (ms) => void pauses.push(ms) };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe("refusee");
    expect(pauses).toEqual([1500]);
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_PANNE", reessayable: true });
    expect(e.refus!.message).toMatch(/Essayé automatiquement/);
    expect(e.refus!.message).toMatch(/Refaire cette partie/);
  });
});
