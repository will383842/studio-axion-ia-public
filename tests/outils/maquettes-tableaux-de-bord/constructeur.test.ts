/**
 * T-EXT-25a · Constructeur de maquette : description → 4 fichiers conformes à la charte, déterministes, sans réseau.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireDescriptionMaquette, type DescriptionMaquette } from "@/moteurs/montage-tutoriel-outil/description-maquette";
import { controlerMaquette, type NomsNeutres } from "../../../outils/maquettes-tableaux-de-bord/charte/controle";
import { construireMaquette, MENTION_ECRAN, NOMS_FICHIERS } from "../../../outils/maquettes-tableaux-de-bord/constructeur/construire";
import { DUREE_MAX_ANIMATION_MS, formatFrancais } from "../../../outils/maquettes-tableaux-de-bord/constructeur/construire";

const DOSSIER = join(process.cwd(), "outils/maquettes-tableaux-de-bord/charte");
const charteCss = readFileSync(join(DOSSIER, "charte.css"), "utf8");
const reel = JSON.parse(readFileSync(join(DOSSIER, "noms-neutres.json"), "utf8")) as NomsNeutres;
const noms: NomsNeutres = { ...reel, maquettes: { ...reel.maquettes, atelier: { produit: "Espace démo · Atelier", organisation: "Entreprise exemple" } } };

const brut = {
  version: "description-maquette.v1",
  nom: "Espace démo · Atelier",
  entreprise: "Entreprise exemple",
  metier: "Atelier",
  ecrans: [
    {
      id: "accueil",
      modele: "tableau-de-bord",
      titre: "Votre journée",
      zones: [
        { id: "resume", type: "kpi", libelle: "À traiter", donnees: [{ id: "a-traiter", libelle: "À traiter", valeur: 8, exemple: true, etat: "maintenant" }, { id: "avant-tri", libelle: "Avant le tri", valeur: "Tout à la main", etat: "avant" }] },
      ],
    },
    { id: "liste", modele: "boite-de-reception", titre: "Vos messages", zones: [{ id: "messages", type: "liste", libelle: "Messages", donnees: [{ id: "m-un", libelle: "Devis demandé", valeur: "Nouveau" }] }] },
  ],
  etats: { avant: "Avant : tout à la main", maintenant: "Maintenant : tout est prêt" },
};

function description(): DescriptionMaquette {
  const l = lireDescriptionMaquette(brut, { interdits: reel.interdits });
  if (!l.ok) throw new Error(l.erreurs.join(" | "));
  return l.description;
}
const ressources = { charteCss, ecrans: { "boite-de-reception": '<div class="boite">Boîte neutre</div>' } };

describe("construireMaquette", () => {
  const { fichiers } = construireMaquette(description(), ressources);

  it("rend les 4 fichiers, déclarés conformes par le contrôle de la charte", () => {
    expect(Object.keys(fichiers).sort()).toEqual([...NOMS_FICHIERS].sort());
    const r = controlerMaquette(NOMS_FICHIERS.map((chemin) => ({ chemin, contenu: fichiers[chemin] })), noms, "atelier");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("n'a ni adresse, ni script externe, ni fetch, ni bleu, ni couleur hors charte", () => {
    const tout = NOMS_FICHIERS.map((n) => fichiers[n]).join("\n").replace(charteCss, "");
    expect(tout).not.toMatch(/https?:/);
    expect(tout).not.toMatch(/<script[^>]*\ssrc=["']?(?:https?:)?\/\//);
    expect(tout).not.toMatch(/<script>/);
    expect(tout).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|import\(/);
    expect(tout).not.toMatch(/bleu|blue/i);
    const couleurs = (tout.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase());
    const charte = new Set((charteCss.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((c) => c.toUpperCase()));
    for (const c of couleurs) expect(charte.has(c), c).toBe(true);
  });

  it("expose demoMaquette.aller et reinitialiser, et la mention exemple sur chaque écran", () => {
    expect(fichiers["app.js"]).toMatch(/window\.demoMaquette\s*=/);
    expect(fichiers["app.js"]).toMatch(/aller:\s*function/);
    expect(fichiers["app.js"]).toMatch(/reinitialiser:\s*function/);
    const ecrans = fichiers["index.html"].match(/<article class="ecran"/g)?.length ?? 0;
    expect(ecrans).toBe(2);
    expect(fichiers["index.html"].split(`<p class="mention-ecran">${MENTION_ECRAN}</p>`).length - 1).toBe(ecrans);
    expect(fichiers["index.html"]).toContain(`class="mention-demo">${MENTION_ECRAN}`);
  });

  it("demo-data.js expose les données exemple et les états", () => {
    const fenetre: Record<string, unknown> = {};
    new Function("window", fichiers["demo-data.js"])(fenetre);
    const donnees = fenetre.donneesExemple as { premierEcran: string; ecrans: Record<string, true>; etats: Record<string, string> };
    expect(donnees.premierEcran).toBe("accueil");
    expect(Object.keys(donnees.ecrans)).toEqual(["accueil", "liste"]);
    expect(donnees.etats.avant).toContain("Avant");
  });

  it("échappe aussi les identifiants placés dans les attributs (défense en profondeur)", () => {
    const d = description();
    d.ecrans[0]!.id = 'a"onload="x';
    d.ecrans[0]!.zones[0]!.id = 'z"><i>';
    const { fichiers: f } = construireMaquette(d, ressources);
    expect(f["index.html"]).not.toContain('a"onload');
    expect(f["index.html"]).not.toContain("<i>");
  });

  it("échappe tout texte (jamais une balise dans le HTML)", () => {
    const d = description();
    d.ecrans[0]!.titre = 'A<b>"x"';
    const { fichiers: f } = construireMaquette(d, ressources);
    expect(f["index.html"]).toContain("A&lt;b&gt;&quot;x&quot;");
    expect(f["index.html"]).not.toContain("<b>");
  });

  it("est déterministe : même description, mêmes fichiers", () => {
    expect(construireMaquette(description(), ressources)).toEqual(construireMaquette(description(), ressources));
  });
});

/**
 * T-EXT-V2-03 · Option `vivant` : compteurs, barres, lignes, zone visée. Éteinte par défaut (seul `true` exact allume).
 * Aucun navigateur ici : le rendu image par image a été regardé à la main (voir la PR) ; ces tests gardent le texte produit.
 */
