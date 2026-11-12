/**
 * CAL-03 · dans l'aperçu : une vidéo se lit, un carrousel se feuillette, une infographie s'agrandit. Le type se lit par
 * une icône ET un libellé. Un PDF de 10 pages donne une image par page, rendue à l'import (CAL-25).
 * Sans DOM : composants appelés comme des fonctions (mini-moteur de crochets). Aucun appel réel.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("./aides/crochets-factices")).crochets }));
const { monter, trouver, texteDe, attendre } = await import("./aides/crochets-factices");
const { ApercuMedia } = await import("@/components/calendrier/ApercuMedia");
const { Icone } = await import("@/components/ui/Icone");
const { TYPES_CONTENU } = await import("@/components/calendrier/CarteEntreeCalendrier");
const { rendrePagesPdf, clePagePdf, LIMITE_PAGES } = await import("@/services/pdf-pages");

const PAGES = Array.from({ length: 10 }, (_, i) => `https://stockage.exemple/pages/p${i + 1}.png`);
const clic = (m: ReturnType<typeof monter>, nom: RegExp) => {
  const b = trouver(m.rendre(), (e) => e.type === "button" && nom.test(String(e.props["aria-label"] ?? texteDe(e.props.children as never))))[0];
  if (!b) throw new Error(`bouton introuvable : ${nom}`);
  (b.props.onClick as () => void)();
};
const images = (m: ReturnType<typeof monter>) => trouver(m.rendre(), (e) => e.type === "img");

describe("type distinct : icône et libellé", () => {
  it.each([
    ["video", "Vidéo"],
    ["carrousel", "Carrousel"],
    ["infographie", "Infographie"],
  ] as const)("%s : libellé « %s » et icône, pas seulement une couleur", (type, libelle) => {
    const m = monter(ApercuMedia, { type, url: "https://stockage.exemple/x", pages: PAGES });
    expect(texteDe(m.rendre())).toContain(libelle);
    const icones = trouver(m.rendre(), (e) => e.type === Icone);
    expect(icones.length).toBeGreaterThan(0);
    expect(icones[0]!.props.nom).toBe(TYPES_CONTENU[type].icone);
  });
  it("les trois types ont des icônes différentes", () => {
    const noms = new Set(["video", "carrousel", "infographie"].map((t) => TYPES_CONTENU[t as "video"].icone));
    expect(noms.size).toBe(3);
  });
});

describe("vidéo : se lit", () => {
  it("lecteur avec commandes et son (non muet), affiche en poster", () => {
    const m = monter(ApercuMedia, { type: "video" as const, url: "https://stockage.exemple/v.mp4", poster: "https://stockage.exemple/v.jpg" });
    const v = trouver(m.rendre(), (e) => e.type === "video")[0]!;
    expect(v.props.controls).toBe(true);
    expect(v.props.muted).not.toBe(true);
    expect(v.props.src).toBe("https://stockage.exemple/v.mp4");
    expect(v.props.poster).toBe("https://stockage.exemple/v.jpg");
    expect(v.props.preload).toBe("metadata");
  });
  it("sans lien de lecture : phrase claire, rien ne casse", () => {
    const m = monter(ApercuMedia, { type: "video" as const });
    expect(texteDe(m.rendre())).toMatch(/pas encore disponible/);
    expect(trouver(m.rendre(), (e) => e.type === "video")).toHaveLength(0);
  });
});

describe("carrousel : se feuillette", () => {
  it("une seule page chargée à la fois, position lue, boutons précédente/suivante", () => {
    const m = monter(ApercuMedia, { type: "carrousel" as const, pages: PAGES });
    expect(images(m)).toHaveLength(1);
    expect(images(m)[0]!.props.src).toBe(PAGES[0]);
    expect(texteDe(m.rendre())).toMatch(/Page 1 sur 10/);
    clic(m, /suivante/i);
    expect(images(m)[0]!.props.src).toBe(PAGES[1]);
    expect(texteDe(m.rendre())).toMatch(/Page 2 sur 10/);
    clic(m, /précédente/i);
    clic(m, /précédente/i); // borne : reste sur la première
    expect(images(m)[0]!.props.src).toBe(PAGES[0]);
  });
  it("la dernière page est une borne ; les flèches du clavier feuillettent aussi", () => {
    const m = monter(ApercuMedia, { type: "carrousel" as const, pages: PAGES });
    const zone = () => trouver(m.rendre(), (e) => typeof e.props.onKeyDown === "function")[0]!;
    for (let i = 0; i < 12; i++) (zone().props.onKeyDown as (e: unknown) => void)({ key: "ArrowRight", preventDefault: () => undefined });
    expect(images(m)[0]!.props.src).toBe(PAGES[9]);
    (zone().props.onKeyDown as (e: unknown) => void)({ key: "ArrowLeft", preventDefault: () => undefined });
    expect(images(m)[0]!.props.src).toBe(PAGES[8]);
  });
  it("chaque image a un texte alternatif en français", () => {
    const m = monter(ApercuMedia, { type: "carrousel" as const, pages: PAGES });
    expect(String(images(m)[0]!.props.alt)).toMatch(/page 1 sur 10/i);
  });
  it("sans page rendue : phrase claire", () => {
    const m = monter(ApercuMedia, { type: "carrousel" as const, pages: [] });
    expect(texteDe(m.rendre())).toMatch(/pages ne sont pas encore prêtes/);
  });
});

describe("infographie : s'agrandit", () => {
  it("un bouton « Agrandir » ouvre la taille réelle ; Échap ou « Fermer » referme", () => {
    const m = monter(ApercuMedia, { type: "infographie" as const, url: "https://stockage.exemple/i.png" });
    expect(trouver(m.rendre(), (e) => e.props.role === "dialog")).toHaveLength(0);
    clic(m, /agrandir/i);
    const dlg = trouver(m.rendre(), (e) => e.props.role === "dialog")[0]!;
    expect(dlg.props["aria-modal"]).toBe(true);
    expect(trouver(m.rendre(), (e) => e.type === "img").some((i) => i.props.src === "https://stockage.exemple/i.png")).toBe(true);
    (dlg.props.onKeyDown as (e: unknown) => void)({ key: "Escape", preventDefault: () => undefined });
    expect(trouver(m.rendre(), (e) => e.props.role === "dialog")).toHaveLength(0);
    clic(m, /agrandir/i);
    clic(m, /fermer/i);
    expect(trouver(m.rendre(), (e) => e.props.role === "dialog")).toHaveLength(0);
  });
});

describe("infographie : fenêtre accessible au clavier", () => {
  const ouvrir = () => {
    const m = monter(ApercuMedia, { type: "infographie" as const, url: "https://stockage.exemple/i.png" });
    const agrandir = trouver(m.rendre(), (e) => e.type === "button" && /agrandir/i.test(texteDe(e.props.children as never)))[0]!;
    const declencheur = (agrandir.props as { ref: { current: unknown } }).ref;
    const focusDeclencheur = vi.fn();
    declencheur.current = { focus: focusDeclencheur };
    clic(m, /agrandir/i);
    return { m, focusDeclencheur };
  };
  const fermer = (m: ReturnType<typeof monter>) => trouver(m.rendre(), (e) => e.type === "button" && /fermer/i.test(texteDe(e.props.children as never)))[0]!;

  it("à l'ouverture, le focus entre dans la fenêtre (sur « Fermer »)", () => {
    const { m } = ouvrir();
    const focus = vi.fn();
    (fermer(m).props as { ref: (el: unknown) => void }).ref({ focus });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("Échap ferme et le focus revient au bouton déclencheur ; « Fermer » aussi", () => {
    const a = ouvrir();
    const dlg = trouver(a.m.rendre(), (e) => e.props.role === "dialog")[0]!;
    (dlg.props.onKeyDown as (e: unknown) => void)({ key: "Escape", preventDefault: () => undefined });
    expect(trouver(a.m.rendre(), (e) => e.props.role === "dialog")).toHaveLength(0);
    expect(a.focusDeclencheur).toHaveBeenCalledTimes(1);

    const b = ouvrir();
    (fermer(b.m).props.onClick as () => void)();
    expect(b.focusDeclencheur).toHaveBeenCalledTimes(1);
  });

  it("la touche Tab ne fait pas sortir le focus de la fenêtre", () => {
    const { m } = ouvrir();
    const dlg = trouver(m.rendre(), (e) => e.props.role === "dialog")[0]!;
    const preventDefault = vi.fn();
    (dlg.props.onKeyDown as (e: unknown) => void)({ key: "Tab", preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(trouver(m.rendre(), (e) => e.props.role === "dialog")).toHaveLength(1);
  });

  it("tous les boutons font au moins 44 px de haut et de large", () => {
    const { m } = ouvrir();
    const boutons = [...trouver(m.rendre(), (e) => e.type === "button"), ...trouver(monter(ApercuMedia, { type: "carrousel" as const, pages: PAGES }).rendre(), (e) => e.type === "button")];
    expect(boutons.length).toBeGreaterThanOrEqual(3);
    for (const b of boutons) expect(String(b.props.className)).toMatch(/min-h-\[44px\][^"]*min-w-\[44px\]/);
  });
});

describe("règles de la maison", () => {
  it("vouvoiement, aucun prix affiché", () => {
    for (const type of ["video", "carrousel", "infographie"] as const) {
      const t = texteDe(monter(ApercuMedia, { type, pages: PAGES, url: "https://stockage.exemple/x" }).rendre());
      expect(t).not.toMatch(/€|\$|euros?\b/i);
      expect(t).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
    }
  });
});

const PDF = new TextEncoder().encode("%PDF-1.7 corps fictif");
describe("service pdf-pages : une image par page, à l'import", () => {
  const fabrique = (pages: number, echecs: number[] = []) => {
    const stockees = new Map<string, Uint8Array>();
    return {
      stockees,
      deps: {
        compterPages: async () => pages,
        rendrePage: async (_o: Uint8Array, n: number) => {
          if (echecs.includes(n)) throw new Error("page illisible");
          return new Uint8Array([137, 80, 78, 71, n]);
        },
        stocker: async (cle: string, o: Uint8Array) => void stockees.set(cle, o),
      },
    };
  };

  it("un PDF de 10 pages donne 10 images, rangées dans l'ordre, une clé par page", async () => {
    const { deps, stockees } = fabrique(10);
    const r = await rendrePagesPdf("media-1", PDF, deps);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(10);
    expect(r.pages.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.pages.map((p) => p.cle)).toEqual(Array.from({ length: 10 }, (_, i) => clePagePdf("media-1", i + 1)));
    expect(stockees.size).toBe(10);
    expect(r.manquantes).toEqual([]);
  });

  it("une page illisible ne bloque pas les autres (signalée en français)", async () => {
    const { deps } = fabrique(4, [3]);
    const r = await rendrePagesPdf("media-2", PDF, deps);
    expect(r.ok && r.pages.map((p) => p.numero)).toEqual([1, 2, 4]);
    expect(r.ok && r.manquantes).toEqual([3]);
    expect(r.ok && r.avis).toMatch(/page 3/);
  });

  it("un fichier qui n'est pas un PDF est refusé, sans rendu ; trop de pages : plafond", async () => {
    const f = fabrique(3);
    const rendre = vi.spyOn(f.deps, "rendrePage");
    const r = await rendrePagesPdf("media-3", new TextEncoder().encode("pas un pdf"), f.deps);
    expect(r.ok).toBe(false);
    expect(rendre).not.toHaveBeenCalled();
    const g = fabrique(LIMITE_PAGES + 15);
    const grand = await rendrePagesPdf("media-4", PDF, g.deps);
    expect(grand.ok && grand.pages).toHaveLength(LIMITE_PAGES);
    expect(grand.ok && grand.total).toBe(LIMITE_PAGES + 15);
  });

  it("une panne du comptage ou du stockage ne lève pas d'exception", async () => {
    const r = await rendrePagesPdf("media-5", PDF, { ...fabrique(2).deps, compterPages: async () => { throw new Error("x"); } });
    expect(r.ok).toBe(false);
    const s = await rendrePagesPdf("media-6", PDF, { ...fabrique(2).deps, stocker: async () => { throw new Error("x"); } });
    expect(s.ok).toBe(true);
    expect(s.ok && s.pages).toHaveLength(0);
    await attendre();
  });
});
