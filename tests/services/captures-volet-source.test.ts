/** N-05-VOLET-g1-v21r : source des 2 images du volet avant/après (instants du film de navigation + extraction). Doubles, 0 €, aucun réseau, aucun appelant. */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { capturesDuVolet } from "@/briques/plan-scenes-objets/captures-volet";
import { VERSION_NAVIGATION, type NavigationFilmee } from "@/briques/plan-scenes/tutoriel/navigation-filmee";
import { lireArtefactsTutoriel } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";

vi.mock("server-only", () => ({}));
const { MARGE_FIN_VOLET_SEC, extraireCapturesVolet, instantsDuVolet, voletPermisParEntrees } = await import("@/services/captures-volet-source");

const nav = (extra: Partial<NavigationFilmee> = {}): NavigationFilmee =>
  ({ version: VERSION_NAVIGATION, videoCle: "films/nav-1.mp4", maquette: "m", largeur: 1280, hauteur: 720, debutFilmMs: 2000, dureeVoixMs: 30000, cibles: [], ...extra }) as NavigationFilmee;
const phrase = { mode: "phrase", phrase: "Une phrase assez longue." } as const;
const dossier = (attestationImages: boolean) => ({ mode: "dossier", fichierId: "f1", attestationImages }) as const;
const entrees = (n: NavigationFilmee | null = nav(), depot: unknown = phrase) => ({ navigationFilmee: n ?? undefined, depot }) as never;
const cle = (nom: string) => `tuto/${nom}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const h = (n: NavigationFilmee) => sha(n.videoCle + 2 + (((n.debutFilmMs + n.dureeVoixMs) / 1000) - 0.5)).slice(0, 12);

type Reponse = { statut: "fini"; images: { nom: string; cle: string }[] } | { statut: "en-cours" };
function port(reponse?: (d: { cles: Record<string, string> }) => Reponse | Promise<Reponse>) {
  return vi.fn(async (d: { idTravail: string; source: string; instants: { nom: string; instantSec: number }[]; largeur: number; cles: Record<string, string> }): Promise<Reponse> =>
    reponse ? reponse(d) : { statut: "fini", images: [{ nom: "avant", cle: d.cles.avant }, { nom: "apres", cle: d.cles.apres }] });
}
const deps = (extraire: ReturnType<typeof port>) => ({ extraire, idTravail: "t1", cle });

describe("instantsDuVolet", () => {
  it("(a) avant = début de la voix, après = fin de la voix moins 0,5 s", () => {
    expect(MARGE_FIN_VOLET_SEC).toBe(0.5);
    expect(instantsDuVolet(nav())).toEqual({ avantSec: 2, apresSec: 31.5 });
  });
  it("(b) film absent → null", () => {
    expect(instantsDuVolet(undefined)).toBeNull();
    expect(instantsDuVolet(nav({ videoCle: "" }))).toBeNull();
    expect(instantsDuVolet(null as never)).toBeNull();
  });
  it("(c) durée trop courte : après ≤ avant → null (égal, +1 ms, −1 ms)", () => {
    expect(instantsDuVolet(nav({ dureeVoixMs: 400 }))).toBeNull();
    expect(instantsDuVolet(nav({ dureeVoixMs: 500 }))).toBeNull(); // égal
    expect(instantsDuVolet(nav({ dureeVoixMs: 499 }))).toBeNull(); // −1
    expect(instantsDuVolet(nav({ dureeVoixMs: 501 }))).toEqual({ avantSec: 2, apresSec: 2.001 }); // +1
  });
  it("(d) largeur ou hauteur absentes, nulles, négatives, non finies → null ; durée ou début invalides → null", () => {
    for (const v of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1280"]) {
      expect(instantsDuVolet(nav({ largeur: v as never }))).toBeNull();
      expect(instantsDuVolet(nav({ hauteur: v as never }))).toBeNull();
    }
    for (const v of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(instantsDuVolet(nav({ debutFilmMs: v as never }))).toBeNull();
      expect(instantsDuVolet(nav({ dureeVoixMs: v as never }))).toBeNull();
    }
    expect(instantsDuVolet(nav({ debutFilmMs: 0 }))).toEqual({ avantSec: 0, apresSec: 29.5 });
  });
});

describe("voletPermisParEntrees", () => {
  it("(h) dossier sans attestation → faux ; dossier attesté et phrase → vrai", () => {
    expect(voletPermisParEntrees({ depot: dossier(false) })).toBe(false);
    expect(voletPermisParEntrees({ depot: { mode: "dossier", fichierId: "f", attestationImages: undefined as never } })).toBe(false);
    expect(voletPermisParEntrees({ depot: dossier(true) })).toBe(true);
    expect(voletPermisParEntrees({ depot: phrase })).toBe(true);
  });
});

describe("extraireCapturesVolet", () => {
  it("(f) deux captures complètes, avant puis après, lues par lireArtefactsTutoriel et capturesDuVolet", async () => {
    const extraire = port();
    const r = await extraireCapturesVolet(entrees(), undefined, deps(extraire));
    expect(r?.etat).toBe("fini");
    if (r?.etat !== "fini") return;
    const n = nav();
    expect(extraire).toHaveBeenCalledTimes(1);
    const appel = extraire.mock.calls[0]![0];
    expect(appel).toEqual({
      idTravail: `t1-volet-${h(n)}`,
      source: "films/nav-1.mp4",
      instants: [{ nom: "avant", instantSec: 2 }, { nom: "apres", instantSec: 31.5 }],
      largeur: 1280,
      cles: { avant: `tuto/volet-avant-${h(n)}.jpg`, apres: `tuto/volet-apres-${h(n)}.jpg` },
    });
    expect(r.captures.map((c) => c.cle)).toEqual([`tuto/volet-avant-${h(n)}.jpg`, `tuto/volet-apres-${h(n)}.jpg`]);
    for (const c of r.captures) expect([c.largeur, c.hauteur, c.zones]).toEqual([1280, 720, []]);
    expect(r.captures[0]!.empreinte).toBe(sha(`films/nav-1.mp4avant2${r.captures[0]!.cle}`).slice(0, 24));
    expect(r.captures[1]!.empreinte).toBe(sha(`films/nav-1.mp4apres31.5${r.captures[1]!.cle}`).slice(0, 24));
    expect(lireArtefactsTutoriel({ captures: r.captures }).captures).toEqual(r.captures);
    expect(capturesDuVolet(r.captures)).toEqual({ avant: r.captures[0]!.cle, apres: r.captures[1]!.cle });
  });

  it("(g) 2e appel avec le même film : 0 appel au port, mêmes captures ; film différent : nouvelles clés", async () => {
    const extraire = port();
    const un = await extraireCapturesVolet(entrees(), undefined, deps(extraire));
    if (un?.etat !== "fini") throw new Error("attendu : fini");
    const deux = await extraireCapturesVolet(entrees(), { captures: un.captures }, deps(extraire));
    expect(extraire).toHaveBeenCalledTimes(1);
    expect(deux).toEqual(un);
    const autre = await extraireCapturesVolet(entrees(nav({ videoCle: "films/nav-2.mp4" })), { captures: un.captures }, deps(extraire));
    expect(extraire).toHaveBeenCalledTimes(2);
    if (autre?.etat !== "fini") throw new Error("attendu : fini");
    expect(autre.captures.map((c) => c.cle)).not.toEqual(un.captures.map((c) => c.cle));
    // captures déjà gardées mais dans l'autre ordre ou incomplètes : on réextrait
    await extraireCapturesVolet(entrees(), { captures: [...un.captures].reverse() }, deps(extraire));
    await extraireCapturesVolet(entrees(), { captures: [un.captures[0]] }, deps(extraire));
    expect(extraire).toHaveBeenCalledTimes(4);
    await extraireCapturesVolet(entrees(), { captures: [un.captures[0], { ...un.captures[1]!, cle: "tuto/autre.jpg" }] }, deps(extraire)); // 2e clé étrangère
    expect(extraire).toHaveBeenCalledTimes(5);
  });

  it("(b) film absent ou invalide → null, 0 appel au port ; (c)(d) durée courte, taille absente → null, 0 appel", async () => {
    const extraire = port();
    for (const n of [null, nav({ dureeVoixMs: 400 }), nav({ largeur: 0 }), nav({ hauteur: Number.NaN })]) expect(await extraireCapturesVolet(entrees(n), undefined, deps(extraire))).toBeNull();
    expect(extraire).not.toHaveBeenCalled();
  });

  it("(e) extraction qui échoue → null sans exception, rien rendu", async () => {
    const leve = port(() => { throw new Error("panne simulée"); });
    expect(await extraireCapturesVolet(entrees(), undefined, deps(leve))).toBeNull();
    const rejette = port(async () => { throw new Error("panne asynchrone"); });
    expect(await extraireCapturesVolet(entrees(), undefined, deps(rejette))).toBeNull();
    const une = port((d) => ({ statut: "fini", images: [{ nom: "avant", cle: d.cles.avant }] }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(une))).toBeNull();
    const vide = port(() => ({ statut: "fini", images: [] }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(vide))).toBeNull();
    const etrangere = port((d) => ({ statut: "fini", images: [{ nom: "avant", cle: d.cles.avant }, { nom: "apres", cle: "ailleurs/autre.jpg" }] }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(etrangere))).toBeNull();
    const mauvaisNom = port((d) => ({ statut: "fini", images: [{ nom: "avant", cle: d.cles.avant }, { nom: "fin", cle: d.cles.apres }] }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(mauvaisNom))).toBeNull();
    const dupliquee = port((d) => ({ statut: "fini", images: [{ nom: "avant", cle: d.cles.avant }, { nom: "avant", cle: d.cles.avant }] }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(dupliquee))).toBeNull();
  });

  it("(h) dossier sans attestation → null, 0 appel ; dossier attesté et phrase → extraction", async () => {
    const extraire = port();
    expect(await extraireCapturesVolet(entrees(nav(), dossier(false)), undefined, deps(extraire))).toBeNull();
    expect(extraire).not.toHaveBeenCalled();
    expect((await extraireCapturesVolet(entrees(nav(), dossier(true)), undefined, deps(extraire)))?.etat).toBe("fini");
    expect((await extraireCapturesVolet(entrees(nav(), phrase), undefined, deps(extraire)))?.etat).toBe("fini");
    expect(extraire).toHaveBeenCalledTimes(2);
  });

  it("(i) travail en cours → { etat: 'en-cours' }, aucune capture", async () => {
    const encours = port(() => ({ statut: "en-cours" }));
    expect(await extraireCapturesVolet(entrees(), undefined, deps(encours))).toEqual({ etat: "en-cours" });
  });
});

describe("(j) garde de texte : éteint, aucun appelant", () => {
  const chemin = join(__dirname, "..", "..", "src/services/captures-volet-source.ts");
  it("le fichier est server-only et ne touche ni réglage, ni réseau, ni stockage, ni prix, ni autre service", () => {
    const src = readFileSync(chemin, "utf8");
    expect(src).toContain("server-only");
    for (const interdit of ["lireParametre", "fetch", "stockage", "@/services/", "centimes"]) expect(src).not.toContain(interdit);
    expect(src.split("\n").length).toBeLessThanOrEqual(110);
  });
  it("aucun fichier de src/ n'importe captures-volet-source", () => {
    const vus: string[] = [];
    const parcourir = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(f) && p !== chemin && readFileSync(p, "utf8").includes("captures-volet-source")) vus.push(p);
      }
    };
    parcourir(join(__dirname, "..", "..", "src"));
    expect(vus).toEqual([]);
  });
});
