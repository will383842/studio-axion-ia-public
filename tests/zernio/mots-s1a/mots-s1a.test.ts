/** Lot S1a — logique PURE « un mot = un guide ». Valeurs fictives. Aucun changement de comportement par défaut. */
import { describe, expect, it } from "vitest";
import { normaliserMot } from "@/domaine/guide-reseau/mot-normalise";
import { affectationPour, detecterCollision, PLAFOND_JOUR_REPLI, type Affectation } from "@/domaine/guide-reseau/affectations";
import { empreinteGuideParcours } from "@/domaine/guide-reseau/empreinte-guide";
import { transition } from "@/domaine/guide-reseau/machine-conversation";
import { lireEnveloppe, lireEvenementCommentaire, motSeulDe, runValide, MOTS_DECLENCHEURS_CONNUS } from "@/domaine/guide-reseau/crochet-zernio";

/** Valeur calculée AVANT la modification d'empreinte-guide.ts (titre fictif). */
const EMPREINTE_FIGEE_GUIDE = "46c05e93c20cf919cf8440fd0c91ecb3bf3fffcb94522ff9f41c9b510d04cc82";
const TITRE = "Guide d'exemple";

describe("empreinte : (GUIDE, titre) identique à aujourd'hui", () => {
  it("valeur figée, mot par défaut ou explicite", () => {
    expect(empreinteGuideParcours(TITRE)).toEqual({ ok: true, empreinte: EMPREINTE_FIGEE_GUIDE });
    expect(empreinteGuideParcours(TITRE, "GUIDE")).toEqual({ ok: true, empreinte: EMPREINTE_FIGEE_GUIDE });
  });
  it("un autre mot change l'empreinte (le mot figure dans M1)", () => {
    const r = empreinteGuideParcours(TITRE, "IA");
    expect(r.ok && r.empreinte).not.toBe(EMPREINTE_FIGEE_GUIDE);
  });
});

describe("normaliserMot", () => {
  it.each([["guide"], ["Guidé"], ["  GUIDE ! "], ["GUIDE😀"]])("%s → GUIDE", (t) => expect(normaliserMot(t)).toBe("GUIDE"));
  it.each([["0612345678"], ["stop"], ["Arrêtez"], ["arret"], ["guide ia"], [""], ["   "], ["A"], ["x".repeat(21)]])("%j → null", (t) => expect(normaliserMot(t)).toBeNull());
  it.each([["IA"], ["Ia"], ["ia"]])("%s → IA", (t) => expect(normaliserMot(t)).toBe("IA"));
  it("accepte lettres+chiffres, refuse non-texte", () => {
    expect(normaliserMot("ia2026")).toBe("IA2026");
    expect(normaliserMot(null as never)).toBeNull();
  });
});

describe("affectationPour", () => {
  it("données vides ou absentes → repli GUIDE / guide-ia / titre fourni", () => {
    for (const d of [undefined, null, []]) {
      const a = affectationPour("GUIDE", "compte-fictif-1", d as never, "Titre fictif");
      expect(a).toMatchObject({ mot: "GUIDE", compte: "compte-fictif-1", guide: "guide-ia", titre: "Titre fictif" });
    }
  });
  it("le plafond du repli est fini et survit à la sérialisation JSON (jamais null)", () => {
    expect(Number.isFinite(PLAFOND_JOUR_REPLI)).toBe(true);
    const a = affectationPour("GUIDE", "compte-fictif-1", [], "T")!;
    expect(a.plafondJour).toBe(PLAFOND_JOUR_REPLI);
    expect(JSON.parse(JSON.stringify(a)).plafondJour).toBe(PLAFOND_JOUR_REPLI);
  });
  it("la comparaison normalise aussi le mot de la donnée (« Ia » et « Guidé » retrouvés)", () => {
    const d: Affectation[] = [{ mot: "Ia", compte: "c1", guide: "g", titre: "T", plafondJour: 5 }];
    expect(affectationPour("IA", "c1", d, "T")).toEqual(d[0]);
    expect(affectationPour("ia !", "c1", d, "T")).toEqual(d[0]);
  });
  it("données vides : un autre mot n'a pas d'affectation", () => {
    expect(affectationPour("IA", "compte-fictif-1", [], "Titre fictif")).toBeNull();
  });
  it("données fournies : utilisées telles quelles, sans repli", () => {
    const d: Affectation[] = [{ mot: "IA", compte: "compte-fictif-1", guide: "guide-fictif", titre: "T", plafondJour: 5 }];
    expect(affectationPour("IA", "compte-fictif-1", d, "Titre fictif")).toEqual(d[0]);
    expect(affectationPour("GUIDE", "compte-fictif-1", d, "Titre fictif")).toBeNull();
    expect(affectationPour("IA", "autre-compte", d, "Titre fictif")).toBeNull();
  });
});

