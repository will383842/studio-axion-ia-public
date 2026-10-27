/**
 * IMAGE → VIDÉO · Textes de publication des 5 réseaux (plan 50 § 6). PUR.
 *
 * Facebook, Instagram, TikTok, YouTube Shorts : adaptateur vers `textesDePublication` du cas concret (emprunté).
 * LinkedIn (depuis le 26/10/2026) : la vidéo dit et affiche la fin comme les autres réseaux ; le texte du post la reprend
 * et le lien est dans le premier commentaire (posé à la main), jamais de « commentez ». Seul le plan d'une vidéo faite avant
 * (LinkedIn muet) garde l'ancien texte, où la question propre à l'image ET la phrase du lien sont dans le post.
 * Les interdits sont contrôlés sur le texte du post ET sur le premier commentaire.
 */
import {
  CONSIGNE_PREMIER_COMMENTAIRE,
  INDICATION_FACEBOOK,
  MOTS_INTERDITS_FORMAT,
  appelDeLaBanque,
  premierCommentaireDiagnostic,
  textesDePublication,
  type OuPoserLeLien,
  type PlanDesFins,
} from "./emprunts";
import { RESEAUX_IV_HISTORIQUE, type ReseauIV } from "@/domaine/image-video/plafonds";
import { sorteDuPlanIV, type PlanDesFinsIV } from "./fins";
import { FINS_DE_SECOURS_IV, phraseDeRepliIV } from "./secours";

export const TITRE_SHORTS_MAX = 60;
// À TRAITER AVANT D'ACTIVER LE TOUR (`PAGE_TOUR_DE_FRANCE_IA` reste `null`) : le texte du post (ci-dessous, il vient encore de
// la fin « diagnostic ») et le chemin de secours d'une fin Tour (`secours.ts`, lignes `fin-iv-…` pensées pour le lien suivi
// du diagnostic) ne sont pas encore prévus pour le Tour.
/** Premier commentaire de la fin « Tour de France IA » (le lien suivi mène à la page du Tour). */
export const premierCommentaireTour = (lien: string): string => `Le Tour de France IA : ${lien}`;
const PHRASE_LIEN_LINKEDIN_REPLI = "Le lien du diagnostic gratuit est en premier commentaire.";

export interface ContenuPublicationIV {
  accroche: string;
  resultat: string;
  /** Question propre à l'image ; `fin-seule` : absente partout. */
  questionCommentaire?: string;
}

export interface ManquementPublication {
  reseau: ReseauIV;
  champ: "texte" | "premier-commentaire";
  detail: string;
}

export interface TextePublicationIV {
  reseau: ReseauIV;
  texte: string;
  premierCommentaire?: string;
  ouPoserLeLien: OuPoserLeLien;
  consigneLien: string;
  /** YouTube Shorts seulement : ≤ 60 caractères. */
  titre?: string;
}

export interface PublicationIV {
  textes: TextePublicationIV[];
  manquements: ManquementPublication[];
}

const phrase = (t: string): string => {
  const s = t.trim();
  return /[.!?…]$/.test(s) ? s : `${s}.`;
};

const echapper = (m: string): string => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mot ou expression interdit présent dans `texte` (mot entier, sans tenir compte de la casse). */
export function interditsDans(texte: string, interdits: readonly string[]): string[] {
  return interdits.filter((m) => new RegExp(`(^|[^\\p{L}\\p{N}])${echapper(m)}(?![\\p{L}\\p{N}])`, "iu").test(texte));
}

/** Titre Shorts : l'accroche, coupée au dernier mot entier avant 60 caractères. */
export function titreShorts(accroche: string): string {
  const t = accroche.trim().replace(/\s+/g, " ");
  if (t.length <= TITRE_SHORTS_MAX) return t;
  const coupe = t.slice(0, TITRE_SHORTS_MAX + 1);
  const i = coupe.lastIndexOf(" ");
  return (i > 0 ? coupe.slice(0, i) : t.slice(0, TITRE_SHORTS_MAX)).replace(/[,;:\s]+$/, "");
}

/**
 * 15/10 · Fins de secours (`secours.ts`) : le lien reste en PREMIER COMMENTAIRE (« … juste sous la vidéo. » le décrit,
 * sans le mot « commentaire » à l'écran). Repli (Facebook reprend Instagram) : la vidéo dit « Le lien est dans mon
 * profil. » ; le post le dit aussi (cohérent), et Will peut AUSSI poser le lien en premier commentaire (texte prêt).
 */
function lienDeSecours(plan: PlanDesFinsIV, reseau: ReseauIV, lien: string | undefined, ou: OuPoserLeLien, consigne: string): Partial<TextePublicationIV> {
  const fin = plan.fins.find((f) => f.reseaux.includes(reseau));
  if (!fin || !lien || ou === "aucun") return {};
  const indication = reseau === "facebook" ? ` ${INDICATION_FACEBOOK}` : "";
  // 19/10 : la fin de secours d'Instagram et de Shorts garde le lien dans le PROFIL : publication normale du réseau.
  if (fin.secours && FINS_DE_SECOURS_IV[reseau]?.lien === "profil") return {};
  if (fin.secours) return { premierCommentaire: premierCommentaireDiagnostic(lien), ouPoserLeLien: "premier-commentaire", consigneLien: `${CONSIGNE_PREMIER_COMMENTAIRE}${indication}` };
  if (!fin.repli) return {};
  const dit = fin.appels.find((a) => a.type === "lien")?.dit ?? "";
  return {
    premierCommentaire: premierCommentaireDiagnostic(lien),
    consigneLien: `${consigne} ${phraseDeRepliIV(fin.reseaux, fin.repli)} La vidéo dit « ${dit} » : vous pouvez aussi poser ce lien en premier commentaire (texte prêt).${indication}`,
  };
}

