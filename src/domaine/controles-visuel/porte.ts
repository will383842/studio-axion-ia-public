/** Porte qualité d'un carrousel, PAR CODE : aucune IA, aucun réseau. PUR. */
import { CarrouselSpec } from "../visuels/schema";
import type { ControlePorte, NiveauControle, Porte, RapportPorte } from "../visuels/contrats";
import { controlesMemoire } from "./memoire-carrousels";
import { controlesStructure } from "./rythme";
import { classementDans, contientJAide, expressionsBannieDans, MOTS_MIN_ANGLAIS, partAnglais, premierChiffre, sansNombreDePages, SEUIL_ANGLAIS, sortantsDans, tutoiementDans } from "./texte";
import { textesDe } from "./textes-de";
import { corrigerTypographie } from "./typographie";

const ORDRE: Record<NiveauControle, number> = { vert: 0, orange: 1, rouge: 2 };

function lieu(chemin: string, page: number | undefined): string {
  return chemin === "alt" ? "Le texte alternatif" : page !== undefined ? `Page ${page}` : "Le carrousel";
}

/** Un message d'erreur du schéma, en français : jamais le texte anglais de Zod, sauf pour nos propres règles (`custom`). */
function phraseSchema(issue: { code: string; message: string; path: PropertyKey[]; origin?: unknown }): string {
  const pages = issue.path.join(".") === "pages";
  switch (issue.code) {
    case "invalid_type":
      return "une information manque ou n'a pas la bonne forme";
    case "too_big":
      return pages ? "trop de pages" : issue.origin === "array" ? "trop d'éléments" : "texte trop long";
    case "too_small":
      return pages ? "pas assez de pages" : issue.origin === "array" ? "pas assez d'éléments" : issue.origin === "string" ? "texte trop court" : "valeur trop petite";
    case "unrecognized_keys":
      return "un champ inconnu est présent";
    case "invalid_union":
      return "type de page inconnu";
    case "invalid_value":
      return issue.path.at(-1) === "type" ? "type de page inconnu" : "valeur non reconnue";
    default:
      // `custom` et les formats (SANS_LIEN) portent déjà notre message français ; les messages de Zod sont en anglais.
      return issue.code !== "invalid_format" && issue.code !== "custom" || /^Invalid/.test(issue.message) ? "une valeur n'est pas acceptée" : issue.message;
  }
}

/** Bornes des contrôles de texte quand le schéma a refusé la spec : l'entrée n'est alors pas bornée. */
const BORNES_SPEC_REFUSEE = { chaines: 300, longueur: 2000, profondeur: 8 };

