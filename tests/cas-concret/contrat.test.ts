/**
 * M9b : le moteur `montage-cas-concret` passe le contrat commun des moteurs (`testerMoteurVideo`, montants réels), sur la
 * VRAIE chaîne (`fabriquerCasConcret`) branchée sur des doubles (aucun appel réel) ; il est inscrit au registre.
 */
import { describe, expect, it } from "vitest";
import { listerFormats, trouverFormat } from "@/formats";
import { codeDuFormat } from "@/formats/registre-codes";
import { obtenirMoteur } from "@/moteurs";
import { moteurExiste } from "@/moteurs/ids";
import { moteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { testerMoteurVideo } from "@/moteurs/contrat";
import { banc } from "./moteur/doubles";

const b = banc();

testerMoteurVideo(b.moteur, async () => b.commande());

describe("M9b · inscription", () => {
  it("le registre rend ce moteur ; le format le désigne", () => {
    expect(moteurExiste("montage-cas-concret")).toBe(true);
    expect(obtenirMoteur("montage-cas-concret")).toBe(moteurMontageCasConcret);
    expect(trouverFormat("cas-concret")?.moteur).toBe("montage-cas-concret");
  });

  it("le format est actif (Will, 17/10) : trouvé par son identifiant et présent dans la liste", () => {
    expect(trouverFormat("cas-concret")?.statut).toBe("actif");
    expect(listerFormats().map((f) => f.id)).toContain("cas-concret");
    expect(listerFormats({ inclureMasques: true }).map((f) => f.id)).toContain("cas-concret");
  });

  it("le code « CC » est réservé au format", () => {
    expect(codeDuFormat("cas-concret")).toBe("CC");
  });
});
