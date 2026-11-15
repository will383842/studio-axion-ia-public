import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RACINE = process.cwd();
const RECUPERER = join(RACINE, "outils", "logos-outils", "recuperer.mts");
type Sortie = { fichiers: string; preuves: string };
type Entree = {
  id: string;
  source: { type: "dossier"; chemin: string; fichier: string; version: string } | { type: "simple-icons"; chemin: string; version: string; slug: string };
  charte: string;
  licence?: string;
  sortie?: Sortie;
  date?: string;
  empreinteAttendue?: string;
};
const { recuperer } = (await import(/* @vite-ignore */ RECUPERER)) as {
  recuperer: (e: Entree) => { sha256: string; fichier: string; dossierPreuve: string } | { refus: string };
};

const SVG = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h20v20H2z"/></svg>`;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

let tmp: string;
let sortie: Sortie;
let pack: string;
let charte: string;

function fauxSimpleIcons(opts: { version?: string; license?: unknown; sansLicence?: boolean } = {}) {
  const dir = join(tmp, "simple-icons");
  mkdirSync(join(dir, "icons"), { recursive: true });
  mkdirSync(join(dir, "_data"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "simple-icons", version: opts.version ?? "13.0.0", license: "CC0-1.0" }));
  writeFileSync(join(dir, "icons", "forme.svg"), SVG);
  const icone: Record<string, unknown> = { title: "Forme", slug: "forme", hex: "112233", source: "https://exemple.invalid" };
  if (!opts.sansLicence) icone.license = opts.license ?? { type: "CC0-1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
  writeFileSync(join(dir, "_data", "simple-icons.json"), JSON.stringify({ icons: [icone] }));
  return dir;
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "logos-recup-"));
  sortie = { fichiers: join(tmp, "sortie", "fichiers"), preuves: join(tmp, "sortie", "PREUVES") };
  pack = join(tmp, "pack");
  mkdirSync(pack);
  writeFileSync(join(pack, "forme.svg"), SVG);
  charte = join(tmp, "charte.html");
  writeFileSync(charte, "<html>charte neutre</html>");
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

const dossier = (extra: Partial<Entree> = {}): Entree => ({
  id: "forme",
  source: { type: "dossier", chemin: pack, fichier: "forme.svg", version: "2026-11-01" },
  charte,
  licence: "CC0-1.0",
  sortie,
  date: "2026-11-15",
  ...extra,
});

