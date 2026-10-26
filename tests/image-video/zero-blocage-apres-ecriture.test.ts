/**
 * ZÉRO BLOCAGE après l'écriture : jamais d'arrêt pour un défaut de détail. Seuls bloquent : voix absente, rendu impossible,
 * image illisible, chiffre faux, mots interdits (Q08), mesure absente (Q24).
 *  1. écran irrendable : adapté en texte seul au 1er échec (remarque), IV_RENDU seulement au 2e ;
 *  2. lecture en panne (Claude) : IV_PANNE, pas IV_IMAGE ;
 *  3. piste voix introuvable au 1er essai : relue gratuitement ;
 *  4. transcription en panne : relancée une fois, puis remarque ; vide : toujours refusée.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, ErreurRenduDefinitifIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

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

const carte = carteFixe("A");
const demande = () => demandeEssai(carte, { formats: {} });

describe("zéro blocage après l'écriture", () => {
  it("référence : sans panne, la vidéo est prête", async () => {
    const e = await jusquAuBout(etatInitialIV(demande()), outilsSimules(carte, monde()));
    expect(e.etape).toBe("prete");
  });

  it("écran irrendable au 1er rendu : adapté en texte seul, vidéo prête avec une remarque", async () => {
    const o = outilsSimules(carte, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1 : un texte ne tient pas à sa place."], ["e02"]);
      return rendre(d);
    };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(Object.values(e.ecransAdaptes ?? {})[0]).toContain("e02");
    expect(e.remarques?.[0]).toMatch(/texte seul/);
    expect(e.controles?.verdict?.mentions.join(" ")).toMatch(/texte seul/);
  });

  it("écran irrendable sans identifiant : tous les écrans à texte sont adaptés", async () => {
    const o = outilsSimules(carte, monde());
    const rendre = o.rendre;
    let n = 0;
    o.rendre = async (d) => {
      if (++n === 1) throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1"]);
      return rendre(d);
    };
    const e = await avancerJusquAArretIV(await jusquAuBout(etatInitialIV(demande()), o), o);
    expect(Object.values(e.ecransAdaptes ?? {})[0]!.length).toBeGreaterThan(1);
  });

  it("écran irrendable une 2e fois pour la même version : IV_RENDU comme avant", async () => {
    const o = outilsSimules(carte, monde());
    o.rendre = async () => {
      throw new ErreurRenduDefinitifIV("Un écran ne tient pas.", ["écran n° 1"], ["e02"]);
    };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "rendu", code: "IV_RENDU", reessayable: false });
  });

  it("lecture en panne (Claude) : IV_PANNE réessayable, pas IV_IMAGE", async () => {
    const o = outilsSimules(carte, monde());
    o.lecture.appeler = async () => {
      throw new Error("Claude ne répond pas");
    };
    const e = await avancerJusquAArretIV(etatInitialIV(demande()), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "lecture", code: "IV_PANNE", reessayable: true });
  });

  it("piste voix introuvable au 1er essai puis trouvée : la vidéo est prête", async () => {
    const o = outilsSimules(carte, monde());
    const lire = o.controles.lireSon;
    const vues = new Set<string>();
    o.controles = {
      ...o.controles,
      pauseRelectureMs: 0,
      lireSon: async (cle) => {
        if (!vues.has(cle)) {
          vues.add(cle);
          return null;
        }
        return lire(cle);
      },
    };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
  });

  it("piste voix toujours introuvable : refusée (voix absente)", async () => {
    const o = outilsSimules(carte, monde());
    o.controles = { ...o.controles, pauseRelectureMs: 0, lireSon: async () => null };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
  });

  it("transcription en panne deux fois : vidéo prête, écoute non faite en remarque", async () => {
    const m = monde();
    const o = outilsSimules(carte, m);
    o.controles = {
      ...o.controles,
      transcrire: async (d) => {
        m.transcriptions.push(d.appelId);
        throw new Error("transcription en panne");
      },
    };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(m.transcriptions.length).toBeGreaterThanOrEqual(2);
    // Chaque piste : un 1er essai, puis UNE relance sous une réservation neuve (jamais le même identifiant d'appel).
    const relances = m.transcriptions.filter((x) => x.endsWith("-reprise")).length;
    expect(relances).toBeGreaterThan(0);
    expect(relances).toBe(m.transcriptions.length - relances);
    expect(e.controles?.verdict?.mentions.join(" ")).toMatch(/écoute|phrase-choc/i);
  });

  it("transcription vide : toujours refusée (voix absente)", async () => {
    const o = outilsSimules(carte, monde());
    o.controles = { ...o.controles, transcrire: async () => ({ mots: [] }) };
    const e = await jusquAuBout(etatInitialIV(demande()), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus?.code).toBe("IV_CONTROLES");
  });
});
