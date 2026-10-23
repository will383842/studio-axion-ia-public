/**
 * Contrôles de POSITION et de STRUCTURE (plan v5 B.7.2, addendum du 02/10). PUR.
 * C3, C6, C6 bis, C7, C8, C10, C10 ter, C11, C12, C20, C21, C21 bis, C22, C23, C26, C28, C29, C30, C30 bis, C30 ter,
 * C33, C38, C38 bis, C39, C45 bis, C46, C46 bis, C63, C73, C74.
 * Toutes les positions viennent de l'horloge unique ; tant que le débit n'est pas mesuré, les seuils de position portent
 * une marge de 10 % (`a.marge`).
 */
import { dureeParleeEstimee } from "@/domaine/lecture";
import { nombresAffirmes } from "@/domaine/nombres-fr";
import { Collecte, segmentsParles, type Analyse, type SegmentLu } from "./analyse";
import { MOTIF_IMPERATIF_APPEL, couchesAffichees } from "./style";
import type { EntreeControle } from "./types";
import { MOTS_OUTILS, contientExpression, mots, motsPleins, normaliser, phrasesDe, racine, sansCitations, texteCompare } from "./texte";

const premierAvec = (a: Analyse, f: (s: SegmentLu) => boolean) => segmentsParles(a).find(f);

/* ---------- C3 : un seul appel, liste fermée, aucun impératif d'appel ailleurs ---------- */
export function c3(e: EntreeControle, a: Analyse, col: Collecte): void {
  const textesAppel = a.appel.map((s) => normaliser(s.dit)).join(" ");
  const verbes = new Set([...textesAppel.matchAll(new RegExp(MOTIF_IMPERATIF_APPEL.source, "g"))].map((m) => m[1].replace(/(-la|-le|-lui|-leur)$/, "")));
  if (verbes.size > 1) col.ajouter("C3", `Plusieurs appels dans la fin (${[...verbes].join(", ")}).`);
  if (e.appel && e.reseau && !e.reseau.appelsPermis.includes(e.appel.type)) col.ajouter("C3", `Appel « ${e.appel.type} » hors de la liste fermée de ce réseau.`);
  for (const s of segmentsParles(a)) {
    if (s.role === "appel" || s.segment.sourceTexte) continue;
    if (MOTIF_IMPERATIF_APPEL.test(normaliser(sansCitations(s.dit)))) col.ajouter("C3", "Impératif d'appel hors du bloc d'appel.", { segmentIndex: s.index });
  }
  for (const c of couchesAffichees(e)) {
    if (!["encadré", "second encadré", "couverture", "incrustation", "première ligne"].includes(c.couche)) continue;
    if (MOTIF_IMPERATIF_APPEL.test(normaliser(c.texte))) col.ajouter("C3", `Impératif d'appel dans ${c.couche}.`);
  }
}

/* ---------- C6, C6 bis : livraison ---------- */
export function c6(e: EntreeControle, a: Analyse, col: Collecte): void {
  const livraison = premierAvec(a, (s) => s.marqueurs.includes("livraison"));
  if (!livraison) {
    if (e.auteur === "machine") col.ajouter("C6", "Aucune livraison marquée.");
    return;
  }
  const limite = 0.7 * a.dureeSec;
  if (livraison.finSec > limite) col.ajouter("C6", `Livraison à ${livraison.finSec.toFixed(1)} s, après 70 % (${limite.toFixed(1)} s).`, { segmentIndex: livraison.index });
  const accroche = a.accroche.map((s) => s.dit).join(" ");
  const valeursAccroche = nombresAffirmes(accroche).map((n) => n.valeur);
  const revele = nombresAffirmes(livraison.dit).some((n) => valeursAccroche.includes(n.valeur));
  if (revele) {
    const deja = new Set(motsPleins(accroche).map(racine));
    const neufs = motsPleins(livraison.dit).filter((m) => !deja.has(racine(m)));
    if (neufs.length < 2) col.ajouter("C6 bis", "L'accroche révèle le résultat et la livraison n'apporte rien de neuf.", { segmentIndex: livraison.index });
  }
}

