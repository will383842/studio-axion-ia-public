/**
 * GV-EC-04 · Un script refusé sur la forme seule est proposé à relire (« à trancher ») au lieu d'échouer.
 * Un chiffre inventé, un mot interdit ou un JSON illisible gardent le refus. Aucun appel de plus : 2 essais au plus.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { APPELS_ECRITURE_MAX, CODES_REGLES_JAMAIS_FAUX, ecrireScriptIV, peutEtreProposeARelire, type OutilsEcritureIV, type ReponseAppelIV } from "@/moteurs/montage-image-video/ecriture";
import { ficheSimulee } from "@/moteurs/montage-image-video/ecriture.simulation";
import { avancerJusquAArretIV, etatInitialIV, validerCarteIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { cleFormule, verifierScript, type ChoixFormule } from "@/moteurs/montage-image-video/regles";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

const lireCarte = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const GARDER: Record<string, ChoixFormule> = Object.fromEntries(
  ["dès le premier jour", "0 demande perdue", "toujours", "0 question sans réponse", "risque erreur : zéro", "Zéro erreur"].map((f) => [cleFormule(f), "garder" as const]),
);
const carteC = lireCarte("C");
const carteD = lireCarte("D");
const ficheC = ficheSimulee("essai-c")!;
const ficheD = ficheSimulee("essai-d")!;

function outils(reponses: ReponseAppelIV[]): { o: OutilsEcritureIV; appels: number[] } {
  const appels: number[] = [];
  let i = 0;
  const o: OutilsEcritureIV = {
    budget: { reserver: async () => ({ ok: true }) },
    appeler: async () => {
      appels.push(i);
      return reponses[i++]!;
    },
  };
  return { o, appels };
}
const donnees = (f: FicheImage): ReponseAppelIV => ({ ok: true, simule: true, donnees: f });
const entreeC = () => ({ videoId: "v1", versionId: "s1", carte: carteC, choixFormules: GARDER });
const entreeD = () => ({ videoId: "v1", versionId: "s1", carte: carteD, choixFormules: GARDER });

const PHRASE_AJOUT = "Cette méthode reste simple à suivre pour tous.";
/** Rallonge le corps (écrans du milieu seulement) jusqu'à la limite de 400 caractères par écran : seule la durée sort de sa tolérance. */
function tropLongue(f: FicheImage): FicheImage {
  const c = structuredClone(f);
  for (const e of c.ecrans) {
    if (e.partie === "accroche" || e.partie === "phrase-choc") continue;
    while (e.texteDit.length + 1 + PHRASE_AJOUT.length <= 400) e.texteDit = `${e.texteDit} ${PHRASE_AJOUT}`;
  }
  return c;
}

describe("liste « jamais faux »", () => {
  it("contient les règles de chiffres, d'interdits et de tutoiement ; pas la durée", () => {
    for (const code of ["Q04", "Q05", "Q08", "Q08bis"] as const) expect(CODES_REGLES_JAMAIS_FAUX).toContain(code);
    expect(CODES_REGLES_JAMAIS_FAUX).not.toContain("Q10");
  });
  it("peutEtreProposeARelire : vrai sans manquement, faux avec un manquement de la liste", () => {
    expect(peutEtreProposeARelire({ manquements: [] })).toBe(true);
    expect(peutEtreProposeARelire({ manquements: [{ regle: "Q10", priorite: 5, message: "durée" }] })).toBe(true);
    expect(peutEtreProposeARelire({ manquements: [{ regle: "Q10", priorite: 5, message: "durée" }, { regle: "Q05", priorite: 4, message: "chiffre" }] })).toBe(false);
  });
});

describe("écriture : repli « à relire »", () => {
  it("deux essais hors durée : à trancher, la meilleure fiche est proposée, 2 appels", async () => {
    const longue = tropLongue(ficheC);
    const v = verifierScript(longue, { carte: carteC, choixFormules: GARDER });
    expect(v.manquements.some((m) => m.regle === "Q10")).toBe(true);
    const { o, appels } = outils([donnees(longue), donnees(longue)]);
    const r = await ecrireScriptIV(entreeC(), o);
    expect(appels).toHaveLength(APPELS_ECRITURE_MAX);
    expect(r).toMatchObject({ ok: false, motif: "a-trancher", appels: APPELS_ECRITURE_MAX });
    if (r.ok || r.motif !== "a-trancher") throw new Error("motif inattendu");
    expect(r.fiche).toEqual(longue);
    expect(r.aTrancher.length).toBeGreaterThan(0);
    expect(r.refus).toEqual(r.verdict.manquements.map((m) => m.message));
    expect(r.refus.some((m) => m.startsWith("Script de "))).toBe(true);
  });

  it("un chiffre hors image que la réparation ne peut pas retirer garde le refus", async () => {
    // « 3h » est relu comme une durée : pas de réparation sans appel (cas déjà couvert dans ecriture.test.ts).
    const f = structuredClone(ficheD);
    const e14 = f.ecrans.find((e) => e.id === "e14")!;
    e14.texteDit = "Deux heures récupérées par jour. Il part à trois heures du matin.";
    e14.textesEcran = [...e14.textesEcran, "3h du matin"];
    e14.surMot = [{ mot: 0, action: "apparait" }];
    const { o, appels } = outils([donnees(f), donnees(f)]);
    const r = await ecrireScriptIV(entreeD(), o);
    expect(appels).toHaveLength(APPELS_ECRITURE_MAX);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
  });

  it("une fiche rallongée qui porte aussi un mot interdit garde le refus", async () => {
    const f = tropLongue(ficheC);
    f.ecrans[1]!.texteDit = "Une machine fait le reste.";
    const { o } = outils([donnees(f), donnees(f)]);
    expect(await ecrireScriptIV(entreeC(), o)).toMatchObject({ ok: false, motif: "refusee" });
  });

  it("JSON illisible aux deux essais : refus, comme avant", async () => {
    const illisible: ReponseAppelIV = { ok: true, simule: true, texte: "pas du JSON" };
    const { o } = outils([illisible, illisible]);
    expect(await ecrireScriptIV(entreeC(), o)).toMatchObject({ ok: false, motif: "refusee", appels: APPELS_ECRITURE_MAX });
  });
});

describe("fabrication : mode lot", () => {
  it("le script à relire n'est pas validé tout seul : la vidéo attend Will, aucune voix payée", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const base = outilsSimules(carte, m);
    const longue = tropLongue(ficheC);
    const o: OutilsFabricationIV = { ...base, relancesAuto: false, ecriture: { appeler: async () => ({ ok: true, simule: true, donnees: longue }) } };
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: { id: "lot-1", rang: 1 } })), o);
    // En lot, la carte sans doute est validée par le contrôle automatique ; sinon Will la valide ici (le test porte sur le script).
    if (e.etape === "carte-a-valider") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
    expect(e.etape).toBe("script-a-valider");
    expect(e.miseDeCote).toMatchObject({ porte: "script" });
    expect(e.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(0);
    expect(m.lus).toHaveLength(0);
  });
});
