/** Outils des tests du socle qualité : un script en quelques lignes, une recette d'essai, un résultat par code. */
import { evaluerQualite, type LigneNormalisee, type Partie, type RecetteQualite, type ResultatRegle, type ScriptNormalise } from "@/domaine/qualite-script";

/** Recette d'essai : 3 mots/s (un mot = 1/3 s), Instagram, pas de vrais écrans. */
export const RECETTE_ESSAI: RecetteQualite = {
  id: "essai",
  libelle: "Essai",
  debit: { unite: "mots", parSeconde: 3 },
  reseaux: ["instagram"],
  faceCamera: false,
  ecransReels: false,
  demandeFinale: "demande",
  interdits: "ecrire",
  structures: [{ id: "libre", parties: ["accroche", "corps", "appel"] }],
};

export function script(lignes: [Partie, string, Partial<LigneNormalisee>?][], plus: Omit<ScriptNormalise, "lignes"> = {}): ScriptNormalise {
  return { ...plus, lignes: lignes.map(([partie, dit, x], i) => ({ id: `l${i}`, partie, dit, ...x })) };
}

/** Un bon script de 93 mots (31 s à 3 mots/s), qui passe toutes les règles. */
export const BON: [Partie, string][] = [
  ["accroche", "Ce devis vous coûte trois heures chaque semaine."],
  ["douleur", "Votre assistante recopie les mêmes lignes à la main."],
  ["douleur", "Elle oublie une relance, et le client signe ailleurs."],
  ["promesse", "Voici ce qu'on met en place chez nos clients."],
  ["corps", "Le devis part tout seul, depuis la fiche du client."],
  ["corps", "La relance part le lendemain, sans personne."],
  ["exemple", "Par exemple, un artisan de huit salariés gagne trois heures par semaine."],
  ["corps", "Mais attention, tout ne s'automatise pas."],
  ["corps", "Le prix reste une décision humaine."],
  ["a-retenir", "Le devis part seul, votre équipe garde la relation."],
  ["appel", "Écrivez DEVIS en commentaire pour recevoir la méthode."],
];

/** Le bon script, une ligne remplacée (index) ou ajoutée en fin (index = longueur). */
export function variante(index: number, ligne: [Partie, string]): [Partie, string][] {
  const v = [...BON];
  v[index] = ligne;
  return v;
}

export function evaluer(lignes: [Partie, string, Partial<LigneNormalisee>?][], recette: RecetteQualite = RECETTE_ESSAI, plus: Omit<ScriptNormalise, "lignes"> = {}) {
  return evaluerQualite(script(lignes, plus), recette);
}

/** Le premier résultat d'un code. */
export function code(r: { resultats: ResultatRegle[] }, c: string): ResultatRegle {
  const x = r.resultats.find((y) => y.code === c);
  if (!x) throw new Error(`Pas de résultat ${c}`);
  return x;
}

export const ecarts = (r: { resultats: ResultatRegle[] }) => r.resultats.filter((x) => x.statut === "ecart").map((x) => x.code);
