/**
 * LOT « CALAGE » (D3) — calage des sous-titres au mot près (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md` §6).
 * Sans conteneur : le conteneur `studio-aligneur` est imité par un faux `fetch` (même protocole HTTP), et ses réponses
 * RÉELLES sont rejouées depuis `tests/fixtures/d3-calage-*.json` (enregistrées le 02/10 par
 * `python -m aligneur --caler`, modèle wav2vec2 français de WhisperX, processeur seul).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const fabrication = await import("@/services/fabrication");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { resoudreFournisseur } = await import("@/fournisseurs");
import { creerAligneurHttp, DELAI_MAX_MS, lireResultat, RESOUMISSIONS_MAX, TOLERANCE_SILENCE_MS } from "@/fournisseurs/aligneur/client";
import { aligneurReel } from "@/fournisseurs/aligneur/inscription";
import { appliquerAlignement, couvertureLettres, ESSAIS_ALIGNEMENT, verifierAlignement } from "@/moteurs/montage-avocat/alignement";
import { ecartMoyenMs } from "@/moteurs/montage-avocat/report";
import type { MotHorodate, Travail } from "@/domaine/types";
import type { DemandeAlignement, FournisseurAlignement, ResultatAlignement, StockageFichiers } from "@/fournisseurs/types";

const FIX = join(process.cwd(), "tests", "fixtures");
const lire = <T>(nom: string): T => JSON.parse(readFileSync(join(FIX, nom), "utf8").replace(/^﻿/, "")) as T;
const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);

const voixEssai = lire<{ texteEnvoye: string; dureeSec: number; mots: MotHorodate[] }>("voix-essai.json");
const debutsExacts = lire<{ mot: string; debutSec: number }[]>("voix-essai.debuts.json");
const caleVoixEssai = lire<ResultatAlignement>("d3-calage-voix-essai.json");
const caleMontant = lire<ResultatAlignement>("d3-calage-heygen-montant.json");
const heygenMontant = JSON.parse(readFileSync(join(process.cwd(), "docs", "captures", "m0b-voix", "2-montant.heygen.json"), "utf8")) as { texte: string; dureeSec: number; mots: MotHorodate[] };

/** Écart moyen (ms) des DÉBUTS de mots, rang pour rang. */
const ecartDebuts = (a: { debutSec: number }[], b: { debutSec: number }[]) => (a.reduce((s, m, i) => s + Math.abs(m.debutSec - b[i].debutSec), 0) / a.length) * 1000;

/* ------------------------------------------------------------------ */
/* Faux conteneur : même protocole que studio-aligneur (POST / GET / 404) */
/* ------------------------------------------------------------------ */
interface FauxAligneur {
  fetch: typeof fetch;
  posts: string[];
  cles: (string | undefined)[];
  /** Oublie tout (redémarrage du conteneur). */
  redemarrer(): void;
  panne: "aucune" | "muet" | "503";
}

function fauxAligneur(calcul: (d: DemandeAlignement) => ResultatAlignement | unknown, options: { oublierApresPremierSuivi?: boolean; tours?: number } = {}): FauxAligneur {
  const etats = new Map<string, { demande: DemandeAlignement; tours: number }>();
  let suivisFaits = 0;
  const f: FauxAligneur = {
    posts: [],
    cles: [],
    panne: "aucune",
    redemarrer: () => etats.clear(),
    fetch: (async (url: string | URL, init?: RequestInit) => {
      if (f.panne === "muet") throw new TypeError("fetch failed");
      if (f.panne === "503") return new Response("{}", { status: 503 });
      const chemin = new URL(String(url)).pathname;
      f.cles.push((init?.headers as Record<string, string> | undefined)?.["x-studio-rendu-cle"]);
      if (init?.method === "POST" && chemin === "/alignements") {
        const d = JSON.parse(String(init.body)) as DemandeAlignement;
        f.posts.push(d.idAlignement);
        if (!etats.has(d.idAlignement)) etats.set(d.idAlignement, { demande: d, tours: 0 });
        return Response.json({ idAlignement: d.idAlignement, nouveau: true }, { status: 202 });
      }
      const m = /^\/alignements\/(.+)$/.exec(chemin);
      if (m) {
        const e = etats.get(decodeURIComponent(m[1]));
        if (!e) return Response.json({ statut: "inconnu" }, { status: 404 });
        suivisFaits++;
        if (options.oublierApresPremierSuivi && suivisFaits === 1) {
          etats.clear();
          return Response.json({ statut: "en_cours", progression: 40 });
        }
        if (e.tours++ < (options.tours ?? 1)) return Response.json({ statut: "en_cours", progression: 40 });
        return Response.json({ statut: "termine", resultat: calcul(e.demande) });
      }
      return Response.json({ erreur: "introuvable" }, { status: 404 });
    }) as typeof fetch,
  };
  return f;
}

