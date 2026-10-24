/**
 * ESSAI RÉEL des CAPACITÉS MAXIMALES du registre (`registre-pages.ts`) : pour chaque type de page et chaque variante (nombre
 * d'éléments), rend avec le vrai Remotion un contenu de longueur MAXIMALE autorisée par le registre et vérifie, sur la mesure du
 * DOM réel, `debordements` = 0, `chevauchements` = 0 (L9 : texte sur texte ou sur un dessin), `vide` ≤ 25 % sur T22 à T28 (part du corps de page sans texte ni dessin), `textesEnZone` = 0 (aucune ligne de texte dans la zone de la flèche LinkedIn x ≥ 920, y 560-790, ni dans celle du compteur Meta x ≥ 860, y ≥ 1080) et `taillePoliceMin` >= 26 px (`taillePoliceMin` = 0, aucun texte mesuré, est un ÉCHEC comme le reste : toute page de ce registre porte du texte).
 * Les titres sont essayés sous deux formes (mots courants ; mots longs de même longueur, la plus rude : deux lignes pleines) et à 19, 21 signes et au titreMax du registre,
 * CHACUN avec deux formes de corps : « mots courants » (texte inventé coupé à la longueur exacte du budget) et « mots LONGS » (mots français entiers de 12 à 15
 * lettres, jamais coupés : les lignes se remplissent mal, c'est la forme la plus haute), la seconde avec deux ordres de mots ; puis « ADVERSAIRE » (un mot court, un mot de 15 lettres, en alternance : le pire cas est un mot long juste après une fin de ligne), deux ordres.
 * Sort en erreur et DIT QUEL BUDGET BAISSER si une capacité n'est pas tenue. Sans réseau extérieur, sans appel payant. Usage (depuis `studio-rendu/`) :
 *   STUDIO_RENDU_NAVIGATEUR=/chemin/headless_shell npx tsx --tsconfig ../tsconfig.json scripts/essai-capacites-max.ts [T06 T20 ...]
 * Sortie : un JPEG de contrôle par type et variante (nommé `<type>-v<variante>-L0-f<forme>.jpg`) (titre à mots longs de 21 signes, corps à mots longs : le cas le plus rude) sous `essais-visuels/capacites/`.
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PAGES, TYPES_PAGE, type TypePage } from "../../src/briques/visuels/registre-pages.js";
import { LIMITES } from "../../src/briques/visuels/limites.js";
import { TAILLE_TEXTE_MIN } from "../compositions/visuels/commun/constantes.js";
import { VIDE_MAX } from "../compositions/visuels/commun/zones.js";
import { creerVisuelPage, rendreAvecRemotion } from "../src/operations/visuel-page.js";
import { casMax, MINIS_ESSAI, specAutour, texteAdversaire, texteInvente, texteMotsLongs } from "./contenu-essai-visuel.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";
const sortie = resolve("essais-visuels", "capacites");
const travail = mkdtempSync(join(tmpdir(), "capacites-max-"));
// Dossier vidé seulement pour un essai complet : lancer certains types ne doit pas effacer les JPEG des autres.
if (process.argv.length <= 2) rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });

/** Gabarits soumis au contrôle du vide (L9). */
const AVEC_VIDE = new Set(["T22", "T23", "T24", "T26", "T27", "T28", "T29"]);

const op = creerVisuelPage({
  rendre: rendreAvecRemotion({ navigateur: process.env.STUDIO_RENDU_NAVIGATEUR }),
  deposer: async (cible, chemin) => void copyFileSync(chemin, cible),
});

/**
 * Nombre de mots des titres « à mots longs » : deux mots jusqu'à 21 signes (le cas le plus rude pour la hauteur : deux lignes pleines
 * au grand corps), puis des mots de 8 signes au plus (au-delà, une ligne ne se coupe plus en deux moitiés égales : ce n'est pas une
 * question de hauteur mais de largeur au corps minimal de 90 px, hors de ce contrôle).
 */
const nombreDeMots = (n: number) => (n <= 21 ? 2 : Math.ceil(n / 8));

