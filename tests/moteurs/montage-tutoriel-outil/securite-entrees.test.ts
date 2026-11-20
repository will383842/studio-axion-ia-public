/**
 * T-EXT-41 : sécurité des entrées (pur). Archives fabriquées en mémoire : `creerZip` pour les saines, à la main pour les
 * piégées. Aucun fichier sur disque, aucun navigateur, 0 €.
 */
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, creerZip } from "@/lib/zip";
import {
  ENTREES_MAX,
  EXTENSIONS_PERMISES,
  FICHIER_MAX,
  IGNORES,
  NOM_MAX,
  PROFONDEUR_MAX,
  RATIO_COMPRESSION_MAX,
  TAILLE_ZIP_MAX,
  TOTAL_DECOMPRESSE_MAX,
  detecterDonneesPersonnelles,
  estFichierScript,
  lireRepertoireZip,
  masquerDonneesPersonnelles,
  refuserScriptAvecDonnees,
  trierImages,
  verifierEntreesZip,
  verifierMaquette,
  type EntreeZip,
} from "@/moteurs/montage-tutoriel-outil/securite-entrees";

const enc = new TextEncoder();
const u8 = (s: string): Uint8Array => enc.encode(s);

interface Piege {
  nom: string;
  donnees?: Uint8Array;
  methode?: number;
  drapeaux?: number;
  hote?: number;
  attrExterne?: number;
  tc?: number;
  td?: number;
  nomBrut?: Uint8Array;
}

