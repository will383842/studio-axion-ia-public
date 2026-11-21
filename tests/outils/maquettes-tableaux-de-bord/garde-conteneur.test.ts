/**
 * T-EXT-51c (lot garde) : CAPTURE_CONTENEUR à la place de CI, et chemins réels (realpath) dans la garde.
 * La garde reste pure : le « disque » (indices de conteneur, realpath) lui est injecté. L'essai symlink utilise un vrai dossier temporaire.
 */
import { linkSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  MESSAGE_ENVIRONNEMENT_INTERDIT,
  adresseAutorisee,
  adresseAutoriseeReelle,
  deciderRequete,
  INDICES_CONTENEUR,
  environnementAutorise,
  indicesConteneur,
} from "../../../outils/maquettes-tableaux-de-bord/capture/garde";

describe("environnementAutorise : CAPTURE_CONTENEUR", () => {
  it("CAPTURE_CONTENEUR=true + indice de conteneur sous linux : accepté", () => {
    expect(environnementAutorise({ CAPTURE_CONTENEUR: "true" }, "linux", true).ok).toBe(true);
  });
  it("CAPTURE_CONTENEUR=true sans indice (PC) : refusé, message inchangé", () => {
    for (const r of [environnementAutorise({ CAPTURE_CONTENEUR: "true" }, "linux", false), environnementAutorise({ CAPTURE_CONTENEUR: "true" }, "linux")]) {
      expect(r).toEqual({ ok: false, raison: MESSAGE_ENVIRONNEMENT_INTERDIT });
    }
  });
  it("seulement la valeur exacte « true » : 1, TRUE, True, vide, espace refusés", () => {
    for (const v of ["1", "TRUE", "True", "", " true", "true "]) {
      expect(environnementAutorise({ CAPTURE_CONTENEUR: v }, "linux", true).ok, JSON.stringify(v)).toBe(false);
    }
  });
  it("jamais sous win32 ni darwin, même avec la variable et l'indice", () => {
    expect(environnementAutorise({ CAPTURE_CONTENEUR: "true" }, "win32", true).ok).toBe(false);
    expect(environnementAutorise({ CAPTURE_CONTENEUR: "true" }, "darwin", true).ok).toBe(false);
  });
  it("l'indice seul, sans la variable : refusé", () => {
    expect(environnementAutorise({}, "linux", true).ok).toBe(false);
  });
  it("CI et CLAUDE_CODE_REMOTE inchangés (sans indice, refusés sous win32)", () => {
    expect(environnementAutorise({ CI: "true" }, "linux").ok).toBe(true);
    expect(environnementAutorise({ CLAUDE_CODE_REMOTE: "true" }, "linux").ok).toBe(true);
    expect(environnementAutorise({ CI: "true" }, "win32").ok).toBe(false);
    expect(environnementAutorise({ CI: "true", CAPTURE_CONTENEUR: "true" }, "win32", true).ok).toBe(false);
    expect(environnementAutorise({ CI: "1" }, "linux").ok).toBe(false);
  });
  it("indicesConteneur : /.dockerenv ou /run/.containerenv, jamais autre chose ; une erreur de lecture vaut « non »", () => {
    expect(indicesConteneur((c) => c === "/.dockerenv")).toBe(true);
    expect(indicesConteneur((c) => c === "/run/.containerenv")).toBe(true);
    expect(indicesConteneur(() => false)).toBe(false);
    expect(indicesConteneur(() => { throw new Error("EACCES"); })).toBe(false);
  });
});

