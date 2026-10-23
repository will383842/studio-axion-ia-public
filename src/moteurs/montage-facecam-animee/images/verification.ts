/**
 * LES PHOTOS ET LOGOS (lot D) — CONSIGNES DU CONTRÔLE VISUEL, PUR.
 *
 * PHOTOS : Claude regarde la VIGNETTE de l'image retenue, avec les mots dits, et dit si elle peut entrer dans la vidéo
 * (`lireVerdict`) ; une métaphore non dite est refusée (passe 2).
 * MINI-VIDÉOS : Claude reçoit UNE image EXTRAITE du passage préparé (`imageDeControle` : jamais la vignette de la
 * banque ; `instantsDeControle` : où l'extraire), avec « illustre » (les mots exacts dits par Will) et
 * « recherche » (ce que la fenêtre doit montrer), et rend un verdict : « littéral » (l'image montre exactement ce qui
 * est dit), « métaphore » (une image d'idée, symbolique) ou « hors sujet ». Seul « littéral » passe (retour de Will du
 * 14/10 : « chaque animation représente en animation ce que la personne dit »), et seulement sans texte incrusté, sans
 * logo de marque, sans visage en très gros plan.
 * Au moindre doute (réponse illisible), REFUS : une image douteuse est remplacée, jamais montrée.
 * PASSE 3 : le juge est la PHRASE DITE (`phrase`, tirée de la transcription par `phraseDite`), la recherche n'est
 * qu'une piste. BRANCHÉ (passe 3 intégration) : `images/index.ts` envoie `phrase` (via `dep.mots`) aux consignes
 * ; tout candidat (réutilisations comprises) passe par `essayerMiniVideo`, donc par le contrôle visuel. Sans `mots`,
 * le juge reste `illustre`.
 */

/**
 * Passe 3 (revue du 15/10) : l'image est jugée contre la PHRASE DITE, pas contre la recherche. La recherche n'est qu'une
 * piste : une image qui colle à la recherche mais pas à ce que dit la phrase est HORS SUJET (vidéo 3 : « trouver la
 * fuite » illustré par un clavier, « leur après-midi » par des mains et des cartes).
 */
const REGLE_PHRASE = `JUGE L'IMAGE CONTRE LA PHRASE DITE, JAMAIS CONTRE LA PISTE DE RECHERCHE : la piste a pu se tromper. Une image qui correspond à la piste mais ne montre pas ce que dit la phrase est hors sujet. Exemples : « on cherche d'où vient la perte » → un clavier, un tableau blanc ou un bureau vide sont hors sujet, on veut voir quelqu'un qui cherche, examine, vérifie ; « ils ont retrouvé leur soirée » → des mains qui jouent aux cartes ou un bureau sont hors sujet, on veut voir des gens qui partent du travail ou profitent de leur temps libre ; « un client voulait embaucher » → une personne qui lit ou écrit est hors sujet, on veut voir un entretien d'embauche.`;

export const CONSIGNE_VERIFICATION_IMAGE = `Tu contrôles une image d'illustration pour une courte vidéo verticale d'Axion-IA (formation et automatisation pour les entreprises).
Phrase dite à ce moment : « {phrase} ».
Ce que l'image doit montrer dans cette phrase : « {illustre} ».
Piste de recherche (indicative) : « {recherche} ».
${REGLE_PHRASE}
Refuse l'image si l'une de ces règles n'est pas tenue :
1. Elle montre CONCRÈTEMENT la chose, le lieu, la personne ou l'action que dit la PHRASE : on reconnaît tout de suite ce qui est dit. Refuse une image vague, abstraite, sans rapport, ou une MÉTAPHORE (un symbole : horloge, sablier, goutte d'eau, ampoule, puzzle… dont l'objet n'est pas dit). Si la phrase nomme une personne ou une action (recruter, appeler, taper, signer, livrer, chercher, partir…), l'image montre une personne en train de LA faire (pas autre chose).
2. Aucune marque, aucun logo, aucun produit reconnaissable (téléphone ou ordinateur dont la marque se voit compris).
3. Aucun texte lisible en langue étrangère, aucun filigrane.
4. Aucune personne reconnaissable : pas de visage net et de face, personne ne regarde l'objectif. Des mains, des silhouettes de dos ou floues sont acceptées.
5. Rien de choquant, de dévalorisant ni de daté.
Réponds seulement par ce JSON : {"accepte": true ou false, "raison": "une phrase courte en français"}`;

