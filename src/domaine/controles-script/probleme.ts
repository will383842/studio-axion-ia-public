/**
 * « RÉSOUDRE UN PROBLÈME DOULOUREUX » (addendum du 02/10, §2 bis ; lot G4). PUR.
 *
 *  - C77 : le sujet part d'un problème RÉEL du spectateur, en mots concrets, jamais d'une fonctionnalité ni d'un outil
 *          (absent ou abstrait → bloquant pour la machine) ;
 *  - C78 : le coût du problème (temps, argent, risque, stress, réputation) est dit AVANT 5 s (sinon : à revoir) ;
 *  - C79 : la vidéo donne une ISSUE (solution, premier geste ou verdict utilisable) : jamais une peur sans réponse
 *          (aucune → bloquant) ;
 *  - C80 : l'INTENSITÉ en série seulement (au plus 2 sujets sur 3 en « douleur » franche : trois d'affilée → alerte de
 *          série). C80 ne dispense JAMAIS de nommer la douleur : un sujet en « gain » ou en « curiosité » la nomme aussi ;
 *  - C94 : la douleur est NOMMÉE dans CHAQUE script, quelle que soit son intensité (marqueur « cout », mots du problème
 *          déclaré, ou une conséquence vécue dite) ; sinon ALERTE, jamais bloquant (audit du 17/10).
 * Aucun format, aucun réseau n'est nommé ici.
 */
import type { Analyse, Collecte } from "./analyse";
import { segmentsParles } from "./analyse";
import { motsPleins } from "./texte";
import type { EntreeControle, ViolationControle } from "./types";

function norm(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Mots qui disent un « bénéfice » abstrait, pas une douleur vécue. */
const ABSTRAIT = /\b(transformation|digitali[sz]|optimis|efficacite|performance|productivite|innovation|potentiel|strategi|competitivite|croissance|modernis|agilite|synergie|valeur ajoutee|levier)/;
/** Le problème posé comme un outil ou une fonctionnalité (« l'IA permet… », « notre console… »). */
const OUTIL_EN_SUJET = /^(l\x27|le |la |les |un |une |notre |nos )?(outil|fonctionnalite|logiciel|application|solution|plateforme|ia\b|intelligence artificielle|chatgpt|console|automatisation)/;
/** Indices de concret : une quantité, un objet du travail, un geste, une conséquence vécue. */
const CONCRET = /(\d|heure|jour|semaine|mois|fichier|excel|tableur|facture|devis|mail|courriel|erreur|client|dossier|formule|copier|coller|ressaisi|recopi|amende|sanction|retard|perd|perte|oubli|stress|nuit|week-end|soir|salarie|equipe|comptable|chiffre|donnee|contrat|risque|controle|redress)/;

/** Problème concret ? Renvoie la raison du refus, ou null. */
export function problemeAbstrait(probleme: string | undefined): string | null {
  const p = norm(probleme ?? "").trim();
  if (!p) return "Problème du spectateur absent : l'écriture ne part pas sans lui.";
  if (OUTIL_EN_SUJET.test(p)) return `Le problème est un outil ou une fonctionnalité (« ${probleme} »), pas une douleur du spectateur.`;
  if (!CONCRET.test(p) && !GESTE_QUOTIDIEN.test(p)) return `Problème abstrait (« ${probleme} ») : il faut des mots concrets (une tâche, une quantité, une conséquence).`;
  if (ABSTRAIT.test(p) && p.split(/\s+/).length < 8) return `Problème abstrait (« ${probleme} ») : dites ce que vit le spectateur.`;
  return null;
}

export function c77(e: EntreeControle, _a: Analyse, col: Collecte): void {
  const angle = e.maitre?.angle;
  if (!angle) return;
  const r = problemeAbstrait(angle.probleme);
  if (r) col.ajouter("C77", r);
  else if (!angle.cout?.trim()) col.ajouter("C77", "Le coût du problème (temps, argent, risque…) n'est pas déclaré.");
}

export function c78(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!e.maitre?.angle) return;
  const s = segmentsParles(a).find((x) => x.marqueurs.includes("cout"));
  const limite = 5 / a.marge;
  if (!s) col.ajouter("C78", "Le coût du problème n'est jamais dit (marqueur « cout » absent).");
  else if (s.debutSec > limite) col.ajouter("C78", `Coût du problème dit à ${s.debutSec.toFixed(1).replace(".", ",")} s (avant 5 s attendu).`, { segmentIndex: s.index });
}

const ISSUE = ["solution", "resultat", "methode"];
export function c79(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!e.maitre?.angle) return;
  const parles = segmentsParles(a).filter((s) => s.role === "corps" || s.role === "promesse" || s.role === "accroche");
  const issue = parles.some((s) => s.marqueurs.some((m) => ISSUE.includes(m))) || (!!e.maitre.angle.issue?.trim() && parles.some((s) => s.marqueurs.includes("livraison")));
  if (!issue) col.ajouter("C79", "Aucune issue donnée (ni solution, ni geste, ni verdict) : la vidéo laisse le problème sans réponse.");
}

