/**
 * REPERE-PUBLICATION : le repère et la signature de l'usine suivent la publication jusqu'à « publiee », et la ligne de relevé (appel 6)
 * les reprend. Dépôts en mémoire, secrets d'essai, données fictives, aucun appel réel.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Publication, ScriptMaitre, Video } from "@/domaine/types";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { POST } = await import("@/app/api/usine/commandes/route");
const { repereDePublication } = await import("@/services/repere-publication");
const { ligneReleveUsine } = await import("@/domaine/releve-usine");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const MAINT = "2026-11-20T10:00:00.000Z";
const appel = (corps: unknown) =>
  new NextRequest("http://studio.test/api/usine/commandes", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` }, body: JSON.stringify(corps) });
const commande = (extra: Record<string, unknown> = {}) => ({
  contrat: 2, cle: "essai-repere-0001", reseau: "linkedin", jour: "2026-12-10", instant: "2026-12-10T08:30:00.000Z", compteCible: "compte-fictif-1", videoId: "v-fictive", repere: "usine:L1-1", ...extra,
});
const base = { creeLe: MAINT, modifieLe: MAINT };
const video = (extra: Partial<Video> = {}) => ({ id: "v-fictive", titre: "Titre fictif", ...base, ...extra }) as Video;
const script = (signature: string) => ({ id: "s-fictif", version: 1, origineUsine: { signature, parts: {}, typeContenu: "video" }, ...base }) as unknown as ScriptMaitre;
const publication = (statut: Publication["statut"], extra: Partial<Publication> = {}) =>
  ({ id: "pub-fictive", videoId: "v-fictive", reseau: "linkedin", statut, via: "simulation", date: MAINT, texte: "texte fictif", ...base, ...extra }) as Publication;

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.unstubAllEnvs();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("USINE_TOUT_ARRETER", "");
});

describe("repereDePublication", () => {
  it("de la commande à la publication publiée : repère et signature suivent à chaque statut", async () => {
    const d = depots();
    expect((await POST(appel(commande()))).status).toBe(201);
    const c = (await d.creneauxEditoriaux.obtenir("cmd-essai-repere-0001"))!;
    await d.creneauxEditoriaux.enregistrer({ ...c, signatureUsine: "sig-creneau" });
    await d.videos.enregistrer(video());
    for (const statut of ["brouillon", "programmee", "publiee"] as const) {
      const p = await d.publications.enregistrer(publication(statut));
      expect(await repereDePublication(p, d)).toEqual({ commande_id: "cmd-essai-repere-0001", repere: "usine:L1-1", signature: "sig-creneau" });
    }
  });

  it("signature : celle du créneau, sinon celle du script maître, sinon null", async () => {
    const d = depots();
    await POST(appel(commande()));
    await d.videos.enregistrer(video({ scriptId: "s-fictif" }));
    await d.scriptsMaitres.enregistrer(script("sig-script"));
    const p = publication("brouillon");
    expect((await repereDePublication(p, d))?.signature).toBe("sig-script");
    await d.videos.enregistrer(video());
    expect((await repereDePublication(p, d))?.signature).toBeNull();
  });

  it("publication hors usine : null, aucun repère inventé", async () => {
    const d = depots();
    await d.videos.enregistrer(video());
    expect(await repereDePublication(publication("publiee"), d)).toBeNull();
    // créneau d'une autre vidéo, d'un autre réseau, ou non né d'une commande : pas de rattachement
    await POST(appel(commande({ videoId: "autre-video" })));
    await POST(appel(commande({ cle: "essai-repere-0002", reseau: "tiktok", jour: "2026-12-11", instant: "2026-12-11T08:30:00.000Z" })));
    expect(await repereDePublication(publication("publiee"), d)).toBeNull();
    await d.creneauxEditoriaux.enregistrer({ id: "manuel-1", jourVise: "2026-12-12", heuresParReseau: { linkedin: "2026-12-12T08:00:00.000Z" }, compteCible: "c", videoId: "v-fictive", statut: "propose", decalages: 0, repereUsine: "usine:X" });
    expect(await repereDePublication(publication("publiee"), d)).toBeNull();
  });

  it("commande avec visuelId (créneau cmd- sans vidéo) + publication de visuel sans videoId : null", async () => {
    const d = depots();
    const visuelSeul: Record<string, unknown> = commande({ visuelId: "visuel-fictif" });
    delete visuelSeul.videoId;
    expect((await POST(appel(visuelSeul))).status).toBe(201);
    const c = (await d.creneauxEditoriaux.obtenir("cmd-essai-repere-0001"))!;
    expect(c.videoId).toBeUndefined();
    expect(await repereDePublication(publication("publiee", { videoId: undefined }), d)).toBeNull();
  });
});

describe("ligneReleveUsine", () => {
  const repere = { commande_id: "cmd-essai-repere-0001", repere: "usine:L1-1", signature: "sig" };
  const releve = { le: "2026-12-13T08:00:00.000Z", jour: 3, source: "zernio" as const, valeurs: { vues: 10, likes: 2, commentaires: 1, partages: 3, portee: 8, dureeMoyenneVueSec: 4.5 }, definitions: {} };

  it("produit la ligne de l'appel 6, sans texte ni donnée de personne", () => {
    const l = ligneReleveUsine({ repere, codeVersion: "0042-TB-LI", reseau: "linkedin", compte: "compte-fictif-1", releve });
    expect(l).toEqual({
      commande_id: "cmd-essai-repere-0001", repere: "usine:L1-1", code_version: "0042-TB-LI", reseau: "linkedin", compte: "compte-fictif-1", jour: 3,
      vues: 10, portee: 8, likes: 2, commentaires: 1, partages: 3, dureeMoyenneVueSec: 4.5, source: "zernio", releve_le: "2026-12-13T08:00:00.000Z",
    });
    expect(Object.keys(l!).sort()).not.toContain("texte");
  });

  it("refuse un jour hors 3, 7 ou 30 et une source hors contrat", () => {
    expect(ligneReleveUsine({ repere, codeVersion: "c", reseau: "linkedin", compte: "x", releve: { ...releve, jour: 5 } })).toBeNull();
    expect(ligneReleveUsine({ repere, codeVersion: "c", reseau: "linkedin", compte: "x", releve: { ...releve, source: "buffer" } })).toBeNull();
  });

  it("de bout en bout : la ligne retrouve commande_id et repère", async () => {
    const d = depots();
    await POST(appel(commande()));
    await d.videos.enregistrer(video());
    const p = await d.publications.enregistrer(publication("publiee", { releves: [releve] }));
    const r = (await repereDePublication(p, d))!;
    const l = ligneReleveUsine({ repere: r, codeVersion: "0042-TB-LI", reseau: p.reseau, compte: "compte-fictif-1", releve: p.releves![0] });
    expect(l).toMatchObject({ commande_id: "cmd-essai-repere-0001", repere: "usine:L1-1" });
  });
});
