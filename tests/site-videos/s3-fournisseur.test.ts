/** S3.1 — le site factice : mêmes règles de signature que le vrai site (§ 7.2), idempotence, 409, retrait idempotent. */
import { describe, expect, it } from "vitest";
import { chaineASigner, VERSION_CONTRAT, type CorpsPasseport } from "@/domaine/site-videos/contrat";
import { creerSiteFactice, creerFournisseurSiteSimulation } from "@/fournisseurs/site/simulation";
import { signerAppel } from "@/fournisseurs/site/signature";
import { ErreurSite } from "@/fournisseurs/site/types";

const SECRET = "secret-de-test-du-site-factice";
const T0 = Date.UTC(2026, 9, 18, 10, 0, 0);

function corps(surcharge: Partial<CorpsPasseport> = {}): CorpsPasseport {
  return {
    versionContrat: VERSION_CONTRAT,
    idStudio: "vid_1",
    versionPasseport: 1,
    slugPropose: "automatiser-ses-devis",
    titre: "Automatiser ses devis",
    resume: "Un résumé.",
    transcription: "Le texte dit.",
    aRetenir: ["a", "b", "c"],
    questions: [{ question: "Q ?", reponse: "R." }, { question: "Q2 ?", reponse: "R2." }],
    chapitres: [],
    rubrique: "Automatisation",
    motsCles: ["devis"],
    generateur: "avocat",
    langue: "fr",
    dureeSec: 40,
    largeur: 1080,
    hauteur: 1920,
    contenuGenere: false,
    publieLe: "2026-10-18T10:00:00.000Z",
    urlVideo: "https://axion-ia.com/medias/videos/vid_1/a-v1-12345678.mp4",
    urlVignette: "https://axion-ia.com/medias/videos/vid_1/a-v1-12345678.jpg",
    largeurVignette: 1280,
    hauteurVignette: 720,
    urlVtt: "https://axion-ia.com/medias/videos/vid_1/a-v1-12345678.vtt",
    credits: [],
    ...surcharge,
  };
}

function fabrique() {
  let maintenant = T0;
  const site = creerSiteFactice({ secret: SECRET, maintenant: () => maintenant });
  return { site, avancer: (ms: number) => (maintenant += ms), horloge: () => maintenant };
}

/** Un appel signé comme le fera le vrai client. */
async function appeler(f: ReturnType<typeof creerSiteFactice>, methode: "GET" | "POST" | "DELETE", chemin: string, corpsJson?: unknown, options: { secret?: string; horodatageSec?: number; nonce?: string; corpsSigne?: string } = {}) {
  const texte = corpsJson === undefined ? "" : JSON.stringify(corpsJson);
  const entetes = signerAppel({ secret: options.secret ?? SECRET, methode, chemin, corps: options.corpsSigne ?? texte, horodatageSec: options.horodatageSec ?? Math.floor(T0 / 1000), nonce: options.nonce });
  return f.traiter({ methode, chemin, corps: texte, entetes });
}

describe("S3.1 signature", () => {
  it("une signature juste passe", async () => {
    const { site } = fabrique();
    const r = await appeler(site, "GET", "/api/interne/videos/reglages");
    expect(r.statut).toBe(200);
    expect(r.corps).toMatchObject({ versionContrat: 1, certifexempleCertificationObtenue: false, avisPublies: false });
  });
  it("une signature fausse est refusée (401), un secret différent aussi", async () => {
    const { site } = fabrique();
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { secret: "autre-secret" })).statut).toBe(401);
  });
  it("un corps modifié d'un octet après la signature est refusé", async () => {
    const { site } = fabrique();
    const c = corps();
    expect((await appeler(site, "POST", "/api/interne/videos", c, { corpsSigne: JSON.stringify({ ...c, titre: "Autre titre" }) })).statut).toBe(401);
  });
  it("un horodatage de plus de 5 minutes est refusé (avant comme après)", async () => {
    const { site } = fabrique();
    const s = Math.floor(T0 / 1000);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { horodatageSec: s - 301 })).statut).toBe(401);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { horodatageSec: s + 301 })).statut).toBe(401);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { horodatageSec: s - 299 })).statut).toBe(200);
  });
  it("un nonce rejoué est refusé, puis oublié après 10 minutes", async () => {
    const { site, avancer } = fabrique();
    const nonce = "a".repeat(32);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { nonce })).statut).toBe(200);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { nonce })).statut).toBe(401);
    avancer(11 * 60 * 1000);
    const s = Math.floor((T0 + 11 * 60 * 1000) / 1000);
    expect((await appeler(site, "GET", "/api/interne/videos/reglages", undefined, { nonce, horodatageSec: s })).statut).toBe(200);
  });
  it("la chaîne signée porte l'horodatage, le nonce, la méthode, le chemin et le hash du corps", () => {
    expect(chaineASigner({ horodatage: "1760000000", nonce: "ab", methode: "POST", chemin: "/api/interne/videos", sha256Corps: "cd" })).toBe("1760000000.ab.POST./api/interne/videos.cd");
  });
});

