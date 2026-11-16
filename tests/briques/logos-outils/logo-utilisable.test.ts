import { describe, expect, it } from "vitest";
import { DROITS } from "../../../src/briques/droits";
import { MANIFESTE_LOGOS, MENTION_MARQUES, logoUtilisable } from "../../../src/briques/motion/logos-outils/index";
import type { EntreeLogoOutil } from "../../../src/briques/motion/logos-outils/manifeste";

const IDS_REGISTRE_AVANT = [...DROITS.map((d) => d.id)].sort();
const AUJOURDHUI = "2026-11-16";
const entree = (extra: Partial<EntreeLogoOutil> = {}): EntreeLogoOutil => ({
  id: "outil-test", nature: "outil", outil: "Test", source: "s", adresse: "a", adresseCharte: "c",
  dateRecuperation: "2026-11-15", versionSource: "1", licenceFichier: "l", reglesCharte: "r", charte: {},
  preuve: "p", empreinteSha256: "a".repeat(64), risque: "faible", statut: "valide",
  validePar: "williams", dateValidation: "2026-11-16", droitId: "logo-test", ...extra,
});
const droit = (extra: Record<string, unknown> = {}) => ({ id: "logo-test", type: "logo-outil", licence: "Usage de marque", auteur: "x", preuve: "x", date: "2026-11-15", ...extra });
const avec = (d: unknown) => (DROITS as unknown as unknown[]).push(d);
const sans = () => { const i = DROITS.findIndex((x) => x.id === "logo-test"); if (i >= 0) (DROITS as unknown[]).splice(i, 1); };

describe("logoUtilisable", () => {
  it("rend ok pour une entrée valide avec un droit logo-outil non périmé", () => {
    avec(droit());
    try { expect(logoUtilisable(entree(), AUJOURDHUI)).toEqual({ ok: true }); } finally { sans(); }
  });
  it("chaque refus a sa raison", () => {
    avec(droit());
    try {
      for (const statut of ["a-valider", "texte-seul", "interdit"] as const) {
        const r = logoUtilisable(entree({ statut }), AUJOURDHUI);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.raison).toMatch(/statut/);
      }
      const r1 = logoUtilisable(entree({ validePar: undefined }), AUJOURDHUI);
      expect(r1.ok).toBe(false);
      const r2 = logoUtilisable(entree({ droitId: "absent" }), AUJOURDHUI);
      expect(r2).toEqual({ ok: false, raison: expect.stringMatching(/droit absent/) });
    } finally { sans(); }
  });
  it("droit périmé refusé", () => {
    avec(droit({ perimeLe: "2026-11-01" }));
    try { expect(logoUtilisable(entree(), AUJOURDHUI)).toEqual({ ok: false, raison: expect.stringMatching(/périmé/) }); } finally { sans(); }
  });
  it("droit d'un autre type refusé", () => {
    avec(droit({ type: "dessin" }));
    try { expect(logoUtilisable(entree(), AUJOURDHUI)).toEqual({ ok: false, raison: expect.stringMatching(/type/) }); } finally { sans(); }
  });
  it("sans droitId refusé", () => {
    expect(logoUtilisable(entree({ droitId: undefined }), AUJOURDHUI).ok).toBe(false);
  });
  it("manifeste vide : aucun logo utilisable ; mention ré-exportée", () => {
    expect(MANIFESTE_LOGOS.length).toBe(0);
    expect(MANIFESTE_LOGOS.filter((e) => logoUtilisable(e, AUJOURDHUI).ok)).toEqual([]);
    expect(MENTION_MARQUES).toMatch(/appartiennent/);
  });
  it("registre inchangé : mêmes ids avant et après", () => {
    expect([...DROITS.map((d) => d.id)].sort()).toEqual(IDS_REGISTRE_AVANT);
  });
});
