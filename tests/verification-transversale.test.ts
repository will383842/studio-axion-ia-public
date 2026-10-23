/**
 * Correctifs de la vérification transversale du 01/10 (seconde passe) :
 * formats ajoutés et retouches ne refacturent pas tout, archivage et calendrier, exemples masqués,
 * plans de l'Aperçu jamais supprimés, limite d'essais non contournable, session révoquée.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { etatRequete, mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const videos = await import("@/services/videos");
const publications = await import("@/services/publications");
const accueil = await import("@/services/accueil");
const notifications = await import("@/services/notifications");
const modeles = await import("@/services/modeles");
const { ecrireParametre } = await import("@/services/_commun");

const MDP_TEST = "essai-transversal-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "z".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Avance l'horloge (Date seulement) et fait avancer les travaux. */
async function avancerDe(ms: number) {
  vi.setSystemTime(Date.now() + ms);
  await travaux.avancerTravaux();
}

describe("ajouter un format à une vidéo publiée", () => {
  it("ne change ni l'étape, ni la note, ni la version ; seul l'export est payé", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const avant = (await depots().videos.obtenir("v-09"))!;
    const estime = await fabrication.estimerReexport("v-09", "16:9");
    await fabrication.reexporter("v-09", "16:9");
    await avancerDe(2_000);
    expect((await depots().videos.obtenir("v-09"))!.statut).toBe("prete");
    await avancerDe(30_000);
    const apres = (await depots().videos.obtenir("v-09"))!;
    expect(apres.etapeEditoriale).toBe("publiee");
    expect(apres.noteQualite?.globale).toBe(avant.noteQualite?.globale);
    expect(apres.versionChoisieId).toBe(avant.versionChoisieId);
    expect(apres.modifieLe >= avant.modifieLe).toBe(true);
    const ajoute = apres.coutReel!.centimes - (avant.coutReel?.centimes ?? 0);
    expect(ajoute).toBeGreaterThan(0);
    // Ordre de grandeur de l'export seul (± 10 % de variation simulée), loin du coût d'une vidéo entière.
    expect(ajoute).toBeLessThanOrEqual(Math.ceil(estime.centimes * 1.1) + 1);
    const sorties = await depots().sorties.lister((s) => s.versionId === avant.versionChoisieId);
    expect(sorties.map((s) => s.ratio)).toContain("16:9");
    const notes = await depots().notifications.lister((n) => n.lien === "/videos/v-09");
    expect(notes.some((n) => n.titre.startsWith("Le format 16:9"))).toBe(true);
    expect(notes.some((n) => n.titre === "Votre vidéo est prête")).toBe(false);
  });
});

describe("retouche", () => {
  it("coûte au prorata des plans refaits, et la même somme est affichée puis facturée (±10 %)", async () => {
    const video = (await depots().videos.obtenir("v-03"))!;
    const plans = await depots().plans.lister((p) => p.versionId === video.versionChoisieId);
    const { total } = await fabrication.estimerRetoucheVideo("v-03", [plans[0].id]);
    const entiere = (await depots().versions.obtenir(video.versionChoisieId!))!;
    expect(total.centimes).toBeGreaterThanOrEqual(50);
    expect(total.centimes).toBeLessThan((entiere.coutReel?.centimes ?? 1_000_000) / 2);

    vi.useFakeTimers({ toFake: ["Date"] });
    await fabrication.lancerRetouche("v-03", [plans[0].id], "Plus lent");
    await avancerDe(60_000);
    const apres = (await depots().videos.obtenir("v-03"))!;
    const facture = apres.coutReel!.centimes - (video.coutReel?.centimes ?? 0);
    expect(facture).toBeLessThanOrEqual(Math.ceil(total.centimes * 1.1) + 1);
  });
});

