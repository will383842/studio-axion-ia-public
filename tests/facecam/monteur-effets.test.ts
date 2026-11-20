/**
 * T-MONTEUR-EFFETS-v20d · tests directs des effets spéciaux du monteur face caméra
 * (schémas, reconnaissance, application avec garde-fous, résumé). Entrées construites à la main.
 */
import { describe, expect, it } from "vitest";
import type { PassageFacecam } from "@/domaine/facecam";
import {
  appliquerEffetSpecial,
  estEffetSpecial,
  idEffet,
  objetDemande,
  operationEffetParRegles,
  passageEffetSpecial,
  resumeEffetSpecial,
  schemaObjetMain,
  schemaTransitionEcran,
  schemaVitreBrisee,
  type ContexteEffet,
  type OperationEffetSpecial,
} from "@/moteurs/montage-facecam/monteur/effets";

function ctx(passages: PassageFacecam[] = [], surcharge: Partial<ContexteEffet> = {}): ContexteEffet {
  return {
    origine: "demande",
    passages,
    debutDe: (i) => i,
    finDe: (i) => i + 1,
    versMontee: (s) => s,
    dureePriseSec: 60,
    nouvelId: (p) => `${p}-1`,
    ...surcharge,
  };
}

const vitre = (auMot: number, extra: Record<string, unknown> = {}): OperationEffetSpecial =>
  ({ type: "vitreBrisee", auMot, dureeSec: 1, revele: "plan-suivant", texteCarte: null, bruitage: true, ...extra }) as OperationEffetSpecial;

const passageFort = (debutSec: number, finSec: number, type: string): PassageFacecam =>
  ({ id: `p-${type}-${debutSec}`, type: "autre", debutSec, finSec, texte: "x", origine: "demande", operation: { type } }) as unknown as PassageFacecam;

describe("schémas des effets spéciaux", () => {
  it("objetMain : entrée valide acceptée, objet inconnu refusé", () => {
    const ok = { type: "objetMain", debutMot: 3, finMot: 5, objet: "cube", description: "un cube" };
    expect(schemaObjetMain.safeParse(ok).success).toBe(true);
    expect(schemaObjetMain.safeParse({ ...ok, objet: "dragon" }).success).toBe(false);
  });
  it("vitreBrisee : valide acceptée, 'revele' inconnu refusé", () => {
    const ok = { type: "vitreBrisee", auMot: 2, dureeSec: null, revele: "carte", texteCarte: "Salut", bruitage: false };
    expect(schemaVitreBrisee.safeParse(ok).success).toBe(true);
    expect(schemaVitreBrisee.safeParse({ ...ok, revele: "rien" }).success).toBe(false);
  });
  it("transitionEcran : valide acceptée, mot non entier refusé", () => {
    const ok = { type: "transitionEcran", auMot: 4, style: "ecran-plie", dureeSec: 1 };
    expect(schemaTransitionEcran.safeParse(ok).success).toBe(true);
    expect(schemaTransitionEcran.safeParse({ ...ok, auMot: 1.5 }).success).toBe(false);
  });
});

describe("estEffetSpecial / idEffet / passageEffetSpecial", () => {
  it("reconnaît les 3 types et rejette les autres", () => {
    expect(estEffetSpecial({ type: "objetMain" })).toBe(true);
    expect(estEffetSpecial({ type: "vitreBrisee" })).toBe(true);
    expect(estEffetSpecial({ type: "transitionEcran" })).toBe(true);
    expect(estEffetSpecial({ type: "zoom" })).toBe(false);
  });
  it("idEffet donne l'effet de la brique commune", () => {
    expect(idEffet({ type: "objetMain", debutMot: 0, finMot: 1, objet: "cube", description: "" })).toBe("objet-main");
    expect(idEffet(vitre(0))).toBe("vitre-brisee");
    expect(idEffet({ type: "transitionEcran", auMot: 0, style: "zoom-traversant", dureeSec: null })).toBe("zoom-traversant");
    expect(idEffet({ type: "transitionEcran", auMot: 0, style: "ecran-plie", dureeSec: null })).toBe("ecran-plie");
  });
  it("passageEffetSpecial rend l'opération ou null", () => {
    const op = vitre(1);
    expect(passageEffetSpecial({ id: "a", type: "autre", debutSec: 0, finSec: 1, operation: op } as unknown as PassageFacecam)).toEqual(op);
    expect(passageEffetSpecial({ id: "b", type: "autre", debutSec: 0, finSec: 1, operation: { type: "zoom" } } as unknown as PassageFacecam)).toBeNull();
    expect(passageEffetSpecial({ id: "c", type: "autre", debutSec: 0, finSec: 1 } as unknown as PassageFacecam)).toBeNull();
  });
});

