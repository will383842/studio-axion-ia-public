/**
 * Contrôles de FIDÉLITÉ aux preuves et aux matières (plan v5 B.7.2). PUR.
 * C1, C1 bis, C1 ter, C2, C10 bis, C15, C16 bis, C17, C17 bis, C18, C19, C31, C32, C50, C51, C54, C55, C57, C58, C59,
 * C60, C65, C68, C75, C76. Rien n'est jamais déduit : un nombre, un absolu ou une citation doivent se retrouver dans
 * une preuve validée ou dans le texte d'une matière citée.
 */
import { detailConcret } from "@/domaine/derivations-generateur";
import { memeValeur, nombresAffirmes } from "@/domaine/nombres-fr";
import type { Matiere, Preuve } from "@/domaine/types";
import { Collecte, segmentsParles, type Analyse, type SegmentLu } from "./analyse";
import { couchesAffichees } from "./style";
import { termesDivergents } from "./termes";
import type { EntreeControle } from "./types";
import { contientExpression, echapper, mots, motsPleins, normaliser, racine, sansCitations, texteCompare } from "./texte";

/* ---------- utilitaires ---------- */

/** Une preuve ou une matière est-elle utilisable aujourd'hui (validée, ni retirée, ni archivée, ni périmée) ? */
export function utilisable(x: Pick<Preuve | Matiere, "statut" | "retrait" | "archiveLe" | "perimeLe">, maintenant: string): boolean {
  return x.statut === "validee" && !x.retrait && !x.archiveLe && !(x.perimeLe && x.perimeLe <= maintenant);
}

function preuvesDe(a: Analyse, s: SegmentLu): Preuve[] {
  return (s.segment.preuveIds ?? []).map((id) => a.preuves.get(id)).filter((p): p is Preuve => !!p);
}
function matieresDe(a: Analyse, s: SegmentLu): Matiere[] {
  const ids = new Set([...(s.segment.matiereIds ?? []), ...(s.segment.sourceTexte ? [s.segment.sourceTexte.matiereId] : [])]);
  return [...ids].map((id) => a.matieres.get(id)).filter((m): m is Matiere => !!m);
}

/** La matière est-elle citée fidèlement (mot pour mot, ponctuation et casse mises à part) ? */
export function citeeMotPourMot(texteSegment: string, matiere: Pick<Matiere, "texte">): boolean {
  const s = texteCompare(texteSegment);
  const m = texteCompare(matiere.texte);
  if (!m) return false;
  if (` ${s} `.includes(` ${m} `)) return true;
  // Un segment peut citer un MORCEAU de la matière (≥ 6 mots), jamais la déformer.
  return mots(s).length >= 6 && ` ${m} `.includes(` ${s} `);
}

/** Un nombre est-il justifié par une preuve du segment ou par le texte d'une matière citée ? */
function nombreJustifie(valeur: number, brut: string, preuves: Preuve[], matieres: Matiere[], maintenant: string): boolean {
  for (const p of preuves) {
    if (!utilisable(p, maintenant)) continue;
    if (p.valeurs.some((v) => memeValeur(v.normalise, valeur) || texteCompare(v.brut) === texteCompare(brut))) return true;
    if (nombresAffirmes(p.enonce).some((n) => memeValeur(n.valeur, valeur))) return true;
  }
  for (const m of matieres) {
    if (!utilisable(m, maintenant)) continue;
    if (nombresAffirmes(m.texte).some((n) => memeValeur(n.valeur, valeur))) return true;
  }
  return false;
}

/* ---------- C1 : chaque nombre a sa preuve ---------- */
export function c1(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.compteInterne) return;
  for (const s of segmentsParles(a)) {
    const preuves = preuvesDe(a, s);
    const matieres = matieresDe(a, s);
    for (const n of nombresAffirmes(s.dit)) {
      if (!nombreJustifie(n.valeur, n.brut, preuves, matieres, e.maintenant)) {
        col.ajouter("C1", `Nombre sans preuve : « ${n.brut} »${e.auteur === "will" ? " (ajouter comme preuve ?)" : ""}.`, { segmentIndex: s.index });
      }
    }
    const inc = s.segment.incrustation?.texte;
    if (inc) for (const n of nombresAffirmes(inc)) if (!nombreJustifie(n.valeur, n.brut, preuves, matieres, e.maintenant)) col.ajouter("C1", `Nombre affiché sans preuve : « ${n.brut} ».`, { segmentIndex: s.index });
  }
}

