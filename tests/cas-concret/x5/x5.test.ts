/**
 * X5 · Une seule offre « Intégration » : automatisation et intégration sont la même chose (décision de Will, 12/10).
 * Offres `formation`, `audit`, `integration`, `coaching` ; nature en clair sur la carte ; recette réunie ; cadeau choisi
 * par la nature ; recette `coaching` minimale, fabriquée en simulation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";
import { casCoaching } from "./cas-coaching";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Le cas « coaching » d'essai rejoint le catalogue pour la seule simulation.
vi.mock("@/formats/cas-concret/catalogue", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/formats/cas-concret/catalogue")>();
  const { casCoaching: coaching } = await import("./cas-coaching");
  return { ...vrai, trouverCas: (id: string) => (id === coaching.id ? coaching : vrai.trouverCas(id)) };
});

const { OFFRES, NATURES_EN_CLAIR, verifierCas } = await import("@/formats/cas-concret/cas");
const { CATALOGUE } = await import("@/formats/cas-concret/catalogue");
const { CATALOGUE_TS } = await import("@/formats/cas-concret/catalogue/base");
const { finsParReseau } = await import("@/formats/cas-concret");
const { recettePour } = await import("@/formats/cas-concret/recette");
const { TABLE_FINS_DIAGNOSTIC } = await import("@/briques/fins");
const { planDesFins } = await import("@/moteurs/montage-cas-concret/fins");
const { cadeauDuCas, problemesDuCas } = await import("@/moteurs/montage-cas-concret/regles");
const { variableEcriture } = await import("@/moteurs/montage-cas-concret/ecriture");
const { pastillesOffres, versVueCas, motsCommuns } = await import("@/components/formats/cas-concret/entree/vue");
const { CarteCas } = await import("@/components/formats/cas-concret/entree/CarteCas");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";

/** V4-3 : ces essais exercent l'écriture de Claude comme avant (aucun script validé, aucun arrêt « à valider ») ; les deux ont leurs tests (`tests/cas-concret/script-valide/`). */
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const casDe = (id: string) => CATALOGUE.find((c) => c.id === id)!;

