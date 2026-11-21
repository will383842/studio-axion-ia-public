/**
 * T-EXT-51c : décompression sûre d'un .zip. Les .zip sont FABRIQUÉS ici (petit écrivain, octets à la main) : aucun binaire tiers.
 */
import { spawnSync } from "node:child_process";
import { constants, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DRAPEAUX_ECRITURE,
  EXTENSIONS_AUTORISEES,
  ErreurZip,
  LIMITES,
  crc32,
  creerParents,
  extraireOctets,
  decompresserZip,
  ecrireFichierSur,
  lireArchive,
  lireArchiveSurDisque,
  validerNom,
  type Limites,
} from "../../../outils/maquettes-tableaux-de-bord/capture/decompresser-zip";

interface Ent {
  nom: string;
  donnees?: Buffer | string;
  methode?: 0 | 8;
  externes?: number;
  faitPar?: number;
  drapeaux?: number;
  /** Mensonges d'en-tête. */
  tailleAnnoncee?: number;
  crc?: number;
  methodeLocale?: number;
  nomLocal?: string;
  tailleLocale?: number;
  brut?: Buffer; // données déjà compressées à poser telles quelles
  decalageLocal?: number;
}

/** Écrivain zip minimal : en-têtes locaux + répertoire central + fin. */
function zip(entrees: Ent[], opts: { commentaire?: string; patchFin?: (b: Buffer) => void } = {}): Buffer {
  const parts: Buffer[] = [];
  const centraux: Buffer[] = [];
  let pos = 0;
  for (const e of entrees) {
    const donnees = Buffer.from(e.donnees ?? "");
    const methode = e.methode ?? 8;
    const comp = e.brut ?? (methode === 8 ? deflateRawSync(donnees) : donnees);
    const crc = e.crc ?? crc32(donnees);
    const tailleA = e.tailleAnnoncee ?? donnees.length;
    const nom = Buffer.from(e.nom, "utf8");
    const nomL = Buffer.from(e.nomLocal ?? e.nom, "utf8");
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt16LE((e.drapeaux ?? 0) & ~0x8, 6);
    l.writeUInt16LE(e.methodeLocale ?? methode, 8);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(comp.length, 18);
    l.writeUInt32LE(e.tailleLocale ?? tailleA, 22);
    l.writeUInt16LE(nomL.length, 26);
    const debut = pos;
    parts.push(l, nomL, comp);
    pos += 30 + nomL.length + comp.length;
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(((e.faitPar ?? 3) << 8) | 20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(e.drapeaux ?? 0, 8);
    c.writeUInt16LE(methode, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(tailleA, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(e.externes ?? ((e.nom.endsWith("/") ? 0o040755 : 0o100644) << 16) >>> 0, 38);
    c.writeUInt32LE(e.decalageLocal ?? debut, 42);
    centraux.push(c, nom);
  }
  const central = Buffer.concat(centraux);
  const commentaire = Buffer.from(opts.commentaire ?? "");
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(central.length, 12);
  fin.writeUInt32LE(pos, 16);
  fin.writeUInt16LE(commentaire.length, 20);
  opts.patchFin?.(fin);
  return Buffer.concat([...parts, central, fin, commentaire]);
}

let racine: string;
let sortie: string;
beforeEach(() => {
  racine = mkdtempSync(join(tmpdir(), "zip51c-"));
  sortie = join(racine, "sortie", "maquette");
  mkdirSync(join(racine, "sortie"));
});
afterEach(() => rmSync(racine, { recursive: true, force: true }));

/** Vrai seulement si l'appel lève ErreurZip de la famille donnée ET que rien n'est resté (ni sortie ni temporaire). */
function refuse(z: Buffer, famille: string, motif?: RegExp, lim: Limites = LIMITES): void {
  let err: unknown;
  try {
    decompresserZip(z, sortie, lim);
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(ErreurZip);
  expect((err as ErreurZip).famille).toBe(famille);
  if (motif) expect((err as ErreurZip).message).toMatch(motif);
  expect(readdirSync(join(racine, "sortie"))).toEqual([]);
}

describe("archive saine", () => {
  it("décompresse (stockée et deflate), crée les dossiers, relit les mêmes octets", () => {
    const z = zip([
      { nom: "index.html", donnees: "<h1>Bonjour é</h1>".repeat(50) },
      { nom: "css/", externes: (0o040755 << 16) >>> 0 },
      { nom: "css/site.css", donnees: "body{color:red}", methode: 0 },
      { nom: "img/a/b/logo.PNG", donnees: Buffer.from([1, 2, 3, 0, 255]) },
    ]);
    const r = decompresserZip(z, sortie);
    expect(r.fichiers).toBe(3);
    expect(readFileSync(join(sortie, "index.html"), "utf8")).toBe("<h1>Bonjour é</h1>".repeat(50));
    expect(readFileSync(join(sortie, "css/site.css"), "utf8")).toBe("body{color:red}");
    expect([...readFileSync(join(sortie, "img/a/b/logo.PNG"))]).toEqual([1, 2, 3, 0, 255]);
    expect(readdirSync(join(racine, "sortie"))).toEqual(["maquette"]);
  });
  it("accepte une sortie existante vide", () => {
    mkdirSync(sortie);
    decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), sortie);
    expect(readFileSync(join(sortie, "a.txt"), "utf8")).toBe("x");
  });
  it("crc32 : valeur connue", () => expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926));
});

describe("zip-slip et noms", () => {
  const mauvais: [string, string][] = [
    ["chemin absolu", "/x.txt"],
    ["lettre de lecteur", "C:\\x.txt"],
    ["lecteur sans antislash", "C:x.txt"],
    ["UNC", "\\\\serveur\\partage\\x.txt"],
    ["..", "../x.txt"],
    ["..  au milieu", "a/../../x.txt"],
    ["..  après normalisation", "a/b/../../../x.txt"],
    ["avec antislash", "..\\x.txt"],
    ["antislash simple", "a\\b.txt"],
    ["encodé", "%2e%2e/x.txt"],
    ["encodé majuscule", "a/%2E%2E/x.txt"],
    ["segment point", "./x.txt"],
    ["segment vide", "a//x.txt"],
    ["nom vide", ""],
    ["NUL", "a\u0000.txt"],
    ["contrôle (\\n)", "a\nb.txt"],
    ["contrôle (DEL)", "a\u007f.txt"],
    ["profondeur 17", Array(16).fill("d").join("/") + "/x.txt"],
    ["nom de 256 octets", "a".repeat(252) + ".txt"],
    ["chemin > 1024 octets", Array(8).fill("d".repeat(200)).join("/") + "/x.txt"],
  ];
  for (const [titre, nom] of mauvais) {
    it(`refuse : ${titre}`, () => {
      expect(() => validerNom(nom)).toThrow(ErreurZip);
      refuse(zip([{ nom, donnees: "x" }]), "chemin");
    });
  }
  it("accepte la profondeur 16 et un nom de 255 octets", () => {
    expect(() => validerNom(Array(15).fill("d").join("/") + "/x.txt")).not.toThrow();
    expect(() => validerNom("a".repeat(251) + ".txt")).not.toThrow();
  });
  it("refuse un nom qui n'est pas de l'UTF-8 valide", () => {
    const z = zip([{ nom: "abc.txt", donnees: "x" }]);
    const i = z.indexOf("abc.txt", z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])));
    z[i] = 0xff;
    z[z.indexOf("abc.txt")] = 0xff;
    refuse(z, "chemin", /UTF-8/);
  });
  it("refuse les doublons exacts", () => refuse(zip([{ nom: "a.txt", donnees: "1" }, { nom: "a.txt", donnees: "2" }]), "chemin", /double/));
  it("refuse les doublons par casse", () => refuse(zip([{ nom: "A.txt", donnees: "1" }, { nom: "a.TXT", donnees: "2" }]), "chemin", /double/));
  it("refuse les doublons par normalisation Unicode NFC/NFD", () =>
    refuse(zip([{ nom: "\u00e9.txt", donnees: "1" }, { nom: "e\u0301.txt", donnees: "2" }]), "chemin", /double/));
  it("refuse un fichier qui sert aussi de dossier", () => refuse(zip([{ nom: "a.txt", donnees: "1" }, { nom: "a.txt/b.txt", donnees: "2" }]), "chemin"));
  it("rien n'est écrit hors de la sortie (aucun x.txt à côté)", () => {
    expect(() => decompresserZip(zip([{ nom: "../x.txt", donnees: "x" }]), sortie)).toThrow();
    expect(existsSync(join(racine, "sortie", "x.txt"))).toBe(false);
    expect(existsSync(join(racine, "x.txt"))).toBe(false);
  });
});