/** Une conséquence vécue dite (temps, argent, erreur, risque, stress…) : la douleur est nommée. */
const DOULEUR_DITE = /\b(perd\w*|pertes?|gach\w*|heures? perdues?|soirs?|soirees?|week-ends?|erreurs?|oubli\w*|retards?|stress\w*|risques?|amendes?|sanctions?|redress\w*|coute\w*|couts?|ressaisi\w*|recopi\w*|relanc\w*|a la main|bloque\w*|fuites?|rate\w*|manque\w*|epuis\w*|penalit\w*|litiges?|impayes?|plaintes?)\b/;

/**
 * C94 (chaque script) : la douleur du spectateur est NOMMÉE dans le texte dit (hors appel et boucle), quelle que soit
 * l'intensité du sujet (C80 ne règle que l'intensité en série). Nommée : un segment marqué « cout », ou deux mots pleins
 * du problème déclaré (un seul s'il n'en a qu'un), ou une conséquence vécue (`DOULEUR_DITE`). ALERTE, jamais bloquant.
 */
export function c94(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a).filter((s) => s.role !== "appel" && s.role !== "boucle");
  if (!parles.length || parles.some((s) => s.marqueurs.includes("cout"))) return;
  const texte = parles.map((s) => s.dit).join(" ");
  const dits = new Set(motsPleins(texte));
  const probleme = [...new Set(motsPleins(e.maitre?.angle?.probleme ?? ""))];
  if (probleme.length && probleme.filter((m) => dits.has(m)).length >= Math.min(2, probleme.length)) return;
  if (DOULEUR_DITE.test(norm(texte))) return;
  col.ajouter("C94", "La douleur du spectateur n'est pas nommée (C80 ne règle que son intensité en série) : dites ce qu'il vit et ce que ça lui coûte.");
}

/** C80 (série) : l'INTENSITÉ seulement, jamais la présence de la douleur (C94). Intensités des sujets précédents, du plus ancien au plus récent, puis celle du nouveau. */
export function c80SerieDouleur(precedentes: ("douleur" | "gain" | "curiosite" | undefined)[], nouvelle: "douleur" | "gain" | "curiosite" | undefined): ViolationControle[] {
  if (nouvelle !== "douleur") return [];
  const deux = precedentes.slice(-2);
  if (deux.length === 2 && deux.every((x) => x === "douleur")) {
    return [{ controle: "C80", message: "Trois sujets « douleur » d'affilée : préférez un angle « ce que vous pourriez gagner ».", bloquant: false, niveau: "alerte" }];
  }
  return [];
}

/* ---------- C81 : récit d'un cas client (addendum §2 ter, ordre de Will du 03/10) ---------- */
const VENU = /(est venue?|sont venu(e)?s|etai(t|ent) venue?s?) (nous|me) (voir|trouver|demander)|nous a (contacte|appele|ecrit|sollicite)|m\x27a (contacte|appele|ecrit)/;
const ACTION = /(\bnous (lui |leur )?(avons|a)|\bon (lui |leur )?a|\bj\x27ai|\bje (lui |leur )?ai) [a-z]/;

/** Les trois temps du récit l'avocat de référence dans un texte : « venu nous voir », « nous avons + action », un résultat. */
export function tempsDuRecit(texte: string, avecResultat: boolean): { venu: boolean; action: boolean; resultat: boolean } {
  const n = norm(texte);
  return { venu: VENU.test(n), action: ACTION.test(n), resultat: avecResultat };
}

export function c81(e: EntreeControle, a: Analyse, col: Collecte): void {
  const m = e.maitre;
  if (!m) return;
  const preuve = m.appuiPrincipal?.preuveId ? e.preuves.find((p) => p.id === m.appuiPrincipal!.preuveId) : undefined;
  const casClient = preuve?.type === "cas-client" || m.ancrages?.some((x) => x.role === "principal" && x.type === "cas-client");
  if (!casClient) return;
  const parles = segmentsParles(a).filter((s) => s.role !== "appel" && s.role !== "boucle");
  const texte = parles.map((s) => s.dit).join(" ");
  const resultat = parles.some((s) => s.marqueurs.includes("resultat") || s.marqueurs.includes("livraison"));
  const t = tempsDuRecit(texte, resultat);
  const manque = [!t.venu && "« est venu nous voir »", !t.action && "« nous avons + un verbe d'action »", !t.resultat && "le résultat"].filter(Boolean);
  if (manque.length) col.ajouter("C81", `Cas client pas raconté comme un récit : il manque ${manque.join(", ")}.`);
}

