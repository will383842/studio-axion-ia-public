/**
 * Fournisseur de scripts SIMULÉ (PLAN B.6.4). Produit des scripts crédibles, différents
 * selon le format, le sujet et la variante, à partir de gabarits. Aucun appel réseau.
 * Le vrai générateur (Claude) respectera le même contrat.
 */
import type { Adresse, BlocScript, NoteScript, SegmentScript, TypeAccroche } from "@/domaine/types";
import { affecterMorceaux } from "@/domaine/decoupage-colle";
import { noterAccroche, noterScriptDetaille, SEUIL_A_RENFORCER, type ContexteNotation } from "@/domaine/notation-script";
import { listerFormats } from "@/formats";
import { resumerNouveauteSimule } from "@/veille/resume-simule";
import type { BlocRecette, RecetteScript } from "@/formats/types";
import type {
  AccrocheProposee,
  CatalogueDistribution,
  ConsigneAmelioration,
  DemandeModification,
  DemandeScript,
  FournisseurScript,
  PastilleDistribution,
  ReponseModification,
  ScriptGenere,
} from "../types";

function hache(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function choisir<T>(liste: T[], graine: number): T {
  return liste[graine % liste.length];
}

let compteur = 0;
function idSegment(): string {
  compteur += 1;
  return `seg-${Date.now().toString(36)}-${compteur}`;
}

function question(sujet: string): string {
  const s = sujet.trim().replace(/[.!]+$/, "");
  return s.endsWith("?") ? s : `${s} ?`;
}

/** Petits mots sur lesquels un titre ne doit jamais finir. */
const MOTS_VIDES = new Set([
  "le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'", "au", "aux", "à", "et", "ou", "en", "par", "pour", "sur", "sous",
  "dans", "avec", "sans", "pendant", "avant", "après", "chez", "son", "sa", "ses", "mon", "ma", "mes", "ce", "cet", "cette", "qui", "que", "quand",
]);

/**
 * Titre à l'écran : 6 mots pleins au plus (la ponctuation isolée ne compte pas),
 * jamais terminé par un article, une préposition ou un deux-points.
 */
const INSECABLE = String.fromCharCode(0xa0);

export function titreCourt(sujet: string): string {
  const jetons = sujet.replace(/[?!.…]/g, "").split(/\s+/).filter(Boolean);
  const garde: string[] = [];
  let mots = 0;
  for (const j of jetons) {
    const plein = /[\p{L}\p{N}]/u.test(j);
    if (plein && mots === 6) break;
    garde.push(j);
    if (plein) mots += 1;
  }
  while (garde.length) {
    const dernier = garde[garde.length - 1].toLowerCase();
    if (!/[\p{L}\p{N}]/u.test(dernier) || MOTS_VIDES.has(dernier) || (garde.length > 1 && /^[ldj]'$/.test(dernier))) garde.pop();
    else break;
  }
  const titre = (garde.length ? garde : jetons.slice(0, 6)).join(" ").toUpperCase();
  // Sujet gardé en entier : sa ponctuation finale aussi (« ? » collé par une espace insécable).
  const fin = /([?!])\s*$/.exec(sujet)?.[1];
  return fin && garde.length === jetons.length ? `${titre}${INSECABLE}${fin}` : titre;
}

type Gabarit = (sujet: string, g: number, adresse: Adresse) => string[];

/** Choisit la forme vouvoyée ou tutoyée d'une phrase (B.0 §15 : gabarits en tu ET en vous). */
const tv = (adresse: Adresse, vous: string, tu: string) => (adresse === "tu" ? tu : vous);

/** Gabarits par identifiant de bloc de recette. Chaque entrée = phrases d'un bloc. */
const GABARITS: Record<string, Gabarit[]> = {
  accroche: [
    (_s, _g, a) => [tv(a, "Vous faites sûrement cette erreur. Comme presque tout le monde.", "Tu fais sûrement cette erreur. Comme presque tout le monde.")],
    (s) => [`${question(s)} On me pose la question chaque semaine.`],
    (_s, _g, a) => [tv(a, "Neuf personnes sur dix se trompent sur ce point. Et vous ?", "Neuf personnes sur dix se trompent sur ce point. Et toi ?")],
    (_s, _g, a) => [tv(a, "Ne signez surtout rien avant d'avoir vu ça.", "Ne signe surtout rien avant d'avoir vu ça.")],
  ],
  promesse: [
    (_s, _g, a) => [tv(a, "Je vous explique comment l'éviter, en trente secondes.", "Je t'explique comment l'éviter, en trente secondes.")],
    (_s, _g, a) => [tv(a, "Restez : la réponse tient en trois points.", "Reste : la réponse tient en trois points.")],
    (_s, _g, a) => [tv(a, "Voici ce qu'il faut savoir avant de vous lancer.", "Voici ce qu'il faut savoir avant de te lancer.")],
  ],
  coeur: [
    () => ["Premier point : tout se joue avant, pas après.", "Ce qui compte, c'est la règle écrite.", "Et c'est là que ça devient intéressant."],
    () => ["Il y a trois cas, et un seul est vraiment risqué.", "Le premier : tout est prévu par écrit. Aucun souci.", "Le dernier : rien n'est dit. Là, attention."],
    (_s, _g, a) => [tv(a, "Gardez toujours une trace écrite.", "Garde toujours une trace écrite."), "Un e-mail daté vaut mieux qu'une promesse orale.", tv(a, "C'est votre meilleure protection.", "C'est ta meilleure protection.")],
    () => ["Attention à une idée reçue tenace.", "Ce n'est pas parce que tout le monde le fait que c'est permis.", "Le juge regarde les faits, pas les habitudes."],
    (_s, _g, a) => ["Deuxième point, souvent oublié : les délais.", "Passé un certain temps, il est trop tard pour agir.", tv(a, "Notez la date dès le premier jour.", "Note la date dès le premier jour.")],
    () => ["Côté employeur, la logique est la même.", "Une règle claire évite la plupart des conflits.", "Et elle rassure tout le monde."],
  ],
  preuve: [
    () => ["Un client m'a raconté exactement cette situation : 2 500 € perdus."],
    () => ["Les chiffres sont clairs : neuf dossiers sur dix se jouent sur ce point."],
    () => ["Un dirigeant de PME l'a appris à ses dépens : 135 € d'amende."],
  ],
  boucle: [
    () => ["Et c'est exactement l'erreur que font la plupart des dirigeants."],
    () => ["Parce que, encore une fois, presque tout le monde se trompe."],
    (_s, _g, a) => [tv(a, "Et maintenant, vous savez pourquoi on se trompe autant.", "Et maintenant, tu sais pourquoi on se trompe autant.")],
  ],
  question: [
    (s) => [question(s)],
    (s) => [`La vraie question, c'est : ${question(s).charAt(0).toLowerCase() + question(s).slice(1)}`],
    (s) => [`Alors, ${question(s).charAt(0).toLowerCase() + question(s).slice(1)}`],
  ],
  reponse: [
    () => ["La réponse courte : oui, mais pas n'importe comment."],
    () => ["Non. Pas sans des règles claires, posées à l'avance."],
    () => ["Ça dépend. Et c'est justement là que tout se joue."],
  ],
  explication: [
    () => [
      "Ce qui compte, c'est le cadre posé avant.",
      "Prenons une PME de vingt personnes.",
      "Sans règle écrite, tout peut se retourner contre vous.",
    ],
    () => [
      "Il y a trois cas, et un seul est vraiment risqué.",
      "Le premier : tout est prévu par écrit. Aucun souci.",
      "Le dernier : rien n'est dit. Là, attention.",
    ],
    () => [
      "Un client m'a raconté exactement cette situation.",
      "Il pensait être protégé. Il ne l'était pas.",
      "La différence ? Une phrase dans un document.",
    ],
    () => [
      "Regardons ce que dit vraiment la règle.",
      "Elle fixe un principe, puis des exceptions précises.",
      "Et ce sont les exceptions qui changent tout.",
    ],
    () => [
      "Deuxième point, souvent oublié : les délais.",
      "Passé un certain temps, il est trop tard pour agir.",
      "Notez la date dès le premier jour.",
    ],
    () => [
      "Prenons un exemple simple.",
      "Une salariée reçoit un message un vendredi soir.",
      "Le lundi, tout dépend de ce qui était écrit avant.",
    ],
    () => [
      "Ce que je conseille toujours : gardez une trace écrite.",
      "Un e-mail daté vaut mieux qu'une promesse orale.",
      "C'est votre meilleure protection.",
    ],
    () => [
      "Côté employeur, la logique est la même.",
      "Une règle claire évite la plupart des conflits.",
      "Et elle rassure tout le monde.",
    ],
    () => [
      "Attention à une idée reçue tenace.",
      "Ce n'est pas parce que tout le monde le fait que c'est permis.",
      "Le juge regarde les faits, pas les habitudes.",
    ],
    () => [
      "Dernier cas, plus rare mais réel.",
      "Quand personne n'a rien prévu, on cherche l'usage de l'entreprise.",
      "Et là, les surprises sont fréquentes.",
    ],
  ],
  fin: [
    () => ["Retenez une chose : posez les règles avant d'en avoir besoin.", "Abonnez-vous pour la suite."],
    () => ["Vous avez une question ? Écrivez-la en commentaire."],
    () => ["Partagez cette vidéo à quelqu'un qui en a besoin."],
  ],
  ouverture: [
    (s) => [`Bienvenue. Aujourd'hui, une question simple : ${question(s).charAt(0).toLowerCase() + question(s).slice(1)}`, "Mon invité y répond depuis quinze ans."],
    (s) => [`${question(s)} C'est le sujet du jour.`, "Et j'ai avec moi la bonne personne pour en parler."],
  ],
  "question-hote": [
    () => ["Comment tout a commencé pour vous ?"],
    () => ["Qu'est-ce que les gens comprennent mal, selon vous ?"],
  ],
  "reponse-invite": [
    () => ["Au début, je n'y croyais pas du tout.", "Puis un client m'a montré ce qu'il faisait. Ça a tout changé."],
    () => ["Ce qu'on oublie, c'est le temps gagné.", "Deux heures par jour, ce n'est pas un détail."],
  ],
  relance: [() => ["Concrètement, ça ressemble à quoi ?"], () => ["Et si ça ne marche pas ?"]],
  conclusion: [
    () => ["Merci d'être venu.", "Retrouvez-nous la semaine prochaine."],
    () => ["Ce qu'on retient : commencer petit, mais commencer.", "À très vite."],
  ],
  demonstration: [
    () => ["J'ouvre l'outil, je colle mon texte."],
    () => ["Je choisis le modèle, et je lance."],
    () => ["Regardez : le résultat arrive en dix secondes."],
  ],
  resultat: [() => ["Résultat : une heure gagnée, chaque jour."], () => ["Et voilà le document final, prêt à envoyer."]],
  appel: [
    (_s, _g, a) => [tv(a, "Écrivez « règle » en commentaire, je vous envoie le modèle.", "Écris « règle » en commentaire, je t'envoie le modèle.")],
    (_s, _g, a) => [tv(a, "Envoyez cette vidéo à quelqu'un qui en a besoin.", "Envoie cette vidéo à quelqu'un qui en a besoin.")],
    (_s, _g, a) => [tv(a, "Essayez dès lundi. Le lien est en description.", "Essaie dès lundi. Le lien est en description.")],
  ],
  idee: [() => ["Une tâche sur trois peut être reprise."], () => ["Le tri des e-mails, d'abord."], () => ["Puis les comptes rendus."]],
  schema: [() => ["Entrée, traitement, sortie. C'est tout."]],
  conclusion_motion: [() => ["Commencez par une seule tâche."]],
  probleme: [() => ["Je perdais deux heures par jour en tâches répétitives."]],
  decouverte: [() => ["Un ami m'a parlé de cette méthode."]],
  recommandation: [() => ["Je le conseille à tous les dirigeants pressés."]],
  histoire: [() => ["Ce matin, un client m'a appelé, paniqué.", "Il avait signé sans lire une ligne."]],
  lecon: [() => ["La leçon : on lit toujours la dernière page."]],
  corps: [() => ["Voici ce que personne ne vous dit.", "Et pourtant, ça change tout."]],
};

const EMPHASES = ["règles", "écrit", "attention", "jamais", "toujours", "trois", "lundi", "réponse", "temps", "gratuit", "interdit", "légal"];
const motEntier = (texte: string, mot: string) => new RegExp(`(?<![\\p{L}\\p{N}])${mot}(?![\\p{L}\\p{N}])`, "iu").test(texte);

function annoter(texte: string, bloc: BlocRecette, recette: RecetteScript, i: number, graine: number, sujet: string): SegmentScript {
  const seg: SegmentScript = { id: idSegment(), texte };
  const a = new Set(recette.annotations);
  if (a.has("angle")) seg.angle = (i + graine) % 3 === 0 ? "trois-quarts" : "face";
  if (a.has("titreEcran") && (bloc.id === "question" || bloc.id === "accroche") && i === 0) seg.titreEcran = titreCourt(sujet);
  if (a.has("emphase")) {
    const trouves = EMPHASES.filter((m) => motEntier(texte, m));
    if (trouves.length) seg.emphase = trouves.slice(0, 2);
  }
  if (a.has("illustration") && (bloc.id === "explication" || bloc.id === "coeur" || bloc.id === "demonstration" || bloc.id === "idee") && i % 2 === 0) {
    seg.intentionIllustration = choisir(["un contrat posé sur une table", "un écran d'ordinateur", "un téléphone posé sur un bureau", "une lettre recommandée"], graine + i);
  }
  if (a.has("zoom") && (bloc.id === "reponse" || bloc.id === "preuve")) seg.zoom = "leger";
  if (a.has("pause") && (bloc.id === "question" || bloc.id === "promesse")) seg.pauseApresSec = 0.4;
  if (a.has("role") && bloc.role) seg.role = bloc.role;
  // Montant dit à voix haute : incrustation proposée (gain en vert, perte en rouge), jamais dérivée de l'emphase.
  const montant = /(\d[\d\s ]*\s?€)/.exec(texte)?.[1];
  if (a.has("incrustation") && montant) seg.incrustation = { type: "montant", texte: montant.trim(), sens: /perdu|amende|perte|payer|coût/i.test(texte) ? "perte" : "gain" };
  return seg;
}

/** Phrases de complément quand un bloc n'a pas de gabarit propre (formats sans texte dédié). */
const COMPLEMENTS: string[][] = [
  ["Prenons un exemple concret.", "La différence se voit tout de suite."],
  ["Le point clé, c'est la régularité.", "Un petit pas chaque jour suffit."],
  ["Beaucoup s'arrêtent ici.", "C'est justement là qu'il faut continuer."],
  ["Retenez surtout ceci : faites simple.", "Le reste viendra ensuite."],
];

const nbMots = (blocs: BlocScript[]) => blocs.reduce((t, b) => t + b.segments.reduce((u, s) => u + s.texte.split(/\s+/).filter(Boolean).length, 0), 0);

/** Nombre maximal de blocs ajoutés pour rejoindre la durée cible (évite un texte sans fin). */
const COMPLEMENTS_MAX = 12;

function blocsPour(recette: RecetteScript, sujet: string, variante: number, dureeSec: number, adresse: Adresse = "vous"): BlocScript[] {
  const graine = hache(sujet) + variante;
  const segmentsDe = (bloc: BlocRecette, phrases: string[], depart = 0) => phrases.map((p, i) => annoter(p, bloc, recette, depart + i, graine, sujet));
  const faire = (bloc: BlocRecette, r: number, phrases: string[]): BlocScript => ({
    id: `${bloc.id}-${variante}-${r}-${idSegment()}`,
    blocRecette: bloc.id,
    segments: segmentsDe(bloc, phrases),
  });
  const parBloc = new Map<string, BlocScript[]>();
  for (const bloc of recette.blocs) {
    const repetitions = bloc.repetable ? Math.max(1, Math.min(3, Math.round(dureeSec / 60))) : 1;
    const liste: BlocScript[] = [];
    for (let r = 0; r < repetitions; r++) {
      const gabarits: Gabarit[] = GABARITS[bloc.id] ?? [() => [bloc.consigne]];
      liste.push(faire(bloc, r, choisir(gabarits, variante + r)(sujet, graine, adresse)));
    }
    parBloc.set(bloc.id, liste);
  }
  const assembler = () => recette.blocs.flatMap((b) => parBloc.get(b.id) ?? []);

  // Le texte suit la durée cible : on prolonge le bloc le plus extensible (répétable, sinon le plus long)
  // jusqu'à environ 90 % du nombre de mots attendu, avec des gabarits différents à chaque fois.
  // Un bloc NON répétable (le cœur de l'avocat) reçoit les phrases dans le même bloc, pas un second bloc.
  const cibleMots = dureeSec * recette.motsParSeconde * 0.9;
  const extensible =
    recette.blocs.find((b) => b.repetable && GABARITS[b.id]) ??
    [...recette.blocs].sort((a, b) => (b.dureeCibleSec?.[1] ?? 0) - (a.dureeCibleSec?.[1] ?? 0))[0];
  if (extensible) {
    const liste = parBloc.get(extensible.id) ?? [];
    const gabarits = GABARITS[extensible.id];
    let ajoutes = 0;
    while (nbMots(assembler()) < cibleMots && ajoutes < COMPLEMENTS_MAX) {
      const r = liste.length + ajoutes;
      const phrases = gabarits && gabarits.length > 1 ? choisir(gabarits, variante + r)(sujet, graine, adresse) : choisir(COMPLEMENTS, variante + r);
      if (extensible.repetable || !liste.length) liste.push(faire(extensible, r, phrases));
      else {
        const dernier = liste[liste.length - 1];
        dernier.segments = [...dernier.segments, ...segmentsDe(extensible, phrases, dernier.segments.length)];
      }
      ajoutes += 1;
    }
    parBloc.set(extensible.id, liste);
  }
  return assembler();
}

/** « Plus court » : retire la dernière phrase entière ; une phrase seule est coupée à une virgule, jamais au milieu d'une idée. */
export function raccourcir(texte: string): string {
  const phrases = texte.split(/(?<=[.?!…])\s+/).filter(Boolean);
  if (phrases.length > 1) return phrases.slice(0, -1).join(" ");
  const propositions = texte.split(/,\s+/);
  if (propositions.length > 1) {
    const fin = /[?!…]$/.test(texte) ? texte.slice(-1) : ".";
    return propositions.slice(0, -1).join(", ") + fin;
  }
  return texte;
}

function texteDe(blocs: BlocScript[]): string {
  return blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
}

/** Zones de durée du format qui porte cette recette (formats « depuis-script » : avocat). */
function zonesDe(recette: RecetteScript): ContexteNotation["zones"] {
  const f = listerFormats({ inclureMasques: true }).find((x) => x.recetteScript === recette || x.recetteScript.blocs.map((b) => b.id).join() === recette.blocs.map((b) => b.id).join());
  return f && f.durees.mode === "depuis-script" ? { vert: f.durees.zoneSec, orange: f.durees.zoneOrangeSec } : undefined;
}

/**
 * Note d'un texte (synchrone), critère par critère (B.9 bis, `domaine/notation-script.ts`) : accroche (parle au
 * spectateur, mot concret), promesse, clarté et densité, preuve, appel unique, durée (zones du format ou cible),
 * oralité, boucle. Sous 70, le commentaire dit ce qui est à renforcer. Jamais bloquant, jamais de réécriture.
 */
export function noterScriptSync(blocs: BlocScript[], recette: RecetteScript, dureeCibleSec: number, adresse: Adresse = "vous", sujet?: string): NoteScript {
  return noterSync(blocs, recette, dureeCibleSec, adresse, sujet);
}

function noterSync(blocs: BlocScript[], recette: RecetteScript, dureeCibleSec: number, adresse: Adresse = "vous", sujet?: string): NoteScript {
  const texte = texteDe(blocs);
  const detail = noterScriptDetaille(
    blocs,
    recette.criteres.map((c) => c.id),
    { adresse, sujet, motsParSeconde: recette.motsParSeconde, zones: zonesDe(recette), dureeCibleSec },
    // Critère propre à un autre format (rythme…) : note stable tirée du texte, comme avant.
    (id) => 72 + (hache(id + texte) % 22),
  );
  const poidsTotal = recette.criteres.reduce((t, c) => t + c.poids, 0) || 1;
  const globale = Math.round(recette.criteres.reduce((t, c) => t + (detail.criteres[c.id] ?? 0) * c.poids, 0) / poidsTotal);
  const nom = (id: string) => recette.criteres.find((c) => c.id === id)?.nom ?? id;
  const faible = detail.aRenforcer[0];
  const commentaire =
    globale < SEUIL_A_RENFORCER && faible
      ? `À renforcer : ${nom(faible).toLowerCase()}.`
      : detail.phrasesDenses.length
        ? "Une phrase est trop dense pour être lue."
        : choisir(["Accroche efficace.", "Rythme vif, phrases courtes.", "Clair et concret."], hache(texte));
  return { globale, criteres: detail.criteres, commentaire };
}

const TITRES_VARIANTES = ["Direct", "Histoire", "Chiffre choc"];

/**
 * Découpe un texte COLLÉ en blocs de la recette, sans jamais le réécrire (B.0 §16) : paragraphes gardés entiers, une
 * ligne jamais réunie à la suivante, texte sans ponctuation coupé en morceaux lisibles (`domaine/decoupage-colle`).
 */
export function decouperTexte(texte: string, recette: RecetteScript): BlocScript[] {
  return affecterMorceaux(texte, recette.blocs).map((b) => ({
    id: `colle-${b.blocRecette}-${idSegment()}`,
    blocRecette: b.blocRecette,
    segments: b.morceaux.map((m): SegmentScript => ({ id: idSegment(), texte: m })),
  }));
}

const TYPES_ACCROCHES: { type: TypeAccroche; gabarit: (s: string, a: Adresse) => string }[] = [
  { type: "erreur-commune", gabarit: (s) => `${s.replace(/[?!.]+$/, "")} : l'erreur que tout le monde fait` },
  { type: "chiffre-choc", gabarit: () => "Neuf personnes sur dix se trompent sur ce point" },
  { type: "contre-intuitif", gabarit: (_s, a) => tv(a, "Ne faites surtout pas ce qu'on vous conseille", "Ne fais surtout pas ce qu'on te conseille") },
  { type: "question", gabarit: (s) => question(s) },
  { type: "promesse", gabarit: (_s, a) => tv(a, "Évitez ce piège en 3 étapes", "Évite ce piège en 3 étapes") },
];

/**
 * Accroches de types différents, notées /100 (B.9 bis, v3.2) : bonus si elles s'adressent au spectateur et si elles
 * contiennent un mot concret du sujet. Triées de la mieux notée à la moins bien notée.
 */
export function accrochesSimulees(sujet: string, n: number, adresse: Adresse): AccrocheProposee[] {
  return TYPES_ACCROCHES.slice(0, Math.max(1, Math.min(5, n)))
    .map(({ type, gabarit }) => {
      const texte = gabarit(sujet, adresse);
      const r = noterAccroche(texte, { adresse, sujet, motsParSeconde: 4.4 });
      const raisons = [r.parleAuSpectateur ? "Parle directement au spectateur." : "Ne parle pas encore au spectateur.", r.motConcret ? "Mot concret du sujet." : "Trop générale : ajoutez un mot du sujet."];
      return { texte, type, note: r.note, justification: raisons.join(" ") };
    })
    .sort((a, b) => b.note - a.note);
}

const VETEMENTS = /costume|chemise|veste|pull|tailleur|robe|cravate|t-shirt|tee-shirt|blazer|polo|gilet/i;

/** « bureau, costume bleu, debout » → pastilles : trouvé, à créer (coût, durée) ou non filmé (repli). Ne lance jamais rien. */
export function resoudreDistributionSimulee(phrase: string, catalogue: CatalogueDistribution): PastilleDistribution[] {
  const morceaux = phrase
    .split(/[,;]|\bet\b/i)
    .map((m) => m.trim())
    .filter(Boolean);
  const pastilles: PastilleDistribution[] = [];
  const contient = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
  for (const m of morceaux) {
    const posture = /debout/i.test(m) ? "debout" : /assis/i.test(m) ? "assis" : null;
    if (posture) {
      const filmee = catalogue.postures.find((p) => p.posture === posture)?.filmee ?? false;
      pastilles.push(filmee ? { genre: "posture", etat: "trouve", id: posture, libelle: posture === "debout" ? "Debout" : "Assis" } : { genre: "posture", etat: "non-filme", libelle: posture === "debout" ? "Debout" : "Assis", repli: posture === "debout" ? "assis" : "debout" });
      continue;
    }
    if (VETEMENTS.test(m)) {
      const tenue = catalogue.tenues.find((t) => contient(t.nom, m));
      pastilles.push(tenue ? { genre: "tenue", etat: "trouve", id: tenue.id, libelle: tenue.nom } : { genre: "tenue", etat: "a-creer", libelle: m, coutEstime: { centimes: 25, devise: "EUR" }, dureeEstimeeSec: 180 });
      continue;
    }
    const decor = catalogue.decors.find((d) => contient(d.nom, m) || d.motsCles.some((k) => contient(k, m)));
    pastilles.push(decor ? { genre: "decor", etat: "trouve", id: decor.id, libelle: decor.nom } : { genre: "decor", etat: "a-creer", libelle: m, coutEstime: { centimes: 10, devise: "EUR" }, dureeEstimeeSec: 60 });
  }
  return pastilles;
}

/**
 * « Demander une modification », SIMULÉ par mots-clés (le vrai traducteur sera Claude, même contrat).
 * Ne propose jamais rien sans que Will confirme ; hors capacités → une réponse claire.
 * 17/10 : une demande reconnue mais sans prise sur cette vidéo (aucun chiffre affiché, aucune image, aucun plan sur la
 * personne) le dit clairement ; « je n'ai pas compris » est réservé à ce qui n'est pas reconnu du tout. Les plans sont
 * nommés par leur numéro affiché (`ordre`).
 */
export function interpreterDemandeSimulee(demande: DemandeModification): ReponseModification {
  const t = demande.texte.toLowerCase();
  const refaire = "Pour ce changement, il faut refaire la vidéo.";
  if (/tenue|costume|chemise|veste|décor|decor|voix/.test(t) && !/illustration|image/.test(t)) {
    return { operations: [], resume: "Cette demande change la vidéo entière.", horsCapacite: "Je ne peux pas changer la tenue, le décor ou la voix après fabrication : il faut refaire la vidéo." };
  }
  const tries = [...demande.plans].sort((a, b) => a.ordre - b.ordre);
  const operations: ReponseModification["operations"] = [];
  const phrases: string[] = [];
  const sansPrise: string[] = [];
  const illustrations = tries.filter((p) => p.sourceImage === "illustration");
  const doubles = tries.filter((p) => p.sourceImage === "double");
  // E2E-2 parcours n° 15 : « changer l'image du plan 2 » : le plan nommé par son numéro.
  const numero = Number(t.match(/plan\s*(?:n°\s*)?(\d+)/)?.[1] ?? NaN);
  const nomme = Number.isFinite(numero) ? (tries.find((p) => p.ordre === numero) ?? tries[numero - 1]) : undefined;
  // « Enlever le plan 2 » (le plan entier, pas son image) : ce qui est dit changerait.
  if (/(enl[eè]v|retir|supprim|coup)\S*\s+(le\s+)?plan/.test(t) && !/image|illustration/.test(t)) {
    return { operations: [], resume: "Retirer un plan entier change ce qui est dit.", horsCapacite: `Retirer un plan entier change ce qui est dit : je ne sais pas le faire en retouche. ${refaire} Je peux en revanche changer l'image d'un plan.` };
  }
  if (/(enl[eè]v|retir|remplac|chang|supprim|autre).*(image|illustration|plan)|(image|illustration).*(enl[eè]v|retir|remplac|chang)/.test(t)) {
    const mot = t.match(/image d['e ]\s*(\p{L}+)/u)?.[1];
    const cible = (nomme?.sourceImage === "illustration" ? nomme : undefined) ?? illustrations.find((p) => mot && p.texte.toLowerCase().includes(mot)) ?? (nomme ? illustrations.find((p) => p.ordre >= nomme.ordre) : undefined) ?? illustrations[0];
    if (cible) {
      operations.push({ type: "remplacerIllustration", planId: cible.id });
      phrases.push(nomme && nomme.id !== cible.id ? `Le plan ${nomme.ordre} n'a pas d'image : je change celle du plan ${cible.ordre}.` : `Je change l'image du plan ${cible.ordre}.`);
    } else sansPrise.push("Cette vidéo n'a pas d'image à changer.");
  }
  // « Faire apparaître le chiffre plus tôt » : l'incrustation du premier plan chiffré passe au plan d'avant.
  if (/chiffre/.test(t) && /plus t[oô]t|avant|d[eè]s le d[ée]but/.test(t)) {
    const i = tries.findIndex((p) => /\d/.test(p.texte));
    if (i > 0) {
      operations.push({ type: "deplacerIncrustation", planId: tries[i].id, versPlanId: tries[i - 1].id });
      phrases.push(`Le chiffre du plan ${tries[i].ordre} apparaît dès le plan ${tries[i - 1].ordre}.`);
    } else sansPrise.push(i === 0 ? "Le chiffre apparaît déjà dès le premier plan." : "Aucun chiffre n'est affiché dans cette vidéo : il n'y a rien à avancer.");
  }
  const cadrer = (valeur: "poitrine" | "large") => {
    const vises = doubles.slice(0, 3);
    for (const p of vises) operations.push({ type: "changerCadrage", planId: p.id, valeur });
    if (vises.length) phrases.push(`Cadrage ${valeur === "poitrine" ? "plus serré" : "plus large"} sur les plans ${vises.map((p) => p.ordre).join(", ")}.`);
    else sansPrise.push("Aucun plan ne montre la personne qui parle : le cadrage ne change pas.");
  };
  if (/serr/.test(t)) cadrer("poitrine");
  if (/large/.test(t)) cadrer("large");
  if (/angle|de face/.test(t)) {
    if (doubles[1]) {
      operations.push({ type: "changerAngle", planId: doubles[1].id, angle: "face" });
      phrases.push(`Le plan ${doubles[1].ordre} passe de face.`);
    } else sansPrise.push("Il n'y a pas d'autre plan sur la personne pour changer d'angle.");
  }
  const titre = /titre\s*:?\s*[«"](.+?)[»"]/.exec(demande.texte)?.[1];
  if (titre) {
    operations.push({ type: "modifierTitre", texte: titre.trim() });
    phrases.push(`Le titre d'ouverture devient « ${titre.trim()} ».`);
  }
  if (/plus vite|plus rapide|rythme/.test(t)) {
    operations.push({ type: "ajusterRythme", sens: "plus-rapide" });
    phrases.push("Le montage devient plus rapide.");
  }
  if (/plus lent/.test(t)) {
    operations.push({ type: "ajusterRythme", sens: "plus-lent" });
    phrases.push("Le montage devient plus lent.");
  }
  if (!operations.length && sansPrise.length) return { operations: [], resume: sansPrise.join(" "), horsCapacite: `${sansPrise.join(" ")} ${refaire}` };
  return {
    operations,
    resume: operations.length ? [...phrases, ...sansPrise].join(" ") : "Je n'ai pas compris quoi changer. Dites-le autrement, par exemple : « changez l'image du plan 2 ».",
  };
}

/** Exemples que la vidéo permet vraiment (plans par plans) : chacun est compris par `interpreterDemandeSimulee`. */
export function exemplesDemandeSimulee(plans: DemandeModification["plans"]): string[] {
  const tries = [...plans].sort((a, b) => a.ordre - b.ordre);
  const exemples: string[] = [];
  const illustration = tries.find((p) => p.sourceImage === "illustration");
  if (illustration) exemples.push(`Changer l'image du plan ${illustration.ordre}`);
  if (tries.some((p) => p.sourceImage === "double")) exemples.push("Plus de plans serrés au début");
  if (tries.findIndex((p) => /\d/.test(p.texte)) > 0) exemples.push("Faire apparaître le chiffre plus tôt");
  return exemples;
}

export const fournisseurScriptSimulation: FournisseurScript = {
  id: "simulation",
  type: "script",
  nom: "Générateur de scripts",
  reelPrevu: "Claude",
  mode: "simulation",
  capacites: { asynchrone: false, accordExige: false, langues: ["fr-FR"], tarif: { unite: "appel", prixUnitaire: { centimes: 4, devise: "EUR" } } },

  async generer(demande: DemandeScript): Promise<ScriptGenere[]> {
    const n = Math.max(1, Math.min(5, demande.nombre));
    return Array.from({ length: n }, (_, v) => {
      const blocs = blocsPour(demande.recette, demande.sujet, v, demande.dureeSec, demande.adresse ?? "vous");
      return { titre: TITRES_VARIANTES[v % TITRES_VARIANTES.length], blocs, notes: noterSync(blocs, demande.recette, demande.dureeSec, demande.adresse ?? "vous", demande.sujet) };
    });
  },

  async noter(blocs, recette, dureeCibleSec, adresse) {
    return noterSync(blocs, recette, dureeCibleSec, adresse ?? "vous");
  },

  async decouper(texte, recette) {
    return decouperTexte(texte, recette);
  },

  async accroches(sujet, n, adresse) {
    return accrochesSimulees(sujet, n, adresse);
  },

  async resoudreDistribution(phrase, catalogue) {
    return resoudreDistributionSimulee(phrase, catalogue);
  },

  async interpreterDemande(demande) {
    return interpreterDemandeSimulee(demande);
  },

  // Lot B2 (veille des outils) : résumé d'une nouveauté par règles fixes, tant que Claude n'est pas relié.
  async resumerNouveaute(demande) {
    return resumerNouveauteSimule(demande);
  },

  async ameliorerBloc(bloc, consigne: ConsigneAmelioration, _recette, adresse) {
    // « Plus court » sur un bloc de plusieurs phrases : on retire la dernière, les autres restent entières.
    const source = consigne === "plus-court" && bloc.segments.length > 1 ? bloc.segments.slice(0, -1) : bloc.segments;
    const raccourcirChaque = consigne === "plus-court" && bloc.segments.length === 1;
    const segments = source.map((s) => {
      let texte = s.texte;
      if (consigne === "plus-court") {
        if (raccourcirChaque) texte = raccourcir(texte);
      } else if (consigne === "plus-percutant") {
        texte = texte.replace(/^(Ce qui compte, c'est|Voici|Il y a)/, adresse === "tu" ? "Écoute bien :" : "Écoutez bien :").replace(/\.$/, " !");
      } else {
        texte = texte.replace(/\bvraiment\b/g, "").replace(/\s+/g, " ").trim();
      }
      return { ...s, id: idSegment(), texte };
    });
    // Le texte est récrit par la machine : le bloc n'est plus « à Will » (plus de `colle-`), il est donc contrôlé.
    return { ...bloc, id: bloc.id.replace(/^colle-/, ""), segments };
  },
};

/** Version synchrone (données de démonstration). */
export function scriptSimuleSync(recette: RecetteScript, sujet: string, variante: number, dureeSec: number, adresse: Adresse = "vous"): ScriptGenere {
  const blocs = blocsPour(recette, sujet, variante, dureeSec, adresse);
  return { titre: TITRES_VARIANTES[variante % TITRES_VARIANTES.length], blocs, notes: noterSync(blocs, recette, dureeSec, adresse, sujet) };
}
