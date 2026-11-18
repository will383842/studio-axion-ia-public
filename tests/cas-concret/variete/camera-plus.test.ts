/**
 * C8-Z04 · réglage `casConcret.cameraPlus` : plafond de la caméra du cas concret jusqu'à 1,048. Éteint (absent, ou hors
 * ]1,035 ; 1,048]) : aucun champ, tirage et jeu identiques, habillage borné à 1,035. Aucun appel, rien de payé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import { disposer, proprietesEcrans, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import { CAMERA_PLUS_MAX, jeuDeLEcran, lireCameraPlus, schemaTirage, tirer, type Mise, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { DERIVE_MAX_PX, ECHELLE_CAMERA_MAX, ECHELLE_CAMERA_PLUS_MAX, planHabillage } from "../../../studio-rendu/compositions/cas-concret/plans/habillage";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "cas-concret-camera-plus";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const ids = Array.from({ length: 20 }, (_, i) => `video-camera-${i}`);
const sansCameraPlus = (t: Tirage): Omit<Tirage, "cameraPlus"> => {
  const { cameraPlus: _c, ...reste } = t;
  void _c;
  return reste;
};

describe("lireCameraPlus", () => {
  it("éteint : absent, texte, NaN, 1 et 1,035", () => {
    for (const v of [undefined, null, "1.045", Number.NaN, Number.POSITIVE_INFINITY, 1, 1.035, 0.5]) expect(lireCameraPlus(v)).toBeUndefined();
  });
  it("allumé : valeur arrondie au millième, bornée à 1,048", () => {
    expect(lireCameraPlus(1.04)).toBe(1.04);
    expect(lireCameraPlus(1.0454)).toBe(1.045);
    expect(lireCameraPlus(1.2)).toBe(1.048);
    expect(lireCameraPlus(1.048)).toBe(1.048);
  });
});

describe("tirage", () => {
  it("sans cameraPlus : identique, aucune clé", () => {
    for (const videoId of ids) {
      const a = tirer({ videoId, canaux: RESEAUX, historique: [] });
      const b = tirer({ videoId, canaux: RESEAUX, historique: [], cameraPlus: undefined });
      expect(b).toEqual(a);
      expect(Object.keys(b)).not.toContain("cameraPlus");
    }
  });
  it("avec 1,045 : même tirage, seule la clé cameraPlus s'ajoute", () => {
    for (const videoId of ids) {
      const a = tirer({ videoId, canaux: RESEAUX, historique: [] });
      const b = tirer({ videoId, canaux: RESEAUX, historique: [], cameraPlus: 1.045 });
      expect(b.cameraPlus).toBe(1.045);
      expect(sansCameraPlus(b)).toEqual(a);
    }
  });
  it("un tirage à essais minimaux porte aussi le champ", () => {
    const t = tirer({ videoId: ids[0]!, canaux: RESEAUX, historique: [], cameraPlus: 1.045, essaisParNiveau: 0 });
    expect(schemaTirage.parse(t).cameraPlus).toBe(1.045);
  });
  it("schemaTirage : ancien tirage accepté, 1,045 accepté, 1,2 refusé", () => {
    const t = tirer({ videoId: ids[1]!, canaux: RESEAUX, historique: [] });
    expect(schemaTirage.parse(t)).toEqual(t);
    expect(schemaTirage.parse({ ...t, cameraPlus: 1.045 }).cameraPlus).toBe(1.045);
    expect(() => schemaTirage.parse({ ...t, cameraPlus: 1.2 })).toThrow();
  });
});

describe("jeuDeLEcran", () => {
  const ecrans = { a: { camera: "zoom-lent", entree: "glissement" }, b: { entree: "glissement" } } as unknown as Mise["ecrans"];
  const mise = (tirage: { habille?: true; cameraPlus?: number }) => ({ ecrans, tirage });
  it("sans cameraPlus : jeu identique à avant", () => {
    expect(jeuDeLEcran(mise({ habille: true }), "a")).toEqual({ camera: "zoom-lent", entree: "glissement" });
    expect(jeuDeLEcran(mise({ habille: true }), "b")).toEqual({ entree: "glissement" });
  });
  it("avec cameraPlus : cameraMax seulement sur un écran qui a une caméra, jamais sans habille", () => {
    expect(jeuDeLEcran(mise({ habille: true, cameraPlus: 1.045 }), "a")).toEqual({ camera: "zoom-lent", entree: "glissement", cameraMax: 1.045 });
    expect(jeuDeLEcran(mise({ habille: true, cameraPlus: 1.045 }), "b")).toEqual({ entree: "glissement" });
    expect(jeuDeLEcran(mise({ cameraPlus: 1.045 }), "a")).toBeUndefined();
  });
});

describe("planHabillage", () => {
  const MOUVEMENTS = ["zoom-lent", "derive-laterale", "punch-in", "zoom-arriere"];
  const plan = (jeu: Record<string, string | number>, t: number) => planHabillage({ jeu, debutMs: 1000 } as Pick<ProprietesEcran, "jeu" | "debutMs">, t, 3);
  it("sans cameraMax : valeurs identiques (plafond 1,035)", () => {
    for (const camera of MOUVEMENTS) for (let i = 0; i <= 29; i++) {
      const t = (3 * i) / 29;
      expect(plan({ camera }, t)).toEqual(plan({ camera, cameraMax: Number.NaN }, t));
      expect(plan({ camera }, t).camera!.echelle).toBeLessThanOrEqual(ECHELLE_CAMERA_MAX + 1e-12);
    }
  });
  it("cameraMax 1,048 : atteint 1,048, jamais au-delà, même avec zoom-avant", () => {
    expect(plan({ camera: "zoom-lent", cameraMax: 1.048 }, 3).camera!.echelle).toBeCloseTo(1.048, 9);
    for (const camera of MOUVEMENTS) for (const entree of ["", "zoom-avant"]) for (let i = 0; i <= 29; i++) {
      const h = plan({ camera, entree, cameraMax: 1.048 }, (3 * i) / 29);
      expect(h.camera!.echelle).toBeLessThanOrEqual(1.048 + 1e-12);
      expect(h.echelle * h.camera!.echelle).toBeLessThanOrEqual(1.048 + 1e-12);
    }
  });
  it("bornes : 2 devient 1,048, 1 devient 1,035", () => {
    expect(plan({ camera: "zoom-lent", cameraMax: 2 }, 3).camera!.echelle).toBeCloseTo(1.048, 9);
    expect(plan({ camera: "zoom-lent", cameraMax: 1 }, 3).camera!.echelle).toBeCloseTo(1.035, 9);
  });
  it("la constante du rendu égale celle du moteur", () => {
    expect(ECHELLE_CAMERA_PLUS_MAX).toBe(CAMERA_PLUS_MAX);
  });
});

describe("garde-fou du cadre à l'échelle du plafond haut (1,048 : mesuré, 1,049 ne passe plus)", () => {
  it("textes dans le cadre et au-dessus de la bande des sous-titres", () => {
    const pleins = (): ProprietesEcran[] => {
      const cales = exemplesEcrans().map((p) => {
        const { zone: _z, dessin: _d, largeur: _l, hauteur: _h, fps: _f, marque: _m, ...reste } = p;
        void [_z, _d, _l, _h, _f, _m];
        return reste as unknown as EcranCale;
      });
      return proprietesEcrans({ ecrans: cales, captures: {}, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET });
    };
    const bandeHaut = 1920 * (1 - BANDE_SOUS_TITRES_CAS_CONCRET);
    let mesures = 0;
    for (const p of pleins()) {
      if (p.type === "liste-avant") continue;
      const cx = p.zone.x + p.zone.largeur / 2;
      const cy = p.zone.y + p.zone.hauteur / 2;
      for (const t of disposer(p).textes) {
        const b = t.boite;
        const s = CAMERA_PLUS_MAX;
        expect(cx + (b.x - cx) * s - DERIVE_MAX_PX, `${p.type}/${t.nom} gauche`).toBeGreaterThanOrEqual(0);
        expect(cx + (b.x + b.largeur - cx) * s + DERIVE_MAX_PX, `${p.type}/${t.nom} droite`).toBeLessThanOrEqual(p.largeur);
        expect(cy + (b.y + b.hauteur - cy) * s, `${p.type}/${t.nom} bas`).toBeLessThanOrEqual(bandeHaut);
        mesures++;
      }
    }
    expect(mesures).toBeGreaterThan(20);
  });
});

describe("entrées et service", { timeout: 30_000 }, () => {
  it("lireEntreesCasConcret : lit cameraPlus, sinon identique", () => {
    const base = { porte: "porte-a", reseaux: ["tiktok"] };
    expect(lireEntreesCasConcret({ casConcret: { ...base, cameraPlus: 1.045 } } as never).cameraPlus).toBe(1.045);
    const sans = lireEntreesCasConcret({ casConcret: base } as never);
    expect(Object.keys(sans)).not.toContain("cameraPlus");
    expect(lireEntreesCasConcret({ casConcret: { ...base, cameraPlus: "1.045" } } as never)).toEqual(sans);
    expect(lireEntreesCasConcret({ casConcret: { ...base, cameraPlus: 1.035 } } as never)).toEqual(sans);
  });

  beforeAll(async () => {
    process.env.SESSION_SECRET = "t".repeat(48);
    const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  });
  const lancer = vi.fn(async () => ({ travailId: "t-camera-plus" }));
  const entreesEcrites = async (): Promise<Record<string, unknown>> => {
    const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
  };
// ALLUME-VAGUE-A-CODE 18/11/2026 : défaut du code allumé (autorisation de Williams 17/11 22:25) ; l'éteint se teste désormais avec 1.035 écrit en base.
  it("réglage à 1.035 en base : aucune clé cameraPlus", async () => {
    await ecrireParametre("casConcret.cameraPlus", 1.035);
    expect(Object.keys(await entreesEcrites())).not.toContain("cameraPlus");
  });
  it("réglage absent : cameraPlus 1,048", async () => {
    expect((await entreesEcrites()).cameraPlus).toBe(1.048);
  });
  it("réglage hors plage : aucune clé", async () => {
    await ecrireParametre("casConcret.cameraPlus", 1.02);
    expect(Object.keys(await entreesEcrites())).not.toContain("cameraPlus");
  });
  it("réglage à 1,045 : cameraPlus 1,045", async () => {
    await ecrireParametre("casConcret.cameraPlus", 1.045);
    expect((await entreesEcrites()).cameraPlus).toBe(1.045);
  });
});
