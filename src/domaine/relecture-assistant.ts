/**
 * RELIRE LE SCRIPT AVANT LA VIDÉO, brique 6 sur 8 : l'ADAPTATEUR de l'assistant « Votre vidéo » (avocat, face caméra
 * avatar). PUR, importable côté client et côté serveur : l'écran et le lancement calculent les lignes, donc l'empreinte,
 * de la même façon (voir `domaine/relecture-script`).
 * Une ligne par segment du script (ce que la voix dit), le titre à l'écran du segment comme texte écrit modifiable,
 * groupées par bloc de la recette (« Accroche »…).
 */
import { appliquerSaisie, empreinte, type DifferenceLigne, type LigneScript } from "@/domaine/relecture-script";
import type { BlocScript, Distribution } from "@/domaine/types";

/** Identifiant d'une ligne : bloc et segment (un segment n'est unique que dans son bloc). */
const idLigne = (blocId: string, segmentId: string) => `${blocId}/${segmentId}`;

/** Les lignes du script ; `nomBloc` donne le nom de la partie (absent : pas de regroupement). */
export function lignesDesBlocs(blocs: readonly BlocScript[], nomBloc?: (blocRecette: string) => string | undefined): LigneScript[] {
  return blocs.flatMap((b) => {
    const groupe = nomBloc?.(b.blocRecette);
    return b.segments.map((s) => ({
      id: idLigne(b.id, s.id),
      dit: s.texte,
      ...(groupe ? { groupe } : {}),
      ...(s.titreEcran !== undefined ? { ecrits: [{ texte: s.titreEcran, modifiable: true }] } : {}),
    }));
  });
}

/** Les lignes après les différences reçues (le serveur refait ainsi le script relu, sans croire l'écran). */
export function lignesApres(lignes: readonly LigneScript[], modifications: readonly DifferenceLigne[]): LigneScript[] {
  let suite = [...lignes];
  for (const m of modifications) {
    if (typeof m.dit === "string") suite = appliquerSaisie(suite, m.id, { dit: m.dit });
    (m.ecrits ?? []).forEach((texte, index) => {
      if (typeof texte === "string") suite = appliquerSaisie(suite, m.id, { ecrit: { index, texte } });
    });
  }
  return suite;
}

/** Les différences relues, reportées dans les blocs (seuls les blocs touchés sont copiés). Phrase vide : refus. */
export function blocsDepuisModifications(blocs: readonly BlocScript[], modifications: readonly DifferenceLigne[]): { ok: true; blocs: BlocScript[] } | { ok: false; raisons: string[] } {
  const raisons: string[] = [];
  const parId = new Map(modifications.map((m) => [m.id, m]));
  const vus = new Set<string>();
  let rang = 0;
  const suite = blocs.map((b) => {
    let touche = false;
    const segments = b.segments.map((s) => {
      rang++;
      const m = parId.get(idLigne(b.id, s.id));
      if (!m) return s;
      vus.add(m.id);
      touche = true;
      if (m.dit !== undefined && !m.dit.trim()) raisons.push(`La phrase ${rang} est vide.`);
      const titre = m.ecrits?.[0];
      return { ...s, ...(m.dit !== undefined ? { texte: m.dit.trim() } : {}), ...(titre != null && s.titreEcran !== undefined ? { titreEcran: titre } : {}) };
    });
    return touche ? { ...b, segments } : b;
  });
  for (const m of modifications) if (!vus.has(m.id)) raisons.push("Une phrase modifiée n'existe plus : rouvrez la relecture.");
  return raisons.length ? { ok: false, raisons } : { ok: true, blocs: suite };
}

/** Empreinte du texte qui sera fabriqué : celle que l'écran envoie au lancement (`scriptRelu`). */
export function empreinteDesBlocs(blocs: readonly BlocScript[]): string {
  return empreinte(lignesDesBlocs(blocs));
}

/**
 * La relecture n'est exigée (repère « script relu ») que si une VOIX DE SYNTHÈSE dit le texte, sur un format de l'écran
 * « Votre vidéo ». Seule une vidéo RÉELLEMENT filmée part sans : face caméra (le format ne connaît que le filmé, le
 * montage se cale sur la prise ; la relecture se fait avant le tournage, au téléprompteur), ou avocat en « rush » AVEC
 * ses prises (`prisesFilmees`, comme `estPrisesFilmees` du moteur avocat). Avocat en « rush » sans prises : le moteur
 * fait la voix de synthèse à partir du texte, la relecture est exigée. Seules les sources permises par le format sont
 * crues (une autre, venue d'un appel direct ou d'une ancienne donnée, est ignorée) ; aucune : celles du format.
 */
export function relectureAExiger(format: { etapes: readonly string[]; personnages: { sources: readonly ("double" | "rush")[] } }, distribution: readonly Pick<Distribution, "source">[] | undefined, prisesFilmees = false): boolean {
  if (!format.etapes.includes("express")) return false;
  const permises = format.personnages.sources;
  const choisies = (distribution ?? []).map((d) => d.source).filter((s) => permises.includes(s));
  if ((choisies.length ? choisies : permises).includes("double")) return true;
  return permises.includes("double") && !prisesFilmees;
}

/** Une ligne identique : même phrase dite, mêmes textes écrits. */
const memeLigne = (a: LigneScript, b: LigneScript) => a.dit === b.dit && JSON.stringify((a.ecrits ?? []).map((e) => e.texte)) === JSON.stringify((b.ecrits ?? []).map((e) => e.texte));

/**
 * Flèche retour de la relecture : les phrases retouchées sont gardées et reprises au prochain « Fabriquer », mais
 * seulement celles dont la ligne n'a pas bougé depuis (même phrase, mêmes écrits). Une phrase réécrite entre-temps
 * (feuille Script) garde sa correction la plus récente ; une phrase disparue n'est pas reprise.
 */
export function saisieAReprendre(blocs: readonly BlocScript[], gardee: { blocs: readonly BlocScript[]; modifications: readonly DifferenceLigne[] } | null): DifferenceLigne[] {
  if (!gardee?.modifications.length) return [];
  const avant = new Map(lignesDesBlocs(gardee.blocs).map((l) => [l.id, l]));
  const actuelles = new Map(lignesDesBlocs(blocs).map((l) => [l.id, l]));
  const fideles = gardee.modifications.filter((m) => {
    const a = avant.get(m.id);
    const b = actuelles.get(m.id);
    return !!a && !!b && memeLigne(a, b);
  });
  return fideles.length && blocsDepuisModifications(blocs, fideles).ok ? fideles : [];
}
