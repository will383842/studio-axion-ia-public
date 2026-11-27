import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LectureRegard } from "../../../src/briques/regardeur";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { textesEcransScene, textesEcrits } from "../../../src/moteurs/montage-tableau/regles";
import { instantsTableau } from "../../../src/moteurs/montage-tableau/regard-tableau";
import { relecteurTableau, type PortsRegardTableau } from "../../../src/services/regardeur-tableau";

interface Temoin { ficheCalee: FicheTableau; voix: { dureeSec: number } }
const temoin = JSON.parse(readFileSync(new URL("../temoins/blocage-fin-tiktok-2026-10-14.json", import.meta.url), "utf8")) as Temoin;
const fiche = temoin.ficheCalee;
const VIDEO = { cle: "studio/dev/tableau/v-1/sortie-secrete-abc.mp4", dureeSec: temoin.voix.dureeSec };
const MISE = {} as never;

const ecrits = (page: number) => fiche.scenes.filter((s) => s.page === page).flatMap((s) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)]);

interface Compteurs { extractions: number; appels: number; entrees: unknown[]; memo: Map<string, string> }
function ports(opts: { lecture?: (entree: { variable: string; images?: unknown[] }) => LectureRegard; simule?: boolean; ok?: boolean; extraction?: "fini" | "en-cours" | "echec"; lectureImage?: boolean } = {}): { p: PortsRegardTableau; c: Compteurs } {
  const c: Compteurs = { extractions: 0, appels: 0, entrees: [], memo: new Map() };
  const p: PortsRegardTableau = {
    lireMemo: async (cle) => c.memo.get(cle) ?? null,
    ecrireMemo: async (cle, texte) => { c.memo.set(cle, texte); },
    extraire: async (d) => {
      c.extractions++;
      const e = opts.extraction ?? "fini";
      if (e === "en-cours") return { statut: "en-cours" };
      if (e === "echec") throw new Error("aligneur en panne");
      return { statut: "fini", images: d.instants.map((i) => ({ nom: i.nom, cle: d.cles[i.nom]! })) };
    },
    lireImage: async () => (opts.lectureImage === false ? null : { octets: new Uint8Array([0xff, 0xd8, 1, 2, 3]), type: "image/jpeg" }),
    appeler: async (entree) => {
      c.appels++;
      c.entrees.push(entree);
      if (opts.ok === false) return { ok: false };
      if (opts.simule) return { ok: true, simule: true };
      return { ok: true, simule: false, donnees: (opts.lecture ?? (() => ({ images: [] })))(entree) };
    },
  };
  return { p, c };
}

/** Lecture qui recopie les textes écrits de la page de chaque image ; `extra` ajoute un texte non écrit sur une page. */
const instants = instantsTableau(fiche, VIDEO.dureeSec);
const fidele = (extra: Record<string, string> = {}) => (): LectureRegard => ({
  images: instants.map((i) => {
    const n = /^page-(\d+)$/.exec(i.partieId ?? "")?.[1];
    const textes = n ? ecrits(Number(n)) : [];
    if (n && extra[n]) textes.push(extra[n]);
    return { nom: i.nom, textes: textes.map((texte) => ({ texte, coupe: false, horsCadre: false })), sousTitre: null, pageVide: false, noire: false, illisible: false };
  }),
});
const dep = { videoId: "v-1", env: "dev" };

