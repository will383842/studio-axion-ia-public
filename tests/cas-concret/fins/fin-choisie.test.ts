/**
 * FIX-CC-FIN-CHOIX-b1 (D1, 17/11) : la fin « rendez-vous » choisie existe pour le plan des fins (pur, invisible).
 * Absence de `finDemandee` = « Aucune » = sortie identique à #1094. Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { choisir } from "@/briques/fins";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { ReseauCas } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { refusAvantPrix } from "@/moteurs/montage-cas-concret/avant-prix";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import { DIT_FIN_RENDEZ_VOUS, ECRAN_FIN_RENDEZ_VOUS, FINS_RENDEZ_VOUS, TABLE_FINS_RENDEZ_VOUS, VALIDATION_D1 } from "@/moteurs/montage-cas-concret/fin-choisie";
import { phrasesDiagnosticInterchangeables, planDesFins, RAISON_MOT_VERS_RDV } from "@/moteurs/montage-cas-concret/fins";

const CAS = trouverCas("contact-vers-crm")!;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const demande = (o: { reseaux: ReseauCas[]; avecMot: boolean; motSur?: ReseauCas[]; finDemandee?: unknown }) => ({
  ...o,
  offre: CAS.offre,
  ...(CAS.nature ? { nature: CAS.nature } : {}),
  mot: CAS.mot,
  ...(CAS.motDit ? { motDit: CAS.motDit } : {}),
  table: TABLE_FINS_DIAGNOSTIC,
}) as Parameters<typeof planDesFins>[0];
const dits = (reseau: ReseauCas, o: { avecMot: boolean; motSur?: ReseauCas[]; finDemandee?: unknown }) => planDesFins(demande({ reseaux: [reseau], ...o })).fins[0].appels.map((a) => a.dit);

describe("FIX-CC-FIN-CHOIX-b1 · a) absent ou inconnu = Aucune (identique à #1094)", () => {
  it.each(TOUS)("%s : finDemandee absent / undefined / inconnu → même plan, fin vide", (r) => {
    const base = planDesFins(demande({ reseaux: [r], avecMot: false }));
    expect(planDesFins(demande({ reseaux: [r], avecMot: false, finDemandee: undefined }))).toEqual(base);
    expect(planDesFins(demande({ reseaux: [r], avecMot: false, finDemandee: "autre" }))).toEqual(base);
    for (const f of base.fins) expect(f.appels).toEqual([]);
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · b) « rendez-vous » : la phrase D1 puis le lien du réseau", () => {
  it("dit, par réseau", () => {
    const rdv = "Prenez rendez-vous pour votre diagnostic IA gratuit de 45 minutes.";
    expect(dits("facebook", { avecMot: false, finDemandee: "rendez-vous" })).toEqual([rdv, "Le lien est en commentaire."]);
    expect(dits("instagram", { avecMot: false, finDemandee: "rendez-vous" })).toEqual([rdv, "Le lien est dans mon profil."]);
    expect(dits("tiktok", { avecMot: false, finDemandee: "rendez-vous" })).toEqual([rdv, "Le lien est dans mon profil."]);
    expect(dits("linkedin", { avecMot: false, finDemandee: "rendez-vous" })).toEqual([rdv, "Le lien est en premier commentaire."]);
  });
  it("écrans : diagnostic puis lien, titre et ligne mot pour mot", () => {
    const plan = planDesFins(demande({ reseaux: ["facebook"], avecMot: false, finDemandee: "rendez-vous" }));
    expect(plan.sansFin).toEqual([]);
    const e = plan.fins[0].ecrans;
    expect(e.map((x) => x.type)).toEqual(["diagnostic", "lien"]);
    expect(e[0]).toMatchObject({ titre: "Prenez rendez-vous", ligne: "pour votre diagnostic IA gratuit de 45 minutes" });
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · c) la fin au mot reste prioritaire (D3)", () => {
  it("mot branché sur Facebook seulement", () => {
    const plan = planDesFins(demande({ reseaux: TOUS, avecMot: true, motSur: ["facebook"], finDemandee: "rendez-vous" }));
    const de = (r: ReseauCas) => plan.fins.find((f) => f.reseaux.includes(r))!;
    expect(de("facebook").appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    for (const r of ["instagram", "tiktok", "linkedin"] as const) expect(de(r).appels.map((a) => a.id)).toEqual(FINS_RENDEZ_VOUS[r]);
  });
  it("mot coché mais branché nulle part : la raison porte RAISON_MOT_VERS_RDV", () => {
    const plan = planDesFins(demande({ reseaux: ["facebook"], avecMot: true, motSur: [], finDemandee: "rendez-vous" }));
    expect(plan.reduites.map((r) => r.raison)).toContain(RAISON_MOT_VERS_RDV);
    expect(plan.fins[0].appels.map((a) => a.id)).toEqual(FINS_RENDEZ_VOUS.facebook);
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · e) jamais « quelques minutes »", () => {
  it.each([[undefined], ["rendez-vous"]])("finDemandee %s × avecMot × réseaux", (finDemandee) => {
    for (const avecMot of [false, true]) {
      const plan = planDesFins(demande({ reseaux: TOUS, avecMot, motSur: TOUS, finDemandee }));
      expect(JSON.stringify(plan.fins.map((f) => [f.appels.map((a) => [a.dit, a.ecran]), f.ecrans.map((e) => [e.texteDit, "titre" in e ? e.titre : "", "ligne" in e ? e.ligne : ""])]))).not.toMatch(/quelques minutes/i);
    }
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · f) la table à part", () => {
  it("chaque ligne passe choisir sur les réseaux de son groupe, validée D1", () => {
    const reseauxDe = { "instagram-facebook": ["instagram", "facebook"], "tiktok-youtube": ["tiktok"], linkedin: ["linkedin"] } as const;
    for (const l of TABLE_FINS_RENDEZ_VOUS) {
      expect(l.validation).toBe(VALIDATION_D1);
      expect(l.dit).toBe(DIT_FIN_RENDEZ_VOUS);
      expect(l.ecran).toBe(ECRAN_FIN_RENDEZ_VOUS);
      for (const r of reseauxDe[l.groupe as keyof typeof reseauxDe]) expect(() => choisir(l, r)).not.toThrow();
    }
  });
  it("la table du diagnostic est inchangée", () => {
    expect(TABLE_FINS_DIAGNOSTIC).toHaveLength(27);
    expect(phrasesDiagnosticInterchangeables("facebook", TABLE_FINS_DIAGNOSTIC)).toHaveLength(2);
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · g) lecture tolérante des entrées", () => {
  const lire = (v: unknown) => lireEntreesCasConcret({ casConcret: { reseaux: ["facebook"], finDemandee: v } } as never);
  it("« rendez-vous » exact seulement", () => {
    expect(lire("rendez-vous").finDemandee).toBe("rendez-vous");
    for (const v of ["Rendez-vous", true, "aucune", undefined]) expect(lire(v)).not.toHaveProperty("finDemandee");
  });
  it("entrées de master : même objet", () => {
    expect(lireEntreesCasConcret({ casConcret: { reseaux: ["facebook"] } } as never)).toEqual(lire(undefined));
  });
});

describe("FIX-CC-FIN-CHOIX-b1 · h) avant le prix", () => {
  const d = (table?: typeof TABLE_FINS_DIAGNOSTIC) => ({ cas: CAS, reseaux: ["facebook"] as ReseauCas[], mot: CAS.mot, avecMot: false, motSur: [] as ReseauCas[], essai: true, finDemandee: "rendez-vous" as const, ...(table ? { table } : {}) });
  it("table sans la ligne de lien : refus « sans fin » ; vraie table : null", () => {
    const sansLien = TABLE_FINS_DIAGNOSTIC.filter((l) => l.id !== "fin-fb-lien-commentaire");
    expect(refusAvantPrix(d(sansLien))).toBe("Aucune fin utilisable pour Facebook : décochez ce réseau.");
    expect(refusAvantPrix(d())).toBeNull();
  });
});