/**
 * Titres de EXACTEMENT `n` signes sous deux formes : mots courants, et mots longs de même longueur (la forme la plus rude : une
 * ligne ne peut pas se couper).
 */
export function formesTitre(n: number): { forme: string; titre: string }[] {
  const lettres = "construiremessagegestesmatin";
  const mot = (l: number, d: number) => Array.from({ length: l }, (_, i) => lettres[(i + d) % lettres.length]).join("");
  const nbMots = nombreDeMots(n);
  const reste = n - (nbMots - 1);
  const longs = Array.from({ length: nbMots }, (_, i) => mot(Math.floor(reste / nbMots) + (i < reste % nbMots ? 1 : 0), 3 * i)).join(" ");
  const courants = ["ranger", "classer", "noter", "relire", "trier", "poser"];
  let ordinaire = "";
  for (let i = 0; ordinaire.length < n; i++) ordinaire += `${courants[i % courants.length]} `;
  return [
    { forme: "mots courants", titre: ordinaire.slice(0, n).trimEnd().padEnd(n, "x") },
    { forme: `${nbMots} mots longs`, titre: longs },
  ];
}

interface Verdict {
  libelle: string;
  fichier: string;
  erreur: string | null;
  mesures?: Record<string, number>;
}

async function rendre(page: Record<string, unknown>, fichier: string, garder: boolean): Promise<Verdict> {
  const { spec, index } = specAutour(page);
  const cible = join(travail, fichier);
  try {
    const r = await op(
      { idRendu: fichier, operation: "visuel-page", file: "courte", entrees: {}, sortie: { urlDepot: cible, cle: "essai" }, parametres: { proprietes: { spec, index }, scale: 1, jpegQuality: 88 } },
      { progression: () => {}, dossier: mkdtempSync(join(travail, "p-")), signal: new AbortController().signal },
    );
    const m = (r.mesures ?? {}) as Record<string, number>;
    if (garder) copyFileSync(cible, join(sortie, fichier));
    if (m.debordements !== 0) return { libelle: "", fichier, mesures: m, erreur: `${m.debordements} débordement(s)` };
    // Zones recouvertes par la plateforme (flèche LinkedIn, compteur Meta) : aucun texte n'y entre, `undefined` (mesure absente) est un échec.
    if (m.textesEnZone !== 0) return { libelle: "", fichier, mesures: m, erreur: `${m.textesEnZone} ligne(s) de texte dans une zone réservée (x ≥ 920, y 560-790 ou x ≥ 860, y ≥ 1080)` };
    // Chevauchements (L9) : deux textes l'un sur l'autre, ou un texte posé sur un dessin de la banque ; `undefined` (mesure absente) est un échec.
    if (m.chevauchements !== 0) return { libelle: "", fichier, mesures: m, erreur: `${m.chevauchements} chevauchement(s) texte/texte ou texte/illustration` };
    // Vide (L9) : sur les gabarits T22 à T28, au plus `VIDE_MAX` du corps de page sans texte ni dessin ; mesure absente = échec.
    if (AVEC_VIDE.has(String(page.type)) && !(m.vide <= VIDE_MAX)) return { libelle: "", fichier, mesures: m, erreur: `vide ${Math.round(m.vide * 100)} % du corps (> ${VIDE_MAX * 100} %)` };
    if (!(m.taillePoliceMin >= TAILLE_TEXTE_MIN)) return { libelle: "", fichier, mesures: m, erreur: `texte à ${m.taillePoliceMin} px (< ${TAILLE_TEXTE_MIN})` };
    return { libelle: "", fichier, mesures: m, erreur: null };
  } catch (e) {
    return { libelle: "", fichier, erreur: String(e instanceof Error ? e.message : e).slice(0, 220) };
  }
}

const demandes = process.argv.slice(2) as TypePage[];
const types = demandes.length > 0 ? demandes : [...TYPES_PAGE];
const echecs: string[] = [];
const corpsEssayes = [
  { nom: "corps mots courants", texte: texteInvente, graines: [0] },
  { nom: "corps mots LONGS", texte: texteMotsLongs, graines: [0, 5] },
  { nom: "corps ADVERSAIRE", texte: texteAdversaire, graines: [0, 1] },
] as const;