/* ---------- C7 : appui principal avant 10 s ---------- */
export function c7(e: EntreeControle, a: Analyse, col: Collecte): void {
  const appui = e.maitre?.appuiPrincipal;
  if (!appui || (!appui.preuveId && !appui.matiereId)) {
    if (e.auteur === "machine" && e.structure && e.structure.appui.length) col.ajouter("C7", "Aucun appui principal déclaré.");
    return;
  }
  const seg = premierAvec(a, (s) => (!!appui.preuveId && !!s.segment.preuveIds?.includes(appui.preuveId)) || (!!appui.matiereId && (!!s.segment.matiereIds?.includes(appui.matiereId) || s.segment.sourceTexte?.matiereId === appui.matiereId)));
  const seuil = 10 * a.marge;
  if (!seg) col.ajouter("C7", "L'appui principal n'est dit nulle part.");
  else if (seg.finSec > seuil) col.ajouter("C7", `Appui principal dit à ${seg.finSec.toFixed(1)} s (avant ${seuil.toFixed(1)} s attendu).`, { segmentIndex: seg.index });
}

/* ---------- C8 : accroche ≤ 5 s et ≤ 20 mots (addendum, point 1) ---------- */
export function c8(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!a.accroche.length) return;
  const fin = a.accroche[a.accroche.length - 1].finSec;
  const n = a.accroche.reduce((s, x) => s + mots(x.dit).length, 0);
  if (fin > e.recette.accrocheMaxSec) col.ajouter("C8", `Accroche de ${fin.toFixed(1)} s (plafond ${e.recette.accrocheMaxSec} s).`, { segmentIndex: a.accroche[0].index });
  if (n > e.recette.accrocheMaxMots) col.ajouter("C8", `Accroche de ${n} mots (plafond ${e.recette.accrocheMaxMots}).`, { segmentIndex: a.accroche[0].index });
}

/* ---------- C10, C10 ter : mot-clé ---------- */
function occurrences(texte: string, expression: string): number {
  const t = ` ${texteCompare(texte)} `;
  const x = ` ${texteCompare(expression)} `;
  let n = 0;
  let i = t.indexOf(x);
  while (i >= 0) {
    n++;
    i = t.indexOf(x, i + 1);
  }
  return n;
}

/** Terme dit tel quel, mots entiers, l'apostrophe séparant les mots (« l'IA » contient « IA »). */
function contientTerme(texte: string, terme: string): boolean {
  const n = (t: string) => ` ${texteCompare(t).replace(/'/g, " ").replace(/\s+/g, " ")} `;
  return n(terme).trim() !== "" && n(texte).includes(n(terme));
}

export function c10(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.auteur !== "machine") return;
  const motCle = e.motCle?.trim();
  if (!motCle) {
    col.ajouter("C10", "Aucun mot-clé.");
    return;
  }
  if (!e.motCleSource) col.ajouter("C10", "Mot-clé sans source (motCleSource).");
  const parles = segmentsParles(a);
  const premier = parles.find((s) => contientExpression(s.dit, motCle));
  const seuil = 5 * a.marge;
  if (!premier) col.ajouter("C10", `Mot-clé « ${motCle} » jamais dit tel quel.`);
  else if (premier.finSec > seuil) col.ajouter("C10", `Mot-clé dit à ${premier.finSec.toFixed(1)} s (avant ${seuil.toFixed(1)} s attendu).`, { segmentIndex: premier.index });
  // « recrute » puis « recrutement » : une forme de la même famille compte comme répétition.
  const famille = motsPleins(motCle).map(racine);
  const memeFamille = (t: string) => famille.length > 0 && famille.every((r) => motsPleins(t).map(racine).includes(r));
  const total = parles.reduce((s, x) => s + Math.max(occurrences(x.dit, motCle), memeFamille(x.dit) ? 1 : 0), 0);
  if (premier && total < 2) col.ajouter("C10", "Mot-clé dit une seule fois (une répétition attendue).");
  if (e.encadre && !contientExpression(e.encadre.texte, motCle)) col.ajouter("C10", "Mot-clé absent de l'encadré.");
  // Équipe 7 (C10 quater) : le compte parle d'IA (TikTok) — un terme du compte dit avant 5 s ; les sous-titres l'écrivent
  // à l'écran. Alerte (un sujet validé peut ne pas parler d'IA) ; l'étape 12 du générateur fait corriger la version.
  const termes = e.reseau?.termesDuCompte ?? [];
  if (termes.length && !parles.some((s) => s.debutSec < seuil && termes.some((t) => contientTerme(s.dit, t)))) {
    col.ajouter("C10 quater", `Ni « ${termes.filter((t) => t !== "IA").join(" », ni « ")} » ni « IA » dit avant ${seuil.toFixed(1).replace(".", ",")} s.`);
  }
  if (e.reseau?.premiereLigneAvecMotCle && e.publication) {
    const lignes = [e.publication.premiereLigne ?? "", ...(e.publication.titres ?? [])];
    if (!lignes.some((l) => contientExpression(l, motCle))) col.ajouter("C10", "Mot-clé absent de la première ligne (ou du titre).");
  }
  // C10 ter : chaque répétition apprend quelque chose ; ni « concrètement » ni « donc » collés au mot-clé.
  const mc = new Set(motsPleins(motCle).map(racine));
  const vus = new Set<string>();
  let dit = 0;
  for (const s of parles) {
    for (const p of phrasesDe(s.dit)) {
      const pleins = motsPleins(p).map(racine);
      if (contientExpression(p, motCle)) {
        dit++;
        const neufs = pleins.filter((r) => !mc.has(r) && !vus.has(r));
        if (dit > 1 && neufs.length === 0) col.ajouter("C10 ter", `Phrase dont la seule nouveauté est le mot-clé : « ${p} ».`, { segmentIndex: s.index });
        const n = normaliser(p);
        const m = normaliser(motCle);
        if (new RegExp(`${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},? (concretement|donc)(?=$|[^a-z])`).test(n) || new RegExp(`${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, c'est donc`).test(n)) {
          col.ajouter("C10 ter", `« ${motCle} » suivi de « concrètement » ou « donc ».`, { segmentIndex: s.index });
        }
      }
      pleins.forEach((r) => vus.add(r));
    }
  }
  if (e.motCleSource === "hypothese" && e.publication && !e.publication.motCleVariante) col.ajouter("C10 ter", "Mot-clé supposé : une variante par réseau est exigée (ouverture et publication).");
}

