/**
 * Blocs « pastille » posés sous une branche sans flèche dessinée : la carte les range déjà dans la branche, le code
 * déduit le lien depuis le bloc précédent de la MÊME branche (marqué « déduit »), et seulement si c'est sans ambiguïté.
 * Sinon le blocage reste, avec une phrase qui dit quoi faire. Jamais de chiffre ni de phrase inventés.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completerCarte, controlerCarte, reparerOrphelinsDeBranche, type CarteImage } from "@/domaine/image-video/carte";
import { ErreurDecisionIV, etatInitialIV, validerCarteIV } from "@/moteurs/montage-image-video/fabrication";
import { demandeEssai } from "./doubles-fabrication";

const base: CarteImage = JSON.parse(readFileSync(join(__dirname, "fixtures", "cartes", "C.json"), "utf8"));
const noeud = (id: string, libelle: string, ordre: number, groupe?: string) => ({ id, libelle, role: "etape" as const, couleur: "noir" as const, acteur: "auto" as const, ordre, ...(groupe ? { groupe } : {}) });
const lien = (id: string, de: string, vers: string) => ({ id, de, vers, couleur: "noir" as const, style: "plein" as const });

/** 20 e-mails → IA → deux branches ; les pastilles n05 et n06 n'ont aucune flèche. */
function embranchement(): CarteImage {
  return completerCarte({
    ...base,
    noeuds: [
      noeud("n01", "20 e-mails", 1), noeud("n02", "L'IA classe et répond", 2),
      noeud("n03", "80 % répondus automatiquement", 3, "g1"), noeud("n04", "20 % pour vous", 4, "g2"),
      noeud("n05", "Réponse en 2 minutes", 5, "g1"), noeud("n06", "Ceux qui comptent vraiment", 6, "g2"),
    ],
    liens: [lien("l1", "n01", "n02"), lien("l2", "n02", "n03"), lien("l3", "n02", "n04")],
    groupes: [{ id: "g1", sorte: "branche", noeuds: ["n03", "n05"], majoritaire: true }, { id: "g2", sorte: "branche", noeuds: ["n04", "n06"] }],
    bandeau: [], pied: [], formulesAbsolues: [],
  });
}

describe("réparation des blocs orphelins d'une branche", () => {
  it("relie n03→n05 et n04→n06, liens marqués déduits, plus de défaut bloquant", () => {
    const carte = embranchement();
    expect(controlerCarte(carte).ok).toBe(false);
    const { carte: r, deduits } = reparerOrphelinsDeBranche(carte);
    expect(deduits.map((l) => [l.de, l.vers, l.deduit])).toEqual([["n03", "n05", true], ["n04", "n06", true]]);
    expect(controlerCarte(r).ok).toBe(true);
    expect(controlerCarte(r).alertes.some((a) => a.includes("n05") && a.includes("à vérifier"))).toBe(true);
  });
  it("ne crée ni chiffre ni texte : liens sans étiquette ni part, inventaire de chiffres identique", () => {
    const carte = embranchement();
    const { carte: r, deduits } = reparerOrphelinsDeBranche(carte);
    for (const l of deduits) expect(l.etiquette ?? l.part).toBeUndefined();
    expect(completerCarte(r).chiffres).toEqual(carte.chiffres);
  });
  it("une carte sans orphelin est rendue telle quelle", () => {
    expect(reparerOrphelinsDeBranche(base)).toEqual({ carte: base, deduits: [] });
  });
  it("orphelin hors branche : rien n'est déduit, blocage gardé", () => {
    const carte = embranchement();
    carte.noeuds.push(noeud("n09", "Bloc perdu", 9));
    const { carte: r, deduits } = reparerOrphelinsDeBranche(carte);
    expect(deduits.map((l) => l.vers)).not.toContain("n09");
    expect(controlerCarte(r).erreurs).toContain("Le bloc n09 n'est relié à rien.");
  });
  it("ordre ambigu (deux blocs de même ordre avant lui) : rien n'est déduit", () => {
    const carte = embranchement();
    carte.noeuds.push(noeud("n07", "A", 3, "g1"), noeud("n08", "B", 3, "g1"));
    carte.groupes[0] = { ...carte.groupes[0]!, noeuds: ["n03", "n07", "n08", "n05"] };
    const { carte: r } = reparerOrphelinsDeBranche(carte);
    expect(r.liens.filter((l) => l.vers === "n05")).toEqual([]);
  });
  it("blocs qui se suivent dans la branche : la chaîne se relie dans l'ordre", () => {
    const carte = embranchement();
    carte.noeuds.push(noeud("n07", "Suite", 7, "g1"));
    carte.groupes[0] = { ...carte.groupes[0]!, noeuds: ["n03", "n05", "n07"] };
    const { carte: r } = reparerOrphelinsDeBranche(carte);
    expect(r.liens.filter((l) => l.deduit).map((l) => `${l.de}>${l.vers}`).sort()).toEqual(["n03>n05", "n04>n06", "n05>n07"]);
  });
});

