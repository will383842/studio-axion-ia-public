/** Porte qualité d'une toile continue (lot P4), PAR CODE : aucune IA, aucun réseau. PUR. Mêmes contrôles de texte que `porte.ts`. */
import { typographieFrancaise } from "../../briques/visuels/typographie-francaise";
import { ToileSpec, type ToileSpecType } from "../visuels/continu/schema-toile";
import type { ContextePorte, ControlePorte, EmpreinteCarrousel, NiveauControle, RapportPorte } from "../visuels/contrats";
import { controlesMemoire, empreinteCarrousel } from "./memoire-carrousels";
import { controlesStructureToile } from "./rythme-continu";
import { classementDans, contientJAide, expressionsBannieDans, MOTS_MIN_ANGLAIS, partAnglais, premierChiffre, sansNombreDePages, SEUIL_ANGLAIS, sortantsDans, tutoiementDans } from "./texte";
import { textesDe, transformerTextes } from "./textes-de";

const ORDRE: Record<NiveauControle, number> = { vert: 0, orange: 1, rouge: 2 };

/** Bornes des contrôles de texte quand le schéma a refusé la toile : l'entrée n'est alors pas bornée. */
const BORNES_TOILE_REFUSEE = { chaines: 300, longueur: 2000, profondeur: 8 };

const lieu = (page: number | undefined) => (page !== undefined ? `Page ${page}` : "La toile");

/** Message du schéma de la toile, déjà en français (« la page N : … ») ; jamais le texte anglais de Zod. */
function phraseSchema(issue: { code: string; message: string }): string {
  const message = issue.code !== "custom" || /^Invalid/.test(issue.message) ? "une valeur n'est pas acceptée" : issue.message;
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/** Empreinte anti-répétition d'une toile : la suite des types (le parcours s'en déduit) et le type de la page 1. */
export const empreinteToile = (toile: { pages: readonly { type: string }[] }): EmpreinteCarrousel => empreinteCarrousel(toile);

export type PorteToile = (spec: unknown, ctx: ContextePorte) => { rapport: RapportPorte; specCorrige?: ToileSpecType };

export const controlerToile: PorteToile = (spec, ctx) => {
  const controles: ControlePorte[] = [];
  const analyse = ToileSpec.safeParse(spec);

  if (!analyse.success) {
    for (const issue of analyse.error.issues.slice(0, 5)) {
      const chemin = issue.path.join(".");
      const m = /^pages\.(\d+)/.exec(chemin);
      controles.push({
        code: "SCHEMA",
        niveau: "rouge",
        phrase: `${phraseSchema(issue)} (la toile ne respecte pas le modèle attendu).`,
        ...(m ? { page: Number(m[1]) + 1 } : {}),
        ...(chemin ? { chemin } : {}),
      });
    }
  }

  // Seules les pages sont du texte lu : jamais `format`, ni les raccords (identifiants et positions).
  const pagesBrutes = analyse.success ? analyse.data.pages : (spec as { pages?: unknown } | null)?.pages;
  const nbPages = Array.isArray(pagesBrutes) ? pagesBrutes.length : 0;
  const textes = textesDe({ pages: pagesBrutes }, analyse.success ? undefined : BORNES_TOILE_REFUSEE);
  const anglaisChaine = new Set<number | undefined>();
  for (const { chemin, texte, page } of textes) {
    const ou = { ...(page !== undefined ? { page } : {}), chemin };
    const ajouter = (code: string, phrase: string) => controles.push({ code, niveau: "rouge", phrase, ...ou });
    const ici = lieu(page);

    if (ctx.faitsDisponibles === false) {
      const lu = chemin.endsWith(".alt") ? sansNombreDePages(texte, nbPages) : texte;
      const chiffre = premierChiffre(lu);
      if (chiffre !== undefined) ajouter("CHIFFRE", `${ici} : un chiffre est écrit ("${chiffre}") ; aucun chiffre tant que la liste de faits n'est pas validée.`);
      const classement = classementDans(lu);
      if (classement !== undefined) ajouter("CLASSEMENT", `${ici} : classement sans source : "${classement}" ; retirez-le ou citez la source.`);
    }
    const interdits = ctx.interditsDans(texte);
    if (interdits.length > 0) ajouter("INTERDIT", `${ici} : ${interdits.length > 1 ? "des mots ou formules interdits sont employés" : "un mot ou une formule interdit est employé"} (${interdits.map((x) => `"${x}"`).join(", ")}).`);
    const tu = tutoiementDans(texte);
    if (tu !== undefined) ajouter("TUTOIEMENT", `${ici} : le texte tutoie ("${tu}") ; le studio vouvoie.`);
    if (contientJAide(texte)) ajouter("J_AIDE", `${ici} : la formule « J'aide » est à bannir ; parlez du travail, pas de vous.`);
    const bannies = expressionsBannieDans(texte);
    if (bannies.length > 0) ajouter("EXPRESSION_BANNIE", `${ici} : expression à bannir (${bannies.map((x) => `« ${x} »`).join(", ")}).`);
    const sortants = sortantsDans(texte);
    if (sortants.length > 0) ajouter("SORTANT", `${ici} : le texte renvoie vers l'extérieur (${sortants.map((s) => `${s.genre} "${s.extrait}"`).join(", ")}) ; seule la dernière page invite à écrire.`);
    const anglais = partAnglais(texte);
    if (anglais !== undefined && anglais > SEUIL_ANGLAIS) {
      anglaisChaine.add(page);
      ajouter("ANGLAIS", `${ici} : le texte semble écrit en anglais (${Math.round(anglais * 100)} % de mots anglais sur au moins ${MOTS_MIN_ANGLAIS} mots) ; tout doit être en français.`);
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

  let specCorrige: ToileSpecType | undefined;
  const corrections: string[] = [];
  if (analyse.success) {
    controles.push(...controlesStructureToile(analyse.data));
    if (ctx.recents) controles.push(...controlesMemoire(analyse.data, ctx.recents));
    const typo = corrigerTypographieToile(analyse.data);
    if (typo.corrections.length > 0 && ToileSpec.safeParse(typo.toile).success) {
      specCorrige = typo.toile;
      corrections.push(...typo.corrections);
    }
  }

  const verdict = controles.reduce<NiveauControle>((pire, c) => (ORDRE[c.niveau] > ORDRE[pire] ? c.niveau : pire), "vert");
  const rapport: RapportPorte = { version: "porte-carrousel/1", verdict, controles, corrections };
  return specCorrige ? { rapport, specCorrige } : { rapport };
};

/** Typographie française des textes des pages (espaces insécables, apostrophes) ; `format` et raccords intacts. */
function corrigerTypographieToile(toile: ToileSpecType): { toile: ToileSpecType; corrections: string[] } {
  const corrections: string[] = [];
  const pages = transformerTextes(toile.pages, (texte, chemin) => {
    const neuf = typographieFrancaise(texte);
    if (neuf !== texte) {
      const phrase = `Page ${Number(/^\d+/.exec(chemin)?.[0] ?? 0) + 1} : la typographie française est corrigée (espaces insécables, apostrophes).`;
      if (!corrections.includes(phrase)) corrections.push(phrase);
    }
    return neuf;
  });
  return { toile: { ...toile, pages }, corrections };
}