export function textesDePublicationIV(
  contenu: ContenuPublicationIV,
  plan: PlanDesFinsIV,
  liens: Readonly<Record<string, string>>,
  motsInterdits: readonly string[] = [],
): PublicationIV {
  const interdits = [...MOTS_INTERDITS_FORMAT, ...motsInterdits];
  const question = contenu.questionCommentaire?.trim();
  const textes: TextePublicationIV[] = [];

  // 1. Les réseaux de la fin : le texte est bâti par `textesDePublication` (cas concret), sur une fiche réduite. LinkedIn
  // en fait partie dès qu'il dit la fin (non muet) ; la fin « Tour » a son propre premier commentaire.
  const tour = sorteDuPlanIV(plan) === "tour";
  const fiche = {
    ecrans: [
      { type: "accroche", lignes: [contenu.accroche] },
      { type: "resultat", ligne: contenu.resultat },
      ...(question ? [{ type: "question", question }] : []),
    ],
  } as unknown as Parameters<typeof textesDePublication>[0];
  const planCas = {
    fins: plan.fins.filter((f) => !f.muet).map((f) => ({ id: f.id, reseaux: f.reseaux, appels: f.appels, ecrans: [] })),
    reduites: [],
    sansFin: [],
  } as unknown as PlanDesFins;
  for (const t of textesDePublication(fiche, planCas, liens)) {
    const reseau = t.reseau as ReseauIV;
    textes.push({
      reseau,
      texte: t.texte,
      ...(t.premierCommentaire ? { premierCommentaire: tour && liens[reseau] ? premierCommentaireTour(liens[reseau]) : t.premierCommentaire } : {}),
      ouPoserLeLien: t.ouPoserLeLien,
      consigneLien: t.consigneLien,
      ...(reseau === "youtube-shorts" ? { titre: titreShorts(contenu.accroche) } : {}),
      ...lienDeSecours(plan, reseau, liens[reseau], t.ouPoserLeLien, t.consigneLien),
    });
  }

  // 2. LinkedIn d'une vidéo faite avant le 26/10 (plan muet) : rien n'est dit dans la vidéo, tout est dans le texte du post.
  if (plan.fins.some((f) => f.muet) && liens.linkedin) {
    const phraseLien = appelDeLaBanque("fin-li-rdv-texte")?.legende || PHRASE_LIEN_LINKEDIN_REPLI;
    const lignes = [phrase(contenu.accroche), phrase(contenu.resultat), ...(question ? [question] : []), phraseLien];
    textes.push({
      reseau: "linkedin",
      texte: lignes.join("\n\n"),
      premierCommentaire: premierCommentaireDiagnostic(liens.linkedin),
      ouPoserLeLien: "premier-commentaire",
      consigneLien: CONSIGNE_PREMIER_COMMENTAIRE,
    });
  }

  // 3. Interdits sur le post ET sur le premier commentaire ; jamais « commentez » sur LinkedIn.
  const manquements: ManquementPublication[] = [];
  for (const t of textes) {
    const champs: [ManquementPublication["champ"], string | undefined][] = [["texte", t.texte], ["premier-commentaire", t.premierCommentaire]];
    for (const [champ, valeur] of champs) {
      if (!valeur) continue;
      for (const m of interditsDans(valeur, interdits)) manquements.push({ reseau: t.reseau, champ, detail: `Le mot interdit « ${m} » figure dans le ${champ === "texte" ? "texte du post" : "premier commentaire"}.` });
    }
    if (t.reseau === "linkedin" && /(^|[^\p{L}])(commentez|écrivez[^.?!]*commentaire)/iu.test(t.texte)) {
      manquements.push({ reseau: "linkedin", champ: "texte", detail: "Aucun appel à commenter sur LinkedIn." });
    }
  }
  textes.sort((a, b) => ORDRE.indexOf(a.reseau) - ORDRE.indexOf(b.reseau));
  return { textes, manquements };
}

const ORDRE: readonly ReseauIV[] = RESEAUX_IV_HISTORIQUE;

/** Consigne du fil Facebook (lot F45) : la vidéo 4:5 part en publication du fil, à côté du Reel 9:16. */
export const CONSIGNE_FIL_FACEBOOK = "Publier aussi la vidéo 4:5 dans le fil Facebook (publication classique, pas un Reel), avec le même texte, puis poser le même lien en premier commentaire de cette publication.";

/**
 * Texte du FIL Facebook (fichier 4:5, décision de Will du 16/10 : Facebook = deux fichiers). La vidéo dit la même fin
 * (« Le lien est en commentaire ») : même texte que le Reel, même lien en premier commentaire, posé à la main. PUR.
 * `null` : Facebook n'a pas de texte (réseau non demandé).
 */
export function texteFilFacebookIV(publication: Pick<PublicationIV, "textes">): { texte: string; premierCommentaire?: string; consigneLien: string } | null {
  const reel = publication.textes.find((t) => t.reseau === "facebook");
  if (!reel) return null;
  return { texte: reel.texte, ...(reel.premierCommentaire ? { premierCommentaire: reel.premierCommentaire } : {}), consigneLien: CONSIGNE_FIL_FACEBOOK };
}
