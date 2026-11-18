/**
 * T-EXT-49 · Bibliothèque d'écrans d'outils neutres et vivants : contrôle de charte, états, données, textes (0 €, aucun navigateur).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/ecrans-outils");
const lire = (nom: string) => readFileSync(join(DOSSIER, nom), "utf8");
const FICHIERS = ["index.html", "styles.css", "etats.js", "app.js", "demo-data.js"];
const noms = JSON.parse(lire("noms.json")) as NomsNeutres & { maquettes: Record<string, { vues?: Record<string, string> }> };

type Etats = { vues: Record<string, { nom: string; etats: string[] }>; etapesMax: number; etatPermis: (v: string, e: string) => boolean };
type Donnees = { etapes: { id: string; vue: string; etat: string }[]; contenus: Record<string, unknown> };

function evaluer(fichier: string): Record<string, unknown> {
  const fenetre: Record<string, unknown> = {};
  runInNewContext(lire(fichier), { window: fenetre });
  return fenetre;
}
const ETATS = evaluer("etats.js").ETATS_ECRANS as Etats;
const DONNEES = evaluer("demo-data.js").DONNEES_ECRANS as Donnees;
const app = lire("app.js");
const donneesTexte = lire("demo-data.js");

describe("charte (T-EXT-04)", () => {
  it("controlerMaquette : ok sur les 5 fichiers", () => {
    const r = controlerMaquette(
      FICHIERS.map((chemin) => ({ chemin, contenu: lire(chemin) })),
      noms,
      "ecrans-outils",
    );
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("noms.json : 5 vues, noms identiques à etats.js, organisation neutre, verifieLe présent", () => {
    expect(noms.verifieLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(noms.maquettes["ecrans-outils"].organisation).toBe("Entreprise exemple");
    const vues = noms.maquettes["ecrans-outils"].vues ?? {};
    expect(Object.keys(vues).sort()).toEqual(Object.keys(ETATS.vues).sort());
    for (const [id, nom] of Object.entries(vues)) expect(ETATS.vues[id].nom).toBe(nom);
  });
});

describe("états et étapes", () => {
  it("5 vues avec les états de la fiche", () => {
    expect(Object.keys(ETATS.vues)).toEqual(["boite", "agenda", "tableur", "crm", "messagerie"]);
    expect(ETATS.vues.boite.etats).toEqual(["avant", "liste", "nouveau", "ouvert", "etiquete", "brouillon"]);
    expect(ETATS.etatPermis("crm", "fiche-remplie")).toBe(true);
    expect(ETATS.etatPermis("crm", "avant")).toBe(false);
    expect(ETATS.etatPermis("inconnue", "avant")).toBe(false);
  });
  it("chaque étape nomme une vue et un état connus ; 9 au plus ; ids uniques, minuscules, sans accent", () => {
    expect(DONNEES.etapes.length).toBeGreaterThan(0);
    expect(DONNEES.etapes.length).toBeLessThanOrEqual(9);
    const ids = DONNEES.etapes.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of DONNEES.etapes) {
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(ETATS.etatPermis(e.vue, e.etat), e.id).toBe(true);
    }
  });
  it("l'histoire par défaut passe par les 5 vues", () => {
    expect(new Set(DONNEES.etapes.map((e) => e.vue)).size).toBe(5);
  });
});

describe("app.js", () => {
  it("déterministe, sans réseau ni image fixe", () => {
    for (const interdit of ["Date.now", "Math.random", "fetch", "XMLHttpRequest", "<img", "setTimeout", "setInterval"]) {
      expect(app, interdit).not.toContain(interdit);
    }
  });
  it("ne contient aucune chaîne de l'histoire par défaut", () => {
    const chaines: string[] = [];
    const parcourir = (v: unknown) => {
      if (typeof v === "string") chaines.push(v);
      else if (Array.isArray(v)) v.forEach(parcourir);
      else if (v && typeof v === "object") Object.values(v).forEach(parcourir);
    };
    parcourir(DONNEES.contenus);
    expect(chaines.length).toBeGreaterThan(20);
    for (const c of chaines) if (c.length > 3) expect(app, c).not.toContain(c);
  });
  it("etats.js ne lit pas le document", () => {
    expect(lire("etats.js")).not.toMatch(/\bdocument\b/);
  });
});

describe("demo-data.js", () => {
  it("toutes les adresses sont en @exemple.invalid", () => {
    const adresses = donneesTexte.match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(adresses.length).toBeGreaterThan(0);
    for (const a of adresses) expect(a.endsWith("@exemple.invalid"), a).toBe(true);
  });
  it("chaque élément de contenu porte exemple: true", () => {
    let objets = 0;
    const parcourir = (v: unknown, chemin: string) => {
      if (Array.isArray(v)) v.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
      else if (v && typeof v === "object") {
        objets++;
        expect((v as { exemple?: boolean }).exemple, chemin).toBe(true);
        for (const [k, x] of Object.entries(v)) parcourir(x, `${chemin}.${k}`);
      }
    };
    for (const [k, v] of Object.entries(DONNEES.contenus)) parcourir(v, k);
    expect(objets).toBeGreaterThan(20);
  });
  it("aucun montant : ni €, ni EUR, ni euro", () => {
    expect(donneesTexte).not.toMatch(/€|\bEUR\b|euro/i);
  });
  it("le bandeau de démonstration dit « exemple »", () => {
    expect(lire("index.html")).toMatch(/class="mention-demo">[^<]*exemple/);
  });
});

describe("LISEZMOI.md", () => {
  const lisezmoi = lire("LISEZMOI.md");
  it("liste toutes les vues et tous les états", () => {
    for (const [vue, { nom, etats }] of Object.entries(ETATS.vues)) {
      expect(lisezmoi, vue).toContain("`" + vue + "`");
      expect(lisezmoi, nom).toContain(nom);
      for (const e of etats) expect(lisezmoi, e).toContain("`" + e + "`");
    }
  });
  it("liste tous les libellés d'interface de app.js", () => {
    const bloc = app.match(/var LIBELLES = \{([\s\S]*?)\n  \};/);
    expect(bloc).not.toBeNull();
    const libelles = [...bloc![1].matchAll(/^\s*\w+:\s*"([^"]+)",?$/gm)].map((m) => m[1]);
    expect(libelles.length).toBe(16);
    for (const l of libelles) expect(lisezmoi, l).toContain(l);
  });
});
