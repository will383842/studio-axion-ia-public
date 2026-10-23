/**
 * PLAN FACECAM v4 — LOT D « Parcours et agent monteur » (tests gardés : « Plafond atteint : aucun appel Claude et la
 * vidéo sort » ; « JSON de l'agent validé »). Module PUR : aucun dépôt, aucun réseau.
 */
import { describe, expect, it, vi } from "vitest";
import { entreesFacecamVides, EtatFacecam, MENTION_PLAFOND_FACECAM, type ConsigneFacecam } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import { schemaJson } from "@/generateur/roles/types";
import {
  annulerConsigne,
  lireReponseMonteur,
  piloterMonteur,
  reglagesMonteurVides,
  resumerCoupes,
  roleMonteurFacecam,
  schemaReponseMonteur,
  type EntreeMonteur,
  type EtatMonteur,
  type PassageMonteur,
} from "@/moteurs/montage-facecam/monteur";

/** 40 mots, un toutes les 0,5 s, à partir de 2 s (2 s de début à jeter). */
const MOTS: MotHorodate[] = Array.from({ length: 40 }, (_, i) => ({ mot: i === 20 ? "Certifexemple," : `mot${i}`, debutSec: 2 + i * 0.5, finSec: 2.4 + i * 0.5 }));

function etatDepart(): EtatMonteur {
  const facecam = entreesFacecamVides();
  facecam.coupes.auto = [
    { id: "c-debut", type: "debut", debutSec: 0, finSec: 2 },
    { id: "c-rep", type: "reprise", debutSec: 6, finSec: 8, libelle: "Phrase reprise" },
  ];
  return { facecam, reglages: reglagesMonteurVides() };
}

const consigne = (id: string, texte: string, dansPriseSec?: number): ConsigneFacecam => ({ id, origine: dansPriseSec === undefined ? "ecrite" : "voix", texte, etat: "comprise", ...(dansPriseSec !== undefined ? { dansPriseSec } : {}) });

function entree(partiel: Partial<EntreeMonteur> = {}): EntreeMonteur {
  return { titre: "3 erreurs à éviter", mots: MOTS, dureePriseSec: 22, etat: etatDepart(), plafondAtteint: false, ...partiel };
}

let n = 0;
const deps = () => ({ nouvelId: (p: string) => `${p}-${++n}`, maintenant: () => "2026-10-09T10:00:00.000Z" });

describe("Plafond atteint : aucun appel Claude et la vidéo sort", () => {
  it("version simple par règles fixes, sans appel ni relecture, avec la mention du plafond", async () => {
    const appeler = vi.fn();
    const relire = vi.fn();
    const r = await piloterMonteur(entree({ plafondAtteint: true, consignes: [consigne("k1", "Monteur, zoome ici", 9), consigne("k2", "Monteur, mets une musique plus calme", 12)] }), { ...deps(), appeler, relire });
    expect(appeler).not.toHaveBeenCalled();
    expect(relire).not.toHaveBeenCalled();
    expect(r.appelsClaude).toBe(0);
    expect(r.version).toBe("simple");
    expect(r.mention).toBe(MENTION_PLAFOND_FACECAM);
    expect(r.etatFacecam).toBe(EtatFacecam.PlafondAtteint);
    // La vidéo sort : les consignes reconnues sont appliquées par les règles fixes (modèles fixes, aucun HTML). V6 : la
    // musique n'est pas rendue → « Pas encore possible », jamais enregistrée comme faite.
    expect(r.comprises).toBe(1);
    expect(r.etat.facecam.passages.some((p) => p.type === "zoom")).toBe(true);
    expect(r.etat.reglages.son.musique).toBeNull();
    expect(r.resumes.find((x) => x.consigneId === "k2")).toMatchObject({ comprise: false, resume: expect.stringContaining("Pas encore possible") });
    expect(r.aDeposer).toEqual([]);
  });

  it("un refus « limite du mois » pendant l'appel donne aussi la version simple, sans second appel", async () => {
    const appeler = vi.fn().mockResolvedValue({ ok: false, arret: "en-attente-credit", message: "Limite atteinte." });
    const r = await piloterMonteur(entree({ consignes: [consigne("k1", "Monteur, rajoute un générique", 5)] }), { ...deps(), appeler });
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(r.version).toBe("simple");
    expect(r.mention).toBe(MENTION_PLAFOND_FACECAM);
    expect(r.etat.facecam.passages.some((p) => p.type === "generique")).toBe(true);
  });

  it("lot G : plafond de la VERSION atteint → version simple, sans second appel et sans mention (rien de visible)", async () => {
    const appeler = vi.fn().mockResolvedValue({ ok: false, arret: "plafond-video", message: "Version simple pour cette modification." });
    const r = await piloterMonteur(entree({ consignes: [consigne("k1", "Monteur, rajoute un générique", 5)] }), { ...deps(), appeler });
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(r.version).toBe("simple");
    expect(r.mention).toBeUndefined();
    expect(r.etat.facecam.passages.some((p) => p.type === "generique")).toBe(true);
  });
});

