/**
 * T-EXT-25a · Constructeur de maquette : description (`description-maquette.v1`) → 4 fichiers texte. SANS IA, sans disque,
 * sans réseau, déterministe. Les ressources (charte, écrans neutres de T-EXT-49) sont passées en paramètre.
 * Tout texte de la description est ÉCHAPPÉ avant d'entrer dans le HTML ; aucun script ni police externe, aucun `fetch`.
 * Hors `tsconfig.json` (comme `outils/`) : son test est sa seule garde.
 */
import type { DescriptionMaquette, DonneeExemple, EcranDecrit, ZoneDecrite } from "../../../src/moteurs/montage-tutoriel-outil/description-maquette";

export const NOMS_FICHIERS = ["index.html", "app.js", "demo-data.js", "styles.css"] as const;
export type NomFichier = (typeof NOMS_FICHIERS)[number];

export interface RessourcesConstructeur {
  /** Contenu de `charte/charte.css`. */
  charteCss: string;
  /** Fragments HTML des écrans neutres (T-EXT-49), par identifiant de modèle ; un modèle absent : écran générique. */
  ecrans: Record<string, string>;
}

export const MENTION_ECRAN = "Démonstration · données exemple";

const echapper = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** JSON sûr dans un fichier de script : jamais de `<` ni de séparateur de ligne Unicode. */
const jsonSur = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));

function donneeHtml(d: DonneeExemple): string {
  const etat = d.etat ? ` data-etat="${d.etat}"` : "";
  return `<li class="donnee" data-donnee="${d.id}"${etat}><span class="donnee-libelle">${echapper(d.libelle)}</span> <span class="donnee-valeur">${echapper(String(d.valeur))}</span></li>`;
}

function zoneHtml(z: ZoneDecrite): string {
  return `<section class="zone zone-${z.type}" data-zone="${z.id}"><h3>${echapper(z.libelle)}</h3><ul>${z.donnees.map(donneeHtml).join("")}</ul></section>`;
}

function ecranHtml(e: EcranDecrit, ressources: RessourcesConstructeur): string {
  const modele = e.modele !== "tableau-de-bord" && ressources.ecrans[e.modele] ? `<div class="modele-ecran" data-modele="${e.modele}">${ressources.ecrans[e.modele]}</div>` : "";
  return `<article class="ecran" id="ecran-${e.id}" data-ecran="${e.id}" hidden><h2>${echapper(e.titre)}</h2><p class="mention-ecran">${MENTION_ECRAN}</p>${modele}<div class="zones">${e.zones.map(zoneHtml).join("")}</div></article>`;
}

const STYLES = `
body { padding-top: 40px; }
.mention-ecran { margin: 0 0 12px; color: var(--texte-secondaire); font-size: 14px; font-weight: 600; }
.maquette { max-width: 1200px; margin: 0 auto; padding: 24px; }
.entete { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--noir); padding-bottom: 12px; }
.entete h1 { margin: 0; font-size: 28px; font-weight: 800; }
.entete .entreprise { color: var(--texte-secondaire); font-weight: 600; }
.etat { margin: 16px 0; padding: 8px 12px; background: var(--gris); font-weight: 700; transition: background-color 400ms ease, color 400ms ease; }
body.etat-maintenant .etat { background: var(--terracotta); color: var(--blanc); }
.ecran[hidden] { display: none; }
.zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.zone { background: var(--blanc); border: 1px solid var(--gris); padding: 16px; transition: opacity 400ms ease, border-color 400ms ease; }
.zone.actif { border-color: var(--terracotta); border-width: 3px; }
.zone h3 { margin: 0 0 8px; font-size: 18px; }
.zone ul { margin: 0; padding: 0; list-style: none; }
.donnee { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gris); transition: opacity 400ms ease; }
.donnee[hidden] { display: none; }
.donnee-valeur { font-weight: 800; }
`;

const APP = `(function () {
  "use strict";
  var data = window.donneesExemple;
  var ecrans = [].slice.call(document.querySelectorAll(".ecran"));
  var etatCourant = "avant";

  function majEtat(etat) {
    etatCourant = etat;
    document.body.classList.remove("etat-avant", "etat-maintenant");
    document.body.classList.add("etat-" + etat);
    document.getElementById("etat").textContent = data.etats[etat];
    [].forEach.call(document.querySelectorAll("[data-etat]"), function (n) {
      n.hidden = n.getAttribute("data-etat") !== etat;
    });
  }

  function montrer(id) {
    ecrans.forEach(function (e) {
      e.hidden = e.getAttribute("data-ecran") !== id;
    });
  }

  function viderActifs() {
    [].forEach.call(document.querySelectorAll(".zone.actif"), function (z) {
      z.classList.remove("actif");
    });
  }

  window.demoMaquette = {
    aller: function (etapeId) {
      if (etapeId === "avant" || etapeId === "maintenant") {
        majEtat(etapeId);
        return true;
      }
      if (Object.prototype.hasOwnProperty.call(data.ecrans, etapeId)) {
        viderActifs();
        montrer(etapeId);
        return true;
      }
      var zone = document.querySelector('[data-zone="' + etapeId + '"]');
      if (!zone) return false;
      viderActifs();
      montrer(zone.closest(".ecran").getAttribute("data-ecran"));
      zone.classList.add("actif");
      return true;
    },
    reinitialiser: function () {
      viderActifs();
      majEtat("avant");
      montrer(data.premierEcran);
    },
  };

  window.demoMaquette.reinitialiser();
})();
`;

export function construireMaquette(d: DescriptionMaquette, ressources: RessourcesConstructeur): { fichiers: Record<NomFichier, string> } {
  const ecrans: Record<string, true> = {};
  for (const e of d.ecrans) ecrans[e.id] = true;
  const demoData = `window.donneesExemple = ${jsonSur({ nom: d.nom, entreprise: d.entreprise, etats: d.etats, premierEcran: d.ecrans[0]?.id ?? "", ecrans, zones: d.ecrans.flatMap((e) => e.zones.map((z) => ({ id: z.id, type: z.type, donnees: z.donnees }))) })};\n`;
  const html = [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${echapper(d.nom)}</title>`,
    '<link rel="stylesheet" href="styles.css">',
    "</head>",
    "<body>",
    `<div class="mention-demo">${MENTION_ECRAN}</div>`,
    '<main class="maquette">',
    `<header class="entete"><h1>${echapper(d.nom)}</h1><span class="entreprise">${echapper(d.entreprise)}</span></header>`,
    '<p class="etat" id="etat"></p>',
    ...d.ecrans.map((e) => ecranHtml(e, ressources)),
    "</main>",
    '<script src="demo-data.js"></script>',
    '<script src="app.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { fichiers: { "index.html": html, "app.js": APP, "demo-data.js": demoData, "styles.css": `${ressources.charteCss}\n${STYLES}` } };
}
