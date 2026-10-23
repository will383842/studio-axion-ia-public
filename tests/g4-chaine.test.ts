/**
 * Lot G4 · la chaîne (plan v5 B.3.5, critères de la ligne G4) en SIMULATION : aucune clé, aucun appel réel.
 * Aucune prose avant un plan validé ; arrêts propres (preuve et matière manquantes) ; étape 0 gratuite (domaine
 * d'Axion-IA, matière insuffisante) ; reprise sans double paiement ; durées sous le plafond ; « rien d'inventé ».
 */
import { describe, expect, it } from "vitest";
import { controlerVersion, type EntreeControle } from "@/domaine/controles-script";
import { appelPour, contexteEvaluation, executerChaine, miseEnFormePrompteur, miseEnFormeTrame, reparerPlan, type ExecuteurRoles, type SortieExecution } from "@/generateur/chaine";
import { chiffresNonProuves, rendreMatiere } from "@/generateur/contexte";
import { rattacherAuDomaine } from "@/donnees/generateur/domaine-axion";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import { ecritureReseau } from "@/reseaux/ecriture";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { SortiePlan } from "@/generateur/roles/plan";
import type { z } from "zod";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "./helpers/g4";

const OPTS = { tournures: TOURNURES_G4 };

function donnees(n = 0) {
  const z = etapeZeroBanc(SUJETS_BANC[n]);
  if (!z.ok) throw new Error(`étape 0 : ${z.manque.type}`);
  return z.donnees;
}

