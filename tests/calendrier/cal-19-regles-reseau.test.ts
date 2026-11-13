/**
 * CAL-19 : les règles par réseau (longueur du texte, mots-dièse, PDF du carrousel LinkedIn, premier commentaire à
 * 3 états) se modifient dans Réglages, se relisent après rechargement, portent leur date de vérification et leur
 * source, et une règle modifiée change le contrôle du texte sans redéploiement. Aucun appel réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  REGLAGES_CADENCE_DEFAUT,
  RESEAUX_CADENCE,
  controlerTexteSelonRegles,
  normaliserReglagesCadence,
  regleSaisie,
} from "@/domaine/cadence/reglages";

const memoire = new Map<string, unknown>();
vi.mock("@/services/_commun", () => ({
  lireParametre: async (id: string, defaut: unknown) => (memoire.has(id) ? memoire.get(id) : defaut),
  ecrireParametre: async (id: string, v: unknown) => void memoire.set(id, JSON.parse(JSON.stringify(v))),
  journaliser: async () => undefined,
  essayer: async (f: () => Promise<unknown>) => {
    try {
      return { ok: true, donnees: await f() };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
}));
vi.mock("@/services/auth", () => ({ exigerSession: async () => undefined }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));

beforeEach(() => memoire.clear());

const AUCUN_PRIX = /€|\$|\beuros?\b|\bprix\b|\btarifs?\b/i;

describe("CAL-19 : règles par réseau", () => {
  it("chaque règle de départ affiche sa source et sa date de vérification (ou dit qu'elle n'est pas vérifiée)", () => {
    for (const id of RESEAUX_CADENCE) {
      const r = REGLAGES_CADENCE_DEFAUT.regles[id];
      for (const v of [r.texteMax, r.motsDieseMax, r.premierCommentaire, ...(r.pdfCarrousel ? [r.pdfCarrousel] : [])]) {
        expect(v.source.length).toBeGreaterThan(5);
        expect(v.verifieLe === null || /^\d{4}-\d{2}-\d{2}$/.test(v.verifieLe)).toBe(true);
        expect(v.source).not.toMatch(AUCUN_PRIX);
      }
    }
    // Valeurs de départ sourcées par le relevé L8-01 (daté).
    expect(REGLAGES_CADENCE_DEFAUT.regles.linkedin.pdfCarrousel).toMatchObject({ valeur: 1, verifieLe: "2026-11-12" });
    expect(REGLAGES_CADENCE_DEFAUT.regles.linkedin.premierCommentaire.verifieLe).toBe("2026-11-12");
    expect(REGLAGES_CADENCE_DEFAUT.regles.tiktok.texteMax).toMatchObject({ valeur: 2200, verifieLe: "2026-11-12" });
    // Le premier commentaire a trois états ; seul LinkedIn porte une règle de PDF.
    expect(REGLAGES_CADENCE_DEFAUT.regles.linkedin.premierCommentaire.valeur).toBe("a-confirmer");
    expect(REGLAGES_CADENCE_DEFAUT.regles.instagram.premierCommentaire.valeur).toBe("a-la-main");
    expect(REGLAGES_CADENCE_DEFAUT.regles.instagram.pdfCarrousel).toBeUndefined();
  });

  it("une valeur illisible retombe sur la valeur de départ ; une valeur lisible est gardée avec sa source", () => {
    const n = normaliserReglagesCadence({
      regles: { linkedin: { texteMax: { valeur: "beaucoup" }, motsDieseMax: { valeur: 4, source: "Mon essai", verifieLe: "2026-12-01" }, premierCommentaire: { valeur: "auto" } } },
    });
    expect(n.regles.linkedin.texteMax).toEqual(REGLAGES_CADENCE_DEFAUT.regles.linkedin.texteMax);
    expect(n.regles.linkedin.motsDieseMax).toEqual({ valeur: 4, source: "Mon essai", verifieLe: "2026-12-01" });
    expect(n.regles.linkedin.premierCommentaire.valeur).toBe("auto");
    expect(normaliserReglagesCadence({ regles: { linkedin: { premierCommentaire: { valeur: "nimporte" } } } }).regles.linkedin.premierCommentaire.valeur).toBe("a-confirmer");
  });

  it("une règle modifiée change le contrôle du texte, sans redéploiement, et survit au rechargement", async () => {
    const { enregistrerReglagesCadence, lireReglagesCadence } = await import("@/services/reglages-cadence");
    const texte = "a".repeat(500);
    const avant = controlerTexteSelonRegles(await lireReglagesCadence(), "linkedin", { texte });
    expect(avant).toEqual([]);

    const actuels = await lireReglagesCadence();
    await enregistrerReglagesCadence({
      ...actuels,
      regles: { ...actuels.regles, linkedin: { ...actuels.regles.linkedin, texteMax: { valeur: 300, source: "Réglé par vous", verifieLe: "2026-11-13" } } },
    });

    const relu = await lireReglagesCadence(); // « rechargement » : lecture depuis la mémoire des paramètres
    expect(relu.regles.linkedin.texteMax).toEqual({ valeur: 300, source: "Réglé par vous", verifieLe: "2026-11-13" });
    const apres = controlerTexteSelonRegles(relu, "linkedin", { texte });
    expect(apres).toHaveLength(1);
    expect(apres[0]).toMatch(/500.*300/);
    expect(apres[0]).not.toMatch(AUCUN_PRIX);
  });

  it("contrôle les mots-dièse, le PDF du carrousel LinkedIn et le premier commentaire (jamais bloquant)", () => {
    const r = normaliserReglagesCadence({
      regles: { linkedin: { motsDieseMax: { valeur: 1 } }, tiktok: { premierCommentaire: { valeur: "a-la-main" } } },
    });
    const m = controlerTexteSelonRegles(r, "linkedin", { texte: "Bonjour #un #deux", nbPdf: 2, premierCommentaire: "" });
    expect(m.join(" ")).toMatch(/mots-dièse/);
    expect(m.join(" ")).toMatch(/PDF/);
    // Autre réseau : pas de règle de PDF.
    expect(controlerTexteSelonRegles(r, "instagram", { texte: "ok", nbPdf: 3 })).toEqual([]);
    // Premier commentaire « à la main » : un texte saisi est signalé comme à copier, pas refusé.
    const pc = controlerTexteSelonRegles(r, "tiktok", { texte: "ok", premierCommentaire: "Et vous ?" });
    expect(pc).toHaveLength(1);
  });
});

describe("CAL-19 : date d'une règle modifiée (jour de Paris)", () => {
  it("à 00:30 heure de Paris (23:30 UTC la veille), la règle est datée du jour de Paris", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-13T23:30:00Z")); // 00:30 le 14 à Paris (hiver)
      const r = regleSaisie(REGLAGES_CADENCE_DEFAUT.regles.linkedin.texteMax, 999);
      expect(r.verifieLe).toBe("2026-11-14");
      vi.setSystemTime(new Date("2026-07-13T22:30:00Z")); // 00:30 le 14 à Paris (été)
      expect(regleSaisie(REGLAGES_CADENCE_DEFAUT.regles.linkedin.texteMax, 999).verifieLe).toBe("2026-07-14");
    } finally {
      vi.useRealTimers();
    }
  });
  it("le formulaire historique conserve les règles enregistrées", async () => {
    const { enregistrerReglagesCadence, lireReglagesCadence } = await import("@/services/reglages-cadence");
    const { enregistrerCadenceFormulaire } = await import("@/app/(studio)/reglages/cadence/actions");
    const regles = structuredClone(REGLAGES_CADENCE_DEFAUT.regles);
    regles.linkedin.texteMax = { valeur: 1234, verifieLe: "2026-11-01", source: "test" };
    await enregistrerReglagesCadence({ regles });
    const f = new FormData();
    f.set("heures-linkedin", "08:00");
    await enregistrerCadenceFormulaire(f);
    expect((await lireReglagesCadence()).regles.linkedin.texteMax.valeur).toBe(1234);
  });
});
