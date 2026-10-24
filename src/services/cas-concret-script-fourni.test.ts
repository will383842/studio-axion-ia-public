import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { bornesDesFins, limiteCaracteresDuCorps, texteFourniDesEcrans } from "@/moteurs/montage-cas-concret/script-fourni";

const etat = vi.hoisted(() => ({ session: true, journal: [] as string[], parametres: {} as Record<string, unknown> }));
vi.mock("./_commun", () => ({
  ErreurStudio: class extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
  creerVerrou: () => <T>(f: () => Promise<T>) => f(),
  depots: () => ({ contexteAxion: { lister: async () => [] } }),
  maintenant: () => "2026-10-24T10:00:00.000Z",
  ecrireParametre: vi.fn(async (id: string, v: unknown) => {
    etat.parametres[id] = structuredClone(v);
  }),
  lireParametre: vi.fn(async (id: string, d: unknown) => (id in etat.parametres ? structuredClone(etat.parametres[id]) : d)),
  journaliser: vi.fn(async (_t: string, m: string) => {
    etat.journal.push(m);
  }),
}));
vi.mock("./auth", () => ({
  exigerSession: vi.fn(async () => {
    if (!etat.session) throw new Error("SESSION");
  }),
}));
vi.mock("./cas-concret-stock-acces", () => ({ trouverCasAutorise: async (id: string) => CATALOGUE.find((c) => c.id === id) }));

import { controlerScriptFourni, departMonScript, enregistrerScriptFourni, PHRASE_CAS_A_SCRIPT_CATALOGUE, phraseScriptTropLong, revenirAuScriptDeLIA } from "./cas-concret-script-fourni";
import { CLE_HISTORIQUE_SCRIPTS, CLE_SCRIPTS_VALIDES, scriptValideDuStudio } from "./cas-concret-scripts";

const CAS = CATALOGUE.find((c) => c.id === "rappels-rendez-vous")!;
const FIXE = { videoId: "v", versionId: "v", habillage: "charte-duo/1", origine: "porte-a" } as const;
const b = bornesDesFins(CAS);
const texteConforme = texteFourniDesEcrans(ficheParGabarit(CAS, FIXE, dureesDesFins([b.courte, b.longue])).ecrans, CAS);

beforeEach(() => {
  etat.session = true;
  etat.journal = [];
  etat.parametres = {};
});

