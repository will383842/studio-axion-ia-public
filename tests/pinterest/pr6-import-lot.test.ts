/**
 * Pinterest, PR 6 : import en lot d'épingles, créneaux, « Valider ce lot ». Dépôts en mémoire, faux stockage, AUCUN client Zernio.
 * Données fictives (exemple.fr / axion-ia.com côté lien du site par défaut).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { creerFauxClientZernio } from "../zernio/aides/faux-zernio";
import { lireLotEpingles } from "@/domaine/epingles/format-lot";
import { lireEnteteImage, raisonsImageEpingle } from "@/domaine/epingles/image";
import { alterner, planifierEpingles } from "@/domaine/epingles/planification";
import type { CanalPublication } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots, appliquerLot } = await import("@/donnees/memoire");
const { analyserLot, importerLot, validerLot } = await import("@/services/epingles/import-lot");
const { validerParLeFondateur } = await import("@/components/visuels/BoutonProgrammerVisuel");
const pub = await import("@/services/publications");
const { listerCarrousels } = await import("@/visuels/services/vues");
const { sousVerrou } = await import("@/services/_commun");

/* --- Images factices : en-têtes PNG / JPEG / WebP --- */
function png(l: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, l);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
function jpeg(l: number, h: number): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, l >> 8, l & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0, 0, 0]);
}
function webpVP8X(l: number, h: number): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0]);
  const w = l - 1, hh = h - 1;
  b.set([w & 255, (w >> 8) & 255, (w >> 16) & 255, hh & 255, (hh >> 8) & 255, (hh >> 16) & 255], 24);
  return b;
}

describe("PR 6 · image : type réel et dimensions", () => {
  it("PNG 1000 × 1500 acceptée ; 1080 × 1350 refusée ; trop étroite refusée ; fichier non image refusé", () => {
    expect(raisonsImageEpingle(lireEnteteImage(png(1000, 1500)), 5000)).toEqual([]);
    expect(raisonsImageEpingle(lireEnteteImage(png(1080, 1350)), 5000).join()).toContain("2:3");
    expect(raisonsImageEpingle(lireEnteteImage(png(600, 900)), 5000).join()).toContain("1 000");
    expect(raisonsImageEpingle(lireEnteteImage(new Uint8Array([1, 2, 3])), 5)).toHaveLength(1);
    expect(raisonsImageEpingle(lireEnteteImage(png(1000, 1500)), 21 * 1024 * 1024).join()).toContain("20 Mo");
  });
  it("JPEG et WebP lus ; le type vient des octets, pas de l'extension", () => {
    expect(lireEnteteImage(jpeg(1000, 1500))).toEqual({ mime: "image/jpeg", largeur: 1000, hauteur: 1500 });
    expect(lireEnteteImage(webpVP8X(1000, 1500))).toEqual({ mime: "image/webp", largeur: 1000, hauteur: 1500 });
    expect(lireEnteteImage(png(1000, 1500))?.mime).toBe("image/png"); // même si le fichier s'appelle .jpg
  });
});

describe("PR 6 · format du lot", () => {
  const ligne = (p: Record<string, unknown> = {}) => ({ titre: "Titre", description: "Desc", url: "https://exemple.fr/p", tableau: "Idées", texteAlternatif: "Alt", contenuIA: false, image: "a.png", ...p });
  const lot = (...l: unknown[]) => JSON.stringify({ version: 1, epingles: l });
  it("une ligne fausse est refusée avec sa raison, les autres passent", () => {
    const r = lireLotEpingles(lot(ligne(), ligne({ contenuIA: undefined }), ligne({ url: "https://autre.fr/p" }), ligne({ image: "https://x.fr/a.png" }), ligne({ texteAlternatif: "a".repeat(501) })), "exemple.fr");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lignes.map((l) => l.erreurs.length > 0)).toEqual([false, true, true, true, true]);
  });
  it("fichier de mauvaise forme : aucune ligne lue", () => {
    for (const brut of ["pas du json", "[]", JSON.stringify({ version: 2, epingles: [] }), JSON.stringify({ version: 1, epingles: [] })]) expect(lireLotEpingles(brut, "exemple.fr").ok).toBe(false);
    expect(lireLotEpingles(lot(...Array.from({ length: 501 }, () => ligne())), "exemple.fr").ok).toBe(false);
  });
});