describe("liens symboliques et sortie", () => {
  it("refuse une entrée S_IFLNK", () => refuse(zip([{ nom: "l.txt", donnees: "/etc/passwd", externes: (0o120777 << 16) >>> 0 }]), "lien", /symbolique/));
  it("refuse un autre type (FIFO, périphérique) venant d'Unix", () => {
    refuse(zip([{ nom: "f.txt", donnees: "", externes: (0o010644 << 16) >>> 0 }]), "lien");
    refuse(zip([{ nom: "c.txt", donnees: "", externes: (0o020644 << 16) >>> 0 }]), "lien");
  });
  it("refuse un lien même si l'hôte annoncé n'est pas Unix", () => refuse(zip([{ nom: "l.txt", donnees: "x", faitPar: 0, externes: (0o120777 << 16) >>> 0 }]), "lien"));
  it("incohérence type dossier / nom", () => refuse(zip([{ nom: "d.txt", donnees: "", externes: (0o040755 << 16) >>> 0 }]), "format"));
  it("DRAPEAUX_ECRITURE contient O_NOFOLLOW, O_EXCL, O_CREAT, O_WRONLY", () => {
    expect(DRAPEAUX_ECRITURE).toBe(constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW);
    expect(DRAPEAUX_ECRITURE & constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
  });
  it("ecrireFichierSur refuse un lien symbolique déjà posé (même vers un fichier absent)", () => {
    const cible = join(racine, "secret");
    writeFileSync(cible, "SECRET");
    symlinkSync(cible, join(racine, "lien.txt"));
    symlinkSync(join(racine, "absent"), join(racine, "pendant.txt"));
    expect(() => ecrireFichierSur(join(racine, "lien.txt"), Buffer.from("x"))).toThrow(ErreurZip);
    expect(() => ecrireFichierSur(join(racine, "pendant.txt"), Buffer.from("x"))).toThrow(ErreurZip);
    expect(existsSync(join(racine, "absent"))).toBe(false);
    expect(readFileSync(cible, "utf8")).toBe("SECRET");
  });
  it("ecrireFichierSur refuse d'écraser un fichier existant (O_EXCL)", () => {
    writeFileSync(join(racine, "e.txt"), "ancien");
    expect(() => ecrireFichierSur(join(racine, "e.txt"), Buffer.from("x"))).toThrow(ErreurZip);
    expect(readFileSync(join(racine, "e.txt"), "utf8")).toBe("ancien");
  });
  it("creerParents refuse un parent qui est un lien symbolique", () => {
    mkdirSync(join(racine, "vrai"));
    symlinkSync(join(racine, "vrai"), join(racine, "lien"));
    expect(() => creerParents(racine, ["lien", "sous"])).toThrow(/Parent non sûr/);
    expect(existsSync(join(racine, "vrai", "sous"))).toBe(false);
  });
  it("creerParents crée en 0o755 (hors umask)", () => {
    const p = creerParents(racine, ["a", "b"]);
    expect(p).toBe(join(racine, "a", "b"));
    expect(existsSync(p)).toBe(true);
  });
  it("lireArchiveSurDisque refuse un lien symbolique et un dossier", () => {
    const z = join(racine, "r.zip");
    writeFileSync(z, zip([{ nom: "a.txt", donnees: "x" }]));
    symlinkSync(z, join(racine, "lien.zip"));
    expect(() => lireArchiveSurDisque(join(racine, "lien.zip"))).toThrow(ErreurZip);
    expect(() => lireArchiveSurDisque(racine)).toThrow(ErreurZip);
    expect(lireArchiveSurDisque(z).length).toBeGreaterThan(20);
  });
  it("refuse une sortie existante non vide, sans toucher son contenu", () => {
    mkdirSync(sortie);
    writeFileSync(join(sortie, "deja.txt"), "là");
    expect(() => decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), sortie)).toThrow(/pas vide/);
    expect(readdirSync(sortie)).toEqual(["deja.txt"]);
  });
  it("refuse une sortie qui est un lien symbolique", () => {
    mkdirSync(join(racine, "vraie"));
    symlinkSync(join(racine, "vraie"), sortie);
    expect(() => decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), sortie)).toThrow(ErreurZip);
    expect(readdirSync(join(racine, "vraie"))).toEqual([]);
  });
});

