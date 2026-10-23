import { describe, expect, it, vi } from "vitest";
import {
  appliquerDecor,
  construireConsigneDecor,
  controlerRaccord,
  conversionVers25ips,
  decouperAuxPauses,
  pausesDepuisMots,
  REGLES_DECOR_V2,
  tientDansLePlafond,
  type DependancesDecor,
  type EntreeDecor,
  type MesuresRaccord,
} from "@/briques/decor";
import { creditsPourPassage, creerHiggsfieldHttp, creerHiggsfieldSimule, fournisseurHiggsfield, verifierDemande } from "@/fournisseurs/higgsfield";

const BONNES_MESURES: MesuresRaccord = { ecartBoucheMs: 20, ressemblanceVisage: 0.95, visageTrouvePct: 100 };
const IMAGE = { nom: "decor.png", type: "image/png" as const, octets: new Uint8Array([1, 2, 3]) };

function entree(partiel: Partial<EntreeDecor> = {}): EntreeDecor {
  return {
    idVideo: "vid1",
    dureeUtileSec: 40,
    pauses: [
      { debutSec: 11.8, finSec: 12.4 },
      { debutSec: 13.5, finSec: 13.7 },
      { debutSec: 25.6, finSec: 26.4 },
    ],
    decor: { description: "bureau clair, grande fenêtre, plantes" },
    imageReference: IMAGE,
    restantDuMoisCentimes: 100_00,
    ...partiel,
  };
}

function deps(partiel: Partial<DependancesDecor> = {}): DependancesDecor & { deposes: number[] } {
  const deposes: number[] = [];
  return {
    higgsfield: creerHiggsfieldSimule(),
    extrairePassage: async () => new Uint8Array([9]),
    deposerPassage: async (p) => {
      deposes.push(p.index);
      return `r2/decor/vid1/${p.index}.mp4`;
    },
    mesurer: async () => BONNES_MESURES,
    attendre: async () => {},
    deposes,
    ...partiel,
  };
}

describe("découpage aux pauses", () => {
  it("coupe au milieu de la pause la plus longue de la fenêtre 10-15 s, calé à 25 i/s", () => {
    const p = decouperAuxPauses(40, entree().pauses!);
    expect(p.map((x) => [x.debutSec, x.finSec])).toEqual([
      [0, 12.12],
      [12.12, 26],
      [26, 40],
    ]);
    expect(p.every((x) => x.dureeSec <= 15 && !x.coupeForcee)).toBe(true);
    for (const x of p) expect(Math.abs(x.finSec * 25 - Math.round(x.finSec * 25))).toBeLessThan(1e-9);
  });

  it("sans pause : coupe forcée à 15 s, et le dernier passage n'est pas un reste minuscule", () => {
    const p = decouperAuxPauses(31, []);
    expect(p.map((x) => x.dureeSec)).toEqual([15, 12, 4]);
    expect(p[0].coupeForcee).toBe(true);
    expect(decouperAuxPauses(16, []).map((x) => x.dureeSec)).toEqual([12, 4]);
  });

  it("une vidéo de 15 s ou moins tient en un passage ; vide → aucun passage", () => {
    expect(decouperAuxPauses(9, [])).toHaveLength(1);
    expect(decouperAuxPauses(0, [])).toEqual([]);
  });

  it("déduit les pauses des mots horodatés", () => {
    const mots = [
      { debutSec: 0, finSec: 0.4 },
      { debutSec: 0.45, finSec: 1 },
      { debutSec: 1.6, finSec: 2 },
    ];
    expect(pausesDepuisMots(mots)).toEqual([{ debutSec: 1, finSec: 1.6 }]);
  });
});

describe("consigne de décor (règles de l'essai v2)", () => {
  it("contient chaque règle : vraie lumière, pièce profonde, fond flou, même lumière, photoréaliste, visage identique", () => {
    const c = construireConsigneDecor({ description: 'bureau "clair"\navec plantes' })!;
    expect(c).toContain("bureau clair avec plantes");
    for (const motif of [/real lighting/, /4 to 6 meters/, /out of focus/, /same white balance/, /Photorealistic, no CGI, no backdrop/, /lips, hands.*identical frame by frame/]) expect(c).toMatch(motif);
    expect(REGLES_DECOR_V2).toHaveLength(6);
  });

  it("description vide → pas de consigne", () => {
    expect(construireConsigneDecor({ description: "  " })).toBeNull();
  });
});

