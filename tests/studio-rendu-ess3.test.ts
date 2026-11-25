/**
 * ESS-3 (essai du 25/11) : rendu dans un processus enfant, idempotence sûre, nettoyage prudent, messages lisibles.
 * Aucun navigateur, aucun rendu réel : l'enfant est un faux.
 */
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { DemandeRendu } from "../studio-rendu/src/contrat";
import { FilesRendu, empreinteDemande, motifEchec } from "../studio-rendu/src/files";
import { demandeEnfantEssai } from "../studio-rendu/src/operations/composition";
import { CACHE_VIDEO_RENDU_OCTETS } from "../studio-rendu/src/remotion";
import { nettoyerTemporairesOrphelins } from "../studio-rendu/src/nettoyage";
import { cheminEnfant, ErreurEnfant, lancerRenduEnfant, type DemandeEnfant } from "../studio-rendu/src/rendu-enfant";
import { creerServeur } from "../studio-rendu/src/serveur";

class FauxEnfant extends EventEmitter {
  envoyes: unknown[] = [];
  signaux: string[] = [];
  send(m: unknown) {
    this.envoyes.push(m);
    return true;
  }
  kill(s: string = "SIGTERM") {
    this.signaux.push(s);
    return true;
  }
}

const demandeEnfant: DemandeEnfant = { serveUrl: "http://x", id: "Essai", proprietes: {}, reglages: {}, supplements: {}, sortie: "/tmp/v.mp4" };

function lancer(contexte: { progression?: (p: number) => void; signal?: AbortSignal } = {}, delaiAbattageMs = 20) {
  const enfant = new FauxEnfant();
  const pcs: number[] = [];
  const signal = contexte.signal ?? new AbortController().signal;
  const p = lancerRenduEnfant(demandeEnfant, { progression: contexte.progression ?? ((x) => pcs.push(x)), signal }, { lancer: () => enfant, delaiAbattageMs });
  return { enfant, pcs, p };
}