describe("bombes", () => {
  const petit: Limites = { ...LIMITES, parFichier: 1000, totalDecompresse: 1500, seuilRatio: 100, ratio: 10, entrees: 3 };
  it("trop d'entrées", () =>
    refuse(zip([1, 2, 3, 4].map((i) => ({ nom: `f${i}.txt`, donnees: "x" }))), "bombe", /entrées/, petit));
  it("plafond de 2000 entrées par défaut", () => {
    const z = zip(Array.from({ length: 2001 }, (_, i) => ({ nom: `f${i}.txt`, donnees: "", methode: 0 as const })));
    refuse(z, "bombe", /entrées/);
  });
  it("archive trop grande", () => refuse(zip([{ nom: "a.txt", donnees: "x" }]), "bombe", /trop grande/, { ...LIMITES, tailleArchive: 20 }));
  it("fichier annoncé trop gros", () => refuse(zip([{ nom: "a.txt", donnees: "x", tailleAnnoncee: 5000 }]), "bombe", /trop gros/, petit));
  it("total annoncé trop grand", () =>
    refuse(zip([{ nom: "a.txt", donnees: "a".repeat(900) }, { nom: "b.txt", donnees: "b".repeat(900) }]), "bombe", /totale/, { ...petit, ratio: 10000 }));
  it("ratio > 100:1 refusé au-dessus de 1 Mio", () => {
    const grand = Buffer.alloc(3 * 1024 * 1024); // zéros : se compresse à ~3 Ko
    refuse(zip([{ nom: "z.txt", donnees: grand }]), "bombe", /Ratio/);
  });
  it("ratio élevé toléré sous le seuil (petit fichier)", () => {
    decompresserZip(zip([{ nom: "z.txt", donnees: Buffer.alloc(100_000) }]), sortie);
    expect(readFileSync(join(sortie, "z.txt")).length).toBe(100_000);
  });
  it("EN-TÊTE MENTEUR : annonce 10 octets, contient bien plus : coupé tôt, rien d'écrit", () => {
    const vrai = Buffer.alloc(40 * 1024 * 1024, 7); // 40 Mio
    const z = zip([{ nom: "a.txt", donnees: vrai, tailleAnnoncee: 10, crc: 0 }]);
    const t0 = Date.now();
    refuse(z, "bombe", /interrompue/);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it("EN-TÊTE MENTEUR sous le plafond du fichier : la sortie ne dépasse JAMAIS le plafond", () => {
    // Annonce = plafond par fichier ; le contenu réel est 10 fois plus grand.
    const lim: Limites = { ...LIMITES, parFichier: 100_000, ratio: 100000 };
    const z = zip([{ nom: "a.txt", donnees: Buffer.alloc(1_000_000, 1), tailleAnnoncee: 100_000, crc: 0 }]);
    refuse(z, "bombe", /interrompue/, lim);
    // Mesure : l'extraction directe lève avant d'avoir produit plus que plafond+1 octets (maxOutputLength de zlib).
    const e = lireArchive(z, lim)[0]!;
    expect(() => extraireOctetsLimite(z, e, lim)).toThrow(/interrompue/);
  });
  it("budget total restant : une 2e entrée mensongère est coupée au budget", () => {
    const lim: Limites = { ...LIMITES, totalDecompresse: 3000, parFichier: 2500, ratio: 100000 };
    const z = zip([
      { nom: "a.txt", donnees: Buffer.alloc(2000, 1) },
      { nom: "b.txt", donnees: Buffer.alloc(2000, 2), tailleAnnoncee: 900, crc: 0 },
    ]);
    refuse(z, "bombe", undefined, lim);
  });
  it("zip imbriqué : un .zip dans le .zip est refusé (extension) et jamais décompressé", () => {
    const interne = zip([{ nom: "a.txt", donnees: "x" }]);
    refuse(zip([{ nom: "dedans.zip", donnees: interne }]), "extension", /Extension/);
  });
  it("refuse le chiffrement (bit 0), le chiffrement fort (bit 6)", () => {
    refuse(zip([{ nom: "a.txt", donnees: "x", drapeaux: 0x1 }]), "chiffrement");
    refuse(zip([{ nom: "a.txt", donnees: "x", drapeaux: 0x41 }]), "chiffrement");
  });
  it("refuse une méthode autre que 0/8 (bzip2 = 12, AES = 99)", () => {
    for (const m of [12, 99]) {
      const z = zip([{ nom: "a.txt", donnees: "x" }]);
      z.writeUInt16LE(m, z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 10);
      refuse(z, "format", /Méthode/);
    }
  });
  it("refuse ZIP64 (marqueurs 0xFFFF / 0xFFFFFFFF, localisateur)", () => {
    refuse(zip([{ nom: "a.txt", donnees: "x" }], { patchFin: (f) => f.writeUInt16LE(0xffff, 10) }), "format", /ZIP64|multi/);
    refuse(zip([{ nom: "a.txt", donnees: "x" }], { patchFin: (f) => f.writeUInt32LE(0xffffffff, 16) }), "format", /ZIP64/);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    const z = zip([{ nom: "a.txt", donnees: "x" }]);
    const fin = z.length - 22;
    refuse(Buffer.concat([z.subarray(0, fin), loc, z.subarray(fin)]), "format");
  });
  it("refuse multi-disques", () => {
    refuse(zip([{ nom: "a.txt", donnees: "x" }], { patchFin: (f) => f.writeUInt16LE(1, 4) }), "format", /multi-disques/);
  });
  it("refuse incohérence local/central : nom, méthode, tailles", () => {
    refuse(zip([{ nom: "a.txt", donnees: "x", nomLocal: "b.txt" }]), "format", /Nom local/);
    refuse(zip([{ nom: "a.txt", donnees: "x", methodeLocale: 0 }]), "format", /Méthode locale/);
    refuse(zip([{ nom: "a.txt", donnees: "xyz", tailleLocale: 99 }]), "format", /locaux/);
  });
  it("refuse un CRC32 faux", () => refuse(zip([{ nom: "a.txt", donnees: "bonjour", crc: 1234 }]), "format", /CRC32/));
  it("refuse une taille annoncée ≠ taille réelle (sans dépassement)", () => refuse(zip([{ nom: "a.txt", donnees: "bonjour", tailleAnnoncee: 3 }]), "bombe"));
  it("refuse des données deflate corrompues", () => refuse(zip([{ nom: "a.txt", donnees: "abc", brut: Buffer.from([0xff, 0xff, 0xff]) }]), "format"));
  it("refuse des données hors du fichier (taille compressée géante)", () => {
    const z = zip([{ nom: "a.txt", donnees: "x" }]);
    z.writeUInt32LE(100000, z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 20);
    refuse(z, "format");
  });
  it("refuse un décalage local hors du fichier", () => refuse(zip([{ nom: "a.txt", donnees: "x", decalageLocal: 5000 }]), "format", /local/));
  it("refuse les entrées qui se chevauchent (b.txt pointe DANS les données de a.txt : zip quine)", () => {
    const interne = zip([{ nom: "b.txt", donnees: "hi", methode: 0 }]).subarray(0, 30 + 5 + 2);
    const z = zip([{ nom: "a.txt", donnees: interne, methode: 0 }, { nom: "b.txt", donnees: "hi", methode: 0, decalageLocal: 30 + 5 }]);
    refuse(z, "format", /chevauchent/);
  });
  it("refuse deux entrées qui pointent vers le même en-tête local", () => {
    const z = zip([{ nom: "a.txt", donnees: "abcdef" }, { nom: "b.txt", donnees: "abcdef" }]);
    // b.txt pointe vers l'en-tête local de a.txt : même plage.
    const c2 = z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), z.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 4);
    z.writeUInt32LE(0, c2 + 42);
    refuse(z, "format");
  });
  it("refuse des octets parasites après le répertoire central / archive tronquée", () => {
    const z = zip([{ nom: "a.txt", donnees: "x" }]);
    refuse(Buffer.concat([z, Buffer.from("parasite")]), "format");
    refuse(z.subarray(0, z.length - 5), "format");
    refuse(Buffer.from("pas un zip du tout, même pas un peu"), "format");
  });
});

