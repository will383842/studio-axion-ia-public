// Vidéos sur le site, lot S2 — contrôles avant publication (PUR). Aucune liste de mots ici : tout est LU dans
// `src/domaine/qualite-script/` (liste unique des interdits). Un test garde-fou (s2-liste-unique) le vérifie.
import { contientExpression } from "@/domaine/controles-script/texte";
import { interditCertificationSeule, interditsCommuns, interditsDans, interditsTousEcrivains, type InterditPermanent } from "@/domaine/qualite-script/regles/interdits";
import { MOTS_TEMOIGNAGE } from "@/moteurs/montage-cas-concret/regles";
import type { EcrivainInterdits } from "@/domaine/qualite-script/types";
import { titreCommenceParCodeInterne } from "@/domaine/miniatures";
import { casesRequises, nomCourtFormat } from "@/formats";
import { TITRE_WEB_MAX } from "./passeport";
import type { PasseportWeb } from "./types";

import { avisPublies, certificationObtenue, type ReglagesDuSite } from "./reglages-site";

export interface EntreeControlesSite {
  formatId: string;
  /** avocat, facecam, facecam-animee, podcast → "ecrire" ; tableau-anime → "tableau" ; cas-concret → "cas-concret" ; image-video → "image-video". */
  ecrivain: EcrivainInterdits | null;
  passeport: PasseportWeb;
  /** `siteGenerateurs.<formatId>` */
  generateurAllume: boolean;
  videoPrete: boolean;
  typeDerive?: "extrait" | "traduction" | "autre-ratio" | "variante-accroche" | "variante-reseau";
  /** Une autre vidéo du même `scriptMaitreId` (ou même `sourceVideoId`) est en ligne. */
  autreVersionEnLigne: boolean;
  dureeSec: number;
  /** Segments de sous-titres non vides. */
  sousTitres: boolean;
  vignette: { largeur: number; hauteur: number } | null;
  /** `video.entrees` contient une entrée `logo-client`. */
  entreeLogoClient: boolean;
  licencesABloquer: number;
  avantDePublier: { image: boolean; son: boolean; sousTitres: boolean; mentionIA: boolean; droits: boolean };
  mentionIAActive: boolean;
  /** Case de la feuille « Aucun client nommé, aucun logo ». */
  caseAucunClient: boolean;
  reglagesSite: ReglagesDuSite;
}

export interface ControleSite {
  /** « SITE-01 »… */
  code: string;
  gravite: "bloquant" | "avertissement";
  ok: boolean;
  /** Une phrase, vouvoiement, sans jargon. */
  message: string;
  champ?: keyof PasseportWeb;
}

export interface ResultatControlesSite {
  /** Aucun contrôle bloquant en échec. Les avertissements ne bloquent jamais (Will décide). */
  publiable: boolean;
  controles: ControleSite[];
}

/* ------------------------------------------------------------------ */
/* Textes contrôlés, chacun séparément (le message dit OÙ)              */
/* ------------------------------------------------------------------ */

interface TexteControle {
  ou: string;
  champ: keyof PasseportWeb;
  texte: string;
}

function textesDuPasseport(p: PasseportWeb): TexteControle[] {
  return [
    { ou: "Le titre", champ: "titreWeb", texte: p.titreWeb },
    { ou: "Le résumé", champ: "resume", texte: p.resume },
    { ou: "La transcription", champ: "transcription", texte: p.transcription },
    ...p.chapitres.map((c) => ({ ou: "Un chapitre", champ: "chapitres" as const, texte: c.libelle })),
    ...p.aRetenir.map((t) => ({ ou: "Un point « À retenir »", champ: "aRetenir" as const, texte: t })),
    ...p.questions.flatMap((q) => [
      { ou: "Une question", champ: "questions" as const, texte: q.question },
      { ou: "Une réponse", champ: "questions" as const, texte: q.reponse },
    ]),
    ...p.motsCles.map((t) => ({ ou: "Un mot-clé", champ: "motsCles" as const, texte: t })),
    { ou: "La rubrique", champ: "rubrique", texte: p.rubrique },
  ];
}

/** Libellé de la liste sans ses guillemets (le message les remet). */
const sansGuillemets = (libelle: string) => libelle.replace(/[«»]/g, "").replace(/\s+/g, " ").trim();

/** Un contrôle par échec (avec son champ), ou un seul contrôle vert quand rien n'échoue. */
function controle(code: string, gravite: ControleSite["gravite"], echecs: { message: string; champ?: keyof PasseportWeb }[], messageOk: string): ControleSite[] {
  if (!echecs.length) return [{ code, gravite, ok: true, message: messageOk }];
  return echecs.map((e) => ({ code, gravite, ok: false, message: e.message, ...(e.champ ? { champ: e.champ } : {}) }));
}