describe("rendu dans un processus enfant", () => {
  it("le chemin de l'enfant garde l'extension du fichier courant", () => {
    expect(cheminEnfant("file:///a/src/rendu-enfant.ts")).toMatch(/rendu-enfant\.ts$/);
    expect(cheminEnfant("file:///a/dist/src/rendu-enfant.js")).toMatch(/rendu-enfant\.js$/);
  });

  it("progressions puis succès", async () => {
    const { enfant, pcs, p } = lancer();
    expect(enfant.envoyes[0]).toMatchObject({ type: "demande" });
    enfant.emit("message", { type: "progression", pc: 10 });
    enfant.emit("message", { type: "progression", pc: 60 });
    enfant.emit("message", { type: "fini", images: 300, fps: 30 });
    enfant.emit("close", 0, null);
    await expect(p).resolves.toEqual({ images: 300, fps: 30 });
    expect(pcs).toEqual([10, 60]);
  });

  it("échec avec message : l'erreur porte le message de l'enfant", async () => {
    const { enfant, p } = lancer();
    enfant.emit("message", { type: "erreur", phase: "rendu", message: "FFmpeg quit with code 254" });
    enfant.emit("close", 1, null);
    const e = await p.catch((x) => x);
    expect(e).toBeInstanceOf(ErreurEnfant);
    expect(e.message).toBe("FFmpeg quit with code 254");
    expect(e.phase).toBe("rendu");
    expect(motifEchec(new Error(e.message)).message).toContain("FFmpeg quit with code 254");
  });

  it("erreur de sélection : la phase est transmise", async () => {
    const { enfant, p } = lancer();
    enfant.emit("message", { type: "erreur", phase: "selection", message: "Could not find composition" });
    enfant.emit("close", 1, null);
    await expect(p).rejects.toMatchObject({ phase: "selection" });
  });

  it("enfant tué : message lisible avec le signal", async () => {
    const { enfant, p } = lancer();
    enfant.emit("close", null, "SIGKILL");
    await expect(p).rejects.toThrow("Le processus de rendu s'est arrêté (signal SIGKILL).");
  });

  it("sortie sans résultat ni message : code affiché", async () => {
    const { enfant, p } = lancer();
    enfant.emit("close", 3, null);
    await expect(p).rejects.toThrow("Le processus de rendu s'est arrêté (code 3).");
  });

  it("l'arrêt par le signal tue l'enfant (SIGTERM puis SIGKILL)", async () => {
    const controleur = new AbortController();
    const { enfant, p } = lancer({ signal: controleur.signal }, 10);
    controleur.abort();
    expect(enfant.signaux).toEqual(["SIGTERM"]);
    await new Promise((r) => setTimeout(r, 40));
    expect(enfant.signaux).toEqual(["SIGTERM", "SIGKILL"]);
    enfant.emit("close", null, "SIGKILL");
    await expect(p).rejects.toThrow(/s'est arrêté/);
  });

  it("le dossier temporaire du rendu devient le TMPDIR de l'enfant (profil Chrome effacé avec le rendu)", async () => {
    let env: NodeJS.ProcessEnv = {};
    const enfant = new FauxEnfant();
    const p = lancerRenduEnfant(demandeEnfant, { progression: () => undefined, signal: new AbortController().signal }, { lancer: (_m, e) => ((env = e), enfant), dossierTemp: "/tmp/rendu-x/tmp" }).catch(() => undefined);
    expect(env.TMPDIR).toBe("/tmp/rendu-x/tmp");
    expect(env.STUDIO_RENDU_ENFANT).toBe("1");
    enfant.emit("close", 1, null);
    await p;
  });

  it("le délai avant SIGKILL par défaut est de 60 s", async () => {
    const controleur = new AbortController();
    const enfant = new FauxEnfant();
    const p = lancerRenduEnfant(demandeEnfant, { progression: () => undefined, signal: controleur.signal }, { lancer: () => enfant });
    const vrai = globalThis.setTimeout;
    const delais: number[] = [];
    globalThis.setTimeout = ((f: () => void, ms?: number, ...a: unknown[]) => (delais.push(ms ?? 0), vrai(f, 1_000_000, ...a))) as typeof setTimeout;
    try {
      controleur.abort();
    } finally {
      globalThis.setTimeout = vrai;
    }
    expect(delais).toContain(60_000);
    enfant.emit("close", null, "SIGTERM");
    await p.catch(() => undefined);
  });

  it("la cause réseau de l'enfant arrive au parent", async () => {
    const { enfant, p } = lancer();
    enfant.emit("message", { type: "erreur", phase: "rendu", message: "fetch failed", codeCause: "ECONNRESET" });
    enfant.emit("close", 1, null);
    await expect(p).rejects.toMatchObject({ codeCause: "ECONNRESET" });
  });

  it("la demande transmise à l'enfant borne les caches vidéo et garde crf et codec", () => {
    const d = demandeEnfantEssai({ ...demande("a", { operation: "composition", file: "longue", parametres: { composition: "Essai", crf: 12, proprietes: { a: 1 } } }) }, "http://paquet", "/tmp/v.mp4");
    expect(d.supplements).toMatchObject({ offthreadVideoCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS, mediaCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS, crf: 12, colorSpace: "bt709" });
    expect(d).toMatchObject({ serveUrl: "http://paquet", id: "Essai", sortie: "/tmp/v.mp4" });
    expect(d.proprietes).toMatchObject({ a: 1, media: "https://r2.exemple/a.mp4?sig=1" });
  });

  it("déjà arrêté avant le départ : aucun enfant lancé", async () => {
    const c = new AbortController();
    c.abort();
    let lance = false;
    await expect(lancerRenduEnfant(demandeEnfant, { progression: () => undefined, signal: c.signal }, { lancer: () => ((lance = true), new FauxEnfant()) })).rejects.toThrow(/arrêté/);
    expect(lance).toBe(false);
  });
});

function demande(id: string, extra: Partial<DemandeRendu> = {}): DemandeRendu {
  return { idRendu: id, operation: "analyse-media", file: "courte", entrees: { media: "https://r2.exemple/a.mp4?sig=1" }, sortie: { urlDepot: "https://r2.exemple/d?sig=1", cle: "sorties/a.json" }, parametres: { x: 1 }, ...extra };
}

describe("idempotence sûre", () => {
  const fabrique = (echec = false) => new FilesRendu({ operations: { "analyse-media": async () => (echec ? Promise.reject(new Error("raté")) : {}) }, creerDossier: async () => "inexistant" });

  it("même empreinte (adresses signées différentes) : idempotent", async () => {
    const f = fabrique();
    expect(f.soumettre(demande("a"))).toEqual({ idRendu: "a", nouveau: true });
    const r = f.soumettre(demande("a", { entrees: { media: "https://r2.exemple/a.mp4?sig=2" }, sortie: { urlDepot: "https://r2.exemple/d?sig=2", cle: "sorties/a.json" } }));
    expect(r).toEqual({ idRendu: "a", nouveau: false });
    await f.inactif();
  });

  it("même nom d'entrée, autre fichier : conflit ; même fichier, autre signature : idempotent", async () => {
    const f = fabrique();
    f.soumettre(demande("a", { entrees: { audio: "https://r2.exemple/voix-brute.wav?sig=1" } }));
    expect(f.soumettre(demande("a", { entrees: { audio: "https://r2.exemple/voix-mixee.wav?sig=1" } }))).toMatchObject({ nouveau: false, conflit: true });
    expect(f.soumettre(demande("a", { entrees: { audio: "https://r2.exemple/voix-brute.wav?sig=2" } }))).toEqual({ idRendu: "a", nouveau: false });
    await f.inactif();
  });

  it("paramètres contenant une adresse signée : l'empreinte l'ignore", () => {
    const a = demande("a", { parametres: { depots: { v: { urlDepot: "https://r2.exemple/v?sig=1" } } } });
    const b = demande("a", { parametres: { depots: { v: { urlDepot: "https://r2.exemple/v?sig=2" } } } });
    expect(empreinteDemande(a)).toBe(empreinteDemande(b));
  });

  it("même identifiant, empreinte différente : conflit, rien relancé", async () => {
    const f = fabrique();
    f.soumettre(demande("a"));
    for (const autre of [demande("a", { parametres: { x: 2 } }), demande("a", { sortie: { urlDepot: "https://r2.exemple/d?sig=1", cle: "autre.json" } }), demande("a", { entrees: { video: "https://r2.exemple/a.mp4?sig=1" } })]) {
      expect(f.soumettre(autre)).toMatchObject({ nouveau: false, conflit: true });
    }
    await f.inactif();
  });

  it("le serveur répond 409 lisible, sans adresse", async () => {
    const f = fabrique();
    const s = creerServeur(f);
    await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
    try {
      const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/rendus`;
      const poster = (d: DemandeRendu) => fetch(url, { method: "POST", body: JSON.stringify(d) });
      expect((await poster(demande("a"))).status).toBe(202);
      const r = await poster(demande("a", { parametres: { x: 9 } }));
      expect(r.status).toBe(409);
      const corps = (await r.json()) as { erreur: string };
      expect(corps.erreur).toContain("Un autre rendu, différent, porte déjà cet identifiant");
      expect(corps.erreur).not.toMatch(/https?:/);
      expect(s.keepAliveTimeout).toBe(65_000);
      expect(s.headersTimeout).toBe(66_000);
    } finally {
      s.close();
      await f.inactif();
    }
  });

  it("rendu en échec : relance même avec un autre contenu", async () => {
    const f = fabrique(true);
    f.soumettre(demande("a"));
    await f.inactif();
    expect(f.etat("a")).toMatchObject({ statut: "echec" });
    expect(f.soumettre(demande("a", { parametres: { x: 2 } }))).toEqual({ idRendu: "a", nouveau: true });
    await f.inactif();
  });
});

describe("dossier du rendu après un dépassement de délai", () => {
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const existe = (d: string) => readdir(d).then(() => true, () => false);

  it("l'opération écrit encore après le dépassement : le dossier reste jusqu'à sa fin, puis disparaît", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "ess3-depasse-"));
    let finir!: () => void;
    const f = new FilesRendu({
      delaiCourteMs: 20,
      delaiNettoyageApresDepassementMs: 5_000,
      creerDossier: async () => dossier,
      operations: { "analyse-media": () => new Promise((ok) => (finir = () => ok({}))) },
    });
    f.soumettre(demande("d1"));
    await f.inactif();
    expect(f.etat("d1")).toMatchObject({ statut: "echec" });
    expect(f.resume().courte.enCours).toBe(0);
    await attendre(30);
    expect(await existe(dossier)).toBe(true);
    finir();
    await attendre(50);
    expect(await existe(dossier)).toBe(false);
  });

  it("l'opération ne finit jamais : le dossier est effacé à la borne", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "ess3-depasse-"));
    const f = new FilesRendu({
      delaiCourteMs: 20,
      delaiNettoyageApresDepassementMs: 60,
      creerDossier: async () => dossier,
      operations: { "analyse-media": () => new Promise(() => undefined) },
    });
    f.soumettre(demande("d2"));
    await f.inactif();
    expect(await existe(dossier)).toBe(true);
    await attendre(200);
    expect(await existe(dossier)).toBe(false);
  });
});

describe("nettoyage prudent", () => {
  let dossier: string;
  afterEach(async () => {
    if (dossier) await rm(dossier, { recursive: true, force: true });
  });

  it("garde le récent, efface le vieux et le profil Chrome vieux", async () => {
    dossier = await mkdtemp(join(tmpdir(), "ess3-nettoyage-"));
    const vieux = new Date(Date.now() - 7 * 3600_000);
    for (const nom of ["studio-rendu-recent", "studio-rendu-vieux", "puppeteer_dev_chrome_profile-vieux", "puppeteer_dev_chrome_profile-recent", "autre-vieux"]) await mkdir(join(dossier, nom));
    await writeFile(join(dossier, "puppeteer_dev_chrome_profile-vieux", "f"), "x");
    for (const nom of ["studio-rendu-vieux", "puppeteer_dev_chrome_profile-vieux", "autre-vieux"]) await utimes(join(dossier, nom), vieux, vieux);
    const effaces = await nettoyerTemporairesOrphelins(dossier);
    expect(effaces.sort()).toEqual(["puppeteer_dev_chrome_profile-vieux", "studio-rendu-vieux"]);
    expect((await readdir(dossier)).sort()).toEqual(["autre-vieux", "puppeteer_dev_chrome_profile-recent", "studio-rendu-recent"]);
  });
});

describe("motifs d'échec lisibles", () => {
  it("la cause réseau est présente", () => {
    const e = new TypeError("fetch failed", { cause: Object.assign(new Error("connect"), { code: "ECONNREFUSED" }) });
    expect(motifEchec(e).message).toBe("fetch failed (ECONNREFUSED)");
  });

  it("une pile d'appels Remotion ne cache pas la cause", () => {
    const e = new Error("Could not extract frame from compositor Error: Compositor exited with signal SIGKILL\n    at ChildProcess.<anonymous> (file:///app/node_modules/@remotion/renderer/dist/esm/index.mjs:16815:37)\n    at ChildProcess.emit (node:events:518:28)\n    at Socket.<anonymous> (node:net:347:12)");
    const m = motifEchec(e).message;
    expect(m).toContain("Compositor exited with signal SIGKILL");
    expect(m).not.toContain("node:net");
  });

  it("un long stderr garde la fin, sans adresse", () => {
    const e = new Error(`ffmpeg version 7 ${"bannière ".repeat(80)} lu https://r2.exemple/a?sig=SECRET puis Conversion failed: disque plein ou fichier illisible`);
    const m = motifEchec(e).message;
    expect(m.startsWith("…")).toBe(true);
    expect(m).toContain("Conversion failed");
    expect(m).not.toContain("ffmpeg version");
    expect(m).not.toContain("SECRET");
    expect(m.length).toBeLessThanOrEqual(302);
  });
});
