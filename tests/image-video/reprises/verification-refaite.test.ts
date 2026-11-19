/**
 * S-04b · IV12 : une vérification « non faite » le dit vrai, et « Reprendre » REMESURE (au lieu de relire des
 * mesures gardées et de refuser à nouveau). Rien de payé n'est refait. Doubles du monde, 0 €.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerJusquAArretIV, ErreurRenduDefinitifIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
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

  it("« Reprendre » remesure : la mesure revenue, les contrôles passent, AUCUN rendu ni appel payé refait", async () => {
    const carte = carteFixe("E");
    const options: OptionsMonde = { sansMesureFichier: ["hauteur"] };
    const m = monde();
    // Référence : le même travail sans panne, pour compter ce que coûte un travail complet.
    const mRef = monde();
    const ref = await jusquAuBout(etatInitialIV(demandeEssai(carte)), { ...outilsSimules(carte, mRef), relancesAuto: false });
    const completes = Object.fromEntries(Object.values(ref.rendus!).map((r) => [r.demande, r.mesures]));
    const remesures: string[] = [];
    const o: OutilsFabricationIV = {
      ...outilsSimules(carte, m, options),
      relancesAuto: false,
      remesurer: async (d) => {
        remesures.push(d.id);
        return completes[d.id];
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ code: "IV_PANNE", etape: "controles" });
    expect(remesures).toEqual([]);
    const repris = reprendreIV(e);
    // La reprise ne touche NI la demande de rendu NI l'étape : elle ne peut pas rappeler `rendre`.
    expect(repris.etape).toBe("controles");
    expect(Object.values(repris.rendus!).every((r) => !!r.demande)).toBe(true);
    const fin = await jusquAuBout(repris, o);
    expect(fin.refus).toBeUndefined();
    expect(fin.etape).toBe("prete");
    expect(remesures.length).toBeGreaterThan(0);
    expect(m.rendus.length).toBe(mRef.rendus.length);
    expect(m.transcriptions.length).toBe(mRef.transcriptions.length);
    expect(m.appelsClaude.length).toBe(mRef.appelsClaude.length);
  });

  it("un « non fait » qui ne vient PAS d'une mesure absente (écoute en panne) n'est jamais remesuré", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let panne = true;
    let appels = 0;
    const o: OutilsFabricationIV = {
      ...base,
      relancesAuto: false,
      remesurer: async () => {
        appels++;
        return undefined;
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
    expect(e.refus).toMatchObject({ etape: "controles", code: "IV_PANNE" });
    panne = false;
    const fin = await jusquAuBout(reprendreIV(e), o);
    expect(fin.etape).toBe("prete");
    expect(appels).toBe(0);
  });

  it("2 rendus, 1 complet et 1 sans « hauteur » : seul l'incomplet est remesuré, une réponse partielle n'écrase jamais une mesure gardée", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const mRef = monde();
    const ref = await jusquAuBout(etatInitialIV(demandeEssai(carte)), { ...outilsSimules(carte, mRef), relancesAuto: false });
    const completes = Object.values(ref.rendus!);
    expect(completes.length).toBeGreaterThanOrEqual(2);
    const appels: string[] = [];
    const o: OutilsFabricationIV = {
      ...outilsSimules(carte, m, { sansMesureFichier: ["hauteur"] }),
      relancesAuto: false,
      // Réponse PARTIELLE : sans « hauteur », et avec une largeur différente (qui écraserait une mesure gardée).
      remesurer: async (d) => {
        appels.push(d.id);
        return { largeur: -1 };
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ code: "IV_PANNE", etape: "controles" });
    const cles = Object.keys(e.rendus!);
    const gardee = { ...completes[0].mesures, largeur: 1234 };
    for (const k of cles.slice(0, -1)) e.rendus![k].mesures = { ...gardee };
    const incomplet = e.rendus![cles[cles.length - 1]];
    incomplet.mesures = Object.fromEntries(Object.entries(gardee).filter(([k]) => k !== "hauteur"));
    const refait = await avancerJusquAArretIV(reprendreIV(e), o);
    // Seul le rendu incomplet est relu ; la réponse partielle (largeur -1, sans hauteur) n'écrase rien.
    expect([...new Set(appels)]).toEqual([incomplet.demande]);
    for (const k of cles.slice(0, -1)) expect(refait.rendus![k].mesures).toEqual(gardee);
    expect(refait.rendus![cles[cles.length - 1]].mesures).toMatchObject({ largeur: 1234 });
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

describe("S-04b · témoins IV5 et IV11 (écrits pour décider ; verts = comportement de master confirmé)", () => {
  it("IV5 : un plafond atteint pendant la lecture ressort IV_BUDGET, jamais IV_PANNE, et n'est pas relancé seul", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const pauses: number[] = [];
    const o: OutilsFabricationIV = { ...outilsSimules(carte, m, { refuserDepense: (d) => (d.fournisseur === "anthropic" ? "Plafond de la vidéo atteint." : null) }), pause: async (ms) => void pauses.push(ms) };
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ etape: "lecture" });
    expect(e.refus!.code).not.toBe("IV_PANNE");
    expect(["IV_BUDGET", "IV_PLAFOND"]).toContain(e.refus!.code);
    expect(pauses).toEqual([]);
  });

  it("IV11 : un écran irrendable converti en texte seul reste converti à « Reprendre » (même refus non redonné)", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    let appels = 0;
    const o: OutilsFabricationIV = {
      ...base,
      relancesAuto: false,
      rendre: async (d) => {
        appels++;
        if (appels <= 2) throw new ErreurRenduDefinitifIV("écran irrendable", [], ["ecran-inconnu"]);
        return base.rendre(d);
      },
    };
    const e = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(e.refus).toMatchObject({ code: "IV_RENDU" });
    expect(Object.keys(e.ecransImposesRendu ?? {}).length).toBeGreaterThan(0);
    // IV11 non reproduit : la conversion « texte seul » est gardée dans l'état, et le refus du 2e échec n'est pas proposé à « Reprendre ».
    expect(e.refus!.reessayable).toBe(false);
    expect(reprendreIV(e).ecransImposesRendu).toEqual(e.ecransImposesRendu);
  });
});
