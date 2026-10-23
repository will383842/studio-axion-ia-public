/**
 * P2S · lot B · document promis : la correction de Will (contrôle, brouillon / validé), les pièces de la page.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { TexteImprimable } from "../../../src/components/formats/cas-concret/document/TexteImprimable";
import { BUDGET_DEUX_PAGES, controlerTexteDocument, PHRASES_DOCUMENT, structurerTexte } from "../../../src/components/formats/cas-concret/document/texte";
import { trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { documentDuCas, texteSource } from "../../../src/formats/cas-concret/document";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret-document");

const MDP = "cas-concret-correction";
const VIDEO = "v-03";
const cas = trouverCas("recrutement-apporteurs")!;
const texteDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const premierJet = texteSource(documentDuCas(cas, { codeSuivi: "cc-abc123" }));
const corrige = (mot: string) => premierJet.replace("## Le principe", `## Le principe ${mot}`);

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Réglage `casConcret.documentPromis` allumé DANS LE DOUBLE seulement (éteint par défaut dans le studio).
  await ecrireParametre("casConcret.documentPromis", true);
  await depots().videos.modifier(VIDEO, { formatId: "cas-concret", entrees: { casConcret: { casId: cas.id, codeSuivi: "cc-abc123" } } });
});

describe("controlerTexteDocument (pur)", () => {
  it("le premier jet passe", () => expect(controlerTexteDocument(premierJet, premierJet)).toEqual([]));
  it("un texte vide est refusé", () => expect(controlerTexteDocument("  ", premierJet)).toEqual([PHRASES_DOCUMENT.vide]));
  it("un texte de plus de deux pages est refusé", () => expect(controlerTexteDocument("a ".repeat(BUDGET_DEUX_PAGES), premierJet)).toContain(PHRASES_DOCUMENT.troplong));
  it("un prix, un chiffre sans source, un mot interdit, une réservation, un nom ajouté sont refusés", () => {
    expect(controlerTexteDocument(`${premierJet}\nCela coûte 90 euros.`, premierJet)).toEqual(expect.arrayContaining([PHRASES_DOCUMENT.prix, PHRASES_DOCUMENT.chiffre]));
    expect(controlerTexteDocument(`${premierJet}\nUne machine fait tout.`, premierJet).length).toBeGreaterThan(0);
    expect(controlerTexteDocument(`${premierJet}\nRéservez votre créneau.`, premierJet)).toContain(PHRASES_DOCUMENT.reservation);
    expect(controlerTexteDocument(`${premierJet}\nMerci à Martine Dupont.`, premierJet)).toContain(PHRASES_DOCUMENT.nom);
  });
});

describe("structurerTexte et page imprimable", () => {
  it("découpe le titre et les sections du premier jet", () => {
    const t = structurerTexte(premierJet);
    expect(t.titre).toBe(cas.documentPromis.nom);
    expect(t.sections.map((s) => s.titre).filter(Boolean)).toContain("Les étapes");
  });
  it("la page du texte corrigé est une page A4 sans bouton ni formulaire", () => {
    const html = renderToStaticMarkup(createElement(TexteImprimable, { texte: premierJet }));
    expect(html).toContain("@page");
    expect(texteDe(html)).toContain(cas.documentPromis.nom);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });
});

describe("corrigerDocument et validerDocument", () => {
  it("brouillon au départ ; la correction est gardée, contrôlée et la page la montre", async () => {
    const avant = await service.lireDocument(VIDEO);
    expect(avant.etat).toBe("brouillon");
    expect(avant.corrige).toBe(false);
    expect(avant.texte).toBe(premierJet);
    await service.corrigerDocument(VIDEO, corrige("en bref"));
    const apres = await service.lireDocument(VIDEO);
    expect(apres.corrige).toBe(true);
    expect(apres.texte).toContain("## Le principe en bref");
    expect(apres.etat).toBe("brouillon");
  });

  it("refuse une correction qui enfreint le contrôle, sans rien écrire", async () => {
    await expect(service.corrigerDocument(VIDEO, `${premierJet}\nSeulement 99 euros.`)).rejects.toThrow();
    expect((await service.lireDocument(VIDEO)).corrige).toBe(false);
  });

  it("valider puis corriger : la validation tombe, le document redevient un brouillon ; valider garde la correction", async () => {
    await service.corrigerDocument(VIDEO, corrige("en bref"));
    const v = await service.validerDocument(VIDEO, { maintenant: Date.parse("2026-10-12T08:00:00Z") });
    let vue = await service.lireDocument(VIDEO);
    expect(vue.etat).toBe("valide");
    expect(vue.valideLe).toBe(v.valideLe);
    expect(vue.corrige).toBe(true);
    await service.corrigerDocument(VIDEO, corrige("détaillé"));
    vue = await service.lireDocument(VIDEO);
    expect(vue.etat).toBe("brouillon");
    expect(vue.valideLe).toBeUndefined();
  });

  it("revenir au premier jet retire la correction", async () => {
    await service.corrigerDocument(VIDEO, corrige("en bref"));
    await service.corrigerDocument(VIDEO, premierJet);
    expect((await service.lireDocument(VIDEO)).corrige).toBe(false);
  });
});