/* ---------- C82 : le spectateur se reconnaît dans le client (addendum §2 quinquies, ordre de Will du 03/10) ---------- */
export const ROLE_CIBLE = /\b(dirigeante?s?|patron(ne)?s?|gerante?s?|chefs? d\x27entreprise|daf|drh|directeur|directrice|responsables?|comptables?|expert-comptable|commerciale?s?|assistante?s?|artisans?|cabinets?|pme|tpe|eti|startups?|independante?s?|fondateur|fondatrice|associee?s?|equipes?)\b/;
const QUALIFIANT = /\b(\d+ (salarie|personne|collaborateur|employe)s?|pme|tpe|eti|dans l\x27(industrie|immobilier|hotellerie)|du (batiment|transport|commerce|negoce|btp)|de (negoce|transport|logistique|services?|conseil|formation|sante|e-commerce)|d\x27(expertise|architecture|avocats?|assurance)|secteur|industriel(le)?|familiale?)\b/;
const GESTE_QUOTIDIEN = /\b(export(e|er|ait|aient)|copi(e|er|ait|aient)|coll(e|er|ait|aient)|verifi(e|er|ait|aient)|recopi(e|er|ait)|ressaisi(r|ssait)|saisi(r|ssait|t)|relan(cer|cait|ce)|tri(e|er|ait)|imprim(e|er|ait)|remplir|remplissait|compil(e|er|ait)|consolid(e|er|ait)|mettre a jour|mettait a jour|chercher|cherchait|rapproch(e|er|ait)|pointer|pointait|recompt(e|er|ait)|ouvr(e|ir|ait) (chaque|les|ses|des))\b/;

export function c82(e: EntreeControle, a: Analyse, col: Collecte): void {
  const m = e.maitre;
  if (!m) return;
  const casClient = m.ancrages?.some((x) => x.role === "principal" && x.type === "cas-client") || (m.appuiPrincipal?.preuveId ? e.preuves.find((p) => p.id === m.appuiPrincipal!.preuveId)?.type === "cas-client" : false);
  if (!casClient) return;
  const parles = segmentsParles(a).filter((s) => s.role !== "appel" && s.role !== "boucle");
  const debut = norm(parles.filter((s) => s.debutSec <= 5 / a.marge).map((s) => s.dit).join(" "));
  if (!ROLE_CIBLE.test(debut)) col.ajouter("C82", "Le client n'est pas situé dans les 5 premières secondes (métier ou fonction, puis taille ou secteur).");
  else if (!QUALIFIANT.test(debut)) col.ajouter("C82", "Client nommé par sa fonction mais sans taille ni secteur : le spectateur se reconnaît moins (précision à demander, jamais à inventer).", { niveau: "info" });
  if (!GESTE_QUOTIDIEN.test(norm(parles.map((s) => s.dit).join(" ")))) col.ajouter("C82", "Aucun geste du quotidien du client (« exporter, copier, coller, vérifier ») : la routine reste abstraite.");
}

/* ---------- C83 : faux témoignage (ordre de Will du 03/10) ---------- */
const RECIT_CLIENT = /(est venue?|sont venu(e)?s) (nous|me) (voir|trouver)|\bmon client\b|\bma cliente\b|\bmes clients\b|\bun de nos clients\b|\bune de nos clientes\b|\bchez (un|une|l\x27un) (de nos )?client(e)?s?\b|\bnous (lui|leur) avons\b|\bje (lui|leur) ai (obtenu|livre|installe|mis)\b|\bon (lui|leur) a (livre|installe|mis en place|supprime|obtenu)\b/;

/** Un texte raconte-t-il un client à la 1re personne (récit de cas) ? */
export function raconteUnClient(texte: string): boolean {
  return RECIT_CLIENT.test(norm(texte));
}

/**
 * Récit d'un client à la 1re personne (« venu nous voir », « mon client », « nous lui avons… ») SANS preuve `cas-client`
 * validée, avec accord écrit, liée au texte → BLOQUANT (faux témoignage ; Will a interdit les « faux cas »).
 */
export function c83(e: EntreeControle, a: Analyse, col: Collecte): void {
  const parles = segmentsParles(a);
  const recit = parles.filter((s) => raconteUnClient(s.dit));
  if (!recit.length) return;
  const cas = new Set(e.preuves.filter((p) => p.type === "cas-client" && p.statut === "validee" && p.client?.accordEcrit).map((p) => p.id));
  const liees = new Set([...parles.flatMap((s) => s.segment.preuveIds ?? []), ...(e.maitre?.appuiPrincipal?.preuveId ? [e.maitre.appuiPrincipal.preuveId] : [])]);
  if (![...liees].some((id) => cas.has(id))) col.ajouter("C83", `Récit d'un client sans preuve « cas client » réelle avec accord (faux témoignage) : « ${recit[0].dit} ».`, { segmentIndex: recit[0].index });
}
