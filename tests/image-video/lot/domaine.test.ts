/**
 * LOT D'IMAGES · L1 — domaine pur du lot : prix, taille, prochaine vidéo à lancer, statut depuis la machine, issues,
 * compteurs. Aucun réseau, aucune base.
 */
import { describe, expect, it } from "vitest";
import {
  LOT_MAX_IV,
  PANNES_AVANT_PAUSE_IV,
  appliquerIssueIV,
  prixDuLotIV,
  prochaineALancerIV,
  refusTailleLotIV,
  restantAReserverIV,
  resumeLotIV,
  statutDepuisEtatIV,
  type LotIV,
  type StatutVideoLotIV,
  type VideoDuLotIV,
} from "@/domaine/image-video/lot";

function lotDe(statuts: StatutVideoLotIV[], surcharge: Partial<LotIV> = {}): LotIV {
  const videos: VideoDuLotIV[] = statuts.map((statut, i) => ({ rang: i + 1, videoId: `v${i + 1}`, fichierId: `f${i + 1}`, nom: `image-${i + 1}.png`, statut }));
  return {
    version: "lot-iv/1",
    id: "lot-iv-0123456789ab",
    creeLe: "2026-10-17T10:00:00.000Z",
    cleIdempotence: "cle",
    reseaux: ["linkedin"],
    prixParVideoCentimes: 220,
    accordCentimes: 220 * statuts.length,
    plafondCentimes: 220 * statuts.length,
    tauxUsdEur: 1,
    videos,
    statut: "en-cours",
    pannesDeSuite: 0,
    journal: [],
    ...surcharge,
  };
}

describe("prix et taille du lot", () => {
  it("le prix du lot est N × le prix d'une vidéo", () => {
    expect(prixDuLotIV(5, 220)).toBe(1100);
    expect(prixDuLotIV(2, 0)).toBe(0);
  });
  it("refuse moins de 2 et plus de LOT_MAX_IV images, accepte 2..10", () => {
    expect(LOT_MAX_IV).toBe(10);
    expect(refusTailleLotIV(1)).toEqual(expect.any(String));
    expect(refusTailleLotIV(0)).toEqual(expect.any(String));
    expect(refusTailleLotIV(LOT_MAX_IV + 1)).toEqual(expect.any(String));
    expect(refusTailleLotIV(2)).toBeNull();
    expect(refusTailleLotIV(LOT_MAX_IV)).toBeNull();
  });
});

describe("prochaineALancerIV", () => {
  it("rend la première en attente, par rang", () => {
    const lot = lotDe(["faite", "en-attente", "en-attente"]);
    expect(prochaineALancerIV(lot, false)?.rang).toBe(2);
  });
  it("respecte l'ordre des rangs même si le tableau est mélangé", () => {
    const lot = lotDe(["en-attente", "en-attente", "en-attente"]);
    lot.videos.reverse();
    expect(prochaineALancerIV(lot, false)?.rang).toBe(1);
  });
  it("jamais deux à la fois : rien si une vidéo du lot est en fabrication", () => {
    expect(prochaineALancerIV(lotDe(["en-fabrication", "en-attente"]), false)).toBeNull();
  });
  it("rien si une autre fabrication Image → vidéo est active", () => {
    expect(prochaineALancerIV(lotDe(["en-attente"]), true)).toBeNull();
  });
  it("rien si le lot est en pause, arrêté ou terminé", () => {
    for (const statut of ["en-pause", "arrete", "termine"] as const) expect(prochaineALancerIV(lotDe(["en-attente"], { statut }), false)).toBeNull();
  });
  it("continue après une mise de côté", () => {
    expect(prochaineALancerIV(lotDe(["mise-de-cote", "en-attente"]), false)?.rang).toBe(2);
  });
  it("rien quand plus rien n'est en attente", () => {
    expect(prochaineALancerIV(lotDe(["faite", "mise-de-cote", "refaite"]), false)).toBeNull();
  });
});

