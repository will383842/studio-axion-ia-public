import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { lireMemoiresA } = await import("@/services/bibliotheque-video-memoires");
const { memoireCartesAvocat } = await import("@/services/avocat-branchements");
const { historiqueDuPlan } = await import("@/moteurs/montage-facecam-animee/realisateur/regles");
const { lireEtatV4 } = await import("@/moteurs/montage-facecam-animee/chaine-v4");
const { PROFONDEUR_MEMOIRE } = await import("@/briques/bibliotheque-video/profondeurs");

const FEN = { fenetreVideos: 50, portee: "globale" as const };
const FEN_FORMAT = { fenetreVideos: 50, portee: "format" as const };
const jour = (n: number) => `2026-11-${String(n).padStart(2, "0")}T10:00:00.000Z`;
const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

const versionAvocat = (n: number, modeles: string[], extra: Record<string, unknown> = {}) => ({
  id: `ver${n}`, videoId: `vid${n}`, statut: "prete", creeLe: jour(n), commande: { formatId: "avocat", entrees: {} },
  projetMontage: { moteur: "montage-avocat", motionCommune: { cartes: modeles.map((m, i) => ({ ratio: "9:16", modele: m, statut: "ok", debutSec: i })) } },
  ...extra,
}) as never;

const travailV4 = (n: number, cible: string, parametres: unknown) => ({ id: `tr${n}`, cibleId: cible, fournisseurUtilise: "montage-facecam-animee", creeLe: jour(n), parametres }) as never;
const etatV4 = (plan: unknown, choix?: unknown[]) => ({ version: "chaine-facecam-v4/1", etape: "transcription", demande: {}, realisation: { plan }, ...(choix ? { videos: { choix } } : {}) });

beforeEach(() => { reinitialiserDepots(); });

describe("cartes avocat", () => {
  it("5 plus récentes seulement, échec ignoré, vidéo en cours exclue, égale à memoireCartesAvocat", async () => {
    for (let n = 1; n <= 6; n++) await depots().versions.enregistrer(versionAvocat(n, [`m${n}a`, `m${n}b`]));
    // Une carte en échec dans la vidéo 3 : ignorée, les autres cartes de la vidéo restent.
    await depots().versions.enregistrer(versionAvocat(3, [], { projetMontage: { moteur: "montage-avocat", motionCommune: { cartes: [{ ratio: "9:16", modele: "m3a", statut: "ok", debutSec: 0 }, { ratio: "9:16", modele: "zz", statut: "echec", debutSec: 1 }, { ratio: "9:16", modele: "m3b", statut: "ok", debutSec: 2 }] } } }));
    const r = await lireMemoiresA({ formatId: "avocat", videoIdEnCours: "vid6", fenetre: FEN_FORMAT });
    const cartes = r.usages.filter((u) => u.source === "avocat-cartes");
    expect(new Set(cartes.map((u) => u.videoId))).toEqual(new Set(["vid5", "vid4", "vid3", "vid2", "vid1"]));
    expect(cartes.every((u) => u.capacite === "motion.cartes-communes" && u.cle.startsWith("carte:"))).toBe(true);
    expect(r.profondeurs["avocat-cartes"]).toBe(5);
    const ancien = await memoireCartesAvocat("vid6");
    expect(cartes.map((u) => u.cle.replace("carte:", "")).sort()).toEqual([...ancien.dejaServis].sort());
  });
});

describe("v4", () => {
  const plan = { cartes: [], fenetres: [], calques: [], elementsV4: [{ famille: "x" }] };
  it("choix pexels, état illisible ignoré, 5 vidéos au plus", async () => {
    for (let n = 1; n <= 6; n++) await depots().travaux.enregistrer(travailV4(n, `vid${n}`, { facecamAnimeeV4: etatV4(plan, [{ fichier: "f", source: "pexels", id: `p${n}`, scene: "s" }]) }));
    await depots().travaux.enregistrer(travailV4(8, "vid8", { facecamAnimeeV4: "n'importe quoi" }));
    const r = await lireMemoiresA({ formatId: "facecam-animee", fenetre: FEN_FORMAT });
    const ex = r.usages.filter((u) => u.source === "v4-extraits");
    expect(ex.map((u) => u.cle).sort()).toEqual(["pexels:p2", "pexels:p3", "pexels:p4", "pexels:p5", "pexels:p6"]);
    expect(ex.every((u) => u.capacite === "ecran.clip-v4")).toBe(true);
    expect(r.profondeurs["v4-extraits"]).toBe(5);
    expect(r.usages.some((u) => u.source === "avocat-cartes")).toBe(false);
  });
});