describe("script fourni (service)", () => {
  it("la session est exigée ; un cas inconnu, un identifiant trop long et un texte trop long sont refusés sans écriture", async () => {
    etat.session = false;
    await expect(controlerScriptFourni(CAS.id, texteConforme)).rejects.toThrow("SESSION");
    etat.session = true;
    await expect(controlerScriptFourni("n-existe-pas", texteConforme)).rejects.toThrow("Ce cas n'existe plus.");
    await expect(controlerScriptFourni("x".repeat(121), texteConforme)).rejects.toThrow("Ce cas n'existe plus.");
    await expect(enregistrerScriptFourni(CAS.id, "a".repeat(4001))).rejects.toThrow("trop long");
    await expect(enregistrerScriptFourni(CAS.id, 42 as never)).rejects.toThrow("doit être un texte");
    expect(etat.parametres).toEqual({});
  });

  it("vérifier un texte conforme rend l'aperçu et les durées, sans rien écrire", async () => {
    const r = await controlerScriptFourni(CAS.id, texteConforme);
    expect(r.ok).toBe(true);
    expect(r.apercu.length).toBeGreaterThanOrEqual(12);
    expect(r.apercu[0]).toMatchObject({ forme: "accroche", nomForme: "Accroche" });
    expect(r.dureeSec!.max).toBeGreaterThanOrEqual(r.dureeSec!.min);
    expect(etat.parametres).toEqual({});
  });

  it("un texte refusé : les refus « Ligne N », rien n'est écrit ; l'enregistrement lève SCRIPT_FOURNI_REFUSE", async () => {
    const r = await controlerScriptFourni(CAS.id, "Un.\nDeux.");
    expect(r.ok).toBe(false);
    expect(r.refus.length).toBeGreaterThan(0);
    await expect(enregistrerScriptFourni(CAS.id, "Un.\nDeux.")).rejects.toMatchObject({ code: "SCRIPT_FOURNI_REFUSE" });
    expect(etat.parametres).toEqual({});
    expect(etat.journal).toEqual([]);
  });

  it("enregistrer crée le script validé de la version courante (fourni, texte brut gardé), l'historique et le journal ; le même texte deux fois ne crée rien", async () => {
    const e = await enregistrerScriptFourni(CAS.id, texteConforme, { maintenant: Date.UTC(2026, 9, 24) });
    expect(e).toMatchObject({ casId: CAS.id, numero: 1, modifie: true });
    const s = (await scriptValideDuStudio(CAS.id))!;
    expect(s).toMatchObject({ casId: CAS.id, versionCas: CAS.version, valideLe: "2026-10-24", fourni: true, texteFourni: texteConforme, numero: 1 });
    expect(((etat.parametres[CLE_HISTORIQUE_SCRIPTS] as Record<string, unknown[]>)[CAS.id] ?? []).length).toBe(1);
    expect(etat.journal).toEqual([`Script fourni enregistré (version 1) : ${CAS.titre}`]);
    const encore = await enregistrerScriptFourni(CAS.id, texteConforme);
    expect(encore).toMatchObject({ modifie: false, numero: 1 });
    expect(((etat.parametres[CLE_HISTORIQUE_SCRIPTS] as Record<string, unknown[]>)[CAS.id] ?? []).length).toBe(1);
    // Un texte plus court (la question sans « Et dans votre entreprise, ») crée la version suivante.
    const lignes = texteConforme.split("\n");
    lignes[lignes.length - 1] = lignes[lignes.length - 1].replace("Et dans votre entreprise, quelle", "Quelle");
    expect(lignes.join("\n")).not.toBe(texteConforme);
    const autre = await enregistrerScriptFourni(CAS.id, lignes.join("\n"));
    expect(autre).toMatchObject({ modifie: true, numero: 2 });
    // Seules les étiquettes ou les espaces changent : les phrases sont les mêmes, mais le texte de Will est gardé tel quel (nouvelle version).
    const espaces = lignes.join("\n").replace("[accroche] ", "[accroche]   ");
    const tel = await enregistrerScriptFourni(CAS.id, espaces);
    expect(tel).toMatchObject({ modifie: true, numero: 3 });
    expect((await scriptValideDuStudio(CAS.id))!.texteFourni).toBe(espaces);
    // Exactement le même texte : « aucun changement ».
    expect(await enregistrerScriptFourni(CAS.id, espaces)).toMatchObject({ modifie: false, numero: 3 });
  });

  it("ARGENT : un cas à script du catalogue est refusé ; un script plus long que le corps du prix est refusé avec la limite", async () => {
    const catalogue = CATALOGUE.find((c) => c.id === "recrutement-apporteurs")!;
    const rc = await controlerScriptFourni(catalogue.id, "[accroche] x");
    expect(rc.ok).toBe(false);
    expect(rc.refus[0].message).toBe(PHRASE_CAS_A_SCRIPT_CATALOGUE);
    await expect(enregistrerScriptFourni(catalogue.id, "[accroche] x")).rejects.toMatchObject({ code: "SCRIPT_FOURNI_REFUSE", message: PHRASE_CAS_A_SCRIPT_CATALOGUE });
    // Plus long que le corps du gabarit qui sert au prix.
    const lignes = texteConforme.split("\n");
    lignes[lignes.length - 1] = lignes[lignes.length - 1].replace("toute seule ?", "toute seule dans votre entreprise de service ?");
    const limite = limiteCaracteresDuCorps(CAS);
    const r = await controlerScriptFourni(CAS.id, lignes.join("\n"));
    expect(r.ok).toBe(false);
    expect(r.refus).toEqual([{ message: phraseScriptTropLong(limite) }]);
    expect(phraseScriptTropLong(limite)).toBe(`Votre script est plus long que celui qui a servi au prix : raccourcissez-le (${limite} caractères au plus pour le texte dit).`);
    await expect(enregistrerScriptFourni(CAS.id, lignes.join("\n"))).rejects.toMatchObject({ code: "SCRIPT_FOURNI_REFUSE" });
    expect(etat.parametres[CLE_SCRIPTS_VALIDES]).toBeUndefined();
  });

  it("un cas retiré est refusé (action appelée directement) : CAS_RETIRE, rien n'est écrit", async () => {
    etat.parametres["casConcret.casRetires"] = { [CAS.id]: { retireLe: "2026-10-24T10:00:00.000Z", titre: CAS.titre } };
    for (const appel of [() => controlerScriptFourni(CAS.id, texteConforme), () => enregistrerScriptFourni(CAS.id, texteConforme), () => revenirAuScriptDeLIA(CAS.id), () => departMonScript(CAS.id)]) {
      await expect(appel()).rejects.toMatchObject({ code: "CAS_RETIRE" });
    }
    expect(etat.parametres[CLE_SCRIPTS_VALIDES]).toBeUndefined();
  });

  it("un script de Will retouché depuis « Relire le script » (fourni sans texte) reste « de Will » : le texte de départ est tiré des écrans, et le retour à l'IA ne le reprend pas", async () => {
    await enregistrerScriptFourni(CAS.id, texteConforme);
    const courant = (await scriptValideDuStudio(CAS.id))!;
    const { texteFourni: _t, ...sansTexte } = courant;
    void _t;
    const retouche = { ...sansTexte, numero: 2, source: "Modifié par Will avant le lancement (remplace la version 1)." };
    etat.parametres[CLE_SCRIPTS_VALIDES] = { [CAS.id]: retouche };
    etat.parametres[CLE_HISTORIQUE_SCRIPTS] = { [CAS.id]: [courant, retouche] };
    const d = await departMonScript(CAS.id);
    expect(d).toMatchObject({ origine: "fourni", courantFourni: true, perime: false });
    expect(d.texte).toBe(texteFourniDesEcrans(retouche.ecrans, CAS));
    // Aucune version d'IA dans l'historique : un marqueur, jamais une copie du script retouché de Will.
    expect((await revenirAuScriptDeLIA(CAS.id)).modifie).toBe(true);
    expect(await scriptValideDuStudio(CAS.id)).toBeNull();
  });

  it("retour au script de l'IA : sans script d'IA gardé, un marqueur (rien n'est effacé) ; avec une version d'IA de la version courante, elle est recopiée", async () => {
    // Sans version d'IA : marqueur.
    await enregistrerScriptFourni(CAS.id, texteConforme);
    expect((await revenirAuScriptDeLIA(CAS.id)).modifie).toBe(true);
    expect(await scriptValideDuStudio(CAS.id)).toBeNull();
    expect(((etat.parametres[CLE_HISTORIQUE_SCRIPTS] as Record<string, unknown[]>)[CAS.id] ?? []).length).toBe(1);
    expect((etat.parametres[CLE_SCRIPTS_VALIDES] as Record<string, { desactiveLe?: string }>)[CAS.id].desactiveLe).toBeTruthy();
    expect((await revenirAuScriptDeLIA(CAS.id)).modifie).toBe(false);

    // Avec une version d'IA : recopiée en nouvelle version.
    etat.parametres = {};
    const g = ficheParGabarit(CAS, FIXE, dureesDesFins([b.courte, b.longue]));
    const { scriptDeFiche } = await import("@/moteurs/montage-cas-concret/script-valide");
    const ia = { ...scriptDeFiche(g, { versionCas: CAS.version, valideLe: "2026-10-20", source: "IA" }), numero: 1 };
    etat.parametres[CLE_SCRIPTS_VALIDES] = { [CAS.id]: ia };
    etat.parametres[CLE_HISTORIQUE_SCRIPTS] = { [CAS.id]: [ia] };
    await enregistrerScriptFourni(CAS.id, texteConforme.replace("Et dans votre entreprise, quelle", "Quelle"));
    expect((await scriptValideDuStudio(CAS.id))!.fourni).toBe(true);
    await revenirAuScriptDeLIA(CAS.id);
    const apres = (await scriptValideDuStudio(CAS.id))!;
    expect(apres.fourni).toBeUndefined();
    expect(apres.texteFourni).toBeUndefined();
    expect(apres.source).toContain("Reprise du script écrit par l'IA (version 1)");
    expect(apres.ecrans.map((e) => e.texteDit)).toEqual(ia.ecrans.map((e) => e.texteDit));
    expect(((etat.parametres[CLE_HISTORIQUE_SCRIPTS] as Record<string, unknown[]>)[CAS.id] ?? []).length).toBe(3);
  });

  it("texte de départ : le gabarit sans script, le script validé ensuite, le texte de Will d'abord", async () => {
    const d0 = await departMonScript(CAS.id);
    expect(d0.origine).toBe("gabarit");
    expect(d0.texte.split("\n")[0]).toMatch(/^\[accroche\] /);
    await enregistrerScriptFourni(CAS.id, texteConforme);
    const d1 = await departMonScript(CAS.id);
    expect(d1).toMatchObject({ origine: "fourni", texte: texteConforme, perime: false, courantFourni: true });
  });
});
