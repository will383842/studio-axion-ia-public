/**
 * FIX-CC-FIN-CHOIX-b3 · le fil complet de la fin « rendez-vous » choisie (`finDemandee`) : lancement → entrées figées → prix →
 * fabrication → retouche. Absente : tout est identique à avant (éteint par défaut). Doubles seulement, aucun appel réel, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";
import { VOIX_MAITRE_HEYGEN_ID } from "@/briques/voix-maitre";
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
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import { fournisseurVoixSimulation } from "@/fournisseurs/simulation/autres";
import { creerMoteurMontageCasConcret } from "@/moteurs/montage-cas-concret";
import { CODE_SCRIPT_A_VALIDER } from "@/moteurs/montage-cas-concret/script-valide";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";
import { banc } from "../moteur/doubles";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, OperationMontage, ParentRetouche, ResultatFabrication } from "@/moteurs/types";
import { estimerRetoucheCasConcret } from "@/moteurs/montage-cas-concret";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
// Le studio est en budget « indicatif » (le prix n'y bloque jamais : `accordAutomatique` relève l'accord au montant). Pour prouver que
// le lancement exige bien le montant de la feuille, on rend le comportement du mode bloquant / de l'Usine : l'accord est rendu inchangé.
vi.mock("@/services/mode-budget", async (original) => ({ ...(await original<typeof import("@/services/mode-budget")>()), accordAutomatique: async (accord: unknown) => accord }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const branchements = await import("@/services/cas-concret-branchements");
const scripts = await import("@/services/cas-concret-scripts");
await import("@/services/videos");

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

describe("(b bis) aperçu = fabrication, par le chemin réel (moteur → aperçu du script → valider → voix)", () => {
  const MDP_B = "cas-concret-fin-choisie-apercu";
  const VIDEO = "v-03";
  beforeAll(async () => {
    process.env.SESSION_SECRET = "t".repeat(48);
    const e = await hash(MDP_B, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP_B, false);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("Aucun appel réseau dans ces tests.");
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("`apercuScriptCasConcret(video).fins[0].dit` est mot pour mot le texte que la voix lit pour la fin", { timeout: 60_000 }, async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const executer: DependancesBranchementsCasConcret["executer"] = async (_v, role: DefinitionRole, entree: EntreeRole) => {
      const sortie = role.simuler?.(entree);
      return { ok: true, simule: true, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie) };
    };
    let t = 0;
    const rendu = { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => branchements.outilsCasConcret(c, travailId, { numeroVersion: async () => 42, rendu, attendre: async () => {}, executer, claudeActif: async () => false }) });
    const c = {
      versionContrat: 2, moteurId: "montage-cas-concret", videoId: VIDEO, formatId: "cas-concret", versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: 50, ratios: ["9:16"],
      script: { blocs: [], texteComplet: "" },
      distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
      styles: { sousTitres: null, decor: null, lut: null, musique: null },
      briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
      entrees: { casConcret: { casId: "contact-vers-crm", porte: "porte-a", mot: "CRM", avecMot: false, motSur: [], reseaux: ["facebook"], essai: true, codeSuivi: "cc-contact-vers-crm-abc123", finDemandee: "rendez-vous" } },
      reglages: {}, plans: [], prononciations: [],
      mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
      budgetMax: { centimes: 0, devise: "EUR" }, construiteLe: "2026-10-14T09:00:00.000Z",
    } as unknown as CommandeFabrication;
    const aller = async (depart?: Travail) => {
      let tr = depart ?? (await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never));
      for (let i = 0; i < 400 && tr.statut !== "termine" && tr.statut !== "echec"; i++) tr = (await moteur.avancer(tr, c)).travail;
      return tr;
    };
    const arrete = await aller();
    expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER });
    const d = depots();
    const video = (await d.videos.obtenir(VIDEO))!;
    await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
    await d.versions.modifier(video.versionChoisieId!, { commande: c, travailId: arrete.id, numero: 99 });
    await d.travaux.enregistrer({ ...arrete, cibleId: VIDEO, versionId: video.versionChoisieId! });

    const apercu = (await scripts.apercuScriptCasConcret(VIDEO))!;
    expect(apercu.fins).toHaveLength(1);
    expect(apercu.fins[0]!.dit).toBe(DIT_FB);

    await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 10, 18) });
    const fini = await aller(await moteur.reessayer(arrete));
    expect(fini.statut).toBe("termine");
    // Lectures payées : le corps, puis la fin rendez-vous (la 2ᵉ lecture, comme `d.lus[1]` des doubles) = le texte de l'aperçu.
    const lus = lire.mock.calls.map((x) => String(x[0].texte));
    expect(lus).toHaveLength(2);
    expect(lus[1]).toBe(apercu.fins[0]!.dit);
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

  const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
  const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
  async function avancerJusqua(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
    let t = depart;
    let resultat: ResultatFabrication | undefined;
    for (let n = 0; n < 200; n++) {
      const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
      t = r.travail;
      resultat = r.resultat ?? resultat;
      if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
    }
    throw new Error(`Bloqué (${t.statut}).`);
  }
  /** Fabrique une vidéo (avec ou sans la fin rendez-vous), puis retouche une phrase du corps : lectures payées avant / pendant la retouche. */
  async function retoucherLeCorps(rdv: boolean) {
    const b = banc({ reseaux: ["facebook"], avecMot: false, motSur: [], retouches: true });
    if (rdv) b.d.options.entrees = { ...b.d.options.entrees, finDemandee: "rendez-vous" };
    const c = b.commande();
    const fab = await avancerJusqua(b.moteur, c, await b.moteur.lancer(c, ctx("t-1")));
    expect(fab.travail.statut).toBe("termine");
    const lusFabrication = b.d.lus.length;
    const parent: ParentRetouche = { versionId: "ver-t-1", projetMontage: JSON.parse(JSON.stringify(fab.resultat!.projetMontage)), pistes: [] };
    const operation = [{ type: "changer-phrase", ecranId: "e06", avant: "notre annonce", apres: "notre petite annonce" }] as unknown as OperationMontage[];
    const { apercu, refus } = estimerRetoucheCasConcret(c, operation, parent);
    expect(refus).toBeNull();
    const fin = await avancerJusqua(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-2"), planIds: [], consigne: "Phrase", operations: operation, parent }));
    expect(fin.travail.statut).toBe("termine");
    return { lusFabrication, lusRetouche: b.d.lus.slice(lusFabrication), finsRelues: apercu?.finsRelues };
  }
  it("une vidéo rendez-vous retouchée au corps : aucune relecture de fin de plus que sans la fin (le corps seul)", async () => {
    const sans = await retoucherLeCorps(false);
    const avec = await retoucherLeCorps(true);
    // La vidéo rendez-vous a bien une fin lue à la fabrication (corps + fin) ; la vidéo sans la fin, le corps seul.
    expect(sans.lusFabrication).toBe(1);
    expect(avec.lusFabrication).toBe(2);
    // Retouche du corps : une seule lecture (le corps), dans les deux cas ; la fin rendez-vous est reprise, pas relue.
    expect(sans.lusRetouche).toHaveLength(1);
    expect(avec.lusRetouche).toHaveLength(1);
    expect(avec.lusRetouche[0]).toContain("notre petite annonce");
    expect(avec.lusRetouche).not.toContain(DIT_FB);
    expect(avec.finsRelues).toEqual(sans.finsRelues);
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
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret", fournisseur: "heygen" });
    await d.ressourcesFournisseurs.enregistrer({ ...(await d.ressourcesFournisseurs.obtenir("rf-3"))!, id: "rf-avocat-test", entiteId: "voix-avocat-test", fournisseur: "heygen", idExterne: VOIX_MAITRE_HEYGEN_ID });
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
  it("la feuille et le lancement annoncent le même total : accord = feuille → lancée, accord − 1 centime → refus", { timeout: 60_000 }, async () => {
    // « Avec le mot » décoché : la fin rendez-vous s'applique sur les 4 réseaux (mot branché sur les 4 = elle ne pourrait pas s'appliquer).
    await service.confirmerCas("recrutement-apporteurs");
    const feuille = await service.estimerCas("recrutement-apporteurs", TOUS, false, { mot: "IA", finDemandee: "rendez-vous" });
    const sans = await service.estimerCas("recrutement-apporteurs", TOUS, false, { mot: "IA" });
    expect(feuille.centimes).toBeGreaterThan(sans.centimes);
    const base = { casId: "recrutement-apporteurs", reseaux: TOUS, mot: "IA", avecMot: false, empreinteScriptRelu: RELU_RECRUTEMENT, finDemandee: "rendez-vous" as const };

    // Un centime de moins que la feuille : le lancement redemande l'accord, rien n'est lancé.
    const lancerRefus = vi.fn(async () => ({ travailId: "t-refus" }));
    const refus = await service.preparerEtLancer({ ...base, accordCentimes: feuille.centimes - 1 }, { lancer: lancerRefus });
    expect(refus.statut).not.toBe("lancee");
    expect(lancerRefus).not.toHaveBeenCalled();
    if (refus.statut === "accord-requis") expect(refus.centimes).toBe(feuille.centimes);

    // L'accord = la feuille : la vidéo est lancée.
    reinitialiserDepots();
    await beforeEachRelance();
    const lancerOk = vi.fn(async () => ({ travailId: "t-ok" }));
    const ok = await service.preparerEtLancer({ ...base, accordCentimes: feuille.centimes }, { lancer: lancerOk });
    expect(ok.statut).toBe("lancee");
    expect(lancerOk).toHaveBeenCalledTimes(1);
  });
  async function beforeEachRelance() {
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret", fournisseur: "heygen" });
    await d.ressourcesFournisseurs.enregistrer({ ...(await d.ressourcesFournisseurs.obtenir("rf-3"))!, id: "rf-avocat-test", entiteId: "voix-avocat-test", fournisseur: "heygen", idExterne: VOIX_MAITRE_HEYGEN_ID });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  }
});