/* ---------- C11 : relance toutes les ≤ 8 s ---------- */
export function c11(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!a.corps.length) return;
  const debut = a.corps[0].debutSec;
  const fin = a.corps[a.corps.length - 1].finSec;
  const reperes = [debut, ...a.corps.filter((s) => s.marqueurs.includes("relance")).map((s) => s.debutSec), fin];
  for (let i = 1; i < reperes.length; i++) {
    if (reperes[i] - reperes[i - 1] > 8) {
      col.ajouter("C11", `${(reperes[i] - reperes[i - 1]).toFixed(1)} s sans relance (de ${reperes[i - 1].toFixed(1)} à ${reperes[i].toFixed(1)} s).`);
      break;
    }
  }
}

/* ---------- C12 : plafonds de durée ---------- */
export function c12(e: EntreeControle, a: Analyse, col: Collecte): void {
  const corps = a.corps.length ? a.corps[a.corps.length - 1].finSec - a.corps[0].debutSec : 0;
  if (corps > e.recette.corpsMaxSec) col.ajouter("C12", `Corps de ${corps.toFixed(1)} s (plafond ${e.recette.corpsMaxSec} s) : à raccourcir.`);
  if (e.recette.corpsIndicatifMinSec && corps < e.recette.corpsIndicatifMinSec) col.ajouter("C12", `Corps court (${corps.toFixed(1)} s) : vérifier qu'il ne manque rien.`, { niveau: "info" });
  if (e.reseau) {
    const [min, max] = e.reseau.zoneSec;
    if (a.dureeSec > max) col.ajouter("C12", `${a.dureeSec.toFixed(1)} s, au-delà de la zone du réseau (${max} s) : à raccourcir.`);
    else if (a.dureeSec < min) col.ajouter("C12", `${a.dureeSec.toFixed(1)} s, sous la zone du réseau (${min} s) : information.`, { niveau: "info" });
  }
}

/* ---------- C20 : annotations et intervenants ---------- */
const CHAMPS_RESERVES: { cle: "angle" | "zoom" | "titreEcran"; annotation: string }[] = [
  { cle: "angle", annotation: "angle" },
  { cle: "zoom", annotation: "zoom" },
  { cle: "titreEcran", annotation: "titreEcran" },
];
const CLES_TECHNIQUES = new Set(["duree", "dureeSec", "secondes", "mots", "nombreMots", "note", "score", "liste", "listePoint", "geste", "temps", "motAncre", "citation"]);