/** Archive à la main (permet les entrées piégées que `creerZip` ne produit jamais). */
function construire(entrees: Piege[], opts: { zip64?: boolean; sansFin?: boolean; doubleFin?: boolean } = {}): Uint8Array {
  const parts: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let decalage = 0;
  for (const e of entrees) {
    const donnees = e.donnees ?? new Uint8Array();
    const methode = e.methode ?? 0;
    const comp = methode === 8 ? deflateRawSync(donnees) : donnees;
    const nom = e.nomBrut ?? u8(e.nom);
    const tc = e.tc ?? comp.length;
    const td = e.td ?? donnees.length;
    const local = new Uint8Array(30 + nom.length + comp.length);
    const vl = new DataView(local.buffer);
    vl.setUint32(0, 0x04034b50, true);
    vl.setUint16(4, 20, true);
    vl.setUint16(6, e.drapeaux ?? 0x0800, true);
    vl.setUint16(8, methode, true);
    vl.setUint32(14, crc32(donnees), true);
    vl.setUint32(18, tc, true);
    vl.setUint32(22, td, true);
    vl.setUint16(26, nom.length, true);
    local.set(nom, 30);
    local.set(comp, 30 + nom.length);
    const c = new Uint8Array(46 + nom.length);
    const vc = new DataView(c.buffer);
    vc.setUint32(0, 0x02014b50, true);
    vc.setUint8(5, e.hote ?? 0);
    vc.setUint16(6, 20, true);
    vc.setUint16(8, e.drapeaux ?? 0x0800, true);
    vc.setUint16(10, methode, true);
    vc.setUint32(16, crc32(donnees), true);
    vc.setUint32(20, tc, true);
    vc.setUint32(24, td, true);
    vc.setUint16(28, nom.length, true);
    vc.setUint32(38, e.attrExterne ?? 0, true);
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
  vf.setUint16(8, opts.zip64 ? 0xffff : entrees.length, true);
  vf.setUint16(10, opts.zip64 ? 0xffff : entrees.length, true);
  vf.setUint32(12, taille, true);
  vf.setUint32(16, decalage, true);
  const tout = [...parts, ...centraux, ...(opts.sansFin ? [] : [fin]), ...(opts.doubleFin ? [fin] : [])];
  const sortie = new Uint8Array(tout.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of tout) {
    sortie.set(x, p);
    p += x.length;
  }
  return sortie;
}

const refus = (octets: Uint8Array): string[] => {
  const l = lireRepertoireZip(octets);
  return l.ok ? verifierEntreesZip(l.entrees).refus : l.refus;
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SAINE: Piege[] = [
  { nom: "index.html", donnees: u8("<h1>Bonjour</h1>") },
  { nom: "app.js", donnees: u8("window.demoMaquette={};") },
  { nom: "demo-data.js", donnees: u8("window.donnees=[];") },
  { nom: "styles.css", donnees: u8("body{color:#111}") },
  { nom: "script.txt", donnees: u8("Bienvenue.") },
  { nom: "img/ecran.png", donnees: PNG },
];

describe("constantes", () => {
  it("valent exactement ce que la fiche fixe", () => {
    expect(TAILLE_ZIP_MAX).toBe(50 * 1024 * 1024);
    expect(TOTAL_DECOMPRESSE_MAX).toBe(150 * 1024 * 1024);
    expect(FICHIER_MAX).toBe(25 * 1024 * 1024);
    expect(ENTREES_MAX).toBe(500);
    expect(RATIO_COMPRESSION_MAX).toBe(100);
    expect(PROFONDEUR_MAX).toBe(8);
    expect(NOM_MAX).toBe(200);
    expect([...EXTENSIONS_PERMISES]).toEqual(["html", "htm", "css", "js", "json", "csv", "txt", "md", "png", "jpg", "jpeg", "webp", "woff2"]);
    expect([...IGNORES]).toEqual(["__MACOSX/", ".DS_Store", "Thumbs.db"]);
  });
});

describe("archive saine", () => {
  it("à la main : acceptée", () => {
    expect(refus(construire(SAINE))).toEqual([]);
  });
  it("fabriquée par creerZip (stockée) : acceptée, 6 entrées lues", () => {
    const z = creerZip(SAINE.map((e) => ({ nom: e.nom, donnees: e.donnees! })));
    const l = lireRepertoireZip(z);
    expect(l.ok && l.entrees.map((e) => e.nom)).toEqual(SAINE.map((e) => e.nom));
    expect(refus(z)).toEqual([]);
  });
  it("deflate : acceptée", () => {
    expect(refus(construire([{ nom: "index.html", donnees: u8("<p>".repeat(20) + "x"), methode: 8 }]))).toEqual([]);
  });
});

describe("chemins qui sortent du dossier", () => {
  const cas: [string, Piege][] = [
    ["../ en tête", { nom: "../evil.js", donnees: u8("x") }],
    ["../ au milieu", { nom: "a/../../evil.js", donnees: u8("x") }],
    ["absolu /", { nom: "/etc/x.txt", donnees: u8("x") }],
    ["absolu C:", { nom: "C:\\x.txt", donnees: u8("x") }],
    ["lettre de lecteur sans barre", { nom: "C:x.txt", donnees: u8("x") }],
    ["barre inverse", { nom: "a\\b.js", donnees: u8("x") }],
    ["..\\ Windows", { nom: "..\\evil.js", donnees: u8("x") }],
    ["octet nul", { nom: "a\u0000.js", donnees: u8("x") }],
    ["caractère de contrôle", { nom: "a\u0007.js", donnees: u8("x") }],
    ["segment vide", { nom: "a//b.js", donnees: u8("x") }],
    ["segment point", { nom: "./a.js", donnees: u8("x") }],
    ["nom trop long", { nom: `${"a".repeat(NOM_MAX)}.js`, donnees: u8("x") }],
    ["trop profond", { nom: `${Array(PROFONDEUR_MAX).fill("d").join("/")}/f.js`, donnees: u8("x") }],
  ];
  for (const [titre, piege] of cas) {
    it(`refus : ${titre}`, () => {
      expect(refus(construire([...SAINE, piege])).length).toBeGreaterThan(0);
    });
  }
  it("profondeur exacte permise", () => {
    expect(refus(construire([{ nom: `${Array(PROFONDEUR_MAX - 1).fill("d").join("/")}/f.js`, donnees: u8("x") }]))).toEqual([]);
  });
  it("même un dossier piégé ou une entrée ignorée avec .. refuse l'archive", () => {
    expect(refus(construire([{ nom: "../d/" }])).length).toBeGreaterThan(0);
    expect(refus(construire([{ nom: "__MACOSX/../x.js", donnees: u8("x") }])).length).toBeGreaterThan(0);
  });
});

describe("liens symboliques, chiffrement, méthodes", () => {
  it("lien symbolique Unix refusé", () => {
    const r = refus(construire([{ nom: "lien.txt", donnees: u8("/etc/passwd"), hote: 3, attrExterne: (0o120777 << 16) >>> 0 }]));
    expect(r.join(" ")).toContain("lien symbolique");
  });
  it("fichier Unix ordinaire (0o100644) accepté", () => {
    expect(refus(construire([{ nom: "a.txt", donnees: u8("x"), hote: 3, attrExterne: (0o100644 << 16) >>> 0 }]))).toEqual([]);
  });
  it("chiffrée refusée", () => {
    expect(refus(construire([{ nom: "a.txt", donnees: u8("x"), drapeaux: 0x0801 }])).join(" ")).toContain("chiffrée");
  });
  it("méthode 12 refusée", () => {
    expect(refus(construire([{ nom: "a.txt", donnees: u8("x"), methode: 12 }])).join(" ")).toContain("méthode");
  });
  it("ZIP64 refusé", () => {
    expect(refus(construire(SAINE, { zip64: true })).join(" ")).toContain("ZIP64");
  });
  it("fin d'archive absente ou double refusée ; fichier trop petit ou vide refusé", () => {
    expect(refus(construire(SAINE, { sansFin: true })).length).toBeGreaterThan(0);
    expect(refus(construire(SAINE, { doubleFin: true })).length).toBeGreaterThan(0);
    expect(refus(new Uint8Array(5)).length).toBeGreaterThan(0);
    expect(refus(new Uint8Array(0)).length).toBeGreaterThan(0);
  });
  it("nombre d'entrées annoncé différent du nombre lu : refusé", () => {
    const z = construire(SAINE);
    const v = new DataView(z.buffer);
    const fin = z.length - 22;
    v.setUint16(fin + 8, SAINE.length + 1, true);
    v.setUint16(fin + 10, SAINE.length + 1, true);
    expect(refus(z).length).toBeGreaterThan(0);
  });
  it("répertoire central hors du fichier : refusé", () => {
    const z = construire(SAINE);
    new DataView(z.buffer).setUint32(z.length - 22 + 16, z.length + 1000, true);
    expect(refus(z).length).toBeGreaterThan(0);
  });
  it("archive plus grosse que TAILLE_ZIP_MAX : refusée avant toute lecture", () => {
    const gros = new Uint8Array(TAILLE_ZIP_MAX + 1);
    const l = lireRepertoireZip(gros);
    expect(l.ok).toBe(false);
  });
});

describe("bombes et plafonds", () => {
  it("1 Mo de zéros en deflate : refusé avant toute décompression (ratio)", () => {
    const zeros = new Uint8Array(1024 * 1024);
    const z = construire([{ nom: "index.html", donnees: zeros, methode: 8 }]);
    expect(z.length).toBeLessThan(5000);
    expect(refus(z).join(" ")).toContain("compression anormal");
  });
  it("ratio juste sous le plafond accepté, juste au-dessus refusé", () => {
    const e = (tc: number, td: number): EntreeZip => ({ nom: "a.txt", nomOctets: u8("a.txt"), methode: 8, chiffre: false, tailleCompressee: tc, tailleDecompressee: td, crc: 0, decalageLocal: 0, estLien: false, estDossier: false });
    expect(verifierEntreesZip([e(10, 1000)]).ok).toBe(true);
    expect(verifierEntreesZip([e(10, 1001)]).ok).toBe(false);
    expect(verifierEntreesZip([e(0, 1)]).ok).toBe(false);
  });
  it("fichier annoncé au-dessus de FICHIER_MAX : refusé", () => {
    const e: EntreeZip = { nom: "a.txt", nomOctets: u8("a.txt"), methode: 0, chiffre: false, tailleCompressee: FICHIER_MAX + 1, tailleDecompressee: FICHIER_MAX + 1, crc: 0, decalageLocal: 0, estLien: false, estDossier: false };
    expect(verifierEntreesZip([e]).refus.join(" ")).toContain("trop gros");
    expect(verifierEntreesZip([{ ...e, tailleCompressee: FICHIER_MAX, tailleDecompressee: FICHIER_MAX }]).ok).toBe(true);
  });
  it("somme au-dessus de TOTAL_DECOMPRESSE_MAX : refusée", () => {
    const base: EntreeZip = { nom: "", nomOctets: new Uint8Array(), methode: 0, chiffre: false, tailleCompressee: FICHIER_MAX, tailleDecompressee: FICHIER_MAX, crc: 0, decalageLocal: 0, estLien: false, estDossier: false };
    const sept = Array.from({ length: 7 }, (_, i) => ({ ...base, nom: `f${i}.txt` }));
    expect(verifierEntreesZip(sept).refus.join(" ")).toContain("décompressé dépasse");
    expect(verifierEntreesZip(sept.slice(0, 6)).ok).toBe(true);
  });
  it("501 entrées refusées, 500 acceptées", () => {
    const f = (n: number): Piege[] => Array.from({ length: n }, (_, i) => ({ nom: `f${i}.txt`, donnees: u8("x") }));
    expect(refus(construire(f(501))).join(" ")).toContain("Trop de fichiers");
    expect(refus(construire(f(500)))).toEqual([]);
  });
});

describe("noms, collisions, types", () => {
  it("Index.html + index.html : collision", () => {
    expect(refus(construire([{ nom: "Index.html", donnees: u8("a") }, { nom: "index.html", donnees: u8("b") }])).join(" ")).toContain("même nom");
  });
  it("é NFC + é NFD : collision", () => {
    expect(refus(construire([{ nom: "caf\u00e9.txt", donnees: u8("a") }, { nom: "cafe\u0301.txt", donnees: u8("b") }])).join(" ")).toContain("même nom");
  });
  for (const nom of ["logo.svg", "run.exe", "autre.zip", "x.mjs", "sans-extension", "page.html.exe", "x.sh", "x.php"]) {
    it(`type interdit : ${nom}`, () => {
      expect(refus(construire([{ nom, donnees: u8("x") }])).join(" ")).toContain("type de fichier non accepté");
    });
  }
  it("__MACOSX/, .DS_Store et Thumbs.db : ignorés, comptés, jamais refusés pour leur type", () => {
    const l = lireRepertoireZip(construire([...SAINE, { nom: "__MACOSX/._index.html", donnees: u8("x") }, { nom: ".DS_Store", donnees: u8("x") }, { nom: "img/Thumbs.db", donnees: u8("x") }]));
    expect(l.ok).toBe(true);
    const r = verifierEntreesZip(l.ok ? l.entrees : []);
    expect(r.ok).toBe(true);
    expect(r.ignores).toEqual(["__MACOSX/._index.html", ".DS_Store", "img/Thumbs.db"]);
  });
  it("une seule entrée piégée : l'archive entière est refusée", () => {
    const r = refus(construire([...SAINE, { nom: "../x.js", donnees: u8("x") }]));
    expect(r.length).toBe(1);
  });
  it("message : nom tronqué à 60 caractères, jamais le contenu", () => {
    const secret = "CONTENU-SECRET-123";
    const r = refus(construire([{ nom: `${"n".repeat(100)}.exe`, donnees: u8(secret) }])).join(" ");
    expect(r).not.toContain(secret);
    expect(r).not.toContain("n".repeat(61));
    expect(r).toContain("…");
  });
});

describe("verifierMaquette", () => {
  const h = (texte: string) => verifierMaquette([{ chemin: "index.html", texte }]);
  const js = (texte: string) => verifierMaquette([{ chemin: "app.js", texte }]);
  const css = (texte: string) => verifierMaquette([{ chemin: "styles.css", texte }]);
  const refusee = (r: { ok: boolean; refus: { chemin: string; ligne: number }[] }, ligne?: number) => {
    expect(r.ok).toBe(false);
    expect(r.refus[0]!.chemin).toBeTruthy();
    if (ligne) expect(r.refus[0]!.ligne).toBe(ligne);
  };
  it("conforme : ok", () => {
    const r = verifierMaquette([
      { chemin: "index.html", texte: '<link rel="stylesheet" href="styles.css"><script src="app.js"></script><img src="data:image/png;base64,AAAA"><a href="#x">x</a>' },
      { chemin: "styles.css", texte: '@font-face{src:url("polices/manrope.woff2")} .a{background:url(img/a.png)} @import "autre.css";' },
      { chemin: "app.js", texte: 'const ns="http://www.w3.org/2000/svg"; window.demoMaquette={aller(){}};' },
    ]);
    expect(r).toEqual({ ok: true, refus: [] });
  });
  it("script externe, ligne indiquée", () => refusee(h('<p>\n<script src="https://cdn.exemple.invalid/x.js"></script>'), 2));
  it("protocole implicite", () => refusee(h('<img src="//cdn.exemple.invalid/a.png">')));
  it("href externe, ws, wss, http", () => {
    for (const u of ["http://x.invalid", "https://x.invalid", "ws://x.invalid", "wss://x.invalid"]) refusee(h(`<a href="${u}">x</a>`));
  });
  it("srcset, poster, action, formaction externes", () => {
    refusee(h('<img srcset="a.png 1x, https://x.invalid/b.png 2x">'));
    refusee(h('<video poster="https://x.invalid/p.png"></video>'));
    refusee(h('<button formaction="https://x.invalid">'));
  });
  it("chemin qui sort du dossier, absolu, data non image, javascript:, file:", () => {
    for (const u of ["../x.js", "/etc/x.js", "data:text/html,<b>", "javascript:alert(1)", "file:///etc/passwd"]) refusee(h(`<script src="${u}"></script>`));
  });
  it("url(//cdn…) et @import externes en css", () => {
    refusee(css("a{background:url(//cdn.exemple.invalid/a.png)}"));
    refusee(css('@import url("https://x.invalid/a.css");'));
    refusee(css("@import 'https://x.invalid/a.css';"));
    refusee(css("a{background:url('https://x.invalid/a.png')}"));
  });
  it("url( dans un style en ligne du html", () => refusee(h('<div style="background:url(https://x.invalid/a.png)">')));
  for (const [nom, code] of [
    ["fetch", 'fetch("https://exemple.invalid")'],
    ["XMLHttpRequest", "new XMLHttpRequest()"],
    ["WebSocket", "new WebSocket(u)"],
    ["EventSource", "new EventSource(u)"],
    ["sendBeacon", "navigator.sendBeacon(u)"],
    ["importScripts", "importScripts(u)"],
    ["eval", "eval(x)"],
    ["new Function", 'new Function("return 1")'],
    ["serviceWorker", "navigator.serviceWorker.register(u)"],
    ["import dynamique", 'import("./x.js")'],
    ["import statique externe", 'import x from "https://x.invalid/x.js";'],
    ["chaîne http", 'const u = "https://x.invalid/a"'],
    ["chaîne //", "const u = '//x.invalid/a'"],
  ] as const) {
    it(`js : ${nom} refusé (ligne 2)`, () => refusee(js(`const a = 1;\n${code}`), 2));
  }
  it("le même code dans un <script> en ligne est refusé, avec la ligne du html", () => refusee(h("<p>\n<script>\nfetch(u)\n</script>"), 3));
  for (const b of ["iframe", "object", "embed", "base", "frame", "applet"]) {
    it(`balise <${b}> refusée`, () => refusee(h(`<${b} src="x.html">`)));
  }
  it("meta refresh et form action refusés", () => {
    refusee(h('<meta http-equiv="refresh" content="0;url=a.html">'));
    refusee(h('<form action="envoi.html"><input></form>'));
  });
  it("un form sans action est permis", () => expect(h("<form><input></form>").ok).toBe(true));
});

// Clés fabriquées ici pour ne pas figer de vraies données : IBAN et cartes de test publics.
const IBAN_OK = "FR14 2004 1010 0505 0001 3M02 606";
const IBAN_KO = "FR15 2004 1010 0505 0001 3M02 606";
function nirAvecCle(corps13: string): string {
  let r = 0;
  for (const c of corps13.replace("2A", "19").replace("2B", "18")) r = (r * 10 + Number(c)) % 97;
  const cle = String(97 - r).padStart(2, "0");
  return `${corps13[0]} ${corps13.slice(1, 3)} ${corps13.slice(3, 5)} ${corps13.slice(5, 7)} ${corps13.slice(7, 10)} ${corps13.slice(10, 13)} ${cle}`;
}

describe("détection des données de personnes", () => {
  const types = (t: string, chemin?: string) => detecterDonneesPersonnelles(t, chemin ? { chemin } : {}).map((d) => d.type);
  it("courriel détecté ; domaines d'exemple permis", () => {
    expect(types("écrire à jean.dupont@exemple.invalid")).toEqual(["courriel"]);
    for (const d of ["exemple.fr", "exemple.com", "example.com", "example.org", "Exemple.FR"]) expect(types(`contact@${d}`)).toEqual([]);
  });
  it("téléphone FR : 0…, +33…, séparateurs ; pas un numéro trop court ou trop long", () => {
    for (const t of ["06 12 34 56 78", "06.12.34.56.78", "06-12-34-56-78", "0612345678", "+33 6 12 34 56 78", "+33612345678", "0033 6 12 34 56 78"]) expect(types(t)).toEqual(["telephone"]);
    expect(types("061234567")).toEqual([]);
    expect(types("06123456789")).toEqual([]);
  });
  it("IBAN : clé juste détecté, clé fausse non détecté", () => {
    expect(types(`Mon IBAN ${IBAN_OK}.`)).toEqual(["iban"]);
    expect(types(IBAN_OK.replace(/ /g, ""))).toEqual(["iban"]);
    expect(types(IBAN_KO)).toEqual([]);
  });
  it("carte : Luhn juste détecté, Luhn faux non détecté", () => {
    for (const c of ["4111 1111 1111 1111", "5555-5555-5555-4444", "378282246310005", "4111111111111111"]) expect(types(c)).toEqual(["carte"]);
    expect(types("4111 1111 1111 1112")).toEqual([]);
    expect(types("1234 5678 9012 3456")).toEqual([]);
  });
  it("NIR : clé juste détecté (dont la Corse), clé fausse non détecté", () => {
    expect(types(nirAvecCle("1850575012345"))).toEqual(["nir"]);
    expect(types(nirAvecCle("185052A123456"))).toEqual(["nir"]);
    const bon = nirAvecCle("1850575012345");
    const faux = bon.slice(0, -2) + (bon.endsWith("00") ? "01" : "00");
    expect(types(faux)).toEqual([]);
  });
  it("colonne de personne en csv : valeur réelle détectée, exemple et noms neutres permis", () => {
    const csv = "nom,prenom,ville\nMartin,Claire,Lyon\nPersonne exemple 1,Alice,Paris\n";
    const d = detecterDonneesPersonnelles(csv, { chemin: "clients.csv", nomsNeutres: new Set(["Alice"]) });
    expect(d.map((x) => [x.type, x.ligne])).toEqual([["colonne-personne", 2], ["colonne-personne", 2]]);
    expect(types(csv, "clients.txt")).toEqual([]); // hors csv/json : pas de détection par colonne
  });
  it("colonne de personne en json", () => {
    const j = '{"clients":[{"Nom":"Martin","ville":"Lyon"},{"nom":"Entreprise exemple"}]}';
    expect(types(j, "d.json")).toEqual(["colonne-personne"]);
  });
  it("rend la place (ligne, début, fin) et jamais la valeur", () => {
    const d = detecterDonneesPersonnelles("a\nb 06 12 34 56 78 c");
    expect(d).toEqual([{ type: "telephone", ligne: 2, debut: 4, fin: 18 }]);
    expect(JSON.stringify(d)).not.toContain("06 12");
  });
  it("une plage prise par un IBAN n'est pas reprise comme carte ou téléphone", () => {
    expect(types(IBAN_OK)).toEqual(["iban"]);
  });
  it("ne lève jamais, même sur une entrée absurde", () => {
    expect(() => detecterDonneesPersonnelles("\u0000".repeat(10_000) + "@@@@")).not.toThrow();
  });
});

describe("colonnes de personnes : valeur entière masquée (verdict Opus 05e6ac98)", () => {
  const m = (t: string, chemin: string): string => masquerDonneesPersonnelles(t, { chemin }).texte;
  const nb = (d: { type: string }[], type: string) => d.filter((x) => x.type === type).length;
  const chrono = <T,>(f: () => T): { r: T; ms: number } => {
    const t0 = performance.now();
    const r = f();
    return { r, ms: performance.now() - t0 };
  };
  it("1a. CSV : nom + courriel dans la même valeur → rien de « Jean Dupont » ne reste", () => {
    const sortie = m("nom,ville\nJean Dupont jean@orange.fr,Paris\n", "demo-data.csv");
    expect(sortie).not.toContain("Jean");
    expect(sortie).not.toContain("Dupont");
    expect(sortie).not.toContain("orange");
    expect(sortie).toBe("nom,ville\nPersonne exemple 1,Paris\n");
  });
  it("1b. JSON : adresse avec nom, courriel et rue → tout est masqué", () => {
    const sortie = m('{"adresse":"Jean Dupont, jean.dupont@orange.fr, 12 rue des Lilas"}', "d.json");
    expect(sortie).not.toContain("Jean Dupont");
    expect(sortie).not.toContain("12 rue des Lilas");
    expect(sortie).not.toContain("orange");
    expect(JSON.parse(sortie)).toEqual({ adresse: "Personne exemple 1" });
  });
  it("1c. JSON : nom avec téléphone → tout est masqué", () => {
    const sortie = m('{"nom":"Jean Dupont 06 12 34 56 78"}', "d.json");
    expect(sortie).not.toContain("Jean Dupont");
    expect(sortie).not.toContain("06 12");
    expect(JSON.parse(sortie)).toEqual({ nom: "Personne exemple 1" });
  });
  it("1d. une valeur qui est TOUT un courriel reste un courriel (inchangé)", () => {
    expect(m("email\nmartin@societe.fr\n", "a.csv")).toBe("email\ncontact@exemple.fr\n");
  });
  it("2. CSV : valeur entre guillemets sur plusieurs lignes → aucune ligne ne fuit, colonnes non décalées", () => {
    const sortie = m('id,adresse,nom\n1,"12 rue des Lilas\n75011 Paris",Martin\n2,"1 rue A",Durand\n', "a.csv");
    expect(sortie).not.toContain("75011 Paris");
    expect(sortie).not.toContain("Lilas");
    expect(sortie).not.toContain("Martin");
    expect(sortie).not.toContain("Durand");
    expect(sortie).toBe('id,adresse,nom\n1,"Personne exemple 1",Personne exemple 2\n2,"Personne exemple 3",Personne exemple 4\n');
  });
  it("2a. CSV : texte entre le guillemet fermant et le séparateur → masqué, colonne suivante intacte", () => {
    const sortie = m('id,nom,ville\n1,"Jean" Dupont,Paris\n', "a.csv");
    expect(sortie).not.toContain("Dupont");
    expect(sortie).not.toContain("Jean");
    expect(sortie).toBe('id,nom,ville\n1,"Personne exemple 1",Paris\n');
    const crlf = m('id,nom,ville\r\n1,"Jean" Dupont,Paris\r\n', "a.csv");
    expect(crlf).not.toContain("Dupont");
    expect(crlf).toBe('id,nom,ville\r\n1,"Personne exemple 1",Paris\r\n');
    expect(m('id,nom\n1,"Jean" Dupont', "a.csv")).toBe('id,nom\n1,"Personne exemple 1"');
  });
  it("2b. CSV : guillemet jamais refermé → tout le reste est masqué", () => {
    const sortie = m('id,nom\n1,"Martin\n2,Durand\n', "a.csv");
    expect(sortie).not.toContain("Martin");
    expect(sortie).not.toContain("Durand");
  });
  it("3. CSV séparé par des tabulations : le nom est masqué", () => {
    const sortie = m("nom\temail\nJean Dupont\tjean@orange.fr\n", "a.csv");
    expect(sortie).not.toContain("Jean Dupont");
    expect(sortie).toBe("nom\temail\nPersonne exemple 1\tcontact@exemple.fr\n");
  });
  it("3b. CSV à fins de ligne \\r\\n : inchangé", () => {
    expect(m("nom;ville\r\nMartin;Lyon\r\n", "a.csv")).toBe("nom;ville\r\nPersonne exemple 1;Lyon\r\n");
  });
  it("3c. CSV de 200 000 lignes multilignes : temps linéaire", () => {
    const t = "nom,adresse\n" + 'Martin,"1 rue\n75000 Paris"\n'.repeat(100000);
    const { r, ms } = chrono(() => detecterDonneesPersonnelles(t, { chemin: "d.csv" }));
    expect(nb(r, "colonne-personne")).toBe(200000);
    expect(ms).toBeLessThan(1000);
  });
});

describe("masquage", () => {
  it("remplace chaque type par son texte d'exemple, de façon déterministe", () => {
    const t = `Mail jean@exemple.invalid tel 06 12 34 56 78 iban ${IBAN_OK} carte 4111 1111 1111 1111 nir ${nirAvecCle("1850575012345")}`;
    const a = masquerDonneesPersonnelles(t);
    const b = masquerDonneesPersonnelles(t);
    expect(a).toEqual(b);
    expect(a.texte).toBe("Mail contact@exemple.fr tel 01 00 00 00 00 iban FR00 0000 0000 0000 0000 0000 000 carte 0000 0000 0000 0000 nir 0 00 00 00 000 000 00");
    expect(a.remplacements.map((r) => r.type).sort()).toEqual(["carte", "courriel", "iban", "nir", "telephone"]);
  });
  it("le résultat masqué ne contient plus rien à détecter (idempotent)", () => {
    const t = `jean@exemple.invalid 06 12 34 56 78 ${IBAN_OK} 4111 1111 1111 1111 ${nirAvecCle("1850575012345")}`;
    const m = masquerDonneesPersonnelles(t).texte;
    expect(detecterDonneesPersonnelles(m)).toEqual([]);
    expect(masquerDonneesPersonnelles(m).texte).toBe(m);
  });
  it("colonnes : Personne exemple <n>, numérotées dans l'ordre", () => {
    const m = masquerDonneesPersonnelles("nom;ville\nMartin;Lyon\n\"Durand\";Nice\n", { chemin: "c.csv" });
    expect(m.texte).toBe('nom;ville\nPersonne exemple 1;Lyon\n"Personne exemple 2";Nice\n');
    expect(m.remplacements).toEqual([{ type: "colonne-personne", nombre: 2 }]);
    expect(detecterDonneesPersonnelles(m.texte, { chemin: "c.csv" })).toEqual([]);
  });
  it("colonnes json : le json reste valide", () => {
    const m = masquerDonneesPersonnelles('{"nom":"Martin","autre":"Martin"}', { chemin: "d.json" });
    expect(JSON.parse(m.texte)).toEqual({ nom: "Personne exemple 1", autre: "Martin" });
  });
  it("sans donnée : texte identique, aucun remplacement", () => {
    expect(masquerDonneesPersonnelles("rien ici")).toEqual({ texte: "rien ici", remplacements: [] });
  });
  it("JSON très imbriqué : lecture sans récursion, linéaire (< 1 s), ne lève pas", () => {
    for (const t of ["[".repeat(200_000), '{"nom":'.repeat(20_000), "[".repeat(20_000) + '{"nom":"Martin"}' + "]".repeat(20_000)]) {
      const debut = Date.now();
      expect(() => detecterDonneesPersonnelles(t, { chemin: "demo-data.json" })).not.toThrow();
      expect(Date.now() - debut).toBeLessThan(1000);
    }
  });
  it("JSON profond : la colonne de personne est toujours trouvée et masquée", () => {
    const t = '{"nom":' + "[".repeat(20_000) + '"Martin"' + "]".repeat(20_000) + "}";
    const m = masquerDonneesPersonnelles(t, { chemin: "d.json" });
    expect(m.texte).not.toContain("Martin");
    expect(m.remplacements).toEqual([{ type: "colonne-personne", nombre: 1 }]);
  });
  it("une détection qui échoue rend « detection-echouee », jamais « aucune donnée »", () => {
    const piege = new Proxy(new Set<string>(), { get: () => { throw new Error("boum"); } }) as unknown as ReadonlySet<string>;
    const d = detecterDonneesPersonnelles('{"nom":"Martin"}', { chemin: "d.json", nomsNeutres: piege });
    expect(d.map((x) => x.type)).toEqual(["detection-echouee"]);
    const m = masquerDonneesPersonnelles('{"nom":"Martin"}', { chemin: "d.json", nomsNeutres: piege });
    expect(m.texte).toBe("");
    expect(m.remplacements).toEqual([{ type: "detection-echouee", nombre: 1 }]);
  });
});

describe("script de Williams : jamais masqué, refusé", () => {
  it("reconnaît script*.txt et voix*.txt seulement", () => {
    for (const c of ["script.txt", "dossier/script-2.txt", "voix.txt", "Voix-fr.TXT"]) expect(estFichierScript(c)).toBe(true);
    for (const c of ["notes.txt", "script.md", "script.js", "mon-script.txt"]) expect(estFichierScript(c)).toBe(false);
  });
  it("un téléphone dans le script : refus qui cite type et ligne, jamais la valeur", () => {
    const r = refuserScriptAvecDonnees("script.txt", "Bonjour.\nAppelez le 06 12 34 56 78.");
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("Votre script contient une donnée personnelle (telephone, ligne 2)");
    expect(r[0]).toContain("corrigez-le puis renvoyez le dossier");
    expect(r[0]).not.toContain("06 12");
  });
  it("script propre : aucun refus", () => expect(refuserScriptAvecDonnees("script.txt", "Bienvenue chez Entreprise exemple.")).toEqual([]));
});

describe("images (modèle écran fourni)", () => {
  const chemins = ["img/a.png", "b.JPG", "c.webp", "d.jpeg", "index.html", "f.woff2"];
  it("sans attestation : toutes les images écartées et listées", () => {
    expect(trierImages(chemins, false)).toEqual({ gardees: [], ecartees: ["img/a.png", "b.JPG", "c.webp", "d.jpeg"] });
  });
  it("avec attestation true exacte : gardées", () => {
    expect(trierImages(chemins, true).gardees).toHaveLength(4);
  });
  it("une valeur truthy qui n'est pas true : écartées", () => {
    expect(trierImages(chemins, 1 as unknown as boolean).gardees).toEqual([]);
    expect(trierImages(chemins, "true" as unknown as boolean).gardees).toEqual([]);
  });
});

describe("verdict Opus : maquette, courriels, JSON, liens", () => {
  const h = (texte: string) => verifierMaquette([{ chemin: "index.html", texte }]);
  const c = (texte: string) => verifierMaquette([{ chemin: "styles.css", texte }]);
  const refuses: [string, string][] = [
    ["onload fetch", `<body onload="fetch('https://exemple.invalid/x')"></body>`],
    ["onerror sendBeacon", `<img src="a.png" onerror="navigator.sendBeacon('x')">`],
    ["onclick sans guillemets", `<a href="#" onclick=eval(1)>x</a>`],
    ["href entité décimale", `<a href="&#104;ttps://exemple.invalid/a">x</a>`],
    ["src entités //", `<script src="&#47;&#47;exemple.invalid/a.js"></script>`],
    ["href &colon;", `<a href="https&colon;//exemple.invalid">x</a>`],
    ["(0,eval)", `<script>(0,eval)("1")</script>`],
    ["Function()", `<script>Function("return 1")()</script>`],
    ["ping", `<a href="#" ping="https://exemple.invalid/p">x</a>`],
    ["background", `<body background="https://exemple.invalid/b.png"></body>`],
    ["manifest", `<html manifest="https://exemple.invalid/m"></html>`],
    ["codebase", `<div codebase="https://exemple.invalid/"></div>`],
    ["script src sans .js", `<script src="data.json"></script>`],
    ["script src .js.txt", `<script src="app.js.txt"></script>`],
    ["(a) svg/onload séparé par « / »", `<svg/onload="fetch('https://exemple.invalid')"></svg>`],
    ["(b) onerror après un « > » entre guillemets", `<img alt=">" onerror="fetch('https://exemple.invalid')" src="a.png">`],
    ["(r2-a) JS : adresse en majuscules dans une chaîne", `<script>charger("HTTPS://exemple.invalid/x.png");</script>`],
    ["(r2-a) JS : fetch.call", `<script>fetch.call(null, "HTTPS://exemple.invalid/x");</script>`],
    ["(r2-b) JS : commentaire entre fetch et la parenthèse", `<script>fetch/**/("x")</script>`],
    ["(r2-b) JS : commentaire entre import et la parenthèse", `<script>import/**/("./x.js")</script>`],
    ["(r2-c) JS : \\/ dans une chaîne", `<script>var u = "https:\\/\\/exemple.invalid/x.png";</script>`],
    ["(r2-c) JS : octal", `<script>var u = "\\150ttps://exemple.invalid/x.png";</script>`],
    ["(r2-c) JS : continuation de ligne", `<script>var u = "https:/\\\n/exemple.invalid/x.png";</script>`],
    ["(r2-d) CSS : u\\72l( dans une feuille de style", `<style>body{background:u\\72l(https://exemple.invalid/a.png)}</style>`],
    ["(r2-d) CSS : \\75rl( dans une feuille de style", `<style>body{background:\\75rl(//exemple.invalid/a.png)}</style>`],
    ["(r2-e) attribut style : barre oblique inverse en entité", `<div style="background:url(ht&#92;74 tps://exemple.invalid/a.png)"></div>`],
    ["(r2-f) imagesrcset", `<link rel="preload" as="image" imagesrcset="https://exemple.invalid/a.png 1x">`],
    ["(r2-f) SVG set href", `<svg><set attributeName="href" to="https://exemple.invalid/a.png"/></svg>`],
    ["(r2-f) attribut quelconque avec entité", `<div data-x="&#104;ttps://exemple.invalid/a.png"></div>`],
    ["(c) entité décimale avec zéros de tête", `<a href="&#00000000104;ttps://exemple.invalid">x</a>`],
    ["(c) entité hexadécimale avec zéros de tête", `<img src="&#x0000000068;ttps://exemple.invalid/a.png">`],
    ["(d) meta refresh en entité", `<meta http-equiv="&#114;efresh" content="0;url=https://exemple.invalid">`],
    ["(f) fetch par échappement d'identifiant", `<script>\\u0066etch("x")</script>`],
    ["(f) \\x66etch", `<script>\\x66etch("x")</script>`],
    ["(f) constructor", `<script>[].map.constructor("return 1")()</script>`],
    ["(f) setTimeout avec une chaîne", `<script>setTimeout("alert(1)", 0)</script>`],
    ["(f) setInterval avec une chaîne", `<script>setInterval('alert(1)', 0)</script>`],
  ];
  for (const [nom, html] of refuses) {
    it(`html refusé : ${nom}`, () => {
      expect(h(html).ok, nom).toBe(false);
    });
  }
  it("html permis : script src .js local et gestionnaire inoffensif", () => {
    expect(h(`<script src="app.js?v=1"></script><button onclick="ouvrir()">x</button>`).ok).toBe(true);
  });
  it("css refusé : (r2-d) échappement dans le nom de fonction ou de règle", () => {
    expect(c(`body{background:u\\72l(https://exemple.invalid/a.png)}`).ok).toBe(false);
    expect(c(`body{background:\\75rl(//exemple.invalid/a.png)}`).ok).toBe(false);
    expect(c(`@\\69mport "https://exemple.invalid/a.css";`).ok).toBe(false);
    expect(c(`a{color:red}`).ok).toBe(true);
  });
  it("html permis : (r2-f) xmlns SVG, srcset local, style local", () => {
    expect(h(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg><img srcset="a.png 1x, b.png 2x" src="a.png"><div style="background:url(img/a.png)"></div>`).ok).toBe(true);
  });
  it("css refusé : (e) @import avec échappement CSS", () => {
    expect(c(`@import "ht\\74 tps://exemple.invalid/a.css";`).ok).toBe(false);
    expect(c(`@import url("ht\\74 tps://exemple.invalid/a.css");`).ok).toBe(false);
    expect(c(`@import "local.css";`).ok).toBe(true);
  });
  it("css refusé : image-set, -webkit-image-set, url( avec barre oblique inverse", () => {
    expect(c(`a{background:image-set("https://exemple.invalid/a.png" 1x)}`).ok).toBe(false);
    expect(c(`a{background:-webkit-image-set(url(https://exemple.invalid/a.png) 1x)}`).ok).toBe(false);
    expect(c(`a{background:url(ht\\74 tps://exemple.invalid/a.png)}`).ok).toBe(false);
    expect(c(`a{background:url("ht\\74 tps://exemple.invalid/a.png")}`).ok).toBe(false);
    expect(c(`a{background:image-set("img/a.png" 1x)}`).ok).toBe(true);
  });

  it("courriel avec accents : masqué en entier, rien ne fuit", () => {
    const m = masquerDonneesPersonnelles("Écrire à jérôme@exemple.invalid");
    expect(m.texte).toBe("Écrire à contact@exemple.fr");
    expect(m.texte).not.toContain("jérô");
    const n = masquerDonneesPersonnelles("jean@société.invalid");
    expect(n.remplacements).toEqual([{ type: "courriel", nombre: 1 }]);
    expect(n.texte).not.toContain("société");
    expect(n.texte).toBe("contact@exemple.fr");
  });

  it("clés de personne avec tableau ou nombre : détectées et masquées en JSON valide", () => {
    for (const j of ['{"nom": ["Jean Dupont"]}', '{"telephone": 612345678}', '{"adresse": {"rue": "1 rue X", "cp": 69000}}']) {
      expect(detecterDonneesPersonnelles(j, { chemin: "d.json" }).length, j).toBeGreaterThan(0);
      const m = masquerDonneesPersonnelles(j, { chemin: "d.json" }).texte;
      expect(() => JSON.parse(m), m).not.toThrow();
      expect(m).not.toMatch(/Dupont|612345678|rue X|69000/);
    }
    expect(detecterDonneesPersonnelles('{"nom": ["Entreprise exemple"], "telephone": null}', { chemin: "d.json" })).toEqual([]);
  });

  it("lien symbolique : refusé aussi avec l'hôte 19 (macOS)", () => {
    const r = refus(construire([{ nom: "lien.txt", donnees: u8("/etc/passwd"), hote: 19, attrExterne: (0o120777 << 16) >>> 0 }]));
    expect(r.join(" ")).toContain("lien symbolique");
    expect(refus(construire([{ nom: "a.txt", donnees: u8("x"), hote: 19, attrExterne: (0o100644 << 16) >>> 0 }]))).toEqual([]);
  });
});

describe("verdict Opus : temps de calcul de verifierMaquette (ReDoS, lignes)", () => {
  const duree = (texte: string) => {
    const t0 = performance.now();
    const r = verifierMaquette([{ chemin: "index.html", texte }]);
    return { ms: performance.now() - t0, r };
  };
  it.each([
    ["balises sans fin « <a »", () => "<a".repeat(500_000)],
    ["balises sans fin « <a␠ »", () => "<a ".repeat(350_000)],
    ["balises à attribut, une par ligne", () => "<a b=c>\n".repeat(131_072)],
    ["guillemets ouvrants sans fin", () => '<a "'.repeat(200_000)],
    ["un nom d'attribut de 1 Mo sans « = »", () => "<a " + "b".repeat(1_000_000) + ">"],
    ["500 000 noms d'attribut sans « = »", () => "<a " + "b ".repeat(500_000) + ">"],
    ["20 000 balises avant un guillemet sans fermant, puis 10 Mo", () => "<a".repeat(20_000) + '"' + "x".repeat(10_000_000)],
    ["« <script␠ » répété (balise de script sans fin)", () => "<script ".repeat(100_000)],
    ["« <script> » répété sans fermant", () => "<script>".repeat(100_000)],
    ["« <meta␠ » répété", () => "<meta ".repeat(100_000)],
    ["« <form␠ » répété", () => "<form ".repeat(100_000)],
    ["« url( » répété sans parenthèse fermante", () => "url(".repeat(200_000)],
    ["« url(\" » répété sans parenthèse fermante", () => 'url("'.repeat(200_000)],
    ["« @import url(\" » répété", () => '@import url("'.repeat(100_000)],
    ["« <style>url( » répété", () => "<style>url(".repeat(100_000)],
    ["« <script>url( » répété", () => "<script>url(".repeat(100_000)],
    ["« import␠ » répété dans un script", () => "<script>" + "import ".repeat(200_000)],
    ["« import/* » répété dans un script", () => "<script>" + "import/*".repeat(200_000)],
    ["« import// » répété dans un script", () => "<script>" + "import//".repeat(200_000)],
    ["« import x from␠ » répété dans un script", () => "<script>" + "import x from ".repeat(100_000)],
    ["« <a b= » répété puis un guillemet sans fermant et 10 Mo", () => "<a b=".repeat(20_000) + '"' + "x".repeat(10_000_000)],
    ["« <a b=␠ » répété puis un guillemet sans fermant", () => "<a b= ".repeat(100_000) + '"'],
    ["« <a=\"␠ » répété (guillemet dans le nom de balise)", () => '<a=" '.repeat(100_000)],
  ])("%s : moins d'une seconde", (_nom, fabrique) => {
    const { ms } = duree(fabrique());
    expect(ms).toBeLessThan(1000);
  });
  it("le cas permis reste accepté, et une adresse externe garde sa ligne", () => {
    expect(verifierMaquette([{ chemin: "ok.html", texte: '<link rel="stylesheet" href="styles.css">\n<img src="a.png" srcset="b.png 1x">' }]).ok).toBe(true);
    const r = verifierMaquette([{ chemin: "index.html", texte: '<p>a</p>\n<p>b</p>\n<link rel="preload" as="image" imagesrcset="https://exemple.invalid/a.png 1x">' }]);
    expect(r.ok).toBe(false);
    expect(r.refus.some((x) => x.ligne === 3)).toBe(true);
  });
  it("attribut externe dans une balise précédée d'un « < » sans fin : toujours refusé", () => {
    const r = verifierMaquette([{ chemin: "index.html", texte: '<b <p>\n<img data-x="//exemple.invalid/a.png">' }]);
    expect(r.ok).toBe(false);
  });
});

describe("verdict Opus : un guillemet n'ouvre une valeur que juste après « = » (balisesDe)", () => {
  it.each([
    ["set avec un guillemet isolé dans le nom", '<svg><image><set " attributeName=href to=https://exemple.invalid/a.png></image></svg>'],
    ["animate avec une apostrophe isolée", "<svg><image><animate ' attributeName=href values=https://exemple.invalid/a.png></image></svg>"],
    ["guillemet isolé, un autre guillemet plus loin dans le fichier", '<svg><set " attributeName=href to=https://exemple.invalid/a.png></set></svg><p title="x">y</p>'],
    ["guillemet dans le nom de la balise", '<set" attributeName=href to=https://exemple.invalid/a.png>'],
    ["guillemet dans une valeur sans guillemets", '<a data-x=b"c to=https://exemple.invalid/a.png>'],
  ])("refusée : %s", (_nom, texte) => {
    const r = verifierMaquette([{ chemin: "index.html", texte }]);
    expect(r.ok).toBe(false);
    expect(r.refus.some((x) => x.motif.includes("adresse externe"))).toBe(true);
  });
  it("témoin : la même balise sans le guillemet est refusée", () => {
    expect(verifierMaquette([{ chemin: "index.html", texte: "<svg><set attributeName=href to=https://exemple.invalid/a.png></set></svg>" }]).ok).toBe(false);
  });
  it("une valeur entre guillemets qui contient « > » reste une seule valeur ; le cas permis reste accepté", () => {
    expect(verifierMaquette([{ chemin: "ok.html", texte: '<img alt="a > b" src="a.png"><p title=\'x\'>y</p><link rel="stylesheet" href="styles.css">' }]).ok).toBe(true);
    expect(verifierMaquette([{ chemin: "index.html", texte: '<img alt=">" onerror="fetch(\'https://exemple.invalid\')" src="a.png">' }]).ok).toBe(false);
  });
});

describe("verdict Opus : lectures à la main, mêmes refus qu'avant", () => {
  it("script sans fermant : le reste du fichier est vérifié comme du JS", () => {
    expect(verifierMaquette([{ chemin: "index.html", texte: '<p>a</p><script>fetch("https://exemple.invalid")' }]).ok).toBe(false);
  });
  it("script fermé : refus avec la ligne, et le HTML après le script reste permis", () => {
    const r = verifierMaquette([{ chemin: "index.html", texte: '<p>a</p>\n<script>\nfetch("x")\n</script >\n<p>b</p>' }]);
    expect(r.ok).toBe(false);
    expect(r.refus.some((x) => x.ligne === 3)).toBe(true);
    expect(verifierMaquette([{ chemin: "index.html", texte: '<script src="app.js"></script><script>var a = 1;</script><p>b</p>' }]).ok).toBe(true);
  });
  it("script src, meta refresh, form action : toujours refusés", () => {
    expect(verifierMaquette([{ chemin: "index.html", texte: '<script src="app.txt"></script>' }]).ok).toBe(false);
    expect(verifierMaquette([{ chemin: "index.html", texte: '<meta http-equiv="&#114;efresh" content="0;url=a.html">' }]).ok).toBe(false);
    expect(verifierMaquette([{ chemin: "index.html", texte: '<form method="post" action="a.html"></form>' }]).ok).toBe(false);
  });
  it.each([
    ["url( externe", "a{background:url(https://exemple.invalid/a.png)}"],
    ["url( entre guillemets, blancs", "a{background:url( \"//exemple.invalid/a.png\" )}"],
    ["url( après une url( sans fin", "a{b:url(\"x\" y) } c{background:url('https://exemple.invalid/a.png')}"],
    ["url( avec barre oblique inverse", "a{background:url(ht\\74 tps://exemple.invalid/a.png)}"],
  ])("CSS : %s", (_nom, texte) => {
    expect(verifierMaquette([{ chemin: "a.css", texte }]).ok).toBe(false);
  });
  it.each([
    ["import dynamique", "import('https://exemple.invalid/a.js')"],
    ["import dynamique après un commentaire", "import /* x */ ('a.js')"],
    ["import dynamique après un commentaire de ligne", "import // x\n ('a.js')"],
    ["import depuis une adresse externe", "import x from 'https://exemple.invalid/a.js'"],
    ["import depuis une adresse externe (//)", 'import { a } from\n "//exemple.invalid/a.js";'],
  ])("JS : %s", (_nom, texte) => {
    expect(verifierMaquette([{ chemin: "a.js", texte }]).ok).toBe(false);
  });
  it("JS : un import relatif reste permis", () => {
    expect(verifierMaquette([{ chemin: "a.js", texte: "import x from './b.js'; var important = 1;" }]).ok).toBe(true);
  });
});

describe("verdict Opus : temps de la détection (dédoublonnage linéaire)", () => {
  const chrono = <T,>(f: () => T): { r: T; ms: number } => {
    const t0 = performance.now();
    const r = f();
    return { r, ms: performance.now() - t0 };
  };
  const nb = (d: { type: string }[], type: string) => d.filter((x) => x.type === type).length;

  it("CSV de 40 000 lignes nom,email : 40 000 courriels + 40 000 colonnes, en moins d'une seconde", () => {
    let t = "nom,email\n";
    for (let i = 0; i < 40000; i++) t += `Client ${i},client${i}@societe.fr\n`;
    const { r, ms } = chrono(() => detecterDonneesPersonnelles(t, { chemin: "demo-data.csv" }));
    expect(nb(r, "courriel")).toBe(40000);
    expect(nb(r, "colonne-personne")).toBe(40000);
    expect(ms).toBeLessThan(1000);
  });
  it("40 000 téléphones, un par ligne", () => {
    const t = "06 12 34 56 78\n".repeat(40000);
    const { r, ms } = chrono(() => detecterDonneesPersonnelles(t));
    expect(nb(r, "telephone")).toBe(40000);
    expect(ms).toBeLessThan(1000);
  });
  it("JSON de 200 000 objets {nom} : 200 000 colonnes", () => {
    const t = '{"nom":[' + '{"nom":"a"},'.repeat(200000) + '{"nom":"a"}]}';
    const { r, ms } = chrono(() => detecterDonneesPersonnelles(t, { chemin: "d.json" }));
    expect(nb(r, "colonne-personne")).toBe(200001);
    expect(ms).toBeLessThan(1000);
  });
  it("JSON de 300 000 entrées imbriquées", () => {
    const t = "{" + '"a":{"nom":"x"},'.repeat(300000) + '"z":1}';
    const { r, ms } = chrono(() => detecterDonneesPersonnelles(t, { chemin: "d.json" }));
    expect(nb(r, "colonne-personne")).toBe(300000);
    expect(ms).toBeLessThan(1000);
  });
  it("{\"nom\":[1,1,…] ×200 000 et CSV de 200 000 lignes à colonne nom : moins d'une seconde", () => {
    const a = chrono(() => detecterDonneesPersonnelles('{"nom":[' + "1,".repeat(200000) + "1]}", { chemin: "d.json" }));
    expect(a.ms).toBeLessThan(1000);
    const b = chrono(() => detecterDonneesPersonnelles("nom\n" + "Martin\n".repeat(200000), { chemin: "d.csv" }));
    expect(nb(b.r, "colonne-personne")).toBe(200000);
    expect(b.ms).toBeLessThan(1000);
  });
  it("la priorité par ordre de découverte est inchangée : un courriel dans une colonne reste un courriel", () => {
    const d = detecterDonneesPersonnelles("nom,email\nMartin,martin@societe.fr\n", { chemin: "a.csv" });
    expect(nb(d, "courriel")).toBe(1);
    const c = d.filter((x) => x.type === "colonne-personne");
    for (const x of c) for (const y of d.filter((z) => z.type === "courriel")) expect(x.debut < y.fin && x.fin > y.debut).toBe(false);
  });
});
