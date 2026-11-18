/**
 * T-EXT-04 · Charte commune des maquettes : valeurs de charte.css = PALETTE, noms neutres, contrôle de conformité.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/briques/charte/axion-2026";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/charte");
const css = readFileSync(join(DOSSIER, "charte.css"), "utf8");
const noms = JSON.parse(readFileSync(join(DOSSIER, "noms-neutres.json"), "utf8")) as NomsNeutres;

const DOSSIERS = ["01-courriels", "02-projets", "03-accueil-24h", "04-clients", "05-stocks", "06-equipe", "07-taches"];

const VARIABLES: Record<string, keyof typeof PALETTE> = {
  ivoire: "ivoire",
  gris: "gris",
  noir: "noir",
  terracotta: "terracotta",
  orange: "orange",
  "gris-sur-noir": "grisSurNoir",
  reussite: "reussite",
  blanc: "blanc",
  "texte-secondaire": "texteSecondaire",
  "erreur-filet": "erreurFilet",
};

const INDEX_OK = `<!doctype html><html><body><div class="mention-demo">Démonstration · données fictives</div><h1>Espace démo · Stocks</h1><script src="app.js"></script></body></html>`;
const APP_OK = `window.demoMaquette = { aller(etape) {}, reinitialiser() {} };`;

function maquette(extra: string, nom = "05-stocks") {
  return controlerMaquette(
    [
      { chemin: "index.html", contenu: INDEX_OK },
      { chemin: "app.js", contenu: APP_OK },
      { chemin: "style.css", contenu: extra },
    ],
    noms,
    nom,
  );
}
const regles = (extra: string) => maquette(extra).defauts.map((d) => d.regle);

describe("charte.css", () => {
  it("reprend exactement les valeurs de PALETTE", () => {
    for (const [variable, cle] of Object.entries(VARIABLES)) {
      const m = css.match(new RegExp(`--${variable}\\s*:\\s*(#[0-9A-Fa-f]{6})\\s*;`));
      expect(m, variable).not.toBeNull();
      expect(m![1].toUpperCase()).toBe(PALETTE[cle].toUpperCase());
    }
  });
  it("déclare Manrope, la mention de démonstration, sans dégradé ni ombre", () => {
    expect(css).toContain("@font-face");
    expect(css).toContain("manrope-latin.woff2");
    expect(css).toContain(".mention-demo");
    expect(css).not.toMatch(/gradient|box-shadow|text-shadow|blur/i);
  });
  it("passe elle-même le contrôle", () => {
    const r = controlerMaquette(
      [
        { chemin: "index.html", contenu: INDEX_OK },
        { chemin: "app.js", contenu: APP_OK },
        { chemin: "charte.css", contenu: css },
      ],
      noms,
      "05-stocks",
    );
    expect(r.defauts).toEqual([]);
  });
});

describe("noms-neutres.json", () => {
  it("couvre exactement les 7 dossiers", () => {
    expect(Object.keys(noms.maquettes).sort()).toEqual([...DOSSIERS].sort());
  });
  it("noms descriptifs, organisation générique, pack 07 = Connaissances", () => {
    for (const m of Object.values(noms.maquettes)) {
      expect(m.produit).toMatch(/^Espace démo · .+/);
      expect(m.organisation).toBe("Entreprise exemple");
    }
    expect(noms.maquettes["07-taches"].produit).toBe("Espace démo · Connaissances");
  });
  it("liste interdite complète, aucun nom neutre n'en contient", () => {
    expect(noms.interdits).toEqual(["velora", "calyra", "sylva", "relayo", "noveria", "blueflow", "ordiva", "boreal", "maison alba", "feuille.", "orbis", "rivage"]);
    for (const m of Object.values(noms.maquettes)) {
      const texte = `${m.produit} ${m.organisation}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      for (const i of noms.interdits) expect(texte).not.toContain(i);
    }
  });
});

describe("controlerMaquette", () => {
  it("maquette conforme minimale : ok", () => {
    expect(maquette("body { font-family: Manrope, sans-serif; color: #141413; }")).toEqual({ ok: true, defauts: [] });
  });
  it("toutes les valeurs de PALETTE sont permises", () => {
    for (const v of Object.values(PALETTE)) {
      expect(regles(`a { color: ${v}; } b { color: ${v.toLowerCase()}; }`), v).toEqual([]);
    }
    expect(regles("a { color: #e8e6dc; }")).toEqual([]);
    expect(regles("a { color: #5E5D59; }")).toEqual([]);
  });
  it("bleu refusé", () => {
    expect(regles("a { color: #3773a3; }")).toContain("bleu");
    expect(regles("a { background: #25323c; }")).toContain("bleu");
    expect(regles("a { color: rgb(55, 115, 163); }")).toContain("bleu");
    expect(regles("a { color: hsl(210 60% 40%); }")).toContain("bleu");
    expect(regles("a { color: navy; }")).toContain("bleu");
  });
  it("couleurs nommées CSS : toute la table passe par la règle teinte/saturation", () => {
    for (const n of ["teal", "darkcyan", "lightcyan", "paleturquoise", "darkturquoise", "darkslateblue", "mediumslateblue", "slategray", "slategrey", "lightslategray", "darkslategray", "lavender", "ghostwhite", "cyan", "azure", "navy"]) {
      expect(regles(`a { color: ${n}; }`), n).toContain("bleu");
    }
    for (const n of ["beige", "cornsilk", "palegoldenrod", "lightgoldenrodyellow", "ivory", "gold", "khaki", "goldenrod"]) {
      expect(regles(`a { color: ${n.toUpperCase()}; }`), n).toContain("jaune");
    }
    expect(regles("a { color: indigo; }")).toEqual([]);
    expect(regles("a { color: red; background: white; border-color: black; }")).toEqual([]);
  });
  it("jaune refusé", () => {
    expect(regles("a { color: #f5d000; }")).toContain("jaune");
    expect(regles("a { color: hsl(55, 90%, 50%); }")).toContain("jaune");
  });
  it("dégradé refusé", () => {
    expect(regles("a { background: linear-gradient(#fff, #000); }")).toContain("degrade");
    expect(regles("a { background: radial-gradient(#fff, #000); }")).toContain("degrade");
  });
  it("police autre que Manrope refusée", () => {
    expect(regles("a { font-family: Inter, sans-serif; }")).toContain("police");
    expect(regles("a { font-family: Manrope, Arial; }")).toContain("police");
    expect(regles('a { font-family: "Manrope", monospace; }')).toEqual([]);
  });
  it("police : raccourci font, fontFamily et font.family en JS refusés", () => {
    expect(regles("a { font: 600 14px Inter, sans-serif; }")).toContain("police");
    expect(regles("a { font: italic 600 14px/1.4 Arial; }")).toContain("police");
    expect(regles("ctx.font = '14px Inter';")).toContain("police");
    expect(regles("el.style.fontFamily = 'Inter';")).toContain("police");
    expect(regles('el.style.fontFamily = "Inter, sans-serif";')).toContain("police");
    expect(regles("Chart.defaults.font.family = 'Inter';")).toContain("police");
    expect(regles("options = { font: { family: 'Inter', size: 12 } };")).toContain("police");
    expect(regles("a { font: 600 14px Manrope, sans-serif; }")).toEqual([]);
    expect(regles("a { font: inherit; }")).toEqual([]);
    expect(regles("el.style.fontFamily = 'Manrope';")).toEqual([]);
    expect(regles("Chart.defaults.font.family = \"Manrope\";")).toEqual([]);
    expect(regles("options = { font: { family: 'Manrope', size: 12 } };")).toEqual([]);
  });
  it("argent refusé", () => {
    expect(regles("x { content: \"12 500 €\"; }")).toContain("argent");
    expect(regles("new Intl.NumberFormat('fr-FR',{style:'currency'})")).toContain("argent");
    expect(regles("x { content: \"300 HT\"; }")).toContain("argent");
    expect(regles("x { content: \"20 euros\"; }")).toContain("argent");
  });
  it("marque refusée, sans casse ni accents ; nom neutre exigé", () => {
    expect(regles("/* BlueFlow */")).toContain("marque");
    expect(regles("/* Maison des Équipements BORÉAL */")).toContain("marque");
    const sans = controlerMaquette([{ chemin: "index.html", contenu: INDEX_OK.replace("Espace démo · Stocks", "Stocks") }, { chemin: "app.js", contenu: APP_OK }], noms, "05-stocks");
    expect(sans.ok).toBe(false);
    expect(sans.defauts.some((d) => d.regle === "marque" && d.extrait.includes("nom neutre absent"))).toBe(true);
  });
  it("marque : mot entier seulement (arrivage, Sylvain permis ; Rivage, Sylva refusés)", () => {
    expect(regles("/* arrivage du matin */")).toEqual([]);
    expect(regles("/* Sylvain Martin */")).toEqual([]);
    expect(regles("/* Rivage */")).toContain("marque");
    expect(regles("/* Maison Rivage, Sylva. */")).toContain("marque");
    expect(regles("/* ORDiVA */")).toContain("marque");
    expect(regles("/* une feuille de calcul */")).toEqual([]);
    expect(regles("/* feuille. */")).toContain("marque");
  });
  it("flou refusé", () => {
    expect(regles("a { filter:blur(7px); }")).toContain("flou");
    expect(regles('s = { filter: "blur(7px)" };')).toContain("flou");
    expect(regles('el.style.filter = "blur(7px)";')).toContain("flou");
    expect(regles("el.style.filter = 'blur(7px)';")).toContain("flou");
    expect(regles("a { backdrop-filter: blur(4px); }")).toContain("flou");
    expect(regles('<filter id="f"><feGaussianBlur stdDeviation="3"/></filter>')).toContain("flou");
    expect(regles("a { filter: none; }")).toEqual([]);
  });
  it("réseau refusé", () => {
    expect(regles("@import url(https://fonts.googleapis.com/css2?family=Manrope);")).toContain("reseau");
    expect(regles("a { background: url(//cdn.exemple/x.png); }")).toContain("reseau");
    const r = controlerMaquette([{ chemin: "index.html", contenu: INDEX_OK.replace("app.js", "https://cdn.exemple/app.js") }, { chemin: "app.js", contenu: APP_OK }], noms, "05-stocks");
    expect(r.defauts.map((d) => d.regle)).toContain("reseau");
    expect(regles('a { background: url("police.woff2"); }')).toEqual([]);
  });
  it("porte de pilotage et mention exigées", () => {
    const sansPorte = controlerMaquette([{ chemin: "index.html", contenu: INDEX_OK }, { chemin: "app.js", contenu: "window.demoMaquette = { aller() {} };" }], noms, "05-stocks");
    expect(sansPorte.defauts.map((d) => d.regle)).toContain("pilotage");
    const sansMention = controlerMaquette([{ chemin: "index.html", contenu: INDEX_OK.replace("mention-demo", "x") }, { chemin: "app.js", contenu: APP_OK }], noms, "05-stocks");
    expect(sansMention.defauts.map((d) => d.regle)).toContain("pilotage");
  });
  it("rapporte chemin, ligne et extrait", () => {
    const r = maquette("a { color: #000; }\nb { background: linear-gradient(red, blue); }");
    const d = r.defauts.find((x) => x.regle === "degrade")!;
    expect(d).toMatchObject({ chemin: "style.css", ligne: 2 });
    expect(d.extrait).toContain("linear-gradient");
  });
});
