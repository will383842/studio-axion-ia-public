/**
 * LOT A1 — écran Réglages : pastille « Gelé », « Tester » coupé ; jamais « Buffer », « Zernio » ni « API » visible (I6).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VueBuffer } from "@/services/buffer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/reglages/actions-buffer", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));

const { BlocBuffer } = await import("@/components/reglages/BlocBuffer");

const vue = (x: Partial<VueBuffer> = {}): VueBuffer => ({
  relie: true,
  clePresente: true,
  mode: "brouillon",
  lusLe: new Date(Date.now() - 5 * 60_000).toISOString(),
  comptes: [],
  reseaux: [{ reseau: "instagram", nom: "Instagram", compte: { id: "ig", nom: "Exemple IA", source: "auto" }, candidats: [{ id: "ig", nom: "Exemple IA" }] }],
  ...x,
});
const rendre = (v: VueBuffer) => renderToStaticMarkup(createElement(BlocBuffer, { vue: v }));
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");
const boutonTester = (html: string) => html.split("<button").find((b) => /Tester/.test(b.split("</button>")[0] ?? ""));

describe("A1 · bloc de l'ancien outil, gelé", () => {
  it("pastille « Gelé », « Tester » désactivé, aucun nom d'outil visible", () => {
    const html = rendre(vue({ gele: true }));
    expect(texte(html)).toContain("Gelé");
    const b = boutonTester(html);
    expect(b).toBeDefined();
    expect(b).toMatch(/disabled=""/);
    expect(texte(html)).not.toMatch(/zernio|buffer|\bapi\b/i);
  });

  it("gelé prime sur « Relié » même clé posée et outil choisi", () => {
    expect(texte(rendre(vue({ gele: true, relie: true })))).not.toContain("Relié");
  });

  it("`gele` absent + relié → « Tester » actif (rien ne change hors gel)", () => {
    const html = rendre(vue({ relie: true }));
    expect(texte(html)).not.toContain("Gelé");
    expect(boutonTester(html)).not.toMatch(/disabled=""/);
  });
});
