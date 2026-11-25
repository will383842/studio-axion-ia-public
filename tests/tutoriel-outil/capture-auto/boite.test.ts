/** POSTE-3 : boîte côté Studio, lecture HOSTILE de la réponse. Dossier temporaire réel ; aucun navigateur, 0 appel payant. */
import { spawnSync } from "node:child_process";
import * as nodeFs from "node:fs";
import { linkSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, truncateSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BORNES } from "../../../src/moteurs/montage-tutoriel-outil/capture-auto/contrat";
import { ErreurBoite, type SystemeFichiers, demandeEnVol, ecrireDemande, effacerReponse, etatBoite, lireReponse, noterEchec, tentatives } from "../../../src/services/tutoriel-capture-boite";

const ID = "essai-0123456789ab";
const NOM = `film-zip--${ID}`;
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]), Buffer.alloc(40)]);
let racine: string;

const demandeOk = () => ({ "dossier.zip": Buffer.from("PK"), "scenario.json": Buffer.from("{}"), "calage.json": Buffer.from("{}") });
const dossierRep = (n = NOM) => join(racine, "reponses", n);
function reponseOk(extra: (d: string) => void = () => undefined) {
  const d = dossierRep();
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "etat.txt"), "ok\nOK\n");
  writeFileSync(join(d, "navigation.mp4"), MP4);
  writeFileSync(join(d, "navigation.json"), "{}");
  writeFileSync(join(d, "ffprobe.json"), "{}");
  extra(d);
}
const refuse = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurBoite);
    expect((e as ErreurBoite).code).toBe("FILM_INVALIDE");
    return;
  }
  throw new Error("aurait dû refuser");
};

beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), "boite-test-"));
  for (const d of ["demandes", "reponses", "echecs"]) mkdirSync(join(racine, d));
});
afterEach(() => rmSync(racine, { recursive: true, force: true }));

describe("etatBoite", () => {
  const pret = () => {
    writeFileSync(join(racine, "PRET"), "");
    writeFileSync(join(racine, "pouls"), new Date().toISOString() + "\n");
  };
  it("prête quand PRET et pouls récent", () => {
    pret();
    expect(etatBoite(racine)).toBe("prete");
  });
  it("non prête sans PRET, ou PRET en lien symbolique, ou sans demandes/", () => {
    expect(etatBoite(racine)).toBe("non-prete");
    writeFileSync(join(racine, "cible"), "");
    symlinkSync(join(racine, "cible"), join(racine, "PRET"));
    expect(etatBoite(racine)).toBe("non-prete");
    rmSync(join(racine, "PRET"));
    pret();
    rmSync(join(racine, "demandes"), { recursive: true });
    expect(etatBoite(racine)).toBe("non-prete");
  });
  it("éteinte si le pouls est absent, vieux ou illisible", () => {
    writeFileSync(join(racine, "PRET"), "");
    expect(etatBoite(racine)).toBe("eteinte");
    writeFileSync(join(racine, "pouls"), new Date(Date.now() - 6 * 60_000).toISOString());
    expect(etatBoite(racine)).toBe("eteinte");
    writeFileSync(join(racine, "pouls"), "n'importe quoi");
    expect(etatBoite(racine)).toBe("eteinte");
  });
});

