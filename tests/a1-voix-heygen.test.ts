/**
 * Lot A1 — M0b : VOIX HEYGEN RÉELLE (B.4, B.0 §9 / §17). Une règle = un test, SANS réseau ni clé : les réponses HeyGen
 * sont celles relevées le 02/10 sur le compte (`GET /v3/voices?type=private`, `POST /v3/voices/speech`), rejouées par
 * un faux `fetch`. Service « Relier ma voix HeyGen » sur la simulation (aucune clé), relais d'écoute.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { creerClientHeygen, erreurDepuisReponse, ErreurHeygen } = await import("@/fournisseurs/heygen/client");
const heygen = await import("@/fournisseurs/heygen/voix");
const { classerSourceEcoute, urlEcoute } = await import("@/fournisseurs/heygen/ecoute");
const { voixHeygen } = await import("@/fournisseurs/heygen/inscription");
const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
const personnages = await import("@/services/personnages");

import type { StockageFichiers } from "@/fournisseurs/types";

const MDP_TEST = "essai-lot-a1-voix";

/** Réponse réelle de `GET /v3/voices?type=private` (02/10, compte de Will ; seule l'adresse d'aperçu est abrégée). */
const LISTE_REELLE = {
  data: [
    {
      available_engines: ["starfish", "orca", "elevenlabs", "elevenlabs_v3"],
      gender: "male",
      language: "French",
      name: "DJI_04_20261001_231540",
      preview_audio_url: "https://resource2.heygen.ai/voice_preview/apercu.mp3",
      support_locale: false,
      support_pause: true,
      type: "private",
      voice_id: "b22b1a358ca740eda753772ebaaf11f7",
    },
  ],
  has_more: false,
};

/** Réponse réelle de `POST /v3/voices/speech` (02/10, « Un bon PV, puis un pépin : voilà comment tout commence. »). */
const PAROLE_REELLE = {
  data: {
    audio_url: "https://resource2.heygen.ai/text_to_speech/compte/voix/id=essai.wav",
    duration: 5.015510204081632,
    engine: "starfish",
    word_timestamps: [
      { end: 0, start: 0, word: "<start>" },
      { end: 0.92, start: 0.86, word: "Un" },
      { end: 1.1, start: 0.98, word: "bon" },
      { end: 1.54, start: 1.18, word: "PV," },
      { end: 2.14, start: 2.02, word: "puis" },
      { end: 2.26, start: 2.18, word: "un" },
      { end: 2.68, start: 2.3, word: "pépin" },
      { end: 2.68, start: 2.68, word: ":" },
      { end: 3.8, start: 3.58, word: "voilà" },
      { end: 4.12, start: 3.88, word: "comment" },
      { end: 4.26, start: 4.16, word: "tout" },
      { end: 4.68, start: 4.3, word: "commence." },
      { end: 5.015510204081632, start: 5.015510204081632, word: "<end>" },
    ],
  },
};

type Appel = { url: string; init?: RequestInit };
function fauxFetch(reponses: (a: Appel) => Response | Promise<Response>) {
  const appels: Appel[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const a = { url: String(url), init };
    appels.push(a);
    return reponses(a);
  }) as typeof fetch;
  return { f, appels };
}
const json = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: { "content-type": "application/json" } });

function fournisseurAvec(reponses: (a: Appel) => Response | Promise<Response>, stockage: StockageFichiers = stockageSimulation) {
  const { f, appels } = fauxFetch(reponses);
  const voix = heygen.creerFournisseurVoixHeygen({ client: creerClientHeygen({ cle: "cle-de-test", fetch: f }), stockage: () => stockage, environnement: "dev" });
  return { voix, appels };
}

const DEMANDE = { idExterne: "b22b1a358ca740eda753772ebaaf11f7", texte: "Un bon PV, puis un pépin : voilà comment tout commence.", reglages: { vitesse: 1, stabilite: 60, emotion: 50 }, prononciations: [] };

beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------------ */
describe("lister les voix privées (GET /v3/voices?type=private)", () => {
  it("la voix de Will : copie instantanée (moteur starfish), utilisable, français, aperçu gardé", async () => {
    const { voix, appels } = fournisseurAvec(() => json(LISTE_REELLE));
    const liste = await voix.listerVoixExistantes();
    expect(liste).toEqual([{ idExterne: "b22b1a358ca740eda753772ebaaf11f7", nom: "DJI_04_20261001_231540", langue: "fr-FR", typeClone: "instant", utilisable: true, apercuUrl: "https://resource2.heygen.ai/voice_preview/apercu.mp3" }]);
    expect(appels[0].url).toBe("https://api.heygen.com/v3/voices?type=private&limit=100");
    expect((appels[0].init?.headers as Record<string, string>)["x-api-key"]).toBe("cle-de-test");
  });
  it("paginée : `next_token` repris tant que `has_more`", async () => {
    const { voix, appels } = fournisseurAvec((a) =>
      a.url.includes("token=") ? json({ data: [{ ...LISTE_REELLE.data[0], voice_id: "v2", name: "Deuxième" }], has_more: false }) : json({ ...LISTE_REELLE, has_more: true, next_token: "page-2" }),
    );
    expect((await voix.listerVoixExistantes()).map((v) => v.idExterne)).toEqual(["b22b1a358ca740eda753772ebaaf11f7", "v2"]);
    expect(appels[1].url).toContain("token=page-2");
  });
  it("sans moteur starfish : non utilisable (ne peut pas être reliée)", () => {
    expect(heygen.typeCloneHeygen(["orca"])).toEqual({ typeClone: "pro", utilisable: false });
    expect(heygen.typeCloneHeygen(undefined)).toEqual({ typeClone: "inconnu", utilisable: false });
  });
});

describe("lire (POST /v3/voices/speech) : son seul + horodatage des mots", () => {
  it("UN appel, locale fr-FR, moteur starfish, vitesse 1,0, aucune balise <break>", async () => {
    const { voix, appels } = fournisseurAvec(() => json(PAROLE_REELLE));
    await voix.lire({ ...DEMANDE, texte: `${DEMANDE.texte} <break time="1s"/> Fin.` });
    expect(appels).toHaveLength(1);
    const corps = JSON.parse(String(appels[0].init?.body));
    expect(corps).toEqual({ text: `${DEMANDE.texte} Fin.`, voice_id: DEMANDE.idExterne, speed: 1, locale: "fr-FR", engine: "starfish" });
  });
  it("lecture neuve (relecture d'une prise qui hésite) : force_regenerate, sinon HeyGen rend le même son (14/10)", async () => {
    const { voix, appels } = fournisseurAvec(() => json(PAROLE_REELLE));
    await voix.lire({ ...DEMANDE, nouvelleLecture: true });
    expect(JSON.parse(String(appels[0].init?.body))).toMatchObject({ engine: "starfish", force_regenerate: true });
    await voix.lire(DEMANDE);
    expect(JSON.parse(String(appels[1].init?.body)).force_regenerate).toBeUndefined();
  });
  it("horodatage : sans les repères <start> / <end> ni la ponctuation isolée ; durée et coût relevés", async () => {
    const { voix } = fournisseurAvec(() => json(PAROLE_REELLE));
    const r = await voix.lire(DEMANDE);
    expect(r.mots.map((m) => m.mot)).toEqual(["Un", "bon", "PV,", "puis", "un", "pépin", "voilà", "comment", "tout", "commence."]);
    expect(r.mots[2]).toEqual({ mot: "PV,", debutSec: 1.18, finSec: 1.54 });
    expect(r.dureeSec).toBeCloseTo(5.016, 3);
    // Vérif A2 : centime SUPÉRIEUR (même calcul que l'estimation : jamais « 0 € » pour une voix payée).
    expect(r.cout.centimes).toBe(Math.ceil(DEMANDE.texte.length * heygen.CENTIMES_USD_PAR_CARACTERE_HEYGEN * 0.9 - 1e-9));
  });
  it("vitesse réglée dans les limites B.4 v3.2 : pas de 0,05, plafond 1,15, plancher 0,80", () => {
    expect([1, 1.02, 1.13, 1.3, 0.5, undefined].map(heygen.vitesseHeygen)).toEqual([1, 1, 1.15, 1.15, 0.8, 1]);
  });
  it("contrat M1 : un texte déjà substitué passe tel quel ; une liste (écoute d'essai) est appliquée une seule fois", async () => {
    const { voix, appels } = fournisseurAvec(() => json(PAROLE_REELLE));
    await voix.lire({ ...DEMANDE, texte: "Un PV.", prononciations: [{ mot: "PV", prononciation: "pé-vé" }] });
    expect(JSON.parse(String(appels[0].init?.body)).text).toBe("Un pé-vé.");
  });
  it("sans stockage relié : l'adresse HeyGen est gardée (écoutée par le relais du studio)", async () => {
    const { voix } = fournisseurAvec(() => json(PAROLE_REELLE));
    expect((await voix.lire(DEMANDE)).fichierCle).toBe(PAROLE_REELLE.data.audio_url);
  });
  it("stockage relié (R2) : le son est copié AUSSITÔT et la clé du studio est rendue", async () => {
    const depots: { url: string; type: string; taille: number }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      depots.push({ url, type: (init.headers as Record<string, string>)["content-type"], taille: (init.body as Uint8Array).byteLength });
      return new Response(null, { status: 200 });
    });
    const r2: StockageFichiers = { ...stockageSimulation, id: "r2", mode: "reel", urlDepotDuree: async (cle) => `https://r2.exemple/${cle}?signe` };
    const { voix } = fournisseurAvec((a) => (a.url.endsWith(".wav") ? new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-type": "audio/wav" } }) : json(PAROLE_REELLE)), r2);
    const r = await voix.lire(DEMANDE);
    expect(r.fichierCle).toMatch(/^studio\/dev\/voix\/b22b1a358ca740eda753772ebaaf11f7\/[\w-]+\.wav$/);
    expect(depots).toEqual([{ url: `https://r2.exemple/${r.fichierCle}?signe`, type: "audio/wav", taille: 4 }]);
  });
  it("texte de plus de 5 000 caractères, ou voix non reliée : refus clair, aucun appel", async () => {
    const { voix, appels } = fournisseurAvec(() => json(PAROLE_REELLE));
    await expect(voix.lire({ ...DEMANDE, texte: "a ".repeat(2600) })).rejects.toMatchObject({ code: "refuse", reessayable: false });
    await expect(voix.lire({ ...DEMANDE, idExterne: "" })).rejects.toBeInstanceOf(ErreurHeygen);
    expect(appels).toHaveLength(0);
  });
  it("une nouvelle copie se fait chez HeyGen, jamais par le studio", async () => {
    const { voix, appels } = fournisseurAvec(() => json({}));
    await expect(voix.copierVoix({ voixId: "v", nature: "moi", fichierIds: [], minutes: 1 })).rejects.toMatchObject({ code: "refuse" });
    expect(appels).toHaveLength(0);
  });
  it("capacités lues par les moteurs : son seul et horodatage des mots", () => {
    const { voix } = fournisseurAvec(() => json({}));
    expect(voix.capacites).toMatchObject({ audioSeul: true, horodatageMots: true, asynchrone: false, accordExige: true });
    expect(voix.mode).toBe("reel");
  });
});

