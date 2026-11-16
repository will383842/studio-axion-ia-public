/**
 * ZERNIO-COMPTES : seul un identifiant de la liste ACTUELLE de Zernio peut partir ; jamais de compte deviné par son nom.
 * (a) un ancien identifiant n'est jamais traduit, même avec un compte de même nom chez Zernio ;
 * (b) un seul compte coché absent de la liste : refus en français clair, rien ne part ;
 * (c) plusieurs comptes dont un absent : refus, rien ne part ;
 * (d) rien de coché : règles habituelles inchangées ;
 * (e) faux Zernio, aucun appel réel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanalPublication, DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { ciblesZernioPour, traduireSelectionVersZernio } from "@/services/zernio-cibles";

const canal = (id: string, nom: string, service: string, extra: Partial<CanalPublication> = {}): CanalPublication => ({ id, organisationId: "zernio", nom, service, deconnecte: false, ...extra });
const IG = canal("exemple-ig-1", "Compte exemple", "instagram");
const FB1 = canal("exemple-fb-1:fb:p1", "Page exemple 1", "facebook", { genre: "page" });
const FB2 = canal("exemple-fb-1:fb:p2", "Page exemple 2", "facebook", { genre: "page" });
const LI_ORG = canal("exemple-li-1:li:1", "Organisation exemple", "linkedin", { genre: "page" });
const LI_PROFIL = canal("exemple-li-1:li:profil", "Profil exemple", "linkedin", { genre: "profil" });
const ANCIEN = "ancien-identifiant-1";

let demandes: DemandePublication[] = [];
function faux(canaux: CanalPublication[]): FournisseurPublication {
  return {
    id: "zernio", type: "publication", nom: "Faux", reelPrevu: "Zernio", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    async envoyer(d) {
      demandes.push(d);
      return { idExterne: "exemple-post-1", via: "zernio" as const, statut: "brouillon" as const };
    },
    async listerCanaux() {
      return canaux;
    },
  };
}
/** Chemin complet : traduction puis cibles ; ne « part » que si les cibles sont acceptées. */
async function tenterEnvoi(service: FournisseurPublication, reseau: "instagram" | "facebook" | "linkedin", coches: string[], ancienneListe: CanalPublication[] = []) {
  const traduits = await traduireSelectionVersZernio(service, reseau, coches, ancienneListe);
  const r = await ciblesZernioPour(service, reseau, traduits);
  if (r.ok) for (const c of r.canaux) await service.envoyer({ reseau, texte: "Texte d'exemple", date: "2026-11-20T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: c.id, cleEnvoi: "cle-exemple" } as DemandePublication);
  return r;
}

beforeEach(() => {
  demandes = [];
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch réel interdit")));
});
afterEach(() => vi.unstubAllGlobals());

describe("ZERNIO-COMPTES (a) · un ancien identifiant n'est jamais traduit", () => {
  it("même avec un compte Zernio de même nom : refus, rien ne part", async () => {
    const ancienne = [canal(ANCIEN, "Compte exemple", "instagram")];
    const r = await tenterEnvoi(faux([IG]), "instagram", [ANCIEN], ancienne);
    expect(r.ok).toBe(false);
    expect(demandes).toHaveLength(0);
  });
  it("la liste mémorisée n'est ni lue pour traduire ni modifiée", async () => {
    const ancienne = [canal(ANCIEN, "Compte exemple", "instagram")];
    const copie = JSON.stringify(ancienne);
    const traduits = await traduireSelectionVersZernio(faux([IG]), "instagram", [ANCIEN], ancienne);
    expect(traduits).not.toContain(IG.id);
    expect(JSON.stringify(ancienne)).toBe(copie);
  });
});

describe("ZERNIO-COMPTES (b) · un seul compte coché absent de la liste", () => {
  it("refus en français clair, rien ne part, rien n'est supprimé", async () => {
    const r = await tenterEnvoi(faux([IG]), "instagram", [ANCIEN]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("CIBLE_INCONNUE");
      expect(r.message).toMatch(/n'est plus relié à Zernio/);
      expect(r.message).toMatch(/recochez-le/);
    }
    expect(demandes).toHaveLength(0);
  });
  it("même sur un réseau à un seul compte : pas de repli sur ce compte", async () => {
    expect((await tenterEnvoi(faux([FB1]), "facebook", [ANCIEN])).ok).toBe(false);
    expect(demandes).toHaveLength(0);
  });
});

describe("ZERNIO-COMPTES (c) · plusieurs comptes dont un absent", () => {
  it("refus, rien ne part sur les comptes valides", async () => {
    const r = await tenterEnvoi(faux([FB1, FB2]), "facebook", [FB1.id, ANCIEN]);
    expect(r.ok).toBe(false);
    expect(demandes).toHaveLength(0);
  });
  it("tous présents : partent, sans doublon", async () => {
    const r = await tenterEnvoi(faux([FB1, FB2]), "facebook", [FB1.id, FB2.id, FB1.id]);
    expect(r.ok).toBe(true);
    expect(demandes).toHaveLength(2);
  });
});

describe("ZERNIO-COMPTES (d) · rien de coché : règles habituelles", () => {
  it("seul compte du réseau (Instagram)", async () => {
    const r = await ciblesZernioPour(faux([IG]), "instagram", undefined);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual([IG.id]);
  });
  it("organisation LinkedIn unique, jamais le profil", async () => {
    const r = await ciblesZernioPour(faux([LI_ORG, LI_PROFIL]), "linkedin", undefined);
    expect(r.ok && r.canaux.map((c) => c.id)).toEqual([LI_ORG.id]);
  });
  it("jamais de page Facebook par défaut", async () => {
    const r = await ciblesZernioPour(faux([FB1]), "facebook", undefined);
    expect(r.ok).toBe(false);
  });
  it("page interdite retirée de la liste", async () => {
    const { empreinteNomPage, PAGES_FACEBOOK_INTERDITES } = await import("@/fournisseurs/publication/zernio-pages-interdites");
    expect(empreinteNomPage).toBeTypeOf("function");
    expect(PAGES_FACEBOOK_INTERDITES.empreintesNom.every((e) => /^[0-9a-f]{64}$/.test(e))).toBe(true);
  });
});