/* ---------- C1 bis : fidélité sémantique ---------- */
const MOTIF_ABSOLU = /(?:^|[^a-z])(tous|toutes|tout le monde|jamais|toujours|aucun|aucune|personne ne|chaque|100 ?%|cent pour cent|entierement|totalement)(?=$|[^a-z])/g;

export function c1bis(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of segmentsParles(a)) {
    const n = normaliser(sansCitations(s.dit));
    const preuves = preuvesDe(a, s);
    const matieres = matieresDe(a, s);
    for (const p of preuves) {
      for (const f of p.formulationsInterdites) if (f && n.includes(normaliser(f))) col.ajouter("C1 bis", `Formulation interdite pour cette preuve : « ${f} ».`, { segmentIndex: s.index });
      if (p.nature === "vague" && !p.formulationsAutorisees.some((f) => n.includes(normaliser(f)))) col.ajouter("C1 bis", "Preuve vague dite hors de ses formulations autorisées.", { segmentIndex: s.index });
    }
    const sources = [...preuves.flatMap((p) => [p.enonce, ...p.formulationsAutorisees]), ...matieres.map((m) => m.texte)].map(normaliser).join(" ");
    for (const m of n.matchAll(MOTIF_ABSOLU)) {
      const mot = m[1];
      if (/^(jamais)$/.test(mot) && /il ne faut jamais|ne .* jamais (signer|payer|accepter)/.test(n)) continue; // mise en garde, pas une affirmation
      if (!sources.includes(mot.replace(/\s+/g, " "))) col.ajouter("C1 bis", `Absolu « ${mot} » absent de la preuve ou de la matière citée.`, { segmentIndex: s.index });
    }
    if (s.segment.sourceTexte) {
      const mat = a.matieres.get(s.segment.sourceTexte.matiereId);
      if (mat && !citeeMotPourMot(s.dit, mat)) col.ajouter("C1 bis", "Matière citée élargie ou enjolivée (pas mot pour mot).", { segmentIndex: s.index });
    }
  }
}

/* ---------- C1 ter : la réécriture n'ajoute ni chiffre, ni lien, ni nom ---------- */
const MOTIF_LIEN = /https?:\/\/\S+|www\.\S+/gi;
function nomsPropres(t: string): string[] {
  const r: string[] = [];
  for (const p of t.split(/(?<=[.!?…])\s+/)) {
    const ms = p.split(/\s+/).slice(1);
    for (const m of ms) if (/^[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(m)) r.push(m.replace(/[^\p{L}-]/gu, ""));
  }
  return r;
}
export function c1ter(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.textePrecedent === undefined) return;
  const nouveau = segmentsParles(a).map((s) => s.dit).join(" ");
  const avant = e.textePrecedent;
  const registre = [avant, ...e.preuves.flatMap((p) => [p.enonce, ...p.valeurs.map((v) => v.brut), ...p.formulationsAutorisees]), ...e.matieres.map((m) => m.texte)].join(" ");
  const valeursConnues = nombresAffirmes(registre).map((n) => n.valeur);
  for (const n of nombresAffirmes(nouveau)) if (!valeursConnues.some((v) => memeValeur(v, n.valeur))) col.ajouter("C1 ter", `La réécriture ajoute un chiffre : « ${n.brut} ».`);
  for (const l of nouveau.match(MOTIF_LIEN) ?? []) if (!registre.includes(l)) col.ajouter("C1 ter", `La réécriture ajoute un lien : ${l}.`);
  const nomsConnus = new Set(nomsPropres(registre).map((x) => x.toLowerCase()));
  for (const nom of nomsPropres(nouveau)) if (!nomsConnus.has(nom.toLowerCase()) && !texteCompare(registre).includes(texteCompare(nom))) col.ajouter("C1 ter", `La réécriture ajoute un nom : « ${nom} ».`);
}

