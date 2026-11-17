import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mettre, tirer } from "@/moteurs/montage-cas-concret/variete";
import { REFERENCES } from "@/briques/schema-motion/variete";

type Ligne = Record<string, unknown>;
const etat = vi.hoisted(() => ({
  publications: [] as Ligne[], videos: [] as Ligne[], versions: [] as Ligne[], travaux: [] as Ligne[], parametres: {} as Record<string, unknown>,
  echoue: { publications: false, versions: false, travaux: false },
  ecritures: [] as string[],
}));

vi.mock("@/services/_commun", () => {
  const depot = (nom: "publications" | "videos" | "versions" | "travaux") => ({
    lister: async (f?: (x: Ligne) => boolean) => {
      if ((etat.echoue as Record<string, boolean>)[nom]) throw new Error(`${nom} illisible`);
      return (etat[nom] as Ligne[]).filter((x) => (f ? f(x) : true));
    },
    creer: async () => void etat.ecritures.push(`${nom}.creer`),
    modifier: async () => void etat.ecritures.push(`${nom}.modifier`),
    supprimer: async () => void etat.ecritures.push(`${nom}.supprimer`),
  });
  return {
    depots: () => ({ publications: depot("publications"), videos: depot("videos"), versions: depot("versions"), travaux: depot("travaux") }),
    lireParametre: async (cle: string, defaut: unknown) => (cle in etat.parametres ? etat.parametres[cle] : defaut),
    ecrireParametre: async () => void etat.ecritures.push("ecrireParametre"),
  };
});

import { voisinesDuReseau } from "@/services/variete-commune/voisines";

const pub = (videoId: string, date: string, o: Ligne = {}) => ({ id: `p-${videoId}-${date}`, videoId, reseau: "instagram", statut: "publiee", via: "buffer", date, ...o });
const miseReelle = () => mettre(tirer({ videoId: "cc", canaux: ["instagram"], historique: [] }), []);
const versionCC = (videoId: string) => ({ id: `ver-${videoId}`, videoId, statut: "prete", numero: 1, creeLe: "2026-11-10T00:00:00Z", commande: { moteurId: "montage-cas-concret", formatId: "cas-concret" }, projetMontage: { casConcret: { fiche: { mise: miseReelle() } } } });
const versionV = (videoId: string, moteurId: string, projetMontage: unknown = {}) => ({ id: `ver-${videoId}`, videoId, statut: "prete", numero: 1, creeLe: "2026-11-10T00:00:00Z", commande: { moteurId, formatId: moteurId }, projetMontage });
const travailIV = (videoId: string) => ({ id: `t-${videoId}`, cibleId: videoId, fournisseurUtilise: "montage-image-video", creeLe: "2026-11-10T00:00:00Z", parametres: { imageVideo: { etape: "terminee", demande: { videoId }, variete: { recette: { ...REFERENCES }, par: "tirage", historique: 0 } } } });
const travailV4 = (videoId: string) => ({ id: `t4-${videoId}`, cibleId: videoId, fournisseurUtilise: "montage-facecam-animee", creeLe: "2026-11-10T00:00:00Z", parametres: { facecamAnimeeV4: { version: "chaine-facecam-v4/1", etape: "prete", realisation: { plan: { cartes: [], fenetres: [], calques: [], elementsV4: [{ id: "BadgeCompteur", debut: 2 }] } } } } });

beforeEach(() => {
  etat.publications = []; etat.videos = []; etat.versions = []; etat.travaux = []; etat.parametres = {};
  etat.echoue = { publications: false, versions: false, travaux: false }; etat.ecritures = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

const ids = async (o: Partial<Parameters<typeof voisinesDuReseau>[0]> = {}) => (await voisinesDuReseau({ reseau: "instagram", ...o })).map((e) => e.videoId);

describe("voisinesDuReseau : choix des vidéos", () => {
  beforeEach(() => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) etat.versions.push(versionV(id, "montage-avocat", { motionCommune: { cartes: [{ modele: "x", debutSec: 1, statut: "ok" }] } }));
  });
  it("mêle simulation, échec, autre réseau et doublons : seules les bonnes sortent, une par vidéo, décroissantes", async () => {
    etat.publications = [
      pub("a", "2026-11-01"), pub("a", "2026-11-05"), pub("b", "2026-11-03"),
      pub("c", "2026-11-09", { via: "simulation" }), pub("d", "2026-11-08", { statut: "echec" }), pub("e", "2026-11-07", { reseau: "tiktok" }),
      pub("f", "2026-11-04", { statut: "programmee" }),
    ];
    const r = await voisinesDuReseau({ reseau: "instagram" });
    expect(r.map((e) => e.videoId)).toEqual(["a", "f", "b"]);
    expect(r[0].le).toBe("2026-11-05");
  });
  it("exclut la vidéo en cours ; fenetre = 2 → 2 au plus", async () => {
    etat.publications = [pub("a", "2026-11-05"), pub("b", "2026-11-04"), pub("c", "2026-11-03")];
    expect(await ids({ videoIdEnCours: "a" })).toEqual(["b", "c"]);
    expect(await ids({ fenetre: 2 })).toEqual(["a", "b"]);
  });
  it("pretesNonPubliees : faux → absente ; vrai → présente", async () => {
    etat.publications = [pub("a", "2026-11-05")];
    etat.videos = [{ id: "b", reseau: "instagram" }, { id: "c", reseau: "tiktok" }];
    expect(await ids()).toEqual(["a"]);
    expect((await ids({ pretesNonPubliees: true })).sort()).toEqual(["a", "b"]);
  });
});

