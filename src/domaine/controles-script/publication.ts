/**
 * Contrôles de la PUBLICATION, de l'APPEL et des ACCROCHES (plan v5 B.7.2). PUR.
 * C13, C14, C34, C35, C36, C41, C47, C48, C64, C69, C70, C72. Les règles d'un réseau arrivent en données
 * (`ParametresReseau`) : aucun nom de réseau n'est écrit ici.
 */
import { empreinte } from "@/domaine/derivations-generateur";
import { compterNombres, nombresAffirmes, trouverNombres } from "@/domaine/nombres-fr";
import type { AccrocheFinaliste, Preuve } from "@/domaine/types";
import { Collecte, segmentsParles, type Analyse } from "./analyse";
import { MOTIF_IMPERATIF_APPEL } from "./style";
import { MOTIF_QUANTIFICATEUR_VAGUE } from "./style";
import type { EntreeControle, ParametresRecette, ViolationControle } from "./types";
import { contientExpression, mots, normaliser, phrasesDe, texteCompare } from "./texte";

/* ---------- C13 : longueurs et mots-dièse ---------- */
export function c13(e: EntreeControle, a: Analyse, col: Collecte): void {
  const p = e.publication;
  if (!p || !e.reseau) return;
  const [min, max] = e.reseau.motsDiese;
  const n = (p.motsDiese ?? []).length;
  if (n < min || n > max) col.ajouter("C13", `${n} mots-dièse (entre ${min} et ${max} attendus).`);
  const cmax = e.reseau.caracteresMaxPremiereLigne;
  if (cmax && (p.premiereLigne ?? "").length > cmax) col.ajouter("C13", `Première ligne de ${(p.premiereLigne ?? "").length} caractères (${cmax} au plus).`);
}

/* ---------- C14 : unicité entre réseaux et entre formats ---------- */
export function c14(e: EntreeControle, a: Analyse, col: Collecte): void {
  const accroche = texteCompare(a.accroche.map((s) => s.dit).join(" "));
  const appel = texteCompare(e.appel?.texte ?? a.appel.map((s) => s.dit).join(" "));
  const ligne = texteCompare(e.publication?.premiereLigne ?? "");
  const unique = e.accrocheUnique ?? true;
  for (const o of e.autresVersions ?? []) {
    const memeReseau = !!e.reseau && o.reseau === e.reseau.id;
    const memeAccroche = !!accroche && texteCompare(o.accrocheDite) === accroche;
    if (memeAccroche && (unique || memeReseau)) col.ajouter("C14", memeReseau ? "Même accroche qu'un autre format du sujet sur ce réseau." : "Même accroche dite qu'une autre version du sujet.");
    if (memeAccroche && appel && texteCompare(o.appelTexte ?? "") === appel) col.ajouter("C14", "Même couple (accroche, appel) qu'une autre version.");
    if (ligne && texteCompare(o.premiereLigne ?? "") === ligne) col.ajouter("C14", "Même première ligne de publication qu'une autre version.");
  }
}

/* ---------- C34 : appel cohérent avec l'objectif et le contenu ---------- */
const MOTIF_RESERVATION_DIRECTE = /calendly|cal\.com|zcal|prendre rendez-vous en ligne|reserve[zs]? (un|votre|ton) (creneau|appel)|\/appel\b/;
export function c34(e: EntreeControle, a: Analyse, col: Collecte): void {
  const appel = e.appel;
  if (!appel) return;
  const attendu = e.objectif ? e.reseau?.appelSelonObjectif?.[e.objectif] : undefined;
  if (attendu && appel.selonObjectif && appel.type !== attendu) col.ajouter("C34", `Appel « ${appel.type} » annoncé selon l'objectif, « ${attendu} » attendu.`);
  if (appel.type === "sauvegarde" && segmentsParles(a).filter((s) => s.marqueurs.includes("methode")).length < 2) col.ajouter("C34", "Appel « garder » sans méthode d'au moins 2 étapes à garder.");
  if (appel.type === "episode-suivant" && !(e.serie?.serieId && (e.serie.episodesProgrammes ?? 0) >= 3 && e.serie.episodeSuivantProgramme)) col.ajouter("C34", "Appel « épisode suivant » sans série d'au moins 3 épisodes programmés, dont le suivant.");
  if (appel.type === "diagnostic") {
    const textes = [appel.texte, e.publication?.texte ?? "", e.publication?.commentaireEpingle ?? "", e.publication?.post?.texte ?? ""].map(normaliser).join(" ");
    const motifs = (e.motifsReservationDirecte ?? []).map(normaliser);
    if (MOTIF_RESERVATION_DIRECTE.test(textes) || motifs.some((m) => m && textes.includes(m))) col.ajouter("C34", "Appel « diagnostic » avec un lien de réservation directe (interdit).");
  }
  if (appel.type === "question-expert" && /^(et )?(qui|quelle personne|lequel de vos|laquelle de vos)(?=$|[^a-z])/.test(normaliser(appel.texte))) col.ajouter("C34", "Question d'expert sur une personne : elle doit porter sur une pratique ou une quantité.");
}

