/**
 * X6 · Le mot branché par mot et par compte (précision de l'Usine du 12/10/2026) : lecture du réglage, avertissement
 * « une vidéo sur trois », feuille « Votre vidéo », lancement, et une vidéo refaite avec l'autre fin sans redire ni
 * rendre le corps. Base en mémoire, doubles : aucun service réel, aucun `fetch`.
 */
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const mots = await import("@/services/cas-concret-mots");
const m = await import("@/formats/cas-concret/mots-branches");
const { ContenuVotreVideo } = await import("@/components/formats/cas-concret/entree/FeuilleVotreVideo");
const { versVueCas } = await import("@/components/formats/cas-concret/entree/vue");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { empreinteCas } = await import("@/formats/cas-concret/cas");
const { ficheParGabarit } = await import("@/moteurs/montage-cas-concret/ecriture");
const { fabriquerCasConcret } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { lireEntreesCasConcret } = await import("@/moteurs/montage-cas-concret/etapes");
const { doubles } = await import("../fabriquer/doubles");

import type { ReseauCas } from "@/formats/cas-concret";
import type { Doubles } from "../fabriquer/doubles";
import { RELU_RECRUTEMENT } from "../../helpers/script-relu";

const MDP = "cas-concret-x6";
const LE = "2026-10-12T08:00:00.000Z";
const MAINTENANT = Date.parse("2026-10-12T12:00:00.000Z");
const RESEAUX: ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];

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

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("X6 · motBranchePour (par mot et par compte)", () => {
  it("vide aujourd'hui : rien n'est branché, nulle part", () => {
    for (const r of RESEAUX) expect(m.motBranchePour("IA", r), r).toBe(false);
    expect(m.lireReglageMotsBranches(null)).toEqual({});
  });

  it("IA branché sur Instagram seulement : Instagram oui, Facebook, TikTok et LinkedIn non ; casse indifférente", () => {
    const reglage = m.avecBranchement(m.REGLAGE_MOTS_VIDE, "ia", "instagram", { etat: "branche", le: LE });
    expect(reglage).toEqual({ IA: { instagram: { etat: "branche", le: LE } } });
    expect(RESEAUX.filter((r) => m.motBranchePour("Ia", r, reglage))).toEqual(["instagram"]);
    expect(m.motBranchePour("GUIDE", "instagram", reglage)).toBe(false);
    expect(m.reseauxDuMot("IA", RESEAUX, m.lecteurDuReglage(reglage))).toEqual(["instagram"]);
  });

  it("TikTok et LinkedIn ne sont jamais branchés ; « branché » exige sa date ; « non_branche » débranche", () => {
    expect(() => m.avecBranchement(m.REGLAGE_MOTS_VIDE, "IA", "tiktok", { etat: "branche", le: LE })).toThrow(/tiktok/);
    expect(() => m.avecBranchement(m.REGLAGE_MOTS_VIDE, "IA", "linkedin", { etat: "branche", le: LE })).toThrow(/linkedin/);
    expect(() => m.avecBranchement(m.REGLAGE_MOTS_VIDE, "IA", "facebook", { etat: "branche", le: "" })).toThrow(/date/);
    const branche = m.avecBranchement(m.REGLAGE_MOTS_VIDE, "IA", "facebook", { etat: "branche", le: LE });
    const debranche = m.avecBranchement(branche, "IA", "facebook", { etat: "non_branche", le: LE });
    expect(m.motBranchePour("IA", "facebook", debranche)).toBe(false);
    // Lecture tolérante : un compte interdit ou une date absente sont ignorés.
    const lu = m.lireReglageMotsBranches({ IA: { tiktok: { etat: "branche", le: LE }, facebook: { etat: "branche" }, instagram: { etat: "branche", le: LE } } });
    expect(lu).toEqual({ IA: { instagram: { etat: "branche", le: LE } } });
  });

  it("avertissement : plus d'une vidéo du format sur trois des 7 derniers jours porte un mot sur ce compte", () => {
    const v = (jours: number, reseaux: ReseauCas[], motSur: ReseauCas[]) => ({ le: new Date(MAINTENANT - jours * 86_400_000).toISOString(), reseaux, motSur });
    // Instagram : 2 sur 3 → averti ; Facebook : 1 sur 3 → non (« plus d'une sur trois ») ; une vidéo de 8 jours ne compte pas.
    const videos = [v(1, ["instagram", "facebook"], ["instagram"]), v(2, ["instagram", "facebook"], ["instagram", "facebook"]), v(3, ["instagram", "facebook"], []), v(8, ["facebook"], ["facebook"])];
    expect(m.comptesChargesEnMot(videos, MAINTENANT)).toEqual(["instagram"]);
    expect(m.comptesChargesEnMot([], MAINTENANT)).toEqual([]);
    expect(m.PHRASE_MOT_TROP_FREQUENT).toBe("Le mot est déjà dans plus d'une vidéo sur trois cette semaine sur ce compte.");
  });
});