describe("PR 6 · planification", () => {
  const eps = (n: number) => Array.from({ length: n }, (_, i) => ({ cle: `e${i}`, tableau: i % 2 ? "B" : "A" }));
  const base = { jourDepart: "2026-12-10", heures: ["08:30", "12:30", "17:30", "21:00"], maintenant: Date.parse("2026-12-01T08:00:00Z") };
  it("10 épingles, 4 heures → J ×4, J+1 ×4, J+2 ×2", () => {
    const p = planifierEpingles({ ...base, epingles: eps(10) }).planning;
    const parJour = p.reduce<Record<string, number>>((a, x) => ({ ...a, [x.jour]: (a[x.jour] ?? 0) + 1 }), {});
    expect(parJour).toEqual({ "2026-12-10": 4, "2026-12-11": 4, "2026-12-12": 2 });
  });
  it("créneau occupé sauté ; jour exclu sauté", () => {
    const p = planifierEpingles({ ...base, epingles: eps(5), occupes: [{ jour: "2026-12-10", heure: "12:30" }], joursExclus: ["2026-12-11"] }).planning;
    expect(p.map((x) => `${x.jour} ${x.heure}`)).toEqual(["2026-12-10 08:30", "2026-12-10 17:30", "2026-12-10 21:00", "2026-12-12 08:30", "2026-12-12 12:30"]);
  });
  it("jamais à moins de 3 h de maintenant", () => {
    const p = planifierEpingles({ ...base, jourDepart: "2026-12-01", maintenant: Date.parse("2026-12-01T10:00:00Z"), epingles: eps(2) }).planning;
    expect(p[0].instant >= "2026-12-01T13:00:00Z").toBe(true); // 12:30 Paris = 11:30Z : trop proche
  });
  it("changements d'heure : dernier dimanche de mars et d'octobre (Paris)", () => {
    const mars = planifierEpingles({ ...base, jourDepart: "2027-03-28", maintenant: Date.parse("2027-03-01T00:00:00Z"), epingles: eps(2), heures: ["08:30"] }).planning;
    expect(mars.map((x) => x.instant)).toEqual(["2027-03-28T06:30:00.000Z", "2027-03-29T06:30:00.000Z"]); // 28/03/2027 : passage à l'heure d'été à 2 h
    const oct = planifierEpingles({ ...base, jourDepart: "2026-10-24", maintenant: Date.parse("2026-10-01T00:00:00Z"), epingles: eps(2), heures: ["08:30"] }).planning;
    expect(oct.map((x) => x.instant)).toEqual(["2026-10-24T06:30:00.000Z", "2026-10-25T07:30:00.000Z"]);
  });
  it("alternance des tableaux", () => {
    expect(alterner([{ tableau: "A", n: 1 }, { tableau: "A", n: 2 }, { tableau: "B", n: 3 }, { tableau: "B", n: 4 }]).map((x) => x.n)).toEqual([1, 3, 2, 4]);
  });
});