describe("X5 · les offres", () => {
  it("formation, audit, intégration, coaching : le code « automatisation » n'est plus une offre", () => {
    expect([...OFFRES]).toEqual(["formation", "audit", "integration", "coaching"]);
    expect(CATALOGUE.filter((c) => (c.offre as string) === "automatisation")).toEqual([]);
    expect(verifierCas({ ...casDe("recrutement-apporteurs"), offre: "automatisation" }).ok).toBe(false);
  });

  it("les cas d'automatisation passent à l'intégration, sous le même identifiant, avec leur nature", () => {
    expect(["recrutement-apporteurs", "rappels-rendez-vous"].map((id) => [casDe(id).offre, casDe(id).nature])).toEqual([
      ["integration", "automatisation"],
      ["integration", "automatisation"],
    ]);
    expect(["contact-vers-crm", "devis-signe-alerte"].map((id) => [casDe(id).offre, casDe(id).nature])).toEqual([
      ["integration", "outils-relies"],
      ["integration", "outils-relies"],
    ]);
    for (const c of CATALOGUE) expect(verifierCas(c).ok).toBe(true);
  });

  it("seule une intégration porte une nature", () => {
    const r = verifierCas({ ...casDe("email-difficile"), nature: "automatisation" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raisons).toEqual(["nature : seule une intégration porte une nature"]);
  });
});

describe("X5 · les pastilles et les cartes", () => {
  const vues = CATALOGUE_TS.map((c) => versVueCas(c, "e", true));

  it("Tous, Formation, Audit, Intégration ; « Coaching » seulement quand un cas validé le porte", () => {
    expect(pastillesOffres(vues).map((p) => p.libelle)).toEqual(["Tous", "Formation", "Audit", "Intégration"]);
    const avecCoaching = [...vues, versVueCas(casCoaching, "e", true)];
    expect(pastillesOffres(avecCoaching).map((p) => p.libelle)).toEqual(["Tous", "Formation", "Audit", "Intégration", "Coaching"]);
    expect(pastillesOffres([...vues, versVueCas(casCoaching, "e", false)]).map((p) => p.libelle)).not.toContain("Coaching");
  });

  it("la carte dit « Intégration » et la nature en clair", () => {
    const recrutement = versVueCas(casDe("recrutement-apporteurs"), "e", true);
    const crm = versVueCas(casDe("contact-vers-crm"), "e", true);
    expect([recrutement.offreLibelle, recrutement.nature]).toEqual(["Intégration", "Automatisation"]);
    expect([crm.offreLibelle, crm.nature]).toEqual(["Intégration", "Outils reliés"]);
    expect(versVueCas(casDe("audit-une-journee"), "e", true).nature).toBeUndefined();
    expect(NATURES_EN_CLAIR).toEqual({ automatisation: "Automatisation", "outils-relies": "Outils reliés" });
    const html = renderToStaticMarkup(createElement(CarteCas, { cas: recrutement, onOuvrir: () => undefined }));
    expect(html).toContain("Intégration");
    expect(html).toContain("Automatisation");
  });

  it("la nature ne compte pas dans le classement", () => {
    const crm = versVueCas(casDe("contact-vers-crm"), "e", true);
    expect(motsCommuns("reliés", { ...crm, etapes: [] })).toBe(0);
  });
});

describe("X5 · la recette d'écriture", () => {
  const consigneEtapes = (c: Parameters<typeof recettePour>[0]) => recettePour(c).find((x) => x.id === "etapes")?.consigne ?? "";

  it("une seule recette « integration », la tournure choisie d'après les étapes du cas", () => {
    expect(consigneEtapes(casDe("recrutement-apporteurs"))).toMatch(/tournent seules/);
    expect(consigneEtapes(casDe("rappels-rendez-vous"))).toMatch(/tournent seules/);
    expect(consigneEtapes(casDe("contact-vers-crm"))).toMatch(/outils reliés/);
    expect(consigneEtapes(casDe("devis-signe-alerte"))).toMatch(/outils reliés/);
    expect(consigneEtapes(casDe("audit-une-journee"))).toBe("");
    const variable = variableEcriture(casDe("contact-vers-crm"), recettePour(casDe("contact-vers-crm")));
    expect(variable).toContain(consigneEtapes(casDe("contact-vers-crm")));
  });

  it("le mot « automatisation » reste dit, jamais « machine »", () => {
    expect(consigneEtapes(casDe("recrutement-apporteurs"))).toContain("automatisation");
    for (const c of [...CATALOGUE, casCoaching]) for (const bloc of recettePour(c)) expect(`${bloc.nom} ${bloc.consigne ?? ""}`).not.toMatch(/machine/i);
  });

  it("coaching : douleur du dirigeant, déroulé de l'accompagnement, résultat", () => {
    const blocs = recettePour(casCoaching);
    expect(blocs.map((x) => x.id)).toEqual(["accroche", "avant", "bascule", "etapes", "reste-humain", "resultat", "question"]);
    expect(blocs.map((x) => x.nom)).toEqual(expect.arrayContaining(["La douleur du dirigeant", "Le déroulé de l'accompagnement", "Le résultat"]));
  });
});

describe("X5 · les fins (X6 : une seule demande, le mot là où il est branché)", () => {
  const ids = (c: { offre: (typeof OFFRES)[number]; nature?: "automatisation" | "outils-relies" }, motSur: ("facebook" | "instagram")[] = ["facebook"]) => finsParReseau(c.offre, motSur, c.nature).facebook;

  it("le cadeau de l'offre suit toujours la nature ; la fin au mot ne dépend plus de lui", () => {
    expect(ids(casDe("recrutement-apporteurs"))).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(ids(casDe("contact-vers-crm"))).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(ids(casDe("contact-vers-crm"), [])).toEqual(["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);
    expect(cadeauDuCas(casDe("rappels-rendez-vous"))).toBe("fin-if-cadeau-automatisation");
    expect(cadeauDuCas(casDe("devis-signe-alerte"))).toBe("fin-if-cadeau-integration");
    for (const c of CATALOGUE) expect(problemesDuCas(c)).toEqual([]);
  });

  it("aucune phrase validée n'est modifiée", () => {
    const ligne = (id: string) => TABLE_FINS_DIAGNOSTIC.find((l) => l.id === id)!;
    expect([ligne("fin-if-cadeau-automatisation").dit, ligne("fin-if-cadeau-automatisation").validee]).toEqual(["On vous envoie toute la structure de cette automatisation.", true]);
    expect(ligne("fin-if-cadeau-integration").validee).toBe(false);
  });

  it("le plan des fins, mot branché sur Facebook : la fin au mot pour les deux natures", () => {
    const base = { reseaux: ["facebook"] as const, mot: "IA", avecMot: true, motSur: ["facebook"] as const, table: TABLE_FINS_DIAGNOSTIC };
    for (const nature of ["automatisation", "outils-relies"] as const) {
      const plan = planDesFins({ ...base, reseaux: [...base.reseaux], motSur: [...base.motSur], offre: "integration", nature });
      expect(plan.fins[0].appels.map((a) => a.id), nature).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
      expect(plan.reduites).toEqual([]);
    }
  });

  it("coaching : le cadeau est le déroulé de l'accompagnement, la fin dit le mot là où il est branché", () => {
    expect(ids(casCoaching)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(cadeauDuCas(casCoaching)).toBe("fin-if-cadeau-coaching");
    expect(problemesDuCas(casCoaching)).toEqual([]);
    const plan = planDesFins({ reseaux: ["facebook", "tiktok"], offre: "coaching", mot: "COACH", avecMot: true, motSur: ["facebook"], table: TABLE_FINS_DIAGNOSTIC });
    expect(plan.reduites).toEqual([]);
    expect(planDesFins({ reseaux: ["facebook"], offre: "coaching", mot: "COACH", avecMot: false, table: TABLE_FINS_DIAGNOSTIC }).reduites).toEqual([]);
  });
});


/* ------------------------------------------------------------------ */
/* Coaching : la recette minimale, fabriquée en simulation               */
/* ------------------------------------------------------------------ */

function commande(casId: string, mot: string, avecMot: boolean, reseaux: string[]): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-05",
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-will", fournisseurVoix: "simulation", voixId: "voix-will" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "A", mot, avecMot, reseaux, essai: false, codeSuivi: `cc-${casId}-abc123` } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

async function fabriquer(avecMot: boolean, reseaux: string[]) {
  reinitialiserDepots();
  let t = 0;
  const dep = { rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true }, attendre: async () => {} };
  const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
  const c = commande(casCoaching.id, casCoaching.mot, avecMot, reseaux);
  let travail: Travail = await moteur.lancer(c, { travailId: "tr-x5", versionId: "ver-x5", titre: "Essai" } as never);
  let resultat: { projetMontage: { casConcret: { fins: { dureeSec: number }[] } } } | undefined;
  for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
    const r = await moteur.avancer(travail, c);
    travail = r.travail;
    if (r.resultat) resultat = r.resultat as unknown as typeof resultat;
  }
  return { statut: travail.statut, erreur: travail.erreur?.messagePourWill, durees: resultat?.projetMontage.casConcret.fins.map((f) => f.dureeSec) ?? [] };
}

describe("X5 · coaching en simulation", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("Aucun appel réseau dans ces tests.");
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("le cas d'essai se fabrique, avec et sans le mot, de 35 à 65 s", async () => {
    for (const avecMot of [true, false]) {
      const issue = await fabriquer(avecMot, ["facebook", "instagram", "tiktok", "linkedin"]);
      expect({ statut: issue.statut, erreur: issue.erreur }).toEqual({ statut: "termine", erreur: undefined });
      expect(issue.durees.length).toBeGreaterThan(0);
      // V4-2 : la visée de l'écriture passe à 40–47 s, estimée sur la voix réelle (20,5 caractères par seconde) ; la
      // voix SIMULÉE lit environ 16 % plus vite (sorties vers 36 à 41 s) : le plancher contrôlé ici est la borne de refus
      // de R21 (35 s), et non plus la visée.
      expect(Math.min(...issue.durees)).toBeGreaterThanOrEqual(35);
      expect(Math.max(...issue.durees)).toBeLessThanOrEqual(65);
    }
  }, 120_000);
});
