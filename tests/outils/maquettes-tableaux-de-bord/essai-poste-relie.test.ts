/** POSTE-3 : fonctions pures du script d'essai du poste relié. Aucun navigateur, aucune capture, 0 appel payant. */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { lireArchive } from "../../../outils/maquettes-tableaux-de-bord/capture/decompresser-zip";
import {
  RACINE_DEPOT,
  boiteHorsDepot,
  construireZip,
  fichiersMaquetteAutonome,
  gardeDirect,
  lireArguments,
  lireReponseEssai,
  preparer,
// @ts-expect-error TS5097 : l'extension .mts est celle du script (hors tsconfig), vitest la résout.
} from "../../../outils/maquettes-tableaux-de-bord/essai-reel/essai-poste-relie.mts";

const nettoyer: string[] = [];
const temp = () => {
  const d = mkdtempSync(join(tmpdir(), "essai-relie-"));
  nettoyer.push(d);
  return d;
};
afterEach(() => nettoyer.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("lireArguments", () => {
  it("lit une action et la boîte", () => {
    expect(lireArguments(["--boite", "/x", "--preparer"])).toMatchObject({ ok: true, options: { mode: "preparer", boite: "/x" } });
    expect(lireArguments(["--direct", "--boite", "/x", "--id", "abc"])).toMatchObject({ ok: true, options: { mode: "direct", id: "abc" } });
  });
  it("refuse : aucune action, deux actions, boîte absente, argument inconnu, valeur manquante", () => {
    for (const a of [["--boite", "/x"], ["--boite", "/x", "--lire", "--direct"], ["--lire"], ["--boite", "/x", "--lire", "--zut"], ["--boite", "--lire"]]) expect(lireArguments(a).ok).toBe(false);
  });
});

describe("boiteHorsDepot", () => {
  it("refuse une boîte dans le dépôt, accepte une boîte hors dépôt", () => {
    expect(boiteHorsDepot(join(RACINE_DEPOT, "boite"))).toBe(false);
    expect(boiteHorsDepot(join(RACINE_DEPOT, "outils", "x", "..", "y"))).toBe(false);
    expect(boiteHorsDepot(RACINE_DEPOT)).toBe(false);
    expect(boiteHorsDepot(join(temp(), "boite"))).toBe(true);
  });
  it("refuse un lien qui ramène dans le dépôt", () => {
    const d = temp();
    symlinkSync(RACINE_DEPOT, join(d, "lien"));
    expect(boiteHorsDepot(join(d, "lien", "boite"))).toBe(false);
  });
});

describe("garde d'environnement", () => {
  it("refuse hors cloud et CI, accepte cloud et CI, jamais Windows", () => {
    expect(gardeDirect({}, "linux").ok).toBe(false);
    expect(gardeDirect({ CLAUDE_CODE_REMOTE: "true" }, "linux").ok).toBe(true);
    expect(gardeDirect({ CI: "true" }, "linux").ok).toBe(true);
    expect(gardeDirect({ CI: "true" }, "win32").ok).toBe(false);
    expect(gardeDirect({ CAPTURE_CONTENEUR: "true" }, "linux").ok).toBe(false);
  });
});

describe("zip en mémoire et préparation", () => {
  it("le zip est relu par le lecteur sûr, avec les mêmes octets", () => {
    const zip = construireZip([{ nom: "index.html", octets: Buffer.from("<html>") }, { nom: "a.css", octets: Buffer.from("x{}") }]);
    const e = lireArchive(zip);
    expect(e.map((x) => x.nom)).toEqual(["index.html", "a.css"]);
  });
  it("la maquette 05-stocks est rendue autonome (charte et police embarquées, adresses réécrites)", () => {
    const f = fichiersMaquetteAutonome(join(RACINE_DEPOT, "outils/maquettes-tableaux-de-bord/05-stocks"));
    const noms = f.map((x) => x.nom);
    expect(noms).toEqual(expect.arrayContaining(["index.html", "charte.css", "manrope-latin.woff2", "scenario.json"]));
    expect(f.find((x) => x.nom === "index.html")!.octets.toString()).not.toContain("../");
    expect(f.find((x) => x.nom === "charte.css")!.octets.toString()).not.toContain("../");
    expect(() => lireArchive(construireZip(f))).not.toThrow();
  });
  it("preparer écrit une demande film-zip conforme et PRET, sans rien laisser de .prep", () => {
    const boite = join(temp(), "boite");
    mkdirSync(boite);
    const r = preparer(boite, join(RACINE_DEPOT, "outils/maquettes-tableaux-de-bord/05-stocks"));
    expect(r.id).toMatch(/^[a-z0-9-]{8,64}$/);
    expect(readFileSync(join(r.dossier, "calage.json"), "utf8")).toContain("dureeVoixMs");
    expect(() => preparer(boite, join(RACINE_DEPOT, "outils/maquettes-tableaux-de-bord/05-stocks"))).toThrow();
  });
});

describe("lireReponseEssai", () => {
  const ID = "essai-0123456789ab";
  it("null sans réponse, refus d'un nom inconnu et d'un lien", () => {
    const boite = temp();
    mkdirSync(join(boite, "reponses"));
    expect(lireReponseEssai(boite, ID)).toBeNull();
    const d = join(boite, "reponses", `film-zip--${ID}`);
    mkdirSync(d);
    writeFileSync(join(d, "etat.txt"), "panne\nCAPTURE_ECHEC\n");
    expect(lireReponseEssai(boite, ID)).toMatchObject({ statut: "panne", code: "CAPTURE_ECHEC", octetsFilm: null });
    writeFileSync(join(d, "pirate"), "x");
    expect(() => lireReponseEssai(boite, ID)).toThrow();
  });
  it("refuse un film qui n'est pas un MP4", () => {
    const boite = temp();
    const d = join(boite, "reponses", `film-zip--${ID}`);
    mkdirSync(d, { recursive: true });
    for (const [n, c] of [["etat.txt", "ok\nOK\n"], ["navigation.mp4", "MZ pas un film........"], ["navigation.json", "{}"], ["ffprobe.json", "{}"]]) writeFileSync(join(d, n!), c!);
    expect(() => lireReponseEssai(boite, ID)).toThrow();
  });
});