describe("erreurs typées", () => {
  it("402 ou crédit épuisé : « quota », non réessayable", () => {
    expect(erreurDepuisReponse(402, null).erreur).toMatchObject({ code: "quota", reessayable: false });
    expect(erreurDepuisReponse(400, { error: { code: "insufficient_credit", message: "Not enough balance" } }).erreur.code).toBe("quota");
  });
  it("401 / 403 : « refuse » ; 429 / 5xx : « indisponible », réessayable", () => {
    expect(erreurDepuisReponse(401, null).erreur).toMatchObject({ code: "refuse", reessayable: false });
    expect(erreurDepuisReponse(429, null).erreur).toMatchObject({ code: "indisponible", reessayable: true });
    expect(erreurDepuisReponse(502, null).erreur).toMatchObject({ code: "indisponible", reessayable: true });
  });
  it("réseau coupé : « indisponible », réessayable ; la clé n'apparaît jamais dans le message", async () => {
    const { voix } = fournisseurAvec(() => {
      throw new TypeError("fetch failed");
    });
    const e = (await voix.lire(DEMANDE).catch((x: unknown) => x)) as InstanceType<typeof ErreurHeygen>;
    expect(e.erreur).toMatchObject({ code: "indisponible", reessayable: true });
    expect(e.message).not.toContain("cle-de-test");
  });
  it("réponse 200 avec une erreur dans le corps : refusée", async () => {
    const { voix } = fournisseurAvec(() => json({ error: { code: "invalid_parameter", message: "'voice_id' is required." } }));
    await expect(voix.lire(DEMANDE)).rejects.toMatchObject({ code: "refuse" });
  });
});