describe("contrôle de raccord et cadence", () => {
  it("refuse les lèvres décalées, un autre visage, une durée changée ou une mesure absente", () => {
    expect(controlerRaccord({ dureeSourceSec: 15, dureeSortieSec: 15.04, mesures: BONNES_MESURES }).ok).toBe(true);
    expect(controlerRaccord({ dureeSourceSec: 15, dureeSortieSec: 15, mesures: { ...BONNES_MESURES, ecartBoucheMs: -120 } }).raisons).toEqual(["levres"]);
    expect(controlerRaccord({ dureeSourceSec: 15, dureeSortieSec: 15, mesures: { ...BONNES_MESURES, ressemblanceVisage: 0.6 } }).raisons).toEqual(["visage"]);
    expect(controlerRaccord({ dureeSourceSec: 15, dureeSortieSec: 14.5, mesures: BONNES_MESURES }).raisons).toEqual(["duree"]);
    expect(controlerRaccord({ dureeSourceSec: 15, dureeSortieSec: 15, mesures: null }).raisons).toEqual(["mesure-impossible"]);
  });

  it("retour à 25 i/s par duplication d'images, jamais par changement de vitesse", () => {
    const c = conversionVers25ips(12.12);
    expect(c.filtreVideo).toMatch(/^fps=25,/);
    expect(c.filtreVideo).not.toMatch(/setpts|atempo/);
    expect(c.vitesse).toBe(1);
    expect(c.dureeSec).toBe(12.12);
  });
});

describe("passe décor — tout ou rien", () => {
  it("tous les passages réussis : décor appliqué, même consigne et même image de référence partout, voix d'origine", async () => {
    const h = creerHiggsfieldSimule();
    const r = await appliquerDecor(entree(), deps({ higgsfield: h }));
    expect(r.statut).toBe("applique");
    expect(r.plan.decorApplique).toBe(true);
    expect(r.plan.audio).toBe("origine");
    expect(r.plan.ips).toBe(25);
    expect(r.plan.zoomMax).toBe(1.1);
    expect(r.plan.morceaux.every((m) => m.source === "decor" && m.fichierCle && m.conversion?.vitesse === 1)).toBe(true);
    expect(h.lancements).toHaveLength(3);
    expect(new Set(h.lancements.map((l) => l.consigne)).size).toBe(1);
    expect(new Set(h.lancements.map((l) => l.imageReferenceMediaId))).toEqual(new Set(["sim-media-1"]));
    expect(h.lancements.every((l) => l.modele === "kling_video_edit")).toBe(true);
    // 13 + 14 + 14 s entamées × 2 crédits/s (Kling).
    expect(r.creditsDebites).toBe(2 * (13 + 14 + 14));
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0].fournisseur).toBe("simulation"); // simulé : jamais compté comme payé
    expect(r.message).not.toMatch(/€|\$|\d+[,.]\d{2}/);
  });

  it("un passage refusé : arrêt immédiat (plus aucun lancement), toute la vidéo repart sur l'origine", async () => {
    const h = creerHiggsfieldSimule({ lancementsEnEchec: [1], echec: "refus" });
    const r = await appliquerDecor(entree(), deps({ higgsfield: h }));
    expect(r.statut).toBe("repli");
    expect(r.raison).toBe("passage-echoue");
    expect(h.lancements).toHaveLength(2);
    expect(r.plan.decorApplique).toBe(false);
    expect(r.plan.morceaux.every((m) => m.source === "origine" && !m.fichierCle)).toBe(true);
    expect(r.passages.map((p) => p.etat)).toEqual(["retouche", "echec", "non-lance"]);
    // Le premier passage, payé, reste compté.
    expect(r.creditsDebites).toBe(26);
  });

  it("une panne réessayable a droit à un seul nouvel essai", async () => {
    const h = creerHiggsfieldSimule({ lancementsEnEchec: [0] });
    const r = await appliquerDecor(entree(), deps({ higgsfield: h }));
    expect(r.statut).toBe("applique");
    expect(r.passages[0].essais).toBe(2);
    const h2 = creerHiggsfieldSimule({ lancementsEnEchec: [0, 1] });
    const r2 = await appliquerDecor(entree(), deps({ higgsfield: h2 }));
    expect(r2.statut).toBe("repli");
    expect(h2.lancements).toHaveLength(2);
  });

  it("lèvres décalées sur un passage : repli complet", async () => {
    let n = 0;
    const r = await appliquerDecor(entree(), deps({ mesurer: async () => (n++ === 1 ? { ...BONNES_MESURES, ecartBoucheMs: 200 } : BONNES_MESURES) }));
    expect(r.statut).toBe("repli");
    expect(r.raison).toBe("raccord");
    expect(r.plan.morceaux.every((m) => m.source === "origine")).toBe(true);
  });

  it("durée de sortie décalée : repli (on ne change jamais la vitesse pour rattraper)", async () => {
    const r = await appliquerDecor(entree(), deps({ higgsfield: creerHiggsfieldSimule({ decalageDureeSec: 0.6 }) }));
    expect(r.statut).toBe("repli");
    expect(r.passages[0].verdict?.raisons).toContain("duree");
  });

  it("une dépendance qui lève devient un repli, jamais une exception", async () => {
    const r = await appliquerDecor(entree(), deps({ deposerPassage: async () => { throw new Error("R2 en panne"); } }));
    expect(r.statut).toBe("repli");
    expect(r.plan.decorApplique).toBe(false);
  });

  it("solde insuffisant (devis de la vidéo entière avec marge) : rien ne part", async () => {
    const h = creerHiggsfieldSimule({ soldeCredits: 90 });
    const r = await appliquerDecor(entree(), deps({ higgsfield: h }));
    expect(r.statut).toBe("non-lance");
    expect(r.raison).toBe("solde-insuffisant");
    expect(h.lancements).toHaveLength(0);
    expect(h.medias).toHaveLength(0);
    expect(r.lignes).toEqual([]);
  });

  it("plafond du mois : rien ne part, pas même la lecture du solde", async () => {
    const h = creerHiggsfieldSimule();
    const lire = vi.spyOn(h, "lireSolde");
    const r = await appliquerDecor(entree({ restantDuMoisCentimes: 100 }), deps({ higgsfield: h }));
    expect(r.raison).toBe("plafond");
    expect(lire).not.toHaveBeenCalled();
    expect(tientDansLePlafond(82, 100_00)).toBe(true);
    expect(tientDansLePlafond(82, 4_00)).toBe(false);
  });

  it("Kling sans image de référence, ou sans description : rien ne part", async () => {
    expect((await appliquerDecor(entree({ imageReference: undefined }), deps())).raison).toBe("image-reference-manquante");
    expect((await appliquerDecor(entree({ decor: { description: "" } }), deps())).raison).toBe("consigne-vide");
    // FLUX accepte une consigne sans image (1 crédit/s).
    const r = await appliquerDecor(entree({ imageReference: undefined, modele: "flux_3_video_edit" }), deps());
    expect(r.statut).toBe("applique");
    expect(r.creditsDebites).toBe(13 + 14 + 14);
  });
});

