/**
 * LOT R1 — ÉCRANS (rendu serveur, sans clic) : bloc Buffer de Réglages et feuille « Envoyer vers Buffer ».
 *  - l'état dit la vérité (Relié / À relier / Simulation), le mode « Brouillon dans Buffer » est le défaut ;
 *  - un réseau sans compte ou avec deux comptes est signalé, avec le choix ; aucune valeur de clé, jamais ;
 *  - vouvoiement, mots simples, aucune mention « IA » imposée ;
 *  - le bouton d'envoi dit ce qui va VRAIMENT se passer.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VueBuffer } from "@/services/buffer";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/reglages/actions-buffer", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));
vi.mock("@/app/(studio)/videos/actions", () => new Proxy({}, { get: (_c, nom) => (nom === "then" ? undefined : async () => ({ ok: true, donnees: undefined })) }));

const { BlocBuffer } = await import("@/components/reglages/BlocBuffer");
const { libelleEnvoi } = await import("@/components/publication/FeuilleEnvoyerBuffer");

const CLE = "cle-buffer-valeur-secrete-1234";
const vue = (x: Partial<VueBuffer> = {}): VueBuffer => ({
  relie: true,
  clePresente: true,
  mode: "brouillon",
  lusLe: new Date(Date.now() - 5 * 60_000).toISOString(),
  comptes: [],
  reseaux: [
    { reseau: "instagram", nom: "Instagram", compte: { id: "ig", nom: "Axion IA", source: "auto" }, candidats: [{ id: "ig", nom: "Axion IA" }] },
    { reseau: "linkedin", nom: "LinkedIn", proposes: [], candidats: [{ id: "li1", nom: "Williams", genre: "profile" }, { id: "li2", nom: "Axion IA", genre: "page" }] },
    { reseau: "tiktok", nom: "TikTok", probleme: "Aucun compte TikTok n'est relié dans Buffer.", candidats: [] },
  ],
  ...x,
});
const rendre = (v: VueBuffer) => renderToStaticMarkup(createElement(BlocBuffer, { vue: v }));
const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

describe("R1 — bloc Buffer (Réglages)", () => {
  it("relié, brouillon par défaut : la phrase, le choix du mode, les comptes, les problèmes, le choix LinkedIn", () => {
    const t = texte(rendre(vue()));
    expect(t).toContain("Relié");
    expect(t).toContain("Les vidéos arrivent en brouillon dans Buffer : vous les relisez et les programmez dans Buffer.");
    expect(t).toContain("Brouillon dans Buffer");
    expect(t).toContain("Programmer directement");
    expect(t).toContain("Axion IA");
    expect(t).toContain("Aucun compte TikTok n'est relié dans Buffer.");
    expect(t).toContain("Compte LinkedIn proposé par défaut");
    // Lot R1b : deux comptes ne sont pas un problème, Will choisit à chaque envoi.
    expect(t).toContain("2 comptes : vous choisissez à chaque envoi");
    expect(t).toContain("Profil");
    expect(t).toContain("Page");
    expect(t).toContain("Tester");
  });

  it("sans clé : « À relier », « il manque la clé Buffer » (jamais un nom de réglage ni une valeur) ; clé posée mais non choisie : « Essai »", () => {
    const sans = texte(rendre(vue({ relie: false, clePresente: false })));
    expect(sans).toContain("À relier");
    expect(sans).toContain("Il manque la clé Buffer sur le serveur.");
    expect(sans).not.toMatch(/BUFFER_API_KEY|\b[A-Z][A-Z0-9_]{3,}\b/);
    expect(texte(rendre(vue({ relie: false, clePresente: true })))).toContain("Essai");
    expect(rendre(vue())).not.toContain(CLE);
  });

  it("mots simples, vouvoiement, aucune mention « IA » imposée", () => {
    for (const v of [vue(), vue({ mode: "programmer" }), vue({ relie: false, clePresente: false })]) {
      const t = texte(rendre(v)).replace(/Axion IA/g, "");
      expect(t).not.toMatch(/\bIA\b|intelligence artificielle|\btu\b|\bton\b|\btes\b|GraphQL|API\b|token/i);
    }
  });

  it("le bouton d'envoi dit ce qui va vraiment se passer", () => {
    expect(libelleEnvoi(undefined, true)).toBe("Envoyer");
    expect(libelleEnvoi("brouillon", true)).toBe("Envoyer");
    expect(libelleEnvoi("brouillon", false)).toBe("Envoyer en brouillon");
    expect(libelleEnvoi("programmer", false)).toBe("Programmer dans Buffer");
  });
});