describe("statutDepuisEtatIV (table b.2)", () => {
  it("aucune fabrication → en-attente", () => {
    expect(statutDepuisEtatIV(null, null).statut).toBe("en-attente");
  });
  it("étapes de la chaîne en cours → en-fabrication", () => {
    for (const etape of ["lecture", "ecriture", "voix", "mise-en-scene", "rendu", "controles", "livraison"] as const) {
      expect(statutDepuisEtatIV({ etape }, "en_cours").statut).toBe("en-fabrication");
    }
    expect(statutDepuisEtatIV({ etape: "lecture" }, "en_file").statut).toBe("en-fabrication");
  });
  it("carte-a-valider avec miseDeCote → mise de côté, porte carte", () => {
    const r = statutDepuisEtatIV({ etape: "carte-a-valider", miseDeCote: { porte: "carte", motif: "Un point est incertain.", phrases: ["a"] } }, "echec");
    expect(r.statut).toBe("mise-de-cote");
    expect(r.miseDeCote).toMatchObject({ porte: "carte", motif: "Un point est incertain.", phrases: ["a"] });
  });
  it("script-a-valider avec miseDeCote → mise de côté, porte script", () => {
    const r = statutDepuisEtatIV({ etape: "script-a-valider", miseDeCote: { porte: "script", motif: "Formule.", phrases: [] } }, "echec");
    expect(r.statut).toBe("mise-de-cote");
    expect(r.miseDeCote?.porte).toBe("script");
  });
  it("une porte SANS miseDeCote n'est pas une mise de côté (vidéo seule, Will décide)", () => {
    expect(statutDepuisEtatIV({ etape: "carte-a-valider" }, "echec").statut).toBe("en-fabrication");
  });
  it("refusee → mise de côté, porte arret, motif et phrases du refus, code gardé", () => {
    const r = statutDepuisEtatIV({ etape: "refusee", refus: { code: "IV_RENDU", message: "Le rendu a échoué.", phrases: ["p1"] } }, "echec");
    expect(r.statut).toBe("mise-de-cote");
    expect(r.miseDeCote).toMatchObject({ porte: "arret", motif: "Le rendu a échoué.", phrases: ["p1"], code: "IV_RENDU" });
  });
  it("prete → faite", () => {
    expect(statutDepuisEtatIV({ etape: "prete" }, "termine").statut).toBe("faite");
  });
  it("travail annulé → mise de côté « Arrêtée. »", () => {
    const r = statutDepuisEtatIV({ etape: "voix" }, "annule");
    expect(r.statut).toBe("mise-de-cote");
    expect(r.miseDeCote).toMatchObject({ porte: "arret", motif: "Arrêtée." });
  });
});

