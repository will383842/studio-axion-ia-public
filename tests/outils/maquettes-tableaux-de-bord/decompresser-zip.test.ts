/**
 * T-EXT-51c : décompression sûre d'un .zip. Les .zip sont FABRIQUÉS ici (petit écrivain, octets à la main) : aucun binaire tiers.
 */
import { spawn, spawnSync } from "node:child_process";
import { chownSync, constants, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
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
  estDechetSysteme,
  nettoyerRestesTemporaires,
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
  /** Vrai : bit 3 (data descriptor) : CRC et tailles à 0 dans l'en-tête local, descripteur `PK\x07\x08` après les données. */
  descripteur?: boolean;
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
    l.writeUInt16LE(e.descripteur ? (e.drapeaux ?? 0) | 0x8 : (e.drapeaux ?? 0) & ~0x8, 6);
    l.writeUInt16LE(e.methodeLocale ?? methode, 8);
    if (!e.descripteur) {
      l.writeUInt32LE(crc, 14);
      l.writeUInt32LE(comp.length, 18);
      l.writeUInt32LE(e.tailleLocale ?? tailleA, 22);
    }
    l.writeUInt16LE(nomL.length, 26);
    const debut = pos;
    parts.push(l, nomL, comp);
    pos += 30 + nomL.length + comp.length;
    if (e.descripteur) {
      const d = Buffer.alloc(16);
      d.writeUInt32LE(0x08074b50, 0);
      d.writeUInt32LE(crc, 4);
      d.writeUInt32LE(comp.length, 8);
      d.writeUInt32LE(tailleA, 12);
      parts.push(d);
      pos += 16;
    }
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(((e.faitPar ?? 3) << 8) | 20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE((e.drapeaux ?? 0) | (e.descripteur ? 0x8 : 0), 8);
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
  it("creerParents crée chaque niveau en 0o755 filtré par l'umask (jamais plus large)", () => {
    const p = creerParents(racine, ["a", "b"]);
    expect(p).toBe(join(racine, "a", "b"));
    for (const d of [join(racine, "a"), p]) expect(statSync(d).mode & 0o777).toBe(0o755 & ~process.umask());
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
  it("2e entrée mensongère (annonce 900, contenu 2000) : refusée ; le budget total seul est verrouillé par le test extraireOctets", () => {
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
    refuse(Buffer.concat([z.subarray(0, fin), loc, z.subarray(fin)]), "format", /ZIP64/); // message du localisateur, pas celui de l'incohérence centrale
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
  it("taille annoncée TROP PETITE (le contenu dépasse l'annonce) : coupé et refusé comme bombe", () =>
    refuse(zip([{ nom: "a.txt", donnees: "bonjour", tailleAnnoncee: 3 }]), "bombe", /interrompue/));
  it("taille réelle PLUS PETITE que l'annoncée : refusée comme format (Taille réelle ≠ annoncée)", () =>
    refuse(zip([{ nom: "a.txt", donnees: "bonjour", tailleAnnoncee: 100 }]), "format", /Taille réelle/));
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
  it("liste fermée", () => expect([...EXTENSIONS_AUTORISEES]).toEqual(["html", "css", "js", "json", "svg", "png", "jpg", "jpeg", "webp", "woff2", "txt", "md"]));
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
    spawnSync(process.execPath, ["--import", "tsx", LANCEUR, ...argv], { env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" as const, cwd: process.cwd(), timeout: 20_000 });
  it("code 3 hors cloud/CI", { timeout: 30_000 }, () => {
    const r = lancer(["--zip", "x", "--sortie", "y"], {});
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("Capture interdite");
  });
  it("code 4 sans arguments, code 4 archive refusée, code 0 archive saine", { timeout: 30_000 }, () => {
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


// ---------------------------------------------------------------------------------------------------------------------
// T-EXT-51c correctif : gardes isolées, déchets système, vrais formats, temporaires périmés, garde du conteneur.
// ---------------------------------------------------------------------------------------------------------------------
const LANCEUR_CHEMIN = "outils/maquettes-tableaux-de-bord/capture/decompresser.mts";
const lanceur = (argv: string[], env: Record<string, string>, timeout = 20_000) =>
  spawnSync(process.execPath, ["--import", "tsx", LANCEUR_CHEMIN, ...argv], {
    env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8" as const,
    cwd: process.cwd(),
    timeout,
  });
const EN_CONTENEUR = existsSync("/.dockerenv") || existsSync("/run/.containerenv");

describe("gardes testées seules (une par une)", () => {
  it("antislash brut : refusé AVANT la découpe (message « Antislash »)", () => {
    for (const nom of ["..\\x.txt", "a\\b.txt"]) expect(() => validerNom(nom)).toThrow(/Antislash/);
  });
  it("antislash obtenu par décodage (%5C) : refusé par le contrôle de segment (message « Segment »)", () => {
    expect(() => validerNom("a/%5Cb.txt")).toThrow(/Segment/);
    expect(() => validerNom("a/%2Fb.txt")).toThrow(/Segment/);
  });
  it("le budget total restant coupe l'inflation seul (annonce et fichier corrects, budget 100 octets)", () => {
    const z = zip([{ nom: "a.txt", donnees: Buffer.alloc(2000, 1) }]);
    const e = lireArchive(z)[0]!;
    expect(() => extraireOctets(z, e, 100)).toThrow(/interrompue/);
    expect(extraireOctets(z, e, 2000).length).toBe(2000);
  });
  it("lireArchiveSurDisque : le plafond de taille est lu sur le descripteur AVANT de charger l'archive", () => {
    const f = join(racine, "gros.zip");
    writeFileSync(f, zip([{ nom: "a.txt", donnees: "x".repeat(500) }]));
    let err: unknown;
    try {
      lireArchiveSurDisque(f, { ...LIMITES, tailleArchive: 10 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ErreurZip);
    expect((err as ErreurZip).famille).toBe("bombe");
    expect((err as ErreurZip).message).toMatch(/\(\d+ > 10 octets\)/); // message de la lecture disque, pas celui de lireArchive
  });
  it("un parent de la sortie qui est un lien symbolique est refusé, la cible reste vide", () => {
    mkdirSync(join(racine, "vrai"));
    symlinkSync(join(racine, "vrai"), join(racine, "lienparent"));
    const z = zip([{ nom: "a.txt", donnees: "x" }]);
    expect(() => decompresserZip(z, join(racine, "lienparent", "maquette"))).toThrow(/parent de la sortie n'est pas un dossier ordinaire/);
    expect(readdirSync(join(racine, "vrai"))).toEqual([]);
  });
  it("sortie = racine du disque : refusée en français (sous-dossier demandé)", () => {
    expect(() => decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), "/")).toThrow(/SOUS-DOSSIER/);
  });
  // Sous root, le parent « / » est inscriptible : c'est le contrôle du POINT DE MONTAGE qui refuse. Hors root (CI), « / » n'est pas
  // inscriptible : c'est le contrôle d'écriture qui refuse en premier. Dans les deux cas : famille « sortie », message français, sous-dossier demandé.
  it.skipIf(process.platform !== "linux" || !existsSync("/proc/self"))("sortie = point de montage (/proc) : refusée en français, rien n'est tenté", () => {
    let err: unknown;
    try {
      decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), "/proc");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ErreurZip);
    expect((err as ErreurZip).famille).toBe("sortie");
    expect((err as ErreurZip).message).toMatch(process.getuid?.() === 0 ? /point de montage.*SOUS-DOSSIER/ : /pas inscriptible.*SOUS-DOSSIER/);
    expect(readdirSync("/").some((n) => n.startsWith(".decompression-"))).toBe(false);
  });
  it.skipIf(process.getuid?.() === 0)("parent de la sortie non inscriptible : refusé en français (code 4 par le lanceur)", () => {
    // (ignoré pour root : root passe outre les droits ; vérifié en lecture seule réelle par les essais Docker de la PR)
    const ro = join(racine, "ro");
    mkdirSync(ro, { mode: 0o555 });
    expect(() => decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), join(ro, "m"))).toThrow(/pas inscriptible.*SOUS-DOSSIER/);
  });
  it("lanceur : --sortie = point de montage ou racine → code 4 et message en français", { timeout: 30_000 }, () => {
    const bon = join(racine, "b.zip");
    writeFileSync(bon, zip([{ nom: "index.html", donnees: "<p>ok</p>" }]));
    const r = lanceur(["--zip", bon, "--sortie", "/"], { CI: "true" });
    expect(r.status).toBe(4);
    expect(r.stderr).toMatch(/Archive refusée \(sortie\).*SOUS-DOSSIER/);
  });
  it("lanceur : code 1 (erreur inattendue) quand le renommage final échoue (nom de sortie de 300 octets) ; le temporaire est supprimé", { timeout: 30_000 }, () => {
    const bon = join(racine, "b.zip");
    writeFileSync(bon, zip([{ nom: "index.html", donnees: "<p>ok</p>" }]));
    const r = lanceur(["--zip", bon, "--sortie", join(racine, "sortie", "a".repeat(300))], { CI: "true" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Erreur inattendue");
    expect(readdirSync(join(racine, "sortie"))).toEqual([]);
  });
  it("lanceur : une FIFO en --zip est refusée tout de suite (O_NONBLOCK), sans attendre un écrivain", { timeout: 30_000 }, () => {
    const fifo = join(racine, "tube.zip");
    expect(spawnSync("mkfifo", [fifo]).status).toBe(0);
    const t0 = Date.now();
    const r = lanceur(["--zip", fifo, "--sortie", sortie], { CI: "true" }, 15_000);
    expect(r.status).toBe(4); // null (tué par le délai) si l'ouverture bloque
    expect(r.stderr).toContain("pas un fichier ordinaire");
    expect(Date.now() - t0).toBeLessThan(14_000);
  });
});

describe("déchets système ignorés (liste fermée), jamais écrits", () => {
  it("estDechetSysteme : liste fermée exacte", () => {
    for (const s of [["__MACOSX", "a.html"], ["__MACOSX", "d", "._a.html"], [".DS_Store"], ["a", ".DS_Store"], ["Thumbs.db"], ["a", "THUMBS.DB"], ["desktop.ini"], ["a", "._x.css"]])
      expect(estDechetSysteme(s), s.join("/")).toBe(true);
    for (const s of [["__MACOSX"], ["a", "__MACOSX", "b.html"], ["index.html"], [".htaccess"], ["x._y.css"], ["thumbs.db.exe"]])
      expect(estDechetSysteme(s), s.join("/")).toBe(false);
  });
  it("une archive de Finder/Explorateur est acceptée : déchets comptés, listés, non écrits", () => {
    const z = zip([
      { nom: "index.html", donnees: "<p>ok</p>" },
      { nom: "__MACOSX/", externes: (0o040755 << 16) >>> 0 },
      { nom: "__MACOSX/._index.html", donnees: Buffer.from([0, 5, 22, 7, 0, 2, 0, 0]) },
      { nom: ".DS_Store", donnees: Buffer.from([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31]) },
      { nom: "css/", externes: (0o040755 << 16) >>> 0 },
      { nom: "css/Thumbs.db", donnees: "x" },
      { nom: "css/desktop.ini", donnees: "[.ShellClassInfo]" },
      { nom: "css/._site.css", donnees: "x" },
      { nom: "css/site.css", donnees: "a{}" },
    ]);
    const r = decompresserZip(z, sortie);
    expect(r.fichiers).toBe(2);
    expect(r.ignores).toEqual(["__MACOSX/", "__MACOSX/._index.html", ".DS_Store", "css/Thumbs.db", "css/desktop.ini", "css/._site.css"]);
    expect(readdirSync(sortie).sort()).toEqual(["css", "index.html"]);
    expect(readdirSync(join(sortie, "css"))).toEqual(["site.css"]);
  });
  it("un autre fichier sans extension permise reste refusé à côté des déchets", () =>
    refuse(zip([{ nom: ".DS_Store", donnees: "x" }, { nom: "a.exe", donnees: "x" }]), "extension"));
  it("les déchets suivent les autres règles : un lien dans __MACOSX/ est refusé, un déchet géant est refusé", () => {
    refuse(zip([{ nom: "__MACOSX/l", donnees: "x", externes: (0o120777 << 16) >>> 0 }]), "lien");
    refuse(zip([{ nom: "__MACOSX/._a", donnees: "x", tailleAnnoncee: 5000 }]), "bombe", /trop gros/, { ...LIMITES, parFichier: 1000 });
  });
  it("plafond du nombre de déchets ignorés", () => {
    const lim: Limites = { ...LIMITES, ignores: 2 };
    decompresserZip(zip([{ nom: "a.txt", donnees: "x" }, { nom: ".DS_Store", donnees: "x" }, { nom: "b/.DS_Store", donnees: "x" }]), sortie, lim);
    rmSync(sortie, { recursive: true });
    refuse(zip([{ nom: "a.txt", donnees: "x" }, { nom: ".DS_Store", donnees: "x" }, { nom: "b/.DS_Store", donnees: "x" }, { nom: "c/.DS_Store", donnees: "x" }]), "bombe", /à ignorer/, lim);
  });
  it("le lanceur liste les déchets ignorés dans son rapport", { timeout: 30_000 }, () => {
    const f = join(racine, "mac.zip");
    writeFileSync(f, zip([{ nom: "index.html", donnees: "<p>ok</p>" }, { nom: "__MACOSX/._index.html", donnees: "x" }]));
    const r = lanceur(["--zip", f, "--sortie", sortie], { CI: "true" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Fichiers système ignorés (1) : __MACOSX/._index.html");
    expect(existsSync(join(sortie, "__MACOSX"))).toBe(false);
  });
});

describe("vrais formats", () => {
  it("data descriptor (bit 3 : CRC et tailles locales à 0) ET nom UTF-8 NFD (bit 11) : accepté, octets identiques", () => {
    const nfd = "re\u0301sume\u0301.txt";
    expect(nfd).not.toBe(nfd.normalize("NFC"));
    const contenu = Buffer.from("contenu avec accents é è ".repeat(40));
    const z = zip([
      { nom: "index.html", donnees: "<p>ok</p>", descripteur: true },
      { nom: nfd, donnees: contenu, descripteur: true, drapeaux: 0x800 },
      { nom: "img/", externes: (0o040755 << 16) >>> 0 },
      { nom: "img/p.png", donnees: Buffer.from([137, 80, 78, 71, 0]), descripteur: true, methode: 0 },
    ]);
    expect(z.readUInt16LE(6) & 0x8).toBe(0x8); // l'écrivain a bien posé le bit 3 et un CRC local à 0
    expect(z.readUInt32LE(14)).toBe(0);
    decompresserZip(z, sortie);
    expect(readFileSync(join(sortie, "index.html"), "utf8")).toBe("<p>ok</p>");
    expect(readdirSync(sortie)).toContain(nfd); // nom conservé tel quel (NFD)
    expect(readFileSync(join(sortie, nfd))).toEqual(contenu);
    expect([...readFileSync(join(sortie, "img/p.png"))]).toEqual([137, 80, 78, 71, 0]);
  });
  it("data descriptor : un CRC faux dans le central reste refusé", () => refuse(zip([{ nom: "a.txt", donnees: "bonjour", descripteur: true, crc: 99 }]), "format", /CRC32/));
  // Octets FIGÉS d'un vrai flux Info-ZIP 3.0 (`zip -q -r - . | cat`, sortie non positionnable : data descriptors, bit 3), générés avec le
  // vrai `zip` : index.html (« <h1>é</h1> » x 100), sous/ (dossier explicite), sous/résumé.css en NFD (e + U+0301), contenu « a{} ».
  // Aucun binaire `zip` requis : le test est identique sur toutes les machines.
  const FLUX_INFOZIP = "UEsDBBQACAAIAO2GdV0AAAAAAAAAAEwEAAAKABwAaW5kZXguaHRtbFVUCQAD/cwBa/3MAWt1eAsAAQQAAAAABAAAAACzyTC0O7zSRh9I2YwyR5mjzFEmuUwAUEsHCJgkn9sWAAAATAQAAFBLAwQKAAAAAADthnVdAAAAAAAAAAAAAAAABQAcAHNvdXMvVVQJAAP9zAFr/cwBa3V4CwABBAAAAAAEAAAAAFBLAwQUAAgACADthnVdAAAAAAAAAAADAAAAEwAcAHNvdXMvcmXMgXN1bWXMgS5jc3NVVAkAA/3MAWv9zAFrdXgLAAEEAAAAAAQAAAAAS6yuBQBQSwcIudUrVAUAAAADAAAAUEsBAh4DFAAIAAgA7YZ1XZgkn9sWAAAATAQAAAoAGAAAAAAAAQAAAKSBAAAAAGluZGV4Lmh0bWxVVAUAA/3MAWt1eAsAAQQAAAAABAAAAABQSwECHgMKAAAAAADthnVdAAAAAAAAAAAAAAAABQAYAAAAAAAAABAA7UFqAAAAc291cy9VVAUAA/3MAWt1eAsAAQQAAAAABAAAAABQSwECHgMUAAgACADthnVdudUrVAUAAAADAAAAEwAYAAAAAAABAAAApIGpAAAAc291cy9yZcyBc3VtZcyBLmNzc1VUBQAD/cwBa3V4CwABBAAAAAAEAAAAAFBLBQYAAAAAAwADAPQAAAALAQAAAAA=";
  it("vrai flux Info-ZIP figé (bit 3, dossier explicite, nom NFD) : accepté, identique à la source", () => {
    const z = Buffer.from(FLUX_INFOZIP, "base64");
    expect(z.length).toBe(533);
    expect(z.readUInt32LE(0)).toBe(0x04034b50);
    expect(z.readUInt16LE(6) & 0x8).toBe(0x8); // data descriptor : tailles et CRC locaux à 0
    expect(z.readUInt32LE(14)).toBe(0);
    const r = decompresserZip(z, sortie);
    expect(r.fichiers).toBe(2);
    expect(readFileSync(join(sortie, "index.html"), "utf8")).toBe("<h1>é</h1>".repeat(100));
    expect(readFileSync(join(sortie, "sous", "r\u0065\u0301sume\u0301.css"), "utf8")).toBe("a{}");
  });
  it("la maquette du dépôt 05-stocks, zippée telle quelle (avec PROVENANCE.md) : acceptée et identique", () => {
    const base = join(process.cwd(), "outils/maquettes-tableaux-de-bord/05-stocks");
    const fichiers: string[] = [];
    const marche = (d: string): void => {
      for (const n of readdirSync(d)) {
        const c = join(d, n);
        if (lstatSync(c).isDirectory()) marche(c);
        else fichiers.push(relative(base, c));
      }
    };
    marche(base);
    expect(fichiers).toContain("PROVENANCE.md");
    expect(fichiers.length).toBeGreaterThanOrEqual(8);
    const z = zip(fichiers.map((f) => ({ nom: `05-stocks/${f.split("\\").join("/")}`, donnees: readFileSync(join(base, f)) })));
    const r = decompresserZip(z, sortie);
    expect(r.fichiers).toBe(fichiers.length);
    for (const f of fichiers) expect(readFileSync(join(sortie, "05-stocks", f)).equals(readFileSync(join(base, f))), f).toBe(true);
  });
});

describe("temporaires `.decompression-*` périmés (lancement précédent tué)", () => {
  it("nettoyage : dossiers ordinaires frères supprimés, liens / fichiers / autres noms intouchés, jamais de lien suivi", () => {
    const parent = join(racine, "sortie");
    const cible = join(racine, "cible-du-lien");
    mkdirSync(cible);
    writeFileSync(join(cible, "precieux.txt"), "VIVANT");
    mkdirSync(join(parent, ".decompression-1-a", "sous"), { recursive: true });
    writeFileSync(join(parent, ".decompression-1-a", "sous", "partiel.js"), "x".repeat(1000));
    symlinkSync(cible, join(parent, ".decompression-1-a", "lien-vers-cible")); // lien DANS un reste : jamais suivi
    symlinkSync(cible, join(parent, ".decompression-lien"));
    writeFileSync(join(parent, ".decompression-fichier"), "fichier ordinaire");
    mkdirSync(join(parent, "autre"));
    mkdirSync(join(parent, ".decompressionX"));
    expect(nettoyerRestesTemporaires(parent)).toBe(1);
    expect(readdirSync(parent).sort()).toEqual([".decompression-fichier", ".decompression-lien", ".decompressionX", "autre"]);
    expect(readFileSync(join(cible, "precieux.txt"), "utf8")).toBe("VIVANT");
  });
  it.skipIf(process.getuid?.() !== 0)("nettoyage : un dossier appartenant à un autre uid n'est pas supprimé", () => {
    const parent = join(racine, "sortie");
    mkdirSync(join(parent, ".decompression-2-b"));
    chownSync(join(parent, ".decompression-2-b"), 12345, 12345);
    expect(nettoyerRestesTemporaires(parent)).toBe(0);
    expect(existsSync(join(parent, ".decompression-2-b"))).toBe(true);
  });
  it("decompresserZip nettoie au démarrage et le dit (restesSupprimes), même si l'archive est ensuite refusée", () => {
    mkdirSync(join(racine, "sortie", ".decompression-9-z"));
    writeFileSync(join(racine, "sortie", ".decompression-9-z", "x.js"), "x");
    expect(() => decompresserZip(zip([{ nom: "../x.txt", donnees: "x" }]), sortie)).toThrow(ErreurZip);
    expect(readdirSync(join(racine, "sortie"))).toEqual([]);
    mkdirSync(join(racine, "sortie", ".decompression-9-y"));
    expect(decompresserZip(zip([{ nom: "a.txt", donnees: "x" }]), sortie).restesSupprimes).toBe(1);
  });
  it("ESSAI RÉEL : lanceur tué (SIGKILL) en cours d'écriture laisse un partiel ; le lancement suivant le nettoie, sortie correcte", { timeout: 90_000 }, async () => {
    const gros = join(racine, "gros.zip");
    // 150 fichiers de 1 Mio (zéros : sous le seuil de ratio), ~150 Mio à écrire.
    writeFileSync(gros, zip(Array.from({ length: 150 }, (_, i) => ({ nom: `f${i}.txt`, donnees: Buffer.alloc(1024 * 1024) }))));
    const parent = join(racine, "sortie");
    const enfant = spawn(process.execPath, ["--import", "tsx", LANCEUR_CHEMIN, "--zip", gros, "--sortie", sortie], {
      env: { PATH: process.env.PATH ?? "", CI: "true" } as unknown as NodeJS.ProcessEnv,
      cwd: process.cwd(),
      stdio: "ignore",
    });
    const fini = new Promise<{ code: number | null; signal: string | null }>((ok) => enfant.on("exit", (code, signal) => ok({ code, signal })));
    const t0 = Date.now();
    let vu = false;
    while (!vu && Date.now() - t0 < 60_000) {
      try {
        const d = readdirSync(parent).find((n) => n.startsWith(".decompression-"));
        if (d && readdirSync(join(parent, d)).length > 0) {
          vu = true;
          enfant.kill("SIGKILL");
          break;
        }
      } catch {
        /* course de lecture : on recommence */
      }
      await new Promise((ok) => setTimeout(ok, 1));
    }
    const fin = await fini;
    expect(vu).toBe(true);
    expect(fin.signal).toBe("SIGKILL");
    expect(readdirSync(parent).filter((n) => n.startsWith(".decompression-")).length).toBe(1); // le partiel est bien resté
    expect(existsSync(sortie)).toBe(false);

    const bon = join(racine, "bon.zip");
    writeFileSync(bon, zip([{ nom: "index.html", donnees: "<p>ok</p>" }]));
    const r = lanceur(["--zip", bon, "--sortie", sortie], { CI: "true" }, 30_000);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Temporaires périmés supprimés : 1");
    expect(readdirSync(parent)).toEqual(["maquette"]);
    expect(readdirSync(sortie)).toEqual(["index.html"]);
    expect(readFileSync(join(sortie, "index.html"), "utf8")).toBe("<p>ok</p>");
  });
});

describe("garde du conteneur (CAPTURE_CONTENEUR) dans le lanceur", () => {
  const texte = readFileSync(join(process.cwd(), LANCEUR_CHEMIN), "utf8");
  it("lecture du texte : indice local (chemins exacts) passé en 3e argument, type élargi, mot d'ordre de remplacement", () => {
    expect(texte).toContain('const INDICE_DOCKER = "/.dockerenv";');
    expect(texte).toContain('const INDICE_PODMAN = "/run/.containerenv";');
    expect(texte).toMatch(/\[INDICE_DOCKER, INDICE_PODMAN\]\.some\(\(c\) => existsSync\(c\)\)/);
    expect(texte).toMatch(/environnementAutorise as \(env: Record<string, string \| undefined>, plateforme: string, conteneurDetecte\?: boolean\) => Verdict/);
    expect(texte).toMatch(/garde\(process\.env, process\.platform, conteneurDetecte\(\)\)/);
    expect(texte).toContain("à remplacer par `indicesConteneur` de garde.ts après fusion de #1609");
  });
  it.skipIf(EN_CONTENEUR)("CAPTURE_CONTENEUR=true sans CI et sans fichier témoin : code 3 (la variable seule ne suffit pas)", { timeout: 30_000 }, () => {
    const bon = join(racine, "b.zip");
    writeFileSync(bon, zip([{ nom: "index.html", donnees: "<p>ok</p>" }]));
    const r = lanceur(["--zip", bon, "--sortie", sortie], { CAPTURE_CONTENEUR: "true" });
    expect(r.status).toBe(3);
    expect(existsSync(sortie)).toBe(false);
  });
});

// Mesure directe : appelle l'extraction avec un budget et vérifie qu'elle lève au lieu de produire plus que le plafond.
function extraireOctetsLimite(z: Buffer, e: ReturnType<typeof lireArchive>[number], lim: Limites): Buffer {
  return extraireOctets(z, e, lim.totalDecompresse, lim);
}
