/**
 * SCRIPT PERSO (décision de Will du 18/10) : le texte qu'il colle ou importe lui-même est pris À L'IDENTIQUE : aucun point
 * bloquant, aucun avis de style (tu/vous, tournures interdites, accroche trop longue…), jamais réécrit. Seules restent
 * les limites techniques (phrase vide, durée du format, taille du texte). Un script écrit par le générateur garde ses
 * contrôles. Aucun appel réel.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const relecture = await import("@/domaine/relecture-assistant");
const { scriptReluDe, appliquerSaisie } = await import("@/domaine/relecture-script");
const service = await import("@/services/relecture-assistant");
const { decouperTexte } = await import("@/fournisseurs/simulation/script");
const { obtenirFormat } = await import("@/formats");
import type { BlocScript } from "@/domaine/types";

const MDP_TEST = "essai-script-perso";

beforeAll(async () => {
  process.env.SESSION_SECRET = "p".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
  const H = { creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" };
  await depots().tournesInterdites.enregistrer({ id: "t-crucial", motif: "crucial", regex: "\\bcrucia(l|le)\\b", niveau: "bloquant", portee: "tous", ...H } as never);
});

const bloc = (id: string, recette: string, ...textes: string[]): BlocScript => ({ id, blocRecette: recette, segments: textes.map((t, i) => ({ id: `${id}-${i}`, texte: t })) });

/** Tout ce que Will peut coller de contestable : tournure interdite, tutoiement dans une vidéo au vous, accroche interminable. */
const ACCROCHE_LONGUE = "Si tu as déjà été confronté à une situation où ton employeur lit tes messages personnels sans te prévenir alors que ton contrat ne le prévoit pas du tout, écoute bien ce qui suit";
const TEXTE_PERSO = [ACCROCHE_LONGUE, "Il est crucial de comprendre que ton patron n'a pas le droit.", "Imagine que tu écris à ton avocat."];

describe("texte collé ou importé par Will", () => {
  it("découpé sans être réécrit, blocs marqués `colle-`", () => {
    const recette = obtenirFormat("avocat").recetteScript;
    const blocs = decouperTexte(TEXTE_PERSO.join("\n\n"), recette);
    expect(blocs.every((b) => b.id.startsWith("colle-"))).toBe(true);
    expect(blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ")).toBe(TEXTE_PERSO.join(" "));
  });

  it("aucun blocage et aucun avis, même avec tournure interdite, tutoiement et accroche trop longue", async () => {
    const blocs = decouperTexte(TEXTE_PERSO.join("\n\n"), obtenirFormat("avocat").recetteScript);
    const avant = relecture.lignesDesBlocs(blocs);
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs, script: scriptReluDe(avant, avant), adresse: "vous" });
    expect(p).toEqual([]);
  });

  it("même après une retouche de Will sur une phrase collée : toujours aucun avis", async () => {
    const blocs = decouperTexte(TEXTE_PERSO.join("\n\n"), obtenirFormat("avocat").recetteScript);
    const avant = relecture.lignesDesBlocs(blocs);
    const apres = appliquerSaisie(avant, avant[1].id, { dit: "Il est crucial de lire ton contrat." });
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs, script: scriptReluDe(avant, apres), adresse: "vous" });
    expect(p).toEqual([]);
  });

  it("la limite technique reste : une phrase vidée bloque", async () => {
    const blocs = decouperTexte(TEXTE_PERSO.join("\n\n"), obtenirFormat("avocat").recetteScript);
    const avant = relecture.lignesDesBlocs(blocs);
    const vide = appliquerSaisie(avant, avant[0].id, { dit: "" });
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs, script: scriptReluDe(avant, vide), adresse: "vous" });
    expect(p).toEqual([expect.objectContaining({ ligneId: avant[0].id, niveau: "bloquant", texte: "Phrase vide." })]);
  });
});

describe("script écrit par le générateur : contrôles inchangés (non-régression)", () => {
  it("les mêmes phrases, dans des blocs du générateur, bloquent toujours", async () => {
    const blocs = [bloc("a", "accroche", TEXTE_PERSO[0]), bloc("b", "explication", TEXTE_PERSO[1], TEXTE_PERSO[2])];
    const avant = relecture.lignesDesBlocs(blocs);
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs, script: scriptReluDe(avant, avant), adresse: "vous" });
    expect(p.some((x) => x.niveau === "bloquant" && x.code === "C4")).toBe(true);
    expect(p.some((x) => x.niveau === "bloquant" && x.ligneId?.startsWith("b/"))).toBe(true);
  });

  it("un script mixte : seuls les blocs collés sont libres", async () => {
    const colle = decouperTexte("Il est crucial de lire ton contrat.", obtenirFormat("avocat").recetteScript);
    const blocs = [...colle, bloc("g", "explication", "Il est crucial de lire ton contrat.")];
    const avant = relecture.lignesDesBlocs(blocs);
    const p = await service.controlerScriptAssistant({ formatId: "avocat", blocs, script: scriptReluDe(avant, avant), adresse: "vous" });
    expect(p.length).toBeGreaterThan(0);
    expect(p.every((x) => x.ligneId?.startsWith("g/"))).toBe(true);
  });
});