/**
 * Remplit une consigne : `phrase` = la phrase entière dite autour de la fenêtre (absente : `illustre`, puis la
 * recherche), `illustre` = les mots exacts que l'image montre (absent : la phrase).
 */
function remplir(modele: string, recherche: string, illustre?: string, phrase?: string): string {
  const mots = illustre?.trim() ? illustre : phrase?.trim() ? phrase : recherche;
  const dite = phrase?.trim() ? phrase : mots;
  return modele.replace("{phrase}", nettoyer(dite)).replace("{illustre}", nettoyer(mots)).replace("{recherche}", nettoyer(recherche));
}

/** La consigne prête à envoyer (photo), avec la piste de recherche, les mots montrés et la phrase dite. */
export function consigneVerification(recherche: string, illustre?: string, phrase?: string): string {
  return remplir(CONSIGNE_VERIFICATION_IMAGE, recherche, illustre, phrase);
}

/**
 * La phrase dite autour d'une fenêtre, tirée de la transcription : du début de la phrase en cours 2 s avant la fenêtre
 * jusqu'à 1 s après sa fin (coupée aux points), ≤ 160 caractères. Sert de juge au contrôle visuel.
 */
export function phraseDite(mots: readonly { w: string; a: number }[], debut: number, fin: number): string {
  const dedans = [...mots].sort((x, y) => x.a - y.a).filter((m) => m.a >= debut - 2 - 1e-6 && m.a <= fin + 1 + 1e-6);
  // On part du dernier point avant la fenêtre, on s'arrête au premier point après sa fin.
  let i0 = 0;
  dedans.forEach((m, i) => {
    if (m.a < debut && /[.!?…]$/.test(m.w)) i0 = i + 1;
  });
  let i1 = dedans.length;
  for (let i = i0; i < dedans.length; i++) {
    if (dedans[i].a > fin && /[.!?…]$/.test(dedans[i].w)) {
      i1 = i + 1;
      break;
    }
  }
  const texte = dedans.slice(i0, i1).map((m) => m.w).join(" ").trim();
  return texte.length > 160 ? `${texte.slice(0, 159).trimEnd()}…` : texte;
}

export interface VerdictImage {
  accepte: boolean;
  raison: string;
}

