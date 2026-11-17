/** C9-36a — règles fixes « ce qui est dit → quel objet » : pures, sans modèle, aucun appelant. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { objetsDepuisMots } from "../../src/briques/plan-scenes-objets/regles";
import { OBJETS_PAR_VIDEO_MAX } from "../../src/briques/motion/petits-objets/contrat";

const PERMIS = ["objet-gros-chiffre", "objet-etape", "objet-cartes-coche", "objet-coche"];
/** Un mot toutes les 400 ms. */
const dire = (phrase: string, debut = 0) =>
  phrase.split(/\s+/).filter(Boolean).map((texte, i) => ({ texte, debutMs: debut + i * 400, finMs: debut + i * 400 + 350 }));
const ids = (p: { id: string }[]) => p.map((x) => x.id);

describe("C9-36a objetsDepuisMots", () => {
  it("permis absent, vide ou mots fous → [] (éteint)", () => {
    const m = dire("on a gagné 30 % de plus");
    expect(objetsDepuisMots(m)).toEqual([]);
    expect(objetsDepuisMots(m, {})).toEqual([]);
    expect(objetsDepuisMots(m, { permis: [] })).toEqual([]);
  });
  it("« on a gagné 30 % » → gros chiffre 30 avec %", () => {
    const r = objetsDepuisMots(dire("on a gagné 30 % ce mois"), { permis: PERMIS });
    expect(ids(r)).toEqual(["objet-gros-chiffre"]);
    expect(r[0]!.parametres).toEqual({ valeur: 30, unite: "%" });
  });
  it("nombre en lettres dit → gros chiffre", () => {
    const r = objetsDepuisMots(dire("on a gagné trente pour cent"), { permis: PERMIS });
    expect(r.every((x) => x.id === "objet-gros-chiffre")).toBe(true);
  });
  it("« deuxième étape » → étape 2 ; « étape 3 » → étape 3", () => {
    const a = objetsDepuisMots(dire("voici la deuxième étape du plan"), { permis: PERMIS });
    expect(ids(a)).toEqual(["objet-etape"]);
    expect((a[0]!.parametres as { n: number }).n).toBe(2);
    const b = objetsDepuisMots(dire("passons à l'étape 3 maintenant"), { permis: PERMIS });
    expect(ids(b)).toEqual(["objet-etape"]);
    expect((b[0]!.parametres as { n: number }).n).toBe(3);
  });
  it("« étape 2 sur 4 » → n=2, N=4 ; le 2 n'est pas aussi un gros chiffre", () => {
    const r = objetsDepuisMots(dire("c'est l'étape 2 sur 4 du plan"), { permis: PERMIS });
    expect(ids(r)).toEqual(["objet-etape"]);
    expect(r[0]!.parametres).toEqual({ n: 2, N: 4 });
  });
  it("« d'abord X, ensuite Y, enfin Z » → cartes [X, Y, Z]", () => {
    const r = objetsDepuisMots(dire("d'abord le devis, ensuite la facture, enfin le paiement."), { permis: PERMIS });
    expect(ids(r)).toEqual(["objet-cartes-coche"]);
    expect((r[0]!.parametres as { cartes: string[] }).cartes).toEqual(["le devis", "la facture", "le paiement"]);
  });
  it("énumération dont un élément dépasse 4 mots → rien", () => {
    const r = objetsDepuisMots(dire("d'abord on prépare tout le matériel nécessaire, ensuite Y, enfin Z."), { permis: PERMIS });
    expect(ids(r)).toEqual([]);
  });
  it("« c'est fait » / « validé » / « terminé » → coche", () => {
    for (const ph of ["voilà c'est fait", "le test est validé", "tout est terminé"]) {
      expect(ids(objetsDepuisMots(dire(ph), { permis: PERMIS }))).toEqual(["objet-coche"]);
    }
  });
  it("objet non permis → retiré", () => {
    expect(objetsDepuisMots(dire("voilà c'est fait"), { permis: ["objet-etape"] })).toEqual([]);
  });
  it("10 nombres dits → 4 objets au plus, sans chevauchement, ordonnés", () => {
    const m = dire("10 mots, 20 clients, 30 jours, 40 pages, 50 vues, 60 fois, 70 euros, 80 notes, 90 liens, 100 mails", 0);
    const r = objetsDepuisMots(m, { permis: PERMIS });
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(OBJETS_PAR_VIDEO_MAX);
    for (let i = 1; i < r.length; i++) expect(r[i]!.debutSec).toBeGreaterThanOrEqual(r[i - 1]!.finSec);
  });
  it("aucune valeur absente des mots", () => {
    const m = dire("on a gagné 30 % puis voilà c'est fait et d'abord le devis, ensuite la facture, enfin le paiement.");
    const dit = m.map((x) => x.texte).join(" ");
    const r = objetsDepuisMots(m, { permis: PERMIS });
    expect(r.length).toBeGreaterThan(0);
    for (const o of r) {
      const p = o.parametres as { valeur?: number; cartes?: string[] };
      if (p.valeur !== undefined) expect(dit).toContain(String(p.valeur));
      for (const c of p.cartes ?? []) expect(dit).toContain(c);
      expect(o.regle).not.toBe("");
      expect(o.finSec).toBeGreaterThan(o.debutSec);
    }
  });
  it("jamais d'exception sur des entrées folles", () => {
    const folles = [null, undefined, 42, "x", [null], [{}], [{ texte: 5, debutMs: "a", finMs: NaN }], [{ texte: "étape", debutMs: 0, finMs: 1 }], [{ texte: "d'abord", debutMs: 0, finMs: 1 }, { texte: "c'est", debutMs: 1, finMs: 2 }, { texte: "fait", debutMs: 2, finMs: 3 }]];
    for (const f of folles) expect(() => objetsDepuisMots(f as never, { permis: PERMIS })).not.toThrow();
    expect(() => objetsDepuisMots([] as never, { permis: null as never })).not.toThrow();
  });
  it("garde statique : rien de studio-rendu ni de briques/motion n'importe plan-scenes-objets", () => {
    const racines = [join(__dirname, "..", "..", "src"), join(__dirname, "..", "..", "studio-rendu")];
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.tsx?$/.test(n)) fichiers.push(p);
      }
    };
    racines.forEach(parcourir);
    const fautifs = fichiers.filter((f) => !f.includes("plan-scenes-objets") && /studio-rendu|briques[\\/]motion/.test(f) && readFileSync(f, "utf8").includes("plan-scenes-objets"));
    expect(fautifs).toEqual([]);
  });
});