describe("G4 · étape 0 gratuite : domaine d'Axion-IA et matière", () => {
  it("« comment contester un PV » : hors du domaine d'Axion-IA, arrêt à 0 €, le pilier le plus proche proposé", () => {
    const r = rattacherAuDomaine("Comment contester un PV", { valides: [] });
    expect(r.ok).toBe(false);
    const z = etapeZeroBanc({ ...SUJETS_BANC[0], idee: "Comment contester un PV", pilier: { id: "", nom: "" } });
    expect(z.ok).toBe(false);
    if (!z.ok) {
      expect(z.manque.type).toBe("HORS_DOMAINE");
      expect(z.manque.ceQuIlFaudrait).toMatch(/s'éloigne des activités d'Axion-IA/);
      expect(z.plusProche?.nom).toBeTruthy();
    }
  });

  it("« vos fichiers Excel » : rattaché à « Données et pilotage » ou « Administratif »", () => {
    const r = rattacherAuDomaine("vos fichiers Excel", { valides: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(["automatiser-donnees-pilotage", "automatiser-administratif"]).toContain(r.pilierId);
  });

  it("matière insuffisante : arrêt MATIERE_INSUFFISANTE à 0 €, avant tout appel (C67)", () => {
    const s = { ...SUJETS_BANC[0], matieres: SUJETS_BANC[0].matieres.filter((m) => m.type === "question-recue") };
    const z = etapeZeroBanc(s);
    expect(z.ok).toBe(false);
    if (!z.ok) expect(["MATIERE_INSUFFISANTE", "ANCRAGE_MANQUANT"]).toContain(z.manque.type);
  });

  it("« 99 % » de Will : signalé comme chiffre non prouvé dans la matière envoyée (jamais dit)", () => {
    const d = donnees(1);
    const m = d.matieres.find((x) => x.id === "will-excel-avis")!;
    expect(chiffresNonProuves(m.texte, d.preuves)).toEqual(["99 %"]);
    expect(rendreMatiere(m, d)).toContain('chiffres-non-prouves="99 %"');
    expect(contexteEvaluation(d, parametresGenerateur("avocat")).chiffresNonProuves).toContain("99 %");
  });
});

describe("G4 · la chaîne en simulation", () => {
  it("déroule les étapes 1 à 12 et produit une version par réseau coché, sous le plafond de chaque zone", async () => {
    let n = 0;
    let sous = 0;
    for (const [i, s] of SUJETS_BANC.entries()) {
      const { executeur } = executeurSimule();
      const r = await executerChaine(donnees(i), executeur, OPTS);
      expect(r.statut).toBe("terminee");
      expect(r.etat.versions?.map((v) => v.reseau).sort()).toEqual([...s.reseaux].sort());
      for (const v of r.etat.versions ?? []) {
        n++;
        if (v.dureeSec <= ecritureReseau(v.reseau).zoneDureeSec.valeur[1]) sous++;
      }
    }
    expect(sous / n).toBeGreaterThanOrEqual(0.95);
  });

  it("aucune prose avant un plan validé : un plan refusé par le code arrête la chaîne (PLAN_REFUSE), sans appel à la prose", async () => {
    const mauvais: SortiePlan = { segments: [{ partie: "accroche", fonction: ["cout"], nature: "fait", resume: "x", preuveIds: [], matiereIds: [], ouvre: { id: "q", question: "?" } }, { partie: "corps", fonction: ["solution"], nature: "fait", resume: "a", preuveIds: [], matiereIds: [] }, { partie: "corps", fonction: ["solution"], nature: "fait", resume: "b", preuveIds: [], matiereIds: [], lien: "cause" }, { partie: "corps", fonction: ["solution"], nature: "fait", resume: "c", preuveIds: [], matiereIds: [], lien: "cause" }, { partie: "corps", fonction: ["livraison", "solution"], nature: "fait", resume: "d", preuveIds: [], matiereIds: [], lien: "cause" }, { partie: "corps", fonction: ["resultat"], nature: "fait", resume: "e", preuveIds: [], matiereIds: [], lien: "cause" }], exceptionIndex: -1, ancrageIndex: [0], appuiPrincipalIndex: 1, livraisonIndex: 4 };
    const { executeur, appels } = executeurSimule({ plan: () => mauvais });
    const r = await executerChaine(donnees(0), executeur, OPTS);
    expect(r.statut).toBe("arretee");
    expect(r.etat.arret?.type).toBe("PLAN_REFUSE");
    expect(r.etat.arret?.message).toMatch(/C39/);
    expect(appels.some((a) => a.role === "prose")).toBe(false);
  });

  it("PREUVE_MANQUANTE au fond : arrêt propre, montant conservé, plus aucun appel", async () => {
    const { executeur, appels } = executeurSimule({ fond: () => ({ arret: { code: "PREUVE_MANQUANTE", raison: "« 99 % » sans preuve" }, theme: "", motCle: "", motCleVariante: "", idees: [], appuiPrincipal: {}, issue: "", livraison: "", exception: { source: "aucune", texte: "", place: "apres-livraison" }, envoi: { destinataireRole: "", phrase: "" }, niveauConscience: "connait-le-probleme", criteresPropres: [] }) });
    const r = await executerChaine(donnees(1), executeur, OPTS);
    expect(r.statut).toBe("arretee");
    expect(r.etat.arret).toMatchObject({ type: "PREUVE_MANQUANTE", etape: 2 });
    expect(appels.map((a) => a.role)).toEqual(["stratege", "fond"]);
  });

  it("ANCRAGE_MANQUANT au stratège (piège : aucune matière ne porte le sujet) : arrêt à l'étape 1", async () => {
    const { executeur, appels } = executeurSimule({ stratege: () => ({ arret: { code: "ANCRAGE_MANQUANT", raison: "matière hors sujet" }, angles: [], retenu: 0, raisonChoix: "" }) });
    const r = await executerChaine(donnees(0), executeur, OPTS);
    expect(r.etat.arret).toMatchObject({ type: "ANCRAGE_MANQUANT", etape: 1 });
    expect(appels).toHaveLength(1);
  });

  it("un angle sans problème concret ni coût (§2 bis) n'est jamais retenu ; s'il n'y en a aucun, arrêt", async () => {
    const { executeur } = executeurSimule({
      stratege: (e) => {
        const base = ROLE_STRATEGE.simuler(e) as { angles: { probleme: string; cout: string }[] };
        return { ...base, angles: base.angles.map((a) => ({ ...a, probleme: "L'outil d'IA", cout: "" })) };
      },
    });
    const r = await executerChaine(donnees(0), executeur, { ...OPTS, reprises: false });
    expect(r.etat.arret?.type).toBe("PROBLEME_ABSENT");
  });

  it("reprise après une coupure de crédit : rien n'est rappelé avant l'étape interrompue (pas de double paiement)", async () => {
    let coupe = true;
    const sim = executeurSimule();
    const appels: string[] = [];
    const executeur: ExecuteurRoles = {
      async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
        appels.push(role.id);
        if (role.id === "prose" && coupe) return { ok: false, arret: "en-attente-credit", message: "Crédit Claude insuffisant." };
        return sim.executeur.executer(role, entree);
      },
    };
    let sauve: unknown = null;
    const r1 = await executerChaine(donnees(0), executeur, OPTS, undefined, async (e) => void (sauve = structuredClone(e)));
    expect(r1.statut).toBe("attente");
    expect((sauve as { etape: number }).etape).toBe(6);
    coupe = false;
    appels.length = 0;
    const r2 = await executerChaine(donnees(0), executeur, OPTS, r1.etat);
    expect(r2.statut).toBe("terminee");
    expect(appels[0]).toBe("prose");
    expect(appels).not.toContain("stratege");
    expect(appels).not.toContain("accroches");
    expect(appels).not.toContain("plan");
  });

  it("« je choisis » : pause après les angles, puis après les accroches", async () => {
    const { executeur } = executeurSimule();
    const r1 = await executerChaine(donnees(0), executeur, { ...OPTS, modeChoix: "je-choisis" });
    expect(r1.statut).toBe("pause");
    expect(r1.etat.pause?.raison).toBe("choisir-angle");
    const r2 = await executerChaine(donnees(0), executeur, { ...OPTS, modeChoix: "je-choisis" }, { ...r1.etat, choixWill: { angle: 1 } });
    expect(r2.etat.pause?.raison).toBe("choisir-accroches");
    expect(r2.etat.angleRetenu).toBe(1);
    const ids = r2.etat.accroches!.slice(-2).map((a) => a.id);
    const r3 = await executerChaine(donnees(0), executeur, { ...OPTS, modeChoix: "je-choisis" }, { ...r2.etat, choixWill: { angle: 1, accrocheIds: ids } });
    expect(r3.statut).toBe("terminee");
    expect(r3.etat.finalistes?.map((f) => f.id)).toEqual(ids);
  });

  it("deux corps et le duel PREF-01 lu dans les deux ordres ; seul le gagnant continue", async () => {
    const { executeur, appels } = executeurSimule();
    const r = await executerChaine(donnees(2), executeur, { ...OPTS, deuxCorps: true });
    expect(appels.filter((a) => a.role === "preference")).toHaveLength(2);
    expect(r.etat.preference?.gagnant).toBeDefined();
    expect(r.etat.versions?.length).toBeGreaterThan(0);
  });

  it("appel choisi par le code : objectif × réseau, sinon le défaut du réseau (B.4.4)", () => {
    const p = parametresGenerateur("avocat");
    expect(appelPour(p, "tiktok", "notoriete", [])).toEqual({ type: "envoi", selonObjectif: true });
    expect(appelPour(p, "instagram", "sauvegarde", [])).toEqual({ type: "envoi", selonObjectif: false });
    expect(appelPour(p, "linkedin", "rendez-vous", [])).toEqual({ type: "diagnostic", selonObjectif: true });
  });

  it("mise en forme par le code : téléprompteur (40 caractères, « / » dans les lignes, une prise par phrase) et trame (cases préremplies)", () => {
    const blocs = [{ id: "b", blocRecette: "coeur", segments: [{ id: "s", texte: "Des dizaines de fichiers Excel. Chaque jour, la même routine : exporter, copier, coller, vérifier, et recommencer." }] }];
    const p = miseEnFormePrompteur(blocs);
    const prises = p.split("\n");
    expect(prises).toHaveLength(2);
    for (const l of prises) for (const ligne of l.replace(/^\d+\.\s*/, "").split(" / ")) expect(ligne.length).toBeLessThanOrEqual(40);
    const t = miseEnFormeTrame({ matieres: SUJETS_BANC[1].matieres, exception: { source: "proposition-machine", texte: "x", place: "apres-livraison" } }, blocs, "Accroche.", "Appel.");
    expect(t.reperes.every((r) => r.split(/\s+/).length <= 5)).toBe(true);
    expect(t.casesWill.avis?.texte).toBeTruthy();
    expect(t.verbatim).toEqual({ accroche: "Accroche.", appel: "Appel." });
  });

  it("réparation du plan SANS appel : question fermée par la livraison, ferme inconnu retiré, limite proposée jamais placée", () => {
    const r = reparerPlan({ segments: [{ partie: "accroche", fonction: ["cout"], nature: "fait", resume: "a", preuveIds: [], matiereIds: [], ouvre: { id: "q1", question: "?" } }, { partie: "corps", fonction: ["preuve"], nature: "fait", resume: "b", preuveIds: [], matiereIds: [], ferme: "q9" }, { partie: "corps", fonction: ["livraison"], nature: "fait", resume: "c", preuveIds: [], matiereIds: [], lien: "cause" }], exceptionIndex: -1, ancrageIndex: [0], appuiPrincipalIndex: -1, livraisonIndex: -1 })!;
    expect(r.segments[1].ferme).toBeUndefined();
    expect(r.segments[2].ferme).toBe("q1");
    expect(r.livraisonIndex).toBe(2);
    expect(r.exceptionIndex).toBe(-1);
  });
});

describe("G4 · rien d'inventé, contrôlé par le code", () => {
  const P = parametresGenerateur("avocat");
  function version(texte: string, extra: Partial<EntreeControle> = {}): EntreeControle {
    const d = donnees(1);
    return {
      auteur: "machine",
      mode: "avatar",
      adresse: "vous",
      debit: 4.5,
      ouverture: [{ id: "o", blocRecette: "accroche", segments: [{ id: "a", texte: "Chaque jour, on exporte, on copie, on colle vos fichiers.", marqueurs: ["cout", "mot-cle"] }] }],
      corps: [{ id: "c", blocRecette: "coeur", segments: [{ id: "s1", texte, marqueurs: ["solution"] }] }],
      fin: [],
      recette: P.recette,
      reseau: P.reseau("linkedin"),
      preuves: d.preuves,
      matieres: d.matieres,
      maintenant: d.maintenant,
      maitre: { brief: { idee: "x", objectif: "notoriete", niveauConscience: "connait-le-probleme", reseaux: ["linkedin"], formatId: "avocat", formatsDemandes: ["avocat"], adresseParDefaut: "vous", modeChoix: "rapide", mentionIA: false }, ancrages: [], angle: { titre: "t", promesse: "", structure: "AV.S4", sourceAngle: "matiere", risqueBanal: 0.5, contrePied: false, quiParleConseille: "avatar", probleme: "Une personne recopie ses fichiers chaque jour", cout: "des heures", issue: "un tableau de bord" } },
      tournures: TOURNURES_G4,
      ...extra,
    };
  }

  it("« 99 % » écrit dans le texte : bloqué (C1, nombre sans preuve)", () => {
    const r = controlerVersion(version("Ces fichiers peuvent être remplacés à 99 % par une IA."));
    expect(r.violations.some((v) => v.controle === "C1" && v.bloquant)).toBe(true);
  });

  it("« presque tous » (la formulation prouvable) passe C1", () => {
    const r = controlerVersion(version("Presque tous ces fichiers peuvent être remplacés par une IA."));
    expect(r.violations.some((v) => v.controle === "C1")).toBe(false);
  });

  it("faux témoignage : « un client est venu nous voir » sans preuve cas client réelle → bloquant (C83)", () => {
    const r = controlerVersion(version("Un client est venu nous voir avec ses fichiers, nous lui avons tout supprimé."));
    expect(r.violations.some((v) => v.controle === "C83" && v.bloquant)).toBe(true);
  });

  it("cadrage hypothétique honnête (« Prenons un dirigeant qui… ») : aucun C83", () => {
    const r = controlerVersion(version("Prenons un dirigeant qui recopie ses fichiers : voilà ce qu'on met en place dans ce cas."));
    expect(r.violations.some((v) => v.controle === "C83")).toBe(false);
  });
});

const ROLE_STRATEGE = (await import("@/generateur/roles/stratege")).roleStratege;