const empreinte = (f: Record<string, string>): string => createHash("sha256").update(NOMS_FICHIERS.map((n) => `${n}\n${f[n]}`).join("\u0000")).digest("hex");
/** Sortie de `construireMaquette(description(), ressources)` AVANT T-EXT-V2-03, relevée sur master (015a3b8). */
const EMPREINTE_AVANT_V2_03 = "90020aa15cf4d036455b7386d75617aa60f31e2b86959338cec5a180a15d9807";

function descriptionVivante(): DescriptionMaquette {
  const d = description();
  const zones = d.ecrans[0]!.zones;
  zones[0]!.donnees = [
    { id: "pretes-avant", libelle: "Commandes prêtes", valeur: 4, exemple: true, etat: "avant" },
    { id: "pretes-maintenant", libelle: "Commandes prêtes", valeur: 12, exemple: true, etat: "maintenant" },
    { id: "mois-avant", libelle: "Messages du mois", valeur: 1204, exemple: true, etat: "avant" },
    { id: "mois-maintenant", libelle: "Messages du mois", valeur: 98765.5, exemple: true, etat: "maintenant" },
    { id: "texte", libelle: "Suivi", valeur: "Tout à la main", etat: "avant" },
  ];
  zones.push(
    { id: "barres", type: "graphique", libelle: "Par jour", donnees: [{ id: "lundi", libelle: "Lundi", valeur: 5, exemple: true }, { id: "mardi", libelle: "Mardi", valeur: 12, exemple: true }, { id: "mercredi", libelle: "Mercredi", valeur: 8, exemple: true }] },
    { id: "lignes", type: "tableau", libelle: "À suivre", donnees: [1, 2, 3].map((i) => ({ id: `ligne-${i}`, libelle: `Dossier ${i}`, valeur: "Nouveau" })) },
  );
  return d;
}

