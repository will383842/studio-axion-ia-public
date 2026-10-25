/**
 * ESSAI RÉEL de la famille « donnees » (P3e) : chaque plaquette (D01, D02, D03) est posée seule au milieu d'une toile de 3 pages
 * (couverture d'essai X00, la plaquette, appel d'essai X02), en 4:5 et en 3:4, avec trois contenus : moyen (maquette), minimal et maximal
 * (budgets pleins, mots longs). Les mesures doivent être à 0 et le texte à 26 px au moins. La page du milieu est déposée dans
 * `essais-visuels/continu/p3e/<plaquette>-<contenu>-<format>.jpg`, avec `mesures.json`.
 * Usage (depuis `studio-rendu/`) : npx tsx scripts/essai-continu-donnees.ts
 * Navigateur : le Chrome Headless Shell de Remotion (`ensureBrowser`), ou `STUDIO_RENDU_NAVIGATEUR` s'il désigne ce même binaire.
 */
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits.js";
import { HAUTEURS, LARGEUR_PAGE, type FormatToile } from "../../src/domaine/visuels/continu/geometrie.js";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version.js";
import { creerToileContinue, rendreToileAvecRemotion } from "../src/operations/toile-continue.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
if (navigateur?.includes("pw-browsers")) throw new Error("Le Chromium de Playwright ne doit pas être utilisé pour ces essais.");
if (!navigateur) {
  const { ensureBrowser } = await import("@remotion/renderer");
  await ensureBrowser();
}

const OCTETS_JPEG_MAX = 400 * 1024;
const exemple = (type: string) => GABARITS.find((g) => g.type === type)!.exemple;

type Contenu = "moyen" | "minimal" | "maximal";
const CONTENUS: Record<string, Record<Contenu, Record<string, unknown>>> = {
  D01: {
    moyen: {},
    minimal: { numerateur: "1", denominateur: "2", legende: "des dirigeants hésitent.", source: "Source", date: "2025" },
    maximal: { numerateur: "9", denominateur: "9", legende: "dirigeants professionnalisent automatiquement leurs relances clients chaque semaine.", source: "Étude de professionnalisation automatiquement vérifiée", date: "septembre 2025, mise à jour" },
  },
  D02: {
    moyen: {},
    minimal: { citation: "Ça marche.", auteur: "Alex", fonction: "Gérante" },
    maximal: { citation: "La professionnalisation automatiquement mise en place nous fait gagner un temps précieux.", auteur: "Nom et prénom de la personne", fonction: "Directrice générale, entreprise de professionnalisation" },
  },
  D03: {
    moyen: {},
    minimal: { variante: "montant", titre: "Où", accent: "temps", libelles: ["Un", "Deux", "Trois"] },
    maximal: { variante: "pic", titre: "Professionnalisation", accent: "automatiquement", libelles: ["Professionnels", "Automatisation", "Reconnaissance"] },
  },
};

interface Essai {
  nom: string;
  type: string;
  contenu: Contenu;
  format: FormatToile;
}
const ESSAIS: Essai[] = Object.keys(CONTENUS).flatMap((type) =>
  (["moyen", "minimal", "maximal"] as const).flatMap((contenu) => (["4:5", "3:4"] as const).map((format) => ({ nom: `${type}-${contenu}-${format.replace(":", "x")}`, type, contenu, format }))),
);

const sortie = resolve("essais-visuels", "continu", "p3e");
mkdirSync(sortie, { recursive: true });
const travail = mkdtempSync(join(tmpdir(), "essai-donnees-"));
const ADRESSE = "http://127.0.0.1/p3e/";
const op = creerToileContinue({
  rendre: rendreToileAvecRemotion(navigateur ? { navigateur } : {}),
  deposer: async (url, chemin) => {
    const nom = decodeURIComponent(new URL(url).pathname.slice("/p3e/".length));
    if (nom.endsWith("/page-02.jpg")) copyFileSync(chemin, join(sortie, `${nom.split("/")[0]}.jpg`));
  },
});

const resultats: Record<string, unknown> = {};
const echecs: string[] = [];
for (const e of ESSAIS) {
  const types = ["X00", e.type, "X02"];
  const pages = types.map((t, i) => ({ ...(exemple(t) as object), ...(i === 1 ? CONTENUS[e.type][e.contenu] : {}) }));
  const hauteur = HAUTEURS[e.format];
  const depotsPages = types.map((_, i) => ({ cle: `${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg`, urlDepot: `${ADRESSE}${e.nom}/page-${String(i + 1).padStart(2, "0")}.jpg` }));
  try {
    const r = await op(
      {
        idRendu: e.nom,
        operation: "toile-continue",
        file: "courte",
        entrees: {},
        sortie: { urlDepot: `${ADRESSE}${e.nom}/bande.jpg`, cle: `${e.nom}/bande.jpg` },
        parametres: {
          proprietes: {
            toile: { version: "toile/1", format: e.format, pages, raccords: [] },
            versions: { socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(GABARITS.filter((g) => types.includes(g.type)).map((g) => [g.type, g.version])), parcours: {}, raccords: {} },
          },
          depotsPages,
        },
      },
      { progression: () => {}, dossier: mkdtempSync(join(travail, `${e.nom}-`)), signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    const octets = statSync(join(sortie, `${e.nom}.jpg`)).size;
    const fautes = [
      m.largeur !== 3 * LARGEUR_PAGE && `largeur ${m.largeur}`,
      m.hauteur !== hauteur && `hauteur ${m.hauteur}`,
      m.debordements !== 0 && `${m.debordements} débordement(s)`,
      !(m.taillePoliceMin >= 26) && `texte à ${m.taillePoliceMin} px`,
      m.textesSurCouture !== 0 && `${m.textesSurCouture} texte(s) sur une couture`,
      m.textesHorsMarge !== 0 && `${m.textesHorsMarge} texte(s) hors marge`,
      m.textesCoinReserve !== 0 && `${m.textesCoinReserve} texte(s) dans le coin réservé`,
      m.intrusionsMetaP1 !== 0 && `${m.intrusionsMetaP1} intrusion(s) Meta en page 1`,
      m.chevauchements !== 0 && `${m.chevauchements} chevauchement(s)`,
      m.traitsFinsSurCouture !== 0 && `${m.traitsFinsSurCouture} trait(s) fin(s) sur une couture`,
      octets > OCTETS_JPEG_MAX && `${Math.round(octets / 1024)} Ko (> 400 Ko)`,
    ].filter(Boolean) as string[];
    resultats[e.nom] = { mesures: m, octets };
    console.log(`${e.nom} : ${fautes.length ? `ÉCHEC ${fautes.join(", ")}` : "ok"} [police min ${m.taillePoliceMin}, ${Math.round(octets / 1024)} Ko]`);
    if (fautes.length) echecs.push(`${e.nom} : ${fautes.join(", ")}`);
  } catch (err) {
    const message = String(err instanceof Error ? err.message : err).slice(0, 400);
    resultats[e.nom] = { erreur: message };
    console.log(`${e.nom} : ÉCHEC ${message}`);
    echecs.push(`${e.nom} : ${message}`);
  }
}
writeFileSync(join(sortie, "mesures.json"), `${JSON.stringify(resultats, null, 2)}\n`);
if (echecs.length) {
  console.error(`\n${echecs.length} essai(s) en échec :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log(`\n${ESSAIS.length} essais ok. Mesures : essais-visuels/continu/p3e/mesures.json`);
process.exit(0);