describe("familles v4", () => {
  // Les familles viennent des cartes / fenêtres / calques (apparitionsDuPlan) ; `elementsV4` rend le plan « v4 » pour le filtre.
  const planDe = (n: number) => ({
    cartes: [{ debut: n % 2 ? 0 : 1, fin: 2, contenu: { type: "liste" }, entree: "pop" }],
    fenetres: [{ debut: 3, fin: 4, recherche: "r", video: false }],
    calques: Array.from({ length: n }, (_, i) => ({ debut: n % 2 ? 1 : 0, fin: 2 + i, type: "etiquette" })),
    elementsV4: [{ id: "x", debut: 0 }],
  });
  const famillesDe = (r: { usages: { source: string; videoId: string; cle: string }[] }, videoId: string) =>
    r.usages.filter((u) => u.source === "v4-familles" && u.videoId === videoId).map((u) => u.cle.replace("famille:", ""));

  it("familles de historiqueDuPlan pour chaque vidéo, 5 vidéos au plus", async () => {
    for (let n = 1; n <= 6; n++) await depots().travaux.enregistrer(travailV4(n, `vid${n}`, { facecamAnimeeV4: etatV4(planDe(n)) }));
    const r = await lireMemoiresA({ formatId: "facecam-animee", fenetre: FEN_FORMAT });
    const fam = r.usages.filter((u) => u.source === "v4-familles");
    expect(new Set(fam.map((u) => u.videoId))).toEqual(new Set(["vid2", "vid3", "vid4", "vid5", "vid6"]));
    expect(r.profondeurs["v4-familles"]).toBe(5);
    // Référence : exactement ce que fait `historique()` d'origine (plan relu par lireEtatV4, puis historiqueDuPlan).
    // `fusionnerMemoires` (C1-U5) retire les doublons exacts et trie : on compare donc les familles distinctes de chaque vidéo.
    const attendu = (n: number) => {
      const plan = lireEtatV4(etatV4(planDe(n)))?.realisation?.plan;
      if (!plan) throw new Error("plan illisible");
      return [...new Set(historiqueDuPlan(plan).familles)].sort();
    };
    expect(attendu(2)).toEqual(["carte", "etiquette", "fenetre"]);
    for (let n = 2; n <= 6; n++) expect([...famillesDe(r, `vid${n}`)].sort()).toEqual(attendu(n));
  });

  it("travail récent sans plan + travail ancien avec plan : la vidéo compte (filtre avant déduplication)", async () => {
    await depots().travaux.enregistrer(travailV4(1, "vidA", { facecamAnimeeV4: etatV4(planDe(1), [{ fichier: "f", source: "pexels", id: "pA", scene: "s" }]) }));
    await depots().travaux.enregistrer(travailV4(5, "vidA", { facecamAnimeeV4: etatV4({ cartes: [], fenetres: [], calques: [] }) }));
    const r = await lireMemoiresA({ formatId: "facecam-animee", fenetre: FEN_FORMAT });
    expect(r.profondeurs["v4-familles"]).toBe(1);
    expect([...famillesDe(r, "vidA")].sort()).toEqual(["carte", "etiquette", "fenetre"]);
    // Extraits : le même filtre « avec choix » avant déduplication.
    expect(r.profondeurs["v4-extraits"]).toBe(1);
    expect(r.usages.filter((u) => u.source === "v4-extraits").map((u) => u.cle)).toEqual(["pexels:pA"]);
  });
});