describe("ecrireDemande", () => {
  it("écrit puis renomme : aucun .prep restant", () => {
    ecrireDemande(racine, "film-zip", ID, demandeOk());
    expect(readdirSync(join(racine, "demandes"))).toEqual([NOM]);
    expect(readdirSync(join(racine, "demandes", NOM)).sort()).toEqual(["calage.json", "dossier.zip", "scenario.json"]);
    expect(demandeEnVol(racine)).toBe(true);
  });
  it("refuse un nom hors liste, un fichier manquant, un type ou un id invalide", () => {
    expect(() => ecrireDemande(racine, "film-zip", ID, { ...demandeOk(), "pirate.sh": Buffer.from("x") })).toThrow();
    const sans: Record<string, Buffer> = demandeOk();
    delete sans["calage.json"];
    expect(() => ecrireDemande(racine, "film-zip", ID, sans)).toThrow();
    expect(() => ecrireDemande(racine, "inconnu" as never, ID, demandeOk())).toThrow();
    expect(() => ecrireDemande(racine, "film-zip", "../x", demandeOk())).toThrow();
    expect(readdirSync(join(racine, "demandes"))).toEqual([]);
  });
  it("refuse une taille dépassée avant toute écriture", () => {
    expect(() => ecrireDemande(racine, "film-zip", ID, { ...demandeOk(), "scenario.json": Buffer.alloc(BORNES.json + 1) })).toThrow();
    expect(readdirSync(join(racine, "demandes"))).toEqual([]);
  });
  it("refuse un id déjà demandé, déjà répondu, ou à 2 tentatives", () => {
    ecrireDemande(racine, "film-zip", ID, demandeOk());
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow();
    rmSync(join(racine, "demandes", NOM), { recursive: true });
    mkdirSync(dossierRep());
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow();
    rmSync(dossierRep(), { recursive: true });
    noterEchec(racine, ID);
    noterEchec(racine, ID);
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow();
  });
  it("refuse si .prep-<id> existe déjà, même en lien symbolique", () => {
    mkdirSync(join(racine, "demandes", `.prep-${ID}`));
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow();
    rmSync(join(racine, "demandes", `.prep-${ID}`), { recursive: true });
    symlinkSync("/tmp", join(racine, "demandes", `.prep-${ID}`));
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow();
  });
  it("refuse si une demande d'un AUTRE id est en vol (dossier ou .prep-*), sans rien créer", () => {
    mkdirSync(join(racine, "demandes", "film-zip--autre-0123456789"));
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow(/déjà en cours/);
    expect(readdirSync(join(racine, "demandes"))).toEqual(["film-zip--autre-0123456789"]);
    rmSync(join(racine, "demandes", "film-zip--autre-0123456789"), { recursive: true });
    mkdirSync(join(racine, "demandes", ".prep-autre-0123456789"));
    expect(() => ecrireDemande(racine, "film-zip", ID, demandeOk())).toThrow(/déjà en cours/);
    expect(readdirSync(join(racine, "demandes"))).toEqual([".prep-autre-0123456789"]);
  });
  it("attendue.txt doit être une empreinte", () => {
    const f = { "description.json": Buffer.from("{}"), "attendue.txt": Buffer.from("PAS UNE EMPREINTE") };
    expect(() => ecrireDemande(racine, "apercu", ID, f)).toThrow();
    ecrireDemande(racine, "apercu", ID, { ...f, "attendue.txt": Buffer.from("abcdef0123456789\n") });
  });
});

