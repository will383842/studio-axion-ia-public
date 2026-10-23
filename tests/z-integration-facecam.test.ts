/**
 * Intégration Z : ce que la fusion des lots G, H et I doit garder ensemble.
 *  - la retouche réelle (G) reprend les effets spéciaux (I) des passages en vigueur : un changement d'effet ne relance
 *    que l'habillage ;
 *  - la retouche reprend la piste multicaméra (H) tant que la piste montée n'est pas refaite ;
 *  - le monteur face caméra relit sa réponse avec la brique commune (H) : même résultat ;
 *  - les effets (F3 / I) sont dans le catalogue commun de la brique monteur.
 * PUR : aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE_EFFETS_COMMUN, lireReponseOperations, schemaReponsePour } from "@/briques/monteur";
import { effetsDesEntrees, etatPourRetouche, partiesARefaire, signatureMontage, VERSION_REPRISE, type RepriseChaine } from "@/moteurs/montage-facecam/retouche";
import { CATALOGUE_MONTEUR, lireReponseMonteur, schemaOperationFacecam, schemaReponseMonteur } from "@/moteurs/montage-facecam/monteur";
import { CATALOGUE_EFFETS, reparerEffetSpecial } from "@/moteurs/montage-facecam/monteur/effets";

const VITRE = { id: "pas-vitre", type: "autre", debutSec: 3, finSec: 4.2, origine: "demande", ancre: { debutPriseSec: 3.4, finPriseSec: 4.6 }, operation: { type: "vitreBrisee", auMot: 20, dureeSec: 1.2, revele: "suivant", texteCarte: null, bruitage: true } };
const CHIFFRE = { id: "pas-2", type: "carte", debutSec: 12, finSec: 16, origine: "demande", ancre: { debutPriseSec: 12, finPriseSec: 16 }, operation: { type: "ajouterCarte", debutMot: 25, finMot: 32, modele: "chiffre", textes: ["30 %", "de temps gagné"], html: null, disposition: "plein-ecran", description: "30 % de temps gagné", animationGardeeId: null } };

const entrees = (passages: unknown[]) => ({ facecam: { coupes: { auto: [], retablies: [] }, passages } });

function reprise(e: Record<string, unknown>, multicamera = false): RepriseChaine {
  return { version: VERSION_REPRISE, signature: signatureMontage(e), travaux: {}, cartes: [], dureeSec: 30, ...(multicamera ? { multicamera: { statut: "fait" as const } } : {}) };
}

describe("Intégration Z · retouche (G) × effets (I) × multicaméra (H)", () => {
  it("les effets des passages en vigueur repartent dans l'état de la retouche (le monteur n'est pas rappelé)", () => {
    const e = entrees([VITRE, CHIFFRE]);
    expect(effetsDesEntrees(e).effets?.map((p) => p.id)).toEqual(["pas-vitre"]);
    expect(effetsDesEntrees(entrees([CHIFFRE]))).toEqual({});
    const etat = etatPourRetouche(reprise(e), { entrees: e }, new Set(["habillage"]), []);
    expect(etat.monteur?.effets?.map((p) => p.id)).toEqual(["pas-vitre"]);
  });

  it("un changement d'effet (ajout, réglage, retrait) ne relance que l'habillage", () => {
    const avant = signatureMontage(entrees([CHIFFRE]));
    const ajout = signatureMontage(entrees([CHIFFRE, VITRE]));
    const regle = signatureMontage(entrees([CHIFFRE, { ...VITRE, operation: { ...VITRE.operation, dureeSec: 0.8 } }]));
    expect(ajout.habillage).not.toBe(avant.habillage);
    expect([...partiesARefaire(avant, ajout)]).toEqual(["habillage"]);
    expect([...partiesARefaire(signatureMontage(entrees([CHIFFRE, VITRE])), regle)]).toEqual(["habillage"]);
    expect([...partiesARefaire(ajout, avant)]).toEqual(["habillage"]);
  });

  it("la piste multicaméra est reprise pour l'habillage seul, refaite si la piste montée l'est", () => {
    const e = entrees([CHIFFRE]);
    expect(etatPourRetouche(reprise(e, true), { entrees: e }, new Set(["habillage"]), []).multicamera).toEqual({ statut: "fait" });
    for (const p of ["assemblage", "image", "son"] as const) expect(etatPourRetouche(reprise(e, true), { entrees: e }, new Set(["habillage", p]), []).multicamera).toBeUndefined();
  });
});

describe("Intégration Z · monteur face caméra sur la brique commune (H)", () => {
  it("relecture de la brique commune, avec les réparateurs du face caméra : même résultat", () => {
    const brut = {
      reponse: " C'est fait. ",
      operations: [
        { type: "zoom", debutMot: 3, finMot: 4, style: "punch-in", cible: "visage" },
        { type: "pluie-de-confettis", description: "des confettis sur « bravo »", debutMot: 9 },
        { type: "zoom", debutMot: "x" },
        { type: "vitreBrisee", auMot: 12 },
      ],
      consignes: [{ consigneId: "fil", comprise: true, resume: "ok", operations: [0, 1, 2, 3] }],
    };
    const lu = lireReponseMonteur(brut)!;
    expect(lu.reponse).toBe("C'est fait.");
    expect(lu.operations.map((o) => o.type)).toEqual(["zoom", "ajouterCarte", "vitreBrisee"]);
    expect(lu.ecartees.map((x) => x.index)).toEqual([2]);
    expect(lu.consignes[0].operations).toEqual([0, 1, 2]);
    // Sans le réparateur de carte sur mesure, la brique écarte l'opération inconnue (le réparateur est bien celui du format).
    expect(lireReponseOperations(brut, schemaOperationFacecam, [reparerEffetSpecial])!.operations.map((o) => o.type)).toEqual(["zoom", "vitreBrisee"]);
    expect(Object.keys(schemaReponseMonteur.shape)).toEqual(Object.keys(schemaReponsePour(schemaOperationFacecam).shape));
  });

  it("les effets spéciaux sont dans le catalogue commun, repris tels quels par le face caméra", () => {
    expect(CATALOGUE_EFFETS).toEqual(CATALOGUE_EFFETS_COMMUN);
    expect(CATALOGUE_MONTEUR.slice(-3)).toEqual(CATALOGUE_EFFETS_COMMUN);
    for (const e of CATALOGUE_EFFETS_COMMUN) expect(e.regle).toMatch(/^À LA DEMANDE SEULEMENT/);
  });
});

describe("Intégration Z · objet posé réaliste (I2) raccordé à la chaîne (I)", () => {
  it("reflets et caractère de la prise mesurés sur la vignette ; sans vignette, rien (rendu d'avant)", async () => {
    const { realismeDeLaVignette } = await import("@/moteurs/montage-facecam/effets-chaine");
    const largeur = 27;
    const hauteur = 48;
    const donnees = new Uint8Array(largeur * hauteur * 3).map((_, i) => (i * 37) % 251);
    const r = realismeDeLaVignette({ largeur, hauteur, donnees }, 1080);
    expect(r.environnement?.pixels.length).toBe(64 * 32 * 3);
    expect(r.prise).toMatchObject({ flouPx: expect.any(Number), grain: expect.any(Number) });
    expect(realismeDeLaVignette(null, 1080)).toEqual({});
  });
});
