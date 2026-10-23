/**
 * Contrôles de STYLE (plan v5 B.7.2 ; addendum du 02/10, points 3, 9 et 11). PUR.
 * C3 bis, C4, C5, C5 bis, C5 ter, C9, C9 bis, C16, C24, C25, C25 bis, C27, C37, C40, C42.
 * Calibrés pour ne lever AUCUNE alerte sur les 18 transcriptions de l'avocat de référence (lot GR) : les tournures présentes chez lui
 * (classe C du calibrage) ne sont jamais bloquantes ; « Il ne faut jamais… » est permis dans l'accroche.
 */
import { phrasesTropDenses } from "@/domaine/lecture";
import { appliquerInterdits, appliquerTournures } from "@/domaine/voix";
import { Collecte, segmentsParles, type Analyse, type SegmentLu } from "./analyse";
import type { EntreeControle, ViolationControle } from "./types";
import { ecartType, echapper, mots, normaliser, phrasesDe, sansCitations, texteCompare } from "./texte";

/* ---------- motifs (sur texte normalisé : minuscules, sans accents) ---------- */

/** Impératifs d'appel (C3, C3 bis, C72). */
export const MOTIF_IMPERATIF_APPEL =
  /(?:^|[^a-z])(abonne[zs]?(-vous|-toi)?|like[zs]?|likez|commente[zs]?|partage[zs]?|envoie[zs]?(-la|-le|-lui|-leur)?|envoyez(-la|-le|-lui|-leur)?|transmet(s|tez)(-la|-le|-lui|-leur)?|enregistre[zs]? (cette|la) video|sauvegarde[zs]?|garde[zs]? (cette|la) video|suive[zs]?-moi|suis-moi|clique[zs]?|contacte[zs]?-(nous|moi)|ecrive[zs]?-(nous|moi)|ecris-(nous|moi)|prene[zs]? rendez-vous|reserve[zs]? (un|votre|ton) (appel|creneau|rendez-vous)|lien en (bio|commentaire)|identifie[zs]?|tague[zs]?|dites-moi en commentaire|dis-moi en commentaire)(?=$|[^a-z])/;

