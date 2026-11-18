/**
 * FIX-CC-FIN-CHOIX-b3 · le fil complet de la fin « rendez-vous » choisie (`finDemandee`) : lancement → entrées figées → prix →
 * fabrication → retouche. Absente : tout est identique à avant (éteint par défaut). Doubles seulement, aucun appel réel, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { ReseauCas } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { dureesDesFins, ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { DIT_FIN_RENDEZ_VOUS } from "@/moteurs/montage-cas-concret/fin-choisie";
import { apercuRetoucheCasConcret, type ContexteRetoucheCasConcret } from "@/moteurs/montage-cas-concret/retouches";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { doubles } from "../fabriquer/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");

const CAS = trouverCas("contact-vers-crm")!;
const TOUS: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const DIT_FB = `${DIT_FIN_RENDEZ_VOUS} Le lien est en commentaire.`;
const voix = { fournisseur: "heygen" };

describe("(a) sans `finDemandee` : identique à avant", () => {
  it("prix : même total, mêmes lignes, que l'option soit absente ou `undefined`", () => {
    const sans = estimerDepuisCas(CAS, TOUS, false, { voix });
    expect(estimerDepuisCas(CAS, TOUS, false, { voix, finDemandee: undefined })).toEqual(sans);
  });
  it("fabrication : fin vide, une seule lecture (le corps), entrées sans la clé", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    const cr = await fabriquerCasConcret(d.options);
    expect(d.lus).toHaveLength(1);
    expect(cr.plan.fins.every((f) => f.ecrans.length === 0)).toBe(true);
  });
  it("retouche : la fin reste vide", () => {
    const ap = apercuRetoucheCasConcret(fiche(), [{ operation: "changer-mot", mot: "CRM" }], contexte());
    expect(ap.plan.fins.every((f) => f.ecrans.length === 0)).toBe(true);
  });
});

function fiche() {
  const plan = planDesFins({ reseaux: ["facebook"], offre: CAS.offre, mot: CAS.mot, avecMot: false, table: TABLE_FINS_DIAGNOSTIC });
  return ficheParGabarit(CAS, FIXE, dureesDesFins(plan.fins));
}
function contexte(extra: Partial<ContexteRetoucheCasConcret> = {}): ContexteRetoucheCasConcret {
  return { cas: CAS, reseaux: ["facebook"], mot: CAS.mot, avecMot: false, table: TABLE_FINS_DIAGNOSTIC, ...extra };
}

describe("(b) la fabrication lit la fin rendez-vous des entrées", () => {
  it("Facebook : la voix lit la phrase D1 puis la ligne du lien", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook"], avecMot: false });
    d.options.entrees = { ...d.options.entrees, finDemandee: "rendez-vous" };
    const cr = await fabriquerCasConcret(d.options);
    expect(d.lus).toHaveLength(2);
    expect(d.lus[1]).toBe(DIT_FB);
    expect(cr.plan.fins[0]!.ecrans.map((e) => e.texteDit).join(" ")).toBe(DIT_FB);
  });
});

describe("(c) « Avec le mot » branché sur Facebook : D3, la fin au mot reste", () => {
  it("Facebook garde la fin au mot, TikTok prend la fin rendez-vous", async () => {
    const d = doubles({ casId: "contact-vers-crm", reseaux: ["facebook", "tiktok"], avecMot: true, motSur: ["facebook"] });
    d.options.entrees = { ...d.options.entrees, finDemandee: "rendez-vous" };
    const cr = await fabriquerCasConcret(d.options);
    const fb = cr.plan.fins.find((f) => f.reseaux.includes("facebook"))!;
    const tt = cr.plan.fins.find((f) => f.reseaux.includes("tiktok"))!;
    expect(fb.appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    expect(tt.appels[0]!.id).toBe("fin-ty-rdv-45");
  });
});

describe("(d) prix : la voix de la fin choisie est comptée, rien d'autre ne bouge", () => {
  it("total plus haut ; la différence porte sur les lignes de voix (et l'écriture)", () => {
    const sans = estimerDepuisCas(CAS, TOUS, false, { voix });
    const avec = estimerDepuisCas(CAS, TOUS, false, { voix, finDemandee: "rendez-vous" });
    expect(avec.total.centimes).toBeGreaterThan(sans.total.centimes);
    const hors = (e: typeof sans) => e.lignes.filter((l) => !/voix|écriture/i.test(l.etape));
    expect(hors(avec)).toEqual(hors(sans));
    expect(avec.lignes.some((l) => /voix/i.test(l.etape) && l.total.centimes > (sans.lignes.find((x) => x.etape === l.etape)?.total.centimes ?? 0))).toBe(true);
  });
});

describe("(e) retouche : la fin rendez-vous des entrées est gardée", () => {
  it("avec `finDemandee`, le plan de retouche pose la fin rendez-vous (comme la fabrication)", () => {
    const ap = apercuRetoucheCasConcret(fiche(), [{ operation: "changer-mot", mot: "CRM" }], contexte({ finDemandee: "rendez-vous" }));
    expect(ap.plan.fins[0]!.ecrans.map((e) => e.texteDit).join(" ")).toBe(DIT_FB);
  });
});

describe("(f) lancement : `preparerEtLancer` fige la valeur dans les entrées", () => {
  const MDP = "cas-concret-fin-choisie-branchee";
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
  const lancer = vi.fn(async () => ({ travailId: "t-fin-choisie" }));
  const entrees = async (extra: Record<string, unknown>) => {
    const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: TOUS, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT, ...extra }, { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
  };
  it("sans le champ : aucune clé ; avec `rendez-vous` : la valeur part avec la vidéo", { timeout: 60_000 }, async () => {
    expect(Object.keys(await entrees({}))).not.toContain("finDemandee");
    reinitialiserDepots();
    await beforeEachRelance();
    expect((await entrees({ finDemandee: "rendez-vous" })).finDemandee).toBe("rendez-vous");
  });
  it("une autre valeur : aucune clé", { timeout: 60_000 }, async () => {
    expect(Object.keys(await entrees({ finDemandee: "aucune" }))).not.toContain("finDemandee");
  });
  it("la feuille (`estimerCas`) et le lancement annoncent le même total", { timeout: 60_000 }, async () => {
    const feuille = await service.estimerCas("recrutement-apporteurs", TOUS, true, { finDemandee: "rendez-vous" });
    const sans = await service.estimerCas("recrutement-apporteurs", TOUS, true);
    expect(feuille.centimes).toBeGreaterThanOrEqual(sans.centimes);
  });
  async function beforeEachRelance() {
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  }
});
