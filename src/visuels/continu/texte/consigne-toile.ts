import { z } from "zod";
import { choisirPlan, FAMILLES_MIN, PARCOURS_PAR_INTENTION, REGISTRES_PRODUCTION, type RegistresPlan } from "../../../briques/visuels/continu/plan-toile";
import { HAUTEURS, PAGES_DEFAUT_MAX, PAGES_MAX, PAGES_MIN, RUBRIQUE_MAX } from "../../../domaine/visuels/continu/geometrie";
import { VERSION_MODELE_TOILE } from "../../../domaine/visuels/continu/schema-toile";
import { VERSION_PAQUET_TOILE } from "./session-toile";

const SUJET_EXEMPLE = "Par où commencer avec l’IA";

/** Budget lisible d'un champ zod : longueur maximale d'un texte, nombre d'éléments d'une liste, valeurs d'une énumération. */
function budget(champ: z.ZodType): string {
  if (champ instanceof z.ZodOptional || champ instanceof z.ZodDefault) return `${budget(champ._zod.def.innerType as z.ZodType)} (facultatif)`;
  if (champ instanceof z.ZodString) return String(champ.maxLength ?? "libre");
  if (champ instanceof z.ZodArray) {
    const bag = champ._zod.bag as { minimum?: number; maximum?: number };
    const nombre = bag.minimum !== undefined && bag.maximum !== undefined ? `${bag.minimum} à ${bag.maximum}` : `${bag.maximum ?? "n"} au plus`;
    return `liste de ${nombre} [${budget(champ.element as z.ZodType)}]`;
  }
  if (champ instanceof z.ZodObject) return champs(champ);
  if (champ instanceof z.ZodEnum) return `un de ${champ.options.join(" / ")}`;
  if (champ instanceof z.ZodLiteral) return `« ${[...champ.values].join(" »")} »`;
  if (champ instanceof z.ZodBoolean) return "oui ou non";
  if (champ instanceof z.ZodNumber) return "nombre";
  return "voir l'exemple";
}

/** Champs d'une plaquette (hors `type` et `alt`, communs à toutes), les obligatoires d'abord. */
function champs(schema: z.ZodObject): string {
  const entrees = Object.entries(schema.shape as Record<string, z.ZodType>).filter(([cle]) => cle !== "type" && cle !== "alt");
  const facultatif = (c: z.ZodType) => c instanceof z.ZodOptional || c instanceof z.ZodDefault;
  return [...entrees.filter(([, c]) => !facultatif(c)), ...entrees.filter(([, c]) => facultatif(c))].map(([cle, c]) => `${cle} ${budget(c)}`).join(", ");
}

const ouiNon = (b: boolean) => (b ? "oui" : "non");

function planPropose(registres: RegistresPlan): string {
  try {
    const plan = choisirPlan({ sujet: SUJET_EXEMPLE, version: 1, recents: [], variete: "equilibre", format: "4:5" }, registres);
    const raccords = plan.raccords.map((r) => `${r.type} couture ${r.couture} (y ${r.y})`).join(", ") || "aucun";
    return `Pour le sujet « ${SUJET_EXEMPLE} » (variété équilibrée, 4:5) : Parcours ${plan.parcours} ; pages ${plan.types.join(" → ")} ; raccords ${raccords}.`;
  } catch (e) {
    return `Aucun plan proposé : ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Consigne de session de la toile continue, écrite depuis les registres (PUR). `scripts/visuels/ecrire-consigne-toile.ts` l'enregistre. */
export function genererConsigneToile(registres: RegistresPlan = REGISTRES_PRODUCTION): string {
  const gabarits = registres.gabarits.filter((g) => g.actif && !g.essai);
  const parcours = registres.parcours.filter((p) => !p.essai);
  const lignes = [
    `# Consigne de session : carrousel continu (${VERSION_PAQUET_TOILE})`,
    "",
    "Fichier généré par `scripts/visuels/ecrire-consigne-toile.ts` depuis les registres : ne pas modifier à la main.",
    "",
    "## Format",
    "",
    "Répondez par un seul objet JSON (64 Ko au plus), sans texte autour :",
    "",
    "```json",
    `{ "version": "${VERSION_PAQUET_TOILE}", "sujet": "…", "titre": "…", "pourquoi": ["une phrase par page"], "toile": { "version": "${VERSION_MODELE_TOILE}", "format": "4:5", "pages": [{ "type": "…", "alt": "…" }], "raccords": [{ "type": "R01", "couture": 1, "y": ${HAUTEURS["4:5"] / 2} }] } }`,
    "```",
    "",
    "## Règles",
    "",
    `- De ${PAGES_MIN} à ${PAGES_DEFAUT_MAX} pages (${PAGES_MAX} au plus si demandé) ; « pourquoi » compte une phrase par page (200 signes au plus).`,
    `- Chaque page porte \`type\` (une plaquette ci-dessous), \`alt\` (125 signes au plus) et, si besoin, \`rubrique\` (${RUBRIQUE_MAX} signes au plus).`,
    "- Composition : [couverture si le parcours ne commence pas] + parcours complet, dans l'ordre + 0 à 3 contenus + [relance facultative] + [appel si le parcours ne termine pas] ; un parcours qui termine ferme la toile.",
    "- Une plaquette une seule fois ; une seule page sombre ; une seule page orange fort ; deux pages de cas au plus ; jamais deux familles identiques à la suite (la relance peut précéder l'appel).",
    `- Variété : ${Object.entries(FAMILLES_MIN).map(([v, n]) => `${v} ${n} familles au moins`).join(", ")}.`,
    `- Parcours préférés par intention : ${Object.entries(PARCOURS_PAR_INTENTION).map(([i, ids]) => `${i} ${ids.join(", ")}`).join(" ; ")}.`,
    `- Raccords R01, R02, R03 : un par couture au plus, jamais sur une couture interne au parcours, toujours sur la couture 1 si le parcours ne commence pas ; \`y\` de 0 à ${HAUTEURS["4:5"]} en 4:5 (${HAUTEURS["3:4"]} en 3:4).`,
    "- Français, vouvoiement, aucun lien ni domaine, aucun chiffre sans fait validé, aucune promesse de résultat.",
    "",
    "## Plaquettes",
    "",
  ];
  if (gabarits.length === 0) lignes.push("Aucune plaquette de production pour l'instant : le registre est vide.");
  else lignes.push("| type | famille | rôle | champs et budgets (signes) |", "| --- | --- | --- | --- |", ...gabarits.map((g) => `| ${g.type} | ${g.famille} | ${g.role} | ${champs(g.schema)} |`));
  lignes.push("", "## Parcours", "");
  if (parcours.length === 0) lignes.push("Aucun parcours de production pour l'instant : le registre est vide.");
  else lignes.push("| parcours | pages | commence | termine | types, dans l'ordre |", "| --- | --- | --- | --- | --- |", ...parcours.map((p) => `| ${p.id} | ${p.pages} | ${ouiNon(p.commence)} | ${ouiNon(p.termine)} | ${p.pagesTypes.join(", ")} |`));
  lignes.push("", "## Plan proposé", "", planPropose(registres), "");
  return lignes.join("\n");
}
