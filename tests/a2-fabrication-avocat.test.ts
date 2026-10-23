/**
 * VÉRIFICATION A2 — fabrication d'une vidéo « type avocat » de bout en bout (10/10).
 * Défauts trouvés par la vérification, chacun écrit ROUGE avant sa correction.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { choisirModele } from "@/briques/motion";
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

describe("A2 · cartes motion de l'avocat après les correctifs face caméra du 10/10 (choix.ts partagé)", () => {
  const points = (p: string) => {
    const c = choisirModele(p);
    return c?.carte.modele === "liste" ? c.carte.donnees.elements.map((e) => e.texte) : null;
  };

  it("une liste de sigles reste une liste (TVA, URSSAF, CFE) — le filtre des mots de liaison ne jette plus les sigles", () => {
    expect(points("Trois pièges : TVA, URSSAF et CFE.")).toEqual(["TVA", "URSSAF", "CFE"]);
  });

  it("aucun sigle n'est perdu dans une liste annoncée (SAS, SARL, EURL)", () => {
    expect(points("Trois statuts : SAS, SARL ou EURL.")).toEqual(["SAS", "SARL", "EURL"]);
  });

  it("« trois contrats : le CDI, le CDD et l'intérim » donne une liste de trois points, titrée, sans l'annonce comme point", () => {
    const c = choisirModele("Il existe trois contrats : le CDI, le CDD et l'intérim.");
    expect(c?.modele).toBe("liste");
    if (c?.carte.modele !== "liste") return;
    expect(c.carte.donnees.elements.map((e) => e.texte)).toEqual(["Le CDI", "Le CDD", "L'intérim"]);
    expect(c.carte.donnees.titre).toMatch(/trois contrats/i);
  });

  it("le complément de l'annonce n'est pas un point (« trois erreurs à ne pas commettre : … »)", () => {
    expect(points("Voici trois erreurs à ne pas commettre : payer trop vite, oublier le délai, ignorer la photo.")).toEqual(["Payer trop vite", "Oublier le délai", "Ignorer la photo"]);
  });

  it("un « vérifiez » au milieu d'une énumération : check-list de 3 cases, titrée « Trois réflexes »", async () => {
    const { choisirModeleTous } = await import("@/briques/motion");
    const c = choisirModeleTous("Trois réflexes : lisez l'avis, vérifiez la plaque de la voiture, contestez dans les délais.");
    expect(c?.modele).toBe("check-list");
    const d = (c?.carte as { donnees: { titre?: string; elements: { texte: string }[] } }).donnees;
    expect(d.elements).toHaveLength(3);
    expect(d.titre).toBe("Trois réflexes");
  });

  it("les correctifs du 10/10 tiennent toujours : « un outil de plus » et « une chose à faire » n'annoncent pas de liste ; « De plus » n'est jamais un point", () => {
    expect(choisirModele("Vous avez une chose à faire : envoyer un recommandé.")).toBeNull();
    expect(points("C'est un outil de plus, et puis il est gratuit, simple et rapide.") ?? []).not.toContain("De plus");
  });
});

describe("A2 · double et voix HeyGen (doubles, aucun appel réel)", async () => {
  const { erreurRendu, corpsRendu } = await import("@/fournisseurs/heygen/rendus");
  const { erreurDepuisReponse } = await import("@/fournisseurs/heygen/client");
  const { creerFournisseurVoixHeygen } = await import("@/fournisseurs/heygen/voix");

  it("un rendu refusé pour l'accord (« Access denied: consent… ») est un refus, pas un son illisible réessayé 3 fois", () => {
    const e = erreurRendu({ failure_code: "consent_required", failure_message: "Access denied: consent not granted for this avatar" });
    expect(e).toMatchObject({ code: "refuse", reessayable: false });
  });

  it("un look introuvable est un refus lisible (double ou tenue), pas « HeyGen n'a pas pu lire le son »", () => {
    const e = erreurRendu({ failure_code: "AVATAR_NOT_FOUND", failure_message: "Avatar look not found" });
    expect(e).toMatchObject({ code: "refuse", reessayable: false });
    expect(e.message).toMatch(/ne trouve plus votre double/);
    // Le son illisible reste reconnu.
    expect(erreurRendu({ failure_code: "AUDIO_DOWNLOAD_FAILED", failure_message: "Failed to download audio from url" }).code).toBe("fichier-inaccessible");
  });

  it("refus 400 : « sans fond impossible » seulement quand HeyGen parle de détourage, pas d'un simple « mp4/webm »", () => {
    expect(erreurDepuisReponse(400, { error: { code: "invalid_parameter", message: "title too long (mp4/webm)" } }).sansFondImpossible).toBe(false);
    const vrai = erreurDepuisReponse(400, { error: { code: "invalid_parameter", message: "This video avatar does not support webm output. The avatar must be trained with matting enabled." } });
    expect(vrai.sansFondImpossible).toBe(true);
    expect(vrai.message).toBe("HeyGen a refusé la demande.");
  });

  it("reference_look_id part dans engine, jamais au premier niveau", () => {
    const c = corpsRendu({ lookId: "look-decor", audioUrl: "https://x/a.mp3", titre: "t", cleIdempotence: "k", avecSonFond: true, referenceLookId: "look-filme" });
    expect(c.engine).toEqual({ type: "avatar_v", reference_look_id: "look-filme" });
    expect(c).not.toHaveProperty("reference_look_id");
  });

  const voix = () =>
    creerFournisseurVoixHeygen({
      client: { requete: async () => ({ audio_url: "https://h/a.mp3", duration: 1, word_timestamps: [] }), requeteEntiere: async () => ({}), telecharger: async () => ({ octets: new Uint8Array(), mime: "audio/mpeg" }) } as never,
      stockage: () => ({ mode: "simulation" }) as never,
    });

  it("voix payée : coût tracé au centime supérieur (jamais 0 €) et au taux de la commande", async () => {
    const court = await voix().lire({ idExterne: "v", texte: "Bonjour maître.", reglages: { vitesse: 1, stabilite: 50, emotion: 50 }, prononciations: [] });
    expect(court.cout.centimes).toBeGreaterThanOrEqual(1);
    const texte = "a".repeat(1000); // 1 000 caractères × 0,03 ¢ US = 30 ¢ US
    const r = await voix().lire({ idExterne: "v", texte, reglages: { vitesse: 1, stabilite: 50, emotion: 50 }, prononciations: [], tauxUsdEur: 0.95 });
    expect(r.cout.centimes).toBe(29); // 28,5 → 29 (et non 27 au taux par défaut)
  });
});

describe("A2 · coût affiché et confirmation : mêmes règles à l'écran et au serveur", async () => {
  const { decisionLancement } = await import("@/assistant/express/logique");
  const { reinitialiserDepots } = await import("@/donnees/memoire");
  const auth = await import("@/services/auth");
  const videos = await import("@/services/videos");
  const scripts = await import("@/services/scripts");
  const fabrication = await import("@/services/fabrication");
  const { verifierBudgetEtCredits } = await import("@/services/credits");
  const { ecrireParametre } = await import("@/services/_commun");
  const { centimes } = await import("@/lib/montants");
  const { centimesBloquants } = await import("@/domaine/credits");

  beforeAll(async () => {
    await preparerMotDePasse("essai-a2");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-a2", false);
  });

  async function brouillonAvocat() {
    await ecrireParametre("afficherExemples", false);
    const blocs = [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre employeur peut-il lire vos courriels ? La réponse est non, sauf exceptions. ".repeat(4) }] }];
    const scriptId = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Courriels au travail", blocs } as never);
    return videos.creerBrouillon("avocat", { scriptId });
  }

  it("l'aperçu donne à Express le montant que le serveur compare (textes des réseaux facultatifs retirés)", async () => {
    const videoId = await brouillonAvocat();
    const a = await fabrication.apercuFabrication(videoId);
    expect(a.budget.bloquant.centimes).toBe(centimesBloquants(a.estimation));
    // Avec ce montant, Express ne bloque que si le serveur bloquerait.
    const d = decisionLancement({ coutCentimes: a.budget.bloquant.centimes, seuilCentimes: 1e9, resteCentimes: a.budget.bloquant.centimes, aVerifier: [] });
    expect(d.genre).not.toBe("budget");
  });

  it("une ligne réellement payée compte toujours : budget dépassé si elle dépasse le restant", async () => {
    await ecrireParametre("budget.mensuel", centimes(10));
    const estimation = { lignes: [{ etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 1000, prixUnitaire: centimes(1), total: centimes(50), nature: "estime" }], total: centimes(50) } as never;
    await expect(verifierBudgetEtCredits(estimation, true, "Cette vidéo")).rejects.toThrow(/budget du mois serait dépassé/i);
  });
});

describe("A2 · monteur avocat : jamais « C'est fait » quand rien n'est fait", async () => {
  const m = await import("@/moteurs/montage-avocat/monteur");
  const mots = "bonjour parlons du licenciement abusif aujourd'hui".split(" ").map((mot, i) => ({ mot, debutSec: i, finSec: i + 0.9 }));
  const plans = [
    { ordre: 0, debutSec: 0, finSec: 3, sourceImage: "double", cadrage: { valeur: "large", zoom: 1 } },
    { ordre: 1, debutSec: 3, finSec: 6, sourceImage: "illustration", cadrage: { valeur: "large", zoom: 1 } },
  ] as never[];

  it("zoom demandé sur un mot dit pendant une illustration : refus clair, pas « C'est fait »", () => {
    const d = m.deciderMonteurAvocat({ consignes: [{ id: "f1", origine: "fil", texte: "zoome quand je dis « licenciement »" }] }, mots, plans, false);
    expect(d.plansZoom).toEqual([]);
    expect(d.reponse).not.toMatch(/C'est fait/);
    expect(d.reponse).toBe(m.REFUS_ZOOM_ILLUSTRATION);
  });

  it("zoom sur un mot dit face au double : appliqué et « C'est fait »", () => {
    const d = m.deciderMonteurAvocat({ consignes: [{ id: "f1", origine: "fil", texte: "zoome quand je dis « parlons »" }] }, mots, plans, false);
    expect(d.plansZoom).toEqual([0]);
    expect(d.reponse).toMatch(/^C'est fait/);
  });

  it("« 3 caméras » sans prise filmée : refus clair ; avec prises filmées : demandé", () => {
    const sans = m.deciderMonteurAvocat({ consignes: [{ id: "f1", origine: "fil", texte: "fais-le en 3 caméras" }] }, mots, plans, false, { prisesFilmees: false });
    expect(sans.multicamera).toBeUndefined();
    expect(sans.reponse).toBe(m.REFUS_TROIS_CAMERAS_DOUBLE);
    const avec = m.deciderMonteurAvocat({ consignes: [{ id: "f1", origine: "fil", texte: "fais-le en 3 caméras" }] }, mots, plans, false, { prisesFilmees: true });
    expect(avec.multicamera).toBe(true);
    expect(avec.reponse).toMatch(/^C'est fait/);
  });
});

describe("A2 · après la création : modification d'une vraie vidéo avocat, budget engagé", async () => {
  const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
  const auth = await import("@/services/auth");
  const modifs = await import("@/services/modifications");
  const couts = await import("@/services/couts");
  const { ecrireParametre } = await import("@/services/_commun");

  beforeAll(async () => {
    await preparerMotDePasse("essai-a2b");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-a2b", false);
  });

  it("vraie vidéo avocat : pas de prix proposé puis refusé — la réponse dit tout de suite que la retouche n'existe pas", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
    await depots().videos.modifier(v.id, { estDemo: false });
    await depots().versions.modifier(ver.id, { commande: { ...ver.commande, moteurId: "montage-avocat" }, estDemo: false });
    const p = await modifs.proposerModification("v-03", "changez l'image du plan 2");
    expect(p.statut).toBe("hors-capacite");
    expect(p.cout.centimes).toBe(0);
    expect(p.horsCapacite?.message).toMatch(/pas encore disponible/);
  });

  it("une voix payée pendant la fabrication n'est pas comptée deux fois (dépense + engagement entier)", async () => {
    await ecrireParametre("budget.mensuel", { centimes: 10000, devise: "EUR" });
    const t0 = (await depots().travaux.lister())[0];
    await depots().travaux.enregistrer({ ...t0, id: "trav-a2", statut: "en_cours", estDemo: false } as never);
    await couts.engagerBudget("trav-a2", { centimes: 3000, devise: "EUR" }, "v-03");
    const avant = (await couts.resumeBudget()).restant.centimes;
    const le = new Date().toISOString();
    await depots().depenses.enregistrer({ id: "dep-a2", videoId: "v-03", travailId: "trav-a2", lignes: [{ etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 1000, prixUnitaire: { centimes: 1, devise: "EUR" }, total: { centimes: 1000, devise: "EUR" }, nature: "reel" }], total: { centimes: 1000, devise: "EUR" }, date: le, creeLe: le, modifieLe: le, estDemo: false } as never);
    const apres = await couts.resumeBudget();
    expect(apres.restant.centimes).toBe(avant);
    expect(apres.engage.centimes).toBe(2000);
  });
});

describe("A2 · plateau : posture du double", async () => {
  const { resoudreVisagesParAngle } = await import("@/domaine/distribution");
  const base = { personnageId: "p", tenue: "Costume", tenueId: "costume", statut: "pret", fournisseur: "heygen", origine: "filme" } as const;
  const A = { ...base, id: "A", nom: "A", angle: "trois-quarts", posture: "assis" } as never;
  const B = { ...base, id: "B", nom: "B", angle: "face", posture: "debout" } as never;
  const C = { ...base, id: "C", nom: "C", angle: "face", posture: "assis" } as never;

  it("une posture de vidéo restée « debout » n'associe jamais un principal assis à un second angle debout", () => {
    const r = resoudreVisagesParAngle({ visages: [A, B], principal: A, posture: "debout", partSecond: 0.3 });
    expect(r.modeAngles).toBe("un-angle");
    expect(r.posture).toBe("assis");
  });

  it("même posture des deux côtés : deux angles", () => {
    const r = resoudreVisagesParAngle({ visages: [A, B, C], principal: A, posture: "debout", partSecond: 0.3 });
    expect(r.visagesParAngle).toEqual({ "trois-quarts": "A", face: "C" });
    expect(r.modeAngles).toBe("deux-angles");
  });
});

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const vmafPresent = ffmpegPresent && spawnSync("ffmpeg", ["-hide_banner", "-filters"]).stdout.toString().includes("libvmaf");

describe("A2 · export réel (FFmpeg) : le master avocat garde une image par image avec un décor PNG", async () => {
  const { argumentsImageFfmpeg } = await import("../studio-rendu/src/composition/image-ffmpeg");

  it.skipIf(!ffmpegPresent)("100 images, deux plans coupés à 2,26 s : aucun horodatage doublé ni sauté", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-a2-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    run(["-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=25:d=4,format=yuva420p", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "2M", "double.webm"]);
    run(["-f", "lavfi", "-i", "color=c=0x110A05:s=1080x1920", "-frames:v", "1", "decor-pret.png"]);
    run(["-f", "lavfi", "-i", "sine=f=220:d=4.1:sample_rate=48000", "son.wav"]);
    const cadrage = (valeur: "large" | "poitrine", zoom: number) => ({ valeur, zoom, zoomFin: zoom, pointX: 0.5, pointY: 0.38 });
    const p = {
      ratio: "9:16", largeur: 1080, hauteur: 1920, fps: 25, images: 100,
      decor: { teinte: "#110A05", directionLumiere: "face", flouPx: 0, clair: false },
      doubles: { principal: { type: "video", url: "entree:double", transparent: true } },
      plans: [
        { debutSec: 0, finSec: 2.26, type: "double", angle: "principal", cadrage: cadrage("large", 1) },
        { debutSec: 2.26, finSec: 4, type: "double", angle: "principal", cadrage: cadrage("poitrine", 1.2) },
      ],
    } as never;
    run(argumentsImageFfmpeg(p, { grainPct: 0, grainTaillePx: 2, vignettePct: 0 }, { decor: "decor-pret.png", doubles: { principal: { fichier: "double.webm", video: true } }, illustrations: {}, luts: [], son: "son.wav" }, 4, "master.mov").slice(2));
    const pts = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v", "-show_entries", "frame=pts_time", "-of", "csv=p=0", join(dossier, "master.mov")]).stdout.toString().trim().split("\n").map((l) => parseFloat(l));
    expect(pts).toHaveLength(100);
    expect(pts.map((t, i) => Math.round(t * 25) - i).filter((x) => x !== 0)).toEqual([]);
  }, 60_000);
});

describe("A2 · note VMAF réelle : les images comparées sont appariées par instant, pas par numéro", async () => {
  const { argumentsVmaf, lireVmaf } = await import("../studio-rendu/src/composition/ffmpeg");
  const { readFileSync } = await import("node:fs");

  it.skipIf(!vmafPresent)("un export à qui il manque UNE image garde une note juste (une image sur 5)", () => {
    const dossier = mkdtempSync(join(tmpdir(), "studio-a2-vmaf-"));
    const run = (args: string[]) => {
      const r = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...args], { cwd: dossier });
      if (r.status !== 0) throw new Error(r.stderr.toString());
    };
    run(["-f", "lavfi", "-i", "testsrc2=s=540x960:r=25:d=3", "-c:v", "libx264", "-crf", "8", "-pix_fmt", "yuv420p", "master.mov"]);
    run(["-f", "lavfi", "-i", "color=c=black@0.0:s=540x960:r=25:d=3,format=argb", "-c:v", "qtrle", "texte.mov"]);
    // Export : l'image 20 manque (horodatages gardés), tout le reste est identique.
    run(["-i", "master.mov", "-vf", "select='not(eq(n\\,20))'", "-fps_mode", "passthrough", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "video.mp4"]);
    const e = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 256, audioHz: 48000, mode: "crf" as const, crf: 17 };
    const r = spawnSync("ffmpeg", argumentsVmaf("video.mp4", "master.mov", "texte.mov", e, "vmaf.json", 2, 5), { cwd: dossier });
    if (r.status !== 0) throw new Error(r.stderr.toString().slice(-800));
    const note = lireVmaf(readFileSync(join(dossier, "vmaf.json"), "utf8"));
    expect(note!.vmaf).toBeGreaterThan(90);
    expect(note!.vmafMin).toBeGreaterThan(80);
  }, 60_000);
});

describe("A2 · multicaméra de l'avocat : l'accroche part toujours de face", async () => {
  const { realiserMulticamera } = await import("@/briques/multicamera/realisation");
  const dire = (texte: string, de: number, a: number, bloc: string) => {
    const m = texte.split(" ");
    const pas = (a - de) / m.length;
    return m.map((mot, i) => ({ mot, debutSec: +(de + i * pas).toFixed(3), finSec: +(de + (i + 0.9) * pas).toFixed(3), bloc }));
  };
  it("accroche puis appel (deux passages qui veulent la face) : la face va à l'accroche", () => {
    const mots = [...dire("Vous recevez un PV de cent trente cinq euros ?", 0, 3.2, "accroche"), ...dire("Abonnez-vous pour ne rien rater de vos droits.", 3.4, 6.4, "appel")];
    for (const anglesDisponibles of [["face", "cote", "contre-plongee"], ["face", "cote"]] as const) {
      const plans = realiserMulticamera({ mots, anglesDisponibles });
      expect(plans[0].angle).toBe("face");
    }
  });
});