/** Interdits trouvés, champ par champ : `trouve` dit si le texte porte l'interdit. */
function interditsParChamp(textes: TexteControle[], interdits: InterditPermanent[], trouve: (i: InterditPermanent, texte: string) => boolean) {
  return textes.flatMap((t) => interdits.filter((i) => trouve(i, t.texte)).map((i) => ({ champ: t.champ, message: `${t.ou} contient « ${sansGuillemets(i.libelle)} » : retirez-le.` })));
}

/* ------------------------------------------------------------------ */
/* Les contrôles                                                       */
/* ------------------------------------------------------------------ */

/** SITE-01 : interdits communs aux quatre écrivains, chacun de leurs tests. */
function site01(e: EntreeControlesSite): ControleSite[] {
  const echecs = interditsParChamp(textesDuPasseport(e.passeport), interditsCommuns(), (i, t) => Object.values(i.tests).some((test) => test?.(t)));
  return controle("SITE-01", "bloquant", echecs, "Aucun mot interdit.");
}

/** SITE-02 : interdits de l'écrivain du générateur (sans répéter les interdits communs de SITE-01). */
function site02(e: EntreeControlesSite): ControleSite[] {
  if (!e.ecrivain) return controle("SITE-02", "bloquant", [], "Aucun mot interdit pour ce type de vidéo.");
  const ecrivain = e.ecrivain;
  const communs = new Set(interditsCommuns().map((i) => i.cle));
  const echecs = textesDuPasseport(e.passeport).flatMap((t) =>
    interditsDans(t.texte, ecrivain)
      .filter((i) => !communs.has(i.cle))
      .map((i) => ({ champ: t.champ, message: `${t.ou} contient « ${sansGuillemets(i.libelle)} » : retirez-le.` })),
  );
  return controle("SITE-02", "bloquant", echecs, "Aucun mot interdit pour ce type de vidéo.");
}

/**
 * SITE-03 : revendication de la certification. La revendication (« certifié » + le nom, dans les deux ordres) est
 * refusée TOUJOURS ; le nom seul l'est tant que le site ne dit pas que la certification est obtenue (inconnu = non).
 */
function site03(e: EntreeControlesSite): ControleSite[] {
  const seul = certificationObtenue(e.reglagesSite) ? undefined : interditCertificationSeule();
  const echecs = textesDuPasseport(e.passeport).flatMap((t): { champ: keyof PasseportWeb; message: string }[] => {
    if (interditsTousEcrivains(t.texte).length) return [{ champ: t.champ, message: `${t.ou} revendique la certification : retirez-le.` }];
    if (seul?.tests["image-video"]?.(t.texte)) return [{ champ: t.champ, message: `Pas de mention de ${sansGuillemets(seul.libelle)} tant que la certification n'est pas obtenue.` }];
    return [];
  });
  return controle("SITE-03", "bloquant", echecs, "Aucune revendication de certification.");
}

/** SITE-04 : tant que les avis sont coupés sur le site (ou inconnus), aucun mot de la liste des avis, aucune vidéo « avis client ». */
function site04(e: EntreeControlesSite): ControleSite[] {
  if (avisPublies(e.reglagesSite)) return controle("SITE-04", "bloquant", [], "Les avis sont publiés sur le site.");
  const echecs: { champ?: keyof PasseportWeb; message: string }[] = [];
  if (e.formatId === "avis-client") echecs.push({ message: "Les avis clients sont coupés : ce type de vidéo ne va pas sur le site." });
  for (const t of textesDuPasseport(e.passeport)) {
    const mot = MOTS_TEMOIGNAGE.find((m) => contientExpression(t.texte, m));
    if (mot) echecs.push({ champ: t.champ, message: `Les avis clients sont coupés : retirez « ${mot} » (${t.ou.toLowerCase()}).` });
  }
  return controle("SITE-04", "bloquant", echecs, "Aucun avis client dans la page.");
}

/** SITE-05 : aucun nom de client, aucun logo (l'entrée « logo client » ou la case de relecture). */
function site05(e: EntreeControlesSite): ControleSite[] {
  const ok = !e.entreeLogoClient && e.caseAucunClient;
  return [ok ? { code: "SITE-05", gravite: "bloquant", ok, message: "Aucun client nommé, aucun logo." } : { code: "SITE-05", gravite: "bloquant", ok, message: "Cochez « Aucun client nommé, aucun logo » après avoir vérifié." }];
}