describe("detecterCollision", () => {
  it("deux saisies de même forme normalisée = collision", () => {
    expect(detecterCollision(["Guide", "GUIDÉ", "IA"])).toEqual(["GUIDE"]);
    expect(detecterCollision(["guide", "ia"])).toEqual([]);
  });
  it("une même saisie répétée n'est pas une collision ; deux saisies distinctes de même forme le sont", () => {
    expect(detecterCollision(["GUIDE", "GUIDE"])).toEqual([]);
    expect(detecterCollision(["GUIDE", "guide"])).toEqual(["GUIDE"]);
  });
});

describe("machine : mots actifs en paramètre", () => {
  const com = (motSeul: string) => ({ t: "commentaire" as const, idCommentaire: "c1", proprio: false, idAuteur: "a1", idCompte: "cpt", motSeul, estReponse: false, ageMs: 1000, maintenantMs: 0 });
  it("défaut : GUIDE démarre, inconnu écarté", () => {
    expect(transition(null, com("guide")).action).toBe("demarrer");
    expect(transition(null, com("IA"))).toMatchObject({ action: "ecarter", raison: "mot" });
  });
  it("liste étendue : IA démarre ; inconnu toujours écarté", () => {
    expect(transition(null, com("ia"), ["GUIDE", "IA"]).action).toBe("demarrer");
    expect(transition(null, com("AUTRE"), ["GUIDE", "IA"])).toMatchObject({ action: "ecarter", raison: "mot" });
  });
  it("stop en réponse à un commentaire = opposition, même avec plusieurs mots actifs", () => {
    expect(transition(null, { ...com("stop"), estReponse: true }, ["GUIDE", "IA"]).action).toBe("opposer");
  });
});

describe("crochet : mots connus en paramètre", () => {
  it("défaut = valeurs actuelles", () => {
    expect(MOTS_DECLENCHEURS_CONNUS).toEqual(["GUIDE"]);
    expect(motSeulDe("guide")).toBe("guide");
    expect(motSeulDe("ia")).toBeNull();
    expect(motSeulDe("stop")).toBe("stop");
  });
  it("même jugement que normaliserMot : accents et ponctuation de bord ignorés, résultat identique pour « Guidé » et « GUIDE ! »", () => {
    expect(motSeulDe("Guidé")).toBe("Guidé");
    expect(motSeulDe("GUIDE !")).toBe("GUIDE !");
    expect(motSeulDe("GUIDE😀")).toBe("GUIDE😀");
    for (const t of ["Guidé", "GUIDE !", "guide", "GUIDE", " guide "]) expect(motSeulDe(t) !== null).toBe(normaliserMot(t) === "GUIDE");
    expect(motSeulDe("guide ia")).toBeNull();
    expect(motSeulDe(" guide ")).toBe("guide");
  });
  it("commentaire : « Guidé » et « GUIDE ! » donnent le même motSeul normalisé (GUIDE) ; stop reste prioritaire", () => {
    const corps = (text: string) => lireEnveloppe(JSON.stringify({ id: "e1", event: "comment.received", timestamp: 1_800_000_000, account: { accountId: "cpt", platform: "facebook" }, comment: { id: "c1", text, author: { id: "a1" } } }))!;
    expect(lireEvenementCommentaire(corps("Guidé"))?.motSeul).toBe("GUIDE");
    expect(lireEvenementCommentaire(corps("GUIDE !"))?.motSeul).toBe("GUIDE");
    expect(lireEvenementCommentaire(corps(" guide "))?.motSeul).toBe("GUIDE");
    expect(lireEvenementCommentaire(corps("Stop"), ["STOP", "GUIDE"])?.motSeul).toBe("STOP");
  });
  it("liste étendue : IA gardé, texte hors liste jamais gardé, stop prioritaire", () => {
    const l = ["GUIDE", "IA"];
    expect(motSeulDe("ia", l)).toBe("ia");
    expect(motSeulDe("bonjour", l)).toBeNull();
    expect(motSeulDe("0612345678", l)).toBeNull();
    expect(motSeulDe("stop", l)).toBe("stop");
  });
  it("commentaire lu avec liste étendue", () => {
    const corps = (text: string) => lireEnveloppe(JSON.stringify({ id: "e1", event: "comment.received", timestamp: 1_800_000_000, account: { accountId: "cpt", platform: "facebook" }, comment: { id: "c1", text, author: { id: "a1" } } }))!;
    expect(lireEvenementCommentaire(corps("ia"))?.motSeul).toBeNull();
    expect(lireEvenementCommentaire(corps("ia"), ["GUIDE", "IA"])?.motSeul).toBe("IA");
    expect(lireEvenementCommentaire(corps("stop"), ["GUIDE", "IA"])?.motSeul).toBe("STOP");
  });
  it("runValide : défaut inchangé, liste appliquée si fournie", () => {
    const run = { email: "p@example.test", mot: "IA", reseau: "facebook", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
    expect(runValide(run)).toBe(true);
    expect(runValide(run, ["GUIDE"])).toBe(false);
    expect(runValide(run, ["GUIDE", "IA"])).toBe(true);
  });
});