describe("illustrations", () => {
  it("seulement hors catalogue, jamais dans usages", async () => {
    await depots().elements.enregistrer({ id: "i1", type: "illustration-image", derniereVideoId: "vidA", dernierRangVideo: 3 } as never);
    await depots().elements.enregistrer({ id: "i2", type: "illustration-video", derniereVideoId: "vidB", dernierRangVideo: 7 } as never);
    await depots().elements.enregistrer({ id: "i3", type: "illustration-image" } as never);
    const r = await lireMemoiresA({ formatId: "avocat", fenetre: FEN });
    expect(r.horsCatalogue).toEqual([
      { source: "illustrations", cle: "illustration:i2", videoId: "vidB", rang: 0 },
      { source: "illustrations", cle: "illustration:i1", videoId: "vidA", rang: 1 },
    ]);
    expect(r.usages.some((u) => u.source === ("illustrations" as never))).toBe(false);
  });
});

describe("choix figés", () => {
  it("lus seulement pour les versions prêtes du format", async () => {
    const choix = [{ capacite: "texte.style-varie", cle: "a" }];
    const v = (id: string, statut: string, formatId: string) => ({ id, videoId: id, statut, creeLe: jour(2), commande: { formatId, entrees: { bibliothequeVideo: { choix } } } }) as never;
    await depots().versions.enregistrer(v("v1", "prete", "avocat"));
    await depots().versions.enregistrer(v("v2", "echec", "avocat"));
    await depots().versions.enregistrer(v("v3", "prete", "autre"));
    const r = await lireMemoiresA({ formatId: "avocat", fenetre: FEN_FORMAT });
    expect(r.usages.filter((u) => u.source === "bibliotheque-video").map((u) => u.videoId)).toEqual(["v1"]);
  });
});

describe("portée, pannes, lecture seule", () => {
  it("portée format sur avocat : aucune lecture v4", async () => {
    const espion = vi.spyOn(depots().travaux, "lister");
    await lireMemoiresA({ formatId: "avocat", fenetre: FEN_FORMAT });
    expect(espion).not.toHaveBeenCalled();
  });
  it("une source qui lève : les autres restent, aucune exception", async () => {
    await depots().versions.enregistrer(versionAvocat(1, ["m1"]));
    await depots().elements.enregistrer({ id: "i1", type: "illustration-image", derniereVideoId: "vidA", dernierRangVideo: 1 } as never);
    vi.spyOn(depots().travaux, "lister").mockRejectedValue(new Error("panne"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await lireMemoiresA({ formatId: "avocat", fenetre: FEN });
    expect(r.usages.some((u) => u.source === "avocat-cartes")).toBe(true);
    expect(r.horsCatalogue).toHaveLength(1);
  });
  it("lecture seule : dépôts identiques avant/après", async () => {
    await depots().versions.enregistrer(versionAvocat(1, ["m1"]));
    await depots().travaux.enregistrer(travailV4(1, "vid1", {}));
    const instantane = async () => JSON.stringify([await depots().versions.lister(), await depots().travaux.lister(), await depots().elements.lister()]);
    const avant = await instantane();
    await lireMemoiresA({ formatId: "avocat", fenetre: FEN });
    expect(await instantane()).toBe(avant);
  });
});

describe("gardes statiques", () => {
  const src = lire("src/services/bibliotheque-video-memoires.ts");
  it("aucune écriture", () => {
    for (const interdit of ["ecrireParametre", ".creer(", ".modifier(", ".supprimer("]) expect(src).not.toContain(interdit);
  });
  it("imports interdits absents", () => {
    for (const m of src.match(/from\s+"[^"]+"|import\(\s*"[^"]+"/g) ?? []) {
      expect(m).not.toMatch(/services\/facecam-animee|services\/illustrations|fournisseurs|argent|plafond/);
    }
  });
  it("profondeurs.ts n'importe que des types", () => {
    const p = lire("src/briques/bibliotheque-video/profondeurs.ts");
    for (const l of p.split("\n").filter((x) => /^\s*import\b/.test(x))) expect(l).toMatch(/^import type /);
  });
  it("PROFONDEUR_MEMOIRE couvre les 5 sources", () => {
    for (const s of ["avocat-cartes", "v4-familles", "v4-extraits", "illustrations", "bibliotheque-video"] as const) expect(PROFONDEUR_MEMOIRE[s]).toBeDefined();
  });
});