export const controlerCarrousel: Porte = (spec, ctx) => {
  const controles: ControlePorte[] = [];
  const analyse = CarrouselSpec.safeParse(spec);

  if (!analyse.success) {
    for (const issue of analyse.error.issues.slice(0, 5)) {
      const chemin = issue.path.join(".");
      const m = /^pages\.(\d+)/.exec(chemin);
      controles.push({
        code: "SCHEMA",
        niveau: "rouge",
        phrase: `${m ? `Page ${Number(m[1]) + 1}` : "Le carrousel"} : ${phraseSchema(issue)} (le carrousel ne respecte pas le modèle attendu).`,
        ...(m ? { page: Number(m[1]) + 1 } : {}),
        ...(chemin ? { chemin } : {}),
      });
    }
  }

  // Les contrôles de texte lisent toutes les chaînes, même d'une spec refusée par le schéma.
  const nbPages = Array.isArray((spec as { pages?: unknown })?.pages) ? (spec as { pages: unknown[] }).pages.length : 0;
  const textes = textesDe(spec, analyse.success ? undefined : BORNES_SPEC_REFUSEE);
  const anglaisChaine = new Set<number | undefined>();
  for (const { chemin, texte, page } of textes) {
    const ou = { ...(page !== undefined ? { page } : {}), chemin };
    const ajouter = (code: string, phrase: string) => controles.push({ code, niveau: "rouge", phrase, ...ou });

    if (ctx.faitsDisponibles === false) {
      const chiffre = premierChiffre(chemin === "alt" ? sansNombreDePages(texte, nbPages) : texte);
      if (chiffre !== undefined) ajouter("CHIFFRE", `${lieu(chemin, page)} : un chiffre est écrit ("${chiffre}") ; aucun chiffre tant que la liste de faits n'est pas validée.`);
      const classement = classementDans(chemin === "alt" ? sansNombreDePages(texte, nbPages) : texte);
      if (classement !== undefined) ajouter("CLASSEMENT", `${lieu(chemin, page)} : classement sans source : "${classement}" ; retirez-le ou citez la source.`);
    }
    const interdits = ctx.interditsDans(texte);
    if (interdits.length > 0) ajouter("INTERDIT", `${lieu(chemin, page)} : ${interdits.length > 1 ? "des mots ou formules interdits sont employés" : "un mot ou une formule interdit est employé"} (${interdits.map((x) => `"${x}"`).join(", ")}).`);
    const tu = tutoiementDans(texte);
    if (tu !== undefined) ajouter("TUTOIEMENT", `${lieu(chemin, page)} : le texte tutoie ("${tu}") ; le studio vouvoie.`);
    if (contientJAide(texte)) ajouter("J_AIDE", `${lieu(chemin, page)} : la formule « J'aide » est à bannir ; parlez du travail, pas de vous.`);
    const bannies = expressionsBannieDans(texte);
    if (bannies.length > 0) ajouter("EXPRESSION_BANNIE", `${lieu(chemin, page)} : expression à bannir (${bannies.map((x) => `« ${x} »`).join(", ")}).`);
    const sortants = sortantsDans(texte);
    if (sortants.length > 0) ajouter("SORTANT", `${lieu(chemin, page)} : le texte renvoie vers l'extérieur (${sortants.map((s) => `${s.genre} "${s.extrait}"`).join(", ")}) ; seule la dernière page invite à écrire.`);
    const anglais = partAnglais(texte);
    if (anglais !== undefined && anglais > SEUIL_ANGLAIS) {
      anglaisChaine.add(page);
      ajouter("ANGLAIS", `${lieu(chemin, page)} : le texte semble écrit en anglais (${Math.round(anglais * 100)} % de mots anglais sur au moins ${MOTS_MIN_ANGLAIS} mots) ; tout doit être en français.`);
    }
  }

  // Anglais par page : les textes courts d'une même page, mis bout à bout, comptent comme un seul texte.
  const parPage = new Map<number, string[]>();
  for (const { texte, page } of textes) if (page !== undefined) parPage.set(page, [...(parPage.get(page) ?? []), texte]);
  for (const [page, morceaux] of parPage) {
    if (anglaisChaine.has(page)) continue;
    const anglais = partAnglais(morceaux.join(" "));
    if (anglais !== undefined && anglais > SEUIL_ANGLAIS) controles.push({ code: "ANGLAIS", niveau: "rouge", page, phrase: `Page ${page} : le texte semble écrit en anglais (${Math.round(anglais * 100)} % de mots anglais sur au moins ${MOTS_MIN_ANGLAIS} mots) ; tout doit être en français.` });
  }

  let specCorrige: ReturnType<typeof corrigerTypographie>["specCorrige"] | undefined;
  const corrections: string[] = [];
  if (analyse.success) {
    controles.push(...controlesStructure(analyse.data));
    if (ctx.recents) controles.push(...controlesMemoire(analyse.data, ctx.recents));
    const typo = corrigerTypographie(analyse.data);
    if (typo.corrections.length > 0 && CarrouselSpec.safeParse(typo.specCorrige).success) {
      specCorrige = typo.specCorrige;
      corrections.push(...typo.corrections);
    }
  }

  const verdict = controles.reduce<NiveauControle>((pire, c) => (ORDRE[c.niveau] > ORDRE[pire] ? c.niveau : pire), "vert");
  const rapport: RapportPorte = { version: "porte-carrousel/1", verdict, controles, corrections };
  return specCorrige ? { rapport, specCorrige } : { rapport };
};
