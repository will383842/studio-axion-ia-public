/** UO-09 : contrôle des formats à chaque lancement (pur, aucun appel réel). */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Doublure du contrôle : identique au vrai, sauf qu'un essai peut le faire lever (le vrai ne lève que sur un réseau inconnu,
// que la fabrication refuse déjà ailleurs).
const doublure = vi.hoisted(() => ({ lever: false }));
vi.mock("@/domaine/formats/controle-lancement", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/domaine/formats/controle-lancement")>();
  return { ...vrai, controlerFormatsAuLancement: (d: Parameters<typeof vrai.controlerFormatsAuLancement>[0]) => { if (doublure.lever) throw new Error("contrôle en panne"); return vrai.controlerFormatsAuLancement(d); } };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const relecture = await import("@/domaine/relecture-assistant");
const actions = await import("@/app/(studio)/nouvelle/[format]/actions");
const { controlerFormatsAuLancement } = await import("@/domaine/formats/controle-lancement");
const { obtenirFormat, inscrireFormat } = await import("@/formats");

import type { Distribution } from "@/domaine/types";

describe("controlerFormatsAuLancement", () => {
  it("face caméra 9:16 vers TikTok, Instagram et LinkedIn : aucune alerte", () => {
    const f = obtenirFormat("facecam");
    expect(f.ratios).toEqual(["9:16"]);
    expect(controlerFormatsAuLancement({ ratios: f.ratios, reseaux: ["tiktok", "instagram", "linkedin"] })).toEqual([]);
  });

  it("un format 16:9 seul vers TikTok : une alerte en français avec son niveau de preuve", () => {
    const alertes = controlerFormatsAuLancement({ ratios: ["16:9"], reseaux: ["tiktok", "linkedin"] });
    expect(alertes).toHaveLength(1);
    expect(alertes[0].reseau).toBe("tiktok");
    expect(alertes[0].niveauPreuve).toBe("table-registre");
    expect(alertes[0].message).toMatch(/TikTok|tiktok/i);
    expect(alertes[0].message).toMatch(/format/i);
  });

  it("hypothèse : « à vérifier », jamais un refus", () => {
    const hyp = controlerFormatsAuLancement({ ratios: ["1:1"], reseaux: ["tiktok"], type: "carrousel" });
    expect(hyp).toHaveLength(1);
    expect(hyp[0].niveauPreuve).toBe("hypothese");
    expect(hyp[0].message).toMatch(/à vérifier/i);
    expect(hyp[0].message).not.toMatch(/refus/i);
  });

  it("Facebook en vidéo sans ratio que Facebook prenne : « décision en attente », à vérifier, aucun refus", () => {
    // Facebook prend les quatre ratios connus en vidéo : seul un format sans aucun ratio ne s'y rattache pas.
    const fb = controlerFormatsAuLancement({ ratios: [], reseaux: ["facebook"] });
    expect(fb).toHaveLength(1);
    expect(fb[0].reseau).toBe("facebook");
    expect(fb[0].niveauPreuve).toBe("decision-en-attente");
    expect(fb[0].message).toMatch(/à vérifier/i);
    expect(fb[0].message).not.toMatch(/refus/i);
  });

  it("aucun réseau : pas d'alerte inventée, pas d'erreur", () => {
    expect(controlerFormatsAuLancement({ ratios: ["9:16"], reseaux: [] })).toEqual([]);
  });

  it("ratios vides : rien ne convient, une alerte par réseau (jamais d'erreur ni de doublon)", () => {
    const a = controlerFormatsAuLancement({ ratios: [], reseaux: ["tiktok", "tiktok", "instagram"] });
    expect(a.map((x) => x.reseau)).toEqual(["tiktok", "instagram"]);
    for (const x of a) expect(x.message).toMatch(/format/i);
  });

  it("les formats réels : chaque format actif donne au plus une alerte par réseau, sans exception", () => {
    for (const nom of ["facecam", "avocat", "podcast", "tutoriel-outil"]) {
      const f = obtenirFormat(nom);
      const a = controlerFormatsAuLancement({ ratios: f.ratios, reseaux: f.reseauxConseilles });
      expect(new Set(a.map((x) => x.reseau)).size).toBe(a.length);
    }
  });
});

describe("lancerFabricationAction : alertesFormat", () => {
  const MDP_TEST = "essai-controle-lancement";
  const DOUBLE: Distribution[] = [{ role: "Face caméra", personnageId: "p-will", source: "double", visageId: "vis-will-face", voixId: "voix-will" }];
  const avocat = obtenirFormat("avocat");
  // Formats d'essai : mêmes étapes que l'avocat, seuls ratios et réseaux changent (le catalogue réel n'en produit aucune).
  inscrireFormat({ ...avocat, id: "avocat-alerte", ratios: ["16:9"], ratioMaitre: "16:9", reseauxConseilles: ["tiktok"] });
  inscrireFormat({ ...avocat, id: "avocat-conforme", ratios: ["9:16"], ratioMaitre: "9:16", reseauxConseilles: ["tiktok"] });

  beforeAll(async () => {
    process.env.SESSION_SECRET = "c".repeat(48);
    const e = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    credits.injecterLecteursPourEssai(null);
    await auth.seConnecter(MDP_TEST, false);
  });
  afterEach(() => { credits.injecterLecteursPourEssai(null); doublure.lever = false; });

  async function lancerAvec(formatId: string) {
    await depots().videos.modifier("v-03", { formatId, distribution: DOUBLE });
    const v = await depots().videos.obtenir("v-03");
    const blocs = (await depots().scripts.obtenir(v!.scriptId!))!.blocs;
    return actions.lancerFabricationAction("v-03", true, relecture.empreinteDesBlocs(blocs));
  }

  it("le format produit une alerte : la vidéo part ET alertesFormat est rendu", async () => {
    const r = await lancerAvec("avocat-alerte");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees.travailId).toBeTruthy();
    expect(r.donnees.alertesFormat).toHaveLength(1);
    expect(r.donnees.alertesFormat![0].reseau).toBe("tiktok");
  });

  it("aucune alerte : le champ alertesFormat est absent", async () => {
    const r = await lancerAvec("avocat-conforme");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect("alertesFormat" in r.donnees).toBe(false);
  });

  it("le contrôle qui lève ne fait pas croire à un échec : la vidéo est partie, sans alerte", async () => {
    doublure.lever = true;
    const r = await lancerAvec("avocat-alerte");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.donnees.travailId).toBeTruthy();
    expect("alertesFormat" in r.donnees).toBe(false);
  });
});
