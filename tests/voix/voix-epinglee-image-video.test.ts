/** L1-05 PR 3 : voix épinglée de l'image → vidéo (une vidéo, un lot, le lanceur). Doubles seulement : rien n'est dépensé. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../image-video/doubles-fabrication";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
// Fournisseurs pilotés par le test : seule la voix change de mode d'un cas à l'autre (stockage et rendu toujours « reliés »).
const etatFournisseurs = vi.hoisted(() => ({ modeVoix: "simulation" as "simulation" | "reel" }));
const doubles = vi.hoisted(() => {
  const compte = { depot: 0, lecture: 0 };
  const stockage = {
    type: "stockage", id: "r2-double", mode: "reel", capacites: {},
    preparerDepot: async () => { compte.depot++; return { cleStockage: "k", urlDepot: "u" }; },
    confirmerDepot: async () => { compte.depot++; return { ok: true }; },
    urlLecture: async () => "https://stockage.test/lecture",
    urlLectureDuree: async () => "https://stockage.test/lecture",
    urlDepotDuree: async () => { compte.depot++; return "https://stockage.test/depot"; },
  };
  const lire = async () => { compte.lecture++; throw new Error("la voix ne doit pas être lue"); };
  return { compte, stockage, lire };
});
vi.mock("@/fournisseurs", async (orig) => ({
  ...(await orig<typeof import("@/fournisseurs")>()),
  resoudreFournisseur: (type: string) => {
    if (type === "stockage") return doubles.stockage;
    if (type === "voix") return { type: "voix", id: "heygen", mode: etatFournisseurs.modeVoix, capacites: { audioSeul: true, horodatageMots: true }, lire: doubles.lire };
    return { type, id: `${type}-double`, mode: "reel", capacites: {} };
  },
}));
vi.mock("@/fournisseurs/rendu/client", async (orig) => ({
  ...(await orig<typeof import("@/fournisseurs/rendu/client")>()),
  obtenirServiceRendu: () => ({ soumettre: async () => ({ idRendu: "r" }), etat: async () => ({ statut: "inconnu" }) }),
  renduSimule: () => false,
}));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { VOIX_MAITRE_HEYGEN_ID, exigerVoixMaitre } = await import("@/briques/voix-maitre");
const { VOIX_IV } = await import("@/moteurs/montage-image-video/voix");
const { attendWillIV, avancerJusquAArretIV, etatInitialIV, validerCarteIV, validerScriptIV } = await import("@/moteurs/montage-image-video/fabrication");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const { outilsImageVideo, STUDIO_NON_RELIE_IV } = await import("@/services/image-video");

beforeEach(() => {
  reinitialiserDepots();
  etatFournisseurs.modeVoix = "simulation";
  doubles.compte.depot = 0;
  doubles.compte.lecture = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("image → vidéo : la voix du format est la voix maître HeyGen", () => {
  it("la constante du format passe le contrôle commun, et vaut la voix maître", () => {
    expect(VOIX_IV.fournisseur).toBe("heygen");
    expect(VOIX_IV.idVoix).toBe(VOIX_MAITRE_HEYGEN_ID);
    expect(() => exigerVoixMaitre(VOIX_IV.fournisseur, VOIX_IV.idVoix)).not.toThrow();
  });

  it("une vidéo : toute lecture payante part avec la voix maître (jamais un autre identifiant)", async () => {
    const carte = carteFixe("C");
    const m = monde();
    const o = outilsSimules(carte, m);
    const lire = vi.spyOn(o.voix.voix(), "lire");
    const reserver = vi.spyOn(o.budget, "reserver");
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { videoId: "v-iv-voix" })), o);
    // Les deux portes de Will franchies : la voix est alors lue pour de bon (doublure, rien n'est payé).
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
      if (e.attente) e = await avancerJusquAArretIV(e, o);
      else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" }), o);
      else if (attendWillIV(e) === "script") {
        const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
        e = await avancerJusquAArretIV(validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules }), o);
      } else break;
    }
    expect(lire.mock.calls.length).toBeGreaterThan(0);
    for (const [demande] of lire.mock.calls) expect(demande.idExterne).toBe(VOIX_MAITRE_HEYGEN_ID);
    // Le fournisseur de la voix est HeyGen : toute réservation de voix est faite au nom de HeyGen (jamais un autre).
    const reservationsVoix = reserver.mock.calls.filter(([d]) => d.etape === "voix");
    expect(reservationsVoix.length).toBeGreaterThan(0);
    for (const [d] of reservationsVoix) expect(d.fournisseur).toBe("heygen");
  });
});

describe("image → vidéo : voix simulée en production refusée avant toute dépense", () => {
  // Stockage et rendu sont reliés (doubles) : SEULE la voix est simulée, donc seule elle peut provoquer le refus.
  const cas: [string, Parameters<typeof outilsImageVideo>[0]][] = [
    ["une vidéo", { videoId: "v1", travailId: "t1", production: true }],
    ["une vidéo d'un lot", { videoId: "v2", travailId: "t2", production: true, accordLotCentimes: 220 }],
    ["le lanceur", { videoId: "v3", travailId: "t3", production: true, accordDuScriptExige: true }],
  ];
  const demandeVoix = { appelId: "a1", videoId: "x", etape: "voix", fournisseur: "heygen", centimes: 150, caracteres: 1200 } as const;

  it.each(cas)("%s : STUDIO_NON_RELIE_IV (rien n'a été dépensé), ni réservation, ni lecture, ni dépôt", async (_nom, dep) => {
    const reserver = vi.spyOn(credits, "verifierEtReserver");
    const verifier = vi.spyOn(credits, "verifierBudgetEtCredits");
    const avant = { ...doubles.compte };
    const erreur = await outilsImageVideo(dep).then(() => null, (e: Error) => e);
    expect(erreur?.message).toBe(STUDIO_NON_RELIE_IV);
    expect(STUDIO_NON_RELIE_IV).toMatch(/rien n'a été dépensé/);
    expect(reserver).not.toHaveBeenCalled();
    expect(verifier).not.toHaveBeenCalled();
    expect(doubles.compte).toEqual(avant);
  });

  it("la voix seule en cause : la même demande, voix HeyGen reliée, n'est plus refusée", async () => {
    etatFournisseurs.modeVoix = "reel";
    await expect(outilsImageVideo({ videoId: "v1", travailId: "t1", production: true })).resolves.toBeDefined();
  });

  it("hors production, la voix simulée ne réserve rien (la dépense serait là, et elle ne part pas)", async () => {
    const reserver = vi.spyOn(credits, "verifierEtReserver");
    const outils = await outilsImageVideo({ videoId: "v1", travailId: "t1", production: false });
    expect(await outils.budget.reserver({ ...demandeVoix })).toEqual({ ok: true });
    expect(reserver).not.toHaveBeenCalled();
    expect(doubles.compte.lecture).toBe(0);
  });

  describe("tout relié (voix HeyGen reliée) : pas de refus, la réservation part là où elle doit", () => {
    beforeEach(() => { etatFournisseurs.modeVoix = "reel"; });

    it("une vidéo : réserve le prix de la voix, au nom de la vidéo et du travail", async () => {
      const reserver = vi.spyOn(credits, "verifierEtReserver").mockResolvedValue(undefined as never);
      const outils = await outilsImageVideo({ videoId: "v1", travailId: "t1", production: true });
      expect(await outils.budget.reserver({ ...demandeVoix })).toEqual({ ok: true });
      expect(reserver).toHaveBeenCalledTimes(1);
      expect(reserver.mock.calls[0][1]).toBe(150);
      expect(reserver.mock.calls[0][3]).toEqual({ videoId: "v1", travailId: "t1" });
    });

    it("une vidéo d'un lot : réserve au prix accordé pour le lot", async () => {
      const reserver = vi.spyOn(credits, "verifierEtReserver").mockResolvedValue(undefined as never);
      const outils = await outilsImageVideo({ videoId: "v2", travailId: "t2", production: true, accordLotCentimes: 220 });
      expect(await outils.budget.reserver({ ...demandeVoix })).toEqual({ ok: true });
      expect(reserver).toHaveBeenCalledTimes(1);
      expect(reserver.mock.calls[0][1]).toBe(220);
    });

    it("le lanceur : sans accord de Will sur le prix, aucune réservation", async () => {
      const reserver = vi.spyOn(credits, "verifierEtReserver").mockResolvedValue(undefined as never);
      const outils = await outilsImageVideo({ videoId: "v3", travailId: "t3", production: true, accordDuScriptExige: true });
      const r = await outils.budget.reserver({ ...demandeVoix });
      expect(r).toEqual({ ok: false, message: expect.stringMatching(/pas été accordé/) });
      expect(reserver).not.toHaveBeenCalled();
    });
  });
});