describe("lireReponse (réponse hostile)", () => {
  it("rend null tant qu'il n'y a rien", () => expect(lireReponse(racine, "film-zip", ID)).toBeNull());
  it("accepte une réponse correcte", () => {
    reponseOk();
    const r = lireReponse(racine, "film-zip", ID)!;
    expect(r.statut).toBe("ok");
    expect(r.code).toBe("OK");
    expect(r.fichiers["navigation.mp4"]!.length).toBe(MP4.length);
  });
  it("accepte une panne réduite à etat.txt", () => {
    mkdirSync(dossierRep());
    writeFileSync(join(dossierRep(), "etat.txt"), "panne\nZIP_REFUSE\n");
    expect(lireReponse(racine, "film-zip", ID)).toMatchObject({ statut: "panne", code: "ZIP_REFUSE" });
  });
  it("refuse un dossier de réponse en lien symbolique", () => {
    reponseOk();
    rmSync(join(racine, "reponses", NOM), { recursive: true });
    const ailleurs = mkdtempSync(join(tmpdir(), "boite-ailleurs-"));
    try {
      writeFileSync(join(ailleurs, "etat.txt"), "ok\nOK\n");
      symlinkSync(ailleurs, dossierRep());
      refuse(() => lireReponse(racine, "film-zip", ID));
    } finally {
      rmSync(ailleurs, { recursive: true, force: true });
    }
  });
  it("refuse un fichier en lien vers /etc/passwd", () => {
    reponseOk((d) => {
      rmSync(join(d, "navigation.json"));
      symlinkSync("/etc/passwd", join(d, "navigation.json"));
    });
    refuse(() => lireReponse(racine, "film-zip", ID));
  });
  it("refuse un lien physique (nlink 2)", () => {
    const ailleurs = join(racine, "autre.json");
    writeFileSync(ailleurs, "{}");
    reponseOk((d) => {
      rmSync(join(d, "navigation.json"));
      linkSync(ailleurs, join(d, "navigation.json"));
    });
    refuse(() => lireReponse(racine, "film-zip", ID));
  });
  it("refuse un fichier trop gros (fichier creux)", () => {
    reponseOk((d) => truncateSync(join(d, "navigation.json"), BORNES.json + 1));
    refuse(() => lireReponse(racine, "film-zip", ID));
  });
  it("refuse un nom inconnu", () => {
    reponseOk((d) => writeFileSync(join(d, "pirate.txt"), "x"));
    refuse(() => lireReponse(racine, "film-zip", ID));
  });
  it("refuse un film qui n'est pas un MP4, un fichier manquant, un état tordu", () => {
    reponseOk((d) => writeFileSync(join(d, "navigation.mp4"), Buffer.alloc(64, 0x4d)));
    refuse(() => lireReponse(racine, "film-zip", ID));
    rmSync(dossierRep(), { recursive: true });
    reponseOk((d) => rmSync(join(d, "ffprobe.json")));
    refuse(() => lireReponse(racine, "film-zip", ID));
    rmSync(dossierRep(), { recursive: true });
    reponseOk((d) => writeFileSync(join(d, "etat.txt"), "ok\nPIRATE\n"));
    refuse(() => lireReponse(racine, "film-zip", ID));
  });
  describe("aperçu", () => {
    const nom = `apercu--${ID}`;
    const d = () => join(racine, "reponses", nom);
    const base = () => {
      mkdirSync(join(d(), "apercu"), { recursive: true });
      writeFileSync(join(d(), "etat.txt"), "ok\nOK\n");
      writeFileSync(join(d(), "apercu-piece.json"), "{}");
    };
    it("accepte des images valides", () => {
      base();
      writeFileSync(join(d(), "apercu", "accueil-1.png"), "png");
      expect(Object.keys(lireReponse(racine, "apercu", ID)!.fichiers)).toContain("apercu/accueil-1.png");
    });
    it("refuse apercu/ en lien, un nom d'image invalide, une image en lien, trop d'images", () => {
      base();
      writeFileSync(join(d(), "apercu", "Mauvais.PNG"), "x");
      refuse(() => lireReponse(racine, "apercu", ID));
      rmSync(d(), { recursive: true });
      base();
      symlinkSync("/etc/passwd", join(d(), "apercu", "lien.png"));
      refuse(() => lireReponse(racine, "apercu", ID));
      rmSync(d(), { recursive: true });
      base();
      for (let i = 0; i < 13; i++) writeFileSync(join(d(), "apercu", `i${i}.png`), "x");
      refuse(() => lireReponse(racine, "apercu", ID));
      rmSync(d(), { recursive: true });
      base();
      rmSync(join(d(), "apercu"), { recursive: true });
      symlinkSync(tmpdir(), join(d(), "apercu"));
      refuse(() => lireReponse(racine, "apercu", ID));
    });
  });
});

describe("lecture avec un fs simulé", () => {
  it("refuse « fichier remplacé » quand fstat rend un autre ino", () => {
    reponseOk();
    const fs: SystemeFichiers = {
      ...nodeFs,
      fstatSync: ((fd: number) => {
        const st = nodeFs.fstatSync(fd);
        return Object.assign(Object.create(Object.getPrototypeOf(st)), st, { ino: st.ino + 1 });
      }) as typeof nodeFs.fstatSync,
    };
    expect(() => lireReponse(racine, "film-zip", ID, fs)).toThrow(/remplacé/);
    refuse(() => lireReponse(racine, "film-zip", ID, fs));
  });
  it("refuse une lecture courte (fichier raccourci entre fstat et read)", () => {
    reponseOk();
    let appels = 0;
    const fs: SystemeFichiers = {
      ...nodeFs,
      readSync: ((fd: number, b: Buffer, off: number, len: number, pos: number) => (appels++ === 0 ? nodeFs.readSync(fd, b, off, Math.min(len, 3), pos) : 0)) as typeof nodeFs.readSync,
    };
    expect(() => lireReponse(racine, "film-zip", ID, fs)).toThrow(/modifié pendant la lecture/);
  });
  it("un readdir qui lève (ENOTDIR) donne FILM_INVALIDE, pas une erreur brute", () => {
    reponseOk();
    const fs: SystemeFichiers = {
      ...nodeFs,
      readdirSync: (() => {
        throw Object.assign(new Error("ENOTDIR"), { code: "ENOTDIR" });
      }) as unknown as typeof nodeFs.readdirSync,
    };
    refuse(() => lireReponse(racine, "film-zip", ID, fs));
  });
  it("un readdir qui lève dans apercu/ donne FILM_INVALIDE", () => {
    const d = join(racine, "reponses", `apercu--${ID}`);
    mkdirSync(join(d, "apercu"), { recursive: true });
    writeFileSync(join(d, "etat.txt"), "ok\nOK\n");
    writeFileSync(join(d, "apercu-piece.json"), "{}");
    let n = 0;
    const fs: SystemeFichiers = {
      ...nodeFs,
      readdirSync: ((p: string) => {
        if (n++ === 0) return nodeFs.readdirSync(p);
        throw new Error("ENOTDIR");
      }) as unknown as typeof nodeFs.readdirSync,
    };
    refuse(() => lireReponse(racine, "apercu", ID, fs));
  });
});