describe("garde-fous de la réparation", () => {
  it("double passage : idempotent", () => {
    const une = reparerOrphelinsDeBranche(embranchement());
    const deux = reparerOrphelinsDeBranche(une.carte);
    expect(deux.deduits).toEqual([]);
    expect(deux.carte).toEqual(une.carte);
  });
  it("carte de type bénéfices : inchangée", () => {
    const carte = { ...embranchement(), types: ["benefices"] as CarteImage["types"] };
    expect(reparerOrphelinsDeBranche(carte)).toEqual({ carte, deduits: [] });
  });
  it("un lien déduit ne satisfait pas seul « embranchement : deux chemins »", () => {
    const carte = { ...embranchement(), types: ["embranchement"] as CarteImage["types"] };
    carte.noeuds = carte.noeuds.filter((n) => n.id !== "n04" && n.id !== "n06");
    carte.liens = carte.liens.filter((l) => l.vers !== "n04");
    carte.groupes = [carte.groupes[0]!];
    carte.noeuds.push(noeud("n07", "Pastille", 7, "g1"));
    carte.groupes[0] = { ...carte.groupes[0]!, noeuds: ["n03", "n05", "n07"] };
    const { carte: r } = reparerOrphelinsDeBranche(carte);
    // n03 a un seul chemin dessiné + un déduit : l'embranchement reste refusé.
    expect(r.liens.some((l) => l.deduit && l.de === "n03")).toBe(true);
    expect(controlerCarte(r).erreurs).toContain("Un embranchement demande un bloc d'où partent au moins deux chemins.");
  });
  it("un bloc photo de personnes n'est jamais prédécesseur", () => {
    const carte = embranchement();
    carte.noeuds = carte.noeuds.map((n) => (n.id === "n03" ? { ...n, photoPersonnes: true } : n));
    expect(reparerOrphelinsDeBranche(carte).deduits.map((l) => l.vers)).not.toContain("n05");
  });
});

describe("validation de la carte corrigée avec orphelins", () => {
  async function arret() {
    const e = etatInitialIV(demandeEssai(base));
    e.etape = "carte-a-valider";
    e.propositionCarte = { carte: base, controle: controlerCarte(base), doutes: [], empreinte: "prop-1" };
    return { e };
  }
  it("n05 et n06 orphelins en branche : la validation passe, liens déduits gardés et signalés", async () => {
    const { e } = await arret();
    const carte = embranchement();
    const apres = validerCarteIV(e, { proposition: "prop-1", carte, le: "2026-10-25T08:00:00.000Z" });
    const l = apres.carte!.carte.liens.filter((x) => x.deduit);
    expect(l.map((x) => `${x.de}>${x.vers}`)).toEqual(["n03>n05", "n04>n06"]);
    expect(controlerCarte(apres.carte!.carte).alertes.filter((a) => a.includes("déduit"))).toHaveLength(2);
  });
  it("orphelin hors branche : refus, avec la conduite à tenir", async () => {
    const { e } = await arret();
    const carte = embranchement();
    carte.noeuds.push(noeud("n09", "Bloc perdu", 9));
    try {
      validerCarteIV(e, { proposition: "prop-1", carte, le: "x" });
      throw new Error("aurait dû refuser");
    } catch (err) {
      expect(err).toBeInstanceOf(ErreurDecisionIV);
      expect((err as ErreurDecisionIV).phrases.join(" ")).toMatch(/n09 n'est relié à rien.*relancez/i);
    }
  });
});