describe("archivage et calendrier", () => {
  it("une vidéo archivée sort du calendrier ; ses publications reviennent à la restauration", async () => {
    const debut = new Date(Date.now() - 400 * 864e5).toISOString();
    const fin = new Date(Date.now() + 400 * 864e5).toISOString();
    const ids = (j: Awaited<ReturnType<typeof publications.listerCalendrier>>) => j.flatMap((x) => x.publications.map((p) => p.videoId));
    expect(ids(await publications.listerCalendrier(debut, fin))).toContain("v-02");
    await videos.archiverVideos(["v-02"]);
    expect(ids(await publications.listerCalendrier(debut, fin))).not.toContain("v-02");
    await videos.desarchiverVideo("v-02");
    expect(ids(await publications.listerCalendrier(debut, fin))).toContain("v-02");
  });
});

describe("« Afficher les exemples » désactivé", () => {
  it("l'accueil, les travaux et la cloche suivent l'interrupteur", async () => {
    await ecrireParametre("afficherExemples", false);
    const r = await accueil.resumeAccueil();
    expect(r.enCours).toHaveLength(0);
    // Lot M4 : les 4 LUT Axion Buffer sont de VRAIES données de départ (pas des exemples) : la LUT est prête.
    expect(r.pret.lut).toBe(true);
    expect(r.pret.logo).toBe(false);
    expect(await notifications.compterNonLues()).toBe(0);
    expect(await notifications.listerNotifications()).toHaveLength(0);
  });
});

describe("modèles archivés", () => {
  it("un modèle archivé se retrouve et se restaure", async () => {
    const [m] = await modeles.listerModeles();
    await modeles.archiverModele(m.id);
    expect((await modeles.listerModelesArchives()).map((x) => x.id)).toContain(m.id);
    await modeles.restaurerModele(m.id);
    expect((await modeles.listerModeles()).map((x) => x.id)).toContain(m.id);
  });
});

describe("plans de l'Aperçu", () => {
  it("réécrire le texte archive les anciens plans (jamais supprimés) et garde l'image verrouillée", async () => {
    const id = await videos.creerBrouillon("avocat", { scriptId: "script-3" });
    const plans = await fabrication.plansApercu(id);
    expect(plans.length).toBeGreaterThan(1);
    const element = (await depots().elements.lister((e) => e.type === "illustration-image"))[0];
    await videos.choisirIllustrationPlan(plans[1].id, element.id);
    const avant = await depots().plans.compter();
    const script = (await depots().scripts.obtenir((await depots().videos.obtenir(id))!.scriptId!))!;
    const blocs = structuredClone(script.blocs);
    blocs[0].segments[0].texte += " Vraiment.";
    await videos.enregistrerScriptDuBrouillon(id, blocs);
    expect(await depots().plans.compter()).toBeGreaterThanOrEqual(avant);
    expect(await depots().plans.compter((p) => p.versionId.startsWith(`${id}-brouillon-archive-`) && !p.versionId.endsWith("-remplace"))).toBe(plans.length);
    const nouveaux = await fabrication.plansApercu(id);
    const repris = nouveaux.find((p) => p.illustration?.verrouille);
    expect(repris?.illustration?.elementId).toBe(element.id);
  });
});

describe("connexion", () => {
  it("changer l'adresse annoncée par le navigateur ne contourne pas la limite d'essais", async () => {
    reinitialiserRequete();
    etatRequete.entetes.set("x-forwarded-for", "203.0.113.7, 10.0.0.9");
    for (let i = 0; i < 5; i++) await auth.seConnecter("mauvais", false);
    etatRequete.entetes.set("x-forwarded-for", "203.0.113.8, 10.0.0.9");
    const r = await auth.seConnecter("mauvais", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Trop d'essais/);
  }, 30_000);

  it("après un redémarrage, un ancien jeton dont la session est oubliée est refusé", async () => {
    expect(await auth.lireSession()).not.toBeNull();
    reinitialiserDepots();
    const g = globalThis as Record<symbol, unknown>;
    g[Symbol.for("studio-axion-ia.demarrage")] = Math.floor(Date.now() / 1000) + 5;
    expect(await auth.lireSession()).toBeNull();
    g[Symbol.for("studio-axion-ia.demarrage")] = Math.floor(Date.now() / 1000) - 3600;
  });
});