describe("construireMaquette · option vivant (éteinte par défaut)", () => {
  it("sans option, avec {}, {vivant:false} ou une valeur autre que true : mêmes fichiers qu'avant, à l'octet", () => {
    const d = description();
    const base = construireMaquette(d, ressources).fichiers;
    expect(empreinte(base)).toBe(EMPREINTE_AVANT_V2_03);
    expect(construireMaquette(d, ressources, {}).fichiers).toEqual(base);
    expect(construireMaquette(d, ressources, { vivant: false }).fichiers).toEqual(base);
    expect(construireMaquette(d, ressources, { vivant: "true" as unknown as boolean }).fichiers).toEqual(base);
    expect(construireMaquette(d, ressources, { vivant: 1 as unknown as boolean }).fichiers).toEqual(base);
    expect(base["styles.css"]).not.toContain("@property");
  });

  const { fichiers } = construireMaquette(descriptionVivante(), ressources, { vivant: true });
  const sansCharte = NOMS_FICHIERS.map((n) => fichiers[n]).join("\n").replace(charteCss, "");

  it("vivant : conforme à la charte (noms neutres), mêmes 4 fichiers", () => {
    expect(Object.keys(fichiers).sort()).toEqual([...NOMS_FICHIERS].sort());
    const r = controlerMaquette(NOMS_FICHIERS.map((chemin) => ({ chemin, contenu: fichiers[chemin] })), noms, "atelier");
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("vivant : ni réseau, ni minuterie libre, ni eval, ni innerHTML, ni couleur hors charte, ni bleu, ni jaune, ni dégradé", () => {
    for (const interdit of ["http", "fetch(", "setInterval", "setTimeout", "requestAnimationFrame", "eval(", "new Function", "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "color-mix", "blue", "yellow", "bleu", "jaune", "gradient", "XMLHttpRequest", "WebSocket", "import("]) {
      expect(sansCharte.toLowerCase(), interdit).not.toContain(interdit.toLowerCase());
    }
    expect(sansCharte).not.toMatch(/<script>/);
    const charte = new Set((charteCss.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((c) => c.toUpperCase()));
    for (const c of sansCharte.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) expect(charte.has(c.toUpperCase()), c).toBe(true);
    expect(sansCharte).not.toMatch(/\b(?:rgba?|hsla?)\(/i);
  });

  it("chiffres : « Commandes prêtes » 4 puis 12 → une seule ligne data-de=4 data-a=12", () => {
    const html = fichiers["index.html"];
    expect(html.match(/data-de="4" data-a="12"/g)).toHaveLength(1);
    expect(html.match(/Commandes prêtes/g)).toHaveLength(1);
    expect(html).not.toContain("pretes-avant");
    expect(html.match(/<li[^>]*data-donnee="pretes-maintenant"[^>]*data-de="4" data-a="12"/g)).toHaveLength(1);
    expect(html).toContain('data-de="1204" data-a="98765.5" data-k="1" data-n-de="12040" data-n-a="987655"');
    // la valeur d'arrivée est lisible par un lecteur d'écran, en format français (espace fine, virgule)
    expect(html).toContain('aria-label="98 765,5"');
    expect(html).toContain('aria-label="12"');
    // le texte « avant » sans pendant reste une donnée à état, non fusionnée
    expect(html).toMatch(/data-donnee="texte" data-etat="avant"><span class="donnee-libelle">Suivi<\/span> <span class="donnee-valeur">Tout à la main<\/span>/);
  });

  it("chiffres : valeur décrite par @property --n et des compteurs CSS (pas de boucle JavaScript), via Web Animations", () => {
    const css = fichiers["styles.css"];
    expect(css).toContain('@property --n { syntax: "<integer>"; inherits: true; initial-value: 0; }');
    expect(css).toMatch(/counter\(d, chiffre\)/);
    expect(css).toMatch(/@counter-style espace-fine[^}]*202F/);
    const app = fichiers["app.js"];
    expect(app).toMatch(/\.animate\(/);
    expect(app).toContain('{ "--n": de }, { "--n": a }');
    expect(app).toContain("duration: 900");
    expect(() => new Function("window", "document", app)).not.toThrow();
  });

  it("graphique : 3 données → 3 barres, la plus grande à scaleX(1), libellé et valeur hors de la barre", () => {
    const html = fichiers["index.html"];
    const zone = /<section class="zone zone-graphique"[\s\S]*?<\/section>/.exec(html)![0];
    expect(zone.match(/class="barre"/g)).toHaveLength(3);
    expect(zone).toContain('style="transform: scaleX(1)"');
    expect(zone).toContain("scaleX(0.4167)");
    expect(zone).toContain("scaleX(0.6667)");
    for (const m of zone.matchAll(/<span class="barre"[^>]*><\/span>/g)) expect(m[0]).not.toMatch(/Lundi|Mardi|Mercredi|>\d/);
    expect(zone).toMatch(/<span class="donnee-libelle">Mardi<\/span> <span class="donnee-valeur">12<\/span>/);
    expect(fichiers["styles.css"]).toMatch(/\.barre \{[^}]*transform-origin: left center/);
  });

  it("tableau, liste, message : arrivée l'une après l'autre (250 ms, 60 ms) et douce (300 ms) ; fiche : rien", () => {
    const html = fichiers["index.html"];
    expect(html.match(/class="donnee ligne"/g)).toHaveLength(3);
    const app = fichiers["app.js"];
    expect(app).toContain("translateY(8px)");
    expect(app).toMatch(/duration: 250, delay: Math\.min\(i \* 60, 750\)/);
    expect(app).toMatch(/duration: 600, delay: Math\.min\(i \* 80, 400\)/);
    expect(app).toMatch(/\.zone-liste ul, \.zone-message ul/);
    expect(app).toMatch(/\{ opacity: 0 \}, \{ opacity: 1 \}\], \{ duration: 300/);
    expect(app).not.toContain("zone-fiche");
  });

  it("aucune animation ne dépasse 1 s, délai compris, même à 12 lignes ou 12 barres", () => {
    expect(DUREE_MAX_ANIMATION_MS).toBe(1000);
    const app = fichiers["app.js"];
    const regle = /duration: (\d+)(?:, delay: Math\.min\(i \* (\d+), (\d+)\))?/g;
    let n = 0;
    for (const m of app.matchAll(regle)) {
      n++;
      const duree = Number(m[1]);
      const plafondDelai = m[3] ? Number(m[3]) : 0;
      expect(duree + plafondDelai, m[0]).toBeLessThanOrEqual(DUREE_MAX_ANIMATION_MS);
    }
    expect(n).toBe(5);
  });

  it("zone visée : bord terracotta 3 px, fond plus clair, autres zones à 55 %, retour à 100 % à la suivante", () => {
    const css = fichiers["styles.css"];
    expect(css).toMatch(/\.zone\.actif \{ border-color: var\(--terracotta\); border-width: 3px; \}/);
    expect(css).toContain(".vivant .zone.actif { background: var(--blanc); }");
    expect(css).toContain(".vivant .zone { background: var(--ivoire); }");
    expect(css).toContain(".vivant .ecran.cible .zone:not(.actif) { opacity: 0.55; }");
    expect(fichiers["index.html"]).toContain('<body class="vivant">');
    const app = fichiers["app.js"];
    expect(app).toContain('ecran.classList.add("cible")');
    expect(app).toContain('e.classList.remove("cible")');
  });

  it("aller renvoie toujours vrai ou faux ; reinitialiser remet l'état « avant » et les valeurs de départ", () => {
    const app = fichiers["app.js"];
    expect(app).toMatch(/window\.demoMaquette\s*=/);
    expect(app).toMatch(/aller:\s*function/);
    expect(app).toMatch(/reinitialiser:\s*function/);
    expect(app.match(/return true;/g)).toHaveLength(3);
    expect(app).toContain("return false;");
    expect(app).toMatch(/reinitialiser: function \(\) \{\s*arreterAnimations\(\);[\s\S]*majEtat\("avant"\);\s*poserNombres\("data-n-de"\);\s*poserBarres\("data-r-de"\);/);
    expect(app).toContain("montrer(data.premierEcran, false)");
  });

  it("vivant : mêmes données dans demo-data.js, échappement conservé, déterministe", () => {
    const d = descriptionVivante();
    d.ecrans[0]!.zones[0]!.donnees[1]!.libelle = d.ecrans[0]!.zones[0]!.donnees[0]!.libelle = 'Prêtes <b>"x"</b>';
    const a = construireMaquette(d, ressources, { vivant: true });
    expect(a.fichiers["index.html"]).toContain("Prêtes &lt;b&gt;&quot;x&quot;&lt;/b&gt;");
    expect(a.fichiers["index.html"]).not.toContain("<b>");
    expect(a).toEqual(construireMaquette(d, ressources, { vivant: true }));
    expect(construireMaquette(descriptionVivante(), ressources, { vivant: true }).fichiers["demo-data.js"]).toBe(construireMaquette(descriptionVivante(), ressources).fichiers["demo-data.js"]);
  });

  it("pas de fusion sans pendant chiffré de même libellé (libellés différents, texte, un seul état)", () => {
    const d = description();
    d.ecrans[0]!.zones[0]!.donnees = [
      { id: "un", libelle: "Un", valeur: 3, exemple: true, etat: "avant" },
      { id: "deux", libelle: "Deux", valeur: 9, exemple: true, etat: "maintenant" },
      { id: "trois", libelle: "Trois", valeur: "Rien", etat: "avant" },
      { id: "trois-bis", libelle: "Trois", valeur: 7, exemple: true, etat: "maintenant" },
    ];
    const { fichiers: f } = construireMaquette(d, ressources, { vivant: true });
    expect(f["index.html"]).not.toContain("data-de=");
  });

  it("formatFrancais : espace fine pour les milliers, virgule, décimales de la valeur d'arrivée", () => {
    expect(formatFrancais(12, 0)).toBe("12");
    expect(formatFrancais(1204, 1)).toBe("1 204,0");
    expect(formatFrancais(1234567, 0)).toBe("1 234 567");
    expect(formatFrancais(98765.5, 1)).toBe("98 765,5");
    expect(formatFrancais(1000, 0)).toBe("1 000");
    expect(formatFrancais(999, 0)).toBe("999");
  });
});