describe("adresseAutoriseeReelle : vrai système de fichiers temporaire", () => {
  let base = "";
  let racine = "";
  let ext = "";
  const u = (...p: string[]) => pathToFileURL(join(racine, ...p)).href;
  beforeAll(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), "garde-51c-")));
    racine = join(base, "maquette");
    ext = join(base, "dehors");
    mkdirSync(join(racine, "sous"), { recursive: true });
    mkdirSync(ext);
    writeFileSync(join(racine, "index.html"), "<html></html>");
    writeFileSync(join(racine, "sous", "a.css"), "a{}");
    writeFileSync(join(ext, "secret.txt"), "secret");
    symlinkSync("/proc/self/environ", join(racine, "environ"));
    symlinkSync("/etc/passwd", join(racine, "passwd"));
    symlinkSync(join(ext, "secret.txt"), join(racine, "lien-dehors.txt"));
    symlinkSync(ext, join(racine, "dossier-dehors"));
    symlinkSync(join(racine, "index.html"), join(racine, "lien-interne.html"));
    symlinkSync(join(racine, "sous"), join(racine, "dossier-interne"));
    symlinkSync("../dehors/secret.txt", join(racine, "relatif.txt"));
  });
  afterAll(() => rmSync(base, { recursive: true, force: true }));
  const rp = (p: string) => realpathSync.native(p);

  it("fichiers ordinaires de la maquette : permis", () => {
    expect(adresseAutoriseeReelle(u("index.html"), [racine], rp)).toBe(true);
    expect(adresseAutoriseeReelle(u("sous", "a.css"), [racine], rp)).toBe(true);
    expect(adresseAutoriseeReelle("about:blank", [racine], rp)).toBe(true);
    expect(adresseAutoriseeReelle("data:text/plain,a", [racine], rp)).toBe(true);
  });
  it("sans realpath la garde ancienne se laisse tromper (preuve du besoin)", () => {
    expect(adresseAutorisee(u("environ"), [racine])).toBe(true);
    expect(adresseAutorisee(u("lien-dehors.txt"), [racine])).toBe(true);
  });
  it("lien vers /proc/self/environ, /etc/passwd, un fichier ou un dossier hors racine : refusé", () => {
    for (const n of ["environ", "passwd", "lien-dehors.txt", "relatif.txt"]) expect(adresseAutoriseeReelle(u(n), [racine], rp), n).toBe(false);
    expect(adresseAutoriseeReelle(u("dossier-dehors", "secret.txt"), [racine], rp)).toBe(false);
  });
  it("lien interne (vers un fichier ou un dossier de la maquette) : refusé aussi, choix le plus sûr", () => {
    expect(adresseAutoriseeReelle(u("lien-interne.html"), [racine], rp)).toBe(false);
    expect(adresseAutoriseeReelle(u("dossier-interne", "a.css"), [racine], rp)).toBe(false);
  });
  it("fichier absent : refusé (la résolution échoue)", () => {
    expect(adresseAutoriseeReelle(u("absent.html"), [racine], rp)).toBe(false);
    expect(adresseAutoriseeReelle(u("sous", "absent", "x.css"), [racine], rp)).toBe(false);
  });
  it("la racine elle-même est un lien symbolique : ses fichiers ordinaires passent, un lien dedans reste refusé", () => {
    const lienRacine = join(base, "racine-lien");
    symlinkSync(racine, lienRacine);
    const v = (...p: string[]) => pathToFileURL(join(lienRacine, ...p)).href;
    expect(adresseAutoriseeReelle(v("index.html"), [lienRacine], rp)).toBe(true);
    expect(adresseAutoriseeReelle(v("environ"), [lienRacine], rp)).toBe(false);
    expect(adresseAutoriseeReelle(v("lien-dehors.txt"), [lienRacine], rp)).toBe(false);
  });
  it("hors racine, .. (brut ou encodé) et http : toujours refusés", () => {
    expect(adresseAutoriseeReelle(pathToFileURL(join(ext, "secret.txt")).href, [racine], rp)).toBe(false);
    expect(adresseAutoriseeReelle(`${u("sous")}/../../dehors/secret.txt`, [racine], rp)).toBe(false);
    expect(adresseAutoriseeReelle(`${u("sous")}/%2e%2e/%2e%2e/dehors/secret.txt`, [racine], rp)).toBe(false);
    expect(adresseAutoriseeReelle("https://exemple.test/", [racine], rp)).toBe(false);
  });
  it("un realpath qui lève une exception : refusé", () => {
    expect(adresseAutoriseeReelle(u("index.html"), [racine], () => { throw new Error("ENOENT"); })).toBe(false);
  });
});

describe("T-EXT-51c correctifs : INDICES_CONTENEUR figé", () => {
  it("exactement les deux fichiers témoins de Docker et Podman", () => {
    expect(INDICES_CONTENEUR).toEqual(["/.dockerenv", "/run/.containerenv"]);
  });
});

describe("T-EXT-51c correctifs : deciderRequete sur un vrai système de fichiers", () => {
  let base = "";
  let racine = "";
  const u = (...p: string[]) => pathToFileURL(join(racine, ...p)).href;
  const rp = (p: string) => realpathSync.native(p);
  const st = (p: string) => statSync(p);
  beforeAll(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), "decider-51c-")));
    racine = join(base, "maquette");
    mkdirSync(join(racine, "sous"), { recursive: true });
    writeFileSync(join(racine, "index.html"), "<html></html>");
    writeFileSync(join(base, "secret.txt"), "secret");
    linkSync(join(base, "secret.txt"), join(racine, "physique.txt"));
    symlinkSync(join(base, "secret.txt"), join(racine, "symbolique.txt"));
  });
  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it("fichier ordinaire de la maquette : continuer", () => {
    expect(deciderRequete(u("index.html"), [racine], rp, st)).toBe("continuer");
  });
  it("about:blank et data: : continuer (aucun fichier lu)", () => {
    expect(deciderRequete("about:blank", [racine], rp, st)).toBe("continuer");
    expect(deciderRequete("data:text/plain,a", [racine], rp, st)).toBe("continuer");
  });
  it("lien symbolique, lien physique hors racine, dossier, fichier absent : refuser", () => {
    expect(deciderRequete(u("symbolique.txt"), [racine], rp, st)).toBe("refuser");
    expect(deciderRequete(u("physique.txt"), [racine], rp, st)).toBe("refuser");
    expect(deciderRequete(u("sous"), [racine], rp, st)).toBe("refuser");
    expect(deciderRequete(u("absent.html"), [racine], rp, st)).toBe("refuser");
  });
  it("http, https, file hors racine : refuser", () => {
    expect(deciderRequete("https://exemple.test/", [racine], rp, st)).toBe("refuser");
    expect(deciderRequete("http://127.0.0.1/", [racine], rp, st)).toBe("refuser");
    expect(deciderRequete(pathToFileURL(join(base, "secret.txt")).href, [racine], rp, st)).toBe("refuser");
  });
  it("stat injecté : non-fichier ou nlink différent de 1 refusés, stat qui lève refusé, realpath qui lève refusé", () => {
    const url = u("index.html");
    expect(deciderRequete(url, [racine], rp, () => ({ isFile: () => false, nlink: 1 }))).toBe("refuser");
    expect(deciderRequete(url, [racine], rp, () => ({ isFile: () => true, nlink: 2 }))).toBe("refuser");
    expect(deciderRequete(url, [racine], rp, () => ({ isFile: () => true, nlink: 0 }))).toBe("refuser");
    expect(deciderRequete(url, [racine], rp, () => ({ isFile: () => true, nlink: 1 }))).toBe("continuer");
    expect(deciderRequete(url, [racine], rp, () => { throw new Error("EIO"); })).toBe("refuser");
    expect(deciderRequete(url, [racine], () => { throw new Error("ENOENT"); }, st)).toBe("refuser");
  });
});