describe("voisinesDuReseau : robustesse", () => {
  it("lister des publications qui lève → [] sans exception", async () => {
    etat.echoue.publications = true;
    expect(await ids()).toEqual([]);
  });
  it("une lecture qui lève ignore cette vidéo seule", async () => {
    etat.publications = [pub("a", "2026-11-05"), pub("b", "2026-11-04")];
    etat.versions = [versionCC("a"), { ...versionCC("b"), projetMontage: { get casConcret() { throw new Error("illisible"); } } }];
    expect(await ids()).toEqual(["a"]);
  });
  it("versions illisibles : [] sans exception", async () => {
    etat.publications = [pub("a", "2026-11-05")];
    etat.echoue.versions = true;
    expect(await ids()).toEqual([]);
  });
  it("donnée manquante (mise absente) : vidéo ignorée", async () => {
    etat.publications = [pub("a", "2026-11-05")];
    etat.versions = [{ ...versionCC("a"), projetMontage: {} }];
    expect(await ids()).toEqual([]);
  });
});

describe("voisinesDuReseau : tous générateurs", () => {
  it("cas concret, image→vidéo et v4 publiés sur Instagram sont tous trois voisins, avec la bonne empreinte", async () => {
    etat.publications = [pub("cc", "2026-11-05"), pub("iv", "2026-11-04"), pub("v4", "2026-11-03")];
    etat.versions = [versionCC("cc"), versionV("iv", "montage-image-video"), versionV("v4", "montage-facecam-animee")];
    etat.travaux = [travailIV("iv"), travailV4("v4")];
    const r = await voisinesDuReseau({ reseau: "instagram" });
    expect(r.map((e) => [e.videoId, e.formatId])).toEqual([["cc", "cas-concret"], ["iv", "image-video"], ["v4", "facecam-animee-v4"]]);
    expect(r[0].le).toBe("2026-11-05");
  });
  it("tableau : le style vient de l'historique des styles", async () => {
    etat.publications = [pub("t", "2026-11-05")];
    etat.versions = [versionV("t", "montage-tableau")];
    etat.parametres["tableau.historiqueStyles"] = [{ videoId: "t", style: "ardoise" }];
    const r = await voisinesDuReseau({ reseau: "instagram" });
    expect(r[0]).toMatchObject({ videoId: "t", formatId: "tableau" });
    expect(r[0].axes.palette).toEqual(["noir-dominant"]);
  });
});

describe("voisinesDuReseau : lecture seule et garde statique", () => {
  it("aucune écriture sur les dépôts", async () => {
    etat.publications = [pub("cc", "2026-11-05")];
    etat.versions = [versionCC("cc")];
    await voisinesDuReseau({ reseau: "instagram", pretesNonPubliees: true });
    expect(etat.ecritures).toEqual([]);
  });
  it("le texte de voisines.ts : server-only, aucun import interdit", () => {
    const t = readFileSync(resolve(process.cwd(), "src/services/variete-commune/voisines.ts"), "utf8");
    expect(t).toMatch(/import "server-only"/);
    const imports = t.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l)).join("\n");
    expect(imports).not.toMatch(/@\/services\/publications/);
    expect(imports).not.toMatch(/@\/services\/image-video/);
    expect(imports).not.toMatch(/travaux["'/]/);
    expect(t).not.toMatch(/\.(creer|modifier|supprimer)\(|ecrireParametre\(/);
  });
});
