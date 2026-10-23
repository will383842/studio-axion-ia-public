/** S2.7 — controlesDeLaVideo : l'entrée est assemblée en LECTURE SEULE, les réglages du site viennent d'un double. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const pub = await import("@/services/publications");
const site = await import("@/services/site-videos");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(preparerBase);
afterEach(() => site.injecterLecteurReglagesSite(null));

/** Contenu de toute la base (toutes les collections), pour prouver qu'une lecture n'écrit rien. */
async function photo(): Promise<string> {
  const d = depots() as unknown as Record<string, { lister(): Promise<unknown[]> }>;
  const sortie: Record<string, unknown[]> = {};
  for (const [nom, depot] of Object.entries(d)) if (typeof depot?.lister === "function") sortie[nom] = await depot.lister();
  return JSON.stringify(sortie);
}

async function videoPrete() {
  return (await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId))[0];
}

describe("S2.7 controlesDeLaVideo", () => {
  it("assemble l'entrée depuis la base de démo sans rien écrire, sans appeler le site quand les réglages sont fournis", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    const lecteur = vi.fn(async () => ({ certifexempleCertificationObtenue: true, avisPublies: true }));
    site.injecterLecteurReglagesSite(lecteur);
    const avant = await photo();
    const entree = await site.entreeControlesDeLaVideo(v.id, { reglagesSite: { certifexempleCertificationObtenue: false, avisPublies: false } });
    const resultat = await site.controlesDeLaVideo(v.id, { reglagesSite: { certifexempleCertificationObtenue: false, avisPublies: false } });
    expect(await photo()).toBe(avant);
    expect(lecteur).not.toHaveBeenCalled();
    expect(entree.formatId).toBe(v.formatId);
    expect(entree.videoPrete).toBe(true);
    expect(entree.generateurAllume).toBe(false);
    expect(entree.passeport.transcription.length).toBeGreaterThan(10);
    expect(entree.sousTitres).toBe(true);
    expect(entree.vignette).not.toBeNull();
    expect(entree.reglagesSite).toEqual({ certifexempleCertificationObtenue: false, avisPublies: false });
    // Le générateur est éteint : SITE-12 bloque, et le passeport d'essai (page pauvre) aussi.
    expect(resultat.publiable).toBe(false);
    expect(resultat.controles.some((c) => c.code === "SITE-12" && !c.ok)).toBe(true);
    expect(resultat.controles.some((c) => c.code === "SITE-10" && !c.ok)).toBe(true);
  });

  it("même sur un ancien kit sans passeport, la lecture n'écrit rien", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    const kit = (await depots().kits.trouver((k) => k.videoId === v.id))!;
    const ancien = { ...kit };
    delete ancien.passeportWeb;
    await depots().kits.enregistrer(ancien);
    const avant = await photo();
    const entree = await site.entreeControlesDeLaVideo(v.id, { reglagesSite: { certifexempleCertificationObtenue: false, avisPublies: false } });
    expect(entree.passeport.version).toBe(1);
    expect(await photo()).toBe(avant);
  });

  it("site injoignable (le lecteur lève) → les deux réglages sont « inconnu », donc les contrôles sont stricts", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    site.injecterLecteurReglagesSite(async () => {
      throw new Error("site injoignable");
    });
    const entree = await site.entreeControlesDeLaVideo(v.id);
    expect(entree.reglagesSite).toEqual({ certifexempleCertificationObtenue: null, avisPublies: null });
  });

  it("sans lecteur injecté, les réglages sont lus chez le fournisseur « site » (le site factice, tout faux)", async () => {
    const v = await videoPrete();
    await pub.obtenirKit(v.id);
    expect((await site.entreeControlesDeLaVideo(v.id)).reglagesSite).toEqual({ certifexempleCertificationObtenue: false, avisPublies: false });
  });

  it("l'écrivain du générateur vient d'une table du service, jamais du code d'un format", () => {
    expect(site.ecrivainDuFormat("avocat")).toBe("ecrire");
    expect(site.ecrivainDuFormat("facecam")).toBe("ecrire");
    expect(site.ecrivainDuFormat("facecam-animee")).toBe("ecrire");
    expect(site.ecrivainDuFormat("podcast")).toBe("ecrire");
    expect(site.ecrivainDuFormat("tableau-anime")).toBe("tableau");
    expect(site.ecrivainDuFormat("cas-concret")).toBe("cas-concret");
    expect(site.ecrivainDuFormat("image-video")).toBe("image-video");
    expect(site.ecrivainDuFormat("avis-client")).toBeNull();
  });

  it("une autre version du même sujet déjà en ligne → autreVersionEnLigne", async () => {
    const [a, b] = await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId);
    await pub.obtenirKit(a.id);
    await pub.obtenirKit(b.id);
    // Lien de dérivation : b est issue de a ; a est en ligne.
    await depots().videos.modifier(b.id, { sourceVideoId: a.id });
    const kitA = (await depots().kits.trouver((k) => k.videoId === a.id))!;
    await depots().kits.modifier(kitA.id, { site: { choisie: true, etat: "en-ligne", versionEnLigne: 1, fichiersPublics: [], modifieLe: "2026-10-18T10:00:00.000Z" } });
    const r = { certifexempleCertificationObtenue: false, avisPublies: false };
    expect((await site.entreeControlesDeLaVideo(b.id, { reglagesSite: r })).autreVersionEnLigne).toBe(true);
    expect((await site.entreeControlesDeLaVideo(a.id, { reglagesSite: r })).autreVersionEnLigne).toBe(false);
  });
});
