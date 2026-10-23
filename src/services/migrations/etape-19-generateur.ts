/**
 * MIGRATION : étape 19, générateur de scripts (plan v5 B.2.8, lot G1a). Prochain numéro libre après le lot
 * « intensité · crédits · calage » (16 à 18) ; numéro à confirmer par la session principale au moment de la fusion.
 *
 * Règles : IDEMPOTENTE (un second passage ne change rien et renvoie null), AUCUNE suppression, ids FIXES (une tournure
 * ou une règle archivée n'est jamais recréée, un élément existant n'est jamais réécrit).
 *  1. Fiche de style v1 : seulement si aucune n'existe ; tirée de `style.faconDeParler` SI ce réglage existe réellement
 *     en base (sinon une fiche vide, non validée : les valeurs par défaut ne sont jamais présentées comme le style de Will).
 *     Les mots interdits de Will deviennent des tournures (`source: "will"`, `bloquant`).
 *  2. Tournures : calibrage du lot GR (68 bloquantes, 19 en grappe ; les 19 présentes chez l'avocat de référence ne sont pas semées),
 *     liste « à ne jamais écrire » du parcours de Will, tiret long plafonné.
 *  3. Règles datées de B.5.4 (+ `hyp-ecriture-reseau`).
 *  4. Bibliothèque : « téléphone » et « logo » de l'incrustation d'appel.
 *  5. `contexte-axion-v0` : aucune position, aucune phrase de marque, aucun thème validé (une proposition est rangée à
 *     part) ; interdits préremplis avec les ordres permanents de Will, chacun avec son origine, à confirmer d'un toucher.
 *  6-7. Aucun ancien script ne reçoit de sujet, aucune matière n'est créée.
 */
import { PILIERS_ACTIVITES_AXION } from "@/donnees/generateur/domaine-axion";
import type { Depots } from "@/domaine/depots";
import type { ContexteAxion, ElementBibliotheque, FicheStyle, TourneInterdite } from "@/domaine/types";
import { REGLES_DATEES_SEMEES } from "@/donnees/generateur/regles-datees";
import { TOURNURES_CALIBREES } from "@/donnees/generateur/tournures-calibrees";

type TournureSemee = Omit<TourneInterdite, "creeLe" | "modifieLe">;