const nettoyer = (s: string) => s.replace(/[«»"{}]/g, "").trim();

/** Lecture tolérante de la réponse de Claude (JSON éventuellement entouré de texte) ; illisible → refus. */
export function lireVerdict(reponse: string): VerdictImage {
  const v = lireJson(reponse);
  if (v && typeof v.accepte === "boolean") return { accepte: v.accepte, raison: typeof v.raison === "string" && v.raison.trim() ? v.raison.trim() : v.accepte ? "conforme" : "refusée" };
  return { accepte: false, raison: "contrôle illisible" };
}

function lireJson(reponse: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(reponse);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ---------------- Mini-vidéos : littéral, métaphore ou hors sujet ---------------- */

export const VERDICTS_LITTERALITE = ["littéral", "métaphore", "hors sujet"] as const;
export type Litteralite = (typeof VERDICTS_LITTERALITE)[number];

export const CONSIGNE_VERIFICATION_MINI_VIDEO = `Tu contrôles une MINI-VIDÉO d'illustration pour une courte vidéo verticale où un dirigeant parle face caméra. Tu vois une image EXTRAITE du passage exact qui sera montré (pas la vignette de la banque) : juge ce que l'on voit sur cette image, pas ce que le titre promet.
Phrase dite à ce moment : « {phrase} ».
Ce que la mini-vidéo doit montrer dans cette phrase : « {illustre} ».
Piste de recherche (indicative) : « {recherche} ».
${REGLE_PHRASE}
Rends un verdict :
- "littéral" : l'image montre concrètement la chose, le lieu, la personne ou l'action que dit la PHRASE (on reconnaît tout de suite ce qui est dit). Si la phrase nomme une personne ou une action (recruter, appeler, taper, signer, livrer, chercher, partir…), on voit une personne en train de LA faire ; un objet seul, ou une personne qui fait autre chose, ne suffit pas ;
- "métaphore" : l'image évoque l'idée de façon symbolique ou indirecte (horloge ou sablier pour « le temps », goutte d'eau pour « une perte », ampoule pour « une idée »…), sauf si cet objet est lui-même dit ;
- "hors sujet" : l'image montre autre chose (une personne qui écrit quand on parle de recruter, des lunettes sur un cahier quand on parle d'une rencontre), ou rien de clair.
Signale aussi :
- "texte" : un texte incrusté ou LISIBLE sur un téléphone (titre, sous-titre, filigrane, enseigne, mots qu'on peut lire). Des gribouillis, une écriture floue ou trop petite pour être lue (tableau blanc au fond, feuilles de dossier, écran lointain) ne comptent pas comme « texte » ;
- "logo" : un logo ou une marque reconnaissable (produit dont la marque se voit compris) ;
- "grosPlanVisage" : un visage en très gros plan, net et de face, qui occupe une grande partie de l'image (il ferait concurrence à l'orateur).
Réponds seulement par ce JSON : {"verdict": "littéral" | "métaphore" | "hors sujet", "texte": true ou false, "logo": true ou false, "grosPlanVisage": true ou false, "raison": "une phrase courte en français"}`;

/** La consigne prête à envoyer (mini-vidéo) : piste de recherche, mots montrés, phrase dite (le juge). */
export function consigneVerificationMiniVideo(recherche: string, illustre?: string, phrase?: string): string {
  return remplir(CONSIGNE_VERIFICATION_MINI_VIDEO, recherche, illustre, phrase);
}

/**
 * TOUTES les fenêtres passent le contrôle visuel, réutilisations et replis compris (passe 3 : le clavier de « trouver
 * la fuite » était une photo de la vidéo 2 reprise sans contrôle). NON BRANCHÉ au 15/10 : `images/index.ts`
 * (propriétaire : mini-vidéos) doit le lire sur le repli « Mes images » : un média déjà validé pour UNE phrase ne l'est
 * pas pour une autre.
 */
export const CONTROLE_VISUEL_SUR_LES_REPLIS = true;

/**
 * L'image qu'on montre à Claude pour juger une mini-vidéo : une image EXTRAITE du passage préparé (fichier local,
 * dernière des images extraites s'il y en a plusieurs), JAMAIS la vignette de la banque (une adresse http(s)), qui ne
 * montre pas forcément le passage retenu. Null : pas d'image extraite, le candidat est refusé (on ne juge pas à l'aveugle).
 */
export function imageDeControle(prep: { image?: string; images?: readonly string[] } | undefined): string | null {
  const locales = (x: readonly string[]) => x.filter((s) => s.trim() && !/^https?:\/\//i.test(s));
  const extraites = locales(prep?.images ?? []);
  if (extraites.length) return extraites[extraites.length - 1];
  return locales(prep?.image ? [prep.image] : [])[0] ?? null;
}

/**
 * Instants (en secondes DANS LA SOURCE) où extraire les images de contrôle d'un passage [depuisSec, depuisSec + durée] :
 * au tiers, au milieu et aux deux tiers du passage réellement montré.
 */
export function instantsDeControle(depuisSec: number, dureeSec: number): number[] {
  const d = Math.max(0, dureeSec);
  return [1 / 3, 1 / 2, 2 / 3].map((k) => Math.round((Math.max(0, depuisSec) + d * k) * 100) / 100);
}

export interface VerdictMiniVideo extends VerdictImage {
  verdict: Litteralite;
  texteIncruste: boolean;
  logo: boolean;
  visageGrosPlan: boolean;
}

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

/** Lecture tolérante du verdict d'une mini-vidéo ; illisible → « hors sujet » refusé. Seul « littéral » sans défaut passe. */
export function lireVerdictMiniVideo(reponse: string): VerdictMiniVideo {
  const v = lireJson(reponse);
  const brut = v && typeof v.verdict === "string" ? normaliser(v.verdict) : "";
  const verdict: Litteralite | null = brut === "litteral" || brut === "literal" ? "littéral" : brut === "metaphore" || brut === "metaphor" ? "métaphore" : brut === "hors sujet" || brut === "off topic" ? "hors sujet" : null;
  if (!v || !verdict) return { accepte: false, verdict: "hors sujet", texteIncruste: false, logo: false, visageGrosPlan: false, raison: "contrôle illisible" };
  const texteIncruste = v.texte === true;
  const logo = v.logo === true;
  const visageGrosPlan = v.grosPlanVisage === true;
  const raisonDite = typeof v.raison === "string" && v.raison.trim() ? v.raison.trim() : verdict;
  const defaut = texteIncruste ? "texte incrusté" : logo ? "logo de marque" : visageGrosPlan ? "visage en très gros plan" : null;
  const accepte = verdict === "littéral" && !defaut;
  return { accepte, verdict, texteIncruste, logo, visageGrosPlan, raison: accepte ? raisonDite : `${verdict}${defaut ? ` (${defaut})` : ""} : ${raisonDite}` };
}
