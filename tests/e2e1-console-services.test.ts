/**
 * Vérification de bout en bout n° 1 (console, 03/10) — corrections testées par les SERVICES (données en mémoire,
 * aucune clé, aucun appel payant) : n° 2, 12, 14, 17, 20, 22, 23, 30.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const express = await import("@/services/express");
const reglages = await import("@/services/reglages");
const recherche = await import("@/services/recherche");
const partages = await import("@/services/partages");
const { fournisseurTexteReseauxSimulation } = await import("@/fournisseurs/simulation/autres");
const { decorsCatalogue } = await import("@/donnees/decors-catalogue");

const MDP = "essai-e2e1-console-services";

beforeAll(async () => {
  process.env.SESSION_SECRET = "e".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("n° 2 — texte du mot de passe : seulement si les données ne sont pas gardées", () => {
  const avant = process.env.DATABASE_URL;
  afterEach(() => {
    if (avant === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = avant;
  });

  it("en ligne (base de données) : rien n'est « en mémoire »", () => {
    const vitest = process.env.VITEST;
    process.env.DATABASE_URL = "postgresql://exemple/studio";
    delete process.env.VITEST;
    try {
      expect(reglages.donneesEnMemoire()).toBe(false);
      expect(reglages.aPropos().enMemoire).toBe(false);
      expect(reglages.aPropos().donnees).not.toMatch(/mémoire|démonstration/i);
    } finally {
      process.env.VITEST = vitest;
    }
  });

  it("sans base (développement) : la mise en garde s'affiche", () => {
    delete process.env.DATABASE_URL;
    expect(reglages.donneesEnMemoire()).toBe(true);
    expect(reglages.aPropos().enMemoire).toBe(true);
  });
});

describe("n° 12 — textes de publication simulés : le titre n'est jamais répété", () => {
  it("LinkedIn : la première phrase identique au titre n'est pas redite", async () => {
    const titre = "Votre patron peut-il lire vos mails ?";
    const r = await fournisseurTexteReseauxSimulation.ecrire({ reseau: "linkedin", titre, texteScript: `${titre} Oui, dans certains cas.`, mentionIA: "", credits: [], formatId: "avocat", dureeSec: 16, adresse: "vous" });
    expect(r.texte.split(titre).length - 1).toBe(1);
  });

  it("une première phrase différente du titre reste là", async () => {
    const r = await fournisseurTexteReseauxSimulation.ecrire({ reseau: "instagram", titre: "Licencié par SMS", texteScript: "C'est illégal. Voici pourquoi.", mentionIA: "", credits: [], formatId: "avocat", dureeSec: 30, adresse: "vous" });
    expect(r.texte).toContain("Licencié par SMS");
    expect(r.texte).toContain("C'est illégal.");
  });
});

describe("n° 14 — le script d'une vidéo prend son sujet, plus « Nouvelle vidéo »", () => {
  it("texte collé : le script écrit avant le sujet est renommé", async () => {
    const id = await videos.creerBrouillon("avocat");
    const blocs = [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre patron lit vos mails ?" }] }];
    const r = await express.enregistrerBrouillonExpress(id, { sujet: "Votre patron lit vos mails ?", dureeCibleSec: 30, ratios: ["9:16"], distribution: [], entrees: {}, reglages: {}, styles: {}, briquesCoupees: [], briquesAllumees: [], mentionIA: { incrustee: false, position: "bas-droite", texte: "" }, adresse: "vous", etapeAssistant: "express" } as never, blocs as never);
    const script = await depots().scripts.obtenir(r.scriptId!);
    expect(script?.sujet).toBe("Votre patron lit vos mails ?");
    expect((await depots().videos.obtenir(id))?.titre).toBe("Votre patron lit vos mails ?");
  });
});

describe("n° 17 — la recherche trouve aussi les personnages", () => {
  it("« Sophie » → Sophie Lambert, avec un lien vers sa fiche", async () => {
    const r = await recherche.rechercher("Sophie");
    expect(r.personnages.map((p) => p.titre)).toContain("Sophie Lambert");
    expect(r.personnages[0].lien).toMatch(/^\/personnages\//);
  });

  it("insensible aux accents et à la casse", async () => {
    const r = await recherche.rechercher("martin");
    expect(r.personnages.some((p) => p.titre === "Sophie Lambert")).toBe(true);
  });
});

describe("n° 20 — décors : jamais deux fois le même nom", () => {
  it("tous les décors de la Bibliothèque (catalogue compris) : noms uniques", async () => {
    const tous = await depots().elements.lister((e) => e.type === "decor" && !e.archiveLe);
    expect(tous.length).toBeGreaterThanOrEqual(decorsCatalogue(new Date().toISOString()).length);
    const noms = tous.map((e) => e.nom);
    const doublons = noms.filter((n, i) => noms.indexOf(n) !== i);
    expect(doublons).toEqual([]);
  });
});

describe("n° 22 — mots simples à l'écran", () => {
  it("les outils techniques des Connexions ont un nom lisible", async () => {
    // Lot R0 : l'écran affiche les noms des cartes et des CHOIX servis par le serveur (plus de libellé recalculé).
    const noms = (await reglages.listerConnexions()).flatMap((c) => [c.nom, ...c.options.map((o) => o.nom)]);
    expect(noms).toContain("HeyGen");
    for (const nom of noms) expect(nom).not.toMatch(/ffmpeg|loudnorm|whisper|aligneur|remotion|cloudflare|\bR2\b|AWS/i);
  });

  it("journal : « 1 vidéo archivée », jamais « vidéo(s) »", async () => {
    const pretes = await depots().videos.lister((v) => v.statut === "prete");
    await videos.archiverVideos([pretes[0].id]);
    const journal = await depots().evenements.lister();
    expect(journal.some((e) => e.message === "1 vidéo archivée")).toBe(true);
    expect(journal.some((e) => /\(s\)/.test(e.message))).toBe(false);
  });
});

describe("n° 23 — fiches inconnues : le proxy sait qu'elles n'existent pas", () => {
  it("ficheExiste suit la règle de chaque page", async () => {
    const v = (await depots().videos.lister())[0];
    expect(await recherche.ficheExiste("videos", v.id)).toBe(true);
    expect(await recherche.ficheExiste("videos", "v-inconnu")).toBe(false);
    expect(await recherche.ficheExiste("personnages", "p-sophie")).toBe(true);
    expect(await recherche.ficheExiste("personnages", "p-inconnu")).toBe(false);
    expect(await recherche.ficheExiste("scripts", "inconnu")).toBe(false);
    expect(await recherche.ficheExiste("formats", "avocat")).toBe(true);
    expect(await recherche.ficheExiste("formats", "inconnu")).toBe(false);
    expect(await recherche.ficheExiste("bibliotheque", "lut")).toBe(true);
    expect(await recherche.ficheExiste("bibliotheque", "rushs")).toBe(true);
    expect(await recherche.ficheExiste("bibliotheque", "inconnu")).toBe(false);
  });

  it("la route /api/fiches répond « existe : false » pour une vidéo inconnue (session exigée)", async () => {
    const { GET } = await import("@/app/api/fiches/[type]/[id]/route");
    const r = await GET(new Request("http://local/api/fiches/videos/v-inconnu"), { params: Promise.resolve({ type: "videos", id: "v-inconnu" }) });
    expect(await r.json()).toEqual({ existe: false });
  });
});

describe("n° 30 — lien privé : « introuvable » distinct de « révoqué »", () => {
  it("un code jamais créé est « introuvable » ; la route le dit au proxy", async () => {
    expect((await partages.resoudrePartage("codeinexistant")).etat).toBe("introuvable");
    const { GET } = await import("@/app/api/partages/[code]/route");
    const r = await GET(new Request("http://local/api/partages/codeinexistant"), { params: Promise.resolve({ code: "codeinexistant" }) });
    expect(await r.json()).toEqual({ actif: false, introuvable: true });
  });
});