describe("S3.1 publication", () => {
  it("rejeu de la même version : « inchangé », une seule page", async () => {
    const { site } = fabrique();
    const a = await appeler(site, "POST", "/api/interne/videos", corps());
    expect(a.statut).toBe(200);
    expect(a.corps).toMatchObject({ statut: "publiee", slug: "automatiser-ses-devis", versionPasseport: 1, inchange: false, url: "https://site-factice.invalid/fr/videos/automatiser-ses-devis" });
    const b = await appeler(site, "POST", "/api/interne/videos", corps());
    expect(b.corps).toMatchObject({ inchange: true, url: (a.corps as { url: string }).url });
    expect(site.pages.size).toBe(1);
    expect(site.appels.publier).toBe(2);
  });
  it("une version plus basse est refusée (409)", async () => {
    const { site } = fabrique();
    await appeler(site, "POST", "/api/interne/videos", corps({ versionPasseport: 3 }));
    expect((await appeler(site, "POST", "/api/interne/videos", corps({ versionPasseport: 2 }))).statut).toBe(409);
  });
  it("une version plus haute met la page à jour : même adresse, modifieLe changé, slug figé", async () => {
    const { site, avancer } = fabrique();
    const a = await appeler(site, "POST", "/api/interne/videos", corps());
    avancer(60_000);
    const b = await appeler(site, "POST", "/api/interne/videos", corps({ versionPasseport: 2, slugPropose: "un-autre-slug" }));
    expect(b.corps).toMatchObject({ versionPasseport: 2, inchange: false, url: (a.corps as { url: string }).url });
    const page = site.pages.get("vid_1")!;
    expect(page.version).toBe(2);
    expect(page.modifieLe).not.toBe(site.pages.get("vid_1")!.cree);
  });
  it("un champ invalide : 422 avec la liste des erreurs", async () => {
    const { site } = fabrique();
    const r = await appeler(site, "POST", "/api/interne/videos", corps({ titre: "" }));
    expect(r.statut).toBe(422);
    expect((r.corps as { erreurs: string[] }).erreurs.length).toBeGreaterThan(0);
  });
  it("deux vidéos qui proposent le même slug ont deux adresses", async () => {
    const { site } = fabrique();
    await appeler(site, "POST", "/api/interne/videos", corps());
    const b = await appeler(site, "POST", "/api/interne/videos", corps({ idStudio: "vid_2" }));
    expect((b.corps as { slug: string }).slug).not.toBe("automatiser-ses-devis");
    expect(site.pages.size).toBe(2);
  });
});

describe("S3.1 retrait", () => {
  it("la page retirée répond 410 ; retirer deux fois est sans effet", async () => {
    const { site } = fabrique();
    await appeler(site, "POST", "/api/interne/videos", corps());
    expect(site.statutPage("vid_1")).toBe(200);
    expect((await appeler(site, "DELETE", "/api/interne/videos/vid_1")).corps).toEqual({ statut: "retiree" });
    expect(site.statutPage("vid_1")).toBe(410);
    expect((await appeler(site, "DELETE", "/api/interne/videos/vid_1")).statut).toBe(200);
  });
  it("une vidéo jamais connue : 404 chez le site", async () => {
    const { site } = fabrique();
    expect((await appeler(site, "DELETE", "/api/interne/videos/vid_inconnue")).statut).toBe(404);
    expect(site.statutPage("vid_inconnue")).toBe(404);
  });
  it("republier après un retrait est possible, même adresse", async () => {
    const { site } = fabrique();
    const a = await appeler(site, "POST", "/api/interne/videos", corps());
    await appeler(site, "DELETE", "/api/interne/videos/vid_1");
    const b = await appeler(site, "POST", "/api/interne/videos", corps());
    expect(b.corps).toMatchObject({ inchange: false, url: (a.corps as { url: string }).url });
    expect(site.statutPage("vid_1")).toBe(200);
  });
});

describe("S3.1 fournisseur de simulation", () => {
  it("publie, republie sans doublon, retire ; la vidéo inconnue se retire sans erreur (idempotent)", async () => {
    const { site } = fabrique();
    const f = creerFournisseurSiteSimulation(site);
    expect(f.mode).toBe("simulation");
    expect(f.type).toBe("site");
    const a = await f.publier(corps());
    expect(a.url).toContain("site-factice.invalid");
    expect((await f.publier(corps())).inchange).toBe(true);
    expect(site.pages.size).toBe(1);
    expect(await f.retirer("vid_1")).toEqual({ statut: "retiree" });
    expect(await f.retirer("vid_jamais_vue")).toEqual({ statut: "inconnue" });
  });
  it("traduit les refus en erreurs claires (409, 422)", async () => {
    const { site } = fabrique();
    const f = creerFournisseurSiteSimulation(site);
    await f.publier(corps({ versionPasseport: 4 }));
    await expect(f.publier(corps({ versionPasseport: 1 }))).rejects.toMatchObject({ code: "conflit" });
    await expect(f.publier(corps({ idStudio: "vid_9", titre: "" }))).rejects.toMatchObject({ code: "invalide" });
    await expect(f.publier(corps({ idStudio: "vid_9", titre: "" }))).rejects.toBeInstanceOf(ErreurSite);
  });
  it("site en panne : « injoignable » ou « 500 » deviennent des erreurs claires, sans exception brute", async () => {
    const { site } = fabrique();
    const f = creerFournisseurSiteSimulation(site);
    site.panne = "injoignable";
    await expect(f.publier(corps())).rejects.toMatchObject({ code: "injoignable" });
    site.panne = "500";
    await expect(f.lireReglages()).rejects.toMatchObject({ code: "serveur" });
    site.panne = null;
    expect((await f.lireReglages()).avisPublies).toBe(false);
  });
  it("les réglages du site sont modifiables par le test", async () => {
    const { site } = fabrique();
    site.reglages.avisPublies = true;
    expect(await creerFournisseurSiteSimulation(site).lireReglages()).toEqual({ certifexempleCertificationObtenue: false, avisPublies: true });
  });
});
