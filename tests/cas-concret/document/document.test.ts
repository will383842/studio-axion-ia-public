/**
 * P2-03 : le document promis. Partie pure (faits du cas, mots interdits), page rendue en statique, service sur base en
 * mémoire (validation datée, aucun module d'envoi).
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { DocumentPromis } from "../../../src/components/formats/cas-concret/document/DocumentPromis";
import { CATALOGUE, trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { codeDocument, documentDuCas, etatDocument, lienDuDocument, mentionDocument, texteSource } from "../../../src/formats/cas-concret/document";
import { PAGE_DIAGNOSTIC } from "../../../src/formats/cas-concret";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret-document");

const MDP = "cas-concret-document";
const VIDEO = "v-03";
const INTERDITS = [/machine/i, /villeexemple/i, /aucun gain garanti/i];
/** Deux pages A4 au plus : budget de texte (en caractères) pour tout le document, vérifié sur chaque cas. */
const BUDGET_DEUX_PAGES = 4600;

const aplati = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(aplati) : v && typeof v === "object" ? Object.values(v).flatMap(aplati) : []);
const texteDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

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
});

describe("documentDuCas (pur)", () => {
  const cas = trouverCas("recrutement-apporteurs")!;
  const doc = documentDuCas(cas, { codeSuivi: "cc-recrutement-apporteurs-abc123" });

  it("reprend le titre, les étapes, le reste humain et le résultat du cas", () => {
    expect(doc.titre).toBe(cas.documentPromis.nom);
    expect(doc.sousTitre).toBe(cas.titre);
    expect(doc.etapes.map((e) => e.titre)).toEqual(cas.etapes.map((e) => e.titre));
    expect(doc.etapes.map((e) => e.detail)).toEqual(cas.etapes.map((e) => e.detail));
    expect(doc.resteHumain).toBe(cas.resteHumain);
    expect(doc.principe.apres).toBe(cas.resultat);
    expect(doc.principe.avant).toEqual(cas.avant.taches);
  });

  it("ne contient que des faits du cas : repères = faits dicibles, aucun nombre inventé", () => {
    const enonces = new Set(cas.faits.map((f) => f.enonce));
    expect(doc.reperes.length).toBeGreaterThan(0);
    for (const r of doc.reperes) expect(enonces.has(r)).toBe(true);
    // « estimation » n'est pas un repère.
    expect(doc.reperes).not.toContain(cas.faits.find((f) => f.source === "estimation")!.enonce);
    // Les phrases propres au document (introduction, limites, besoins, appel) ne portent aucun chiffre.
    const fixes = aplati([doc.introduction, doc.limites, doc.miseEnPlace, doc.etapes.map((e) => e.besoin), doc.appel.titre, doc.appel.bouton, doc.signature]);
    for (const t of fixes) expect(t).not.toMatch(/\d/);
  });

  it("n'écrit pas la phrase de conformité absolue du cas", () => {
    const t = aplati(doc).join(" ");
    expect(t).not.toMatch(/cent pour cent|100 ?%|sans aucune intervention/i);
    expect(doc.limites.some((l) => l.includes("données personnelles"))).toBe(true);
  });

  it("aucun mot interdit, ni prix, ni nom de client, pour tous les cas du catalogue", () => {
    for (const c of CATALOGUE) {
      const t = aplati(documentDuCas(c)).join("\n");
      for (const m of INTERDITS) expect(t, c.id).not.toMatch(m);
      expect(t, c.id).not.toMatch(/€|euros?\b/i);
    }
  });

  it("l'appel est le diagnostic gratuit, avec un lien suivi, sans réservation ni rendez-vous", () => {
    expect(doc.appel.titre).toBe("Faites votre diagnostic gratuit en quelques minutes");
    expect(doc.appel.bouton).toBe("Faire mon diagnostic");
    for (const c of CATALOGUE) {
      const d = documentDuCas(c);
      const fixes = aplati([d.introduction, d.limites, d.miseEnPlace, d.etapes.map((e) => e.besoin), d.appel, d.signature]).join("\n");
      expect(fixes, c.id).not.toMatch(/r[ée]serv|rendez-vous|\d+ ?minutes/i);
    }
    // #167 attendait `${PAGE_DIAGNOSTIC}?utm_source=document&utm_campaign=cc-recrutement-apporteurs-abc123` (lien écrit à la main) ;
    // sur master, la garde T4 (`lien-suivi-unique`) l'interdit : le lien du document est simple, sans suivi.
    expect(doc.appel.lien).toBe(PAGE_DIAGNOSTIC);
    expect(lienDuDocument()).toBe(PAGE_DIAGNOSTIC);
  });

  it("code stable structure-<code du cas>, état brouillon puis valide", () => {
    expect(codeDocument(cas)).toBe("structure-recrutement-apporteurs");
    expect(doc.code).toBe("structure-recrutement-apporteurs");
    expect(etatDocument(undefined)).toBe("brouillon");
    expect(etatDocument("2026-10-12T08:00:00.000Z")).toBe("valide");
  });

  it("l'introduction suit l'offre : l'automatisation n'est dite que pour une intégration", () => {
    for (const c of CATALOGUE) {
      const intro = documentDuCas(c).introduction;
      if (c.offre !== "integration") expect(intro, c.id).not.toMatch(/automatisation/i);
    }
  });

  it("texte source structuré : titres de section puis lignes, dans l'ordre de la page", () => {
    const src = texteSource(doc);
    expect(src.split("\n")[0]).toBe(`# ${doc.titre}`);
    for (const titre of ["Le principe", "Les étapes", "Ce qu'il faut pour le mettre en place", "Ce qui reste humain", "Les limites"]) expect(src).toContain(`## ${titre}`);
    expect(src).toContain(doc.appel.titre);
  });

  it("aucun nombre qui ne soit pas dans le cas, aucun montant, pour tous les cas", () => {
    for (const c of CATALOGUE) {
      const source = JSON.stringify(c);
      const t = aplati({ ...documentDuCas(c), appel: undefined }).join("\n");
      for (const n of t.match(/\d+/g) ?? []) expect(source, `${c.id} : ${n}`).toContain(n);
      expect(t, c.id).not.toMatch(/€|euros?\b/i);
    }
  });

  it("tient sur deux pages A4 au plus, pour tous les cas", () => {
    for (const c of CATALOGUE) {
      const d = documentDuCas(c);
      const longueur = texteSource(d).length;
      expect(longueur, c.id).toBeLessThanOrEqual(BUDGET_DEUX_PAGES);
    }
  });

  it("mentionDocument : « à valider », puis rien une fois validé ou sans cadeau", () => {
    expect(mentionDocument(undefined, true)).toBe("Document promis : à valider avant de publier.");
    expect(mentionDocument("2026-10-12T08:00:00.000Z", true)).toBeNull();
    expect(mentionDocument(undefined, false)).toBeNull();
  });
});

