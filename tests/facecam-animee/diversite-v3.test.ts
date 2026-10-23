/**
 * FACE CAMÉRA ANIMÉE — RÈGLES « v3 » (16/10) : les DÉCISIONS FIXES de Will (V1 à V7) et la diversité (D0, D2, D11 à D15) de
 * `regles-v3.ts`. UN TEST AU MOINS PAR RÈGLE : un cas qui ÉCHOUE (le code de la règle est dans les erreurs) et un cas qui PASSE.
 * On teste le CODE de la règle (« V3a », « V7a »…), pas tout le plan : chaque cas isole une règle. Puis le branchement dans
 * `verifierPlan` (un plan qui viole une décision de Will n'est pas rendable) et le schéma. AUCUN rendu, aucun réseau.
 */
import { describe, expect, it } from "vitest";
import { ficheV3, type FicheCatalogueV3 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v3";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { estRendable, historiqueDuPlan, verifierPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import {
  controlerDiversiteV3, controlerSuiteV3, erreursSousTitresV3, estRendableV3, HAUTEUR_SOUS_TITRES_V3, resoudreElementsV3, SEUILS_V3,
  type ContexteControleV3, type ElementResoluV3,
} from "@/moteurs/montage-facecam-animee/realisateur/regles-v3";
import { bruitagesDuPlan } from "@/moteurs/montage-facecam-animee/realisateur/sons";
import { schemaPlanFacecamAnimee, type ElementV3Plan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { MOTS, planValide } from "./plan-reference";

/** Un élément résolu à partir de l'id du catalogue (durée = le minimum de la fiche + 0,05 s ; inactif accepté : c'est D0 qui le juge). */
function el(id: string, debut: number, o: { fin?: number; mots?: string[]; fiche?: Partial<FicheCatalogueV3> } = {}): ElementResoluV3 {
  const base = ficheV3(id);
  if (!base) throw new Error(`id inconnu : ${id}`);
  const fiche = { ...base, ...(o.fiche ?? {}) } as FicheCatalogueV3;
  return { fiche, debut, fin: o.fin ?? debut + fiche.dureeSec[0] + 0.05, mots: o.mots ?? [], lignes: [], recherches: [], rang: 0 };
}
const ctx = (o: Partial<ContexteControleV3> = {}): ContexteControleV3 => ({ duree: 90, finDebut: 88, ...o });
const erreurs = (els: ElementResoluV3[], c: Partial<ContexteControleV3> = {}, mots?: readonly MotTranscrit[]) => controlerSuiteV3(els, ctx(c), mots).erreurs;
const avec = (liste: string[], code: string) => liste.filter((e) => e.startsWith(`${code} — `));
const echoue = (liste: string[], code: string) => expect(avec(liste, code).length, `attendu « ${code} » dans :\n${liste.join("\n")}`).toBeGreaterThan(0);
const passe = (liste: string[], code: string) => expect(avec(liste, code), liste.join("\n")).toEqual([]);
const suite = (ids: string[], depart = 10, pas = 3) => ids.map((id, k) => el(id, depart + k * pas));

describe("D0 · seuls les éléments ACTIFS du catalogue, à la bonne durée, un à la fois", () => {
  const plan = (elementsV3: ElementV3Plan[]) => resoudreElementsV3(elementsV3, 20).erreurs;
  it("un id inconnu est refusé", () => expect(plan([{ id: "n-existe-pas", debut: 4, fin: 6 }]).join("\n")).toMatch(/^D0 — .*n'existe pas/));
  it("un élément INACTIF (Will ne l'a pas retenu) est refusé, un ACTIF passe", () => {
    expect(plan([{ id: "fenetre-pivot", debut: 4, fin: 6 }]).join("\n")).toMatch(/ÉCARTÉ/);
    expect(plan([{ id: "mot-fenetre", debut: 12, fin: 13.5 }]).join("\n")).toMatch(/ÉCARTÉ/);
    expect(plan([{ id: "fenetre-telephone", debut: 4, fin: 6 }])).toEqual([]);
  });
  it("la durée doit être celle de la fiche, la fin ne dépasse pas la vidéo, deux éléments ne se superposent pas", () => {
    expect(plan([{ id: "fenetre-telephone", debut: 4, fin: 4.5 }]).join("\n")).toMatch(/la fiche prévoit/);
    expect(plan([{ id: "fenetre-telephone", debut: 19, fin: 21 }]).join("\n")).toMatch(/après la fin/);
    expect(plan([{ id: "fenetre-telephone", debut: 4, fin: 6 }, { id: "mot-saute", debut: 5, fin: 6.2 }]).join("\n")).toMatch(/en même temps/);
  });
  it("un plan v3 laisse vides cartes, fenêtres, calques et motions (D0b)", () => {
    echoue(erreurs([el("mot-saute", 5)], { anciens: 2 }), "D0b");
    passe(erreurs([el("mot-saute", 5)], { anciens: 0 }), "D0b");
  });
});

describe("V1 · visage ENTIER ou ENTIÈREMENT couvert ; tolérance : 3 images au plus au passage d'une grande fenêtre", () => {
  it("3 images de visage partiel au passage d'une fenêtre qui couvre : ACCEPTÉ", () => {
    const tel = el("fenetre-telephone", 5, { fiche: { imagesVisagePartiel: 3 } });
    const r = erreurs([tel]);
    passe(r, "V1a");
    passe(r, "V1b");
    passe(r, "V1c");
    expect(estRendableV3(r)).toBe(true);
  });
  it("4 images de visage partiel : REFUSÉ (V1b, bloquant)", () => {
    const r = erreurs([el("fenetre-telephone", 5, { fiche: { imagesVisagePartiel: 4 } })]);
    echoue(r, "V1b");
    expect(estRendableV3(r)).toBe(false);
    echoue(erreurs([el("fenetre-plein-cadre", 12, { fiche: { imagesVisagePartiel: 4 } })]), "V1b");
  });
  it("une emprise qui cache la MOITIÉ du visage à l'état posé est refusée (V1a), entière ou couvrante passent", () => {
    echoue(erreurs([el("fenetre-double", 5, { fiche: { rect: { x0: 0.4, y0: 0.3, x1: 0.95, y1: 0.8 } } })]), "V1a");
    echoue(erreurs([el("cercle-epaule", 5, { fiche: { rect: { x0: 0.3, y0: 0.4, x1: 0.8, y1: 0.8 } } })]), "V1a");
    passe(erreurs([el("fenetre-double", 5), el("cercle-epaule", 9)]), "V1a");
  });
  it("un élément qui laisse le visage entier ne le touche JAMAIS, même 1 image (V1c)", () => {
    echoue(erreurs([el("cercle-epaule", 5, { fiche: { imagesVisagePartiel: 1 } })]), "V1c");
    passe(erreurs([el("cercle-epaule", 5)]), "V1c");
  });
  it("la tolérance est de 3 images (SEUILS_V3) et la carte du haut, dont la prise descend, laisse le visage entier", () => {
    expect(SEUILS_V3.imagesVisagePartielMax).toBe(3);
    passe(erreurs([el("carte-verre", 5)]), "V1a");
  });
});

describe("V2 · aucun zoom ni mouvement de cadrage sur la prise", () => {
  it("une prise qui bouge est refusée (bloquant), une prise fixe passe", () => {
    const r = erreurs([el("mot-saute", 5)], { prisBougee: true });
    expect(avec(r, "V2")).toHaveLength(1);
    expect(estRendableV3(r)).toBe(false);
    passe(erreurs([el("mot-saute", 5)], { prisBougee: false }), "V2");
  });
  it("dans `controlerDiversiteV3`, un zoom ou un mouvement du plan déclenche V2", () => {
    const plan: PlanFacecamAnimee = { ...planValide(), cartes: [], fenetres: [], calques: [], zooms: [[4, 6, 1.2]], elementsV3: [{ id: "mot-saute", debut: 5, fin: 6.2, mots: ["DEVIS"] }] };
    echoue(controlerDiversiteV3(plan).erreurs, "V2");
  });
});

describe("V3 · visage visible au début : rien qui le couvre avant 3 s, aucun coup de poing avant 8 s", () => {
  it("une fenêtre qui couvre le visage avant 3 s est refusée, à 3 s elle passe", () => {
    echoue(erreurs([el("fenetre-telephone", 2.9)]), "V3a");
    echoue(erreurs([el("fenetre-double", 1)]), "V3a");
    passe(erreurs([el("fenetre-telephone", 3)]), "V3a");
  });
  it("un élément qui laisse le visage entier peut entrer avant 3 s", () => {
    passe(erreurs([el("mot-saute", 1.2)]), "V3a");
    passe(erreurs([el("notifications-verre", 0.9)]), "V3a");
  });
  it("un coup de poing avant 8 s est refusé (V3b), à 8 s il passe", () => {
    echoue(erreurs([el("dalle-claquee", 7.9)]), "V3b");
    echoue(erreurs([el("rafale-trois-mots", 5)]), "V3b");
    passe(erreurs([el("dalle-claquee", 8)]), "V3b");
    expect(estRendableV3(erreurs([el("dalle-claquee", 7.9)]))).toBe(false);
  });
});

describe("V4 · aucune musique, que des bruitages de sons/", () => {
  it("un son « musique » ou inconnu est refusé, les bruitages du catalogue passent", () => {
    const musique = { ...ficheV3("mot-saute")!, bruitages: [{ ref: "debut" as const, decalage: 0, son: "musique-fond", volume: 0.1 }] };
    echoue(erreurs([el("mot-saute", 5, { fiche: musique })]), "V4a");
    const inconnu = { ...ficheV3("mot-saute")!, bruitages: [{ ref: "debut" as const, decalage: 0, son: "autre", volume: 0.1 }] };
    echoue(erreurs([el("mot-saute", 5, { fiche: inconnu })]), "V4b");
    const toutes = suite(["mot-saute", "fenetre-telephone", "notifications-verre"]);
    passe(erreurs(toutes), "V4a");
    passe(erreurs(toutes), "V4b");
  });
  it("les bruitages du plan viennent de la fiche, calés sur le début ou la fin, et aucun n'est une musique", () => {
    const plan = { ...planValide(), elementsV3: [{ id: "fenetre-telephone", debut: 4, fin: 6 }] };
    const sons = bruitagesDuPlan(plan);
    for (const attendu of [[4, "maximize_004"], [4.733, "tick_001"], [5.8, "minimize_004"]]) expect(sons.map(([a, son]) => [a, son])).toContainEqual(attendu);
    for (const [, son] of bruitagesDuPlan(plan)) expect(son).not.toMatch(/musi/i);
  });
});

describe("V5 · sous-titres jamais sur les yeux", () => {
  it("chaque élément actif place les sous-titres hors de la bande des yeux (y compris quand la prise descend sous la carte)", () => {
    for (const id of ["mot-saute", "fenetre-telephone", "notifications-verre", "fenetre-double", "cercle-epaule", "bande-video", "carte-verre", "mot-derriere", "dalle-claquee"]) {
      expect(erreursSousTitresV3(ficheV3(id)!), id).toEqual([]);
    }
    expect(HAUTEUR_SOUS_TITRES_V3).toBeCloseTo(0.045 * 1.25, 3);
  });
  it("des sous-titres sur les yeux, hors image, ou sous l'élément qui les cache sont refusés", () => {
    const f = ficheV3("mot-saute")!;
    echoue(erreursSousTitresV3({ ...f, sousTitresY: 0.34 }), "V5a");
    echoue(erreursSousTitresV3({ ...f, sousTitresY: 0.31 }), "V5a");
    echoue(erreursSousTitresV3({ ...f, sousTitresY: 0.98 }), "V5b");
    echoue(erreursSousTitresV3({ ...ficheV3("fenetre-telephone")!, sousTitresY: 0.5 }), "V5c");
    // Sous la carte du haut, la prise descend : les yeux sont à 0,61, des sous-titres à 0,64 les couvriraient.
    echoue(erreursSousTitresV3({ ...ficheV3("carte-verre")!, sousTitresY: 0.64 }), "V5a");
    const r = erreurs([el("mot-saute", 5, { fiche: { sousTitresY: 0.34 } })]);
    echoue(r, "V5a");
    expect(estRendableV3(r)).toBe(false);
  });
  it("des sous-titres masqués (plein écran) ne sont jamais sur les yeux", () => {
    expect(erreursSousTitresV3(ficheV3("duel-video")!)).toEqual([]);
  });
});

describe("V6 · jamais deux fois de suite le même emplacement ni la même famille", () => {
  it("même emplacement deux fois de suite : refusé (V6a), emplacements qui tournent : passe", () => {
    echoue(erreurs(suite(["mot-saute", "mot-derriere"])), "V6a"); // haut, haut
    echoue(erreurs(suite(["fenetre-telephone", "fenetre-double"])), "V6a");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "notifications-verre", "bande-video"])), "V6a");
  });
  it("même famille deux fois de suite : refusé (V6b), familles qui alternent : passe", () => {
    echoue(erreurs(suite(["bande-video", "cercle-epaule"])), "V6b"); // forme-video, forme-video (diagonale, bas)
    echoue(erreurs(suite(["carte-verre", "notifications-verre"])), "V6b"); // carte-verre, carte-verre (haut, bas)
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "notifications-verre", "bande-video"])), "V6b");
  });
  it("le même élément deux fois de suite : refusé (V6c) ; ce sont des erreurs bloquantes", () => {
    const r = erreurs(suite(["mot-saute", "mot-saute"], 5, 3));
    echoue(r, "V6c");
    expect(estRendableV3(r)).toBe(false);
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "mot-saute"], 5, 4)), "V6c");
  });
});

