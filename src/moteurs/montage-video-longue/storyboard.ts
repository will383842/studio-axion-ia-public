/**
 * CONSTRUCTEUR PUR DU STORY-BOARD de la vidéo longue sans voix (lot QUALL-2) : mots horodatés (avec les TROUS réservés aux
 * cartons par la minuterie) → carton-titre, cartons de chapitre, scènes de contenu déduites du texte, fin, sous-titres.
 * Aucune IA, aucun réseau. PUR : lu aussi par la composition Remotion → chemins RELATIFS seulement (jamais « @/ »).
 */
import {
  ADRESSE_LONGUE_DEFAUT,
  FORMAT_LONGUE,
  LIBELLE_APPEL_LONGUE,
  TAILLES_LONGUE,
  TEMPS_LONGUE,
  VERSION_STORYBOARD,
  ZONES_LONGUE,
  type AlerteStoryboard,
  type ChapitreStoryboard,
  type ConstruireStoryboard,
  type FondScene,
  type FormeLongue,
  type LigneSousTitre,
  type SceneLongue,
  type StoryboardVideoLongue,
  type TransitionLongue,
} from "./storyboard-types";
import { couperLignes } from "../../briques/motion/mesure";
import { abreger, decouperPhrases, deduireScenes, fusionner, indiceCoupe, majuscule, phraseDe, type MotMs, type PhraseLue, type SceneBrouillon } from "./deduction";

const T = TEMPS_LONGUE;
const ms = (sec: number) => Math.round(sec * 1000);
/** Un trou plus court que cela ne porte pas de carton. */
const TROU_MIN_MS = 1000;
/** Marge de sécurité de la mesure : le rendu ne doit jamais dépasser 2 lignes. */
const LARGEUR_UTILE_SOUS_TITRE = ZONES_LONGUE.texteSousTitres.largeur * 0.96;
/** Tolérance de bord de chapitre (même règle que `chapitresPourPlan`). */
const TOLERANCE_MS = 100;

const MOTS_DE_LIAISON = new Set(["de", "du", "des", "le", "la", "les", "l'", "un", "une", "à", "au", "aux", "et", "ou", "en", "dans", "sur", "par", "pour", "avec", "que", "qui", "leur", "son", "sa", "ses", "ce", "cette"]);
const GENERIQUE = /^chapitre\s*\d*$/i;

function titreDeduit(premiere: string | undefined): string {
  if (!premiere) return "Suite";
  const sans = premiere.replace(/[\s.!?…]+$/u, "");
  const avantDeuxPoints = sans.split(":")[0].trim();
  const base = avantDeuxPoints && avantDeuxPoints.split(/\s+/).length >= 2 ? avantDeuxPoints : sans;
  const mots = abreger(base, 8).replace(/…$/, "").split(/\s+/);
  while (mots.length > 2 && MOTS_DE_LIAISON.has(mots[mots.length - 1].toLowerCase())) mots.pop();
  return majuscule(mots.join(" ").replace(/[\s,;:]+$/, ""));
}

/** Une ligne de sous-titres tient en 2 lignes de 46 px dans la bande. */
function tient(texte: string): boolean {
  return couperLignes(texte, TAILLES_LONGUE.sousTitrePx, 600, LARGEUR_UTILE_SOUS_TITRE).length <= TAILLES_LONGUE.sousTitreLignesMax;
}

/** Sous-titres d'une phrase : entière si elle tient, sinon demi-phrases (≥ 1 200 ms chacune). */
function lignesDe(lus: MotMs[], debutMs: number, finMs: number): LigneSousTitre[] {
  const texte = lus.map((m) => m.mot).join(" ");
  const seule = [{ texte, debutMs, finMs }];
  if (tient(texte)) return seule;
  const j = indiceCoupe(lus);
  if (!j) return seule;
  const coupe = lus[j].debutMs;
  if (coupe - debutMs < T.sousTitreMinMs || finMs - coupe < T.sousTitreMinMs) return seule;
  return [...lignesDe(lus.slice(0, j), debutMs, coupe), ...lignesDe(lus.slice(j), coupe, finMs)];
}