describe("page imprimable", () => {
  it("rend le document en une feuille A4, sans bouton d'envoi", () => {
    const doc = documentDuCas(trouverCas("recrutement-apporteurs")!);
    const html = renderToStaticMarkup(createElement(DocumentPromis, { document: doc }));
    const t = texteDe(html);
    expect(html).toContain("210mm");
    expect(html).toContain("print:shadow-none");
    expect(t).toContain("Faites votre diagnostic gratuit en quelques minutes");
    expect(html).toContain("@page");
    expect(t).toContain(doc.titre);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html.match(/<li /g)!.length).toBeGreaterThanOrEqual(doc.etapes.length);
  });
});

describe("service du document", () => {
  async function videoCas(entrees: Record<string, unknown> = {}) {
    await depots().videos.modifier(VIDEO, { formatId: "cas-concret", entrees: { casConcret: { casId: "recrutement-apporteurs", codeSuivi: "cc-abc123", ...entrees } } });
  }

  it("lit le document d'une vidéo du format, à valider", async () => {
    await videoCas();
    const v = await service.lireDocument(VIDEO);
    expect(v.document.titre).toBe("Structure de l'automatisation");
    expect(v.code).toBe("structure-recrutement-apporteurs");
    expect(v.etat).toBe("brouillon");
    expect(v.valideLe).toBeUndefined();
    // #167 : le lien portait le code de suivi de la vidéo ; master : lien simple (garde T4).
    expect(v.document.appel.lien).toBe(PAGE_DIAGNOSTIC);
  });

  it("la validation pose { valideLe } datée dans entrees.casConcret.document et garde le reste", async () => {
    await videoCas({ mot: "IA" });
    const r = await service.validerDocument(VIDEO, { maintenant: Date.parse("2026-10-12T08:00:00Z") });
    expect(r.valideLe).toBe("2026-10-12T08:00:00.000Z");
    const video = (await depots().videos.obtenir(VIDEO))!;
    const e = (video.entrees as Record<string, Record<string, unknown>>).casConcret;
    expect(e.document).toEqual({ code: "structure-recrutement-apporteurs", valideLe: "2026-10-12T08:00:00.000Z" });
    expect(e.mot).toBe("IA");
    const vue = await service.lireDocument(VIDEO);
    expect(vue.valideLe).toBe("2026-10-12T08:00:00.000Z");
    expect(vue.etat).toBe("valide");
  });

  it("une validation d'un autre document (autre code) ne compte pas : retour à brouillon", async () => {
    await videoCas({ document: { code: "structure-autre-cas", valideLe: "2026-10-01T08:00:00.000Z" } });
    const vue = await service.lireDocument(VIDEO);
    expect(vue.etat).toBe("brouillon");
    expect(vue.valideLe).toBeUndefined();
  });

  it("refuse une vidéo d'un autre format ou un cas disparu", async () => {
    await expect(service.validerDocument(VIDEO)).rejects.toThrow();
    await videoCas({ casId: "cas-retire" });
    await expect(service.lireDocument(VIDEO)).rejects.toThrow("n'existe plus");
  });

  it("le service n'importe aucun module d'envoi", () => {
    const src = readFileSync(join(__dirname, "../../../src/services/cas-concret-document.ts"), "utf8");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports) expect(i).not.toMatch(/publications|buffer|envoi|mail|zepto/i);
  });
});