describe("V7 · au plus 1 coup de poing par 20 à 25 s", () => {
  it("deux coups de poing à moins de 20 s : refusé (V7a, bloquant) ; à 20 s : passe", () => {
    const proches = erreurs([el("dalle-claquee", 10), el("eclat-chiffre", 18)]);
    echoue(proches, "V7a");
    expect(estRendableV3(proches)).toBe(false);
    echoue(erreurs([el("dalle-claquee", 10), el("duel-video", 29.9)]), "V7a");
    passe(erreurs([el("dalle-claquee", 10), el("duel-video", 30.1)]), "V7a");
  });
  it("Will seul 1 s après un coup de poing (V7b) ; le dernier loin de l'écran de fin (V7c)", () => {
    echoue(erreurs([el("dalle-claquee", 10), el("fenetre-telephone", 11.3)]), "V7b");
    passe(erreurs([el("dalle-claquee", 10), el("fenetre-telephone", 12.5)]), "V7b");
    echoue(erreurs([el("dalle-claquee", 82)], { finDebut: 88 }), "V7c");
    passe(erreurs([el("dalle-claquee", 40)], { finDebut: 88 }), "V7c");
  });
});

describe("D2 · variété, D11 · cadence, D12 · bruitages, D14 · quotas", () => {
  it("D2 : 5 éléments de suite avec moins de 4 emplacements ou 3 familles différents sont refusés", () => {
    echoue(erreurs(suite(["mot-saute", "fenetre-telephone", "mot-derriere", "fenetre-double", "mot-saute"], 5, 3)), "D2a");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "notifications-verre", "bande-video", "carte-verre"], 5, 3)), "D2a");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "notifications-verre", "bande-video", "carte-verre"], 5, 3)), "D2b");
  });
  it("D11 : trop d'espace entre les éléments, ou des débuts trop serrés", () => {
    echoue(erreurs(suite(["mot-saute", "fenetre-telephone"], 5, 12), { duree: 40, finDebut: 38 }), "D11b");
    echoue(erreurs([el("mot-saute", 5), el("fenetre-telephone", 5.2)]), "D11c");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone", "notifications-verre"], 5, 3), { duree: 14, finDebut: 13 }), "D11a");
    echoue(erreurs([el("mot-saute", 5)], { duree: 40, finDebut: 38 }), "D11a");
  });
  it("D12 : jamais le même bruitage deux fois de suite", () => {
    const a = { ...ficheV3("mot-saute")!, bruitages: [{ ref: "debut" as const, decalage: 0, son: "tick_001", volume: 0.1 }] };
    const b = { ...ficheV3("fenetre-telephone")!, bruitages: [{ ref: "debut" as const, decalage: 0, son: "tick_001", volume: 0.1 }] };
    echoue(erreurs([el("mot-saute", 5, { fiche: a }), el("fenetre-telephone", 9, { fiche: b })]), "D12a");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone"])), "D12a");
  });
  it("D14 : un élément au plus le nombre de fois de sa fiche", () => {
    const trois = ["dalle-claquee", "bande-video", "dalle-claquee"].map((id, k) => el(id, 10 + k * 10));
    echoue(erreurs(trois), "D14");
    passe(erreurs(suite(["mot-saute", "fenetre-telephone"])), "D14");
  });
});

