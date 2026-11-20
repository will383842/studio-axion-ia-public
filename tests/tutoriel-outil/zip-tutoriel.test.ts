/**
 * T-EXT-41 : extraction en mémoire du dossier zip. Éteinte par défaut ; tout ou rien ; aucune écriture disque ; 0 €.
 * `lireParametre` est remplacé, la décompression passe par un port espionné.
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crc32 } from "@/lib/zip";

const reglage: { valeur: unknown; leve: boolean } = { valeur: undefined, leve: false };
const journal: string[] = [];
vi.mock("@/services/_commun", () => ({
  lireParametre: async (_id: string, defaut: unknown) => {
    if (reglage.leve) throw new Error("base indisponible");
    return reglage.valeur === undefined ? defaut : reglage.valeur;
  },
  journaliser: async (_type: string, message: string) => void journal.push(message),
}));
const ecritures: string[] = [];
vi.mock("node:fs", async (importOriginal) => {
  const reel = await importOriginal<typeof import("node:fs")>();
  const espion = (nom: string) =>
    (...a: unknown[]) => {
      ecritures.push(nom);
      return (reel as unknown as Record<string, (...x: unknown[]) => unknown>)[nom]!(...a);
    };
  return { ...reel, default: reel, writeFileSync: espion("writeFileSync"), appendFileSync: espion("appendFileSync"), mkdirSync: espion("mkdirSync"), createWriteStream: espion("createWriteStream"), writeSync: espion("writeSync"), openSync: espion("openSync") };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const reel = await importOriginal<typeof import("node:fs/promises")>();
  const espion = (nom: string) =>
    (...a: unknown[]) => {
      ecritures.push(nom);
      return (reel as unknown as Record<string, (...x: unknown[]) => unknown>)[nom]!(...a);
    };
  return { ...reel, default: reel, writeFile: espion("writeFile"), appendFile: espion("appendFile"), mkdir: espion("mkdir"), open: espion("open") };
});

import { extraireZipSur, MESSAGE_ZIP_FERME, PARAM_ENTREE_ZIP, type PortsZip } from "@/services/zip-tutoriel";

const u8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const texte = (o: Uint8Array | undefined): string => (o ? new TextDecoder().decode(o) : "<absent>");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

interface Piege {
  nom: string;
  donnees?: Uint8Array;
  methode?: number;
  nomLocal?: string;
  tc?: number;
  td?: number;
  crc?: number;
  donneesStockees?: Uint8Array;
}
function construire(entrees: Piege[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let decalage = 0;
  for (const e of entrees) {
    const donnees = e.donnees ?? new Uint8Array();
    const methode = e.methode ?? 0;
    const comp = e.donneesStockees ?? (methode === 8 ? deflateRawSync(donnees) : donnees);
    const nom = u8(e.nom);
    const nomLocal = u8(e.nomLocal ?? e.nom);
    const tc = e.tc ?? comp.length;
    const td = e.td ?? donnees.length;
    const crc = e.crc ?? crc32(donnees);
    const local = new Uint8Array(30 + nomLocal.length + comp.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(6, 0x0800, true);
    vl.setUint16(8, methode, true);
    vl.setUint32(14, crc, true);
    vl.setUint32(18, tc, true);
    vl.setUint32(22, td, true);
    vl.setUint16(26, nomLocal.length, true);
    local.set(nomLocal, 30);
    local.set(comp, 30 + nomLocal.length);
    const c = new Uint8Array(46 + nom.length);
    const vc = new DataView(c.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint16(8, 0x0800, true);
    vc.setUint16(10, methode, true);
    vc.setUint32(16, crc, true);
    vc.setUint32(20, tc, true);
    vc.setUint32(24, td, true);
    vc.setUint16(28, nom.length, true);
    vc.setUint32(42, decalage, true);
    c.set(nom, 46);
    parts.push(local);
    centraux.push(c);
    decalage += local.length;
  }
  const taille = centraux.reduce((s, x) => s + x.length, 0);
  const fin = new Uint8Array(22);
  const vf = new DataView(fin.buffer);
  vf.setUint32(0, 0x06054b50, true);
  vf.setUint16(8, entrees.length, true);
  vf.setUint16(10, entrees.length, true);
  vf.setUint32(12, taille, true);
  vf.setUint32(16, decalage, true);
  const tout = [...parts, ...centraux, fin];
  const sortie = new Uint8Array(tout.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of tout) {
    sortie.set(x, p);
    p += x.length;
  }
  return sortie;
}

const SAINE: Piege[] = [
  { nom: "index.html", donnees: u8('<link rel="stylesheet" href="styles.css"><script src="app.js"></script><h1>Bonjour</h1>'), methode: 8 },
  { nom: "app.js", donnees: u8("window.demoMaquette={aller(){},reinitialiser(){}};") },
  { nom: "styles.css", donnees: u8("body{color:#111}") },
  { nom: "script.txt", donnees: u8("Bienvenue chez Entreprise exemple.") },
  { nom: "img/ecran.png", donnees: PNG },
  { nom: "__MACOSX/._index.html", donnees: u8("x") },
];

const inflateEspion = vi.fn((d: Uint8Array, max: number) => new Uint8Array(inflateRawSync(d, { maxOutputLength: max })));
function ports(over: Partial<PortsZip> = {}): PortsZip {
  return {
    lireParametre: async (_id, defaut) => (reglage.leve ? Promise.reject(new Error("x")) : reglage.valeur === undefined ? defaut : reglage.valeur),
    inflate: inflateEspion,
    journaliser: async (_t, m) => void journal.push(m),
    ...over,
  };
}
const ALLUME = (): void => {
  reglage.valeur = true;
};
const entree = (o: Piege[], attestation = true) => extraireZipSur(construire(o), { attestationImages: attestation }, ports());

beforeEach(() => {
  reglage.valeur = undefined;
  reglage.leve = false;
  journal.length = 0;
  ecritures.length = 0;
  inflateEspion.mockClear();
});

describe("éteint par défaut (R-9)", () => {
  it("le nom du réglage est celui de la fiche", () => expect(PARAM_ENTREE_ZIP).toBe("tutoriel.entreeZip"));
  for (const [titre, valeur] of [["absent", undefined], ['"true"', "true"], ["1", 1], ["null", null], ["false", false]] as const) {
    it(`${titre} : refus clair, rien décompressé`, async () => {
      reglage.valeur = valeur;
      const r = await entree(SAINE);
      expect(r.ok).toBe(false);
      expect(r.rapport.refus).toEqual([MESSAGE_ZIP_FERME]);
      expect(inflateEspion).not.toHaveBeenCalled();
    });
  }
  it("une lecture qui lève : refus clair, ne lève pas", async () => {
    reglage.leve = true;
    const r = await entree(SAINE);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus).toEqual([MESSAGE_ZIP_FERME]);
    expect(inflateEspion).not.toHaveBeenCalled();
  });
  it("avec les ports réels (lireParametre remplacé) : éteint aussi", async () => {
    reglage.valeur = "true";
    const r = await extraireZipSur(construire(SAINE), { attestationImages: true });
    expect(r.ok).toBe(false);
  });
  it("seul true exact allume (ports réels)", async () => {
    ALLUME();
    const r = await extraireZipSur(construire(SAINE), { attestationImages: true });
    expect(r.ok).toBe(true);
  });
  it("de bout en bout (allumé) : nom + courriel, adresse sur plusieurs lignes, tabulations → aucune trace en clair", async () => {
    ALLUME();
    const r = await entree([
      { nom: "demo-data.csv", donnees: u8("nom,ville\nJean Dupont jean@orange.fr,Paris\n") },
      { nom: "adresses.csv", donnees: u8('id,adresse,nom\n1,"12 rue des Lilas\n75011 Paris",Martin\n') },
      { nom: "tab.csv", donnees: u8("nom\temail\nJean Dupont\tjean@orange.fr\n") },
      { nom: "d.json", donnees: u8('{"adresse":"Jean Dupont, jean.dupont@orange.fr, 12 rue des Lilas"}') },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const nom of ["demo-data.csv", "adresses.csv", "tab.csv", "d.json"]) {
      const sortie = new TextDecoder().decode(r.fichiers.get(nom));
      expect(sortie).not.toMatch(/Jean|Dupont|Lilas|75011|Martin|orange/);
    }
  });
  it("de bout en bout (allumé) : en-tête NFD, espace insécable avant guillemet, fins de ligne \\r seules → aucune trace en clair", async () => {
    ALLUME();
    const r = await entree([
      { nom: "nfd.csv", donnees: u8("Pre\u0301nom,ville\nJean,Paris\n") },
      { nom: "nbsp.csv", donnees: u8('id,nom,ville\n1,\u00a0"Dupont, Jean",Paris\n') },
      { nom: "mac.csv", donnees: u8("id,nom\r1,Jean Dupont\r2,Paul Martin") },
      { nom: "nfd.json", donnees: u8('{"pre\u0301nom":"Jean"}') },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const nom of ["nfd.csv", "nbsp.csv", "mac.csv", "nfd.json"]) {
      expect(new TextDecoder().decode(r.fichiers.get(nom))).not.toMatch(/Jean|Dupont|Paul|Martin/);
    }
  });
  it("de bout en bout (allumé) : ligne `sep=;`, ligne de titre, invisible dans l'en-tête, fin de ligne U+2028 → aucune trace en clair", async () => {
    ALLUME();
    const r = await entree([
      { nom: "sep.csv", donnees: u8("sep=;\nnom;ville\nJean Dupont;Paris\n") },
      { nom: "titre.csv", donnees: u8("Export clients\nid,nom\n1,Jean Dupont\n") },
      { nom: "zw.csv", donnees: u8("id,no\u200bm\n1,Jean Dupont\n") },
      { nom: "ls.csv", donnees: u8("nom,ville\u2028Jean Dupont,Paris") },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const nom of ["sep.csv", "titre.csv", "zw.csv", "ls.csv"]) {
      expect(new TextDecoder().decode(r.fichiers.get(nom))).not.toMatch(/Jean|Dupont/);
    }
  });
  it("de bout en bout (allumé) : guillemet jamais refermé dans une colonne qui n'est pas de personne → archive entière refusée, valeur absente du rapport", async () => {
    ALLUME();
    for (const csv of ['ville,nom\n"Paris,Jean Dupont\nLyon,Paul Martin\n', 'id,ville,nom\n1,"Paris,Jean Dupont\n2,Lyon,Paul Martin\n']) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(csv) }]);
      expect(r.ok).toBe(false);
      expect(r.rapport.refus.join(" ")).toContain("guillemet jamais refermé");
      expect(JSON.stringify(r.rapport)).not.toMatch(/Jean|Dupont|Paul|Martin/);
      expect(journal.join(" ")).not.toMatch(/Jean|Dupont|Paul|Martin/);
    }
  });
  it.each([
    ["1", 'id,ville,nom\n1,"Paris,Jean Dupont\n2,Lyon,"Paul Martin"\n3,Nice,Pierre Durand'],
    ["2", 'id,ville,nom\n1,"Paris,Jean Dupont\n2,Lyon,Paul Martin\n3,"Nice",Pierre Durand'],
    ["3", 'id;ville;nom\n1;"Paris;Jean Dupont\n2;Lyon;"Paul Martin"'],
    ["4", 'ville,nom\n"Paris,Jean Dupont\n"Lyon",Paul Martin'],
    ["5", 'id,ville,nom\n1,"Paris,Jean Dupont\n2,"Lyon",x'],
    ["6", 'id,ville,nom\n1,"Paris,Jean Dupont\n2,Lyon,"\n'],
  ])("de bout en bout (allumé) : guillemet égaré refermé par un autre guillemet, entrée %s (\\n, \\r\\n, \\r, tabulation) → archive entière refusée (verdict 92172ecb)", async (_i, csv) => {
    ALLUME();
    for (const variante of [csv, csv.replace(/\n/g, "\r\n"), csv.replace(/\n/g, "\r"), csv.replace(/[,;]/g, "\t")]) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(variante) }]);
      expect(r.ok).toBe(false);
      expect(r.rapport.refus.join(" ")).toContain("guillemet jamais refermé");
      expect(JSON.stringify(r.rapport)).not.toMatch(/Jean|Dupont|Paul|Martin/);
      expect(journal.join(" ")).not.toMatch(/Jean|Dupont|Paul|Martin/);
    }
  });
  it.each([
    ["1", '"Titre,\nJean Dupont\n",z\nnom,ville\nPaul Martin,Paris\n'],
    ["2", '"Export clients,\nid,nom\n1,Jean Dupont\n2,"x",Paul Martin\n'],
    ["3", 'id,"ville,nom\n1,Paris,Jean Dupont\n2,"Lyon",Paul Martin\n'],
    ["4", '\uFEFF"Export clients,\nid,nom\n1,Jean Dupont\n2,"x",Paul Martin\n'],
  ])("de bout en bout (allumé) : cellule ambiguë avant ou dans l'en-tête, entrée %s (\\n, \\r\\n, \\r, point-virgule, tabulation) → archive entière refusée (verdict c5f5e643)", async (_i, csv) => {
    ALLUME();
    for (const variante of [csv, csv.replace(/\n/g, "\r\n"), csv.replace(/\n/g, "\r"), csv.replace(/,/g, ";"), csv.replace(/,/g, "\t")]) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(variante) }]);
      expect(r.ok).toBe(false);
      expect(r.rapport.refus.join(" ")).toContain("guillemet jamais refermé");
      expect(JSON.stringify(r.rapport)).not.toMatch(/Jean|Dupont|Paul|Martin/);
      expect(journal.join(" ")).not.toMatch(/Jean|Dupont|Paul|Martin/);
    }
  });
  const SEPS_E2E = [",", ";", "\t", "|"] as const;
  const FINS_E2E = ["\n", "\r\n", "\r"] as const;
  const variantes = (modele: string): string[] => SEPS_E2E.flatMap((S) => FINS_E2E.map((E) => (S === "|" ? `sep=|${E}` : "") + modele.replace(/,/g, S).replace(/\n/g, E)));
  it.each([
    ["1", 'id,ville,nom\n1,Paris,"Jean Dupont\n2,"Lyon",Paul Martin\n'],
    ["2", 'id,nom,ville,code\n1,"Jean Dupont,Paris,A\n2,"x",Paul Martin,Lyon,B\n'],
    ["3", 'id,ville,nom\n1,Paris, France,Jean Dupont\n'],
    ["4", 'id,societe,nom\n1,Durand, Fils et Cie,Jean Dupont\n2,Exemple,Paul Martin\n'],
    ["5", 'id,nom,ville\n1,Jean Dupont\n2,Paul Martin,Lyon\n'],
    ["6", 'id,ville,nom\n1,"Paris,\nCentre",Jean Dupont\n'],
    ["7", 'id,nom\n1,"Jean,\nDupont"\n2,"Paul" Martin\n'],
  ])("de bout en bout (allumé) : cellules hors de leur colonne, entrée %s (4 séparateurs, \\n, \\r\\n, \\r) → archive entière refusée (verdict cdbfbcda)", async (_i, csv) => {
    ALLUME();
    for (const variante of variantes(csv)) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(variante) }]);
      expect(r.ok, JSON.stringify(variante)).toBe(false);
      expect(r.rapport.refus.join(" ")).toContain("guillemet jamais refermé");
      expect(JSON.stringify(r.rapport)).not.toMatch(/Jean|Dupont|Paul|Martin/);
      expect(journal.join(" ")).not.toMatch(/Jean|Dupont|Paul|Martin/);
    }
  });
  it("de bout en bout (allumé) : témoins CSV légitimes (RFC 4180, multiligne quotée, BOM, ligne vide finale) → acceptés, noms masqués (verdict cdbfbcda)", async () => {
    ALLUME();
    for (const csv of ['"id","nom"\r\n"1","Jean Dupont"\r\n', 'id,ville,nom\n1,"Paris\nCentre",Jean Dupont\n', '﻿id,nom\n1,Jean Dupont\n', 'id,nom,ville\n1,Jean Dupont,Paris\n\n']) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(csv) }]);
      expect(r.ok, JSON.stringify(csv)).toBe(true);
      if (!r.ok) continue;
      expect(texte(r.fichiers.get("demo-data.csv"))).not.toMatch(/Jean|Dupont/);
    }
  });
  it.each([
    ["1", '{"nom":{"actif":true,"complet":"Jean Dupont"}}'],
    ["2", '{"adresse":{"principale":true,"rue":"12 rue des Lilas","ville":"Paris"}}'],
    ["3", '[{"nom":{"verifie":false,"valeur":"Jean Dupont"}}]'],
    ["4", '{"clients":[{"id":1,"adresse":{"facturation":null,"ligne1":"12 rue des Lilas"}}]}'],
    ["5", '{"nom":{"a":"Jean Dupont","b":true,"c":"Paul Martin"}}'],
  ])("de bout en bout (allumé) : JSON, valeur nue avant la donnée, entrée %s → noms masqués, JSON valide (verdict cdbfbcda)", async (_i, json) => {
    ALLUME();
    const r = await entree([...SAINE, { nom: "demo-data.json", donnees: u8(json) }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sortie = texte(r.fichiers.get("demo-data.json"));
    expect(sortie).not.toMatch(/Jean|Dupont|Paul|Martin|Lilas/);
    expect(() => JSON.parse(sortie)).not.toThrow();
    expect(JSON.stringify(r.rapport)).not.toMatch(/Jean|Dupont|Paul|Martin|Lilas/);
  });
  it("de bout en bout (allumé) : témoin légitime (cellule sur plusieurs lignes bien formée) → accepté, nom masqué (verdict 92172ecb)", async () => {
    ALLUME();
    const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8('id,ville,nom\n1,"Paris\nCentre",Jean Dupont\n') }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(texte(r.fichiers.get("demo-data.csv"))).not.toMatch(/Jean|Dupont/);
  });
  it("de bout en bout (allumé) : déclaration XML d'un .html en ISO-2022-JP / UTF-16 → archive entière refusée ; utf-8 accepté (verdict 92172ecb)", async () => {
    ALLUME();
    for (const decl of ['<?xml version="1.0" encoding="iso-2022-jp"?>', "<?xml version='1.0' ENCODING = 'utf-16'?>"]) {
      const r = await entree([...SAINE, { nom: "x.html", donnees: u8(decl + "<p>x</p>") }]);
      expect(r.ok).toBe(false);
    }
    const bon = await entree([...SAINE, { nom: "x.html", donnees: u8('<?xml version="1.0" encoding="utf-8"?><p>x</p>') }]);
    expect(bon.ok).toBe(true);
  });
  it("de bout en bout (allumé) : clés JSON, HTML échappé en 2 Mo, et nom toujours masqué (verdict b3cbe685 a)", async () => {
    ALLUME();
    const t0 = performance.now();
    const r = await entree([...SAINE, { nom: "gros.json", donnees: u8('{"html":"' + '<a class=\\"x\\">'.repeat(130_000) + '"}') }, { nom: "p.json", donnees: u8('{"nom":"Jean Dupont"}') }]);
    expect(performance.now() - t0).toBeLessThan(3000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(texte(r.fichiers.get("p.json"))).not.toMatch(/Jean|Dupont/);
  });
  it("de bout en bout (allumé) : caractère ESC et encodage ISO-2022-JP déclaré → archive entière refusée (verdict b3cbe685 b)", async () => {
    ALLUME();
    const ESC = "\u001b";
    const pieges: [string, string][] = [
      ["index.html", `<meta charset="iso-2022-jp"><ifr${ESC}(Bame src="x.html"></iframe><img src="ht${ESC}(Btps://exemple.invalid/a.png"><script>fe${ESC}(Btch("ht${ESC}(Btps://exemple.invalid/x")</script>`],
      ["s.css", `@charset "iso-2022-jp"; p{background:url(ht${ESC}(Btps://exemple.invalid/a.png)}`],
      ["a.js", `fe${ESC}(Btch("x")`],
      ["b.html", '<meta charset="iso-2022-jp"><p>x</p>'],
      ["c.html", '<meta http-equiv="content-type" content="text/html; charset=iso-2022-jp"><p>x</p>'],
      ["d.html", '<script charset="shift_jis" src="a.js"></script>'],
      ["e.css", '@charset "windows-1252"; p{}'],
    ];
    for (const [nom, contenu] of pieges) {
      const r = await entree([...SAINE.filter((x) => x.nom !== nom), { nom, donnees: u8(contenu) }]);
      expect(r.ok, nom).toBe(false);
      expect(r.rapport.refus.join(" "), nom).toMatch(/maquette|contrôle|encodage/i);
    }
    const sain = await entree([...SAINE.filter((x) => x.nom !== "index.html"), { nom: "index.html", donnees: u8('<!doctype html><meta charset="utf-8"><p>é</p>') }]);
    expect(sain.ok).toBe(true);
  });
  it("de bout en bout (allumé) : BOM UTF-16/UTF-32, octets non UTF-8, caractère nul → archive entière refusée", async () => {
    ALLUME();
    const u16le = (s: string) => new Uint8Array([0xff, 0xfe, ...[...s].flatMap((c) => [c.charCodeAt(0), 0])]);
    const u16be = (s: string) => new Uint8Array([0xfe, 0xff, ...[...s].flatMap((c) => [0, c.charCodeAt(0)])]);
    const u32le = (s: string) => new Uint8Array([0xff, 0xfe, 0, 0, ...[...s].flatMap((c) => [c.charCodeAt(0), 0, 0, 0])]);
    const u32be = (s: string) => new Uint8Array([0, 0, 0xfe, 0xff, ...[...s].flatMap((c) => [0, 0, 0, c.charCodeAt(0)])]);
    const pieges: [string, Uint8Array][] = [
      ["utf16le.html", u16le("<p>x</p>")],
      ["utf16be.html", u16be("<p>x</p>")],
      ["utf32le.html", u32le("<p>x</p>")],
      ["utf32be.html", u32be("<p>x</p>")],
      ["utf16.css", u16le("p{}")],
      ["utf16.js", u16le("var a;")],
      ["latin1.html", new Uint8Array([0x3c, 0x70, 0x3e, 0xe9, 0x3c, 0x2f, 0x70, 0x3e])],
      ["isojp.html", new Uint8Array([0x3c, 0x70, 0x3e, 0x1b, 0x24, 0x42, 0x24, 0x22, 0x1b, 0x28, 0x42, 0x3c, 0x2f, 0x70, 0x3e, 0xff])],
      ["surrogate.js", new Uint8Array([0xed, 0xa0, 0x80])],
      ["long.css", new Uint8Array([0xc0, 0xaf])],
      ["nul-sans-bom.html", u8("<html></html>".split("").join("\u0000"))],
      ["nul.js", u8("var a;\u0000fetch(1)")],
    ];
    for (const [nom, contenu] of pieges) {
      const r = await entree([...SAINE.filter((x) => x.nom !== nom), { nom, donnees: contenu }]);
      expect(r.ok, nom).toBe(false);
    }
    const bomUtf8 = await entree([...SAINE.filter((x) => x.nom !== "index.html"), { nom: "index.html", donnees: new Uint8Array([0xef, 0xbb, 0xbf, ...u8("<!doctype html><p>é</p>")]) }]);
    expect(bomUtf8.ok).toBe(true);
  });
  it("même une archive piégée n'est pas lue quand c'est éteint", async () => {
    const r = await entree([{ nom: "../x.js", donnees: u8("x") }]);
    expect(r.rapport.refus).toEqual([MESSAGE_ZIP_FERME]);
  });
});

describe("allumé, archive saine", () => {
  it("rend la Map des fichiers, octets identiques, ignorés comptés", async () => {
    ALLUME();
    const r = await entree(SAINE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([...r.fichiers.keys()].sort()).toEqual(["app.js", "img/ecran.png", "index.html", "script.txt", "styles.css"]);
    for (const e of SAINE.filter((x) => !x.nom.startsWith("__MACOSX"))) expect(r.fichiers.get(e.nom)).toEqual(e.donnees);
    expect(r.rapport).toEqual({ refus: [], ignores: ["__MACOSX/._index.html"], masques: [], imagesEcartees: [] });
    expect(inflateEspion).toHaveBeenCalledTimes(1); // seul index.html est en deflate
    expect(journal.join(" ")).toContain("5 fichier(s)");
  });
  it("sans attestation : images écartées et listées, le reste continue", async () => {
    ALLUME();
    const r = await entree(SAINE, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fichiers.has("img/ecran.png")).toBe(false);
    expect(r.rapport.imagesEcartees).toEqual(["img/ecran.png"]);
    expect(r.fichiers.has("index.html")).toBe(true);
  });
  it("une image qui n'en est pas une est refusée (contenu ≠ type)", async () => {
    ALLUME();
    const r = await entree([{ nom: "a.png", donnees: u8("<html>pas une image</html>") }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("ne correspond pas à son type");
  });
});

describe("masquage des données, jamais du script", () => {
  it("une donnée dans une maquette ou un csv est masquée et listée sans la valeur", async () => {
    ALLUME();
    const r = await entree([
      { nom: "index.html", donnees: u8("<p>Écrire à jean@exemple.invalid</p>") },
      { nom: "clients.csv", donnees: u8("nom,ville\nMartin,Lyon\n") },
      { nom: "demo-data.js", donnees: u8("window.t = 1;") },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(texte(r.fichiers.get("index.html"))).toBe("<p>Écrire à contact@exemple.fr</p>");
    expect(texte(r.fichiers.get("clients.csv"))).toBe("nom,ville\nPersonne exemple 1,Lyon\n");
    expect(r.fichiers.get("demo-data.js")).toEqual(u8("window.t = 1;"));
    expect(r.rapport.masques).toEqual([
      { chemin: "index.html", type: "courriel", nombre: 1 },
      { chemin: "clients.csv", type: "colonne-personne", nombre: 1 },
    ]);
    expect(JSON.stringify(r.rapport)).not.toContain("exemple.invalid");
    expect(JSON.stringify(r.rapport)).not.toContain("Martin");
    expect(journal.join(" ")).not.toMatch(/exemple\.invalid|Martin/);
  });
  it("un téléphone dans le script : refus, jamais masqué, jamais recopié", async () => {
    ALLUME();
    const r = await entree([{ nom: "index.html", donnees: u8("<p>x</p>") }, { nom: "script.txt", donnees: u8("Bonjour.\nAppelez le 06 12 34 56 78.") }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("Votre script contient une donnée personnelle (telephone, ligne 2)");
    expect(JSON.stringify(r.rapport)).not.toContain("06 12");
    expect(r.rapport.masques).toEqual([]);
    expect(journal.join(" ")).not.toContain("06 12");
  });
  it("JSON imbriqué 20 000 niveaux avec un courriel : refus ou masqué, jamais le courriel d'origine", async () => {
    ALLUME();
    const profond = "[".repeat(20_000) + '{"courriel":"jean@vrai-client.fr","nom":"Martin"}' + "]".repeat(20_000);
    const r = await entree([{ nom: "index.html", donnees: u8("<p>x</p>") }, { nom: "demo-data.json", donnees: u8(profond) }]);
    if (r.ok) {
      expect(texte(r.fichiers.get("demo-data.json"))).not.toContain("jean@vrai-client.fr");
      expect(texte(r.fichiers.get("demo-data.json"))).not.toContain("Martin");
    } else expect(JSON.stringify(r.rapport)).not.toContain("vrai-client");
  });
  it("une détection qui échoue : le fichier est refusé, jamais gardé tel quel", async () => {
    ALLUME();
    const piege = new Proxy(new Set<string>(), { get: () => { throw new Error("boum"); } }) as unknown as ReadonlySet<string>;
    const r = await extraireZipSur(
      construire([{ nom: "index.html", donnees: u8("<p>x</p>") }, { nom: "demo-data.json", donnees: u8('{"nom":"Martin"}') }]),
      { attestationImages: true, nomsNeutres: piege },
      ports(),
    );
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("la recherche de données de personnes a échoué");
  });
  it("la maquette externe est refusée après masquage (fetch)", async () => {
    ALLUME();
    const r = await entree([{ nom: "index.html", donnees: u8("<p>x</p>") }, { nom: "app.js", donnees: u8('fetch("https://exemple.invalid")') }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("« app.js » ligne 1");
  });
});

describe("archives piégées : tout ou rien", () => {
  it("chemin qui sort du dossier : refus, rien décompressé", async () => {
    ALLUME();
    const r = await entree([...SAINE, { nom: "../evil.js", donnees: u8("x") }]);
    expect(r.ok).toBe(false);
    expect("fichiers" in r).toBe(false);
    expect(inflateEspion).not.toHaveBeenCalled();
  });
  it("bombe : refusée avant toute décompression", async () => {
    ALLUME();
    const r = await entree([{ nom: "index.html", donnees: new Uint8Array(1024 * 1024), methode: 8 }]);
    expect(r.ok).toBe(false);
    expect(inflateEspion).not.toHaveBeenCalled();
  });
  it("en-tête local au nom différent du répertoire central : refus « incohérente »", async () => {
    ALLUME();
    const r = await entree([{ nom: "index.html", nomLocal: "autre.html", donnees: u8("<p>x</p>") }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("archive incohérente");
  });
  it("taille annoncée fausse (le flux dépasse) : refus par maxOutputLength, rien au-delà", async () => {
    ALLUME();
    const vrai = u8("a".repeat(1000));
    const sorties: number[] = [];
    const espion = (d: Uint8Array, max: number): Uint8Array => {
      try {
        const o = new Uint8Array(inflateRawSync(d, { maxOutputLength: max }));
        sorties.push(o.length);
        return o;
      } catch (e) {
        sorties.push(-1);
        throw e;
      }
    };
    // annonce 100 octets alors que le flux en donne 1000 : ratio 1000/…, on garde un ratio permis en annonçant td=100
    const comp = deflateRawSync(vrai);
    const z = construire([{ nom: "a.txt", donnees: vrai, methode: 8, td: 100, tc: comp.length, donneesStockees: comp }]);
    const r = await extraireZipSur(z, { attestationImages: true }, ports({ inflate: espion }));
    expect(r.ok).toBe(false);
    expect(sorties).toEqual([-1]);
    expect(r.rapport.refus.join(" ")).toContain("dépasse sa taille annoncée");
  });
  it("taille annoncée trop grande (le flux est plus court) : refus", async () => {
    ALLUME();
    const vrai = u8("a".repeat(100));
    const comp = deflateRawSync(vrai);
    const r = await entree([{ nom: "a.txt", donnees: vrai, methode: 8, td: 200, tc: comp.length, donneesStockees: comp }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("taille réelle");
  });
  it("CRC faux : refus", async () => {
    ALLUME();
    const r = await entree([{ nom: "a.txt", donnees: u8("bonjour"), crc: 123 }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toContain("somme de contrôle");
  });
  it("CRC faux en deflate : refus", async () => {
    ALLUME();
    const r = await entree([{ nom: "a.txt", donnees: u8("bonjour ".repeat(10)), methode: 8, crc: 5 }]);
    expect(r.ok).toBe(false);
  });
  it("archive illisible : refus clair, ne lève pas", async () => {
    ALLUME();
    const r = await extraireZipSur(new Uint8Array([1, 2, 3]), { attestationImages: true }, ports());
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.length).toBeGreaterThan(0);
  });
  it("une entrée qui n'est pas un Uint8Array : refus, ne lève pas", async () => {
    ALLUME();
    const r = await extraireZipSur(null as unknown as Uint8Array, { attestationImages: true }, ports());
    expect(r.ok).toBe(false);
  });
  it("un port de décompression qui lève : refus, ne lève pas", async () => {
    ALLUME();
    const r = await extraireZipSur(construire(SAINE), { attestationImages: true }, ports({ inflate: () => { throw new Error("boum"); } }));
    expect(r.ok).toBe(false);
  });
  it("un journal qui lève ne bloque pas", async () => {
    ALLUME();
    const r = await extraireZipSur(construire(SAINE), { attestationImages: true }, ports({ journaliser: async () => { throw new Error("x"); } }));
    expect(r.ok).toBe(true);
  });
});

describe("aucune écriture disque", () => {
  it("ni sur la voie saine ni sur la voie refusée : 0 appel d'écriture node:fs", async () => {
    ALLUME();
    await entree(SAINE);
    await entree([...SAINE, { nom: "../x.js", donnees: u8("x") }]);
    await entree([{ nom: "index.html", donnees: u8("jean@exemple.invalid") }]);
    expect(ecritures).toEqual([]);
  });
  it("le texte source n'importe ni node:fs ni de stockage", async () => {
    const { readFileSync } = await vi.importActual<typeof import("node:fs")>("node:fs");
    const src = (readFileSync("src/services/zip-tutoriel.ts", "utf8") + readFileSync("src/moteurs/montage-tutoriel-outil/securite-entrees.ts", "utf8")).replace(/^\s*(\/\*[\s\S]*?\*\/|\/\/.*)$/gm, "");
    expect(src).not.toMatch(/from\s+["']node:(fs|child_process|net|http|https|dns)/);
    expect(src).not.toMatch(/\b(executerRole|appelerAvecRotation)\b/);
    expect(src).not.toContain("lireZip");
  });
});

describe("rapport.ignores : noms courts, rien avant le verdict", () => {
  it("nom ignoré de plus de 60 caractères : coupé à 60 dans le rapport", async () => {
    ALLUME();
    const long = `__MACOSX/${"a".repeat(80)}`;
    const r = await entree([...SAINE, { nom: long, donnees: u8("x") }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nom = r.rapport.ignores.find((n) => n.startsWith("__MACOSX/aaa"));
    expect(nom).toBeDefined();
    expect(nom!.length).toBeLessThanOrEqual(61);
    expect(r.rapport.ignores.join("")).not.toContain("a".repeat(70));
  });
  it("nom piégé (long, avec \\u001b) : archive refusée, aucun nom brut dans le rapport", async () => {
    ALLUME();
    const piege = `__MACOSX/${"b".repeat(80)}\u001b[31m`;
    const r = await entree([...SAINE, { nom: piege, donnees: u8("x") }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.ignores).toEqual([]);
    expect(JSON.stringify(r.rapport)).not.toContain("\u001b");
    expect(JSON.stringify(r)).not.toContain("b".repeat(70));
  });
});

describe("verdict Opus e00ce935 : de bout en bout (allumé), archive saine à côté", () => {
  const SEPS = [",", ";", "\t", "|"] as const;
  const FINS = ["\n", "\r\n", "\r"] as const;
  const MOTIF = /Jean|Dupont|orange|06 12|Martin|Paul/;
  const le = (t: string): Uint8Array => new Uint8Array(Buffer.from(t, "utf16le"));
  const be = (t: string): Uint8Array => {
    const o = le(t);
    for (let i = 0; i + 1 < o.length; i += 2) [o[i], o[i + 1]] = [o[i + 1]!, o[i]!];
    return o;
  };
  const rien = (r: { rapport: unknown }): void => {
    expect(JSON.stringify(r.rapport)).not.toMatch(MOTIF);
    expect(journal.join(" ")).not.toMatch(MOTIF);
  };
  const refuse = async (nom: string, donnees: Uint8Array, motif?: string | RegExp): Promise<void> => {
    ALLUME();
    journal.length = 0;
    const r = await entree([...SAINE.filter((e) => e.nom !== nom), { nom, donnees }]);
    expect(r.ok, `${nom} ${JSON.stringify(Array.from(donnees.slice(0, 40)))}`).toBe(false);
    if (motif) expect(r.rapport.refus.join(" ")).toMatch(motif);
    rien(r);
  };

  it("point 1 : les 9 entrées du verdict (UTF-16 LE/BE sans BOM, U+000B, U+000C, U+0000) → archive entière refusée, valeur absente du rapport et du journal", async () => {
    const entrees: [string, Uint8Array][] = [
      ["a.csv", le("id,nom\n1,Jean Dupont\n")],
      ["a.csv", be("id,nom\n1,Jean Dupont\n")],
      ["a.json", le('{"nom":"Jean Dupont"}')],
      ["notes.txt", le("jean.dupont@orange.fr")],
      ["notes.md", le("06 12 34 56 78")],
      ["script.txt", le("Appelez le 06 12 34 56 78")],
      ["a.csv", u8("id,nom\u000b1,Jean Dupont\u000b")],
      ["a.csv", u8("id,nom\u000c1,Jean Dupont\u000c")],
      ["a.csv", u8("id,n\u0000om\n1,Jean Dupont\n")],
    ];
    for (const [nom, d] of entrees) await refuse(nom, d, /caractère de contrôle/);
  });
  it("point 1 : le script refuse avec le type « caractère de contrôle » et la ligne, jamais la valeur", async () => {
    ALLUME();
    const r = await entree([...SAINE.filter((e) => e.nom !== "script.txt"), { nom: "Script-final.txt", donnees: le("Bonjour\nAppelez le 06 12 34 56 78") }]);
    expect(r.ok).toBe(false);
    expect(r.rapport.refus.join(" ")).toMatch(/caractère de contrôle \(ligne \d+\)/);
    rien(r);
  });
  it.each(SEPS.flatMap((S) => FINS.map((E) => [JSON.stringify(S), JSON.stringify(E), S, E] as const)))("point 1 : séparateur %s, fin de ligne %s : CSV en UTF-16 LE/BE sans BOM, U+000B, U+000C, U+0000 → refusé", async (_s, _e, S, E) => {
    const base = (S === "|" ? `sep=|${E}` : "") + `id${S}nom${E}1${S}Jean Dupont${E}`;
    for (const d of [le(base), be(base), u8(base.replaceAll(E, "\u000b")), u8(base.replaceAll(E, "\u000c")), u8(base.replace("nom", "n\u0000om"))]) await refuse("demo-data.csv", d, /caractère de contrôle/);
  });
  it("point 1 : témoins (tabulation, \\r\\n, \\r, BOM UTF-8, saut de page dans une maquette) → acceptés", async () => {
    ALLUME();
    for (const [nom, t] of [
      ["demo-data.csv", "id\tnom\r\n1\tJean Dupont\r\n"],
      ["demo-data.csv", "id,nom\r1,Jean Dupont\r"],
      ["demo-data.csv", "﻿id,nom\n1,Jean Dupont\n"],
      ["notes.txt", "Bonjour\tà tous\r\nFin"],
      ["notes.md", "# Titre\r\ntexte"],
    ] as const) {
      const r = await entree([...SAINE, { nom, donnees: u8(t) }]);
      expect(r.ok, JSON.stringify(t)).toBe(true);
      if (r.ok) expect(texte(r.fichiers.get(nom))).not.toMatch(/Jean|Dupont/);
    }
    const bom = await entree([...SAINE, { nom: "demo-data.csv", donnees: new Uint8Array([0xef, 0xbb, 0xbf, ...u8("id,nom\n1,Jean Dupont\n")]) }]);
    expect(bom.ok).toBe(true);
    const ff = await entree([...SAINE.filter((e) => e.nom !== "styles.css"), { nom: "styles.css", donnees: u8("body{color:#111}\u000c") }]);
    expect(ff.ok).toBe(true);
  });

  it.each([
    '{"nom": Jean Dupont}',
    "{\"nom\": 'Jean Dupont'}",
    "{'nom':'Jean Dupont'}",
    '{"ville":"Paris","nom" "Jean Dupont"}',
    '{"nom"::"Jean Dupont"}',
    '{"nom": /* x */ "Jean Dupont"}',
    '{"nom":{a:"Jean Dupont"}}',
    '{"nom":"Jean"}{"nom":"Paul Martin"}',
    '{"nom":"Jean"}\n{"nom":"Paul Martin"}\n',
    '{"ville":"Paris, "nom":"Jean Dupont"}',
    '{"nom":{"a":true"Jean"}}',
  ])("point 2a : JSON que JSON.parse rejette, %s → archive entière refusée (« JSON illisible »)", async (json) => {
    await refuse("demo-data.json", u8(json), /JSON illisible/);
  });
  it.each([
    ['{"pr\\u00e9nom": "Jean", "ville": "Paris"}'],
    ['{"n\\u006fm":"Jean Dupont"}'],
    ['{"t\\u00e9l\\u00e9phone":"06 12 34 56 78"}'],
    ['{"nom":{"Jean Dupont":true}}'],
    ['{"adresse":{"12 rue des Lilas":1}}'],
    ['{"nom":{"Jean\\u0020Dupont":true}}'],
  ])("point 2b : clé échappée ou clé qui est une donnée, %s → accepté, noms masqués, JSON valide", async (json) => {
    ALLUME();
    const r = await entree([...SAINE, { nom: "demo-data.json", donnees: u8(json) }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sortie = texte(r.fichiers.get("demo-data.json"));
    expect(sortie).not.toMatch(/Jean|Dupont|Lilas|06 12/);
    expect(() => JSON.parse(sortie)).not.toThrow();
    rien(r);
  });
  it("point 2 : témoin JSON valide sans donnée → accepté tel quel", async () => {
    ALLUME();
    const r = await entree([...SAINE, { nom: "demo-data.json", donnees: u8('{"ville":"Paris","liste":[1,2,{"a":null}]}\r\n') }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(texte(r.fichiers.get("demo-data.json"))).toBe('{"ville":"Paris","liste":[1,2,{"a":null}]}\r\n');
  });

  it.each(SEPS.map((S) => [JSON.stringify(S), S] as const))("point 3 : séparateur %s, fins de ligne mélangées avec une colonne de personne → archive entière refusée", async (_s, S) => {
    const E = ["\n", "\r\n", "\r", " ", " ", "\u0085"];
    for (const [i, E1] of E.entries()) {
      const E2 = E[(i + 1) % E.length]!;
      const csv = `${S === "|" ? `sep=|${E1}` : ""}id${S}nom${E1}1${S}Jean Dupont${E2}2${S}Paul Martin${E1}`;
      await refuse("demo-data.csv", u8(csv), /fins de ligne mélangées/);
    }
    await refuse("demo-data.csv", u8(`${S === "|" ? "sep=|\r\n" : ""}id${S}nom\r\n1${S}Jean\rDupont${S}x\r\n`), /fins de ligne mélangées/);
  });
  it("point 3 : témoins (une seule sorte de fin de ligne, \\n dans une cellule quotée sous \\r\\n, mélange sans colonne de personne) → acceptés", async () => {
    ALLUME();
    for (const csv of ["id,nom\r\n1,Jean Dupont\r\n", "id,nom\r1,Jean Dupont\r", "id,nom 1,Jean Dupont ", 'id,ville,nom\r\n1,"Paris\nCentre",Jean Dupont\r\n', "id,ville\r\n1,Paris\n2,Lyon\r"]) {
      const r = await entree([...SAINE, { nom: "demo-data.csv", donnees: u8(csv) }]);
      expect(r.ok, JSON.stringify(csv)).toBe(true);
      if (r.ok) expect(texte(r.fichiers.get("demo-data.csv"))).not.toMatch(/Jean|Dupont/);
    }
  });

  it("propriété (graine fixe, 600 archives) : un fichier texte accepté ne contient jamais le marqueur ; un C0, un JSON invalide ou des fins de ligne mélangées refusent l'archive", async () => {
    ALLUME();
    let a = 41_6001 >>> 0;
    const hasard = (): number => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const choix = <T,>(l: readonly T[]): T => l[Math.floor(hasard() * l.length)]!;
    let refus = 0;
    let acceptes = 0;
    for (let essai = 0; essai < 600; essai++) {
      const m = `Zorg${essai}qx`;
      const genre = choix(["csv", "json", "mixte", "c0", "utf16"]);
      let nom = "demo-data.csv";
      let donnees: Uint8Array;
      let doitRefuser = true;
      if (genre === "json") {
        nom = "demo-data.json";
        const esc = hasard() < 0.5 ? "pr\\u00e9nom" : "n\\u006fm";
        const cle = hasard() < 0.5 ? `"${m}"` : '"x"';
        const j = `{"${esc}":{${cle}:"${m}b"},"ville":"Paris"}`;
        const casse = hasard() < 0.4;
        donnees = u8(casse ? j.slice(0, -1) : j);
        doitRefuser = casse;
      } else if (genre === "mixte") {
        const [E1, E2] = [choix(["\n", "\r\n", "\r"]), choix(["\n", "\r\n", "\r"])];
        donnees = u8(`id,nom${E1}1,${m}${E2}2,${m}b${E1}`);
        doitRefuser = E1 !== E2;
      } else if (genre === "c0") {
        const p = Math.floor(hasard() * 12);
        const t = `id,nom\n1,${m}\n`;
        donnees = u8(t.slice(0, p) + String.fromCharCode(choix([0, 1, 7, 8, 11, 12, 14, 27, 31])) + t.slice(p));
      } else if (genre === "utf16") {
        donnees = hasard() < 0.5 ? le(`id,nom\n1,${m}\n`) : be(`id,nom\n1,${m}\n`);
      } else {
        donnees = u8(`id,nom\r\n1,${m}\r\n`);
        doitRefuser = false;
      }
      const r = await entree([...SAINE, { nom, donnees }]);
      expect(r.ok, `${genre} ${nom} ${JSON.stringify(Array.from(donnees))}`).toBe(!doitRefuser);
      expect(JSON.stringify(r.rapport)).not.toContain(m);
      if (r.ok) {
        acceptes++;
        expect(texte(r.fichiers.get(nom))).not.toContain(m);
      } else refus++;
    }
    expect(refus).toBeGreaterThan(200);
    expect(acceptes).toBeGreaterThan(100);
  });
});