export function c20(e: EntreeControle, a: Analyse, col: Collecte): void {
  const acceptees = new Set(e.recette.annotationsAcceptees.map(String));
  const reservees = new Set(e.recette.annotationsReservees.map(String));
  for (const s of a.segments) {
    for (const cle of Object.keys(s.segment.annotations ?? {})) {
      if (CLES_TECHNIQUES.has(cle)) continue;
      const pauseProposee = cle === "pause" && (s.segment.annotations?.pause as { proposee?: boolean } | undefined)?.proposee === true;
      if (reservees.has(cle) && e.auteur === "machine" && !pauseProposee) col.ajouter("C20", `Annotation réservée « ${cle} » posée par la machine.`, { segmentIndex: s.index });
      else if (!acceptees.has(cle) && !reservees.has(cle)) col.ajouter("C20", `Annotation « ${cle} » non déclarée par la recette.`, { segmentIndex: s.index });
    }
    if (e.auteur === "machine") for (const c of CHAMPS_RESERVES) if (s.segment[c.cle] !== undefined && reservees.has(c.annotation)) col.ajouter("C20", `Annotation réservée « ${c.annotation} » posée par la machine.`, { segmentIndex: s.index });
    const role = s.segment.intervenant?.role;
    if (role && e.recette.intervenantsPermis && !e.recette.intervenantsPermis.includes(role)) col.ajouter("C20", `Intervenant « ${role} » non déclaré par la famille.`, { segmentIndex: s.index });
  }
}