/* ---------- C2 : cas client, accords, témoignage ---------- */
const MOTIF_CLIENT = /(?:^|[^a-z])(chez (un|une|ce|cette|mon|notre) client(e)?|un client|une cliente|nos clients|mon client|ma cliente|un de nos clients)(?=$|[^a-z])/;
export function c2(e: EntreeControle, a: Analyse, col: Collecte): void {
  const toutesPreuves = segmentsParles(a).flatMap((s) => preuvesDe(a, s));
  const casClient = toutesPreuves.filter((p) => p.type === "cas-client");
  const matiereCas = (e.maitre?.ancrages ?? []).some((x) => x.type === "cas-client");
  for (const s of segmentsParles(a)) {
    if (MOTIF_CLIENT.test(normaliser(s.dit)) && !casClient.length && !matiereCas) col.ajouter("C2", "Un client est évoqué sans preuve « cas client ».", { segmentIndex: s.index });
    if (s.segment.intervenant?.role === "client") {
      if (e.mode === "avatar" || s.segment.intervenant.joue) col.ajouter("C2", "Témoignage dit par le double ou un acteur.", { segmentIndex: s.index });
      if (!preuvesDe(a, s).some((p) => p.type === "cas-client" && p.client?.accordEcrit)) col.ajouter("C2", "Parole de client sans preuve « cas client » avec accord.", { segmentIndex: s.index });
    }
    if (s.segment.ecran?.type === "capture" && !preuvesDe(a, s).some((p) => p.client?.accordCapture) && !casClient.some((p) => p.client?.accordCapture)) col.ajouter("C2", "Capture réelle sans accord de capture : l'élément est retiré.", { segmentIndex: s.index });
    if (s.segment.incrustation?.texte && /→|->/.test(s.segment.incrustation.texte) && !preuvesDe(a, s).some((p) => p.client?.accordAvantApres)) col.ajouter("C2", "Avant / après affiché sans accord : l'élément est retiré.", { segmentIndex: s.index });
  }
  for (const p of casClient) if (p.client && !p.client.anonymise && !p.client.accordEcrit) col.ajouter("C2", "Cas client ni anonymisé ni accordé par écrit.");
}