describe("relecteurTableau (S-10-v19b)", () => {
  it("a) lecture fidèle : aucune remarque, 1 extraction, 1 appel", async () => {
    const { p, c } = ports({ lecture: fidele() });
    const r = await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
    expect(r.remarques).toEqual([]);
    expect(r.imagesLues).toBe(instants.length);
    expect(c.extractions).toBe(1);
    expect(c.appels).toBe(1);
  });

  it("b) un texte non écrit en page 2 : une remarque qui cite « page 2 »", async () => {
    const { p } = ports({ lecture: fidele({ "2": "Gagnez du temps chaque jour avec nous" }) });
    const r = await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
    expect(r.remarques).toHaveLength(1);
    expect(r.remarques[0]!.raison).toContain("page 2");
  });

  it("c) mémo : 2e appel identique, 0 appel Claude, même résultat", async () => {
    const { p, c } = ports({ lecture: fidele({ "2": "Phrase étrangère visible" }) });
    const relire = relecteurTableau(dep, p);
    const r1 = await relire(fiche, MISE, VIDEO);
    const r2 = await relire(fiche, MISE, VIDEO);
    expect(c.appels).toBe(1);
    expect(c.extractions).toBe(1);
    expect(r2).toEqual(r1);
    expect([...c.memo.keys()][0]).toMatch(/^studio\/dev\/tableau\/v-1\/regard\/[0-9a-f]{16}\.json$/);
  });

  it("c bis) mémo rangé avant de rendre ; mémo illisible = relu et repayé, jamais une panne", async () => {
    const { p, c } = ports({ lecture: fidele() });
    await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
    expect(c.memo.size).toBe(1);
    c.memo.set([...c.memo.keys()][0]!, "pas du json");
    const r = await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
    expect(r.remarques).toEqual([]);
    expect(c.appels).toBe(2);
  });

  it("d) simulation ou refus : remarque « non relue », jamais une liste vide ; rien n'est rangé", async () => {
    for (const o of [{ simule: true }, { ok: false }]) {
      const { p, c } = ports(o);
      const r = await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
      expect(r.remarques.length).toBeGreaterThan(0);
      expect(r.remarques[0]!.raison).toContain("non relue");
      expect(r.imagesLues).toBe(0);
      expect(c.memo.size).toBe(0);
    }
  });

  it("e) extraction en file : attente demandée une fois, 0 appel Claude ; sans attente, « images non relues »", async () => {
    let attentes = 0;
    const a = ports({ extraction: "en-cours" });
    const r = await relecteurTableau(dep, a.p)(fiche, MISE, { ...VIDEO, attendre: async () => { attentes++; } });
    expect(attentes).toBe(1);
    expect(a.c.appels).toBe(0);
    expect(r.remarques[0]!.raison).toContain("images non relues");
    const b = ports({ extraction: "en-cours" });
    const r2 = await relecteurTableau(dep, b.p)(fiche, MISE, VIDEO);
    expect(r2.remarques[0]!.raison).toContain("images non relues");
    expect(b.c.appels).toBe(0);
  });

  it("e bis) extraction en échec, image illisible ou attente qui plante : une remarque, jamais d'exception", async () => {
    const a = ports({ extraction: "echec" });
    const r = await relecteurTableau(dep, a.p)(fiche, MISE, VIDEO);
    expect(r.imagesLues).toBe(0);
    expect(r.remarques[0]!.raison).toContain("l'extraction n'a pas abouti");
    expect(a.c.appels).toBe(0);
    const b = ports({ lectureImage: false });
    const r2 = await relecteurTableau(dep, b.p)(fiche, MISE, VIDEO);
    expect(r2.remarques[0]!.raison).toContain("l'extraction n'a pas abouti");
    expect(b.c.appels).toBe(0);
    const c = ports({ extraction: "en-cours" });
    const r3 = await relecteurTableau(dep, c.p)(fiche, MISE, { ...VIDEO, attendre: async () => { throw new Error("boum"); } });
    expect(r3.remarques.length).toBeGreaterThan(0);
  });

  it("e ter) panne de Claude ou de stockage : « non relue », jamais « rien à signaler »", async () => {
    const a = ports();
    a.p.appeler = async () => { throw new Error("réseau"); };
    const r = await relecteurTableau(dep, a.p)(fiche, MISE, VIDEO);
    expect(r.remarques.length).toBeGreaterThan(0);
    const b = ports({ lecture: fidele() });
    b.p.lireMemo = async () => { throw new Error("stockage"); };
    b.p.ecrireMemo = async () => { throw new Error("stockage"); };
    const r2 = await relecteurTableau(dep, b.p)(fiche, MISE, VIDEO);
    expect(r2.remarques).toEqual([]);
  });

  it("f) rien de ce qui part vers Claude ne contient la clé de la vidéo ni un nom de fichier", async () => {
    const { p, c } = ports({ lecture: fidele() });
    await relecteurTableau(dep, p)(fiche, MISE, VIDEO);
    const texte = JSON.stringify(c.entrees);
    expect(texte).not.toContain(VIDEO.cle);
    expect(texte).not.toContain("sortie-secrete");
    expect(texte).not.toMatch(/\.(mp4|jpe?g|png)/i);
    expect(texte).not.toContain("studio/");
  });

  it("g) éteint = identique : aucun réglage lu, aucun appelant en production, rien chargé à l'import", () => {
    const src = readFileSync(new URL("../../../src/services/regardeur-tableau.ts", import.meta.url), "utf8");
    expect(src).not.toContain("lireParametre");
    expect(src).not.toContain("regardeur.tableau");
    expect(src).not.toMatch(/^import .*from "(\.\/depense-claude-video|\.\/image-video|@\/fournisseurs[^"]*)"/m);
    const racine = new URL("../../../src", import.meta.url).pathname;
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    const appelants = fichiers.filter((f) => !f.endsWith("services/regardeur-tableau.ts") && /regardeur-tableau"/.test(readFileSync(f, "utf8")) && /services\/regardeur-tableau"|\.\/regardeur-tableau"/.test(readFileSync(f, "utf8")));
    // S-10-BRANCHER-v20l (25/11, seconde lecture du pilote) : un seul appelant, le réglage du regard (liste fermée EXACTE).
    expect(appelants.map((f) => f.slice(racine.length + 1))).toEqual(["services/regard-tableau-reglage.ts"]);
    for (const f of ["moteurs/montage-tableau/fabriquer.ts", "moteurs/montage-tableau/controles.ts", "services/tableau-branchements.ts"]) {
      expect(readFileSync(join(racine, f), "utf8")).not.toContain("regardeur-tableau\"");
    }
  });
});