describe("D13 · d'une vidéo à l'autre, D15 · littéralité", () => {
  it("D13 : le premier élément et le premier coup de poing diffèrent de ceux de la vidéo précédente", () => {
    const hist = [{ titre: "Hier", types: [], entrees: [], premierV3: { emplacement: "haut", famille: "typographie" }, premierCoupV3: "dalle-claquee" }];
    const r = erreurs([el("mot-saute", 2), el("dalle-claquee", 12)], { historique: hist });
    echoue(r, "D13a");
    echoue(r, "D13b");
    echoue(r, "D13c");
    passe(erreurs([el("fenetre-telephone", 4), el("duel-video", 12)], { historique: hist }), "D13a");
    passe(erreurs([el("fenetre-telephone", 4), el("duel-video", 12)], { historique: hist }), "D13c");
  });
  it("D15 : chaque élément a ses textes, son « illustre », une recherche de vidéo par vidéo qui reprend un mot de ce qu'il illustre", () => {
    const sans = el("fenetre-telephone", 5);
    const r = erreurs([sans]);
    echoue(r, "D15a");
    echoue(r, "D15f");
    echoue(r, "D15g");
    const bon: ElementResoluV3 = { ...sans, mots: ["Relance"], recherches: ["client qui lit une relance sur son téléphone"], illustre: "relance sur leur téléphone" };
    const ok = erreurs([bon]);
    for (const code of ["D15a", "D15f", "D15g", "D15h"]) passe(ok, code);
    echoue(erreurs([{ ...bon, recherches: ["paysage de montagne au lever du soleil"] }]), "D15h");
  });
  it("D15 : un mot ou un chiffre non dit par Will, et « Villeexemple », sont refusés ; un nombre exigé doit exister et être dit", () => {
    const mots: MotTranscrit[] = [{ w: "relance", a: 4.5, f: 4.9 }, { w: "devis", a: 5.2, f: 5.5 }];
    const base: ElementResoluV3 = { ...el("fenetre-telephone", 5), recherches: ["relance au téléphone"], illustre: "relance" };
    echoue(erreurs([{ ...base, mots: ["Villeexemple"] }]), "D15b");
    echoue(erreurs([{ ...base, mots: ["Facture"] }], {}, mots), "D15e");
    passe(erreurs([{ ...base, mots: ["Relance"] }], {}, mots), "D15e");
    const eclat: ElementResoluV3 = { ...el("eclat-chiffre", 12), illustre: "quarante-cinq minutes" };
    echoue(erreurs([eclat]), "D15c");
    echoue(erreurs([{ ...eclat, nombre: 45 }], {}, mots), "D15d");
    passe(erreurs([{ ...eclat, nombre: 45 }], {}, [{ w: "quarante-cinq", a: 12, f: 12.6 }]), "D15d");
  });
});