describe("JSON de l'agent validé", () => {
  it("le schéma part en sortie structurée (objets fermés, union en anyOf)", () => {
    const s = JSON.stringify(schemaJson(schemaReponseMonteur));
    expect(s).toContain('"additionalProperties":false');
    expect(s).toContain('"anyOf"');
    expect(s).not.toContain('"oneOf"');
    expect(roleMonteurFacecam.schema).toBe(schemaReponseMonteur);
  });

  it("relit opération par opération : une opération mal formée n'emporte pas les autres ; l'inconnue devient une carte sur mesure", () => {
    const lu = lireReponseMonteur({
      reponse: "C'est fait.",
      operations: [
        { type: "zoom", debutMot: 3, finMot: 6, style: "punch-in", cible: "visage" },
        { type: "zoom", debutMot: "trois" },
        { type: "fondEtoile", debutMot: 10, finMot: 14, description: "un ciel étoilé derrière le texte" },
      ],
      consignes: [{ consigneId: "k1", comprise: true, resume: "Zoom", operations: [0] }, { consigneId: "k2", comprise: true, resume: "Ciel", operations: [2] }, { consigneId: "k3", comprise: true, resume: "x", operations: [1] }],
    })!;
    expect(lu.operations).toHaveLength(2);
    expect(lu.operations[1]).toMatchObject({ type: "ajouterCarte", modele: null, html: null });
    expect(lu.ecartees).toEqual([expect.objectContaining({ index: 1 })]);
    expect(lu.consignes.find((c) => c.consigneId === "k2")!.operations).toEqual([1]);
    // Toutes ses opérations écartées : la consigne n'est plus « comprise ».
    expect(lu.consignes.find((c) => c.consigneId === "k3")!.comprise).toBe(false);
    expect(lireReponseMonteur("pas du json")).toBeNull();
  });

  it("une réponse de Claude est appliquée au mot exact ; le code HTML part sur R2 ; détourage seulement à la demande", async () => {
    const appeler = vi.fn().mockResolvedValue({
      ok: true,
      simule: false,
      donnees: {
        reponse: "J'ai ajouté l'animation des 3 étapes.",
        operations: [
          { type: "ajouterCarte", debutMot: 20, finMot: 22, modele: null, textes: ["1", "2", "3"], html: { html: "<div>1</div>", css: "div{}", timeline: "tl.to('div',{y:0})" }, disposition: "ecran-partage", description: "3 étapes en escalier", animationGardeeId: null },
          { type: "texteDerriere", debutMot: 30, finMot: 33, texte: "2026" },
        ],
        consignes: [{ consigneId: "fil", comprise: true, resume: "Animation des 3 étapes à 0:07", operations: [0] }],
      },
    });
    const relire = vi.fn().mockResolvedValue({ ok: true, defauts: [], corrections: [] });
    const r = await piloterMonteur(entree({ message: "Quand je dis Certifexemple, montre les 3 étapes en escalier" }), { ...deps(), appeler, relire });
    expect(appeler).toHaveBeenCalledTimes(1);
    expect(relire).toHaveBeenCalledTimes(1);
    expect(r.version).toBe("complete");
    const carte = r.etat.facecam.passages.find((p) => p.type === "ecran-partage") as PassageMonteur;
    // Mot 20 = 12 s dans la prise ; coupes 0-2 et 6-8 retirées → 8 s dans la vidéo montée. Carte de 3 s au moins.
    expect(carte.ancre.debutPriseSec).toBe(12);
    expect(carte.debutSec).toBeCloseTo(8);
    expect(carte.finSec - carte.debutSec).toBeGreaterThanOrEqual(3);
    expect(carte.contenuCle).toBeTruthy();
    expect((carte.operation as { html: unknown }).html).toBeNull();
    expect(r.aDeposer).toHaveLength(1);
    // Le « texte derrière » n'était demandé par personne : écarté.
    expect(r.etat.facecam.passages.some((p) => (p as PassageMonteur).detourage)).toBe(false);
    expect(r.resumes).toEqual([expect.objectContaining({ comprise: true, resume: "Animation des 3 étapes à 0:07" })]);
  });

  it("réponse inutilisable → UN nouvel essai guidé par l'erreur, puis règles fixes avec une phrase claire ; consigne inconnue → « non comprise »", async () => {
    const appeler = vi.fn().mockResolvedValue({ ok: true, simule: false, invalide: "Sortie qui n'est pas du JSON." });
    const r = await piloterMonteur(entree({ consignes: [consigne("k1", "Monteur, fais-moi un café", 4)] }), { ...deps(), appeler });
    // Panne du 10/10 : un seul nouvel essai, qui cite l'erreur exacte ; jamais un troisième.
    expect(appeler).toHaveBeenCalledTimes(2);
    expect(appeler.mock.calls[1][0].variable).toContain("Sortie qui n'est pas du JSON.");
    expect(r.reponse).toContain("Le monteur complet n'a pas pu traiter cette demande");
    expect(r.version).toBe("simple");
    expect(r.nonComprises).toBe(1);
    expect(r.etatFacecam).toBe(EtatFacecam.ConsigneNonComprise);
    expect(r.etat.facecam.consignes[0].etat).toBe("non-comprise");
  });

  it("relecture : 1 correction au plus ; bords ratés → variante sans détourage (« Effet non réussi »)", async () => {
    // V6 : le texte derrière Will n'est pas encore rendu → refusé, jamais « Fait. » ; un passage à détourage d'une
    // ancienne version garde la variante sans détourage quand la relecture voit des bords ratés.
    const passageId = "pas-ancien";
    const etat = etatDepart();
    etat.facecam.passages = [{ id: passageId, type: "autre", debutSec: 15, finSec: 17, origine: "demande", ancre: { debutPriseSec: 17, finPriseSec: 19 }, operation: { type: "texteDerriere", debutMot: 30, finMot: 33, texte: "2026" }, detourage: true } as PassageMonteur];
    const appeler = vi.fn().mockResolvedValue({
      ok: true,
      simule: false,
      donnees: { reponse: "Fait.", operations: [{ type: "texteDerriere", debutMot: 30, finMot: 33, texte: "2026" }], consignes: [{ consigneId: "k1", comprise: true, resume: "Texte derrière vous", operations: [0] }] },
    });
    const relire = vi.fn().mockResolvedValue({ ok: false, defauts: [{ elementId: passageId, defaut: "bords-detourage", detail: "cheveux" }], corrections: [] });
    const r = await piloterMonteur(entree({ etat, consignes: [consigne("k1", "Monteur, écris 2026 entre le mur et moi", 16)] }), { ...deps(), appeler, relire });
    expect(r.reponse).not.toMatch(/^Fait/);
    expect(r.reponse).toContain("Pas encore possible");
    expect(r.etat.facecam.passages).toHaveLength(1);
    expect(relire).toHaveBeenCalledTimes(1);
    expect(r.effetsRates).toEqual([passageId]);
    expect(r.etatFacecam).toBe(EtatFacecam.EffetRate);
    expect((r.etat.facecam.passages[0] as PassageMonteur).sansDetourage).toBe(true);
  });
});

describe("non-régression du parcours (Annuler, résumé des coupes)", () => {
  it("« Annuler » une consigne retire ses effets et remet l'image, sans toucher aux autres", async () => {
    const r = await piloterMonteur(entree({ consignes: [consigne("k1", "Monteur, un peu plus chaud", 3), consigne("k2", "Monteur, zoome", 9)] }), deps());
    expect(r.etat.facecam.image.couleurs).toBe("plus");
    const annule = annulerConsigne(r.etat, "k1");
    expect(annule.facecam.image.couleurs).toBe("juste");
    expect(annule.reglages.teinte).toBe("neutre");
    expect(annule.facecam.passages.some((p) => p.type === "zoom")).toBe(true);
    expect(annule.facecam.consignes.find((c) => c.id === "k1")!.etat).toBe("annulee");
  });

  it("« 2 passages retirés · 0:22 → 0:18 »", () => {
    expect(resumerCoupes(etatDepart().facecam, 22).phrase).toBe("2 passages retirés · 0:22 → 0:18");
  });
});