const MOTIF_SALUT = /^(bonjour|salut|hello|coucou|bienvenue|hey)(?=$|[^a-z])/;
const MOTIF_PRESENTATION = /(?:^|[^a-z])(je m'appelle|moi c'est|je suis (maitre|le fondateur|la fondatrice|expert|experte|consultant|consultante|avocat|avocate)\b)/;
const MOTIF_STOP_SEUL = /^(arretez|stop|arrete)\s*[.!]*$/;
/** Injonction adressée au spectateur ; une subordonnée descriptive (« … et que vous devez restituer », D04) n'en est pas une. */
const MOTIF_DEVOIR = /(?:^|[^a-z])(?<!(?:que|qu'|si|quand|lorsque|ou) )(vous devez|tu dois|il faut que (vous|tu)|vous etes obliges?|tu es oblige)(?=$|[^a-z])/;
const MOTIF_DEVOIR_NEGATIF = /(?:^|[^a-z])(vous ne devez (jamais|pas|surtout)|tu ne dois (jamais|pas|surtout))(?=$|[^a-z])/;

/** C40 : boucle ouverte annoncée (« je vous montre », « à la fin de la vidéo », « restez jusqu'au bout »). */
export const MOTIF_BOUCLE_META =
  /(?:^|[^a-z])(je (vous|te) (dis|montre|explique)(?! (pas|rien))|je vais (vous|te) (le )?(montrer|dire|expliquer) (a la fin|plus tard|juste apres|dans un instant)|a la fin de (la|cette) video|jusqu'a la fin( de la video)?|jusqu'au bout|reste[zs]? (jusqu'|avec moi|bien)|vous allez voir|tu vas voir|attend(ez|s) la fin)(?=$|[^a-z])/;

const MOTIF_AUTOCERTIFICATION = /(?:^|[^a-z])(chiffres? verifies?|verifie par|cas reel|cas reels|valide par|certifie|100 % verifie)(?=$|[^a-z])/;
/** G4 : une négation (« un tableur ne vérifie rien ») n'est pas un label. */
const MOTIF_LABEL_ECRIT = /(?:^|[^a-z])(?<!ne |n'|pas )(validee?s?|verifiee?s?|certifiee?s?)(?=$|[^a-z])/;
const MOTIF_AFFIRMATION_PLATEFORME = /(?:^|[^a-z])(l'algorithme|l'algo|la plateforme (favorise|pousse|penalise|met en avant))(?=$|[^a-z])/;
const MOTIF_PROMESSE_ABSOLUE = /(?:^|[^a-z])(garanti|garantie|garantis|garanties|a coup sur|sans aucun risque|resultat assure)(?=$|[^a-z])/;
const MOTIF_CENT_POUR_CENT = /(?:^|[^a-z0-9])(100 ?%|cent pour cent|100 pour cent)/;
const MOTIF_PASSE = /(?:^|[^a-z])(a ete|ont ete|est passee?s?|sont passee?s?|etait|etaient|avait|avaient|a fait|ont fait|a pris|ont pris|a supprime|ont supprime|est devenue?s?|sont devenue?s?)(?=$|[^a-z])/;
const MOTIF_SUPERLATIF = /(?:^|[^a-z])((le|la|les) (meilleure?s?|pires?|seule?s?) (outil|solution|methode|facon|moyen|logiciel|cabinet|expert|offre)s?|numero un|imbattables?|unique au monde|le plus (rapide|simple|efficace|puissant|fiable|complet|rentable)|la plus (rapide|simple|efficace|puissante|fiable|complete|rentable))(?=$|[^a-z])/;
export const MOTIF_QUANTIFICATEUR_VAGUE = /(?:^|[^a-z])(la plupart|beaucoup de|enormement|souvent|des milliers|de nombreux|de nombreuses|la majorite|presque tous|presque toutes)(?=$|[^a-z])/;

/** C5 ter : tics relevés au banc (niveau `grappe`, en plus des tournures `grappe` semées). */
const TICS_C5_TER: { id: string; motif: RegExp }[] = [
  { id: "car-en-tete", motif: /(?:^|[.!?]\s+)car\s/g },
  { id: "c-est-donc", motif: /(?:^|[^a-z])c'est donc (possible|simple|faisable|clair)(?=$|[^a-z])/g },
  { id: "annonce-puis-contenu", motif: /(?:^|[.!?]\s+)(une|deux|trois) (exception|regle|limite|condition|chose|astuce)s?\s*[.:]/g },
  { id: "question-arrivee-telle-quelle", motif: /la question (est arrivee|m'est arrivee) telle quelle/g },
];

const INTERROGATIFS = /^(pourquoi|comment|combien|qu'est-ce|quoi|quel|quelle|quels|quelles|et (la|le|les|si|alors|apres)|alors|le resultat|la raison|le probleme)(?=$|[^a-z])/;

function compterMotif(texte: string, motif: RegExp): number {
  const g = new RegExp(motif.source, motif.flags.includes("g") ? motif.flags : motif.flags + "g");
  return [...texte.matchAll(g)].length;
}

/** Nombre de questions-réponses à soi-même : une question courte qui ouvre par un interrogatif, puis sa réponse. */
export function questionsReponsesASoi(texte: string): number {
  const phrases = phrasesDe(sansCitations(texte)).map(normaliser);
  let n = 0;
  for (let i = 0; i < phrases.length - 1; i++) {
    const p = phrases[i];
    if (p.endsWith("?") && mots(p).length <= 8 && INTERROGATIFS.test(p) && !phrases[i + 1].endsWith("?")) n++;
  }
  return n;
}

/** Texte de toutes les couches AFFICHÉES de la version (C4, C24, C37 : « toutes les couches »). */
export function couchesAffichees(e: EntreeControle): { couche: string; texte: string }[] {
  const c: { couche: string; texte: string }[] = [];
  if (e.encadre?.texte) c.push({ couche: "encadré", texte: e.encadre.texte });
  if (e.encadre2?.texte) c.push({ couche: "second encadré", texte: e.encadre2.texte });
  if (e.couverture?.texte) c.push({ couche: "couverture", texte: e.couverture.texte });
  for (const b of [...e.ouverture, ...e.corps, ...e.fin]) for (const s of b.segments) if (s.incrustation?.texte) c.push({ couche: "incrustation", texte: s.incrustation.texte });
  const p = e.publication;
  if (p?.texte) c.push({ couche: "texte de publication", texte: p.texte });
  if (p?.premiereLigne) c.push({ couche: "première ligne", texte: p.premiereLigne });
  if (p?.commentaireEpingle) c.push({ couche: "commentaire épinglé", texte: p.commentaireEpingle });
  for (const t of p?.titres ?? []) c.push({ couche: "titre", texte: t });
  if (p?.post?.texte) c.push({ couche: "post", texte: p.post.texte });
  if (e.prompteur) c.push({ couche: "téléprompteur", texte: e.prompteur });
  return c;
}

/* ---------- C3 bis ---------- */
export function c3bis(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of a.accroche) {
    const n = normaliser(s.dit);
    const premiere = normaliser(phrasesDe(s.dit)[0] ?? "");
    if (MOTIF_SALUT.test(premiere)) col.ajouter("C3 bis", "L'accroche commence par un salut.", { segmentIndex: s.index });
    if (MOTIF_PRESENTATION.test(n)) col.ajouter("C3 bis", "L'accroche commence par une présentation.", { segmentIndex: s.index });
    if (phrasesDe(s.dit).some((p) => MOTIF_STOP_SEUL.test(normaliser(p)))) col.ajouter("C3 bis", "« Arrêtez. » ou « Stop. » seul dans l'accroche.", { segmentIndex: s.index });
    if (MOTIF_IMPERATIF_APPEL.test(n)) col.ajouter("C3 bis", "Impératif d'appel dans l'accroche.", { segmentIndex: s.index });
  }
  for (const s of segmentsParles(a)) {
    const n = normaliser(sansCitations(s.dit));
    if (!MOTIF_DEVOIR.test(n) || MOTIF_DEVOIR_NEGATIF.test(n)) continue;
    const dur = s.role === "accroche" || s.marqueurs.includes("envoi");
    col.ajouter("C3 bis", "Injonction de devoir adressée au spectateur (« vous devez… »).", { segmentIndex: s.index, niveau: dur ? undefined : e.auteur === "machine" ? "alerte" : "info" });
  }
}

/* ---------- C4 : tu / vous ---------- */
const MOTIF_TU = /(?:^|[^a-z'])(tu|te|toi|ton|ta|tes|t')(?=$|[^a-z])/;
const MOTIF_VOUS = /(?:^|[^a-z])(vous|votre|vos)(?=$|[^a-z])|(?:^|[^a-z])[a-z]{3,}ez-(la|le|lui|leur|nous|moi|les)(?=$|[^a-z])/;

export function formesAdresse(texte: string): { tu: boolean; vous: boolean } {
  const n = normaliser(sansCitations(texte));
  return { tu: MOTIF_TU.test(n), vous: MOTIF_VOUS.test(n) };
}

export function c4(e: EntreeControle, a: Analyse, col: Collecte): void {
  const attendue = e.adresse;
  const autre = attendue === "vous" ? "tu" : "vous";
  for (const s of segmentsParles(a)) {
    if (s.segment.sourceTexte) continue; // citation mot pour mot d'une matière
    const f = formesAdresse(s.dit);
    if (f[autre]) col.ajouter("C4", `« ${autre} » dans une version au « ${attendue} ».`, { segmentIndex: s.index });
  }
  for (const c of couchesAffichees(e)) {
    const f = formesAdresse(c.texte);
    if (f[autre]) col.ajouter("C4", `« ${autre} » dans ${c.couche} d'une version au « ${attendue} ».`);
  }
}

/* ---------- C5, C5 bis, C5 ter : liste anti-texte IA (fonction pure de G2 : `appliquerTournures`) ---------- */
export interface ComptageTournures {
  bloquantes: { id: string; segmentIndex?: number; extrait: string }[];
  grappes: { id: string; segmentIndex?: number; extrait: string }[];
}

/** Applique les tournures semées (classe A `bloquant`, classe B `grappe`) et les tics C5 ter à un texte. */
export function compterTournures(textes: { texte: string; segmentIndex?: number; accroche?: boolean }[], tournures: NonNullable<EntreeControle["tournures"]>): ComptageTournures {
  const r: ComptageTournures = { bloquantes: [], grappes: [] };
  // « Ce n'est pas X. C'est Y. » : permis une fois dans l'accroche (C5 bis la traite).
  const liste = tournures.filter((t) => !/ce-n-est-pas-x-c-est-y$/.test(t.motif)).map((t) => ({ id: t.id, motif: t.motif, regex: t.regex, niveau: t.niveau, portee: t.portee ?? ("partout" as const) }));
  for (const x of textes) {
    const a = appliquerTournures(x.texte, liste);
    for (const t of a.bloquantes) for (const extrait of t.extraits) r.bloquantes.push({ id: t.id, segmentIndex: x.segmentIndex, extrait });
    for (const t of a.grappes) for (const extrait of t.extraits) r.grappes.push({ id: t.id, segmentIndex: x.segmentIndex, extrait });
  }
  for (const x of textes) {
    const n = normaliser(x.texte);
    for (const tic of TICS_C5_TER) for (const m of n.matchAll(tic.motif)) r.grappes.push({ id: tic.id, segmentIndex: x.segmentIndex, extrait: m[0].trim() });
  }
  const tout = textes.map((x) => x.texte).join(" ");
  const qr = questionsReponsesASoi(tout);
  if (qr > 1) r.grappes.push({ id: "questions-reponses-a-soi", extrait: `${qr} questions-réponses à soi-même` });
  const saufQue = compterMotif(normaliser(tout), /(?:^|[^a-z])sauf que(?=$|[^a-z])/);
  if (saufQue > 1) r.grappes.push({ id: "sauf-que-repete", extrait: `« Sauf que » ${saufQue} fois` });
  return r;
}

export function c5(e: EntreeControle, a: Analyse, col: Collecte): void {
  const tournures = e.tournures ?? [];
  const textes = segmentsParles(a).map((s) => ({ texte: s.dit, segmentIndex: s.index }));
  const r = compterTournures(textes, tournures);
  // Carnet de voix de Will (« à reprendre telles quelles ») : une de ses expressions n'est pas une tournure IA.
  const carnet = new Set((e.contexte?.carnetVoix ?? []).map(texteCompare).filter(Boolean));
  r.bloquantes = r.bloquantes.filter((b) => !carnet.has(texteCompare(b.extrait)));
  for (const b of r.bloquantes) col.ajouter("C5", `Tournure interdite : « ${b.extrait} » (${b.id}).`, { segmentIndex: b.segmentIndex, regleId: b.id });
  const grappesC5 = r.grappes.filter((g) => g.id.startsWith("tournure-"));
  const ticsC5ter = r.grappes.filter((g) => !g.id.startsWith("tournure-"));
  if (r.grappes.length >= 2) {
    for (const g of grappesC5) col.ajouter("C5", `Tournure en grappe (${r.grappes.length} dans le script) : « ${g.extrait} ».`, { segmentIndex: g.segmentIndex, regleId: g.id });
    for (const g of ticsC5ter) col.ajouter("C5 ter", `Tic relevé au banc (${r.grappes.length} dans le script) : « ${g.extrait} ».`, { segmentIndex: g.segmentIndex, regleId: g.id });
  }
  // Post rédigé : une grappe compte dès la première.
  const post = e.publication?.post?.texte;
  if (post) {
    const rp = compterTournures([{ texte: post }], tournures);
    for (const b of rp.bloquantes) col.ajouter("C5", `Tournure interdite dans le post : « ${b.extrait} ».`, { regleId: b.id });
    for (const g of rp.grappes) col.ajouter("C5", `Tournure en grappe dans le post : « ${g.extrait} ».`, { regleId: g.id });
  }
  // Même liste sur les autres couches (n° 94) : seules les bloquantes y sont relevées.
  for (const c of couchesAffichees(e).filter((x) => x.couche !== "post")) {
    const rc = compterTournures([{ texte: c.texte }], tournures.filter((t) => t.niveau === "bloquant"));
    for (const b of rc.bloquantes) col.ajouter("C5", `Tournure interdite dans ${c.couche} : « ${b.extrait} ».`, { regleId: b.id });
  }
}

const MOTIF_CE_N_EST_PAS = /(?:^|[^a-z])(ce n'est|c'est) pas [^.?!]{1,40}[.,;:]\s*c'est(?=$|[^a-z])/g;
const MOTIF_TRIADE = /(?:^|[^a-z'])([a-z]{4,}), ([a-z]{4,}),? et ([a-z]{4,})(?=\s*[.!?]|$)/;
const MOTIF_PONT_REVELATION = /(?:^|[^a-z])(et c'est la que|c'est la que tout|et la, surprise|la ou ca devient)(?=$|[^a-z])/;

export function c5bis(e: EntreeControle, a: Analyse, col: Collecte): void {
  let ceNestPas = 0;
  for (const s of segmentsParles(a)) {
    const n = normaliser(s.dit);
    const k = [...n.matchAll(MOTIF_CE_N_EST_PAS)].length;
    if (k) {
      ceNestPas += k;
      if (s.role !== "accroche") col.ajouter("C5 bis", "« Ce n'est pas X. C'est Y. » hors de l'accroche.", { segmentIndex: s.index });
    }
    if (MOTIF_TRIADE.test(n)) col.ajouter("C5 bis", "Triade dans un même segment (« rapide, simple et efficace »).", { segmentIndex: s.index });
    if (MOTIF_PONT_REVELATION.test(n)) col.ajouter("C5 bis", "Pont de révélation (« et c'est là que… »).", { segmentIndex: s.index });
  }
  if (ceNestPas > 1) col.ajouter("C5 bis", `« Ce n'est pas X. C'est Y. » ${ceNestPas} fois (une seule permise).`);
  const tirets = segmentsParles(a).reduce((n, s) => n + (s.texte.match(/—/g)?.length ?? 0), 0);
  if (tirets > 1) col.ajouter("C5 bis", `${tirets} tirets longs (un au plus).`);
}

/* ---------- C9, C9 bis : rythme et densité ---------- */
export const SEUIL_ECART_TYPE_RYTHME = 2.5;
export const PLAFOND_MOTS_PHRASE = 14;

export function mesuresRythme(texte: string): { ecartType: number; plusLongue: number; courtes: number; phrases: number } {
  const longueurs = phrasesDe(texte).map((p) => mots(p).length);
  return { ecartType: +ecartType(longueurs).toFixed(2), plusLongue: Math.max(0, ...longueurs), courtes: longueurs.filter((n) => n <= 3).length, phrases: longueurs.length };
}

/** Une liste annoncée par « : » (3 éléments au moins, de 6 mots au plus chacun) se dit élément par élément : on mesure l'annonce et chaque élément. */
function longueurDite(phrase: string): number {
  const [annonce, ...suite] = phrase.split(":");
  if (!suite.length) return mots(phrase).length;
  const elements = suite.join(":").split(/[,;]/);
  if (elements.length < 3 || elements.some((x) => mots(x).length > 6)) return mots(phrase).length;
  return Math.max(mots(annonce).length, ...elements.map((x) => mots(x).length));
}

export function c9(e: EntreeControle, a: Analyse, col: Collecte, seuil = SEUIL_ECART_TYPE_RYTHME): void {
  const texte = segmentsParles(a).map((s) => s.dit).join(" ");
  const m = mesuresRythme(texte);
  if (m.phrases >= 3 && m.ecartType < seuil) col.ajouter("C9", `Rythme trop régulier : écart-type ${m.ecartType} mots (seuil ${seuil}).`);
  const plusLongue = Math.max(0, ...phrasesDe(texte).map(longueurDite));
  if (plusLongue > PLAFOND_MOTS_PHRASE) col.ajouter("C9", `Une phrase de ${plusLongue} mots (plafond ${PLAFOND_MOTS_PHRASE}).`);
  if (m.phrases >= 3 && m.courtes === 0) col.ajouter("C9", "Aucune phrase de 3 mots ou moins.");
  for (const s of segmentsParles(a)) {
    for (const p of phrasesTropDenses(s.dit, e.debit)) {
      col.ajouter("C9 bis", `Trop dense : ${p.motsParSeconde} mots/s (« ${p.phrase} »).`, { segmentIndex: s.index });
    }
  }
}

/* ---------- C16 : superlatifs et quantificateurs vagues ---------- */
export function c16(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of segmentsParles(a)) {
    const n = normaliser(s.dit);
    const preuves = (s.segment.preuveIds ?? []).map((id) => a.preuves.get(id)).filter((p) => !!p);
    if (MOTIF_SUPERLATIF.test(n) && !preuves.length) col.ajouter("C16", "Superlatif sans preuve.", { segmentIndex: s.index });
    const q = MOTIF_QUANTIFICATEUR_VAGUE.exec(n);
    if (q) {
      const sousFormulation = preuves.some((p) => p!.formulationsAutorisees.some((f) => normaliser(s.dit).includes(normaliser(f)) && normaliser(f).includes(q[1])));
      const dansMatiere = (s.segment.matiereIds ?? []).some((id) => normaliser(a.matieres.get(id)?.texte ?? "").includes(q[1]));
      if (!sousFormulation && !dansMatiere) col.ajouter("C16", `Quantificateur vague « ${q[1]} » hors formulation autorisée ou matière citée.`, { segmentIndex: s.index });
    }
  }
}

/* ---------- C24, C25, C25 bis : affiché sans phonétique, sigles ---------- */
const MOTIF_EPELLATION = /\b[A-Z](?:-[A-Z]){1,5}\b/;
const MOTIF_SIGLE = /\b[A-Z]{2,5}\b/g;

export function c24c25(e: EntreeControle, a: Analyse, col: Collecte): void {
  const dits = (e.prononciations ?? []).filter((p) => p.dit !== p.forme);
  const affiches = [...segmentsParles(a).map((s) => ({ couche: "texte affiché", texte: s.texte, index: s.index as number | undefined })), ...couchesAffichees(e).map((c) => ({ ...c, index: undefined }))];
  if (e.trame) affiches.push({ couche: "trame", texte: [...e.trame.reperes, ...e.trame.chiffres].join(" "), index: undefined });
  for (const x of affiches) {
    if (MOTIF_EPELLATION.test(x.texte)) col.ajouter("C24", `Forme phonétique dans ${x.couche} (« ${MOTIF_EPELLATION.exec(x.texte)![0]} »).`, { segmentIndex: x.index });
    for (const p of dits) if (x.texte.includes(p.dit)) col.ajouter("C24", `Forme dite « ${p.dit} » dans ${x.couche} : écrire « ${p.forme} ».`, { segmentIndex: x.index });
  }
  const connus = new Set([...(e.prononciations ?? []).map((p) => p.forme), ...(e.siglesAValider ?? [])]);
  const inconnus = new Set<string>();
  for (const s of segmentsParles(a)) for (const m of s.texte.matchAll(MOTIF_SIGLE)) if (!connus.has(m[0])) inconnus.add(m[0]);
  for (const sigle of inconnus) col.ajouter("C25", `Sigle « ${sigle} » à valider (Ma voix) ; lu comme un mot d'ici là.`);
  for (const s of segmentsParles(a)) {
    if (s.dit === s.texte) continue;
    for (const m of s.dit.matchAll(MOTIF_SIGLE)) if (!connus.has(m[0]) && !inconnus.has(m[0])) col.ajouter("C25 bis", `Forme dite non sûre : « ${m[0]} ».`, { segmentIndex: s.index });
  }
}

/* ---------- C27 : comptes et durées calculés par le code ---------- */
const CLES_DECLAREES = ["duree", "dureeSec", "secondes", "mots", "nombreMots", "note", "score"];
export function c27(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of a.segments) {
    const cles = Object.keys(s.segment.annotations ?? {}).filter((k) => CLES_DECLAREES.includes(k));
    if (cles.length) col.ajouter("C27", `Le texte déclare ${cles.join(", ")} : ces valeurs sont calculées par le code.`, { segmentIndex: s.index });
    if (/\(\s*\d+\s*mots?\s*\)|≈\s*\d+(?:[.,]\d+)?\s*s\b|\b\d{2,3}\s*\/\s*100\b/.test(s.texte)) col.ajouter("C27", "Compte, durée ou note écrit dans le texte.", { segmentIndex: s.index });
  }
}

/* ---------- C37 : affirmations datées et auto-certification ---------- */
export function c37(e: EntreeControle, a: Analyse, col: Collecte): void {
  const couches = [...segmentsParles(a).map((s) => ({ couche: "texte dit", texte: s.dit, index: s.index as number | undefined })), ...couchesAffichees(e).map((c) => ({ ...c, index: undefined }))];
  const justifiee = (e.publication?.justifications ?? []).some((j) => !!j.regleId);
  for (const c of couches) {
    const n = normaliser(c.texte);
    if (MOTIF_AUTOCERTIFICATION.test(n)) col.ajouter("C37", `Auto-certification dans ${c.couche} (« ${MOTIF_AUTOCERTIFICATION.exec(n)![1]} »).`, { segmentIndex: c.index });
    // Couches écrites : « validé », « vérifié » seuls s'y lisent comme un label (« cas client validé »).
    else if (c.couche !== "texte dit" && MOTIF_LABEL_ECRIT.test(n)) col.ajouter("C37", `Auto-certification dans ${c.couche} (« ${MOTIF_LABEL_ECRIT.exec(n)![1]} »).`);
    if (MOTIF_AFFIRMATION_PLATEFORME.test(n) && !justifiee) col.ajouter("C37", `Affirmation sur une plateforme sans règle datée, dans ${c.couche}.`, { segmentIndex: c.index });
  }
}

/* ---------- C40 : boucle ouverte annoncée ---------- */
export function c40(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of segmentsParles(a)) {
    if (s.role === "appel") continue;
    const n = normaliser(s.dit);
    const m = MOTIF_BOUCLE_META.exec(n);
    if (m) col.ajouter("C40", `Boucle ouverte annoncée : « ${m[1]} ».`, { segmentIndex: s.index });
  }
}

/* ---------- C42 : promesses, absolus, interdits de Will ---------- */
/** Interdits permanents, appliqués même sans contexte de Will. */
export const INTERDITS_PERMANENTS = [
  { origine: "permanent", id: "interdit-permanent-villeexemple", texte: "« Villeexemple »", regex: "\\bvilleexemple\\b" },
  { origine: "permanent", id: "interdit-permanent-aucun-gain-garanti", texte: "« Aucun gain garanti »", regex: "\\baucun gain garanti\\b" },
];

export function c42(e: EntreeControle, a: Analyse, col: Collecte): void {
  const ctx = e.contexte;
  const couches = [...segmentsParles(a).map((s) => ({ couche: "texte dit", texte: s.dit, seg: s as SegmentLu | undefined })), ...couchesAffichees(e).map((c) => ({ ...c, seg: undefined }))];
  for (const c of couches) {
    const n = normaliser(c.texte);
    const idx = c.seg?.index;
    const m = MOTIF_PROMESSE_ABSOLUE.exec(n);
    if (m) col.ajouter("C42", `Promesse absolue « ${m[1]} ».`, { segmentIndex: idx });
    for (const p of ctx?.promessesInterdites ?? []) if (n.includes(normaliser(p))) col.ajouter("C42", `Promesse interdite par Will : « ${p} ».`, { segmentIndex: idx });
    // Fonction pure de G2 : les interdits qui ont une expression, appliqués d'office.
    for (const i of appliquerInterdits(c.texte, [...INTERDITS_PERMANENTS, ...(ctx?.interdits ?? []).map((x) => ({ origine: "contexte", ...x }))])) col.ajouter("C42", `Interdit de Will (${i.id}) : ${i.texte} (« ${i.extrait} »).`, { segmentIndex: idx, regleId: i.id });
    for (const j of ctx?.jargonInterdit ?? []) if (new RegExp(`(?:^|[^a-z])${echapper(normaliser(j))}(?=$|[^a-z])`).test(n)) col.ajouter("C42", `Mot refusé : « ${j} ».`, { segmentIndex: idx });
    if (c.seg && MOTIF_CENT_POUR_CENT.test(n)) {
      const ok = MOTIF_PASSE.test(n) && (c.seg.segment.preuveIds ?? []).length > 0 && !/(?:^|[^a-z])(vous|votre|vos|tu|ton|ta|tes)(?=$|[^a-z])/.test(n);
      if (!ok) col.ajouter("C42", "« 100 % » dit hors d'un fait passé prouvé, ou adressé au spectateur.", { segmentIndex: idx });
    }
  }
}

/** Contrôles de style seuls : ceux qu'on fait tourner sur un texte humain (l'avocat de référence, Will) pour mesurer les faux positifs. */
export function controlesDeStyle(e: EntreeControle, a: Analyse): ViolationControle[] {
  const col = new Collecte(e);
  c3bis(e, a, col);
  c5(e, a, col);
  c5bis(e, a, col);
  c37(e, a, col);
  c40(e, a, col);
  c42(e, a, col);
  return col.violations;
}

export { compterMotif };
