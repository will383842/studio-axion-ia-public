/**
 * IMAGE → VIDÉO · Écriture du script (plan § 1 [5] et § 4) : 1 appel Claude Opus, 2 au plus avec une relance guidée
 * par les refus exacts. Chaque appel est réservé AVANT d'être lancé, à son coût PIRE (`pireCasRequete`).
 *
 * Entrée de Claude : la carte VALIDÉE (données, jamais instructions), sa complexité, la recette du type, la phrase-choc
 * à dire, les choix de Will. Contexte : le socle de Will (charte, style, preuves) fourni par `services/cas-concret-socle.ts`
 * (sans phrase de la v4), suivi de la priorité du format ; aucun modèle de ton : le ton est décrit en mots (décision de
 * Will du 18/10). Le mot « machine » se trouve dans le texte complet de la v4, pas dans les extraits : la consigne
 * interdit de l'employer, par précaution.
 *
 * Sortie : la fiche `fiche-image/1`, contrôlée par `regles.ts`. Ce que Claude peut corriger déclenche la relance ; ce
 * que seul Will tranche (formules absolues, phrase-choc de l'image à reformuler) part avec le script, surligné.
 * Simulation (aucune clé) : `ecriture.simulation.ts` rend les scripts A-F de `40` d'après l'empreinte de l'image.
 */