describe("appliquerIssueIV", () => {
  const panne = { statut: "mise-de-cote" as const, miseDeCote: { porte: "arret" as const, motif: "x", phrases: [], code: "IV_PANNE" } };
  const porte = { statut: "mise-de-cote" as const, miseDeCote: { porte: "carte" as const, motif: "x", phrases: [] } };

  it("ne modifie pas le lot reçu", () => {
    const lot = lotDe(["en-fabrication", "en-attente"]);
    const copie = structuredClone(lot);
    appliquerIssueIV(lot, 1, { statut: "faite" });
    expect(lot).toEqual(copie);
  });
  it("pose le statut de la vidéo et remet les pannes à 0 sur « faite »", () => {
    const lot = appliquerIssueIV(lotDe(["en-fabrication", "en-attente"], { pannesDeSuite: 1 }), 1, { statut: "faite" });
    expect(lot.videos[0].statut).toBe("faite");
    expect(lot.pannesDeSuite).toBe(0);
    expect(lot.statut).toBe("en-cours");
  });
  it("PANNES_AVANT_PAUSE_IV pannes de suite → pause « pannes »", () => {
    expect(PANNES_AVANT_PAUSE_IV).toBe(2);
    let lot = lotDe(["en-fabrication", "en-fabrication", "en-attente"]);
    lot = appliquerIssueIV(lot, 1, panne);
    expect(lot.pannesDeSuite).toBe(1);
    expect(lot.statut).toBe("en-cours");
    lot = appliquerIssueIV(lot, 2, panne);
    expect(lot.pannesDeSuite).toBe(2);
    expect(lot.statut).toBe("en-pause");
    expect(lot.pause?.raison).toBe("pannes");
    expect(lot.pause?.phrase).toEqual(expect.any(String));
  });
  it("le même arrêt relu à un autre tour ne compte qu'une fois", () => {
    let lot = lotDe(["en-fabrication", "en-attente"]);
    lot = appliquerIssueIV(lot, 1, panne);
    lot = appliquerIssueIV(lot, 1, panne);
    expect(lot.pannesDeSuite).toBe(1);
  });
  it("une mise de côté par une porte n'est pas une panne et casse la suite", () => {
    let lot = lotDe(["en-fabrication", "en-fabrication", "en-attente"], { pannesDeSuite: 1 });
    lot = appliquerIssueIV(lot, 1, porte);
    expect(lot.pannesDeSuite).toBe(0);
    expect(lot.statut).toBe("en-cours");
  });
  it("les codes IV_NON_RELIE, IV_RENDU, IV_BUDGET, IV_PLAFOND comptent aussi, pas IV_VOIX", () => {
    for (const code of ["IV_NON_RELIE", "IV_RENDU", "IV_BUDGET", "IV_PLAFOND"]) {
      const l = appliquerIssueIV(lotDe(["en-fabrication", "en-attente"]), 1, { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: "x", phrases: [], code } });
      expect(l.pannesDeSuite, code).toBe(1);
    }
    const l = appliquerIssueIV(lotDe(["en-fabrication", "en-attente"]), 1, { statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: "x", phrases: [], code: "IV_VOIX" } });
    expect(l.pannesDeSuite).toBe(0);
  });
  it("termine quand plus aucune vidéo n'est en attente ni en fabrication", () => {
    const lot = appliquerIssueIV(lotDe(["faite", "en-fabrication"]), 2, { statut: "faite" });
    expect(lot.statut).toBe("termine");
    expect(lot.pause).toBeUndefined();
  });
  it("un lot arrêté reste arrêté", () => {
    const lot = appliquerIssueIV(lotDe(["en-fabrication", "en-attente"], { statut: "arrete" }), 1, { statut: "faite" });
    expect(lot.statut).toBe("arrete");
  });
  it("une vidéo refaite garde son statut", () => {
    const lot = appliquerIssueIV(lotDe(["refaite", "en-attente"]), 1, { statut: "faite" });
    expect(lot.videos[0].statut).toBe("refaite");
  });
  it("une mise de côté garde son motif ; revenir en fabrication l'efface", () => {
    let lot = appliquerIssueIV(lotDe(["en-fabrication", "en-attente"]), 1, porte);
    expect(lot.videos[0].miseDeCote?.porte).toBe("carte");
    lot = appliquerIssueIV(lot, 1, { statut: "en-fabrication" });
    expect(lot.videos[0].miseDeCote).toBeUndefined();
  });
});

describe("compteurs", () => {
  it("resumeLotIV compte chaque statut", () => {
    const lot = lotDe(["faite", "faite", "mise-de-cote", "en-attente", "en-fabrication", "refaite"]);
    expect(resumeLotIV(lot)).toEqual({ faites: 2, misesDeCote: 1, enAttente: 1, enFabrication: 1, refaites: 1 });
  });
  it("restantAReserverIV = prix par vidéo × vidéos en attente", () => {
    expect(restantAReserverIV(lotDe(["faite", "en-attente", "en-attente", "en-fabrication"]))).toBe(440);
    expect(restantAReserverIV(lotDe(["faite"]))).toBe(0);
  });
});

describe("phrase de fin de lot", () => {
  it("« Lot terminé : 3 faites, 2 mises de côté », singulier et pluriel", async () => {
    const { phraseFinDeLotIV } = await import("@/domaine/notifications-textes");
    expect(phraseFinDeLotIV({ faites: 3, misesDeCote: 2 })).toBe("Lot terminé : 3 faites, 2 mises de côté");
    expect(phraseFinDeLotIV({ faites: 1, misesDeCote: 1 })).toBe("Lot terminé : 1 faite, 1 mise de côté");
    expect(phraseFinDeLotIV({ faites: 4, misesDeCote: 0 })).toBe("Lot terminé : 4 faites");
  });
});