/* ---------- C10 bis, C75 : mot-clé et mots-dièse compatibles avec les preuves ---------- */
function incompatibles(a: Analyse): string[] {
  const ids = new Set(segmentsParles(a).flatMap((s) => s.segment.preuveIds ?? []));
  return [...ids].flatMap((id) => a.preuves.get(id)?.motsClesIncompatibles ?? []);
}
export function c10bisC75(e: EntreeControle, a: Analyse, col: Collecte): void {
  const inc = incompatibles(a);
  if (e.motCle && inc.some((x) => texteCompare(x) === texteCompare(e.motCle!))) col.ajouter("C10 bis", `Mot-clé « ${e.motCle} » incompatible avec une preuve citée.`);
  const compact = (t: string) => texteCompare(t.replace(/^#/, "")).replace(/[\s'-]/g, "");
  for (const tag of e.publication?.motsDiese ?? []) if (inc.some((x) => compact(x) === compact(tag))) col.ajouter("C75", `Mot-dièse ${tag} incompatible avec une preuve citée.`);
}

/* ---------- C15 : chiffre d'éditeur d'outil à l'écran ---------- */
export function c15(e: EntreeControle, a: Analyse, col: Collecte): void {
  const editeurs = e.preuves.filter((p) => p.source.editeurOutil);
  if (!editeurs.length) return;
  const affiches = couchesAffichees(e).filter((c) => ["encadré", "second encadré", "incrustation", "couverture"].includes(c.couche));
  for (const c of affiches) {
    for (const n of nombresAffirmes(c.texte)) if (editeurs.some((p) => p.valeurs.some((v) => memeValeur(v.normalise, n.valeur)))) col.ajouter("C15", `Chiffre d'éditeur d'outil affiché dans ${c.couche} (« ${n.brut} »).`);
  }
}

/* ---------- C16 bis : preuve qualitative ni sur la livraison ni en dernière phrase ---------- */
export function c16bis(e: EntreeControle, a: Analyse, col: Collecte): void {
  const corps = segmentsParles(a).filter((s) => s.role === "corps");
  const derniere = corps.at(-1);
  for (const s of segmentsParles(a)) {
    const qualitative = preuvesDe(a, s).some((p) => p.nature === "qualitative");
    if (qualitative && (s.marqueurs.includes("livraison") || s === derniere)) col.ajouter("C16 bis", "Preuve qualitative sur la livraison ou la dernière phrase.", { segmentIndex: s.index });
  }
}

/* ---------- C17, C17 bis : illustrations ---------- */
const MOTIF_ILLUSTRATION_INTERDITE = /(?:^|[^a-z])(silhouettes?|personnes?|mains?|visages?|logos?|icones?|uniformes?|notifications? (de |d'|sur )?[a-z]+)(?=$|[^a-z])/;
const MOTIF_ILLUSTRATION_QUANTITATIVE = /(?:^|[^a-z])(jauges?|graphiques?|courbes?|camemberts?|histogrammes?|barres? de progression|compteurs?|pourcentages?|a moitie|moitie remplie|chiffres?)(?=$|[^a-z])/;
export function c17(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of a.segments) {
    const intention = s.segment.intentionIllustration;
    if (!intention) continue;
    const n = normaliser(intention);
    const m = MOTIF_ILLUSTRATION_INTERDITE.exec(n);
    if (m) col.ajouter("C17", `Illustration interdite (« ${m[1]} »).`, { segmentIndex: s.index });
    if (s.role === "appel" || s.role === "boucle" || (s.role === "accroche" && !e.ouvertureSurIllustration)) col.ajouter("C17", "Illustration sur l'accroche, l'appel ou la boucle.", { segmentIndex: s.index });
    const ancre = (s.segment.annotations as { motAncre?: string } | undefined)?.motAncre;
    if (ancre && !contientExpression(s.texte, ancre)) col.ajouter("C17", `Mot d'ancrage « ${ancre} » absent du segment.`, { segmentIndex: s.index });
    if (MOTIF_ILLUSTRATION_QUANTITATIVE.test(n) && !preuvesDe(a, s).some((p) => p.nature === "chiffree")) col.ajouter("C17 bis", "Illustration quantitative sans preuve chiffrée.", { segmentIndex: s.index });
  }
}

/* ---------- C18, C19 : incrustations et encadré ---------- */
export function c18c19(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of a.segments) {
    const inc = s.segment.incrustation;
    if (!inc) continue;
    if (s.debutSec < 3) col.ajouter("C19", "Incrustation entre 0 et 3 s : l'encadré est le seul texte permis.", { segmentIndex: s.index });
    if (inc.type !== "montant") continue;
    const nombres = nombresAffirmes(inc.texte ?? "");
    const ditsDansSegment = nombresAffirmes(s.dit).map((n) => n.valeur);
    const valeursPreuves = preuvesDe(a, s).flatMap((p) => p.valeurs.map((v) => v.normalise));
    // Égal à une valeur de preuve du segment ; affiché sans être dit seulement s'il appartient à cette preuve.
    for (const n of nombres) {
      const prouve = valeursPreuves.some((v) => memeValeur(v, n.valeur));
      if (!prouve) col.ajouter("C18", `Montant incrusté « ${n.brut} » ${ditsDansSegment.some((v) => memeValeur(v, n.valeur)) ? "dit mais " : ""}sans valeur de preuve du segment.`, { segmentIndex: s.index });
    }
    if (!inc.sens) col.ajouter("C18", "Montant incrusté sans sens (gain ou perte).", { segmentIndex: s.index });
    if (s.debutSec < 3) col.ajouter("C18", "Montant incrusté entre 0 et 3 s.", { segmentIndex: s.index });
    if (e.encadre && texteCompare(e.encadre.texte) === texteCompare(inc.texte ?? "")) col.ajouter("C19", "Encadré identique à une incrustation.", { segmentIndex: s.index });
  }
  if (e.encadre) {
    const t = e.encadre.texte;
    if (mots(t).length > 5) col.ajouter("C19", `Encadré de ${mots(t).length} mots (5 au plus).`);
    if (e.motCle && !contientExpression(t, e.motCle)) col.ajouter("C19", "Mot-clé absent de l'encadré.");
    const motCle = new Set(motsPleins(e.motCle ?? "").map(racine));
    const accroche = new Set(a.accroche.flatMap((s) => motsPleins(s.dit)).map(racine));
    const partages = motsPleins(t).map(racine).filter((r) => !motCle.has(r) && accroche.has(r));
    if (new Set(partages).size > 1) col.ajouter("C19", "L'encadré recopie la parole (plus d'un mot plein partagé avec l'accroche).");
  }
  if (e.encadre2 && e.encadre2.aPartirDeSec < 3) col.ajouter("C19", "Second encadré avant 3 s.");
}

/* ---------- C31 : ancrage réel ---------- */
const MOTIF_PASSE_JE = /(?:^|[^a-z])(j'ai (vu|eu|fait|rencontre|accompagne|aide|recu|perdu|appris|travaille)|je suis (alle|allee|passe|passee|arrive|arrivee)|j'etais|m'a (montre|dit|appele|ecrit|raconte|confie)|nous avons (vu|eu|fait|rencontre))(?=$|[^a-z])/;
const FAMILLES_VECU = ["scene-vecue", "aveu-de-cout"];
export function c31(e: EntreeControle, a: Analyse, col: Collecte): void {
  const ancrages = e.maitre?.ancrages ?? [];
  if (e.auteur === "machine" && !ancrages.length) {
    col.ajouter("C31", "Aucune matière vraie (ANCRAGE_MANQUANT).");
    return;
  }
  const ids = new Set(ancrages.map((x) => x.matiereId));
  const segAncrage = segmentsParles(a).filter((s) => s.marqueurs.includes("ancrage"));
  const fideles = segAncrage.filter((s) =>
    matieresDe(a, s)
      .filter((m) => ids.has(m.id))
      .some((m) => {
        if (m.type === "cas-client" || m.type === "etude") {
          const p = m.preuveId ? a.preuves.get(m.preuveId) : undefined;
          return !!p && [p.enonce, ...p.formulationsAutorisees].some((f) => contientExpression(s.dit, f) || citeeMotPourMot(s.dit, { texte: f }));
        }
        return citeeMotPourMot(s.dit, m);
      }),
  );
  if (e.auteur === "machine" && ancrages.length && !fideles.length) col.ajouter("C31", "Aucun segment ne cite fidèlement la matière choisie.");
  // (c) ancrage faible sans second ancrage ni preuve concrète.
  const principal = ancrages.find((x) => x.role === "principal") ?? ancrages[0];
  const mp = principal ? a.matieres.get(principal.matiereId) : undefined;
  if (mp && ["observation", "idee-recue"].includes(mp.type) && !detailConcret(mp.texte)) {
    const second = ancrages.length > 1;
    const preuveConcrete = segmentsParles(a).some((s) => preuvesDe(a, s).some((p) => p.nature === "chiffree"));
    if (!second && !preuveConcrete) col.ajouter("C31", "Ancrage faible (sans détail concret) : un second ancrage ou une preuve concrète est demandé.", { niveau: e.auteur === "machine" ? "alerte" : "info" });
  }
  // (d) dit avant 10 s ou porteur de la livraison.
  const seuil = 10 * a.marge;
  const premier = fideles[0] ?? segAncrage[0];
  if (premier && premier.debutSec >= seuil && !premier.marqueurs.includes("livraison")) col.ajouter("C31", `Ancrage dit à ${premier.debutSec.toFixed(1)} s (avant 10 s ou porteur de la livraison).`, { segmentIndex: premier.index, niveau: e.auteur === "machine" ? "alerte" : "info" });
  // (e) vécu à la 1re personne : exige une anecdote de Will.
  const anecdotes = e.matieres.filter((m) => m.type === "anecdote-will" && utilisable(m, e.maintenant));
  for (const s of segmentsParles(a)) {
    if (s.segment.sourceTexte) continue;
    const n = normaliser(sansCitations(s.dit));
    if (!MOTIF_PASSE_JE.test(n)) continue;
    if (/on m'a demande/.test(n) && matieresDe(a, s).some((m) => m.type === "question-recue")) continue;
    const citees = matieresDe(a, s).filter((m) => m.type === "anecdote-will");
    if (!citees.length) col.ajouter("C31", "Vécu à la 1re personne sans anecdote de Will.", { segmentIndex: s.index });
  }
  if (e.familleAccroche && FAMILLES_VECU.includes(e.familleAccroche) && !anecdotes.some((m) => m.scene && ids.has(m.id))) col.ajouter("C31", `Accroche « ${e.familleAccroche} » sans anecdote de Will avec sa scène.`);
}

/* ---------- C32 : qui parle ---------- */
const MOTIF_OPINION_JE = /(?:^|[^a-z])(ma conviction|je pense|je crois|a mon avis|selon moi|mon verdict|ma reponse|je recommande|je conseille|je deconseille|pour moi,)(?=$|[^a-z])/;
export function c32(e: EntreeControle, a: Analyse, col: Collecte): void {
  if (e.mode !== "avatar") return;
  for (const s of segmentsParles(a)) {
    const n = normaliser(sansCitations(s.dit));
    if (MOTIF_OPINION_JE.test(n)) {
      const src = s.segment.sourceTexte ? a.matieres.get(s.segment.sourceTexte.matiereId) : undefined;
      const ok = !!src && ["anecdote-will", "avis-will", "limite"].includes(src.type) && citeeMotPourMot(s.dit, src);
      if (!ok) col.ajouter("C32", "Opinion à la 1re personne dite par le double sans matière de Will mot pour mot.", { segmentIndex: s.index });
    }
    if (s.segment.nature === "emotion") col.ajouter("C32", "Ressenti dit par le double.", { segmentIndex: s.index, niveau: "alerte" });
  }
  const appui = e.maitre?.appuiPrincipal?.matiereId ? a.matieres.get(e.maitre.appuiPrincipal.matiereId) : undefined;
  if (appui?.type === "avis-will" && e.quiParle !== "will") col.ajouter("C32", "Un avis de Will porte la vidéo : Will doit parler (« Je lis » ou « J'improvise »).");
}

/* ---------- C50, C51, C65 : point de vue et ressenti ---------- */
const MARQUEURS_POINT_DE_VUE: Record<string, RegExp> = {
  je: /(?:^|[^a-z])(je|j'|mon|ma|mes|moi)(?=$|[^a-z])/,
  "nous-clients": /(?:^|[^a-z])(chez (un|une|ce|cette|nos?|mon) client(e)?|nos clients|un client|une cliente|un de nos clients)(?=$|[^a-z])/,
  "un-dirigeant": /(?:^|[^a-z])(un dirigeant|une dirigeante|un chef d'entreprise|une cheffe d'entreprise|m'a dit|nous a dit)(?=$|[^a-z])/,
  vous: /(?:^|[^a-z])(vous|votre|vos|tu|ton|ta|tes|t')(?=$|[^a-z])/,
};
const MOTIF_CITATION_ANNONCEE = /«|"|m'a dit|nous a dit|:\s*$/;
export function c50c51c65(e: EntreeControle, a: Analyse, col: Collecte): void {
  const pdv = e.maitre?.pointDeVue;
  const citees = segmentsParles(a).flatMap((s) => matieresDe(a, s));
  if (pdv) {
    if (!e.recette.pointsDeVuePermis.includes(pdv)) col.ajouter("C50", `Point de vue « ${pdv} » non permis par la recette.`);
    if (pdv === "je" && !citees.some((m) => ["anecdote-will", "avis-will", "limite"].includes(m.type))) col.ajouter("C50", "Point de vue « je » sans matière de Will citée.");
    if (pdv === "un-dirigeant") {
      const parole = citees.filter((m) => m.type === "parole-dirigeant");
      if (!parole.length || parole.some((m) => !m.accord?.obtenu)) col.ajouter("C50", "Point de vue « un dirigeant » sans parole de dirigeant accordée.");
      if (!segmentsParles(a).some((s) => MOTIF_CITATION_ANNONCEE.test(s.dit))) col.ajouter("C50", "Parole de dirigeant non annoncée comme citation.");
    }
    if (pdv === "nous-clients" && !citees.some((m) => ["cas-client", "observation"].includes(m.type)) && !segmentsParles(a).some((s) => preuvesDe(a, s).some((p) => p.type === "cas-client"))) col.ajouter("C50", "Point de vue « nous-clients » sans cas client ni observation.");
    const texte = normaliser(segmentsParles(a).map((s) => s.dit).join(" "));
    if (MARQUEURS_POINT_DE_VUE[pdv] && !MARQUEURS_POINT_DE_VUE[pdv].test(texte)) col.ajouter("C65", `Aucune marque du point de vue « ${pdv} » dans le texte : déclaration corrigée.`);
  }
  const emo = e.maitre?.emotion;
  if (emo && emo !== "neutre") {
    if (!e.recette.emotionsPermises.includes(emo)) col.ajouter("C51", `Ressenti « ${emo} » non permis par la recette.`);
    if (emo === "agacement" && !citees.some((m) => m.type === "avis-will")) col.ajouter("C51", "Agacement sans avis de Will qui le signe.");
    if (emo === "inquietude-maitrisee") {
      const i = segmentsParles(a).findIndex((s) => s.segment.nature === "emotion" || s.marqueurs.includes("emotion"));
      const solutionApres = segmentsParles(a).some((s, k) => k > Math.max(0, i) && s.marqueurs.includes("solution"));
      if (!solutionApres) col.ajouter("C51", "Inquiétude non suivie d'une solution.");
    }
    const segEmo = segmentsParles(a).filter((s) => s.segment.nature === "emotion" || s.marqueurs.includes("emotion"));
    if (!segEmo.length || segEmo.every((s) => !(s.segment.matiereIds ?? []).length && !(s.segment.preuveIds ?? []).length)) col.ajouter("C65", "Ressenti sans phrase reliée à une matière ou une preuve : déclaré « neutre ».");
  }
}

/* ---------- C54, C55, C57, C58, C59, C60 ---------- */
const MOTIF_INSTRUCTION = /(?:^|[^a-z])(ignore[sz]?|oublie[sz]? (les|tes|vos) (regles|consignes|instructions)|tu es (un|une|desormais|maintenant)|consignes?|instructions?|system|prompt|assistant :|ecris (un|une|le))(?=$|[^a-z])/;
export function texteSuspect(texte: string, domainesConnus: string[] = []): boolean {
  const n = normaliser(texte);
  if (MOTIF_INSTRUCTION.test(n)) return true;
  for (const url of texte.match(MOTIF_LIEN) ?? []) if (!domainesConnus.some((d) => url.includes(d))) return true;
  return false;
}

export function c54aC60(e: EntreeControle, a: Analyse, col: Collecte): void {
  for (const s of segmentsParles(a)) {
    const role = s.segment.intervenant?.role;
    if ((role === "client" || role === "invite") && !s.segment.intervenant?.joue) {
      const ok = s.dit.trim().endsWith("?") || matieresDe(a, s).some((m) => (!m.accord?.requis || m.accord.obtenu) && citeeMotPourMot(s.dit, m));
      if (!ok) col.ajouter("C54", "Réplique d'un intervenant réel ni citée mot pour mot ni posée en question.", { segmentIndex: s.index });
    }
    for (const m of matieresDe(a, s)) {
      if (["cas-client", "parole-dirigeant"].includes(m.type) && !m.accord?.obtenu) col.ajouter("C55", `Matière « ${m.type} » citée sans accord obtenu.`, { segmentIndex: s.index });
      if (!utilisable(m, e.maintenant)) col.ajouter("C57", "Matière retirée, périmée ou non validée citée.", { segmentIndex: s.index });
      if (texteSuspect(m.texte)) col.ajouter("C58", "Matière au texte suspect (instruction ou lien inconnu) : à confirmer, jamais envoyée.", { segmentIndex: s.index });
    }
    for (const p of preuvesDe(a, s)) if (!utilisable(p, e.maintenant)) col.ajouter("C57", "Preuve retirée, périmée ou non validée citée.", { segmentIndex: s.index });
  }
  // C59 : aucun nom sensible dans le texte dit ni dans les couches publiques.
  const sensibles = [...e.matieres.flatMap((m) => m.nomsSensibles ?? []), ...e.preuves.flatMap((p) => p.client?.nomsSensibles ?? [])].filter(Boolean);
  if (sensibles.length) {
    const textes = [...segmentsParles(a).map((s) => s.dit), ...couchesAffichees(e).map((c) => c.texte)];
    for (const nom of new Set(sensibles)) if (textes.some((t) => new RegExp(`(?<![\\p{L}])${echapper(nom)}(?![\\p{L}])`, "iu").test(t))) col.ajouter("C59", `Nom sensible « ${nom} » dans un texte public.`);
  }
  // C60 : démonstration.
  for (const x of e.maitre?.ancrages ?? []) {
    if (x.type !== "demonstration") continue;
    const m = a.matieres.get(x.matiereId);
    const prise = /a filmer/.test(normaliser(`${e.prompteur ?? ""} ${(e.trame?.reperes ?? []).join(" ")}`));
    const fichier = !!m?.fichierId || a.segments.some((s) => !!s.segment.ecran?.fichierId);
    if (!fichier && !prise) col.ajouter("C60", "Démonstration sans fichier ni prise « à filmer ».");
  }
}

/* ---------- C68 : termes concordants ---------- */
/** L'idée reçue et sa réfutation parlent-elles du même terme pivot ? (comparé par le code, jamais d'équivalence silencieuse) */
export function termesConcordants(ideeRecue: string, refutation: string, pivot?: string): boolean {
  if (pivot) return contientExpression(ideeRecue, pivot) && contientExpression(refutation, pivot);
  const a = new Set(motsPleins(ideeRecue).map(racine));
  return motsPleins(refutation).some((m) => a.has(racine(m)));
}
export function c68(e: EntreeControle, a: Analyse, col: Collecte): void {
  const idee = e.matieres.find((m) => m.type === "idee-recue" && (e.maitre?.ancrages ?? []).some((x) => x.matiereId === m.id));
  if (!idee) return;
  const pivot = e.maitre?.angle?.termePivot;
  const appui = e.maitre?.appuiPrincipal;
  const refutation = appui?.matiereId ? a.matieres.get(appui.matiereId)?.texte : appui?.preuveId ? a.preuves.get(appui.preuveId)?.enonce : undefined;
  if (!refutation) return;
  if (!termesConcordants(idee.texte, refutation, pivot) || termesDivergents(idee.texte, refutation, pivot)) col.ajouter("C68", `L'idée reçue et sa réfutation ne parlent pas du même terme${pivot ? ` (« ${pivot} »)` : ""} : TERME_A_CONFIRMER.`);
}

/* ---------- C76 : matière vague ---------- */
export function termesVaguesDe(texte: string, termes: string[]): string[] {
  return termes.filter((t) => contientExpression(texte, t));
}
export function c76(e: EntreeControle, a: Analyse, col: Collecte): void {
  const termes = e.contexte?.termesVagues ?? [];
  if (!termes.length) return;
  for (const s of segmentsParles(a)) for (const m of matieresDe(a, s)) for (const t of termesVaguesDe(m.texte, termes)) col.ajouter("C76", `Matière vague (« ${t} ») gardée telle quelle.`, { segmentIndex: s.index });
}