/** SITE-06 : droits des images, polices et voix. */
function site06(e: EntreeControlesSite): ControleSite[] {
  if (e.licencesABloquer > 0) return [{ code: "SITE-06", gravite: "bloquant", ok: false, message: `${e.licencesABloquer > 1 ? `${e.licencesABloquer} licences ne sont pas en règle` : "Une licence n'est pas en règle"} : corrigez-la dans « Droits » de la vidéo.` }];
  if (!e.avantDePublier.droits) return [{ code: "SITE-06", gravite: "bloquant", ok: false, message: "Cochez « Droits » dans « Avant de publier » après avoir vérifié." }];
  return [{ code: "SITE-06", gravite: "bloquant", ok: true, message: "Les droits sont en règle." }];
}

const LIBELLES_CASES: Record<keyof EntreeControlesSite["avantDePublier"], string> = { image: "Image", son: "Son", sousTitres: "Sous-titres", mentionIA: "Mention IA", droits: "Droits" };

/** SITE-07 : les cases « Avant de publier » du kit (5, ou 4 quand la mention IA est coupée), les mêmes que pour les réseaux. */
function site07(e: EntreeControlesSite): ControleSite[] {
  const manque = casesRequises(e.mentionIAActive).filter((c) => !e.avantDePublier[c]);
  if (!manque.length) return [{ code: "SITE-07", gravite: "bloquant", ok: true, message: "Les vérifications sont faites." }];
  return [{ code: "SITE-07", gravite: "bloquant", ok: false, message: `Cochez d'abord : ${manque.map((c) => LIBELLES_CASES[c]).join(", ")}.` }];
}

/** SITE-08 : sous-titres présents (le fichier .vtt est fabriqué à la publication, lot S4). */
function site08(e: EntreeControlesSite): ControleSite[] {
  return [e.sousTitres ? { code: "SITE-08", gravite: "bloquant", ok: true, message: "Les sous-titres sont là." } : { code: "SITE-08", gravite: "bloquant", ok: false, message: "Il faut des sous-titres pour le site." }];
}

/** Largeur minimale de l'affiche 16:9 du site, en pixels. */
export const LARGEUR_MIN_AFFICHE = 1200;

/** SITE-09 : vignette présente, 1200 px de large au moins (l'affiche 16:9 du site). */
function site09(e: EntreeControlesSite): ControleSite[] {
  if (!e.vignette) return [{ code: "SITE-09", gravite: "bloquant", ok: false, message: "Il manque la vignette du site." }];
  if (e.vignette.largeur < LARGEUR_MIN_AFFICHE) return [{ code: "SITE-09", gravite: "bloquant", ok: false, message: `La vignette du site fait ${e.vignette.largeur} px de large : ${LARGEUR_MIN_AFFICHE} au moins, au format 16:9.` }];
  return [{ code: "SITE-09", gravite: "bloquant", ok: true, message: "La vignette est prête." }];
}

/** SITE-10 : une page qui n'est pas pauvre : résumé, 3 « À retenir », 2 ou 3 questions-réponses, rubrique. */
function site10(e: EntreeControlesSite): ControleSite[] {
  const p = e.passeport;
  const manque: string[] = [];
  if (!p.resume.trim()) manque.push("un résumé");
  if (p.aRetenir.length !== 3 || p.aRetenir.some((t) => !t.trim())) manque.push("3 points « À retenir »");
  if (p.questions.length < 2 || p.questions.length > 3 || p.questions.some((q) => !q.question.trim() || !q.reponse.trim())) manque.push("2 questions avec leur réponse");
  if (!p.rubrique.trim()) manque.push("une rubrique");
  if (!manque.length) return [{ code: "SITE-10", gravite: "bloquant", ok: true, message: "La page est complète." }];
  const liste = manque.length > 1 ? `${manque.slice(0, -1).join(", ")} et ${manque[manque.length - 1]}` : manque[0];
  return [{ code: "SITE-10", gravite: "bloquant", ok: false, message: `Ajoutez ${liste}.`, champ: !p.resume.trim() ? "resume" : p.aRetenir.length !== 3 ? "aRetenir" : p.rubrique.trim() ? "questions" : "rubrique" }];
}

/** SITE-11 : titre web de 1 à 60 caractères, sans code interne. */
function site11(e: EntreeControlesSite): ControleSite[] {
  const titre = e.passeport.titreWeb.trim();
  const echec = (message: string): ControleSite[] => [{ code: "SITE-11", gravite: "bloquant", ok: false, message, champ: "titreWeb" }];
  if (!titre) return echec("Le titre est vide.");
  if (titre.length > TITRE_WEB_MAX) return echec(`Le titre fait ${titre.length} caractères : ${TITRE_WEB_MAX} au plus.`);
  if (titreCommenceParCodeInterne(titre)) return echec("Retirez le code interne au début du titre.");
  return [{ code: "SITE-11", gravite: "bloquant", ok: true, message: "Le titre convient." }];
}