/** Calcul imité : les mots de la voix, avancés de 150 ms (ce que corrige le calage). */
const decaler = (d: DemandeAlignement): ResultatAlignement => ({
  mots: (d.reference ?? []).map((m) => ({ ...m, debutSec: Math.max(0, m.debutSec - 0.15), finSec: Math.max(0, m.finSec - 0.15) })),
  motsNonAlignes: 0,
  modele: "wav2vec2:VOXPOPULI_ASR_BASE_10K_FR",
  dureeCalculSec: 1.2,
});

/* ------------------------------------------------------------------ */
describe("calage — inscription et Réglages > Connexions", () => {
  it("sans STUDIO_ALIGNEUR_URL : rien d'inscrit, la simulation reste (calage sauté)", () => {
    expect(aligneurReel({})).toEqual({});
    expect(aligneurReel({ STUDIO_ALIGNEUR_URL: "   " })).toEqual({});
    expect(resoudreFournisseur("alignement").mode).toBe("simulation");
  });

  it("Réglages > Connexions affiche « Calage des sous-titres » en simulation (rien d'autre n'est ajouté)", async () => {
    const { listerConnexions } = await import("@/services/reglages");
    const calage = (await listerConnexions()).filter((c) => c.type === "alignement");
    // Lot R0 : la connexion porte aussi ses vrais choix (simulation, puis « studio-aligneur » sous son identifiant exact).
    expect(calage).toHaveLength(1);
    expect(calage[0]).toMatchObject({ type: "alignement", nom: "Calage des sous-titres", etat: "simulation", source: "defaut" });
    expect(calage[0].options.map((o) => o.id)).toEqual(["simulation", "studio-aligneur"]);
  });

  it("avec l'adresse : « studio-aligneur » réel, nommé « Calage des sous-titres »", () => {
    const r = aligneurReel({ STUDIO_ALIGNEUR_URL: "http://studio-aligneur:4200", STUDIO_RENDU_CLE: "k" });
    expect(Object.keys(r)).toEqual(["studio-aligneur"]);
    expect(r["studio-aligneur"]).toMatchObject({ id: "studio-aligneur", type: "alignement", mode: "reel", nom: "Calage des sous-titres" });
  });
});

