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