describe("X6 · le réglage du studio (service)", () => {
  it("se pose par `poserBranchementMot`, dans les paramètres ; `etatMotsCasConcret` le rend à la feuille", async () => {
    expect(await mots.etatMotsCasConcret(MAINTENANT)).toEqual({ branches: {}, charges: [] });
    await mots.poserBranchementMot("IA", "instagram", "branche", LE);
    expect((await depots().parametres.obtenir(m.PARAM_MOTS_BRANCHES))?.valeur).toEqual({ IA: { instagram: { etat: "branche", le: LE } } });
    expect(await mots.etatMotsCasConcret(MAINTENANT)).toEqual({ branches: { IA: ["instagram"] }, charges: [] });
    await expect(mots.poserBranchementMot("IA", "tiktok", "branche", LE)).rejects.toThrow(/tiktok/);
  });

  it("session exigée", async () => {
    await auth.seDeconnecter();
    await expect(mots.poserBranchementMot("IA", "instagram", "branche", LE)).rejects.toBeTruthy();
  });

  it("lancement : la vidéo ne prend la fin au mot que pour les comptes où le mot est branché", async () => {
    const lancer = vi.fn(async () => ({ travailId: "t-x6" }));
    const demande = { casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT };
    const sans = await service.preparerEtLancer(demande, { lancer });
    expect(sans.statut).toBe("lancee");
    const entrees = async (id: string) => lireEntreesCasConcret((await depots().videos.obtenir(id))!.entrees);
    if (sans.statut !== "lancee") throw new Error("non lancée");
    expect((await entrees(sans.videoId)).motSur).toEqual([]);

    await mots.poserBranchementMot("IA", "instagram", "branche", LE);
    const avec = await service.preparerEtLancer({ ...demande, casId: "rappels-rendez-vous", essai: true, mot: "RAPPEL" }, { lancer });
    if (avec.statut !== "lancee") throw new Error("non lancée");
    // RAPPEL n'est branché nulle part : diagnostic partout.
    expect((await entrees(avec.videoId)).motSur).toEqual([]);
    const ia = await service.preparerEtLancer({ ...demande, casId: "email-difficile", essai: true }, { lancer });
    if (ia.statut !== "lancee") throw new Error(ia.statut === "refusee" ? ia.phrase : "non lancée");
    expect(await entrees(ia.videoId)).toMatchObject({ avecMot: true, motSur: ["instagram"] });
  });
});