describe("objetDemande / operationEffetParRegles", () => {
  it("objetDemande : mots-clés puis logo Axion par défaut", () => {
    expect(objetDemande("un téléphone")).toBe("telephone");
    expect(objetDemande("une étoile")).toBe("etoile");
    expect(objetDemande("un cube")).toBe("cube");
    expect(objetDemande("quelque chose")).toBe("logo-axion");
  });
  it("« fais apparaître un téléphone dans ma main » → objetMain téléphone", () => {
    const op = operationEffetParRegles("fais apparaître un téléphone dans ma main", 3, 7);
    expect(op).toMatchObject({ type: "objetMain", debutMot: 3, finMot: 7, objet: "telephone" });
  });
  it("phrase sans effet → null", () => {
    expect(operationEffetParRegles("coupe les silences au début", 0, 4)).toBeNull();
  });
  it("« zoom à travers l'écran » → transition zoom-traversant", () => {
    expect(operationEffetParRegles("fais un zoom à travers l'écran", 5, 6)).toEqual({ type: "transitionEcran", auMot: 5, style: "zoom-traversant", dureeSec: null });
  });
  it("« l'écran se plie » → transition ecran-plie", () => {
    expect(operationEffetParRegles("l'écran se plie ici", 2, 3)).toMatchObject({ type: "transitionEcran", style: "ecran-plie", auMot: 2 });
  });
  it("vitre brisée avec carte citée et sans bruitage", () => {
    const op = operationEffetParRegles("brise l'écran comme une vitre et révèle une carte « Bienvenue » sans bruit", 1, 2);
    expect(op).toMatchObject({ type: "vitreBrisee", revele: "carte", texteCarte: "Bienvenue", bruitage: false });
  });
  it("vitre brisée simple → plan suivant avec bruitage", () => {
    expect(operationEffetParRegles("une vitre qui se brise", 1, 2)).toMatchObject({ type: "vitreBrisee", revele: "plan-suivant", texteCarte: null, bruitage: true });
  });
});

describe("resumeEffetSpecial", () => {
  it("phrases françaises non vides pour chaque effet", () => {
    expect(resumeEffetSpecial({ type: "objetMain", debutMot: 0, finMot: 1, objet: "logo-axion", description: "" })).toBe("Logo Axion en 3D dans votre main");
    expect(resumeEffetSpecial({ type: "objetMain", debutMot: 0, finMot: 1, objet: "coeur", description: "" })).toBe("Cœur en 3D dans votre main");
    expect(resumeEffetSpecial(vitre(0))).toBe("Vitre qui se brise");
    expect(resumeEffetSpecial(vitre(0, { revele: "carte", texteCarte: "Hop" }))).toBe("Vitre qui se brise sur « Hop »");
    expect(resumeEffetSpecial({ type: "transitionEcran", auMot: 0, style: "ecran-plie", dureeSec: null })).toBe("Écran qui se plie");
    expect(resumeEffetSpecial({ type: "transitionEcran", auMot: 0, style: "zoom-traversant", dureeSec: null })).toBe("Zoom à travers l'écran");
  });
});

describe("appliquerEffetSpecial", () => {
  it("ajoute un passage, sans modifier l'entrée", () => {
    const op = vitre(10);
    const copie = JSON.parse(JSON.stringify(op));
    const passages: PassageFacecam[] = [];
    const r = appliquerEffetSpecial(op, ctx(passages));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.passage).toMatchObject({ id: "pas-1", type: "autre", debutSec: 10, finSec: 11, origine: "demande", texte: "Vitre qui se brise" });
      expect(r.passage.ancre).toEqual({ debutPriseSec: 10, finPriseSec: 11 });
      expect(r.alertes).toEqual([]);
    }
    expect(op).toEqual(copie);
    expect(passages).toEqual([]);
  });
  it("refuse sans demande de Will", () => {
    const r = appliquerEffetSpecial(vitre(1), ctx([], { origine: "auto" as ContexteEffet["origine"] }));
    expect(r.ok).toBe(false);
    expect(r.alertes[0]).toContain("si vous le demandez");
  });
  it("durée hors bornes ramenée à 1,5 s avec alerte", () => {
    const r = appliquerEffetSpecial(vitre(10, { dureeSec: 5 }), ctx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.passage.finSec - r.passage.debutSec).toBeCloseTo(1.5, 5);
      expect(r.alertes.length).toBe(1);
    }
  });
  it("carte sans texte : repli sur le plan suivant avec alerte", () => {
    const r = appliquerEffetSpecial(vitre(10, { revele: "carte", texteCarte: "  " }), ctx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.operation).toMatchObject({ revele: "plan-suivant", texteCarte: null });
      expect(r.alertes[0]).toContain("Pas de texte pour la carte");
    }
  });
  it("objetMain : fenêtre d'au moins 4 s", () => {
    const r = appliquerEffetSpecial({ type: "objetMain", debutMot: 5, finMot: 5, objet: "cube", description: "" }, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.passage.finSec - r.passage.debutSec).toBeCloseTo(4, 5);
  });
  it("objetMain refusé si un autre effet fort est au même moment", () => {
    const r = appliquerEffetSpecial({ type: "objetMain", debutMot: 5, finMot: 5, objet: "cube", description: "" }, ctx([passageFort(6, 8, "arretImage")]));
    expect(r.ok).toBe(false);
    expect(r.alertes[0]).toContain("un seul à la fois");
  });
  it("transition refusée si trop proche d'une autre (< 4 s)", () => {
    const r = appliquerEffetSpecial(vitre(12), ctx([passageFort(10, 11, "vitreBrisee")]));
    expect(r.ok).toBe(false);
    expect(r.alertes[0]).toContain("4 s d'écart");
  });
  it("transition refusée au-delà de 3 transitions par vidéo", () => {
    const trois = [passageFort(0, 1, "vitreBrisee"), passageFort(10, 11, "transitionEcran"), passageFort(20, 21, "vitreBrisee")];
    const r = appliquerEffetSpecial(vitre(40), ctx(trois));
    expect(r.ok).toBe(false);
    expect(r.alertes[0]).toContain("3 transitions");
  });
  it("transition décalée juste après un autre effet fort proche", () => {
    const r = appliquerEffetSpecial(vitre(10), ctx([passageFort(9.5, 10.5, "arretImage")]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.passage.debutSec).toBeCloseTo(10.7, 3);
      expect(r.alertes.some((a) => a.includes("décalé"))).toBe(true);
    }
  });
});