describe("récupération locale d'un logo d'outil (C8-L03)", () => {
  it("faux pack CC0 : copie, sha256 et preuve.json écrits dans la sortie temporaire", () => {
    const r = recuperer(dossier());
    expect("refus" in r).toBe(false);
    if ("refus" in r) return;
    expect(r.sha256).toBe(sha(SVG));
    expect(readFileSync(join(sortie.fichiers, "forme.svg"), "utf8")).toBe(SVG);
    const dossierPreuve = join(sortie.preuves, "forme-2026-11-15");
    expect(readFileSync(join(dossierPreuve, "charte.html"), "utf8")).toBe("<html>charte neutre</html>");
    const preuve = JSON.parse(readFileSync(join(dossierPreuve, "preuve.json"), "utf8"));
    expect(preuve).toMatchObject({ id: "forme", version: "2026-11-01", sha256: sha(SVG), date: "2026-11-15", licence: "CC0-1.0" });
    expect(typeof preuve.source).toBe("string");
    expect(preuve.statut).toBeUndefined(); // jamais « valide » : c'est un humain qui valide
  });

  it("paquet simple-icons en version exacte : accepté", () => {
    const r = recuperer({
      id: "forme",
      source: { type: "simple-icons", chemin: fauxSimpleIcons(), version: "13.0.0", slug: "forme" },
      charte,
      sortie,
      date: "2026-11-15",
    });
    expect("refus" in r).toBe(false);
    expect(existsSync(join(sortie.fichiers, "forme.svg"))).toBe(true);
  });

  it("licence Simple Icons autre que CC0 : refusée, rien d'écrit", () => {
    const r = recuperer({
      id: "forme",
      source: { type: "simple-icons", chemin: fauxSimpleIcons({ license: { type: "custom", url: "https://exemple.invalid" } }), version: "13.0.0", slug: "forme" },
      charte,
      sortie,
      date: "2026-11-15",
    });
    expect("refus" in r && r.refus).toMatch(/CC0/);
    expect(existsSync(sortie.fichiers)).toBe(false);
    expect(existsSync(sortie.preuves)).toBe(false);
  });

  it("licence non CC0 vers le dépôt public (sortie par défaut) : refusée", () => {
    const r = recuperer({ ...dossier({ licence: "Charte propriétaire" }), sortie: undefined });
    expect("refus" in r && r.refus).toMatch(/public|hors dépôt|sortie/i);
    expect(existsSync(join(RACINE, "src", "briques", "motion", "logos-outils", "fichiers", "forme.svg"))).toBe(false);
  });

  it("licence non CC0 vers une sortie hors dépôt : permise", () => {
    expect("refus" in recuperer(dossier({ licence: "Charte propriétaire" }))).toBe(false);
  });

  it.each(["^13.0.0", "~13.0.0", "13", "13.x", "latest", "*", ">=13.0.0", ""])("version non figée « %s » : refusée", (version) => {
    const r = recuperer({ id: "forme", source: { type: "simple-icons", chemin: fauxSimpleIcons(), version, slug: "forme" }, charte, sortie, date: "2026-11-15" });
    expect("refus" in r && r.refus).toMatch(/version/i);
    const r2 = recuperer(dossier({ source: { type: "dossier", chemin: pack, fichier: "forme.svg", version } }));
    expect("refus" in r2 && r2.refus).toMatch(/version/i);
  });

  it("version demandée différente de celle du paquet : refusée", () => {
    const r = recuperer({ id: "forme", source: { type: "simple-icons", chemin: fauxSimpleIcons({ version: "13.1.0" }), version: "13.0.0", slug: "forme" }, charte, sortie, date: "2026-11-15" });
    expect("refus" in r && r.refus).toMatch(/version/i);
  });

  it("charte absente ou vide : refusée", () => {
    const absente = recuperer(dossier({ charte: join(tmp, "nexiste-pas.html") }));
    expect("refus" in absente && absente.refus).toMatch(/charte/i);
    writeFileSync(join(tmp, "vide.html"), "");
    const vide = recuperer(dossier({ charte: join(tmp, "vide.html") }));
    expect("refus" in vide && vide.refus).toMatch(/charte/i);
    expect(existsSync(sortie.fichiers)).toBe(false);
  });

  it("empreinte qui ne correspond pas : refusée ; qui correspond : acceptée", () => {
    const mauvaise = recuperer(dossier({ empreinteAttendue: "0".repeat(64) }));
    expect("refus" in mauvaise && mauvaise.refus).toMatch(/empreinte/i);
    expect(existsSync(sortie.fichiers)).toBe(false);
    expect("refus" in recuperer(dossier({ empreinteAttendue: sha(SVG) }))).toBe(false);
  });

  it("SVG refusé par l'assainisseur : rien d'écrit", () => {
    writeFileSync(join(pack, "forme.svg"), `<svg viewBox="0 0 24 24"><script>x</script></svg>`);
    const r = recuperer(dossier());
    expect("refus" in r && r.refus).toMatch(/assainisseur|refus/i);
    expect(existsSync(sortie.fichiers)).toBe(false);
  });

  it("id invalide, ou logo client : refusé", () => {
    for (const id of ["../x", "Forme", "a b", "", "client-dupont"]) {
      const r = recuperer(dossier({ id }));
      expect("refus" in r).toBe(true);
    }
  });

  it("chemin du fichier hors du pack (../) : refusé", () => {
    writeFileSync(join(tmp, "dehors.svg"), SVG);
    const r = recuperer(dossier({ source: { type: "dossier", chemin: pack, fichier: "../dehors.svg", version: "2026-11-01" } }));
    expect("refus" in r).toBe(true);
  });

  it("preuve déjà présente : refus d'écraser", () => {
    expect("refus" in recuperer(dossier())).toBe(false);
    expect("refus" in recuperer(dossier())).toBe(true);
  });

  it("aucun appel réseau : le fichier n'a ni fetch, ni http, ni import réseau", () => {
    const src = readFileSync(RECUPERER, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/https?:\/\//i);
    expect(src).not.toMatch(/from\s+["'](node:)?(https?|net|tls|dgram|dns)["']/);
    expect(src).not.toMatch(/\b(axios|undici|got|node-fetch)\b/);
  });

  it("aucun vrai logo ni vraie preuve dans le dépôt", () => {
    expect(existsSync(join(RACINE, "src", "briques", "motion", "logos-outils", "fichiers"))).toBe(false);
    expect(existsSync(join(RACINE, "outils", "logos-outils", "PREUVES", "LISEZMOI.md"))).toBe(true);
  });
});