/* --- Service, avec les dépôts en mémoire --- */
const COMPTE = "compte-pin";
const CANAUX: CanalPublication[] = [
  { id: `${COMPTE}:pin:111`, organisationId: "zernio", nom: "Compte · Idées", service: "pinterest", genre: "tableau", deconnecte: false },
  { id: `${COMPTE}:pin:333`, organisationId: "zernio", nom: "Compte · Guides", service: "pinterest", genre: "tableau", deconnecte: false },
];
let images: Record<string, { cle: string; debut: Uint8Array; taille: number; sha256: string }>;
let echecApplication = false;
const ligne = (n: number, p: Record<string, unknown> = {}) => ({ titre: `Titre ${n}`, description: `Description ${n}`, url: `https://axion-ia.com/page-${n}`, tableau: "Idées", texteAlternatif: `Alt ${n}`, contenuIA: n % 2 === 0, image: `img${n}.png`, ...p });
const json = (...l: unknown[]) => JSON.stringify({ version: 1, epingles: l });
const deposer = (n: number, p: { sha?: string; octets?: Uint8Array } = {}) => { images[`img${n}.png`] = { cle: `epingles/pinterest/2x3/img${n}.png`, debut: p.octets ?? png(1000, 1500), taille: 4000, sha256: p.sha ?? String(n).padStart(64, "0") }; };
const saisie = (j: string, p: Record<string, unknown> = {}) => ({ json: j, compte: COMPTE, jourDepart: "2099-01-05", heures: ["08:30", "12:30", "17:30", "21:00"], ...p });

function deps() {
  const d = depots();
  return {
    maintenant: () => "2098-12-01T08:00:00.000Z",
    domaineSite: async () => "axion-ia.com",
    canaux: async () => CANAUX,
    heuresCadence: async () => ({ heures: ["08:30", "12:30", "17:30", "21:00"], ecartMinMinutes: 210 }),
    image: async (nom: string) => images[nom] ?? null,
    appliquerLot: async (lot: Parameters<typeof appliquerLot>[0]) => { if (echecApplication) throw new Error("panne"); return appliquerLot(lot); },
    verrou: sousVerrou,
    depots: { visuels: d.visuels, creneaux: d.creneauxEditoriaux as never, publications: d.publications, envoisPlanifies: d.envoisPlanifies, journal: d.journalDecalages },
  };
}