describe("noms hostiles dans les messages", () => {
  it("un nom avec séquence d'échappement et 200 caractères est neutralisé", () => {
    const hostile = `\u001b[31m${"x".repeat(200)}`;
    reponseOk((d) => writeFileSync(join(d, hostile), "x"));
    try {
      lireReponse(racine, "film-zip", ID);
      throw new Error("aurait dû refuser");
    } catch (e) {
      const m = (e as Error).message;
      expect(m).not.toContain("\u001b");
      expect(m).not.toContain("x".repeat(100));
      expect(m.length).toBeLessThan(160);
    }
  });
  it("un nom d'image hostile aussi", () => {
    const d = join(racine, "reponses", `apercu--${ID}`);
    mkdirSync(join(d, "apercu"), { recursive: true });
    writeFileSync(join(d, "etat.txt"), "ok\nOK\n");
    writeFileSync(join(d, "apercu-piece.json"), "{}");
    writeFileSync(join(d, "apercu", "\u001b[2Jpirate.png"), "x");
    expect(() => lireReponse(racine, "apercu", ID)).toThrow(expect.objectContaining({ message: expect.not.stringContaining("\u001b") }));
  });
});

describe("noterEchec durci", () => {
  it("crée echecs/ s'il est absent (0700)", () => {
    rmSync(join(racine, "echecs"), { recursive: true });
    expect(noterEchec(racine, ID)).toBe(1);
    expect(tentatives(racine, ID)).toBe(1);
    expect(lstatSync(join(racine, "echecs")).mode & 0o777).toBe(0o700);
  });
  it("refuse echecs/ s'il est un lien", () => {
    rmSync(join(racine, "echecs"), { recursive: true });
    symlinkSync(tmpdir(), join(racine, "echecs"));
    expect(() => noterEchec(racine, ID)).toThrow(ErreurBoite);
  });
  it("une FIFO posée à echecs/<id>.json ne bloque pas : l'ouverture échoue", () => {
    const fifo = join(racine, "echecs", `${ID}.json`);
    expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
    expect(() => noterEchec(racine, ID)).toThrow(ErreurBoite);
  });
});

describe("effacerReponse et tentatives", () => {
  it("ne suit pas un lien placé dedans : la cible survit", () => {
    const cible = join(racine, "precieux.txt");
    writeFileSync(cible, "vivant");
    reponseOk((d) => symlinkSync(cible, join(d, "lien")));
    effacerReponse(racine, "film-zip", ID);
    expect(existsSync(dossierRep())).toBe(false);
    expect(existsSync(cible)).toBe(true);
  });
  it("ne suit pas un lien à la place du dossier", () => {
    const dossier = join(racine, "autre");
    mkdirSync(dossier);
    writeFileSync(join(dossier, "f"), "x");
    symlinkSync(dossier, dossierRep());
    effacerReponse(racine, "film-zip", ID);
    expect(lstatSyncOuNul(dossierRep())).toBe(false);
    expect(existsSync(join(dossier, "f"))).toBe(true);
  });
  it("compte les tentatives, refuse un lien à la place du fichier", () => {
    expect(tentatives(racine, ID)).toBe(0);
    expect(noterEchec(racine, ID)).toBe(1);
    expect(tentatives(racine, ID)).toBe(1);
    expect(noterEchec(racine, ID)).toBe(2);
    rmSync(join(racine, "echecs", `${ID}.json`));
    writeFileSync(join(racine, "cible.json"), "{}");
    symlinkSync(join(racine, "cible.json"), join(racine, "echecs", `${ID}.json`));
    expect(tentatives(racine, ID)).toBe(2);
    expect(() => noterEchec(racine, ID)).toThrow();
  });
});

function lstatSyncOuNul(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

