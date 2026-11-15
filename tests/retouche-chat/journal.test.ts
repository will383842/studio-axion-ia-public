import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

import { journaliserRetouche, ligneJournal, type LigneJournalRetouche } from "@/services/retouche-chat/journal";

const base: LigneJournalRetouche = {
  evenement: "apercu",
  videoId: "vid_1",
  qui: "session_abc",
  quand: "2026-11-15T10:00:00.000Z",
  demande: "Mets le titre en gras",
  operationsLues: ["sous-titres.style"],
  operationsEcartees: [],
  claudeAppele: false,
};

describe("journal du chat de retouche", () => {
  it("(a) 3 appels = 3 événements distincts, types exacts, entité vidéo", async () => {
    const appels: { type: string; message: string; entite?: { type: string; id: string } }[] = [];
    const ecrire = async (type: string, message: string, entite?: { type: string; id: string }) => void appels.push({ type, message, entite });
    for (const e of ["apercu", "application", "retour"] as const) await journaliserRetouche({ ...base, evenement: e }, ecrire);
    expect(appels.map((a) => a.type)).toEqual(["retouche-chat.apercu", "retouche-chat.application", "retouche-chat.retour"]);
    expect(appels.every((a) => a.entite?.type === "video" && a.entite.id === "vid_1")).toBe(true);
  });

  it("(b) message borné à 500 caractères", () => {
    expect(ligneJournal({ ...base, demande: "x".repeat(5000) }).length).toBeLessThanOrEqual(500);
  });

  it("(c) une clé sk-ant n'apparaît pas", () => {
    const m = ligneJournal({ ...base, demande: "ma clé sk-ant-api03-ABCDEF123456 voilà" });
    expect(m).not.toContain("sk-ant-");
  });

  it("(d) une écriture qui lève ne fait pas lever", async () => {
    await expect(journaliserRetouche(base, async () => { throw new Error("base morte"); })).resolves.toBeUndefined();
  });

  it("(e) opérations écartées listées avec leur raison", () => {
    const m = ligneJournal({ ...base, operationsEcartees: [{ type: "musique.ajout", raison: "son neuf interdit" }] });
    expect(m).toContain("musique.ajout");
    expect(m).toContain("son neuf interdit");
    expect(m).toContain("sous-titres.style");
  });

  it("(f) garde statique : aucun import d'argent ni de Claude en valeur", () => {
    const src = readFileSync(join(process.cwd(), "src/services/retouche-chat/journal.ts"), "utf8");
    const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    const interdits = /credits|budget-mensuel|mode-budget|autonomie-usine|couts|cle-depense-usine|depense-claude|generation-claude|image-video|fournisseurs\/claude\/client/;
    expect(imports.filter((i) => interdits.test(i))).toEqual([]);
  });
});