/* ---------- C35 : téléprompteur et trame ---------- */
export function c35(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.mode !== "teleprompteur" && e.mode !== "trame") return;
  if (e.empreinteCorpsAvatar && e.empreinteCorpsAvatar === empreinte(JSON.stringify(e.corps.map((b) => [b.blocRecette, b.segments.map((s) => [s.texte.trim(), s.facultatif ?? ""])])))) col.ajouter("C35", "Corps recopié du texte du double : un corps distinct est regénéré au débit du mode.");
  if (e.mode === "teleprompteur" && e.prompteur) {
    for (const ligne of e.prompteur.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
      if (/^\//.test(ligne) || /\/$/.test(ligne)) col.ajouter("C35", "« / » en début ou en fin de ligne (seulement à l'intérieur).");
      if (ligne.replace(/\*\*/g, "").length > 40 && !/^PRISE|^D[ÉE]BUTS|^FINS/i.test(ligne)) col.ajouter("C35", `Ligne de téléprompteur de ${ligne.replace(/\*\*/g, "").length} caractères (40 au plus).`);
    }
    if (trouverNombres(e.prompteur).some((n) => n.forme === "lettres")) col.ajouter("C35", "Chiffres écrits en lettres dans le téléprompteur.");
    const accroche = a.accroche.map((s) => s.texte).join(" ");
    if (accroche && !contientExpression(e.prompteur.replace(/\*\*|\//g, " "), accroche)) col.ajouter("C35", "Le début du téléprompteur n'est pas copié de la version réseau.");
    if (e.appel?.texte && !contientExpression(e.prompteur.replace(/\*\*|\//g, " "), e.appel.texte)) col.ajouter("C35", "La fin du téléprompteur n'est pas copiée de la version réseau.");
  }
  if (e.mode === "trame") {
    const t = e.trame;
    if (!t) {
      col.ajouter("C35", "Trame absente.");
      return;
    }
    if (t.reperes.length < 3 || t.reperes.length > 5) col.ajouter("C35", `${t.reperes.length} repères (3 à 5).`);
    if (t.reperes.some((r) => mots(r).length > 5)) col.ajouter("C35", "Un repère de plus de 5 mots : des repères, pas des phrases.");
    if (t.chiffres.some((c) => mots(c).length > 5)) col.ajouter("C35", "Un chiffre encadré de plus de 5 mots.");
    if (!t.casesWill.limite?.texte?.trim()) col.ajouter("C35", "Case « VOTRE LIMITE » non préremplie.");
    const ancrage = segmentsParles(a).some((s) => s.marqueurs.includes("ancrage"));
    if (!ancrage && !t.casesWill.avis?.texte?.trim()) col.ajouter("C35", "Case « VOTRE AVIS » vide alors qu'aucun ancrage n'est présent.");
    if (a.boucle.some((s) => s.texte.trim()) || e.boucle) col.ajouter("C35", "Boucle dans une trame (la fin est l'appel).");
    if (!t.verbatim.accroche.trim() || !t.verbatim.appel.trim()) col.ajouter("C35", "Accroche et appel au mot près absents de la trame.");
  }
}

/* ---------- C36 : champs de publication ---------- */
export function c36(e: EntreeControle, a: Analyse, col: Collecte): void {
  const p = e.publication as Record<string, unknown> | undefined;
  if (!p || !e.reseau) return;
  const vide = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
  for (const champ of ["texte", "premiereLigne", ...e.reseau.champsRequis]) if (vide(p[champ])) col.ajouter("C36", `Champ de publication « ${champ} » manquant.`);
}

/* ---------- C41 : accroche selon la recette ---------- */
export function accrochePermise(famille: string, recette: ParametresRecette, disponibles: { types: string[]; preuveChiffree: boolean; accordAvantApres: boolean; scene: boolean }): string | null {
  if (!recette.famillesAccrochePermises.includes(famille)) return `Famille d'accroche « ${famille} » non permise par la recette.`;
  const ex = recette.exigencesAccroche?.[famille];
  if (ex?.matiere && !ex.matiere.some((t) => disponibles.types.includes(t))) return `Accroche « ${famille} » sans la matière qu'elle exige (${ex.matiere.join(", ")}).`;
  if (ex?.preuveChiffree && !disponibles.preuveChiffree) return `Accroche « ${famille} » sans preuve chiffrée.`;
  if (ex?.accordAvantApres && !disponibles.accordAvantApres) return `Accroche « ${famille} » sans accord avant / après.`;
  if (ex?.scene && !disponibles.scene) return `Accroche « ${famille} » sans scène vécue.`;
  return null;
}

function disponiblesDe(e: EntreeControle): { types: string[]; preuveChiffree: boolean; accordAvantApres: boolean; scene: boolean } {
  const ids = new Set((e.maitre?.ancrages ?? []).map((x) => x.matiereId));
  const cites = e.matieres.filter((m) => ids.has(m.id));
  const preuves = e.preuves.filter((p) => p.statut === "validee");
  return {
    types: cites.map((m) => m.type),
    preuveChiffree: preuves.some((p) => p.nature === "chiffree"),
    accordAvantApres: preuves.some((p) => !!p.client?.accordAvantApres),
    scene: cites.some((m) => !!m.scene),
  };
}

export function c41(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.familleAccroche) {
    const r = accrochePermise(e.familleAccroche, e.recette, disponiblesDe(e));
    if (r) col.ajouter("C41", r);
  }
  const texte = a.accroche.map((s) => s.dit).join(" ");
  // Le même nombre redit (« quinze minutes. Oui, quinze minutes. ») est un écho : il compte une fois.
  const n = new Set(nombresAffirmes(texte).map((x) => x.valeur)).size;
  if (n > e.recette.nombresMaxAccroche) col.ajouter("C41", `${n} nombres dans l'accroche (${e.recette.nombresMaxAccroche} au plus).`);
}

/* ---------- C47, C69 : lot d'accroches et finalistes (étape 4, pas de version) ---------- */
/** Marqueurs d'anomalie d'une accroche chiffrée (K2, C69) : sans eux, un chiffre décrit un état normal. */
export const MOTIF_ANOMALIE = /(?:^|[^a-z])(rien que pour|juste pour|seulement pour|pour une tache que|alors que|a la main|encore|pour des|pour tenir|perdu|perdues|gaspille|en trop)(?=$|[^a-z])/;

/** Une accroche du lot : sa famille est un identifiant de la bibliothèque de la recette (`TypeAccroche` étendu). */
export type AccrocheDuLot = Omit<Pick<AccrocheFinaliste, "id" | "dit" | "preuveIds" | "porteAngle">, "famille"> & { famille: string };

export function controlerLotAccroches(lot: { famille: string }[], famillesRealisables: number): ViolationControle[] {
  const distinctes = new Set(lot.map((x) => x.famille)).size;
  const attendu = Math.min(6, famillesRealisables);
  return distinctes < attendu ? [{ controle: "C47", message: `${distinctes} familles d'accroche dans le lot (${attendu} attendues).`, bloquant: true, niveau: "bloquant" }] : [];
}

export function controlerFinalistes(
  finalistes: AccrocheDuLot[],
  ctx: { preuves: Preuve[]; recette: ParametresRecette; disponibles: { types: string[]; preuveChiffree: boolean; accordAvantApres: boolean; scene: boolean } },
): { exclues: { id: string; raisons: string[] }[]; violations: ViolationControle[] } {
  const exclues: { id: string; raisons: string[] }[] = [];
  for (const f of finalistes) {
    const raisons: string[] = [];
    const valeurs = ctx.preuves.filter((p) => f.preuveIds.includes(p.id) && p.statut === "validee").flatMap((p) => p.valeurs.map((v) => v.normalise));
    for (const n of nombresAffirmes(f.dit)) if (!valeurs.some((v) => Math.abs(v - n.valeur) < 1e-9)) raisons.push(`C1 : « ${n.brut} » sans preuve`);
    const r = accrochePermise(f.famille, ctx.recette, ctx.disponibles);
    if (r) raisons.push(`C41 : ${r}`);
    if (compterNombres(f.dit) > ctx.recette.nombresMaxAccroche) raisons.push("C41 : trop de nombres");
    if (MOTIF_QUANTIFICATEUR_VAGUE.test(normaliser(f.dit)) && !f.preuveIds.length) raisons.push("C16 : quantificateur vague sans preuve");
    if (f.famille === "chiffre-choc" && !MOTIF_ANOMALIE.test(normaliser(f.dit))) raisons.push("C69 : chiffre sans marqueur d'anomalie");
    if (raisons.length) exclues.push({ id: f.id, raisons });
  }
  const violations: ViolationControle[] = exclues.map((x) => ({ controle: "C69", message: `Accroche ${x.id} exclue avant le juge : ${x.raisons.join(" ; ")}.`, bloquant: true, niveau: "bloquant" }));
  const gardees = finalistes.filter((f) => !exclues.some((x) => x.id === f.id));
  if (gardees.length && !gardees.some((f) => f.porteAngle)) violations.push({ controle: "C69", message: "Aucune finaliste ne porte l'angle retenu.", bloquant: true, niveau: "bloquant" });
  return { exclues, violations };
}

/* ---------- C70 : accroche de réseau prise parmi les finalistes ---------- */
export function c70(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (!e.finalistes?.length) return;
  const dite = texteCompare(a.accroche.map((s) => s.dit).join(" "));
  const prise = e.finalistes.find((f) => f.id === e.accrocheId) ?? e.finalistes.find((f) => texteCompare(f.dit) === dite);
  if (!prise) col.ajouter("C70", "L'accroche de cette version n'est pas une des finalistes.");
}

/* ---------- C48 : qui parle conseillé ---------- */
export function c48(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.mode === "avatar" && e.reseau?.doubleDeconseille) col.ajouter("C48", "Proposition : « vous en personne » sur ce réseau.");
  if (e.mode === "avatar" && e.maitre?.brief?.sujetSensible) col.ajouter("C48", "Sujet sensible : « Je lis » présélectionné.");
}

/* ---------- C64 : destinataire de l'envoi ---------- */
const MOTIF_ENVOI = /(?:^|[^a-z])(envoie[zs]?|envoyez|transmet(s|tez)|a envoyer|a transmettre|partage[zs]?)(?=$|[^a-z]|-)/;
export function c64(e: EntreeControle, a: Analyse, col: Collecte): void {
  const ctx = e.contexte;
  const textesEnvoi = [...(e.appel?.type === "envoi" ? [e.appel.texte] : []), ...segmentsParles(a).filter((s) => s.marqueurs.includes("envoi")).map((s) => s.dit), ...(e.maitre?.envoi ? [e.maitre.envoi.phrase] : [])].filter(Boolean);
  if (!textesEnvoi.length) return;
  for (const t of textesEnvoi) {
    for (const m of ctx?.misEnCause ?? []) if (contientExpression(t, m)) col.ajouter("C64", `L'envoi vise la personne que la vidéo met en cause (« ${m} »).`);
    const roles = ctx?.rolesDestinataires ?? [];
    if (roles.length && MOTIF_ENVOI.test(normaliser(t)) && !roles.some((r) => contientExpression(t, r))) col.ajouter("C64", "Destinataire de l'envoi hors de la liste des rôles.");
  }
  const role = e.maitre?.envoi?.destinataireRole;
  if (role && ctx?.rolesDestinataires?.length && !ctx.rolesDestinataires.some((r) => texteCompare(r) === texteCompare(role))) col.ajouter("C64", `Rôle destinataire « ${role} » hors de la liste.`);
}

/* ---------- C72 : un seul appel par publication ---------- */
function typeAppelDuTexte(t: string): "envoi" | "question" | "sauvegarde" | "autre" | null {
  const n = normaliser(t);
  if (MOTIF_ENVOI.test(n)) return "envoi";
  if (/(?:^|[^a-z])(garde[zs]?|enregistre[zs]?|sauvegarde[zs]?)(?=$|[^a-z])/.test(n)) return "sauvegarde";
  if (t.trim().endsWith("?")) return "question";
  if (MOTIF_IMPERATIF_APPEL.test(n)) return "autre";
  return null;
}
export function c72(e: EntreeControle, a: Analyse, col: Collecte): void {
  const appel = e.appel;
  const p = e.publication;
  if (!p) return;
  const attendu = appel ? (appel.type === "question-expert" ? "question" : appel.type === "envoi" ? "envoi" : appel.type === "sauvegarde" ? "sauvegarde" : "autre") : null;
  const verifier = (texte: string | undefined, couche: string) => {
    if (!texte?.trim()) return;
    const derniere = phrasesDe(texte).at(-1) ?? "";
    const t = typeAppelDuTexte(couche === "commentaire épinglé" ? texte : derniere);
    if (t && t !== attendu) col.ajouter("C72", `Second appel dans ${couche}.`);
  };
  verifier(p.commentaireEpingle, "commentaire épinglé");
  verifier(p.texte, "la fin de la légende");
  verifier(p.post?.texte, "la fin du post");
}