beforeEach(() => {
  reinitialiserDepots();
  images = {};
  echecApplication = false;
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("PR 6 · import puis « Valider ce lot »", () => {
  it("avant validation : 2 créneaux « à valider », 2 visuels « à valider », aucune publication, aucun appel", async () => {
    deposer(1); deposer(2);
    const faux = creerFauxClientZernio();
    const r = await importerLot(deps(), saisie(json(ligne(1), ligne(2))));
    expect(r).toMatchObject({ crees: 2, dejaLa: 0, refusees: 0, enAttente: 0 });
    const cs = await depots().creneauxEditoriaux.lister();
    expect(cs).toHaveLength(2);
    expect(cs.every((c) => c.statut === "a_valider" && c.origine === "vous" && c.compteCible === `${COMPTE}:pin:111` && c.textes?.pinterest?.premierCommentaire === "")).toBe(true);
    const vs = await depots().visuels.lister((v) => v.famille === "epingle");
    expect(vs.every((v) => v.statut === "a_valider" && v.modeTexte === "import" && v.coutCentimes === 0 && v.reseaux?.[0] === "pinterest")).toBe(true);
    expect(vs.map((v) => v.epingle?.contenuIA).sort()).toEqual([false, true]);
    expect(await depots().publications.lister((p) => p.reseau === "pinterest")).toHaveLength(0);
    expect(faux.faux.appels).toHaveLength(0);
  });
  it("« Valider ce lot » : 2 publications Pinterest au calendrier, créneaux et visuels « programme », aucun appel Zernio", async () => {
    deposer(1); deposer(2);
    const faux = creerFauxClientZernio();
    const r = await importerLot(deps(), saisie(json(ligne(1), ligne(2))));
    const v = await validerLot(deps(), r.creneauIds, validerParLeFondateur);
    expect(v).toMatchObject({ valides: 2, ignores: 0, erreurs: [] });
    expect((await depots().creneauxEditoriaux.lister()).every((c) => c.statut === "programme" && !!c.valideeLe)).toBe(true);
    expect((await depots().visuels.lister((x) => x.famille === "epingle")).every((x) => x.statut === "programme")).toBe(true);
    const jours = await pub.listerCalendrier("2099-01-01T00:00:00Z", "2099-02-01T00:00:00Z");
    expect(jours.flatMap((j) => j.publications).filter((p) => p.reseau === "pinterest")).toHaveLength(2);
    const manuelles = await depots().publications.lister((p) => p.reseau === "pinterest");
    expect(manuelles.every((p) => p.via === "manuel" && p.statut === "programmee")).toBe(true);
    expect(faux.faux.appels).toHaveLength(0);
    // Rejouer la validation ne refait rien.
    expect(await validerLot(deps(), r.creneauIds, validerParLeFondateur)).toMatchObject({ valides: 0, ignores: 2 });
  });
  it("idempotence : même fichier deux fois → 2 créés puis 0, 2 « déjà là »", async () => {
    deposer(1); deposer(2);
    const j = json(ligne(1), ligne(2));
    expect((await importerLot(deps(), saisie(j))).crees).toBe(2);
    expect(await importerLot(deps(), saisie(j))).toMatchObject({ crees: 0, dejaLa: 2 });
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(2);
  });
  it("anti-répétition : même image sous une autre clé refusée ; même lien + tableau refusé", async () => {
    deposer(1); deposer(2, { sha: String(1).padStart(64, "0") }); deposer(3);
    await importerLot(deps(), saisie(json(ligne(1))));
    const r = await analyserLot(deps(), saisie(json(ligne(2, { cle: "autre" }), ligne(3, { url: ligne(1).url, cle: "encore" }))));
    expect(r.lignes.map((l) => l.statut)).toEqual(["refusee", "refusee"]);
    expect(r.lignes[0].raisons.join()).toContain("même image");
    expect(r.lignes[1].raisons.join()).toContain("même lien");
  });
  it("tableau inconnu ou non public refusé, les autres passent ; image 1080 × 1350 refusée ; image manquante « en attente », jamais créée", async () => {
    deposer(1); deposer(2, { octets: png(1080, 1350) }); deposer(3);
    const r = await importerLot(deps(), saisie(json(ligne(1), ligne(2), ligne(3, { tableau: "Secret" }), ligne(4))));
    expect(r).toMatchObject({ crees: 1, refusees: 2, enAttente: 1 });
    expect(r.rapport.imagesAttendues).toEqual(["img4.png"]);
    expect(await depots().visuels.lister((v) => v.famille === "epingle")).toHaveLength(1);
  });
  it("format du fichier faux : rien n'est écrit", async () => {
    const r = await importerLot(deps(), saisie("pas du json"));
    expect(r.rapport.ok).toBe(false);
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("appliquerLot qui échoue : aucun visuel ni créneau", async () => {
    deposer(1); deposer(2);
    echecApplication = true;
    await expect(importerLot(deps(), saisie(json(ligne(1), ligne(2))))).rejects.toThrow("panne");
    expect(await depots().visuels.lister((v) => v.famille === "epingle")).toHaveLength(0);
    expect(await depots().creneauxEditoriaux.lister()).toHaveLength(0);
  });
  it("créneau occupé du même compte sauté ; alternance des tableaux", async () => {
    deposer(1); deposer(2); deposer(3);
    await importerLot(deps(), saisie(json(ligne(1)), { heures: ["08:30"], jourDepart: "2099-01-05" }));
    const r = await analyserLot(deps(), saisie(json(ligne(2, { tableau: "Guides" }), ligne(3, { tableau: "Guides" })), { heures: ["08:30"], jourDepart: "2099-01-05" }));
    expect(r.lignes.map((l) => l.placement?.jour)).toEqual(["2099-01-06", "2099-01-07"]);
  });
  it("écran Carrousels : aucune épingle listée", async () => {
    deposer(1);
    await importerLot(deps(), saisie(json(ligne(1))));
    const liste = await listerCarrousels("tous", { depot: depots().visuels as never, urlLecture: async (c: string) => c, urlTelechargement: async (c: string) => c, allume: async () => true, maintenant: () => "2098-12-01T08:00:00.000Z" } as never);
    expect(liste).toEqual([]);
  });
});
