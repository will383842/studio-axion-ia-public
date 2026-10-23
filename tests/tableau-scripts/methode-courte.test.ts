/**
 * Méthode courte du tableau (plan socle qualité § 5.4), derrière le réglage `tableau.methode`, « complete » par défaut.
 * Client SIMULÉ (aucun réseau, `fetch` interdit) : la méthode complète envoie exactement les mêmes requêtes que sans
 * réglage ; la courte : effort moyen, plafonds 8 k / 20 k / 8 k, recette (règles + témoin) en cache 1 h partagée par les
 * passes, relance seulement sur un défaut éliminatoire de FORME, pire cas recalculé. Le témoin reste au vert.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { RequeteClaude, ReponseClaude } from "@/fournisseurs/claude/client";
import { corpsRequete } from "@/fournisseurs/claude/client";
import { CRITERES_GRILLE, type AngleScript, type EcritureScript, type RelectureScript } from "@/domaine/scripts-tableau";
import { aDesEliminatoires, controlerEcriture } from "@/domaine/scripts-tableau-controles";
import { construireRequete } from "@/generateur/roles/types";
import { DEMANDE_MODELE, ecritureModele } from "./modele-valide";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/tableau-scripts");
const { CONTRE_EXEMPLES, MAX_TOKENS, MAX_TOKENS_COURTE, REGLES_TABLEAU, SCRIPT_TEMOIN, methodeLue, requeteAngle, requeteEcriture, requeteRelecture } = await import("@/services/tableau-scripts/consignes");
const { roleDeRequete } = await import("@/services/tableau-scripts/client-studio");

const MDP = "tableau-methode-courte";
const JETONS = { entree: 1000, cacheLu: 0, cacheEcrit: 2000, sortie: 3000 };
const SOCLE = { contexteAxion: "charte", styleWill: "style", preuves: "preuves", gagnants: "ton" };

const ANGLE: AngleScript = {
  angle: "Que peut-on coller dans l'IA ?",
  douleur: "Des données de clients collées sans y penser.",
  accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "Ce devis collé dans ChatGPT contient trois données de trop.", ecran: "Trois données de trop", pourquoi: "Vécu." })),
  retenue: 0,
  raison: "Elle se comprend sans le son.",
};

function relecture(e: EcritureScript): RelectureScript {
  return { corrections: [], grille: CRITERES_GRILLE.map((c) => ({ critere: c.id, respecte: true, remarque: "" })), faiblesses: [], affirmations: e.affirmations, manques: [] };
}

/** Défaut de FORME (relance) : l'accroche salue. */
function ecritureForme(): EcritureScript {
  const e = ecritureModele();
  e.script.accroche[0].dit = "Bonjour à tous, ce devis collé dans ChatGPT contient trois données de trop.";
  return e;
}

/** Défaut de FOND seulement (relecture) : une formule creuse dans une phrase concrète. */
function ecritureFond(): EcritureScript {
  const e = ecritureModele();
  e.script.etapes[0].comment[0].dit = "L'état du dossier, tout simplement.";
  return e;
}

function clientSimule(sorties: unknown[]) {
  const requetes: RequeteClaude[] = [];
  return {
    requetes,
    client: {
      simule: true,
      async appeler(r: RequeteClaude): Promise<ReponseClaude> {
        requetes.push(r);
        const s = sorties.shift();
        if (s === undefined) throw new Error("Appel de trop.");
        return { texte: JSON.stringify(s), modeleDemande: r.modele, modele: "claude-opus-5-5", replis: [], stopReason: "end_turn", jetons: { ...JETONS } };
      },
    },
  };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit dans les tests");
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const points = (r: RequeteClaude) => r.systeme.map((b) => b.cache ?? null);

describe("réglage", () => {
  it("« courte » par défaut (réglage absent ou illisible) ; « complete » seulement si elle est réglée exactement", () => {
    expect(methodeLue(undefined)).toBe("courte");
    expect(methodeLue("Complete")).toBe("courte");
    expect(methodeLue(1)).toBe("courte");
    expect(methodeLue("courte")).toBe("courte");
    expect(methodeLue("complete")).toBe("complete");
  });
});

describe("méthode complète : strictement identique à avant", () => {
  it("sans réglage c'est la courte (lot A5) ; « complete » reste l'ancienne méthode (effort élevé, 6 k / 28 k / 28 k, mêmes blocs)", () => {
    const e = ecritureModele();
    expect(requeteAngle(DEMANDE_MODELE, "courte")).toEqual(requeteAngle(DEMANDE_MODELE));
    expect(requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "courte")).toEqual(requeteEcriture(DEMANDE_MODELE, ANGLE));
    expect(requeteRelecture(DEMANDE_MODELE, ANGLE, e, "courte")).toEqual(requeteRelecture(DEMANDE_MODELE, ANGLE, e));
    const [a, ec, re] = [requeteAngle(DEMANDE_MODELE, "complete"), requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "complete"), requeteRelecture(DEMANDE_MODELE, ANGLE, e, "complete")];
    expect([a, ec, re].map((r) => [r.effort, r.maxTokens])).toEqual([["high", MAX_TOKENS.angle], ["high", MAX_TOKENS.ecriture], ["high", MAX_TOKENS.relecture]]);
    expect([a, ec, re].map(points)).toEqual([[true, null], [true, true, null], [true, true, null]]);
    expect(re.messages[0].contenu).not.toContain("<defauts_a_corriger>");
  });

  it("aucun point de cache sur la recette : deux points, socle 1 h et consigne 5 min, comme avant", () => {
    for (const [passe, r] of [["angle", requeteAngle(DEMANDE_MODELE, "complete")], ["ecriture", requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "complete")]] as const) {
      const { role, entree } = roleDeRequete(r, passe, SOCLE);
      expect(role.cacheRecette, passe).toBeUndefined();
      expect(points(construireRequete(role, entree)).filter(Boolean), passe).toEqual(["1h", true]);
    }
  });

  it("le déroulé « complete » envoie quatre requêtes, et relance sur n'importe quel défaut éliminatoire", async () => {
    const a = clientSimule([ANGLE, ecritureFond(), ecritureModele(), relecture(ecritureModele())]);
    const b = clientSimule([ANGLE, ecritureFond(), ecritureModele(), relecture(ecritureModele())]);
    const ra = await service.deroulerScriptTableau(DEMANDE_MODELE, { client: a.client, methode: "complete" });
    reinitialiserDepots(); // sinon le métier du premier script livré serait « récent » pour le second
    const rb = await service.deroulerScriptTableau(DEMANDE_MODELE, { client: b.client, methode: "complete" });
    expect(ra.ok && rb.ok).toBe(true);
    expect(a.requetes).toHaveLength(4);
    expect(b.requetes).toEqual(a.requetes);
  });
});

