import { describe, expect, it } from "vitest";
import { IDS_PIECES } from "../../src/briques/plan-scenes/catalogue";
import { verifierDefinition } from "../../src/briques/motion/petits-objets/contrat";
import { OBJETS_INSCRITS, REGISTRE_OBJETS, definitionObjet, idsObjets } from "../../src/briques/plan-scenes-objets/registre";

const entrees = Object.entries(REGISTRE_OBJETS);

describe("registre des petits objets (C9-27a)", () => {
  it("identifiants uniques", () => {
    const ids = OBJETS_INSCRITS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(REGISTRE_OBJETS).length).toBe(OBJETS_INSCRITS.length);
  });
  it("la clé est l'id de la définition", () => {
    for (const [cle, d] of entrees) expect(cle).toBe(d.id);
  });
  it("aucune capacité hors objet.*", () => {
    for (const [, d] of entrees) expect(d.capacite.startsWith("objet.")).toBe(true);
  });
  it("au moins une entrée par famille livrée sur master", () => {
    const familles = new Set(entrees.map(([, d]) => d.famille));
    for (const f of ["trait", "marque", "etiquette", "chiffre", "schema", "ecran"]) expect(familles.has(f as never)).toBe(true);
  });
  it("gelé", () => {
    expect(Object.isFrozen(REGISTRE_OBJETS)).toBe(true);
  });
  it("definitionObjet et idsObjets", () => {
    expect(definitionObjet("objet-coche")?.id).toBe("objet-coche");
    expect(definitionObjet("objet-inconnu")).toBeUndefined();
    expect(definitionObjet("constructor" as never)).toBeUndefined();
    const ids = idsObjets();
    expect(ids).toEqual([...ids].sort());
    expect(ids.length).toBe(entrees.length);
  });
});

describe("registre des petits objets (C9-27b)", () => {
  const IDS_NEUFS = [
    "objet-anneau-donnees", "objet-compteur-rouleau", "objet-chrono", "objet-barre-progression", "objet-dossier",
    "objet-appel-action", "objet-appel-mot", "objet-carton-magazine", "objet-post-it", "objet-pastille-icone",
    "objet-etiquette-icone", "objet-badge", "objet-tampon", "objet-cadre-rectangle", "objet-cadre-coins",
    "objet-cadre-passage", "objet-cercle", "objet-ovale", "objet-double-boucle",
  ];
  it("C9-27b : les 53 définitions livrées sont inscrites", () => {
    expect(IDS_NEUFS.length).toBe(19);
    for (const id of IDS_NEUFS) expect(definitionObjet(id)?.id).toBe(id);
    expect(OBJETS_INSCRITS.length).toBeGreaterThanOrEqual(53);
  });
  it("aucun IdPiece en double", () => {
    const pieces = new Set<string>(IDS_PIECES);
    // 17/11/2026 BR-OBJETS-a (C9-34b) : les 4 objets inscrits au plan de scènes sont les seuls à figurer des deux côtés, volontairement.
    // 19/11/2026 N-05-v19b : la liste suit la réalité (elle était restée à 4 alors que 13 objets étaient inscrits depuis #1277 et #1292, test rouge sur master) : 4 + 6 + 3 + 5 = 18.
    const inscritsAuPlan = [
      "objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche",
      "objet-soulignement-droit", "objet-croix", "objet-mot-barre", "objet-compteur-rouleau", "objet-carton-definition", "objet-fleche-main-levee",
      "objet-croquis", "objet-feutre-entourage", "objet-feutre-soulignement",
      "objet-carton-magazine", "objet-tourne", "objet-particules", "objet-panneau-reglages", "objet-anneau-donnees",
    ];
    for (const id of idsObjets()) expect(pieces.has(id), id).toBe(inscritsAuPlan.includes(id));
  });
  it("chaque définition inscrite passe verifierDefinition", () => {
    for (const d of OBJETS_INSCRITS) expect(verifierDefinition(d), d.id).toBe("ok");
  });
});
