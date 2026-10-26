/**
 * Reprise automatique · Image → vidéo. La génération ne bloque jamais et ne demande pas à Will de reprendre à la main :
 * 1) panne passagère → UNE relance de la même étape par tour (pause courte, l'espacement suivant est celui de la boucle de fond) ;
 *    chaque relance réserve de nouveau : les appels réels sont toujours égaux aux réservations ;
 * 2) écriture refusée sur la forme → un nouvel essai (pas de « mode réparé » : l'écriture rejoue déjà ses refus dans sa consigne) ;
 * 3) échec réel → cause en français simple + ce qui a été essayé, « Refaire cette partie » seulement si c'est réessayable ;
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
  it("1 · panne passagère de la voix : une relance seule (pause courte), la voix payée n'est pas repayée", async () => {
    const x = monter({ pannesVoix: [1] });
    const e = await jusquAuBout(x.e, x.o);
    expect(e.etape).toBe("prete");
    expect(x.pauses).toEqual([1500]);
    expect(e.tentatives.voix).toBe(1);
    const cles = e.caisse.reservations.map((r) => r.cle);
    expect(new Set(cles).size).toBe(cles.length);
    expect(new Set(x.m.lus).size).toBe(x.m.lus.length);
    expect(e.relances?.voix).toBe(1);
  });

  it("1 · une seule relance par tour : après la 2e panne, refus réessayable en français simple, sans identifiant interne", async () => {
    const x = monter({ pannesVoix: [1, 2, 3] });
    const e = await jusquAuBout(x.e, x.o);
    expect(e.etape).toBe("refusee");
    expect(x.pauses).toEqual([1500]);
    expect(e.refus).toMatchObject({ code: "IV_PANNE", etape: "voix", reessayable: true });
    expect(e.refus!.message).toMatch(/Panne pendant la voix/);
    expect(e.refus!.message).toMatch(/Essayé automatiquement : panne passagère, un nouvel essai automatique de la voix\./);
    expect(e.refus!.message).toMatch(/Refaire cette partie/);
    expect(e.refus!.message).not.toMatch(/« voix »|« ecriture »|mise-en-scene|controles/);
  });

  it("1 · une panne après un 1er appel Claude réussi : chaque appel réel est réservé (réservations anthropic = appels réels)", async () => {
    for (const etape of ["lecture", "ecriture"] as const) {
      const carte = carteFixe("C");
      const m = monde();
      const base = outilsSimules(carte, m);
      let reels = 0;
      // Le 1er appel réussit (la lecture a ; l'écriture rend un texte vide pour qu'un 2e essai existe), le 2e lève une exception, ensuite tout va bien.
      const passer = async <R>(sain: () => Promise<R>, vide?: () => R): Promise<R> => {
        reels++;
        if (reels === 2) throw new Error("Claude ne répond pas");
        return reels === 1 && vide ? vide() : sain();
      };
      const o: OutilsFabricationIV =
        etape === "lecture"
          ? { ...base, pause: async () => undefined, lecture: { ...base.lecture, appeler: (role, entree) => passer(() => base.lecture.appeler(role, entree)) } }
          : { ...base, pause: async () => undefined, ecriture: { appeler: (role, entree) => passer(() => base.ecriture.appeler(role, entree), () => ({ ok: true, simule: true, texte: "" }) as Awaited<ReturnType<typeof base.ecriture.appeler>>) } };
      const fin = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
      expect(fin.etape, etape).toBe("prete");
      expect(fin.relances?.[etape]).toBe(1);
      const anthropic = m.depenses.filter((d) => d.fournisseur === "anthropic" && d.etape === etape);
      expect(anthropic.length, `étape ${etape}`).toBe(reels);
      expect(new Set(anthropic.map((d) => d.appelId)).size).toBe(anthropic.length);
    }
  });

  it("2 · écriture refusée sur la forme : un nouvel essai automatique (nouvelle tentative), nommé honnêtement", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let appels = 0;
    // La 1re tentative d'écriture (2 appels) rend un texte vide ; le nouvel essai reçoit une vraie réponse.
    const o: OutilsFabricationIV = { ...base, pause: async () => undefined, ecriture: { appeler: async (role, entree) => (++appels <= 2 ? { ok: true, simule: true, texte: "" } : base.ecriture.appeler(role, entree)) } };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toBeUndefined();
    expect(e.etape).toBe("prete");
    expect(e.tentatives.ecriture).toBe(2);
    expect(e.journal.some((l) => /refus de forme, un nouvel essai automatique de l'écriture du script/.test(l))).toBe(true);
    expect(e.journal.some((l) => /mode réparé/.test(l))).toBe(false);
  });

  it("2 · jamais pour une vraie cause : image introuvable, crédit refusé (IV_BUDGET), conversion du son (IV_VOIX Q17) ne sont ni relancés ni attendus", async () => {
    const intro = monter();
    const e1 = await avancerJusquAArretIV(intro.e, { ...intro.o, lireImageSource: async () => null });
    expect(e1.refus).toMatchObject({ code: "IV_IMAGE", reessayable: false });
    expect(e1.refus!.message).not.toMatch(/Essayé automatiquement/);
    expect(intro.pauses).toEqual([]);

    const budget = monter({ refuserDepense: () => "Crédit insuffisant." });
    const e2 = await avancerJusquAArretIV(budget.e, budget.o);
    expect(e2.refus).toMatchObject({ code: "IV_BUDGET", reessayable: true });
    expect(e2.refus!.message).not.toMatch(/Essayé automatiquement/);
    expect(budget.pauses).toEqual([]);
    expect(e2.relances).toBeUndefined();

    const q17 = monter({ brutsMp3: true, assemblage: { convertirEnWav: async () => { throw new Error("FFmpeg est absent du studio : le son ne peut pas être converti en WAV."); } } });
    const e3 = await jusquAuBout(q17.e, q17.o);
    expect(e3.refus).toMatchObject({ etape: "voix", code: "IV_VOIX", reessayable: true });
    expect(e3.refus!.message).not.toMatch(/Essayé automatiquement/);
    expect(q17.pauses).toEqual([]);
    expect(e3.relances).toBeUndefined();
  });

  it("2 · jamais les contrôles : une panne de la porte n'est pas relancée seule (transcriptions payées gardées pour la boucle de fond et « Refaire »)", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const pauses: number[] = [];
    let panne = true;
    const o: OutilsFabricationIV = {
      ...base,
      pause: async (ms) => void pauses.push(ms),
      // Panne qui lève dans l'étape des contrôles (la porte attrape ses propres pannes d'outils : seule une levée ici devient IV_PANNE).
      get controles() {
        if (panne) throw new Error("Les contrôles ne répondent pas");
        return base.controles;
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_PANNE", reessayable: true });
    expect(pauses).toEqual([]);
    expect(e.relances?.controles).toBeUndefined();
    expect(e.refus!.message).not.toMatch(/Essayé automatiquement/);
    const reservees = m.depenses.filter((d) => d.etape === "ecoute").length;
    // Une seule réservation de transcription a été posée pour la tentative : aucune relance cachée n'en a repayé une autre.
    expect(reservees).toBeLessThanOrEqual(1);
    panne = false;
    const fin = await jusquAuBout(reprendreIV(e), o);
    expect(fin.etape).toBe("prete");
  });

  it("3 · échec réel : cause en français simple + essai automatique, « Refaire » proposé seulement si réessayable", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const o: OutilsFabricationIV = { ...base, pause: async () => undefined, ecriture: { appeler: async () => ({ ok: true, simule: true, texte: "" }) } };
    let e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.etape).toBe("refusee");
    expect(e.refus).toMatchObject({ etape: "ecriture", code: "IV_ECRITURE", reessayable: true });
    expect(e.refus!.message).toMatch(/Essayé automatiquement : refus de forme, un nouvel essai automatique de l'écriture du script/);
    expect(e.refus!.message).toMatch(/Refaire cette partie/);
    expect(e.refus!.message).not.toMatch(/« ecriture »/);
    // « Refaire cette partie » : la reprise manuelle marche encore, sur la bonne étape.
    const repris = reprendreIV(e);
    expect(repris.etape).toBe("ecriture");
    expect(repris.refus).toBeUndefined();
    e = await jusquAuBout(repris, outilsSimules(carte, m));
    expect(e.etape).toBe("prete");
  });

  it("4 · le prix annoncé ne bloque jamais (avertissement par la cloche) ; seul un crédit réel refusé arrête (IV_BUDGET), sans réservation répétée", async () => {
    const ok = monter({}, { plafondCentimes: 1 });
    const avertis: string[] = [];
    const e = await jusquAuBout(ok.e, { ...ok.o, budget: { ...ok.o.budget, avertir: async (message: string) => void avertis.push(message) } });
    expect(e.etape).toBe("prete");
    expect(engageCentimes(e)).toBeGreaterThan(1);
    expect(e.journal.some((l) => /Avertissement : Cette vidéo dépasse son prix annoncé/.test(l))).toBe(true);
    expect(avertis.length).toBeGreaterThan(0);

    const vide = monter({ refuserDepense: () => "Crédit insuffisant." }, { plafondCentimes: 1 });
    const arret = await jusquAuBout(vide.e, vide.o);
    expect(arret.refus).toMatchObject({ code: "IV_BUDGET", reessayable: true });
    expect(vide.pauses).toEqual([]);
    // Une seule demande refusée : la boucle automatique n'en répète aucune.
    expect(vide.m.depenses).toHaveLength(1);
    expect(arret.caisse.reservations).toHaveLength(0);
  });
});