describe("fournisseur Higgsfield", () => {
  it("simulation par défaut ; le réel exige la demande de l'appelant, la clé et une adresse https", () => {
    const complet = { HIGGSFIELD_API_KEY: "cle-secrete-123456", HIGGSFIELD_API_URL: "https://api.exemple" };
    expect(fournisseurHiggsfield({}, {}).mode).toBe("simulation");
    expect(fournisseurHiggsfield({}, complet).mode).toBe("simulation");
    expect(fournisseurHiggsfield({ reel: true }, { HIGGSFIELD_API_KEY: "cle-secrete-123456" }).mode).toBe("simulation");
    expect(fournisseurHiggsfield({ reel: true }, { ...complet, HIGGSFIELD_API_URL: "http://x" }).mode).toBe("simulation");
    expect(fournisseurHiggsfield({ reel: true }, complet).mode).toBe("reel");
  });

  it("devis : seconde entamée comptée ; FLUX 1 crédit/s, Kling 2 crédits/s", () => {
    expect(creditsPourPassage("flux_3_video_edit", 15)).toBe(15);
    expect(creditsPourPassage("flux_3_video_edit", 12.12)).toBe(13);
    expect(creditsPourPassage("kling_video_edit", 15)).toBe(30);
  });

  it("refuse avant tout appel : passage trop long, image manquante pour Kling", () => {
    const base = { modele: "flux_3_video_edit" as const, videoMediaId: "m", consigne: "x", dureeSec: 16, idempotence: "i" };
    expect(verifierDemande(base)?.code).toBe("trop-long");
    expect(verifierDemande({ ...base, modele: "kling_video_edit", dureeSec: 10 })?.code).toBe("refuse");
    expect(verifierDemande({ ...base, dureeSec: 15 })).toBeNull();
  });

  it("le double débite le solde et rend une sortie 704×1248 à 24 i/s de même durée", async () => {
    const h = creerHiggsfieldSimule({ soldeCredits: 20 });
    const l = await h.lancer({ modele: "flux_3_video_edit", videoMediaId: "m", consigne: "x", dureeSec: 15, idempotence: "i" });
    expect(l.ok).toBe(true);
    expect(h.soldeCredits()).toBe(5);
    const e = await h.suivre(l.ok ? l.idTravail : "");
    expect(e.statut === "termine" && e.resultat).toMatchObject({ largeur: 704, hauteur: 1248, ips: 24, dureeSec: 15 });
    expect((await h.lancer({ modele: "flux_3_video_edit", videoMediaId: "m", consigne: "x", dureeSec: 15, idempotence: "j" })).ok).toBe(false);
  });

  it("client HTTP (faux réseau) : envoi en 3 temps sans la clé vers l'adresse présignée, préréglage refusé transmis, clé jamais dans un message", async () => {
    const cle = "hf-cle-tres-secrete-9876";
    const appels: { url: string; init: RequestInit }[] = [];
    const faux = (async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } });
      if (url.endsWith("/v1/media_upload")) return json({ media_id: "med1", upload_url: "https://depot.exemple/put/med1" });
      if (url.startsWith("https://depot.exemple")) return new Response(null, { status: 200 });
      if (url.endsWith("/confirm")) return json({});
      if (url.endsWith("/v1/generations")) return json({ job_id: "job1" });
      if (url.endsWith("/v1/generations/job1")) return json({ status: "completed", credits_used: 15, result: { url: "https://cdn.exemple/out.mp4", width: 704, height: 1248, duration: 15.04, fps: 24 } });
      if (url.endsWith("/v1/account/balance")) return json({ error: cle }, 401);
      return json({}, 404);
    }) as unknown as typeof fetch;
    const h = creerHiggsfieldHttp("https://api.exemple/", cle, { fetch: faux });
    const m = await h.envoyerMedia({ nom: "p.mp4", type: "video/mp4", octets: new Uint8Array([1]) });
    expect(m).toEqual({ ok: true, mediaId: "med1" });
    const put = appels.find((a) => a.url.startsWith("https://depot.exemple"))!;
    expect(JSON.stringify(put.init.headers)).not.toContain(cle);
    const l = await h.lancer({ modele: "flux_3_video_edit", videoMediaId: "med1", consigne: "decor", dureeSec: 15, prereglageRefuseId: "preset-42", idempotence: "vid1-0" });
    expect(l).toEqual({ ok: true, idTravail: "job1" });
    const corps = JSON.parse(String(appels.find((a) => a.url.endsWith("/v1/generations"))!.init.body));
    expect(corps).toMatchObject({ model: "flux_3_video_edit", params: { declined_preset_id: "preset-42", video_media_id: "med1" } });
    const e = await h.suivre("job1");
    expect(e).toMatchObject({ statut: "termine", resultat: { creditsDebites: 15, dureeSec: 15.04 } });
    const s = await h.lireSolde();
    expect(s.ok).toBe(false);
    expect(JSON.stringify(s)).not.toContain(cle);
    // Demande invalide : aucun appel réseau.
    const avant = appels.length;
    expect((await h.lancer({ modele: "kling_video_edit", videoMediaId: "m", consigne: "x", dureeSec: 10, idempotence: "k" })).ok).toBe(false);
    expect(appels.length).toBe(avant);
  });
});

describe("service décor IA (réglage et point d'insertion)", () => {
  it("coupé par défaut : la passe est ignorée sans aucun appel ; réglage mal formé → coupé", async () => {
    const { lireReglageBrut, passeDecorFacecam, REGLAGE_DECOR_IA_PAR_DEFAUT } = await import("@/services/decor-ia");
    expect(REGLAGE_DECOR_IA_PAR_DEFAUT.actif).toBe(false);
    expect(lireReglageBrut({ actif: "oui", modele: "autre", imageReferenceCle: "x".repeat(500) })).toEqual({ actif: false, description: "", modele: "kling_video_edit", reel: false });
    const h = creerHiggsfieldSimule();
    const extraire = vi.fn(async () => new Uint8Array([1]));
    const r = await passeDecorFacecam({ videoId: "v", travailId: "t", dureeUtileSec: 30, higgsfield: h, lireImageReference: async () => IMAGE, extrairePassage: extraire, deposerPassage: async () => "c", mesurer: async () => BONNES_MESURES });
    expect(r).toBeNull();
    expect(extraire).not.toHaveBeenCalled();
    expect(h.lancements).toHaveLength(0);
  });
});