describe("branchement : `verifierPlan` applique les règles v3 aux plans qui portent `elementsV3`, et rien aux autres", () => {
  const plan = (elementsV3?: ElementV3Plan[]): PlanFacecamAnimee => ({ ...planValide(), cartes: [], fenetres: [], calques: [], ...(elementsV3 ? { elementsV3 } : {}) });
  it("un plan sans éléments v3 n'est pas concerné", () => {
    expect(controlerDiversiteV3(plan())).toEqual({ erreurs: [], avertissements: [], mesures: null });
    expect(verifierPlan(planValide(), MOTS).erreurs.filter((e) => /^(D0|V\d)/.test(e))).toEqual([]);
  });
  it("une fenêtre qui couvre le visage à 1 s : V3a remonte dans `verifierPlan` et le plan n'est pas rendable", () => {
    const r = verifierPlan(plan([{ id: "fenetre-telephone", debut: 1, fin: 3, mots: ["Relance"], recherches: ["relance au téléphone"], illustre: "relance" }]), MOTS);
    echoue(r.erreurs, "V3a");
    expect(r.rendable).toBe(false);
    expect(estRendable(r.erreurs)).toBe(false);
  });
  it("un élément inactif ou inconnu n'est pas rendable (D0)", () => {
    const r = verifierPlan(plan([{ id: "fenetre-pivot", debut: 4, fin: 6, mots: ["Devis"], illustre: "devis" }]), MOTS);
    echoue(r.erreurs, "D0");
    expect(r.rendable).toBe(false);
  });
  it("un plan v3 n'est pas jugé sur les quotas de bande, de rythme et de mini-vidéos de l'ancien catalogue", () => {
    const r = verifierPlan(plan([{ id: "mot-saute", debut: 5, fin: 6.2, mots: ["DEVIS"], illustre: "devis" }]), MOTS);
    expect(r.erreurs.filter((e) => /^(Bande|Rythme|Seulement \d+ fenêtre|Énergie|Trou de)/.test(e))).toEqual([]);
  });
  it("l'historique garde le premier élément v3 et le premier coup de poing", () => {
    const h = historiqueDuPlan(plan([{ id: "mot-saute", debut: 1.5, fin: 2.7 }, { id: "dalle-claquee", debut: 12, fin: 13.1 }]));
    expect(h.premierV3).toEqual({ emplacement: "haut", famille: "typographie" });
    expect(h.premierCoupV3).toBe("dalle-claquee");
  });
  it("le schéma du plan accepte `elementsV3` (facultatif) et refuse un élément sans id", () => {
    expect(schemaPlanFacecamAnimee.safeParse(plan([{ id: "mot-saute", debut: 5, fin: 6.2 }])).success).toBe(true);
    expect(schemaPlanFacecamAnimee.safeParse(plan([{ debut: 5, fin: 6.2 } as unknown as ElementV3Plan])).success).toBe(false);
    expect(schemaPlanFacecamAnimee.safeParse(planValide()).success).toBe(true);
  });
});