export const storyboardVideoLongue: ConstruireStoryboard = (entrees, temps) => {
  const dureeMs = Math.max(0, ms(temps.dureeSec));
  const question = (entrees.question ?? "").replace(/\s+/g, " ").trim() || null;
  const adresse = entrees.adresse?.trim() || ADRESSE_LONGUE_DEFAUT;
  const alertes: AlerteStoryboard[] = [];

  /* Chapitres : bornes contiguës de 0 à dureeMs. */
  const sources = temps.chapitres.length ? temps.chapitres : [{ debutSec: 0, finSec: temps.dureeSec, libelle: "" }];
  const debuts: number[] = [];
  sources.forEach((c, i) => {
    const d = i === 0 ? 0 : Math.min(dureeMs, Math.max(debuts[i - 1], ms(c.debutSec)));
    debuts.push(d);
  });
  const fins = debuts.map((_, i) => (i + 1 < debuts.length ? debuts[i + 1] : dureeMs));

  const lus: MotMs[] = temps.mots.map((m) => ({ mot: m.mot, debutMs: ms(m.debutSec), finMs: ms(m.finSec) }));
  const total = sources.length;
  const scenes: SceneLongue[] = [];
  const sousTitres: LigneSousTitre[] = [];
  const chapitres: ChapitreStoryboard[] = [];
  const etat: { forme: FormeLongue | null } = { forme: null };
  let n = 0;
  const idScene = () => `s${String(++n).padStart(2, "0")}`;
  let finDebutMs = dureeMs;
  let finPossible = false;

  sources.forEach((src, i) => {
    const rang = i + 1;
    const chapitreId = `c${rang}`;
    const dernier = i === total - 1;
    const motsDuChapitre = lus.filter((m) => (i === 0 || m.debutMs >= debuts[i] - TOLERANCE_MS) && (dernier || m.debutMs < fins[i] - TOLERANCE_MS));
    const groupes = decouperPhrases(motsDuChapitre);

    // Fin du contenu du chapitre : début du carton suivant, ou fin de la dernière phrase + respiration (avant la fin).
    const finLecture = motsDuChapitre.length ? motsDuChapitre[motsDuChapitre.length - 1].finMs : debuts[i];
    const finContenu = dernier ? (motsDuChapitre.length ? Math.min(dureeMs, finLecture + T.respirationMs) : Math.max(debuts[i], dureeMs - T.finMs)) : fins[i];
    const premierMot = groupes[0]?.[0].debutMs;

    // Phrases avec la fin de leur fenêtre (début de la suivante, sinon fin du contenu).
    const phrases: PhraseLue[] = groupes.map((g, k) => phraseDe(g, groupes[k + 1] ? groupes[k + 1][0].debutMs : finContenu));

    // Titre : celui du script, sinon tiré de la première phrase.
    let titre = src.libelle.trim();
    if (!titre || GENERIQUE.test(titre)) {
      titre = titreDeduit(phrases[0]?.texte);
      alertes.push({ code: "titre-deduit", message: `Chapitre ${rang} : titre tiré de sa première phrase (« ${titre} »).`, instantMs: debuts[i] });
    }
    chapitres.push({ id: chapitreId, rang, titre, debutMs: debuts[i], finMs: fins[i] });

    /* Cartons : les trous laissés par la minuterie. */
    let curseur = debuts[i];
    let titreSeul = false;
    const finTrou = premierMot ?? finContenu;
    if (i === 0 && question) {
      const reste = finTrou - curseur;
      if (reste >= T.cartonTitreMs + TROU_MIN_MS) {
        scenes.push({ id: idScene(), chapitreId, type: "carton-titre", debutMs: 0, finMs: T.cartonTitreMs, fond: "ivoire", entree: "aucune", question });
        curseur = T.cartonTitreMs;
      } else if (reste >= TROU_MIN_MS) {
        scenes.push({ id: idScene(), chapitreId, type: "carton-titre", debutMs: 0, finMs: finTrou, fond: "ivoire", entree: "aucune", question });
        curseur = finTrou;
        titreSeul = true;
        alertes.push({ code: "carton-sans-place", message: "Le trou avant la première phrase est trop court : carton de titre seul, sans carton de chapitre 1.", instantMs: 0 });
      } else {
        alertes.push({ code: "carton-sans-place", message: "Aucun trou au début de la vidéo : pas de carton de titre.", instantMs: 0 });
      }
    }
    if (finTrou - curseur >= TROU_MIN_MS) {
      scenes.push({ id: idScene(), chapitreId, type: "carton-chapitre", debutMs: curseur, finMs: finTrou, fond: "noir", entree: "volet", rang, total, titre });
      curseur = finTrou;
    } else if (!titreSeul) {
      alertes.push({ code: "carton-sans-place", message: `Chapitre ${rang} : trou trop court avant la première phrase, pas de carton de chapitre.`, instantMs: debuts[i] });
    }

    /* Contenu : fusion des phrases trop courtes, puis déduction. */
    const unites: PhraseLue[] = [];
    for (const p of phrases) {
      const prec = unites[unites.length - 1];
      if (prec && prec.finMs - prec.debutMs < T.sceneMinMs) unites[unites.length - 1] = fusionner(prec, p);
      else unites.push(p);
    }
    if (unites.length > 1 && unites[unites.length - 1].finMs - unites[unites.length - 1].debutMs < T.sceneMinMs) {
      const derniere = unites.pop()!;
      unites[unites.length - 1] = fusionner(unites[unites.length - 1], derniere);
    }
    const contenu = deduireScenes(unites, { titre, texteChapitre: phrases.map((p) => p.texte).join(" "), etat });
    contenu.forEach((c, k) => {
      const b: SceneBrouillon = k === 0 ? { ...c.scene, debutMs: Math.min(c.scene.debutMs, curseur) } : c.scene;
      scenes.push({ ...b, id: idScene(), chapitreId, fond: "ivoire", entree: "fondu" } as SceneLongue);
    });

    /* Sous-titres : une ligne par phrase, jamais pendant un carton ou la fin. */
    for (const p of phrases) sousTitres.push(...lignesDe(p.mots, p.debutMs, p.finMs));

    if (dernier) {
      finDebutMs = Math.max(finContenu, curseur);
      finPossible = dureeMs - finDebutMs >= TROU_MIN_MS;
    }
  });

  if (finPossible) {
    const dernierChapitre = `c${total}`;
    scenes.push({ id: idScene(), chapitreId: dernierChapitre, type: "fin", debutMs: finDebutMs, finMs: dureeMs, fond: "noir", entree: "fondu", question, appel: LIBELLE_APPEL_LONGUE, adresse });
  } else if (dureeMs > 0) {
    alertes.push({ code: "carton-sans-place", message: "Aucun trou pour la fin « Prendre rendez-vous » : la vidéo se termine sur la dernière phrase.", instantMs: dureeMs });
  }

  /* Contiguïté : chaque scène finit où la suivante commence ; la première commence à 0, la dernière finit à dureeMs. */
  scenes.forEach((s, k) => {
    if (k === 0) s.debutMs = 0;
    s.finMs = k + 1 < scenes.length ? scenes[k + 1].debutMs : dureeMs;
  });

  /* Transitions : volet avant un carton de chapitre, glisse entre deux types différents, fondu sinon. */
  scenes.forEach((s, k) => {
    const fond: FondScene = s.type === "carton-chapitre" || s.type === "fin" ? "noir" : "ivoire";
    s.fond = fond;
    let entree: TransitionLongue;
    if (k === 0) entree = "aucune";
    else if (s.type === "carton-chapitre") entree = "volet";
    else if (s.type === "fin") entree = "fondu";
    else entree = scenes[k - 1].type !== s.type ? "glisse" : "fondu";
    s.entree = entree;
  });

  return { version: VERSION_STORYBOARD, format: FORMAT_LONGUE, dureeMs, question, chapitres, scenes, sousTitres, alertes };
};

export type { StoryboardVideoLongue };
