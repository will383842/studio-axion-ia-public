/**
 * LOT M4 — moteur `montage-avocat` : montage, couleurs, son et export dans `studio-rendu` (une composition par format
 * d'image, file longue), contrôles sur le fichier exporté, format ajouté et RECALQUE GRATUIT des sous-titres (sans
 * repayer ni la voix ni le visage), puis le parcours complet côté service (« Appliquer à la vidéo » : nouvelle
 * version, l'ancienne intacte, coût nul). Fournisseurs simulés ou injectés, AUCUN appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const recalque = await import("@/services/recalque");
const videos = await import("@/services/videos");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs";
import type { ParametresCompositionAvocat } from "@/moteurs/montage-avocat/scene";

const MDP_TEST = "essai-moteur-avocat-m4";
const T0 = Date.UTC(2026, 9, 2, 9, 0, 0);

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.restoreAllMocks();
  vi.useRealTimers();
  await auth.seConnecter(MDP_TEST, false);
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
  urlLecture: async (cle) => `https://r2.exemple/${cle}?court`,
  urlLectureDuree: async (cle, s) => `https://r2.exemple/${cle}?valable=${s}`,
  urlDepotDuree: async (cle, s) => `https://r2.exemple/${cle}?depot=${s}`,
});

/** Mesures d'un fichier exporté conforme (−14 LUFS, −2 dBTP, BT.709…). */
const MESURES_BONNES = { largeur: 1080, hauteur: 1920, fps: 25, dureeSec: 30, taille: 52_000_000, debitKbps: 14_050, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, lufs: -14.1, lra: 2.2, creteVraieDbtp: -2.0, pauses: 9, pauseMinDb: -44, pauseMaxDb: -41 };

/** studio-rendu injecté : chaque demande se termine au tour suivant ; la composition renvoie ses mesures. */
function fauxRendu(options: { mesures?: Record<string, number>; echecs?: number } = {}) {
  const recues: DemandeRendu[] = [];
  const etats = new Map<string, EtatRendu>();
  let echecs = options.echecs ?? 0;
  const service: ServiceRendu = {
    async soumettre(d) {
      recues.push(d);
      if (d.operation === "composition" && echecs > 0) {
        echecs--;
        etats.set(d.idRendu, { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "panne" } });
      } else etats.set(d.idRendu, { statut: "termine", sortieCle: d.sortie.cle, mesures: d.operation === "composition" ? (options.mesures ?? MESURES_BONNES) : undefined });
      return { idRendu: d.idRendu };
    },
    etat: async (id) => etats.get(id) ?? { statut: "inconnu" },
  };
  return { recues, service, compositions: () => recues.filter((d) => d.operation === "composition") };
}

/** Voix espionnée : compte les lectures (une voix déjà payée ne doit jamais être relue). */
function voixEspion() {
  const appels = { n: 0 };
  const voix: FournisseurVoix = { ...fournisseurVoixSimulation, lire: async (d) => (appels.n++, fournisseurVoixSimulation.lire(d)) };
  return { appels, voix: () => voix };
}

async function jusquAuBout(moteur: MoteurVideo, c: CommandeFabrication, t: Travail, depuis = T0): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
  let travail = t;
  let resultat: ResultatFabrication | undefined;
  for (let ms = depuis; ms < depuis + 10 * 60_000; ms += 500) {
    const r = await moteur.avancer(travail, c, ms);
    travail = r.travail;
    resultat = r.resultat ?? resultat;
    if (travail.statut === "termine" || travail.statut === "echec") return { travail, resultat };
  }
  throw new Error(`bloqué : ${travail.statut}`);
}