function slug(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function echapper(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Liste « à ne jamais écrire » du parcours de Will (fiche « parcours pour bio de conférencier », 27/09/2026). */
export const TOURNURES_PARCOURS: TournureSemee[] = [
  { id: "tournure-parcours-top-1-pourcent", motif: "Top 1 %", regex: "\\btop\\s*1\\s*%", type: "expression", niveau: "bloquant", portee: "partout", raison: "Aucune source : ne jamais l'écrire (parcours de Will).", source: "parcours" },
  { id: "tournure-parcours-cac-40", motif: "CAC 40", regex: "\\bcac\\s*40\\b", type: "expression", niveau: "bloquant", portee: "partout", raison: "Jamais « des PME au CAC 40 » : rien ne l'établit (parcours de Will).", source: "parcours" },
  { id: "tournure-parcours-faux-temoignages", motif: "Témoignages d'exemple du site", regex: "\\b(c\\.?\\s*lambert|m\\.?\\s*petit)\\b", type: "expression", niveau: "bloquant", portee: "partout", raison: "Témoignages d'exemple, pas de vrais clients (parcours de Will).", source: "parcours" },
  { id: "tournure-parcours-sci-saint-etienne", motif: "SCI de Saint-Étienne", regex: "\\bsci\\b.{0,20}saint[- ][ée]tienne", type: "expression", niveau: "bloquant", portee: "partout", raison: "Partie liée : jamais présentée comme un client (parcours de Will).", source: "parcours" },
  { id: "tournure-parcours-autres-activites", motif: "Autres activités de Will", regex: "\\b(sos[- ]?expat|autre-marque|worldexpat)\\b", type: "expression", niveau: "bloquant", portee: "partout", raison: "Hors du sujet Axion-IA (parcours de Will).", source: "parcours" },
];

/** Détecteurs de structure semés dès G1a (les autres arrivent avec les contrôles, G3). */
export const TOURNURES_STRUCTURE: TournureSemee[] = [
  { id: "tournure-boileau-tiret-long", motif: "Tiret long", regex: "—", type: "structure", niveau: "grappe", portee: "partout", raison: "Tic d'écriture des textes générés : plafonné (motif repris de Boileau, licence MIT).", reformulation: "Une virgule, deux-points ou un point.", source: "boileau" },
];

/** Thèmes PROPOSÉS (Bible §5 : IA appliquée, automatisation des PME, formation), à valider par Will : jamais appliqués avant. */
const PILIERS_PROPOSES: ContexteAxion["piliers"] = [
  { id: "ia-appliquee", nom: "L'IA au quotidien", motsCles: ["ia", "chatgpt", "assistant", "outil", "intelligence artificielle"] },
  { id: "automatisation", nom: "Automatiser les tâches d'une PME", motsCles: ["automatiser", "automatisation", "excel", "tableau", "facture", "saisie"] },
  { id: "formation", nom: "Former les équipes", motsCles: ["formation", "former", "équipe", "apprendre", "salariés"] },
  { id: "donnees", nom: "Données et confidentialité", motsCles: ["données", "rgpd", "confidentialité", "sécurité", "mails"] },
  { id: "pilotage", nom: "Piloter avec les bons chiffres", motsCles: ["pilotage", "chiffres", "indicateur", "décision", "rentabilité"] },
];

/** Ordres permanents de Will déjà donnés (B.2.8 n° 5) : ils ne font que RESTREINDRE ; confirmés d'un toucher en G2. */
export const INTERDITS: ContexteAxion["interdits"] = [
  { id: "interdit-reservation-directe", texte: "Jamais de réservation ni d'achat direct en ligne : toute demande passe par un appel ou un message.", regex: "\\b(r[ée]servez|achetez|payez)\\b.{0,30}\\b(en ligne|directement)\\b", origine: "Ordre de Will du 26/08/2026" },
  { id: "interdit-telephone-public", texte: "Aucun numéro de téléphone public : le contact passe par e-mail et par le rendez-vous en visio.", regex: "(\\+33\\s?|\\b0)[1-9]([ .-]?\\d{2}){4}\\b", origine: "Ordre de Will du 23/09/2026" },
  { id: "interdit-demarre", texte: "Ne jamais dire qu'Axion-IA démarre ni parler de son âge, dans un sens comme dans l'autre (« je démarre », « jeune entreprise », « depuis des années », « nos centaines de clients »).", regex: "\\bje d[ée]marre\\b|\\bjeune (entreprise|bo[iî]te|soci[ée]t[ée])\\b|\\bdepuis des ann[ée]es\\b|\\bnos centaines de clients\\b", origine: "Ordre de Will du 21/09/2026" },
  { id: "interdit-certifexemple", texte: "La certification Certifexemple n'est revendiquée que lorsque le réglage de production l'autorise.", regex: "\\bcertifexemple\\b", origine: "Ordre de Will (mention Certifexemple, 30/09/2026)" },
  { id: "interdit-trop-s-engager", texte: "Ne pas trop s'engager : pas de fréquence promise ni de conditions détaillées (« je réponds à chacun », « un point chaque semaine »).", regex: "\\bje r[ée]ponds [àa] chacun\\b|\\bpoint chaque semaine\\b|\\bchaque semaine,? un point\\b", origine: "Ordre de Will du 01/10/2026" },
];

const ELEMENTS_APPEL = (maintenant: string): ElementBibliotheque[] => {
  const base = { marqueId: "marque-axion", licence: { type: "propriete" as const, usageCommercial: true, reseaux: [] }, formatsParDefaut: [], creeLe: maintenant, modifieLe: maintenant };
  return [
    { ...base, id: "incrustation-appel-telephone", type: "illustration-image", nom: "Téléphone (incrustation d'appel)", motsCles: ["appel", "téléphone", "incrustation"], valeur: { type: "illustration-image" } },
    { ...base, id: "incrustation-appel-logo", type: "logo", nom: "Logo (incrustation d'appel)", motsCles: ["appel", "logo", "incrustation"], valeur: { type: "logo", variante: "clair" } },
  ];
};

export async function etape19Generateur(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  const resume: Record<string, unknown> = {};
  const horo = { creeLe: maintenant, modifieLe: maintenant };

  /* --- 1. Fiche de style v1 et mots interdits de Will --- */
  const tournuresWill: TournureSemee[] = [];
  const facon = (await d.parametres.obtenir("style.faconDeParler"))?.valeur as { expressions?: string[]; motsInterdits?: string[]; tutoiement?: boolean; notes?: string } | undefined;
  if ((await d.fichesStyle.compter()) === 0) {
    const fiche: FicheStyle = {
      id: "fiche-style-v1",
      version: 1,
      ouvertures: [],
      tournures: [],
      longueurPhraseMediane: 0,
      ecartTypeLongueurs: 0,
      expressions: facon?.expressions ?? [],
      motsBannis: facon?.motsInterdits ?? [],
      tutoiementObserve: facon?.tutoiement ?? false,
      notes: facon ? (facon.notes ?? "") : "Fiche vide : à remplir avec les textes de Will.",
      tireeDe: [],
      ...horo,
    };
    await d.fichesStyle.enregistrer(fiche);
    resume.ficheStyle = facon ? "tiree-de-ma-facon-de-parler" : "vide";
  }
  // Les mots interdits de Will sont semés MÊME si la fiche de style existe déjà (rapport sécurité n° 9) : idempotent
  // (ids fixes), rien n'est effacé, une tournure archivée par Will n'est jamais recréée.
  {
    for (const mot of facon?.motsInterdits ?? []) {
      if (!mot.trim()) continue;
      tournuresWill.push({ id: `tournure-will-${slug(mot)}`, motif: mot.trim(), regex: `(?<![\\p{L}\\p{N}_])${echapper(mot.trim())}(?![\\p{L}\\p{N}_])`, type: "expression", niveau: "bloquant", portee: "partout", raison: "Mot interdit par Will (« Ma façon de parler »).", source: "will" });
    }
  }

  /* --- 2. Tournures (ids fixes ; une tournure archivée n'est jamais recréée) --- */
  const calibrees: TournureSemee[] = TOURNURES_CALIBREES.map((t) => ({
    id: t.id,
    motif: t.motif,
    regex: t.regex,
    type: t.type,
    niveau: t.niveau,
    portee: "partout",
    raison:
      t.niveau === "bloquant"
        ? "Absente des 34 transcriptions humaines du lot GR (l'avocat de référence, experts, créateurs B2B) : aucune fausse alerte mesurée."
        : `Présente chez des experts ou créateurs B2B (${t.humains.experts + t.humains.b2b} vidéo(s)), jamais chez l'avocat de référence : ne compte qu'à partir de 2 dans un script.`,
    source: t.source,
  }));
  let tournures = 0;
  for (const t of [...tournuresWill, ...calibrees, ...TOURNURES_PARCOURS, ...TOURNURES_STRUCTURE]) {
    if (await d.tournesInterdites.obtenir(t.id)) continue;
    await d.tournesInterdites.enregistrer({ ...t, ...horo });
    tournures++;
  }
  if (tournures) resume.tournuresAjoutees = tournures;

  /* --- 3. Règles datées --- */
  let regles = 0;
  for (const r of REGLES_DATEES_SEMEES) {
    if (await d.reglesDatees.obtenir(r.id)) continue;
    await d.reglesDatees.enregistrer({ ...r, ...horo });
    regles++;
  }
  if (regles) resume.reglesDateesAjoutees = regles;

  /* --- 4. Bibliothèque : éléments de l'incrustation d'appel --- */
  const elements: string[] = [];
  for (const e of ELEMENTS_APPEL(maintenant)) {
    if (await d.elements.obtenir(e.id)) continue;
    await d.elements.enregistrer(e);
    elements.push(e.id);
  }
  if (elements.length) resume.elementsAjoutes = elements;

  /* --- 5. Contexte commun de marque v0 (rien de validé) --- */
  if ((await d.contexteAxion.compter()) === 0) {
    const contexte: ContexteAxion = {
      id: "contexte-axion-v0",
      version: 0,
      positionIds: [],
      piliers: [],
      piliersProposes: PILIERS_PROPOSES,
      interdits: INTERDITS,
      jargonAutorise: [],
      jargonInterdit: [],
      promessesInterdites: ["garanti", "à coup sûr", "100 %"],
      carnetVoix: [],
      termesVagues: ["outil adapté", "les bonnes pratiques", "un bon process"],
      rolesDestinataires: ["dirigeant", "DAF", "associé", "DRH", "responsable commercial", "responsable informatique", "expert-comptable"],
      ...horo,
    };
    await d.contexteAxion.enregistrer(contexte);
    resume.contexteAxion = contexte.id;
  }

  /* --- 6. G4 (addendum §2 quater) : les activités réelles d'Axion-IA PROPOSÉES comme thèmes (ajout seul, idempotent) --- */
  const contextes = (await d.contexteAxion.lister()).sort((a, b) => b.version - a.version);
  const courant = contextes[0];
  if (courant) {
    const deja = new Set([...(courant.piliersProposes ?? []), ...courant.piliers].map((p) => p.id));
    const manquants = PILIERS_ACTIVITES_AXION.filter((p) => !deja.has(p.id));
    if (manquants.length) {
      await d.contexteAxion.modifier(courant.id, { piliersProposes: [...(courant.piliersProposes ?? []), ...manquants] });
      resume.piliersActivitesProposes = manquants.length;
    }
  }

  return Object.keys(resume).length ? resume : null;
}