describe("inscription : sans clé, rien ; avec la clé, la voix HeyGen", () => {
  it("sans HEYGEN_API_KEY : aucune voix réelle inscrite (simulation par défaut)", () => {
    expect(voixHeygen({})).toEqual({});
  });
  it("avec la clé : « heygen » inscrite, réelle", () => {
    const r = voixHeygen({ HEYGEN_API_KEY: "x" });
    expect(r.heygen).toMatchObject({ id: "heygen", type: "voix", mode: "reel" });
  });
});

describe("relais d'écoute : aucun domaine tiers dans la page, pas de relais ouvert", () => {
  it("fichier du studio servi tel quel ; HeyGen et stockage par le relais", () => {
    expect(urlEcoute("/demo/essai-voix.mp3")).toBe("/demo/essai-voix.mp3");
    expect(urlEcoute("https://resource2.heygen.ai/a/b.wav")).toBe(`/api/voix/ecoute?cle=${encodeURIComponent("https://resource2.heygen.ai/a/b.wav")}`);
    expect(urlEcoute("studio/prod/voix/v/x.wav")).toBe("/api/voix/ecoute?cle=studio%2Fprod%2Fvoix%2Fv%2Fx.wav");
  });
  it("refusés : autre domaine, faux sous-domaine, http, chemins remontants, adresses protocolaires", () => {
    for (const c of ["https://exemple.com/a.mp3", "https://heygen.ai.pirate.com/a.mp3", "http://resource2.heygen.ai/a.mp3", "/demo/../.env", "//pirate.com/a", "studio/../x", "javascript:alert(1)", ""]) {
      expect(classerSourceEcoute(c)).toBeNull();
    }
  });
});

describe("« Relier ma voix HeyGen » (service, simulation sans clé)", () => {
  it("liste les voix du compte (aperçu par le studio) et signale la simulation", async () => {
    const r = await personnages.listerVoixHeygen("p-will");
    expect(r.simulee).toBe(true);
    expect(r.voix[0]).toMatchObject({ idExterne: "sim-voix-heygen-will", utilisable: true, apercu: "/demo/essai-voix.mp3" });
  });
  it("relier : Voix prête (0 min, HeyGen, copie instantanée) + ressource fournisseur, devenue la voix par défaut ; l'ancienne reste", async () => {
    const d = depots();
    const id = await personnages.relierVoixExistante("p-will", "sim-voix-heygen-will");
    expect(await d.voix.obtenir(id)).toMatchObject({ personnageId: "p-will", minutesEnregistrees: 0, statut: "pret", fournisseur: "heygen", typeClone: "instant" });
    expect(await d.ressourcesFournisseurs.trouver((r) => r.entiteId === id)).toMatchObject({ entite: "voix", fournisseur: "heygen", idExterne: "sim-voix-heygen-will", versionModele: "instant", statut: "pret" });
    expect((await d.personnages.obtenir("p-will"))?.voixParDefautId).toBe(id);
    expect(await d.voix.obtenir("voix-will")).toBeTruthy();
    // Relier deux fois la même voix ne crée rien de plus.
    expect(await personnages.relierVoixExistante("p-will", "sim-voix-heygen-will")).toBe(id);
    expect(await d.voix.compter((v) => v.personnageId === "p-will")).toBe(2);
  });
  it("une voix qui ne sait pas lire un texte seul est refusée", async () => {
    await expect(personnages.relierVoixExistante("p-will", "sim-voix-heygen-pro")).rejects.toMatchObject({ code: "VOIX_INUTILISABLE" });
  });
  it("personne réelle sans accord : refus (accord obligatoire et bloquant)", async () => {
    const id = await personnages.creerPersonnage({ nom: "Invité", nature: "reel" });
    await expect(personnages.relierVoixExistante(id, "sim-voix-heygen-will")).rejects.toMatchObject({ code: "ACCORD_MANQUANT" });
  });
  it("l'essai de la voix reliée passe par le registre (simulation sans clé : son de démonstration)", async () => {
    const id = await personnages.relierVoixExistante("p-will", "sim-voix-heygen-will");
    const r = await personnages.ecouterEssaiVoix(id, "Un bon PV, puis un pépin.");
    expect(r).toMatchObject({ url: "/demo/essai-voix.mp3", simulee: true });
  });
});
