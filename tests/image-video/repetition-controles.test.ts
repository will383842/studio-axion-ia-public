/**
 * Répétition générale des contrôles de fin de fabrication « image → vidéo » : hors ligne, sur un état déjà enregistré,
 * sans AUCUN appel payant (ni transcription, ni relecture Claude, ni extraction d'images).
 */
import { describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import {
  attendWillIV,
  avancerJusquAArretIV,
  entreePorteIV,
  etatInitialIV,
  miseEnSceneDesVersionsIV,
  validerCarteIV,
  validerScriptIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { repeterControlesIV } from "@/moteurs/montage-image-video/repetition-controles";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

async function etatPret(): Promise<{ etat: EtatFabricationIV; o: OutilsFabricationIV; carte: CarteImage }> {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes: 5000 })), o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-20T08:00:00.000Z" }), o);
    else if (attendWillIV(e) === "script")
      e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) }), o);
    else break;
  }
  expect(e.etape).toBe("prete");
  return { etat: e, o, carte };
}

describe("répétition générale des contrôles (hors ligne)", () => {
  it("rejoue la porte sur les données enregistrées : même verdict, aucun appel payé ni tenté", async () => {
    const { etat, o } = await etatPret();
    const r = await repeterControlesIV(etat, { lireSon: o.controles.lireSon });
    expect(r.applicable).toBe(true);
    if (!r.applicable) return;
    expect(r.verdict.ok).toBe(true);
    expect(r.verdict.appelsPayes).toBe(0);
    expect(r.appelsBloques).toBe(0);
    expect(r.ecart).toEqual([]);
    expect(r.versions.length).toBeGreaterThan(0);
  });

  it("ne modifie pas l'état reçu", async () => {
    const { etat, o } = await etatPret();
    const avant = JSON.stringify(etat);
    await repeterControlesIV(etat, { lireSon: o.controles.lireSon });
    expect(JSON.stringify(etat)).toBe(avant);
  });

  it("transcriptions et relectures retirées : l'appel est BLOQUÉ et compté, jamais payé", async () => {
    const { etat, o } = await etatPret();
    const sans = structuredClone(etat);
    sans.controles = { transcriptions: {}, relectures: {} };
    const r = await repeterControlesIV(sans, { lireSon: o.controles.lireSon });
    expect(r.applicable).toBe(true);
    if (!r.applicable) return;
    expect(r.verdict.appelsPayes).toBe(0);
    expect(r.appelsBloques).toBeGreaterThan(0);
  });

  it("un rendu devenu mauvais (images noires) est refusé, et l'écart avec le verdict enregistré est dit", async () => {
    const { etat, o } = await etatPret();
    const abime = structuredClone(etat);
    for (const k of Object.keys(abime.rendus!)) abime.rendus![k].mesures = { ...abime.rendus![k].mesures!, noirMaxSec: 9 };
    const r = await repeterControlesIV(abime, { lireSon: o.controles.lireSon });
    expect(r.applicable).toBe(true);
    if (!r.applicable) return;
    expect(r.verdict.ok).toBe(false);
    expect(r.ecart.length).toBeGreaterThan(0);
  });

  it("état sans script ni rendu : non applicable, avec la raison", async () => {
    const carte = carteFixe("C");
    const r = await repeterControlesIV(etatInitialIV(demandeEssai(carte)));
    expect(r.applicable).toBe(false);
    if (r.applicable) return;
    expect(r.raison).toMatch(/script|rendu|carte/i);
  });

  it("entreePorteIV et miseEnSceneDesVersionsIV : la porte reçoit les versions mises en scène de l'état", async () => {
    const { etat } = await etatPret();
    const { entree } = entreePorteIV(etat);
    const versions = miseEnSceneDesVersionsIV(etat);
    expect(entree.versions).toEqual(versions);
    expect(versions.map((v) => v.version)).toEqual(etat.rendus ? Object.keys(etat.rendus) : []);
  });
});
