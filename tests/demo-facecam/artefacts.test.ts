/** G3-01 — artefacts de la reprise : aller-retour sans perte, ancienne reprise inchangée, données mal formées ignorées. */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { artefactsDemo, lireArtefactsDemo } from "@/moteurs/montage-demo-facecam/artefacts";
import { etatDemoInitial, etatPourRetoucheDemo, lireRepriseDemo, type EtatDemo, type RepriseDemo } from "@/moteurs/montage-demo-facecam/chaine";
import { lireEntreesDemo } from "@/moteurs/montage-demo-facecam/entrees";

const commande = { videoId: "v1", ratios: ["4:5"], prononciations: [], styles: { sousTitres: { valeur: "pop" } }, sousTitres: { base: "x", intensite: "fort" }, entrees: { demoFacecam: { consignes: [{ type: "clic", ms: 500, x: 10, y: 20 }, { type: "legende", debutMs: 0, finMs: 900, texte: "Ici" }] } } } as unknown as CommandeFabrication;
const plan = { scenes: [] } as unknown as NonNullable<EtatDemo["plan"]>;
const etat = (): EtatDemo => ({ ...etatDemoInitial(), plan, travaux: { "transcrire-ecran": { id: "t", essais: 1, statut: "termine", resultat: { mots: [{ mot: "a", debutSec: 0, finSec: 1 }] } } as never } });

describe("artefacts de la démo facecam", () => {
  it("aller-retour sans perte", () => {
    const a = artefactsDemo(etat(), lireEntreesDemo(commande), commande);
    expect(a.motsEcran).toHaveLength(1);
    expect(a.pistes?.clics).toEqual([{ ms: 500, x: 10, y: 20 }]);
    expect(a.pistes?.legendes).toHaveLength(1);
    expect(a.styleSousTitres?.style).toBe("pop");
    expect(lireArtefactsDemo(JSON.parse(JSON.stringify(a)))).toEqual(a);
  });
  it("données mal formées : ignorées, jamais d'exception", () => {
    for (const x of [null, undefined, 3, "x", [], { motsEcran: 4, pistes: "z", styleSousTitres: [] }, { motsEcran: [null, { mot: 1 }], pistes: { zooms: [null, 2], clics: 5 } }])
      expect(() => lireArtefactsDemo(x)).not.toThrow();
    expect(lireArtefactsDemo({ motsEcran: 4, pistes: "z", styleSousTitres: [] })).toEqual({});
  });
  it("reprise ancienne sans artefacts : même lecture, même état de retouche", () => {
    const reprise: RepriseDemo = { mots: [], calage: "aucun", dureeSec: 1, synchro: { mode: "aucune", decalageSec: 0 }, plan: plan as never, sorties: {}, signatureConsignes: "s" };
    const lue = lireRepriseDemo({ reprise });
    expect(lue).toBe(reprise);
    expect(lireArtefactsDemo(lue)).toEqual({});
    const sans = JSON.stringify(etatPourRetoucheDemo(reprise, commande));
    expect(JSON.stringify(etatPourRetoucheDemo({ ...reprise, ...lireArtefactsDemo(reprise) }, commande))).toBe(sans);
  });
});