describe("X6 · feuille « Votre vidéo » (bloc du mot)", () => {
  const cas = versVueCas(trouverCas("recrutement-apporteurs")!, empreinteCas(trouverCas("recrutement-apporteurs")!), true);
  const rendre = (o: { reseaux?: string[]; avecMot?: boolean; mots?: { branches: Record<string, ReseauCas[]>; charges: ReseauCas[] } }) =>
    renderToStaticMarkup(createElement(ContenuVotreVideo, { cas, essai: false, reseaux: o.reseaux ?? ["facebook", "instagram"], onReseaux: () => undefined, mot: cas.mot, onMot: () => undefined, avecMot: o.avecMot ?? false, onAvecMot: () => undefined, ...(o.mots ? { mots: o.mots } : {}), onValider: () => undefined }));

  it("rien de branché : l'option est visible mais inactive, avec « Disponible quand l'envoi du document sera en place. »", () => {
    const html = rendre({});
    expect(texte(html)).toContain("Avec le mot");
    expect(texte(html)).toContain("Disponible quand l'envoi du document sera en place.");
    expect(html).toMatch(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/);
  });

  it("mot branché sur un réseau non coché : toujours inactive", () => {
    const html = rendre({ reseaux: ["tiktok", "facebook"], mots: { branches: { [cas.mot]: ["instagram"] }, charges: [] } });
    expect(texte(html)).toContain("Disponible quand l'envoi du document sera en place.");
  });

  it("mot branché sur Instagram, coché : la feuille dit sur quels réseaux le mot sera dit", () => {
    const html = rendre({ avecMot: true, mots: { branches: { [cas.mot]: ["instagram"] }, charges: [] } });
    expect(texte(html)).not.toContain("Disponible quand");
    expect(texte(html)).toContain("Le mot sera dit sur Instagram.");
    expect(texte(html)).not.toContain("plus d'une vidéo sur trois");
  });

  it("compte chargé en mot : l'avertissement, jamais un blocage", () => {
    const html = rendre({ avecMot: true, mots: { branches: { [cas.mot]: ["instagram", "facebook"] }, charges: ["instagram"] } });
    expect(texte(html)).toContain("Le mot sera dit sur Facebook et Instagram.");
    expect(texte(html)).toContain("Instagram : Le mot est déjà dans plus d'une vidéo sur trois cette semaine sur ce compte.");
    expect(html).not.toMatch(/role="switch"[^>]*disabled=""|disabled=""[^>]*role="switch"/);
  });
});

describe("X6 · une vidéo refaite avec l'autre fin", () => {
  const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
  const fiche = ficheParGabarit(trouverCas("recrutement-apporteurs")!, FIXE);
  const avecFiche = (d: Doubles): Doubles => {
    d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
    d.options.lireFiche = async () => structuredClone(fiche);
    return d;
  };

  it("même empreinte du corps, ni voix ni écran du corps refaits : seule la fin change", async () => {
    const d = avecFiche(doubles({ reseaux: ["facebook"], avecMot: true, motSur: [] }));
    const cr = await fabriquerCasConcret(d.options);
    expect(cr.plan.fins[0].appels.map((a) => a.id)).toEqual(["fin-if-diagnostic-gratuit", "fin-fb-lien-commentaire"]);

    // Le mot est branché sur Facebook : la même vidéo, refaite avec la fin au mot.
    const d2 = avecFiche(doubles({ partage: d.partage, reseaux: ["facebook"], avecMot: true, motSur: ["facebook"] }));
    const cr2 = await fabriquerCasConcret(d2.options);
    expect(cr2.plan.fins[0].appels.map((a) => a.id)).toEqual(["fin-if-mot", "fin-if-envoi-structure"]);
    // Même prise du corps (même empreinte), payée une seule fois, au premier passage.
    const priseCorps = () => (d.partage.journal.valeur as { voix: { etat: { corps: { prise: { empreinte: string } } } } }).voix.etat.corps.prise.empreinte;
    const payeeCorps = cr.prises.filter((p) => p.prise === "corps").map((p) => p.empreinte);
    expect(payeeCorps).toHaveLength(1);
    expect(priseCorps()).toBe(payeeCorps[0]);
    expect(cr2.prises.filter((p) => p.prise === "corps")).toEqual([]);
    expect(cr2.fiche.ecrans).toEqual(cr.fiche.ecrans);
    // Une seule lecture payée : la nouvelle fin ; aucun écran du corps soumis de nouveau.
    expect(d2.lus).toEqual(["Écrivez I.A. en commentaire. Je vous envoie la structure complète."]);
    const idsCorps = new Set(cr.fiche.ecrans.map((e) => e.id));
    expect(d2.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string } }).proprietes.id).filter((id) => idsCorps.has(id))).toEqual([]);
    expect(cr2.ecrans.rendus.every((id) => id.startsWith("fin-"))).toBe(true);
  });
});