describe("méthode courte", () => {
  it("effort moyen ; angle 8 k, écriture et relance 20 k, relecture 8 k ; même modèle (Opus)", () => {
    const e = ecritureModele();
    const rs = [requeteAngle(DEMANDE_MODELE, "courte"), requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "courte"), requeteEcriture(DEMANDE_MODELE, ANGLE, { defauts: [], precedente: e }, {}, "courte"), requeteRelecture(DEMANDE_MODELE, ANGLE, e, "courte")];
    expect(rs.map((r) => [r.effort, r.maxTokens])).toEqual([["medium", 8_000], ["medium", 20_000], ["medium", 20_000], ["medium", 8_000]]);
    expect(MAX_TOKENS_COURTE).toEqual({ angle: 8_000, ecriture: 20_000, relecture: 8_000 });
    expect(rs.every((r) => r.modele === "claude-opus-5-5")).toBe(true);
  });

  it("recette (règles + témoin + contre-exemple) identique pour toutes les passes, en cache 1 h : trois points, sous la limite de 4", () => {
    const e = ecritureModele();
    const passes = [
      ["angle", requeteAngle(DEMANDE_MODELE, "courte")],
      ["ecriture", requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, "courte")],
      ["relance", requeteEcriture(DEMANDE_MODELE, ANGLE, { defauts: [], precedente: e }, {}, "courte")],
      ["relecture", requeteRelecture(DEMANDE_MODELE, ANGLE, e, "courte")],
    ] as const;
    const recettes = passes.map(([passe, r]) => {
      const { role, entree } = roleDeRequete(r, passe, SOCLE);
      expect(role.cacheRecette, passe).toBe(true);
      const q = construireRequete(role, entree);
      expect(points(q).filter(Boolean), passe).toEqual(["1h", "1h", true]);
      expect(() => corpsRequete(q), passe).not.toThrow();
      const bloc = q.systeme.find((b) => b.texte.startsWith("<recette_format>"))!;
      expect(bloc.cache, passe).toBe("1h");
      return bloc.texte;
    });
    expect(new Set(recettes).size).toBe(1);
    for (const t of [REGLES_TABLEAU, SCRIPT_TEMOIN, CONTRE_EXEMPLES]) expect(recettes[0]).toContain(t);
    // Sans socle (illisible) : la recette porte seule le point 1 h.
    const { role, entree } = roleDeRequete(passes[0][1], "angle");
    expect(points(construireRequete(role, entree)).filter(Boolean)).toEqual(["1h", true]);
  });

  it("défaut de FORME : une relance (medium, 20 k), puis livre", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureForme(), ecritureModele(), relecture(ecritureModele())]);
    const r = await service.deroulerScriptTableau(DEMANDE_MODELE, { client, methode: "courte" });
    expect(r.ok).toBe(true);
    expect(requetes).toHaveLength(4);
    expect([requetes[2].effort, requetes[2].maxTokens]).toEqual(["medium", 20_000]);
    expect(requetes[2].messages[0].contenu).toMatch(/L'accroche salue/);
    expect(requetes[3].messages[0].contenu).not.toContain("<defauts_a_corriger>");
  });

  it("défaut de FOND seulement : pas de relance ; la relecture reçoit les défauts à corriger", async () => {
    const fond = controlerEcriture(ecritureFond(), DEMANDE_MODELE).filter((x) => x.eliminatoire);
    expect(fond.map((x) => x.code)).toEqual(["formule-creuse"]);
    expect(service.aDesEliminatoiresDeForme(fond)).toBe(false);
    const { client, requetes } = clientSimule([ANGLE, ecritureFond(), relecture(ecritureFond())]);
    const r = await service.deroulerScriptTableau(DEMANDE_MODELE, { client, methode: "courte" });
    expect(requetes).toHaveLength(3);
    expect(requetes.map((q) => [q.effort, q.maxTokens])).toEqual([["medium", 8_000], ["medium", 20_000], ["medium", 8_000]]);
    expect(requetes[2].messages[0].contenu).toMatch(/<defauts_a_corriger>[\s\S]*tout simplement/);
    // Non corrigé par la relecture : refusé comme avant, la version écrite gardée.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motifs.join(" ")).toMatch(/tout simplement/);
  });

  it("sans défaut : trois appels, aucune relance", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureModele(), relecture(ecritureModele())]);
    const r = await service.deroulerScriptTableau(DEMANDE_MODELE, { client, methode: "courte" });
    expect(r.ok).toBe(true);
    expect(requetes).toHaveLength(3);
  });

  it("deuxième défaut de forme après la relance : refus, sans relecture", async () => {
    const { client, requetes } = clientSimule([ANGLE, ecritureForme(), ecritureForme()]);
    const r = await service.deroulerScriptTableau(DEMANDE_MODELE, { client, methode: "courte" });
    expect(r.ok).toBe(false);
    expect(requetes).toHaveLength(3);
  });
});