describe("fabrication : montage, couleurs, son et export dans studio-rendu (B.7)", () => {
  it("une composition par format d'image (file longue), entrées et dépôts signés ; sorties, master sans texte, coût nul", async () => {
    const rendu = fauxRendu();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    const { travail, resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-m4", versionId: "ver-m4", titre: "M4", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    const compos = rendu.compositions();
    expect(compos.map((d) => (d.parametres as ParametresCompositionAvocat).ratio).sort()).toEqual([...c.ratios].sort());
    for (const d of compos) {
      const p = d.parametres as Extract<ParametresCompositionAvocat, { mode: "complet" }>;
      expect(d.file).toBe("longue");
      expect(p.mode).toBe("complet");
      expect(Object.values(d.entrees).every((u) => u.startsWith("https://r2.exemple/"))).toBe(true);
      expect(d.entrees).toHaveProperty("voix");
      expect(d.entrees).toHaveProperty("decor");
      expect(d.sortie.urlDepot).toMatch(/depot=3600/);
      expect(p.depots.master.cle).toMatch(/master-sans-texte\.mov$/);
      expect(p.son).toMatchObject({ lufs: -14, creteVraieMaxDbtp: -1.5 });
      expect(p.export).toMatchObject({ fps: 25, debitKbps: 14000, audioKbps: 256, audioHz: 48000, mode: "crf", crf: 17 });
      expect(p.image.plans.length).toBeGreaterThan(3);
      expect(p.texte.sousTitres?.segments.length).toBeGreaterThan(0);
    }
    const r = resultat!;
    expect(r.sorties.map((s) => s.fichierCle).sort()).toEqual(compos.map((d) => d.sortie.cle).sort());
    expect(r.sorties[0].rapportQualite.niveauSonoreLufs).toBe(-14.1);
    expect(r.pistes?.filter((p) => p.type === "master-sans-texte").map((p) => p.ratio).sort()).toEqual([...c.ratios].sort());
    for (const cle of ["montage", "etalonnage", "son", "export"]) expect(travail.etapes.find((e) => e.cle === cle)).toMatchObject({ statut: "terminee", coutReel: { centimes: 0 } });
    expect(r.lignesReelles.map((l) => l.etape)).not.toContain("Montage");
    expect((r.projetMontage as { plansProduits?: unknown[] }).plansProduits?.length).toBeGreaterThan(0);
  });

  it("mesures du fichier exporté hors cible : alertes « niveau-sonore », « export », « image-noire » (jamais bloquantes)", async () => {
    const rendu = fauxRendu({ mesures: { ...MESURES_BONNES, lufs: -16.3, creteVraieDbtp: -0.6, bt709: 0, imageNoireTete: 1 } });
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
    const c = await fabrication.construireCommande("v-03");
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-m4b", versionId: "ver-m4b", titre: "M4", maintenant: T0 }));
    const codes = resultat!.sorties[0].rapportQualite.alertes.map((a) => a.code);
    expect(codes).toEqual(expect.arrayContaining(["niveau-sonore", "export", "image-noire"]));
    expect(resultat!.sorties[0].rapportQualite.alertes.every((a) => a.gravite !== "bloquant")).toBe(true);
    expect(resultat!.noteQualite.globale).toBeLessThan(92);
  });

  it("échec passager du conteneur : nouvelle demande de composition (même format, identifiant -e1)", async () => {
    const rendu = fauxRendu({ echecs: 1 });
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne });
    const c = { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
    const { travail } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-m4c", versionId: "ver-m4c", titre: "M4", maintenant: T0 }));
    expect(travail.statut).toBe("termine");
    expect(rendu.compositions().map((d) => d.idRendu.replace(/^.*-9x16-/, ""))).toEqual(["compo", "compo-e1"]);
  });
});

