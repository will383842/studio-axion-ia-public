/**
 * LOT A2 (M5) — fournisseurs d'illustrations réels, testés SANS réseau (réponses enregistrées le 02/10, appels
 * fal.ai doublés) : Pexels, Pixabay, fal.ai, recopie dans notre stockage, inscription, classement simulé.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleIllustration } from "@/fournisseurs/illustration/depot";
import { coutClipUsd, corpsFal, creerFabricationFal, MODELES_FAL } from "@/fournisseurs/illustration/fal";
import { illustrationsReelles } from "@/fournisseurs/illustration/inscription";
import { descriptionDepuisPage, lireReponsePexels, meilleurFichierVertical } from "@/fournisseurs/illustration/pexels";
import { lireReponsePixabay } from "@/fournisseurs/illustration/pixabay";
import { clesDepuisEnv, creerFournisseurIllustrationReel } from "@/fournisseurs/illustration/reel";
import { analyserImageSimulee } from "@/fournisseurs/simulation/analyse-image";
import { fournisseurIllustrationSimulation } from "@/fournisseurs/simulation/autres";

const fixture = (nom: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", nom), "utf8")) as Record<string, unknown>;

afterEach(() => vi.unstubAllGlobals());

describe("Pexels (réponse enregistrée)", () => {
  it("seules les vidéos verticales, le fichier le plus proche de 1080 de large, licence Pexels et page d'origine", () => {
    const r = lireReponsePexels(fixture("a2-pexels.json"));
    expect(r.length).toBeGreaterThan(0);
    for (const c of r) {
      expect(c.hauteur).toBeGreaterThan(c.largeur);
      expect(c.licence).toMatchObject({ type: "libre", usageCommercial: true, source: "Pexels" });
      expect(c.page).toMatch(/^https:\/\/www\.pexels\.com\/video\//);
    }
    expect(r[0].largeur).toBe(1080);
  });
  it("un fichier horizontal n'est jamais choisi ; description lue dans l'adresse", () => {
    expect(meilleurFichierVertical([{ width: 1920, height: 1080, link: "x", file_type: "video/mp4" }])).toBeUndefined();
    expect(descriptionDepuisPage("https://www.pexels.com/video/parking-ticket-on-a-car-123456/")).toBe("parking ticket on a car");
  });
});

describe("Pixabay (réponse enregistrée)", () => {
  it("les vidéos horizontales sont écartées ; une verticale est gardée avec sa licence", () => {
    const brut = fixture("a2-pixabay.json") as { hits: unknown[] };
    const horizontales = lireReponsePixabay(brut);
    expect(horizontales.every((c) => c.hauteur > c.largeur)).toBe(true);
    const avecVerticale = { hits: [...brut.hits, { id: 7, pageURL: "https://pixabay.com/videos/id-7/", tags: "parking, ticket", duration: 9, videos: { large: { url: "https://cdn.pixabay.com/v.mp4", width: 1080, height: 1920, thumbnail: "https://cdn.pixabay.com/v.jpg" } } }] };
    const r = lireReponsePixabay(avecVerticale);
    expect(r.at(-1)).toMatchObject({ idExterne: "7", source: "pixabay", largeur: 1080, hauteur: 1920, licence: { source: "Pixabay", usageCommercial: true } });
  });
});

describe("fal.ai : corps des demandes, prix, file d'attente", () => {
  it("image Nano Banana 9:16 en JPEG ; clip Seedance 720p 5 s à partir de l'image, filtre de sécurité allumé", () => {
    expect(corpsFal({ genre: "image", requete: "a parking ticket", ratio: "9:16", cleIdempotence: "k" })).toEqual({ modele: MODELES_FAL.image, corps: { prompt: "a parking ticket", num_images: 1, aspect_ratio: "9:16", output_format: "jpeg", safety_tolerance: "2" } });
    const clip = corpsFal({ genre: "clip", imageUrl: "https://fal.media/i.jpg", requete: "motion", dureeSec: 5, ratio: "9:16", cleIdempotence: "k" });
    expect(clip.modele).toBe(MODELES_FAL.clip);
    expect(clip.corps).toMatchObject({ image_url: "https://fal.media/i.jpg", resolution: "720p", duration: "5", aspect_ratio: "9:16", enable_safety_checker: true });
  });
  it("prix d'un clip : 720 × 1280 × 24 × 5 / 1024 jetons à 1 $ le million ≈ 10,8 ¢", () => {
    expect(coutClipUsd(5)).toBeCloseTo(10.8, 1);
  });

  it("soumettre puis suivre : en file, terminé, fichier recopié chez nous, coût relevé ; la clé ne sort jamais", async () => {
    const appels: { url: string; auth?: string }[] = [];
    let etat = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      appels.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      if (url === `https://queue.fal.run/${MODELES_FAL.image}`) return Response.json({ request_id: "r1", status_url: "https://queue.fal.run/x/requests/r1/status", response_url: "https://queue.fal.run/x/requests/r1" });
      if (url.endsWith("/status")) return Response.json({ status: etat++ === 0 ? "IN_QUEUE" : "COMPLETED" }, { status: etat === 1 ? 202 : 200 });
      if (url.endsWith("/requests/r1")) return Response.json({ images: [{ url: "https://fal.media/img.jpg", content_type: "image/jpeg" }] });
      if (url === "https://fal.media/img.jpg") return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
      throw new Error(`inattendu ${url}`);
    });
    const deposes: { cle: string; mime: string; taille: number }[] = [];
    const fal = creerFabricationFal({ cle: "cle-secrete", deposer: async (c, cle, mime) => (deposes.push({ cle, mime, taille: c.length }), cle), tauxUsdEur: 0.9 });
    const { idDemande } = await fal.soumettre({ genre: "image", requete: "a registered letter, realistic close-up photograph, no people, no logo", ratio: "9:16", cleIdempotence: "v1-p3" });
    expect(idDemande).not.toContain("cle-secrete");
    expect(await fal.suivre(idDemande)).toEqual({ statut: "en_cours" });
    const fait = await fal.suivre(idDemande);
    expect(fait).toMatchObject({ statut: "fait", mime: "image/jpeg", urlSource: "https://fal.media/img.jpg", coutUsdCentimes: 3.9, cout: { centimes: 4 } });
    expect(deposes[0]).toMatchObject({ mime: "image/jpeg", taille: 3 });
    expect(deposes[0].cle).toMatch(/^studio\/(dev|prod)\/illustrations\/fal\/[a-f0-9]{24}\.jpg$/);
    expect(appels.filter((a) => a.url.includes("fal.run")).every((a) => a.auth === "Key cle-secrete")).toBe(true);
    expect(fal.depenseUsdCentimes()).toBeCloseTo(3.9);
  });

  it("refus : une requête qui montrerait une personne ; plafond de dépense du processus", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ request_id: "r", status_url: "s", response_url: "r" }));
    const fal = creerFabricationFal({ cle: "k", deposer: async (_, c) => c, plafondUsdCentimes: 5 });
    await expect(fal.soumettre({ genre: "image", requete: "a lawyer in uniform", ratio: "9:16", cleIdempotence: "a" })).rejects.toMatchObject({ erreur: { code: "refuse" } });
    await fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "b" });
    // E2E-1 n° 9 : le plafond du studio n'est pas un crédit épuisé (une recharge n'y change rien).
    await expect(fal.soumettre({ genre: "image", requete: "a contract", ratio: "9:16", cleIdempotence: "c" })).rejects.toMatchObject({ erreur: { code: "refuse" } });
  });
});

describe("inscription et fournisseur réel", () => {
  it("sans clé : rien n'est inscrit, la simulation reste ; une clé suffit pour « reel »", () => {
    expect(illustrationsReelles({})).toEqual({});
    expect(Object.keys(illustrationsReelles({ PEXELS_API_KEY: "p" }))).toEqual(["reel"]);
  });
  it("une clé coupée par un espace (copier-coller) est recollée", () => {
    expect(clesDepuisEnv({ PIXABAY_API_KEY: " 123-abc def " }).pixabay).toBe("123-abcdef");
  });
  it("Pexels puis Pixabay ; une banque en panne n'empêche pas l'autre ; rien n'est téléchargé à la recherche", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("pexels")) return new Response("panne", { status: 500 });
      return Response.json({ hits: [{ id: 1, pageURL: "https://pixabay.com/videos/id-1/", tags: "contract, table", duration: 7, videos: { medium: { url: "https://cdn.pixabay.com/1.mp4", width: 720, height: 1280, thumbnail: "https://cdn.pixabay.com/1.jpg" } } }] });
    });
    const f = creerFournisseurIllustrationReel({ pexels: "p", pixabay: "x" }, { deposer: async (_, c) => c });
    const r = await f.chercher({ requete: "contract", ratio: "9:16", dureeMinSec: 3, sources: ["pexels", "pixabay"] });
    expect(r).toHaveLength(1);
    expect(r[0].fichierCle).toBe("https://cdn.pixabay.com/1.mp4");
    expect(urls.some((u) => u.endsWith(".mp4"))).toBe(false);
    expect(await f.chercher({ requete: "contract", ratio: "16:9", dureeMinSec: 3, sources: ["pixabay"] })).toEqual([]);
  });
  it("recopie du résultat RETENU (vidéo + vignette) dans notre stockage", async () => {
    vi.stubGlobal("fetch", async (url: string) => new Response(new Uint8Array(url.endsWith(".mp4") ? 10 : 2), { headers: { "content-type": url.endsWith(".mp4") ? "video/mp4" : "image/jpeg" } }));
    const cles: string[] = [];
    const f = creerFournisseurIllustrationReel({ pixabay: "x" }, { deposer: async (_, c) => (cles.push(c), c) });
    const copie = await f.recopierResultat!({ idExterne: "1", source: "pixabay", fichierCle: "https://cdn.pixabay.com/1.mp4", vignetteCle: "https://cdn.pixabay.com/1.jpg", dureeSec: 7, largeur: 720, hauteur: 1280, licence: { type: "libre", usageCommercial: true, reseaux: [] }, description: "contract" });
    expect(copie.fichierCle).toBe(cleIllustration("pixabay", "1", "mp4"));
    expect(copie.vignetteCle).toMatch(/\.jpg$/);
    expect(cles).toHaveLength(2);
  });
});

describe("classement simulé d'une image de « Mes images » (règles sur le nom, sans Claude)", () => {
  it("console : catégorie, zones à flouter proposées (nom, e-mail, montant) ; jamais prête d'office", async () => {
    const a = await analyserImageSimulee({ fichierCle: "x", mime: "image/png", nom: "Capture console Telegram alertes.png" });
    expect(a.categorie).toBe("consoles");
    expect(a.zones.map((z) => z.type)).toEqual(["nom", "email", "montant"]);
    expect(a.zones.every((z) => !z.floutee)).toBe(true);
  });
  it("salon : visage d'un tiers → accord nécessaire ; image floue signalée ; mots-clés FR et EN", async () => {
    const a = await analyserImageSimulee({ fichierCle: "x", mime: "image/jpeg", nom: "gofab-stand-flou.jpg" });
    expect(a).toMatchObject({ categorie: "evenements", visageTiers: true, qualite: { nette: false } });
    const b = await analyserImageSimulee({ fichierCle: "x", mime: "image/jpeg", nom: "facture-client-devis.jpg" });
    expect(b.motsClesEn).toContain("invoice");
  });
  it("la simulation porte bien `analyserImage` (même contrat que le réel)", () => {
    expect(typeof fournisseurIllustrationSimulation.analyserImage).toBe("function");
  });
});