describe("pire cas", () => {
  const jetonsSocle = 7_500;
  const complete = service.estimerCoutScript(DEMANDE_MODELE, undefined, jetonsSocle, "complete");
  const courte = service.estimerCoutScript(DEMANDE_MODELE, undefined, jetonsSocle, "courte");

  it("courte : relance comprise, recette au prix 1 h, bien sous la complète", () => {
    expect(courte.appels.map((a) => a.passe)).toEqual(["angle", "ecriture", "relance", "relecture"]);
    // Sortie au pire : 8 + 20 + 20 + 8 = 56 k jetons à 20 $ le million, soit 1,12 $, plus les entrées (socle compris).
    expect(courte.pireCasUsd).toBeGreaterThan(1.12);
    expect(courte.pireCasUsd).toBeLessThan(1.7);
    expect(courte.pireCasUsd).toBeLessThan(complete.pireCasUsd * 0.75);
    // Le chiffre du plan (≈ 0,9 $) : les trois passes sans relance, socle compté à part.
    const nu = service.estimerCoutScript(DEMANDE_MODELE, undefined, 0, "courte");
    const sansRelance = nu.appels.filter((a) => a.passe !== "relance").reduce((s, a) => s + a.pireCasUsd, 0);
    expect(sansRelance).toBeGreaterThan(0.85);
    expect(sansRelance).toBeLessThan(0.95);
  });

  it("l'estimation suit l'appel réellement construit (recette au prix 1 h), avec le même écart que la complète (< 1 %)", async () => {
    const { pireCasRequete } = await import("@/generateur/roles/types");
    const socle = { contexteAxion: "x".repeat(jetonsSocle * 3) };
    for (const m of ["complete", "courte"] as const) {
      const e = service.estimerCoutScript(DEMANDE_MODELE, undefined, jetonsSocle, m);
      const { role, entree } = roleDeRequete(requeteAngle(DEMANDE_MODELE, m), "angle", socle);
      expect(Math.abs(e.appels[0].pireCasUsd / pireCasRequete(role, entree) - 1), m).toBeLessThan(0.01);
    }
  });

  it("complète : inchangée (même calcul qu'avant, socle seul au prix 1 h)", () => {
    expect(service.estimerCoutScript(DEMANDE_MODELE, undefined, jetonsSocle, "complete")).toEqual(complete);
    expect(complete.pireCasUsd).toBeGreaterThan(2);
  });
});

describe("règles de Will et témoin", () => {
  it("les règles (les deux méthodes) : jamais « faites-le vous-même », jamais d'annonce d'outil, une vidéo = une cible", () => {
    expect(REGLES_TABLEAU).toMatch(/Jamais conclure par « faites-le vous-même »/);
    expect(REGLES_TABLEAU).toMatch(/la fin dit qu'on le met en place/);
    expect(REGLES_TABLEAU).toMatch(/« cet outil vient de sortir », « nouvel outil »/);
    expect(REGLES_TABLEAU).toMatch(/UNE cible : TPE, PME, ETI ou grand groupe/);
    for (const m of ["complete", "courte"] as const) expect(requeteEcriture(DEMANDE_MODELE, ANGLE, undefined, {}, m).systeme[0].texte).toContain("UNE cible");
  });

  it("le témoin v5 « Le seul qui connaît ce dossier client… » passe toujours tous les contrôles ; grille de 10 critères", () => {
    expect(SCRIPT_TEMOIN).toContain("Le seul qui connaît ce dossier client est en congé.");
    expect(aDesEliminatoires(controlerEcriture(ecritureModele(), DEMANDE_MODELE))).toBe(false);
    expect(CRITERES_GRILLE).toHaveLength(10);
  });
});
