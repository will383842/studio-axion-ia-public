/**
 * Reprise d'un travail dont le script a été écrit AVANT l'arrivée de la variété (cas trav-f2b26bba35ac) : à l'étape
 * de la mise en scène, la recette est tirée une fois, le récit reste REC-A (celui de l'écriture), rien n'est
 * réécrit ni payé de nouveau.
 */
import { describe, expect, it, vi } from "vitest";
import { attendWillIV, avancerIV, avancerJusquAArretIV, entreesMiseEnSceneIV, reprendreIV, etatInitialIV, validerCarteIV, validerScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

describe("reprise : variété tirée à la mise en scène quand le script est déjà écrit", () => {
  it("état sans variete, script validé, voix faite → recette tirée, récit REC-A, entrées de mise en scène avec variété, aucun nouvel appel", async () => {
    const carte = carteFixe("C");
    const o = outilsSimules(carte, monde());
    const base: EtatFabricationIV = { ...etatInitialIV(demandeEssai(carte)), variete: { recette: RECETTE_REFERENCE_IV, par: "tirage", historique: 0 } };
    let e = await avancerJusquAArretIV(base, o);
    e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    expect(attendWillIV(e)).toBe("script");
    const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
    e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
    // Ancien état : variété absente, reprise à la mise en scène.
    const ancien = JSON.parse(JSON.stringify({ ...e, etape: "mise-en-scene" })) as EtatFabricationIV;
    delete ancien.variete;
    delete ancien.scenes;
    delete ancien.rendus;
    expect(ancien.script).toBeDefined();
    expect(ancien.pistes?.length).toBeGreaterThan(0);
    expect(entreesMiseEnSceneIV(ancien).every((x) => x.entree.variete === undefined)).toBe(true);

    const suivant = await avancerIV(ancien, o);
    expect(suivant.refus).toBeUndefined();
    expect(suivant.variete?.par).toBe("tirage");
    expect(suivant.variete?.recette.recit).toBe("REC-A");
    expect(suivant.journal.some((l) => l.startsWith("Variété tirée à la reprise (script déjà écrit, récit gardé REC-A)"))).toBe(true);
    expect(suivant.script).toEqual(ancien.script);
    expect(suivant.pistes).toEqual(ancien.pistes);
    expect(suivant.caisse).toEqual(ancien.caisse);
    expect(entreesMiseEnSceneIV(suivant).every((x) => x.entree.variete !== undefined)).toBe(true);
  });
});

/** Travail monté avant la variété (cas trav-f2b26bba35ac) : script validé, voix faite, scènes et rendus présents, puis refusé. */
async function travailRefuseIV(etapeRefus: "controles" | "rendu", avecVariete: boolean): Promise<{ etat: EtatFabricationIV; o: ReturnType<typeof outilsSimules> }> {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  const base: EtatFabricationIV = { ...etatInitialIV(demandeEssai(carte)), variete: { recette: RECETTE_REFERENCE_IV, par: "tirage", historique: 0 } };
  let e = await avancerJusquAArretIV(base, o);
  e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
  const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
  e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
  const etat = JSON.parse(JSON.stringify(e)) as EtatFabricationIV;
  if (!avecVariete) delete etat.variete;
  etat.scenes = [{ ancien: true }] as unknown as EtatFabricationIV["scenes"];
  etat.rendus = [{ ancien: true }] as unknown as EtatFabricationIV["rendus"];
  etat.refus = { etape: etapeRefus, code: "IV_CONTROLES", message: "Contrôles refusés.", reessayable: false } as EtatFabricationIV["refus"];
  etat.etape = "refusee";
  return { etat, o };
}

describe("reprise d'un travail refusé après montage, sans variété", () => {
  for (const etapeRefus of ["controles", "rendu"] as const) {
    it(`refusé à « ${etapeRefus} » sans variete → reprise à la mise en scène, puis variété tirée (REC-A), rien de repayé`, async () => {
      const { etat, o } = await travailRefuseIV(etapeRefus, false);
      expect(etat.variete).toBeUndefined();
      const repris = reprendreIV(etat);
      expect(repris.etape).toBe("mise-en-scene");
      expect(repris.refus).toBeUndefined();
      expect(repris.scenes).toBeUndefined();
      expect(repris.rendus).toBeUndefined();
      expect(repris.script).toEqual(etat.script);
      expect(repris.pistes).toEqual(etat.pistes);
      expect(repris.caisse).toEqual(etat.caisse);
      expect(repris.tentatives["mise-en-scene"]).toBe((etat.tentatives["mise-en-scene"] ?? 1) + 1);
      expect(repris.journal.at(-1)).toBe("Reprise à la mise en scène : la vidéo a été montée avant la variété, elle est refaite avec la variété (script et voix gardés, rien de repayé).");

      const suivant = await avancerIV(repris, o);
      expect(suivant.refus).toBeUndefined();
      expect(suivant.variete?.par).toBe("tirage");
      expect(suivant.variete?.recette.recit).toBe("REC-A");
      expect(suivant.script).toEqual(etat.script);
      expect(suivant.pistes).toEqual(etat.pistes);
      expect(suivant.caisse).toEqual(etat.caisse);
    });
  }

  it("avec variete, refus de la vidéo à « controles » (non réessayable) → reprise à la mise en scène ; rendus gardés (ceux dont l'identifiant change sont refaits), lectures et caisse inchangées", async () => {
    const { etat, o } = await travailRefuseIV("controles", true);
    expect(etat.variete).toBeDefined();
    const repris = reprendreIV(etat);
    expect(repris.etape).toBe("mise-en-scene");
    expect(repris.refus).toBeUndefined();
    expect(repris.scenes).toBeUndefined();
    expect(repris.rendus).toEqual(etat.rendus);
    expect(repris.script).toEqual(etat.script);
    expect(repris.caisse).toEqual(etat.caisse);
    expect(repris.journal.at(-1)).toBe("Reprise à la mise en scène : les contrôles ont refusé la vidéo, elle est remontée avec les règles à jour (script, voix et lectures payées gardés, rien de repayé).");
    const suivant = await avancerIV(repris, o);
    expect(suivant.refus).toBeUndefined();
    expect(suivant.variete).toEqual(etat.variete);
    expect(suivant.caisse).toEqual(etat.caisse);
  });

  it("avec variete, refus RÉESSAYABLE à « controles » (panne d'un service) → la reprise reste à « controles » (inchangé)", async () => {
    const { etat } = await travailRefuseIV("controles", true);
    (etat.refus as { reessayable: boolean }).reessayable = true;
    const repris = reprendreIV(etat);
    expect(repris.etape).toBe("controles");
    expect(repris.scenes).toEqual(etat.scenes);
    expect(repris.rendus).toEqual(etat.rendus);
    expect(repris.journal.at(-1)).toBe("Reprise de l'étape « controles ».");
  });
});