/* ---------- C21, C21 bis : boucle ---------- */
const MOTIF_PRONOM_Y = /(?:^|[^a-z'])y [a-z]+/;
const MOTIF_COMPLEMENT_LIEU = /(?:^|[^a-z])(sur|dans|au|aux|a|chez) [a-z]/;
export function c21(e: EntreeControle, a: Analyse, col: Collecte): void {
  const boucle = a.boucle.filter((s) => s.texte.trim());
  if (!boucle.length) return;
  const texte = boucle.map((s) => s.dit).join(" ").trim();
  const idx = boucle[0].index;
  if (mots(texte).length > 6) col.ajouter("C21", `Boucle de ${mots(texte).length} mots (6 au plus).`, { segmentIndex: idx });
  if (/[.!?]$/.test(texte) && !/…$|\.\.\.$/.test(texte)) col.ajouter("C21", "La boucle ne se raccorde pas à la première phrase (elle se termine).", { segmentIndex: idx });
  if (e.reseau?.boucle === "non") col.ajouter("C21 bis", "Boucle sur un réseau qui n'en veut pas.", { segmentIndex: idx });
  if (e.appel?.type === "question-expert") col.ajouter("C21 bis", "Boucle après un appel « question d'expert ».", { segmentIndex: idx });
  if (e.maitre?.angle?.typeAngle === "verdict") col.ajouter("C21 bis", "Boucle sur un angle « verdict ».", { segmentIndex: idx });
  const accroche = a.accroche.map((s) => s.dit).join(" ").trim();
  const nb = normaliser(texte);
  const na = normaliser(accroche);
  if (/\?\s*(…|\.\.\.)?$/.test(texte) && /\?$/.test(accroche)) col.ajouter("C21 bis", "Double question une fois la boucle assemblée avec l'accroche.", { segmentIndex: idx });
  if (MOTIF_PRONOM_Y.test(nb) && MOTIF_COMPLEMENT_LIEU.test(na)) col.ajouter("C21 bis", "Pronom redondant avec un complément de l'accroche (« y … sur Excel »).", { segmentIndex: idx });
}

/* ---------- C22 : emphase ---------- */
export function c22(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a);
  const avec = parles.filter((s) => s.segment.emphase?.length);
  if (parles.length && avec.length / parles.length > 0.4) col.ajouter("C22", `Emphase sur ${avec.length} segments sur ${parles.length} (40 % au plus).`);
  for (const s of avec) {
    const motsEmphase = s.segment.emphase!.flatMap((x) => mots(x));
    if (motsEmphase.length > 2) col.ajouter("C22", "Plus de 2 mots en emphase dans un segment.", { segmentIndex: s.index });
    if (motsEmphase.some((m) => MOTS_OUTILS.has(texteCompare(m)))) col.ajouter("C22", "Mot outil en emphase.", { segmentIndex: s.index });
    if (s.debutSec < 3) col.ajouter("C22", "Emphase pendant les 3 premières secondes.", { segmentIndex: s.index });
  }
}

/* ---------- C23, C26 : plans ---------- */
export function c23c26(e: EntreeControle, a: Analyse, col: Collecte): void {
  let coupesCourtes = 0;
  for (const s of segmentsParles(a)) {
    if (s.role === "boucle") continue;
    const visuel = !!(s.segment.changementVisuel || s.segment.intentionIllustration || s.segment.incrustation);
    if (s.finSec - s.debutSec > 4 && !visuel) col.ajouter("C23", `${(s.finSec - s.debutSec).toFixed(1)} s sans changement à l'écran.`, { segmentIndex: s.index });
    if (s.segment.coupeCourteVoulue) coupesCourtes++;
    for (const p of phrasesDe(s.dit)) {
      const d = dureeParleeEstimee(p, e.debit) * (s.facteurReel ?? 1);
      if (d > 3.5 && !s.segment.changementVisuel) col.ajouter("C26", `Plan de ${d.toFixed(1)} s sans changement visuel annoté (« ${p} »).`, { segmentIndex: s.index });
      if (mots(p).length <= 3 && d < 1.2 && !s.segment.coupeCourteVoulue && phrasesDe(s.dit).length === 1) col.ajouter("C26", `Phrase courte à fusionner ou à marquer « coupe courte voulue » (« ${p} »).`, { segmentIndex: s.index });
    }
  }
  if (coupesCourtes > 2) col.ajouter("C26", `${coupesCourtes} coupes courtes voulues (2 au plus).`);
}

/* ---------- C28, C29 : densité de preuves ---------- */
export function c28c29(e: EntreeControle, a: Analyse, col: Collecte): void {
  const dites = new Set(segmentsParles(a).flatMap((s) => s.segment.preuveIds ?? []));
  if (dites.size > 3) col.ajouter("C28", `${dites.size} preuves dites dans la version (3 au plus ; les autres en incrustation ou en légende).`);
  for (const s of segmentsParles(a)) {
    const ps = (s.segment.preuveIds ?? []).map((id) => a.preuves.get(id)).filter((p) => !!p);
    const appuis = ps.filter((p) => p!.niveau === "prouve" || p!.niveau === "observe");
    if (appuis.length > 1) col.ajouter("C29", "Plus d'un appui dans un même segment.", { segmentIndex: s.index });
    if (new Set(ps.map((p) => p!.nature)).size > 1) col.ajouter("C29", "Deux preuves de nature différente dans un segment.", { segmentIndex: s.index });
  }
}

/* ---------- C30, C30 bis, C30 ter : exception ---------- */
const PRONOMS_SUJET = new Set(["ca", "cela", "ce", "il", "elle", "ils", "elles", "c'est", "c"]);
const FORMULES_EXCEPTION_DE_BASE = ["sauf si", "a moins que", "en revanche", "par contre", "ca ne marche pas quand", "ca ne marche pas si", "attention, si", "attention si", "sauf quand", "sauf pour"];

export function c30(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a);
  const ex = parles.filter((s) => s.marqueurs.includes("exception"));
  const exception = e.maitre?.exception;
  const placeholder = parles.find((s) => /\[\s*limite (a|à) valider\s*\]/i.test(s.texte));
  if (placeholder) col.ajouter("C30 bis", "Limite à valider d'un toucher : téléprompteur, trame, export et fabrication fermés.", { segmentIndex: placeholder.index });
  if (!ex.length) {
    if (e.recette.exceptionObligatoire && !placeholder) col.ajouter("C30", "Aucune exception dans la version.");
    return;
  }
  // Limite proposée par la machine et non validée : jamais dite, affichée ou lue (C30 bis).
  if (exception?.source === "proposition-machine" && !exception.valideeParWill) {
    for (const s of ex) col.ajouter("C30 bis", "Limite proposée par la machine dite sans validation de Will.", { segmentIndex: s.index });
    col.ajouter("C30", "Exception non validée : la version reste « à compléter ».");
  }
  const premierAppel = parles.find((s) => s.role === "appel");
  for (const s of ex) {
    if (premierAppel && s.index > premierAppel.index) col.ajouter("C30", "Exception dite après l'appel.", { segmentIndex: s.index });
    if (!premierAppel && s.index === parles[parles.length - 1].index) col.ajouter("C30", "Exception en dernière position, sans fait après elle.", { segmentIndex: s.index });
    // C30 ter : sujet explicite, après une affirmation, jamais entre deux faits positifs.
    let reste = normaliser(s.dit);
    const formules = [...e.recette.formulesException.map(normaliser), ...FORMULES_EXCEPTION_DE_BASE].sort((x, y) => y.length - x.length);
    for (const f of formules) {
      const i = reste.indexOf(f);
      if (i >= 0 && i < 12) {
        reste = reste.slice(i + f.length).replace(/^[\s,:]+/, "");
        break;
      }
    }
    const premierMot = reste.split(/[\s']/)[0];
    if (PRONOMS_SUJET.has(premierMot)) col.ajouter("C30 ter", "L'exception n'a pas de sujet explicite (« ça », « il »…).", { segmentIndex: s.index });
    const avant = parles.filter((x) => x.index < s.index && x.role !== "accroche").at(-1);
    const apres = parles.find((x) => x.index > s.index && x.role !== "appel" && x.role !== "boucle");
    if (avant && avant.dit.trim().endsWith("?")) col.ajouter("C30 ter", "L'exception suit une question, pas l'affirmation qu'elle restreint.", { segmentIndex: s.index });
    const positif = (x?: SegmentLu) => !!x && (x.marqueurs.includes("resultat") || x.marqueurs.includes("livraison") || x.marqueurs.includes("solution"));
    if (positif(avant) && positif(apres)) col.ajouter("C30 ter", "Exception coincée entre deux faits positifs : elle ne restreint rien.", { segmentIndex: s.index });
    if (exception?.restreint !== undefined && exception.restreint !== s.index - 1) col.ajouter("C30 ter", "L'affirmation restreinte n'est pas celle qui précède immédiatement l'exception.", { segmentIndex: s.index });
  }
}

/* ---------- C33, C38 bis (début du corps) ---------- */
const PRONOMS_RENVOI = new Set(["il", "elle", "ils", "elles", "ca", "cela", "celui-ci", "celle-ci", "lui", "leur", "y"]);

export function c33(e: EntreeControle, a: Analyse, col: Collecte): void {
  const premier = a.corps.find((s) => s.texte.trim());
  if (!premier || !a.accroche.length) return;
  const phrase = phrasesDe(premier.dit)[0] ?? "";
  // « ça : » / « cela : » annonce ce qui suit (une liste), il ne renvoie pas à l'ouverture.
  const debut = texteCompare(normaliser(phrase).replace(/(?:^|[^a-z])(ca|cela)\s*:/g, " ")).split(/\s+/).slice(0, 4);
  const renvoi = debut.find((m) => PRONOMS_RENVOI.has(m));
  if (renvoi) col.ajouter("C33", `Le corps commence par un renvoi à l'ouverture (« ${renvoi} »).`, { segmentIndex: premier.index });
  const accroche = a.accroche.map((s) => s.dit).join(" ");
  const motCle = new Set(motsPleins(e.motCle ?? "").map(racine));
  const communs = new Set(motsPleins(phrase).map(racine).filter((r) => !motCle.has(r) && motsPleins(accroche).map(racine).includes(r)));
  if (communs.size > 1) col.ajouter("C33", `La 1re phrase du corps répète l'accroche (${[...communs].join(", ")}).`, { segmentIndex: premier.index });
  const preuvesAccroche = new Set(a.accroche.flatMap((s) => s.segment.preuveIds ?? []));
  if ((premier.segment.preuveIds ?? []).some((id) => preuvesAccroche.has(id))) col.ajouter("C38 bis", "L'accroche dit déjà l'appui : la 1re phrase du corps le répète.", { segmentIndex: premier.index });
}

/* ---------- C38, C38 bis : redondance ---------- */
/** Groupes de deux mots consécutifs (en racines) dont au moins un mot plein : la matière d'un refrain. */
function paires(t: string): Set<string> {
  const m = texteCompare(t).split(/[\s'-]+/).filter(Boolean);
  return new Set(m.slice(1).flatMap((x, i) => (MOTS_OUTILS.has(m[i]) && MOTS_OUTILS.has(x) ? [] : [`${racine(m[i])} ${racine(x)}`])));
}

/**
 * Nombre de reprises d'une racine (ou d'une preuve) une fois le REFRAIN compté pour un : l'anaphore volontaire de Will
 * (« toute seule », « quinze minutes ») reprend le même groupe de mots tel quel ; ses reprises ne sont pas des redites.
 */
function reprisesHorsRefrain(textes: string[], r?: string): number {
  const ps = textes.map(paires);
  const compte = new Map<string, number>();
  for (const p of ps) for (const x of p) if (!r || x.split(" ").includes(r)) compte.set(x, (compte.get(x) ?? 0) + 1);
  const [refrain, n] = [...compte].sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
  return n >= 2 ? ps.filter((p) => !p.has(refrain)).length + 1 : textes.length;
}

export function c38(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a).filter((s) => s.role !== "boucle");
  const parPreuve = new Map<string, number>();
  const parMatiere = new Map<string, number>();
  const parRacine = new Map<string, number>();
  const motCle = new Set(motsPleins(e.motCle ?? "").map(racine));
  for (const s of parles) {
    for (const id of new Set(s.segment.preuveIds ?? [])) parPreuve.set(id, (parPreuve.get(id) ?? 0) + 1);
    for (const id of new Set(s.segment.matiereIds ?? [])) parMatiere.set(id, (parMatiere.get(id) ?? 0) + 1);
    for (const r of new Set(motsPleins(s.dit).map(racine))) if (!motCle.has(r) && r.length >= 4) parRacine.set(r, (parRacine.get(r) ?? 0) + 1);
  }
  const textesAvec = (f: (s: SegmentLu) => boolean) => parles.filter(f).map((s) => s.dit);
  for (const [id, n] of parPreuve) if (n > 2 && reprisesHorsRefrain(textesAvec((s) => (s.segment.preuveIds ?? []).includes(id))) > 2) col.ajouter("C38", `Preuve ${id} dite dans ${n} segments.`);
  for (const [r, n] of parRacine) if (n > 2 && reprisesHorsRefrain(textesAvec((s) => motsPleins(s.dit).map(racine).includes(r)), r) > 2) col.ajouter("C38", `« ${r}… » répété dans ${n} segments.`);
  for (const [id, n] of parMatiere) if (n > 2) col.ajouter("C38 bis", `Matière ${id} citée dans ${n} segments.`);
  const seuil = 10 * a.marge;
  const tot = parles.filter((s) => s.debutSec < seuil);
  const vus = new Map<string, number>();
  for (const s of tot) {
    for (const id of new Set([...(s.segment.preuveIds ?? []), ...(s.segment.matiereIds ?? [])])) {
      // L'écho (« Oui, quinze minutes. ») reprend le même groupe de mots : ce n'est pas une redite.
      const echo = vus.has(id) && reprisesHorsRefrain([a.segments.find((x) => x.index === vus.get(id))?.dit ?? "", s.dit]) === 1;
      if (vus.has(id) && !echo) col.ajouter("C38 bis", `Même preuve ou matière (${id}) dite deux fois dans les 10 premières secondes.`, { segmentIndex: s.index });
      vus.set(id, s.index);
    }
  }
}

/* ---------- C39 : pente « catalogue » ---------- */
export function c39(e: EntreeControle, a: Analyse, col: Collecte): void {
  let solutions = 0;
  let resultats = 0;
  for (const s of segmentsParles(a)) {
    solutions = s.marqueurs.includes("solution") ? solutions + 1 : 0;
    if (solutions === 3) col.ajouter("C39", "3 segments « solution » de suite (2 au plus).", { segmentIndex: s.index });
    resultats = s.marqueurs.includes("resultat") && !s.marqueurs.includes("relance") ? resultats + 1 : 0;
    if (resultats === 3) col.ajouter("C39", "3 résultats de suite sans relance.", { segmentIndex: s.index, niveau: e.auteur === "machine" ? "alerte" : "info" });
  }
}

/* ---------- C45 bis : fin sur le fait ---------- */
const MOTIF_MORALE = /(?:^|[^a-z])(en resume|retenez (que|bien)|retiens (que|bien)|la morale|bref|au final|en conclusion|c'est pour ca que|tout ca pour dire|la lecon)(?=$|[^a-z])/;
export function finSurLeFait(a: Analyse): boolean {
  const info = segmentsParles(a).filter((s) => s.role === "corps" || s.role === "promesse");
  const derniere = info.at(-1);
  if (!derniere) return false;
  return !MOTIF_MORALE.test(normaliser(derniere.dit)) && !derniere.dit.trim().endsWith("?");
}
export function c45bis(e: EntreeControle, a: Analyse, col: Collecte): void {
  const info = segmentsParles(a).filter((s) => s.role === "corps");
  if (info.length < 2) return;
  const derniere = info[info.length - 1];
  if (MOTIF_MORALE.test(normaliser(derniere.dit))) col.ajouter("C45 bis", "La dernière phrase d'information est un résumé ou une morale, pas un fait.", { segmentIndex: derniere.index });
}

/* ---------- C46, C46 bis : valeur avant 4 s, geste ou verdict avant 5 s ---------- */
export function c46(e: EntreeControle, a: Analyse, col: Collecte): void {
  const seuil = 4 * a.marge;
  const valeur = segmentsParles(a).find(
    (s) => (s.segment.nature === "fait" && ((s.segment.preuveIds ?? []).length > 0 || (s.segment.matiereIds ?? []).length > 0)) || s.marqueurs.some((m) => m === "preuve" || m === "livraison" || m === "ancrage"),
  );
  if (!valeur || valeur.finSec > seuil) col.ajouter("C46", `Aucune valeur (fait, preuve, geste) dite avant ${seuil.toFixed(1)} s.`);
  const temps = e.structure?.temps.find((t) => t.avantSec !== undefined);
  if (temps) {
    const limite = temps.avantSec! * a.marge;
    const geste = segmentsParles(a).find(
      (s) =>
        (s.segment.matiereIds ?? []).some((id) => ["avis-will", "limite"].includes(a.matieres.get(id)?.type ?? "")) ||
        (s.segment.preuveIds ?? []).some((id) => a.preuves.get(id)?.type === "regle-loi") ||
        (s.segment.annotations as { temps?: string } | undefined)?.temps === temps.id,
    );
    if (!geste || geste.finSec > limite) col.ajouter("C46 bis", `${temps.libelle} attendu avant ${limite.toFixed(1)} s.`);
  }
}

/* ---------- C63 : appel (addendum : facultatif, 5 à 47 mots) ---------- */
export function c63(e: EntreeControle, a: Analyse, col: Collecte): void {
  const texte = a.appel.map((s) => s.dit).join(" ").trim();
  if (!texte) {
    if (!e.recette.appelFacultatif) col.ajouter("C63", "Aucun appel.");
    return;
  }
  const n = mots(texte).length;
  if (n > e.recette.appelMaxMots) col.ajouter("C63", `Appel de ${n} mots (${e.recette.appelMaxMots} au plus).`, { segmentIndex: a.appel[0].index });
  else if (n < e.recette.appelMinMots) col.ajouter("C63", `Appel de ${n} mots, plus court que les modèles (${e.recette.appelMinMots} à ${e.recette.appelMaxMots}).`, { segmentIndex: a.appel[0].index, niveau: "info" });
}

/* ---------- C73, C74 : pauses proposées, compteur de liste ---------- */
export function c73c74(e: EntreeControle, a: Analyse, col: Collecte): void {
  const pauses = a.segments.filter((s) => s.segment.annotations?.pause !== undefined || (s.segment.pauseApresSec ?? 0) > 0);
  if (pauses.length > 2) col.ajouter("C73", `${pauses.length} pauses (2 au plus).`);
  for (const s of pauses) {
    const p = (s.segment.annotations?.pause ?? {}) as { sec?: number; proposee?: boolean };
    const sec = p.sec ?? s.segment.pauseApresSec ?? 0;
    if (sec > 0.4) col.ajouter("C73", `Pause de ${sec} s (0,4 s au plus).`, { segmentIndex: s.index });
    if (!s.marqueurs.includes("relance") && !s.marqueurs.includes("exception")) col.ajouter("C73", "Pause hors d'une relance ou d'une exception.", { segmentIndex: s.index });
    if (e.auteur === "machine" && p.proposee !== true) col.ajouter("C73", "Pause posée par la machine sans être « proposée ».", { segmentIndex: s.index });
  }
  const annonce = a.segments.find((s) => (s.segment.annotations as { liste?: { total: number } } | undefined)?.liste);
  if (annonce) {
    const total = (annonce.segment.annotations as { liste: { total: number } }).liste.total;
    const points = a.segments.filter((s) => (s.segment.annotations as { listePoint?: number } | undefined)?.listePoint !== undefined).length;
    if (points !== total) col.ajouter("C74", `Compteur de liste à ${total}, ${points} points dits.`, { segmentIndex: annonce.index });
    const dit = nombresAffirmes(annonce.dit).find((n) => Number.isInteger(n.valeur));
    if (dit && dit.valeur !== total) col.ajouter("C74", `L'annonce dit ${dit.valeur}, le compteur ${total}.`, { segmentIndex: annonce.index });
  }
}
