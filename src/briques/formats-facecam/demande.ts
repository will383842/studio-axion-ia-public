/**
 * DEMANDES DE FORMAT DITES AU MONTEUR (lot F1). PUR, par règles fixes : aucun appel Claude, aucun coût.
 * « Monteur, fais-moi aussi une version carrée », « une version pour YouTube », « sors-la aussi en 4:5 »,
 * « tous les formats », « enlève la version carrée ». Une phrase qui ne parle pas d'une VERSION (« une animation
 * carrée ») n'est pas une demande de format : elle reste au monteur.
 */
import { RATIOS_DECLINAISON, type RatioDeclinaison } from "./ratios";

export interface DemandeFormats {
  ajouter: RatioDeclinaison[];
  retirer: RatioDeclinaison[];
  /** Ce que le monteur répond, en une phrase. */
  reponse: string;
}

const NOMS: Record<RatioDeclinaison, string> = { "4:5": "portrait (4:5)", "1:1": "carrée (1:1)", "16:9": "horizontale (16:9)" };

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mots qui désignent chaque format. */
const MOTIFS: Record<RatioDeclinaison, RegExp> = {
  "1:1": /\b(carre[e]?s?|1\s*[:/x]\s*1|square)\b/,
  "4:5": /\b(4\s*[:/x]\s*5|portrait|feed|fil (?:d'|de )?instagram|pour (?:le |mon )?linkedin|pour instagram)\b/,
  "16:9": /\b(16\s*[:/x]\s*9|horizontal(?:e|es)?|paysage|youtube(?!\s*shorts?)|ecran large|format large|pour la tele)\b/,
};

/** La phrase parle d'une version ou d'un format de la vidéo (et pas d'une animation, d'une carte, d'un titre). */
const CONTEXTE = /\b(version|versions|format|formats|declin\w*|decline\w*|sor[st]\w*|export\w*|aussi en|en (?:carre|horizontal|4\s*[:/x]\s*5|16\s*[:/x]\s*9|1\s*[:/x]\s*1|portrait|paysage)|pour (?:youtube|linkedin|instagram|la tele))\b/;
const AUTRE_OBJET = /\b(animation|carte|titre|texte|sous-titre|sous titre|logo|image|photo|cadre autour|encadre)\b/;
const TOUS = /\b(tous les formats|toutes les versions|tous formats|chaque format|dans tous les formats)\b/;
const RETRAIT = /\b(enleve|retire|supprime|annule|plus besoin|pas besoin|sans la version|pas de version|arrete)\w*\b/;

/** Demande de format reconnue dans une phrase, sinon null (la phrase reste au monteur). */
export function comprendreDemandeFormats(texte: string): DemandeFormats | null {
  const t = sansAccents(texte).replace(/[’`]/g, "'");
  const tous = TOUS.test(t);
  const cites = RATIOS_DECLINAISON.filter((r) => MOTIFS[r].test(t));
  if (!tous && !cites.length) return null;
  if (!tous && !CONTEXTE.test(t)) return null;
  if (!tous && AUTRE_OBJET.test(t) && !/\bversion/.test(t)) return null;
  const ratios = tous ? [...RATIOS_DECLINAISON] : cites;
  const retrait = RETRAIT.test(t);
  const liste = ratios.map((r) => NOMS[r]);
  const noms = liste.length > 1 ? `${liste.slice(0, -1).join(", ")} et ${liste[liste.length - 1]}` : liste[0];
  const pluriel = ratios.length > 1;
  return retrait
    ? { ajouter: [], retirer: ratios, reponse: `C'est noté : plus de version${pluriel ? "s" : ""} ${noms}.` }
    : { ajouter: ratios, retirer: [], reponse: `C'est parti : la version${pluriel ? "s" : ""} ${noms} ${pluriel ? "arrivent" : "arrive"}, cadrée${pluriel ? "s" : ""} pour ce format.` };
}

/** Formats demandés dans les consignes dites pendant le tournage (« Monteur, fais-moi aussi une version carrée »). */
export function formatsDesConsignes(consignes: { texte: string }[]): RatioDeclinaison[] {
  const voulus = new Set<RatioDeclinaison>();
  for (const c of consignes) {
    const d = comprendreDemandeFormats(c.texte);
    d?.ajouter.forEach((r) => voulus.add(r));
    d?.retirer.forEach((r) => voulus.delete(r));
  }
  return RATIOS_DECLINAISON.filter((r) => voulus.has(r));
}