for (const type of types) {
  const titreAvecChamp = PAGES[type].titreMax > 0;
  for (const corps of corpsEssayes) {
    const gardeLeCorps = corps.nom !== "corps mots courants";
    for (const graine of corps.graines) {
      const texte = (n: number, g = 0, plafond?: number) => corps.texte(n, g + graine, plafond);
      for (const [numero, cas] of casMax(type, texte).entries()) {
        // Longueurs de titre : 19 et 21 signes (deux mots longs : deux lignes au grand corps) et le maximum du registre.
        const longueurs = [...new Set([19, 21, Math.min(PAGES[type].titreMax, LIMITES.titreMax)])].filter((l) => l <= PAGES[type].titreMax);
        const formes = titreAvecChamp ? longueurs.flatMap((l) => formesTitre(l).map((x) => ({ ...x, forme: `${x.forme}, ${l} signes` }))) : [{ forme: "contenu au budget", titre: "" }];
        for (const [f, { forme, titre }] of formes.entries()) {
          const page = titreAvecChamp ? { ...cas.page, titre } : cas.page;
          const fichier = `${type.toLowerCase()}-v${numero + 1}-${corps.nom === "corps ADVERSAIRE" ? "A" : gardeLeCorps ? "L" : "C"}${graine}-f${f + 1}.jpg`;
          // JPEG de contrôle : le cas le plus rude pour la hauteur (corps à mots longs, titre à mots longs de 21 signes, premier ordre de mots), ou la page entière sans titre de page.
          const garder = gardeLeCorps && graine === 0 && (!titreAvecChamp || (/mots longs/.test(forme) && titre.length === 21));
          const v = await rendre(page, fichier, garder);
          const etat = v.erreur ? "ÉCHEC" : "ok";
          const nom = `${type} ${cas.nom} [${corps.nom}${gardeLeCorps ? ` ordre ${graine}` : ""}] (${forme})`;
          console.log(`${nom} : ${etat} ${v.erreur ?? ""} ${v.mesures ? `[débordements ${v.mesures.debordements}, police min ${v.mesures.taillePoliceMin}]` : ""}`);
          if (v.erreur) echecs.push(`${nom} : ${v.erreur}`);
        }
      }
    }
  }
}

// T02 : 1 ou 2 cartes courtes sont AGRANDIES (échelle 1,3, `echelleCartes`) : on essaie la frontière exacte (titre 24 signes, corps 80 signes) sous les trois formes de texte.
if (types.includes("T02")) {
  for (const nbCartes of [2]) {
    for (const corps of corpsEssayes) {
      const page = { type: "T02", titre: texteInvente(PAGES.T02.titreMax), cartes: Array.from({ length: nbCartes }, (_, i) => ({ titre: corps.texte(24, i, 12), corps: corps.texte(80, i + 3), mini: MINIS_ESSAI[i] })) };
      const v = await rendre(page, `t02-courtes-${nbCartes}-${corps.nom.replace(/ /g, "-")}.jpg`, corps.nom === "corps mots LONGS");
      const nom = `T02 ${nbCartes} cartes courtes agrandies [${corps.nom}] (frontière 24 + 80 signes)`;
      console.log(`${nom} : ${v.erreur ? "ÉCHEC" : "ok"} ${v.erreur ?? ""} ${v.mesures ? `[débordements ${v.mesures.debordements}, police min ${v.mesures.taillePoliceMin}]` : ""}`);
      if (v.erreur) echecs.push(`${nom} : ${v.erreur}`);
    }
  }
}

if (echecs.length > 0) {
  console.error(`\n${echecs.length} capacité(s) NON tenue(s) :\n- ${echecs.join("\n- ")}`);
  process.exit(1);
}
console.log("\nToutes les capacités maximales du registre sont tenues au rendu réel.");
process.exit(0);
