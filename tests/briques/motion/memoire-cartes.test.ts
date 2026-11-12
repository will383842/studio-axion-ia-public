/**
 * GV-MD-02 — mémoire des cartes animées déjà servies : une carte utilisée récemment n'est pas reprise tant qu'une autre
 * convient ; un seul modèle possible est gardé ; sans mémoire, le choix est celui d'avant.
 */
import { describe, expect, it } from "vitest";
import { candidatsModele, choisirModele, choisirMoinsRecent } from "@/briques/motion/choix";
import { CATALOGUE_ACTIF_BASE, cartesPourFormat, type PhraseMotion } from "@/briques/motion/pourFormat";

// Deux modèles conviennent : une liste annoncée (« Trois erreurs … : A, B et C ») et un chiffre (« 45 minutes »).
const DEUX_MODELES = "Trois erreurs coûtent 45 minutes par jour : la TVA, l'URSSAF et la CFE.";
// Un seul modèle convient : une liste.
const UN_SEUL = "Il existe trois contrats : le CDI, le CDD et l'intérim.";

describe("choisirModele avec la mémoire des cartes déjà servies", () => {
  it("les deux modèles conviennent, dans l'ordre de priorité d'avant", () => {
    expect(candidatsModele(DEUX_MODELES).map((c) => c.modele)).toEqual(["liste", "chiffre"]);
  });

  it("sans mémoire (absente ou vide), le résultat est celui d'avant", () => {
    expect(choisirModele(DEUX_MODELES)?.modele).toBe("liste");
    expect(choisirModele(DEUX_MODELES, {})).toEqual(choisirModele(DEUX_MODELES));
    expect(choisirModele(DEUX_MODELES, { dejaServis: [] })).toEqual(choisirModele(DEUX_MODELES));
  });

  it("le premier modèle a servi hier : le second est choisi", () => {
    expect(choisirModele(DEUX_MODELES, { dejaServis: ["liste"] })?.modele).toBe("chiffre");
  });

  it("les deux ont servi : celui qui a servi le moins récemment passe", () => {
    expect(choisirModele(DEUX_MODELES, { dejaServis: ["chiffre", "liste"] })?.modele).toBe("liste");
    expect(choisirModele(DEUX_MODELES, { dejaServis: ["liste", "chiffre"] })?.modele).toBe("chiffre");
  });

  it("une mémoire sans rapport ne change rien", () => {
    expect(choisirModele(DEUX_MODELES, { dejaServis: ["graphique"] })?.modele).toBe("liste");
  });

  it("un seul modèle possible : il est gardé, même s'il a servi hier", () => {
    expect(candidatsModele(UN_SEUL).map((c) => c.modele)).toEqual(["liste"]);
    expect(choisirModele(UN_SEUL, { dejaServis: ["liste"] })?.modele).toBe("liste");
  });

  it("rien ne convient : rien, avec ou sans mémoire", () => {
    expect(choisirModele("Bonjour à tous.", { dejaServis: ["liste"] })).toBeNull();
  });
});

describe("choisirMoinsRecent", () => {
  const c = (modele: string) => ({ modele });
  it("jamais servi passe avant servi ; à égalité, le premier", () => {
    expect(choisirMoinsRecent([c("a"), c("b")], ["a"])?.modele).toBe("b");
    expect(choisirMoinsRecent([c("a"), c("b")], [])?.modele).toBe("a");
    expect(choisirMoinsRecent([], ["a"])).toBeNull();
  });
  it("un interdit est évité si un autre convient, sinon gardé", () => {
    expect(choisirMoinsRecent([c("a"), c("b")], [], ["a"])?.modele).toBe("b");
    expect(choisirMoinsRecent([c("a")], [], ["a"])?.modele).toBe("a");
  });
});

describe("cartesPourFormat avec la mémoire", () => {
  const phrases: PhraseMotion[] = [{ id: "p1", texte: DEUX_MODELES, debutSec: 2, finSec: 7 }];
  const modeles = (extra: { dejaServis?: string[]; ouverturePrecedente?: string }) => cartesPourFormat({ format: "facecam", ratio: "9:16", phrases, catalogue: CATALOGUE_ACTIF_BASE, ...extra }).map((x) => x.modele);

  it("sans mémoire : comme avant", () => {
    expect(modeles({})).toEqual(["liste"]);
  });

  it("le modèle servi hier n'est pas repris quand un autre convient", () => {
    expect(modeles({ dejaServis: ["liste"] })).toEqual(["chiffre"]);
  });

  it("la première carte n'est pas le modèle qui a ouvert la vidéo précédente", () => {
    expect(modeles({ ouverturePrecedente: "liste" })).toEqual(["chiffre"]);
    expect(modeles({ ouverturePrecedente: "chiffre" })).toEqual(["liste"]);
  });

  it("un seul modèle possible : gardé malgré la mémoire et l'ouverture", () => {
    const seule: PhraseMotion[] = [{ id: "p1", texte: UN_SEUL, debutSec: 2, finSec: 7 }];
    const r = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases: seule, catalogue: CATALOGUE_ACTIF_BASE, dejaServis: ["liste"], ouverturePrecedente: "liste" });
    expect(r.map((x) => x.modele)).toEqual(["liste"]);
  });

  it("deux fois la même phrase dans la vidéo : la seconde change de carte", () => {
    const deux: PhraseMotion[] = [
      { id: "p1", texte: DEUX_MODELES, debutSec: 2, finSec: 7 },
      { id: "p2", texte: DEUX_MODELES, debutSec: 20, finSec: 25 },
    ];
    const r = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases: deux, catalogue: CATALOGUE_ACTIF_BASE, dejaServis: ["autre"] });
    expect(r.map((x) => x.modele)).toEqual(["liste", "chiffre"]);
  });
});