/** SITE-12 : le générateur est autorisé sur le site (réglage `siteGenerateurs.<id>`). */
function site12(e: EntreeControlesSite): ControleSite[] {
  return [e.generateurAllume ? { code: "SITE-12", gravite: "bloquant", ok: true, message: "Ce type de vidéo est autorisé sur le site." } : { code: "SITE-12", gravite: "bloquant", ok: false, message: `Les vidéos « ${nomCourtFormat({ id: e.formatId })} » ne vont pas sur le site (Réglages › Sur le site).` }];
}

/** SITE-13 : la vidéo est prête. */
function site13(e: EntreeControlesSite): ControleSite[] {
  return [e.videoPrete ? { code: "SITE-13", gravite: "bloquant", ok: true, message: "La vidéo est prête." } : { code: "SITE-13", gravite: "bloquant", ok: false, message: "La vidéo n'est pas prête." }];
}

const VARIANTES = ["variante-accroche", "variante-reseau", "autre-ratio"] as const;

/** SITE-14 : une seule version d'un sujet sur le site, jamais une variante. */
function site14(e: EntreeControlesSite): ControleSite[] {
  if (e.autreVersionEnLigne) return [{ code: "SITE-14", gravite: "bloquant", ok: false, message: "Une autre version de cette vidéo est déjà sur le site." }];
  if (e.typeDerive && (VARIANTES as readonly string[]).includes(e.typeDerive)) return [{ code: "SITE-14", gravite: "bloquant", ok: false, message: "Cette vidéo est une variante d'une autre : publiez la vidéo d'origine." }];
  return [{ code: "SITE-14", gravite: "bloquant", ok: true, message: "Ce n'est pas une variante." }];
}

/** Durée sous laquelle une vidéo est courte pour une page (et n'a pas de chapitres). */
export const DUREE_PAGE_MIN_SEC = 30;

/** SITE-15 : durée d'au moins 30 s (avertissement seul : Will décide). */
function site15(e: EntreeControlesSite): ControleSite[] {
  if (e.dureeSec >= DUREE_PAGE_MIN_SEC) return [{ code: "SITE-15", gravite: "avertissement", ok: true, message: "La durée convient." }];
  return [{ code: "SITE-15", gravite: "avertissement", ok: false, message: `Vidéo de ${Math.round(e.dureeSec)} s : courte pour une page. Vous décidez.` }];
}

/** SITE-16 : chapitres : aucun sous 30 s, au moins deux sinon, débuts distincts, le premier à 0. */
function site16(e: EntreeControlesSite): ControleSite[] {
  const c = e.passeport.chapitres;
  const echec = (message: string): ControleSite[] => [{ code: "SITE-16", gravite: "bloquant", ok: false, message, champ: "chapitres" }];
  if (!c.length) return [{ code: "SITE-16", gravite: "bloquant", ok: true, message: "Pas de chapitres." }];
  if (e.dureeSec < DUREE_PAGE_MIN_SEC) return echec("Une vidéo de moins de 30 s n'a pas de chapitres.");
  if (c.length < 2) return echec("Il faut au moins deux chapitres, ou aucun.");
  if (c[0].debutSec !== 0) return echec("Le premier chapitre doit commencer à 0.");
  if (new Set(c.map((x) => x.debutSec)).size !== c.length) return echec("Deux chapitres commencent au même moment.");
  return [{ code: "SITE-16", gravite: "bloquant", ok: true, message: "Les chapitres sont en ordre." }];
}

/** SITE-17 : contenu généré (double, voix) : le site affichera la mention (avertissement d'information). */
function site17(e: EntreeControlesSite): ControleSite[] {
  if (!e.passeport.contenuGenere) return [{ code: "SITE-17", gravite: "avertissement", ok: true, message: "Aucune mention IA à afficher." }];
  return [{ code: "SITE-17", gravite: "avertissement", ok: false, message: "Le site affichera « Vidéo réalisée avec un double numérique »." }];
}

export function controlerAvantSite(entree: EntreeControlesSite): ResultatControlesSite {
  const controles = [...site01(entree), ...site02(entree), ...site03(entree), ...site04(entree), ...site05(entree), ...site06(entree), ...site07(entree), ...site08(entree), ...site09(entree), ...site10(entree), ...site11(entree), ...site12(entree), ...site13(entree), ...site14(entree), ...site15(entree), ...site16(entree), ...site17(entree)];
  return { publiable: !controles.some((c) => !c.ok && c.gravite === "bloquant"), controles };
}