import { textesDeLaCarte, type CarteImage } from "@/domaine/image-video/carte";
import { complexiteDe, DEBIT_MOTS_PAR_SEC, type ComplexiteCarte } from "@/domaine/image-video/complexite";
import { FAMILLES_ACCROCHE, PARTIES, SCENES, schemaFicheImage, type FicheImage } from "@/domaine/image-video/fiche";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { pireCasRequete, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";
import { APPELS_ECRITURE_MAX, MAX_TOKENS_ECRITURE } from "./emprunts";
import { ficheSimulee, ficheSimuleeRecit } from "./ecriture.simulation";
import { ANNONCE_SITUATION_TYPE, ETIQUETTE_SITUATION_TYPE, PARCOURS_RECIT, RECETTES, annonceAttendue, lireDecoupage, scenesPermises, type CodeRecit } from "./recettes";
import {
  ACCROCHE_IV_MOTS_MAX,
  INTERDITS_PERMANENTS,
  MOTS_PAR_PHRASE_MAX,
  QUESTION_MOTS_MAX,
  TOLERANCE_DUREE_IV,
  aCorrigerParClaude,
  aTrancherParWill,
  chiffresDuTexte,
  empreinteDeCarte,
  nombresDuTexte,
  phraseChocAttendue,
  verifierScript,
  type ContexteRegles,
  type Manquement,
  type VerdictScript,
} from "./regles";

/** Au plus 2 appels (le premier, et une relance guidée par les refus) et le plafond de jetons du cas concret (24 000 depuis le 15/10). */
export { APPELS_ECRITURE_MAX, MAX_TOKENS_ECRITURE };
export const ETAPE_ECRITURE = "Image → vidéo · écriture";
export const PREFIXE_APPEL_ECRITURE = "ivecr";

/** Le mot « machine » (déjà vu dans un ancien exemple de ton) : jamais employé. */
export const CONSIGNE_MOT_MACHINE = "N'emploie jamais le mot « machine » (dis « automatisation »).";
/** Dite entre la charte de Will et les règles du format. */
export const PRIORITE_REGLES_IMAGE_VIDEO = "Pour ce format, les règles « image → vidéo » (la consigne) passent avant la charte générale quand elles diffèrent.";

const liste = (xs: readonly string[]) => xs.map((x) => `« ${x} »`).join(", ");

/** Consigne fixe du rôle (en cache côté service). Les règles sont celles de `regles.ts`. */
export const CONSIGNE_ECRITURE_IV = `Tu écris le CORPS d'une vidéo verticale « image → vidéo » : une infographie d'Axion-IA prend vie, une voix dit le texte pendant que l'image se reconstruit à l'écran, bloc par bloc. La carte de l'image, validée par Will, est dans <carte> : c'est ta seule source.

TON (celui de la vidéo de référence, la v4) : on PARLE, on n'écrit pas. Phrases courtes, concrètes, au présent, en « vous » ; chaque phrase montre une action ; aucun adjectif creux. La promesse redite juste après l'accroche (« Oui, le premier. »), une bascule courte (« Maintenant… »). Aucune vidéo existante n'est donnée en exemple : le ton est décrit ici en mots, écris chaque script comme s'il n'existait aucun autre.
${CONSIGNE_MOT_MACHINE}

OSSATURE (6 parties, dans l'ordre, chaque écran porte sa partie) : ${liste(PARTIES)}.
- accroche : ${ACCROCHE_IV_MOTS_MAX} mots dits au plus, finie avant 3 s ; deux accroches de familles différentes (${liste(FAMILLES_ACCROCHE)}) dans "accroches" ; le premier écran dit la première.
- douleur : ce que vit le public sans la solution.
- début de réponse : la bascule ; il annonce le nombre quand <annonce> le donne (« deux chemins », « cinq choses »), avant le premier élément.
- explication : l'image de bout en bout, en suivant <recette>. Image d'automatisation (<situation_type> = oui) : le premier écran de l'explication commence par « ${ANNONCE_SITUATION_TYPE} » et affiche « ${ETIQUETTE_SITUATION_TYPE} » ; jamais un vrai client.
- résultat : les chiffres du bandeau, dits tels qu'écrits.
- phrase-choc : <phrase_choc>, MOT POUR MOT, en dernier.
Déroulé du récit : quand <recit> est présent, il fixe la place des parties et la façon de raconter ; il passe avant l'ordre ci-dessus, jamais avant les règles.
Après le corps, hors des écrans : "questionCommentaire", UNE question en « vous » propre au contenu de l'image, ${QUESTION_MOTS_MAX} mots au plus, sans mot à écrire en commentaire, sans lien, sans promesse (ex. « Et chez vous, combien de messages attendent jusqu'au lendemain ? »).

RÈGLES (le script est refusé sinon) :
- Rien d'oublié : chaque chiffre de la carte marqué à dire est dit ; chaque bloc est cité dans les "refs" d'un écran (sauf une photo de personnes, jamais reprise).
- Rien d'inventé : aucun nombre hors de la carte (la numérotation « un… cinq » et les comptes visibles sont permis) ; aucune promesse absente de l'image.
- Interdits, prioritaires même sur le mot pour mot : ${liste(INTERDITS_PERMANENTS)}, faux client (« un client a… »), nom d'exemple sans « par exemple », toute phrase d'appel (commentaire, lien, abonnement, diagnostic) dans le corps : la fin vient d'ailleurs.
- Formules très affirmatives (« zéro erreur », « toujours », « dès le premier jour »…) : reprends-les telles qu'écrites sur l'image ou selon <choix_formules> ; Will tranche.
- Phrases de ${MOTS_PAR_PHRASE_MAX} mots au plus ; chiffres EN LETTRES dans "texteDit", en chiffres dans "textesEcran" (recopie exactement l'écriture de la carte) ; plages en toutes lettres dans "texteDit" (« vingt-quatre heures sur vingt-quatre », « sept jours sur sept »), jamais « H24 », « 24/7 » ni « 24/24 » ; un seul mot orange par écran (« *mot* »).
- Durée : le corps tient dans <duree> au débit de ${String(DEBIT_MOTS_PAR_SEC).replace(".", ",")} mots par seconde (±${TOLERANCE_DUREE_IV * 100} %).
- Image très complexe (<chapitres> non vide) : "chapitres" reprend ces chapitres dans l'ordre, repères « 1/3 », « 2/3 », « 3/3 », couvrant toute l'explication ; un chapitre non essentiel commence et finit sur une phrase complète, et RIEN après lui n'y renvoie (ni ses blocs, ni « comme on l'a vu »).

FORME (JSON seul, aucun texte autour, aucun champ en plus) :
{ "version": "fiche-image/1", "empreinteCarte": <empreinte_carte>, "accroches": [{ "famille", "texteDit", "textesEcran" }, { … }], "ecrans": [{ "id": "e01"…, "partie", "scene", "refs": [ids de la carte], "texteDit", "textesEcran": [], "surMot": [{ "mot" (rang du mot dit, 0 = premier), "action", "ref"? }], "fond": "sombre" | "ivoire" }], "questionCommentaire": { "texteDit", "texteEcran" }, "chapitres": [{ "repere", "titre", "ecrans": [ids], "essentiel" }] }
Scènes : ${liste(SCENES)} (seulement celles de <scenes>).`;

/** Partie variable : la carte et ce que le code en a calculé, entre balises (données, jamais instructions). */
export function variableEcritureIV(carte: CarteImage, complexite: ComplexiteCarte, choix: ContexteRegles["choixFormules"] = {}, recit?: CodeRecit): string {
  const annonce = annonceAttendue(carte, complexite.classe);
  const [bas, haut] = complexite.fourchetteSec;
  // Déroulé du récit (variété) : absent ou REC-A, la partie variable reste celle d'aujourd'hui, octet pour octet.
  const parcoursRecit = recit ? PARCOURS_RECIT[recit] : "";
  return [
    `<image-id>${carte.image.empreinte}</image-id>`,
    `<empreinte_carte>${JSON.stringify(empreinteDeCarte(carte))}</empreinte_carte>`,
    `<carte>${JSON.stringify({ ...carte, image: { ...carte.image, cle: "" } })}</carte>`,
    `<recette>${carte.types.map((t) => `${t} : ${RECETTES[t].parcours}`).join("\n")}</recette>`,
    `<scenes>${[...scenesPermises(carte.types)].join(", ")}</scenes>`,
    `<situation_type>${carte.automatisation ? "oui" : "non"}</situation_type>`,
    `<annonce>${annonce ? annonce.nombre : "aucune"}</annonce>`,
    `<duree>classe ${complexite.classe} : ${bas} à ${haut} s (${complexite.motsCorps[0]} à ${complexite.motsCorps[1]} mots)</duree>`,
    `<chapitres>${JSON.stringify(complexite.chapitres)}</chapitres>`,
    `<phrase_choc>${phraseChocAttendue(carte, choix)}</phrase_choc>`,
    `<choix_formules>${JSON.stringify(choix)}</choix_formules>`,
    ...(parcoursRecit ? [`<recit>${recit} · ${parcoursRecit}</recit>`] : []),
  ].join("\n");
}

/** Relance guidée : la même demande, la réponse précédente et ses refus exacts. */
export function variableRelanceIV(base: string, precedente: string, refus: readonly string[]): string {
  return `${base}\n<reponse_precedente>${precedente}</reponse_precedente>\n<refus>\n${refus.map((r) => `- ${r}`).join("\n")}\n</refus>\nCorrige chacun de ces refus et rends la fiche entière.`;
}

/** Lit `<balise>` dans la partie variable (simulation). */
function balise(variable: string, nom: string): string | undefined {
  return new RegExp(`<${nom}>([\\s\\S]*?)</${nom}>`).exec(variable)?.[1];
}

/** Simulation du rôle : la fiche A-F de `40` d'après l'empreinte de l'image (celle du récit demandé s'il en existe une) ; image inconnue → texte vide. */
function simulerEcritureIV(entree: EntreeRole): FicheImage | string {
  const image = balise(entree.variable, "image-id") ?? "";
  const recit = /^(REC-[A-D])\b/.exec(balise(entree.variable, "recit") ?? "")?.[1] as CodeRecit | undefined;
  return (recit ? ficheSimuleeRecit(image, recit) : null) ?? ficheSimulee(image) ?? "";
}

/** Rôle « écriture image → vidéo » : Opus (modèle d'écriture du studio), sortie JSON en texte, sans schéma envoyé. */
export const roleEcritureImageVideo = {
  id: "ecriture-image-video",
  version: 1,
  consigne: CONSIGNE_ECRITURE_IV,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: MAX_TOKENS_ECRITURE,
  simuler: simulerEcritureIV,
} satisfies DefinitionRole;

/**
 * Contexte d'un appel : le socle de Will (de `services/cas-concret-socle.ts`), sa charte suivie de la priorité du format
 * et le ton en mots suivi de l'interdiction du mot « machine » (redite voulue de la consigne). Sans socle : rien (jamais bloquant).
 */
export function contexteDuSocleIV(socle: EntreeRole["contexte"] | undefined): EntreeRole["contexte"] {
  if (!socle) return {};
  const charte = socle.contexteAxion?.trim();
  const ton = socle.gagnants?.trim();
  return {
    ...socle,
    ...(charte ? { contexteAxion: `${charte}\n\n${PRIORITE_REGLES_IMAGE_VIDEO}` } : {}),
    ...(ton ? { gagnants: `${ton}\n\n${CONSIGNE_MOT_MACHINE}` } : {}),
  };
}

/** Coût PIRE d'un appel (requête réellement envoyée : socle 1 h, consigne + schéma, entrée + sortie maximale), en dollars. */
export const coutEstimeUsd = pireCasRequete;

// ─── Outils injectés et résultat ─────────────────────────────────────────────────────────────────────────────────────

export type ReponseAppelIV =
  | { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; coutUsd?: number }
  | { ok: false; message: string };

export interface OutilsEcritureIV {
  /** UN appel du rôle, branché par le service sur le chemin de dépense du studio (double de test ici). */
  appeler: (role: DefinitionRole, entree: EntreeRole) => Promise<ReponseAppelIV>;
  /** Réserve le coût estimé AVANT l'appel ; refus → aucun appel. */
  budget: { reserver: (d: { appelId: string; videoId: string; etape: string; modele: string; coutEstimeUsd: number }) => Promise<{ ok: true } | { ok: false; message: string }> };
  /** Socle de Will (`blocsSocleWill` via `emprunts.ts`), jamais bloquant. */
  socle?: () => Promise<EntreeRole["contexte"] | undefined>;
}

export interface EntreeEcritureIV extends Omit<ContexteRegles, "complexite"> {
  videoId: string;
  versionId: string;
  /** Réglage du format ; seule valeur : « chapitres ». */
  decoupage?: unknown;
}

export type ResultatEcritureIV =
  | {
      ok: true;
      fiche: FicheImage;
      verdict: VerdictScript;
      /** Ce que Will doit trancher à la validation (surligné, avec une proposition). */
      aTrancher: Manquement[];
      appels: number;
      relance: boolean;
      simule: boolean;
      coutUsd?: number;
    }
  | { ok: false; motif: "reglage" | "budget" | "appel" | "refusee"; message: string; refus: string[]; appels: number }
  /**
   * Script écrit, mais le verdict n'est pas bon : il reste ce que seul Will peut trancher (formules absolues, phrase-choc
   * à reformuler). Il part avec le script, pour Will, sans relance de Claude ; rien n'est validé tant que ce n'est pas tranché.
   */
  | {
      ok: false;
      motif: "a-trancher";
      message: string;
      refus: string[];
      appels: number;
      fiche: FicheImage;
      verdict: VerdictScript;
      aTrancher: Manquement[];
      relance: boolean;
      simule: boolean;
      coutUsd?: number;
    };

export const DEBUT_REFUS_ECRITURE = "Script refusé";
const REPONSE_COUPEE = "La réponse a été coupée avant la fin : rendez une fiche plus courte, JSON seul et complet.";

export const idAppelEcritureIV = (e: Pick<EntreeEcritureIV, "videoId" | "versionId">, essai: number) => `${PREFIXE_APPEL_ECRITURE}-${e.videoId}-${e.versionId}-${essai}`;

/** Texte sans clôture Markdown qui l'enveloppe entièrement. */
function sansCloture(t: string): string {
  const m = /^\s*```[a-zA-Z]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```\s*$/.exec(t);
  return m ? m[1]! : t;
}

/** Lit la réponse : objet déjà lu (simulation) ou texte JSON. */
function lire(reponse: Extract<ReponseAppelIV, { ok: true }>): { ok: true; brute: unknown; texte: string } | { ok: false; refus: string; texte: string } {
  const d = reponse.donnees ?? reponse.texte;
  if (d === undefined || d === null || d === "") return { ok: false, refus: "La réponse est vide : aucune fiche rendue.", texte: "" };
  if (typeof d !== "string") return { ok: true, brute: d, texte: JSON.stringify(d) };
  try {
    const nu = sansCloture(d);
    return { ok: true, brute: JSON.parse(nu), texte: nu };
  } catch {
    return { ok: false, refus: "La réponse n'est pas un JSON lisible : rendez le JSON seul, sans texte autour.", texte: d };
  }
}

const UNITES_MOT = new Set(["jour", "h", "min", "sec"]);
/** Mot d'unité (singulier ou pluriel) : « jour(s) », « heure(s) », « minute(s) », « seconde(s) ». */
const MOT_UNITE = /^(?:jours?|heures?|minutes?|secondes?)$/iu;

/**
 * Nombre que l'image écrit SEUL (« au lieu de 45 », « 45 contre 12 ») alors que le script le dit avec une unité qu'elle
 * ne lui donne pas (« 45 jours ») : l'unité est retirée du texte, le nombre reste tel qu'écrit sur l'image. Aucun chiffre
 * n'est inventé ni changé ; un nombre absent de l'image (ou déjà permis avec son unité) n'est jamais touché.
 * Rend le texte et le rang (dans le texte dit) des mots retirés.
 */
export function sansUniteAbsenteDeLImage(texte: string, carte: CarteImage): { texte: string; retires: number[] } {
  const textes = textesDeLaCarte(carte);
  const permis = new Set<string>();
  for (const t of textes) for (const c of chiffresDuTexte(t.texte)) permis.add(`${c.valeur}|${c.unite}`);
  for (const c of carte.chiffres) if (c.valeur !== null) permis.add(`${c.valeur}|${c.unite}`);
  const seuls = new Set<number>();
  for (const t of textes) if (t.ou === "titre" || t.ou === "sousTitre") for (const c of chiffresDuTexte(t.texte)) if (c.valeur !== null && c.unite === "nombre") seuls.add(c.valeur);
  const retires: number[] = [];
  let mots = texte.split(/(\s+)/); // mots et séparateurs alternés
  for (const c of chiffresDuTexte(texte)) {
    if (c.valeur === null || !UNITES_MOT.has(c.unite) || permis.has(`${c.valeur}|${c.unite}`) || !seuls.has(c.valeur)) continue;
    for (let j = 2; j < mots.length; j += 2) {
      const unite = mots[j]!.replace(/[^\p{L}]+$/u, "");
      if (!MOT_UNITE.test(unite) && !/^(?:h|min|sec)$/iu.test(unite)) continue;
      const fin = mots[j]!.slice(unite.length);
      const k = [5, 4, 3, 2, 1].find((n) => {
        const avant = mots.filter((_, i) => i % 2 === 0).slice(Math.max(0, j / 2 - n), j / 2).join(" ");
        const lu = nombresDuTexte(avant);
        return j / 2 - n >= 0 && lu.length === 1 && lu[0] === c.valeur;
      });
      if (k === undefined) continue;
      retires.push(j / 2);
      mots = [...mots.slice(0, j - 2), mots[j - 2]! + fin, ...mots.slice(j + 1)];
      break;
    }
  }
  return { texte: mots.join(""), retires };
}

/** Applique `sansUniteAbsenteDeLImage` aux textes dits et écrits de la fiche (copie) ; recale les rangs des mots surlignés. */
export function normaliserNombresUnite(fiche: FicheImage, carte: CarteImage): FicheImage {
  const f = structuredClone(fiche);
  const net = (t: string) => sansUniteAbsenteDeLImage(t, carte);
  for (const e of f.ecrans) {
    const dit = net(e.texteDit);
    e.texteDit = dit.texte;
    for (const r of dit.retires) for (const s of e.surMot) if (s.mot >= r) s.mot = Math.max(0, s.mot - 1);
    e.textesEcran = e.textesEcran.map((t) => net(t).texte);
  }
  for (const a of f.accroches) {
    a.texteDit = net(a.texteDit).texte;
    a.textesEcran = a.textesEcran.map((t) => net(t).texte);
  }
  f.questionCommentaire = { texteDit: net(f.questionCommentaire.texteDit).texte, texteEcran: net(f.questionCommentaire.texteEcran).texte };
  return f;
}

/** Juge une réponse lue : forme (zod), nombres sans unité propre à l'image, puis règles. */
export function jugerFicheIV(brute: unknown, ctx: ContexteRegles): { ok: true; fiche: FicheImage; verdict: VerdictScript } | { ok: false; refus: string[] } {
  const forme = schemaFicheImage.safeParse(brute);
  if (!forme.success) return { ok: false, refus: forme.error.issues.slice(0, 20).map((i) => `Champ « ${i.path.join(".") || "fiche"} » : ${i.message}`) };
  const fiche = normaliserNombresUnite(forme.data, ctx.carte);
  const verdict = verifierScript(fiche, ctx);
  const aCorriger = aCorrigerParClaude(verdict);
  return aCorriger.length ? { ok: false, refus: aCorriger.map((m) => m.message) } : { ok: true, fiche, verdict };
}

/**
 * Écrit le script d'une carte validée. Au plus 2 appels, chacun précédé de sa réservation. `ok: false` : la main
 * revient à Will avec les refus en français ; aucun appel si le réglage est refusé.
 */
export async function ecrireScriptIV(entree: EntreeEcritureIV, outils: OutilsEcritureIV): Promise<ResultatEcritureIV> {
  const reglage = lireDecoupage(entree.decoupage);
  if (!reglage.ok) return { ok: false, motif: "reglage", message: reglage.message, refus: [reglage.message], appels: 0 };

  const role = roleEcritureImageVideo;
  const complexite = complexiteDe(entree.carte);
  const ctx: ContexteRegles = { ...entree, complexite };
  const base = variableEcritureIV(entree.carte, complexite, entree.choixFormules, entree.recit);
  let contexte: EntreeRole["contexte"] = {};
  try {
    contexte = contexteDuSocleIV(outils.socle ? await outils.socle() : undefined);
  } catch {
    contexte = {};
  }

  let variable = base;
  let refus: string[] = [];
  let appels = 0;
  let coutUsd: number | undefined;
  for (let essai = 1; essai <= APPELS_ECRITURE_MAX; essai++) {
    const entreeRole: EntreeRole = { contexte, variable };
    const appelId = idAppelEcritureIV(entree, essai);
    const reservation = await outils.budget.reserver({ appelId, videoId: entree.videoId, etape: ETAPE_ECRITURE, modele: role.modele, coutEstimeUsd: coutEstimeUsd(role, entreeRole) });
    if (!reservation.ok) return { ok: false, motif: "budget", message: `Écriture non lancée : ${reservation.message}`, refus, appels };

    appels++;
    const reponse = await outils.appeler(role, entreeRole);
    if (!reponse.ok) return { ok: false, motif: "appel", message: `Écriture interrompue : ${reponse.message}`, refus, appels };
    if (reponse.coutUsd !== undefined) coutUsd = (coutUsd ?? 0) + reponse.coutUsd;

    if (reponse.stopReason === "max_tokens") {
      refus = [REPONSE_COUPEE];
      variable = variableRelanceIV(base, "(réponse coupée, non reprise)", refus);
      continue;
    }
    const lecture = lire(reponse);
    const jugement = lecture.ok ? jugerFicheIV(lecture.brute, ctx) : { ok: false as const, refus: [lecture.refus] };
    if (jugement.ok) {
      const aTrancher = aTrancherParWill(jugement.verdict);
      const commun = { fiche: jugement.fiche, verdict: jugement.verdict, aTrancher, appels, relance: essai > 1, simule: reponse.simule, ...(coutUsd !== undefined ? { coutUsd } : {}) };
      // `ok` suit le verdict : un script qui attend un choix de Will n'est jamais rendu « bon ».
      if (!jugement.verdict.ok) {
        const refusWill = jugement.verdict.manquements.map((m) => m.message);
        return { ok: false, motif: "a-trancher", message: `Script écrit : ${refusWill.length} point(s) à trancher par Will avant validation.`, refus: refusWill, ...commun };
      }
      return { ok: true, ...commun };
    }
    refus = jugement.refus;
    variable = variableRelanceIV(base, lecture.texte, refus);
  }
  return { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} après ${APPELS_ECRITURE_MAX} essais (${refus.length} refus) : à reprendre à la main.`, refus, appels };
}