/* ------------------------------------------------------------------ */
describe("calage — client HTTP (protocole de studio-rendu)", () => {
  const demande: DemandeAlignement = { idAlignement: "t-1-alignement", audio: "https://r2.exemple/son?sig=1", texte: "Un bon PV", langue: "fr", reference: [] };

  it("soumet avec la clé partagée, suit, et lit le résultat", async () => {
    const faux = fauxAligneur(() => ({ mots: [{ mot: "Un", debutSec: 0.1, finSec: 0.2 }], motsNonAlignes: 0, modele: "m", dureeCalculSec: 1 }));
    const al = creerAligneurHttp("http://studio-aligneur:4200/", { fetch: faux.fetch, cle: "secret" });
    await al.soumettre(demande);
    expect(await al.suivre(demande.idAlignement)).toEqual({ statut: "en_cours", progression: 40 });
    const e = await al.suivre(demande.idAlignement);
    expect(e).toMatchObject({ statut: "termine", resultat: { mots: [{ mot: "Un" }], modele: "m" } });
    expect(faux.cles.every((c) => c === "secret")).toBe(true);
  });

  it("404 sur une demande connue (conteneur redémarré) : la MÊME demande est soumise à nouveau, même identifiant", async () => {
    const faux = fauxAligneur(decaler, { oublierApresPremierSuivi: true });
    const al = creerAligneurHttp("http://a", { fetch: faux.fetch });
    await al.soumettre(demande);
    await al.suivre(demande.idAlignement); // le conteneur oublie ici
    expect(await al.suivre(demande.idAlignement)).toEqual({ statut: "en_file", rang: 0 });
    expect(faux.posts).toEqual([demande.idAlignement, demande.idAlignement]);
    expect((await al.suivre(demande.idAlignement)).statut).toBe("en_cours");
    expect((await al.suivre(demande.idAlignement)).statut).toBe("termine");
  });

  it("404 en boucle : au-delà de RESOUMISSIONS_MAX, échec réessayable (le moteur fera un nouvel essai)", async () => {
    const faux = fauxAligneur(decaler);
    const al = creerAligneurHttp("http://a", { fetch: faux.fetch });
    await al.soumettre(demande);
    let e = await al.suivre(demande.idAlignement);
    for (let i = 0; i <= RESOUMISSIONS_MAX + 1 && e.statut !== "echec"; i++) {
      faux.redemarrer();
      e = await al.suivre(demande.idAlignement);
    }
    expect(e).toMatchObject({ statut: "echec", erreur: { code: "indisponible", reessayable: true } });
  });

  it("demande inconnue de ce processus (studio redémarré) : « fichier-inaccessible », à refaire", async () => {
    const al = creerAligneurHttp("http://a", { fetch: fauxAligneur(decaler).fetch });
    expect(await al.suivre("jamais-soumise")).toMatchObject({ statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true } });
  });

  it("conteneur muet : patience TOLERANCE_SILENCE_MS, puis échec réessayable — jamais d'exception", async () => {
    let t = T0;
    const faux = fauxAligneur(decaler);
    const al = creerAligneurHttp("http://a", { fetch: faux.fetch, horloge: () => t });
    faux.panne = "muet";
    await expect(al.soumettre(demande)).resolves.toBeUndefined();
    expect((await al.suivre(demande.idAlignement)).statut).toBe("echec"); // la soumission elle-même a échoué
    faux.panne = "aucune";
    await al.soumettre(demande);
    faux.panne = "muet";
    expect(await al.suivre(demande.idAlignement)).toEqual({ statut: "en_cours", progression: 0 });
    t += TOLERANCE_SILENCE_MS + 1;
    expect(await al.suivre(demande.idAlignement)).toMatchObject({ statut: "echec", erreur: { code: "indisponible", reessayable: true } });
  });

  it("délai maximal dépassé : échec (une vidéo ne reste jamais bloquée sur le calage)", async () => {
    let t = T0;
    const al = creerAligneurHttp("http://a", { fetch: fauxAligneur(decaler, { tours: 1e9 }).fetch, horloge: () => t });
    await al.soumettre(demande);
    expect((await al.suivre(demande.idAlignement)).statut).toBe("en_cours");
    t += DELAI_MAX_MS + 1;
    expect((await al.suivre(demande.idAlignement)).statut).toBe("echec");
  });

  it("résultat mal formé : refusé, non réessayable (la voix est gardée tout de suite)", async () => {
    const al = creerAligneurHttp("http://a", { fetch: fauxAligneur(() => ({ mots: [{ mot: "Un", debutSec: "x" }] }), { tours: 0 }).fetch });
    await al.soumettre(demande);
    expect(await al.suivre(demande.idAlignement)).toMatchObject({ statut: "echec", erreur: { code: "refuse", reessayable: false } });
    expect(lireResultat(null)).toBeNull();
    expect(lireResultat({ mots: [{ mot: "a", debutSec: 0, finSec: Number.NaN }] })).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe("calage — garde-fous et report (réponses réelles rejouées)", () => {
  it("fixture voix-essai : écart moyen < 40 ms contre les débuts EXACTS des mots (WhisperX tel quel : 155 ms)", () => {
    const { mots, rapport } = appliquerAlignement(voixEssai.mots, caleVoixEssai, voixEssai.dureeSec);
    expect(rapport.source).toBe("aligneur");
    expect(mots.map((m) => m.mot)).toEqual(voixEssai.mots.map((m) => m.mot));
    expect(ecartDebuts(mots, debutsExacts)).toBeLessThan(40);
    // Et les fins tombent sur les vrais blancs : le nettoyage les retrouve (blanc ≥ 1 s après « euros » et « suite »).
    const blanc = (i: number) => mots[i + 1].debutSec - mots[i].finSec;
    const rang = (mot: string) => mots.findIndex((m) => m.mot.replace(/[^\p{L}]/gu, "") === mot);
    expect(blanc(rang("euros"))).toBeGreaterThan(1);
    expect(blanc(rang("suite"))).toBeGreaterThan(1);
  });

  it("voix HeyGen « 135 € » : l'aligneur découpe autrement (« € » à part) — report lettre à lettre sur les 10 mots de la voix", () => {
    expect(caleMontant.mots).toHaveLength(11);
    expect(heygenMontant.mots).toHaveLength(10);
    const { mots, rapport } = appliquerAlignement(heygenMontant.mots, caleMontant, heygenMontant.dureeSec);
    expect(rapport.source).toBe("aligneur");
    expect(mots.map((m) => m.mot)).toEqual(heygenMontant.mots.map((m) => m.mot));
    for (let i = 1; i < mots.length; i++) expect(mots[i].debutSec).toBeGreaterThanOrEqual(mots[i - 1].debutSec);
    expect(mots.every((m) => m.finSec <= heygenMontant.dureeSec && m.finSec >= m.debutSec)).toBe(true);
  });

  it("refuse un calage d'un AUTRE texte, trop de mots non alignés, ou un autre son (écart > 1,5 s)", () => {
    const voix = voixEssai.mots;
    const base = { motsNonAlignes: 0, modele: "m", dureeCalculSec: 1 };
    const autreTexte = { ...base, mots: voix.map((m, i) => ({ ...m, mot: ["chat", "chien", "loup"][i % 3] })) };
    expect(couvertureLettres(voix.map((m) => m.mot), autreTexte.mots.map((m) => m.mot))).toBeLessThan(0.9);
    expect(appliquerAlignement(voix, autreTexte, voixEssai.dureeSec).rapport.source).toBe("voix");
    expect(verifierAlignement(voix, { ...base, mots: voix, motsNonAlignes: voix.length }, voixEssai.dureeSec)).toBe("trop de mots non alignés");
    const autreSon = { ...base, mots: voix.map((m) => ({ ...m, debutSec: Math.min(voixEssai.dureeSec, m.debutSec + 3), finSec: Math.min(voixEssai.dureeSec, m.finSec + 3) })) };
    expect(appliquerAlignement(voix, autreSon, voixEssai.dureeSec)).toEqual({ mots: voix, rapport: { source: "voix", motsNonAlignes: voix.length } });
    expect(appliquerAlignement(voix, { ...base, mots: [] }, 10).rapport.source).toBe("voix");
  });

  it("un mot non aligné prend l'horodatage voisin ; tout reste dans l'ordre et dans la durée", () => {
    const voix: MotHorodate[] = [
      { mot: "Un", debutSec: 0.2, finSec: 0.3 },
      { mot: "bon", debutSec: 0.35, finSec: 0.5 },
      { mot: "PV", debutSec: 0.6, finSec: 0.9 },
      { mot: "puis", debutSec: 1.2, finSec: 1.4 },
    ];
    const cale: ResultatAlignement = {
      mots: [
        { mot: "Un", debutSec: 0.1, finSec: 0.25 },
        { mot: "bon", debutSec: 9, finSec: 9.1, ...({ aligne: false } as object) },
        { mot: "PV", debutSec: 0.5, finSec: 0.8 },
        { mot: "puis", debutSec: 1.1, finSec: 5 },
      ],
      motsNonAlignes: 1,
      modele: "m",
      dureeCalculSec: 0.5,
    };
    const { mots, rapport } = appliquerAlignement(voix, cale, 1.5);
    expect(rapport).toMatchObject({ source: "aligneur", motsNonAlignes: 1 });
    expect(mots[1].debutSec).toBeGreaterThanOrEqual(mots[0].finSec - 1e-9);
    expect(mots[1].finSec).toBeLessThanOrEqual(mots[2].debutSec + 1e-9);
    expect(mots[3].finSec).toBeLessThanOrEqual(1.5);
  });

  it("le garde-fou d'origine reste : un résultat qui n'a pas les mêmes mots est refusé", () => {
    const voix = [
      { mot: "Un", debutSec: 0, finSec: 0.2 },
      { mot: "PV", debutSec: 0.3, finSec: 0.6 },
    ];
    expect(appliquerAlignement(voix, { mots: [voix[0]], motsNonAlignes: 1, modele: "x", dureeCalculSec: 0 }, 1).rapport.source).toBe("voix");
    expect(ecartMoyenMs(voix, voix)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("calage — dans le moteur avocat (client HTTP réel, conteneur imité)", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "a".repeat(48);
    const empreinte = await hash("essai-d3", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
  });
  beforeEach(() => {
    reinitialiserDepots();
    reinitialiserRequete();
  });

  const stockageSigne = (): StockageFichiers => ({
    id: "r2",
    type: "stockage",
    nom: "Stockage",
    reelPrevu: "R2",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    preparerDepot: async () => ({ cleStockage: "x", urlDepot: "" }),
    confirmerDepot: async () => ({ ok: true }),
    urlLecture: async (cle) => `https://r2.exemple/${cle}`,
    urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
    urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
  });

  async function voixJusquAuBout(aligneur: FournisseurAlignement, horloge: { t: number }): Promise<Travail> {
    const m = creerMoteurMontageAvocat({ rendu: creerServiceRenduSimule(() => horloge.t), stockage: stockageSigne, alignement: () => aligneur });
    // Lot R6 : la voix de synthèse n'est plus calée par défaut (mesure D3) ; ces essais du calage de la VOIX l'allument.
    const c0 = await fabrication.construireCommande("v-03");
    const c = { ...c0, entrees: { ...c0.entrees, calerVoixSynthese: true } };
    let t = await m.lancer(c, { travailId: "t-d3", versionId: "ver-d3", titre: "D3", maintenant: horloge.t });
    for (; horloge.t < T0 + 30 * 60_000 && t.etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; horloge.t += 5_000) t = (await m.avancer(t, c, horloge.t)).travail;
    return t;
  }
  const audioDe = (t: Travail) => (t.parametres?.voix as { phase: string; audio: { alignement?: { source: string; ecartMoyenMs?: number; modele?: string } } });

  it("calage appliqué AVANT le nettoyage : rapport « aligneur », écart mesuré, une seule demande", async () => {
    const horloge = { t: T0 };
    const faux = fauxAligneur(decaler);
    const t = await voixJusquAuBout(creerAligneurHttp("http://studio-aligneur:4200", { fetch: faux.fetch, horloge: () => horloge.t }), horloge);
    expect(audioDe(t).phase).toBe("faite");
    expect(audioDe(t).audio.alignement).toMatchObject({ source: "aligneur", modele: "wav2vec2:VOXPOPULI_ASR_BASE_10K_FR" });
    expect(audioDe(t).audio.alignement?.ecartMoyenMs).toBeGreaterThan(100);
    expect(new Set(faux.posts).size).toBe(1);
  });

  it(`conteneur en panne (503) : ${ESSAIS_ALIGNEMENT} essais, puis l'horodatage de la voix est gardé — la vidéo continue`, async () => {
    const horloge = { t: T0 };
    const faux = fauxAligneur(decaler);
    faux.panne = "503";
    const al = creerAligneurHttp("http://a", { fetch: faux.fetch, horloge: () => horloge.t });
    const soumis: string[] = [];
    const espion: FournisseurAlignement = { ...al, soumettre: async (d) => (soumis.push(d.idAlignement), al.soumettre(d)) };
    const t = await voixJusquAuBout(espion, horloge);
    expect(audioDe(t).phase).toBe("faite");
    expect(audioDe(t).audio.alignement).toMatchObject({ source: "voix" });
    expect(soumis.map((id) => id.replace(/^t-d3-.*-alignement/, "alignement"))).toEqual(["alignement", "alignement-e1", "alignement-e2"]);
  });

  it("conteneur redémarré pendant le calcul : même identifiant resoumis, puis calage appliqué", async () => {
    const horloge = { t: T0 };
    const faux = fauxAligneur(decaler, { oublierApresPremierSuivi: true });
    const t = await voixJusquAuBout(creerAligneurHttp("http://a", { fetch: faux.fetch, horloge: () => horloge.t }), horloge);
    expect(faux.posts).toHaveLength(2);
    expect(faux.posts[0]).toBe(faux.posts[1]);
    expect(audioDe(t).audio.alignement).toMatchObject({ source: "aligneur" });
  });

  it("résultat incohérent (autre texte) : refusé, voix gardée, aucun nouvel essai", async () => {
    const horloge = { t: T0 };
    const faux = fauxAligneur((d) => ({ ...decaler(d), mots: decaler(d).mots.map((m) => ({ ...m, mot: "zzz" })) }));
    const t = await voixJusquAuBout(creerAligneurHttp("http://a", { fetch: faux.fetch, horloge: () => horloge.t }), horloge);
    expect(audioDe(t).phase).toBe("faite");
    expect(audioDe(t).audio.alignement).toMatchObject({ source: "voix" });
    expect(new Set(faux.posts).size).toBe(1);
  });
});