describe("format ajouté et recalque : recomposés sans rien repayer (B.0 §20, B.9)", () => {
  async function fabriquee() {
    const rendu = fauxRendu();
    const espion = voixEspion();
    const m = creerMoteurMontageAvocat({ rendu: rendu.service, stockage: stockageSigne, voix: espion.voix });
    const c = { ...(await fabrication.construireCommande("v-03")), ratios: ["9:16" as const] };
    const { resultat } = await jusquAuBout(m, c, await m.lancer(c, { travailId: "t-f", versionId: "ver-f", titre: "F", maintenant: T0 }));
    const parent = { versionId: "ver-f", projetMontage: resultat!.projetMontage, pistes: (resultat!.pistes ?? []).map((p) => ({ type: p.type, fichierCle: p.fichierCle, ratio: p.ratio })) };
    return { rendu, espion, m, c, resultat: resultat!, parent };
  }

  it("format ajouté (4:5) : gratuit, une seule composition « complet » de ce format, la voix n'est pas relue", async () => {
    const f = await fabriquee();
    const lectures = f.espion.appels.n;
    expect((await f.m.estimerReexport(f.c, "4:5")).total.centimes).toBe(0);
    const avant = f.rendu.compositions().length;
    const t = await f.m.reexporter({ commande: { ...f.c, ratios: ["4:5"] }, contexte: { travailId: "t-x", versionId: "ver-f", titre: "X", maintenant: T0 }, cible: { ratio: "4:5" }, parent: f.parent, segments: f.resultat.sousTitres });
    expect(t.type).toBe("reexport");
    const { travail, resultat } = await jusquAuBout(f.m, { ...f.c, ratios: ["4:5"] }, t);
    expect(travail.statut).toBe("termine");
    const nouvelles = f.rendu.compositions().slice(avant);
    expect(nouvelles).toHaveLength(1);
    expect((nouvelles[0].parametres as ParametresCompositionAvocat).ratio).toBe("4:5");
    expect(nouvelles[0].entrees.voix).toContain(f.parent.pistes.find((p) => p.type === "audio-maitre")!.fichierCle);
    expect(resultat!.lignesReelles).toEqual([]);
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["4:5"]);
    expect(f.espion.appels.n).toBe(lectures);
  });

  it("recalque d'un mot corrigé : calques texte seulement, sur le master sans texte de chaque format ; coût 0, ni voix ni visage", async () => {
    const f = await fabriquee();
    const lectures = f.espion.appels.n;
    const segments = f.resultat.sousTitres!.map((s, i) => (i === 0 ? { ...s, mots: s.mots.map((x, k) => (k === 0 ? { ...x, mot: "CORRIGÉ" } : x)) } : s));
    const avant = f.rendu.recues.length;
    const t = await f.m.recalquer!({ commande: f.c, contexte: { travailId: "t-r", versionId: "ver-r", titre: "R", maintenant: T0 }, sousTitresId: "st-2", segments, parent: f.parent });
    expect(t.type).toBe("recalque-sous-titres");
    expect(t.etapes.map((e) => e.cle)).toEqual(["sous-titres", "export"]);
    const { travail, resultat } = await jusquAuBout(f.m, f.c, t);
    expect(travail.statut).toBe("termine");
    const demandes = f.rendu.recues.slice(avant);
    expect(demandes).toHaveLength(1);
    const p = demandes[0].parametres as Extract<ParametresCompositionAvocat, { mode: "recalque" }>;
    expect(p.mode).toBe("recalque");
    expect(demandes[0].entrees.master).toContain(f.parent.pistes.find((x) => x.type === "master-sans-texte")!.fichierCle);
    expect(Object.keys(demandes[0].entrees)).not.toContain("voix");
    expect(p.texte.sousTitres?.segments[0].mots[0].mot).toBe("CORRIGÉ");
    expect(resultat!.lignesReelles).toEqual([]);
    expect(travail.etapes.every((e) => e.coutReel?.centimes === 0)).toBe(true);
    expect(f.espion.appels.n).toBe(lectures);
  });

  it("recalque impossible sans image sans texte (version d'avant le lot M4, rendu réel) : message clair", async () => {
    const f = await fabriquee();
    const sansMaster = { ...f.parent, pistes: f.parent.pistes.filter((p) => p.type !== "master-sans-texte") };
    await expect(f.m.recalquer!({ commande: f.c, contexte: { travailId: "t-r2", versionId: "v", titre: "R" }, sousTitresId: "st", segments: [], parent: sansMaster })).rejects.toMatchObject({ code: "MASTER_ABSENT" });
  });
});

describe("« Appliquer à la vidéo » (service, boucle de fond, moteur en essai)", () => {
  it("nouvelle version choisie avec le mot corrigé, l'ancienne intacte, coût 0 ; la correction n'est plus « en attente »", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const { versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    for (let i = 0; i < 40 && (await depots().versions.obtenir(versionId))?.statut !== "prete"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    expect((await depots().versions.obtenir(versionId))?.statut).toBe("prete");
    const st = (await videos.sousTitresCourants(versionId))!;
    await videos.corrigerMotSousTitres("v-03", st.segments[0].id, 0, "Corrigé");
    expect(await recalque.correctionEnAttente(versionId)).toBe(true);
    const depensesAvant = await depots().depenses.compter();
    const r = await recalque.appliquerSousTitres("v-03");
    for (let i = 0; i < 40 && (await depots().versions.obtenir(r.versionId))?.statut !== "prete"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
    }
    const nouvelle = (await depots().versions.obtenir(r.versionId))!;
    const ancienne = (await depots().versions.obtenir(versionId))!;
    expect(nouvelle).toMatchObject({ statut: "prete", choisie: true, parentVersionId: versionId, noteRetouche: "Sous-titres corrigés" });
    expect(nouvelle.numero).toBe(ancienne.numero + 1);
    expect(ancienne).toMatchObject({ statut: "prete", choisie: false });
    expect((await videos.sousTitresCourants(r.versionId))!.segments[0].mots[0].mot).toBe("Corrigé");
    expect((await depots().sorties.lister((s) => s.versionId === r.versionId)).length).toBeGreaterThan(0);
    expect((await depots().sorties.lister((s) => s.versionId === versionId)).length).toBeGreaterThan(0);
    const depense = await depots().depenses.trouver((d) => d.travailId === r.travailId);
    expect(depense?.total.centimes).toBe(0);
    expect(await depots().depenses.compter()).toBe(depensesAvant + 1);
    expect((await depots().videos.obtenir("v-03"))?.versionChoisieId).toBe(r.versionId);
    expect(await recalque.correctionEnAttente(r.versionId)).toBe(false);
  });
});
