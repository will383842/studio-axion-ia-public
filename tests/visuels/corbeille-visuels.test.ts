/** V3-C : corbeille de 30 jours des carrousels et vues. Horloge injectée ; la purge ne supprime que des DOCUMENTS. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DepotMemoire } from "@/donnees/memoire";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { StatutVisuel } from "@/domaine/visuels/statuts";
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import { ErreurVisuel, lancerRendu, valider, type DependancesCarrousels } from "@/visuels/services/carrousels";
import { mettreALaCorbeille, purgerCorbeilleVisuels, restaurer } from "@/visuels/services/corbeille";
import { ficheCarrousel, listerCarrousels } from "@/visuels/services/vues";

const JOUR = 86_400_000;
const DEPART = Date.parse("2026-10-19T10:00:00.000Z");
const SPEC = { version: "carrousel/1", alt: "Carrousel inventé", pages: [{ type: "T01", titre: "Titre inventé" }, { type: "T21" }] } as CarrouselSpecType;

function monter(allume = true) {
  const depot = new DepotMemoire<Visuel>();
  const suppressions = vi.spyOn(depot, "supprimer");
  const parametres = new Map<string, unknown>();
  const etat = { instant: DEPART };
  const rendre = vi.fn();
  const urlLecture = vi.fn(async (cle: string) => `https://stockage.invente/${cle}`);
  let chaine: Promise<unknown> = Promise.resolve();
  const deps = {
    depot,
    texte: vi.fn(),
    porte: vi.fn(),
    contextePorte: vi.fn(),
    allume: async () => allume,
    rendre,
    urlLecture,
    verrou: (f) => {
      const suite = chaine.then(f, f);
      chaine = suite.catch(() => undefined);
      return suite;
    },
    maintenant: () => new Date(etat.instant).toISOString(),
    lireParametre: async <T>(id: string, defaut: T) => (parametres.has(id) ? (parametres.get(id) as T) : defaut),
    ecrireParametre: async (id: string, v: unknown) => void parametres.set(id, v),
  } as DependancesCarrousels;
  return { deps, depot, etat, suppressions, parametres, rendre, urlLecture };
}
type Banc = ReturnType<typeof monter>;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ErreurVisuel ? e.code : `AUTRE:${String(e)}`;
  }
  return "AUCUNE";
};

async function poser(b: Banc, id: string, statut: StatutVisuel, extra: Partial<Visuel> = {}): Promise<string> {
  const t = new Date(b.etat.instant).toISOString();
  await b.depot.enregistrer({
    id, famille: "carrousel", titre: `Titre ${id}`, entree: { type: "sujet", sujet: "Un sujet inventé" }, statut, modeTexte: "simulation", spec: SPEC,
    pourquoi: [], versionSpec: 1, coutCentimes: 0, creeLe: t, modifieLe: t, ...extra,
  });
  return id;
}
const ilYa = (jours: number, b: Banc) => new Date(b.etat.instant - jours * JOUR).toISOString();

describe("mettreALaCorbeille / restaurer", () => {
  it("valide → corbeille → restaurer → valide", async () => {
    const b = monter();
    const id = await poser(b, "vis_a", "valide");
    expect(await mettreALaCorbeille([id], b.deps)).toEqual({ mises: 1 });
    expect(await b.depot.obtenir(id)).toMatchObject({ statut: "valide", statutAvantCorbeille: "valide", corbeilleLe: b.deps.maintenant() });
    b.etat.instant += 10 * JOUR;
    expect(await restaurer([id], b.deps)).toEqual({ restaurees: 1 });
    const v = (await b.depot.obtenir(id))!;
    expect(v.statut).toBe("valide");
    expect(v.corbeilleLe).toBeUndefined();
    expect(v.statutAvantCorbeille).toBeUndefined();
  });
  it("programmé ou publié : CORBEILLE_REFUSEE, rien ne change (même dans un lot)", async () => {
    const b = monter();
    const bon = await poser(b, "vis_bon", "valide");
    for (const s of ["programme", "publie"] as const) {
      const id = await poser(b, `vis_${s}`, s);
      expect(await code(mettreALaCorbeille([bon, id], b.deps))).toBe("CORBEILLE_REFUSEE");
      expect((await b.depot.obtenir(id))!.corbeilleLe).toBeUndefined();
    }
    expect((await b.depot.obtenir(bon))!.corbeilleLe).toBeUndefined();
  });
  it("rendu en cours : refusé avec « attendez la fin du rendu »", async () => {
    const b = monter();
    const id = await poser(b, "vis_r", "rendu_en_cours", { renduDemandeLe: b.deps.maintenant() });
    await expect(mettreALaCorbeille([id], b.deps)).rejects.toMatchObject({ code: "CORBEILLE_REFUSEE", message: expect.stringContaining("attendez la fin du rendu") });
  });
  it("rendu en cours vieux de 11 min : relancer_rendu proposé et corbeille permise", async () => {
    const b = monter();
    const id = await poser(b, "vis_p", "rendu_en_cours", { renduDemandeLe: new Date(b.etat.instant - 11 * 60_000).toISOString() });
    expect((await ficheCarrousel(id, b.deps)).actionsPermises.sort()).toEqual(["corbeille", "relancer_rendu"]);
    expect(await mettreALaCorbeille([id], b.deps)).toEqual({ mises: 1 });
    const sans = await poser(b, "vis_s", "rendu_en_cours");
    expect((await ficheCarrousel(sans, b.deps)).actionsPermises.sort()).toEqual(["corbeille", "relancer_rendu"]);
    const frais = await poser(b, "vis_f", "rendu_en_cours", { renduDemandeLe: b.deps.maintenant() });
    expect((await ficheCarrousel(frais, b.deps)).actionsPermises).toEqual([]);
  });
  it("introuvable ou déjà à la corbeille : ignoré, la date d'origine reste", async () => {
    const b = monter();
    const id = await poser(b, "vis_d", "ecrit", { corbeilleLe: ilYa(5, b), statutAvantCorbeille: "ecrit" });
    expect(await mettreALaCorbeille([id, "vis_absent"], b.deps)).toEqual({ mises: 0 });
    expect((await b.depot.obtenir(id))!.corbeilleLe).toBe(ilYa(5, b));
  });
  it("un visuel à la corbeille ne change plus de statut : TRANSITION_REFUSEE", async () => {
    const b = monter();
    const a = await poser(b, "vis_av", "a_valider");
    const e = await poser(b, "vis_ec", "ecrit");
    await mettreALaCorbeille([a, e], b.deps);
    expect(await code(valider(a, b.deps))).toBe("TRANSITION_REFUSEE");
    expect(await code(lancerRendu(e, b.deps))).toBe("TRANSITION_REFUSEE");
    expect(b.rendre).not.toHaveBeenCalled();
    expect((await b.depot.obtenir(a))!.statut).toBe("a_valider");
  });
  it("restaurer après 30 jours : refusé (le visuel reste à la corbeille)", async () => {
    const b = monter();
    const id = await poser(b, "vis_v", "valide", { corbeilleLe: ilYa(30, b), statutAvantCorbeille: "valide" });
    expect(await restaurer([id], b.deps)).toEqual({ restaurees: 0 });
    expect((await b.depot.obtenir(id))!.corbeilleLe).toBeTruthy();
    const j29 = await poser(b, "vis_29", "valide", { corbeilleLe: ilYa(29, b), statutAvantCorbeille: "valide" });
    expect(await restaurer([j29], b.deps)).toEqual({ restaurees: 1 });
  });
});

describe("purgerCorbeilleVisuels", () => {
  it("29 jours : gardé ; 30 jours : le DOCUMENT est supprimé, aucun autre effet", async () => {
    const b = monter();
    await poser(b, "vis_29", "valide", { corbeilleLe: ilYa(29, b), statutAvantCorbeille: "valide" });
    await poser(b, "vis_30", "valide", { corbeilleLe: ilYa(30, b), statutAvantCorbeille: "valide", rendu: { empreinte: "e", pdfCle: "k/c.pdf", vignetteCle: "k/v.jpg", pages: [], renduLe: ilYa(31, b) } });
    expect(await purgerCorbeilleVisuels(b.etat.instant, b.deps)).toMatchObject({ supprimes: 1 });
    expect(await b.depot.obtenir("vis_29")).not.toBeNull();
    expect(await b.depot.obtenir("vis_30")).toBeNull();
    expect(b.suppressions).toHaveBeenCalledTimes(1);
    expect(b.suppressions).toHaveBeenCalledWith("vis_30");
    expect(b.urlLecture).not.toHaveBeenCalled();
  });
  it("programme et publie ne sont jamais purgés, même avec une date échue", async () => {
    const b = monter();
    await poser(b, "vis_p", "programme", { corbeilleLe: ilYa(60, b), statutAvantCorbeille: "programme" });
    await poser(b, "vis_u", "publie", { corbeilleLe: ilYa(60, b) });
    await poser(b, "vis_h", "valide", { corbeilleLe: undefined });
    expect(await purgerCorbeilleVisuels(b.etat.instant, b.deps)).toMatchObject({ supprimes: 0 });
    expect(await b.depot.compter()).toBe(3);
  });
  it("au plus un passage par heure, paquets de 10", async () => {
    const b = monter();
    for (let i = 0; i < 15; i++) await poser(b, `vis_${String(i).padStart(2, "0")}`, "valide", { corbeilleLe: ilYa(31, b), statutAvantCorbeille: "valide" });
    expect(await purgerCorbeilleVisuels(b.etat.instant, b.deps)).toMatchObject({ supprimes: 10 });
    expect(b.parametres.get("corbeille-visuels.dernierPassage")).toBeTruthy();
    b.etat.instant += 59 * 60_000;
    expect(await purgerCorbeilleVisuels(b.etat.instant, b.deps)).toMatchObject({ supprimes: 0, saute: true });
    expect(await b.depot.compter()).toBe(5);
    b.etat.instant += 61_000;
    expect(await purgerCorbeilleVisuels(b.etat.instant, b.deps)).toMatchObject({ supprimes: 5 });
    expect(await b.depot.compter()).toBe(0);
  });
  it("dernierPassage lu et écrit dans un même verrou", async () => {
    const b = monter();
    let profondeur = 0;
    const verrou = b.deps.verrou;
    const dans: boolean[] = [];
    const deps = {
      ...b.deps,
      verrou: (f: () => Promise<unknown>) => verrou(async () => { profondeur++; try { return await f(); } finally { profondeur--; } }),
      lireParametre: async <T,>(id: string, d: T) => (dans.push(profondeur > 0), b.deps.lireParametre(id, d)),
      ecrireParametre: async (id: string, v: unknown) => (dans.push(profondeur > 0), b.deps.ecrireParametre(id, v)),
    } as DependancesCarrousels;
    await purgerCorbeilleVisuels(b.etat.instant, deps);
    expect(dans).toEqual([true, true]);
  });
  it("le module de corbeille ne touche aucun fichier de stockage", () => {
    const source = readFileSync("src/visuels/services/corbeille.ts", "utf8");
    expect(source).not.toMatch(/node:fs|unlink|rmSync|\.rm\(|supprimerFichier|stockage|urlLecture|@\/donnees|@\/fournisseurs|next\//);
  });
});

describe("vues", () => {
  async function garnir(b: Banc) {
    await poser(b, "vis_ecrit", "ecrit", { modifieLe: ilYa(3, b) });
    await poser(b, "vis_av", "a_valider", { modifieLe: ilYa(2, b), rapport: { version: "porte-carrousel/1", verdict: "orange", controles: [], corrections: [] }, rendu: { empreinte: "e", pdfCle: "k/c.pdf", vignetteCle: "k/v.jpg", pages: [{ index: 0, x1Cle: "k/1x1.jpg", x2Cle: "k/1x2.jpg" }, { index: 1, x1Cle: "k/2x1.jpg", x2Cle: "k/2x2.jpg" }], renduLe: ilYa(2, b) } });
    await poser(b, "vis_ok", "valide", { modifieLe: ilYa(1, b) });
    await poser(b, "vis_co", "valide", { corbeilleLe: ilYa(5, b), statutAvantCorbeille: "valide", modifieLe: ilYa(0, b) });
  }
  it("listerCarrousels : tous (sans corbeille), a_valider, valides, corbeille", async () => {
    const b = monter();
    await garnir(b);
    expect((await listerCarrousels("tous", b.deps)).map((c) => c.id)).toEqual(["vis_ok", "vis_av", "vis_ecrit"]);
    expect((await listerCarrousels("a_valider", b.deps)).map((c) => c.id)).toEqual(["vis_av"]);
    expect((await listerCarrousels("valides", b.deps)).map((c) => c.id)).toEqual(["vis_ok"]);
    const corbeille = await listerCarrousels("corbeille", b.deps);
    expect(corbeille.map((c) => c.id)).toEqual(["vis_co"]);
    expect(corbeille[0].joursRestantsCorbeille).toBe(25);
  });
  it("carte : libellé, verdict, nombre de pages, vignette par urlLecture", async () => {
    const b = monter();
    await garnir(b);
    const carte = (await listerCarrousels("a_valider", b.deps))[0];
    expect(carte).toMatchObject({ statut: "a_valider", libelleStatut: "À valider", verdict: "orange", nbPages: 2, vignetteUrl: "https://stockage.invente/k/v.jpg" });
    expect((await listerCarrousels("valides", b.deps))[0].vignetteUrl).toBeUndefined();
  });
  it("ficheCarrousel : pages, PDF, générateur, actionsPermises depuis TRANSITIONS", async () => {
    const b = monter();
    await garnir(b);
    const f = await ficheCarrousel("vis_av", b.deps);
    expect(f).toMatchObject({ pdfUrl: "https://stockage.invente/k/c.pdf", generateurAllume: true, modeTexte: "simulation" });
    expect(f.pages).toEqual([{ index: 0, type: "T01", urlX1: "https://stockage.invente/k/1x1.jpg" }, { index: 1, type: "T21", urlX1: "https://stockage.invente/k/2x1.jpg" }]);
    expect([...f.actionsPermises].sort()).toEqual(["corbeille", "refaire", "refuser", "valider"]);
    expect((await ficheCarrousel("vis_ecrit", b.deps)).actionsPermises.sort()).toEqual(["corbeille", "relancer_rendu"]);
    expect((await ficheCarrousel("vis_ok", b.deps)).actionsPermises).toEqual(["corbeille"]);
    expect((await ficheCarrousel("vis_co", b.deps)).actionsPermises).toEqual(["restaurer"]);
  });
  it("actionsPermises : pas de corbeille pour programme/publie/rendu_en_cours, pas de refaire pour une session", async () => {
    const b = monter();
    for (const s of ["programme", "publie", "rendu_en_cours"] as const) await poser(b, `vis_${s}`, s, { renduDemandeLe: b.deps.maintenant() });
    await poser(b, "vis_sess", "refuse", { entree: { type: "session" } });
    await poser(b, "vis_blq", "bloque");
    for (const s of ["programme", "publie", "rendu_en_cours"] as const) expect((await ficheCarrousel(`vis_${s}`, b.deps)).actionsPermises).toEqual([]);
    expect((await ficheCarrousel("vis_sess", b.deps)).actionsPermises).toEqual(["corbeille"]);
    expect((await ficheCarrousel("vis_blq", b.deps)).actionsPermises.sort()).toEqual(["corbeille", "refaire"]);
  });
  it("fiche : INTROUVABLE ; générateur éteint reflété", async () => {
    const b = monter(false);
    await poser(b, "vis_x", "ecrit");
    expect(await code(ficheCarrousel("vis_absent", b.deps))).toBe("INTROUVABLE");
    expect((await ficheCarrousel("vis_x", b.deps)).generateurAllume).toBe(false);
  });
});