describe("extensions", () => {
  it("liste fermée", () => expect([...EXTENSIONS_AUTORISEES]).toEqual(["html", "css", "js", "json", "svg", "png", "jpg", "jpeg", "webp", "woff2", "txt"]));
  for (const nom of ["x.exe", "x.php", "x.sh", "x.zip", "x.html.exe", "sans-extension", ".htaccess", "x.mp4", "x.woff"]) {
    it(`refuse ${nom}`, () => refuse(zip([{ nom, donnees: "x" }]), "extension"));
  }
  for (const ext of EXTENSIONS_AUTORISEES) {
    it(`accepte .${ext}`, () => expect(lireArchive(zip([{ nom: `f.${ext}`, donnees: "x" }])).length).toBe(1));
  }
});

describe("rien de partiel après un échec en cours de route", () => {
  it("une 3e entrée mauvaise : les deux premières ne restent pas", () => {
    refuse(zip([{ nom: "a.txt", donnees: "1" }, { nom: "d/b.txt", donnees: "2" }, { nom: "c.txt", donnees: "3", crc: 7 }]), "format", /CRC32/);
  });
});

describe("lanceur decompresser.mts", () => {
  const LANCEUR = "outils/maquettes-tableaux-de-bord/capture/decompresser.mts";
  const lancer = (argv: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, ["--import", "tsx", LANCEUR, ...argv], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" as const, cwd: process.cwd() });
  it("code 3 hors cloud/CI", () => {
    const r = lancer(["--zip", "x", "--sortie", "y"], {});
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("Capture interdite");
  });
  it("code 4 sans arguments, code 4 archive refusée, code 0 archive saine", () => {
    expect(lancer([], { CI: "true" }).status).toBe(4);
    const mauvais = join(racine, "m.zip");
    writeFileSync(mauvais, zip([{ nom: "../x.txt", donnees: "x" }]));
    const r = lancer(["--zip", mauvais, "--sortie", sortie], { CI: "true" });
    expect(r.status).toBe(4);
    expect(r.stderr).toContain("Archive refusée");
    expect(readdirSync(join(racine, "sortie"))).toEqual([]);
    const bon = join(racine, "b.zip");
    writeFileSync(bon, zip([{ nom: "index.html", donnees: "<p>ok</p>" }]));
    const ok = lancer(["--zip", bon, "--sortie", sortie], { CI: "true" });
    expect(ok.status).toBe(0);
    expect(readFileSync(join(sortie, "index.html"), "utf8")).toBe("<p>ok</p>");
  });
});

// Mesure directe : appelle l'extraction avec un budget et vérifie qu'elle lève au lieu de produire plus que le plafond.
function extraireOctetsLimite(z: Buffer, e: ReturnType<typeof lireArchive>[number], lim: Limites): Buffer {
  return extraireOctets(z, e, lim.totalDecompresse, lim);
}
