/**
 * Bouton « Refaire » (18/10) : après un refus des vérifications ou de la mise en scène, quand le script et la voix sont
 * FAITS, l'écran propose « Refaire ». La reprise (`reprendreIV`) repart de la mise en scène : script, voix, transcriptions
 * et relectures payées sont gardés. Prouvé ici avec les outils simulés (compteurs de lectures de voix, transcriptions,
 * relectures Claude), sans réseau ni appel payant.
 */
import { describe, expect, it, vi } from "vitest";
import { PHRASE_REFAIRE_MISE_EN_SCENE_IV, refusReessayableIV, vueFabrication } from "@/components/formats/image-video/vue";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, reprendreIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { carteFixe, demandeEssai, monde, outilsSimules, type Monde } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

type Arg = Parameters<typeof refusReessayableIV>[0];
const refus = (etape: "controles" | "mise-en-scene" | "rendu" | "voix", code: string) => ({ etape, code, message: "x", reessayable: false });
const RENDUS = { "fin-tiktok": { cle: "final/a.mp4", empreinte: "e1", dureeSec: 30, demande: "d" } };
const etat = (r: ReturnType<typeof refus>, o: { script?: boolean; voix?: "faite" | "refus"; rendus?: unknown } = {}) =>
  ({ refus: r, rendus: o.rendus ?? RENDUS, ...(o.script === false ? {} : { script: {} }), voix: { issue: o.voix === "refus" ? { statut: "refus", controle: "Q16", message: "x" } : { statut: "faite" }, voix: { corps: {}, fins: [] } } }) as unknown as Arg;

describe("« Refaire » proposé ou non (pur)", () => {
  it("proposé quand le script et la voix sont faits", () => {
    expect(refusReessayableIV(etat(refus("controles", "IV_CONTROLES")))).toBe(true);
    expect(refusReessayableIV(etat(refus("mise-en-scene", "IV_MISE_EN_SCENE")))).toBe(true);
  });
  it("pas proposé sans script, avec une voix non faite, pour une autre étape ou un autre code", () => {
    expect(refusReessayableIV(etat(refus("controles", "IV_CONTROLES"), { script: false }))).toBe(false);
    expect(refusReessayableIV(etat(refus("controles", "IV_CONTROLES"), { voix: "refus" }))).toBe(false);
    expect(refusReessayableIV(etat(refus("rendu", "IV_RENDU")))).toBe(false);
    expect(refusReessayableIV(etat(refus("voix", "IV_VOIX")))).toBe(false);
    expect(refusReessayableIV(etat(refus("controles", "IV_RENDU")))).toBe(false);
  });
  it("pas proposé pour des vérifications quand un rendu n'a pas d'empreinte (sa relecture payée ne serait jamais gardée)", () => {
    expect(refusReessayableIV(etat(refus("controles", "IV_CONTROLES"), { rendus: { "fin-tiktok": { cle: "final/a.mp4", dureeSec: 30, demande: "d" } } }))).toBe(false);
    expect(refusReessayableIV(etat(refus("controles", "IV_CONTROLES"), { rendus: {} }))).toBe(false);
  });
});

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
const compte = (m: Monde) => ({ lus: m.lus.length, transcriptions: m.transcriptions.length, relectures: m.appelsClaude.filter((a) => a.role === "relecture-finale-iv").length, rendus: m.rendus.length });

describe("« Refaire » après un refus des vérifications : la reprise ne repaie rien", () => {
  it("vérifications refusées alors que fichiers et instants n'ont pas changé : 0 lecture de voix, 0 transcription, 0 relecture payée, 0 rendu", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const o = outilsSimules(carte, m);
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(fini.etape).toBe("prete");
    const avant = compte(m);
    expect(avant.transcriptions).toBeGreaterThan(0);
    expect(avant.relectures).toBeGreaterThan(0);
    const refuse = { ...structuredClone(fini), etape: "refusee" as const, refus: { etape: "controles" as const, code: "IV_CONTROLES" as const, message: "Refus simulé.", reessayable: false } };
    delete refuse.livraison;
    expect(refusReessayableIV(refuse)).toBe(true);
    expect(vueFabrication(refuse).refus?.reessayable).toBe(true);
    const repris = reprendreIV(refuse);
    expect(repris.etape).toBe("mise-en-scene");
    expect(repris.refus).toBeUndefined();
    const apres = await avancerJusquAArretIV(repris, o);
    expect(apres.etape).toBe("prete");
    expect(compte(m)).toEqual(avant);
  });

  it("un contrôle gratuit bloquant (mesure du fichier final absente, image E) bloque avant toute écoute ou relecture, même après « Refaire »", async () => {
    // 25/10/2026 : la mise en page (Q21) n'est plus qu'une remarque ; un rendu dont le cadre n'est pas mesuré reste un refus.
    const carte = carteFixe("E");
    const m = monde();
    const o = outilsSimules(carte, m, { sansMesureFichier: ["hauteur"] });
    const refuse = await jusquAuBout(etatInitialIV(demandeEssai(carte)), o);
    expect(refuse.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES", reessayable: false });
    const avant = compte(m);
    expect(m.ordre.filter((x) => x === "transcription" || /relecture/.test(x))).toEqual([]);
    expect(refusReessayableIV(refuse)).toBe(true);
    const apres = await avancerJusquAArretIV(reprendreIV(refuse), o);
    expect(apres.refus).toMatchObject({ etape: "controles", code: "IV_CONTROLES" });
    expect(compte(m)).toEqual(avant);
    expect(m.ordre.filter((x) => x === "transcription" || /relecture/.test(x))).toEqual([]);
  });

  it("refus de mise en scène : « Refaire » est proposé avec la phrase « seulement après une correction du moteur »", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const fini = await jusquAuBout(etatInitialIV(demandeEssai(carte)), outilsSimules(carte, m));
    const refuse = { ...structuredClone(fini), etape: "refusee" as const, refus: { etape: "mise-en-scene" as const, code: "IV_MISE_EN_SCENE" as const, message: "La mise en scène est refusée : x", reessayable: false } };
    const v = vueFabrication(refuse).refus!;
    expect(v.reessayable).toBe(true);
    expect(v.details).toContain(PHRASE_REFAIRE_MISE_EN_SCENE_IV);
    expect(PHRASE_REFAIRE_MISE_EN_SCENE_IV).toMatch(/correction du moteur/);
  });
});
