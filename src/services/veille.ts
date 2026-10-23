/**
 * VEILLE DES OUTILS (lot B2, `VEILLE-DES-OUTILS.md`) — être prévenu des nouvelles versions, sans jamais rien appliquer.
 *
 * - `verifierVeille` : lit chaque source publique (hors verrou, délai maximal par source), compare avec la dernière
 *   lecture, enregistre les nouveautés résumées en français (`FournisseurScript.resumerNouveaute`, simulé tant que
 *   Claude n'est pas relié), met à jour l'état des cartes. Une seule lecture à la fois par processus.
 * - Alertes : cloche (notification `veille`) pour chaque nouveauté ; e-mail SEULEMENT si intérêt fort ou rouge ;
 *   résumé de la semaine le lundi matin.
 * - `demarrerVeille` : tâche quotidienne dans le processus du studio (lancée par `instrumentation.ts`,
 *   coupée par `STUDIO_VEILLE=0`), une fois par processus. Elle porte aussi la lecture de votre site (Source
 *   axion-ia.com, `services/source-axion.ts`), qui a sa propre date et son interrupteur.
 * - « Essayer » crée une tâche (notification + journal) ; « Ignorer » range. Rien n'est jamais supprimé ni mis à jour.
 */
import "server-only";
import type { Id, VeilleNouveaute, VeilleOutil } from "@/domaine/types";
import type { FournisseurScript } from "@/fournisseurs/types";
import { envoyerEmail, type ConfigEmail } from "@/fournisseurs/notification/email";
import { nouvelId } from "@/lib/ids";
import { pluriel } from "@/lib/textes";
import { DELAI_SOURCE_MS } from "@/veille/http";
import { lireSource } from "@/veille/lecture";
import { assurerOutilsDepart, sourceDepuisAdresse } from "@/veille/outils-depart";
import { deciderApresLecture, doitEnvoyerEmail, doitEnvoyerResumeHebdo, estOuverte, etatOutil, lectureDue, semaineIso, texteResumeHebdo } from "@/veille/regles";
import { resumerNouveauteSimule, type DemandeResume, type ResumeNouveaute } from "@/veille/resume-simule";
import type { Lecture } from "@/veille/types";
import { depots, ErreurStudio, fournisseur, horodatage, journaliser, lireParametre, ecrireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import { creerNotification, emailActif } from "./notifications";
import { tourSite } from "./source-axion";

export interface DependancesVeille {
  appeler?: typeof fetch;
  env?: Record<string, string | undefined>;
  maintenant?: () => Date;
  email?: ConfigEmail | null;
  envoyerEmail?: typeof envoyerEmail;
  resumer?: (d: DemandeResume) => Promise<ResumeNouveaute>;
  delaiMs?: number;
}

export interface RapportVeille {
  saute?: boolean;
  lus: number;
  muets: string[];
  nouveautes: { outil: string; versionVue: string; rouge: boolean; interet: string }[];
  emails: number;
}

const cle = Symbol.for("studio-axion-ia.veille");
interface EtatVeilleProcessus {
  enCours: boolean;
  minuterie?: ReturnType<typeof setInterval>;
  depart?: ReturnType<typeof setTimeout>;
}
function etatProcessus(): EtatVeilleProcessus {
  const g = globalThis as typeof globalThis & { [cle]?: EtatVeilleProcessus };
  g[cle] ??= { enCours: false };
  return g[cle];
}

const LIEN_VEILLE = "/veille";

/**
 * Résumé d'une nouveauté par CE fournisseur de scripts : le sien s'il en a un, sinon les règles fixes. CORRECTEUR 1 —
 * B7 : `simule` dit la vérité (vrai sauf si un fournisseur RÉEL a fait le résumé lui-même).
 */
export async function resumerAvec(f: Pick<FournisseurScript, "mode" | "resumerNouveaute">, d: DemandeResume): Promise<ResumeNouveaute> {
  try {
    if (f.resumerNouveaute) return { ...(await f.resumerNouveaute(d)), simule: f.mode !== "reel" };
  } catch (e) {
    console.error("[studio] résumé de la veille en échec, règles fixes à la place", e);
  }
  return { ...resumerNouveauteSimule(d), simule: true };
}

/** Résumé d'une nouveauté : le fournisseur de scripts du studio s'il sait le faire, sinon les règles fixes. */
async function resumerParDefaut(d: DemandeResume): Promise<ResumeNouveaute> {
  try {
    return await resumerAvec(await fournisseur("script"), d);
  } catch (e) {
    console.error("[studio] résumé de la veille en échec, règles fixes à la place", e);
    return { ...resumerNouveauteSimule(d), simule: true };
  }
}

/** Pose les outils de départ s'ils manquent (sans base de données, la migration ne passe pas). */
async function preparer(): Promise<void> {
  if ((await depots().veilleOutils.compter()) === 0) await assurerOutilsDepart(depots().veilleOutils, maintenant());
}

/** Lit toutes les sources et enregistre ce qui a changé. Une seule lecture à la fois (sinon : sautée). */
export async function verifierVeille(dep: DependancesVeille = {}): Promise<RapportVeille> {
  const etat = etatProcessus();
  if (etat.enCours) return { saute: true, lus: 0, muets: [], nouveautes: [], emails: 0 };
  etat.enCours = true;
  try {
    return await lectureComplete(dep);
  } finally {
    etat.enCours = false;
  }
}

async function lectureComplete(dep: DependancesVeille): Promise<RapportVeille> {
  const quand = dep.maintenant?.() ?? new Date();
  const iso = quand.toISOString();
  await sousVerrou(preparer);
  const outils = await depots().veilleOutils.lister((o) => !o.archiveLe);

  // 1. Lectures HORS verrou, en parallèle, chacune avec son délai maximal.
  const lectures = await Promise.all(
    outils.map(async (o): Promise<[VeilleOutil, Lecture]> => {
      try {
        const l = await lireSource(o.source, {
          appeler: dep.appeler ?? fetch,
          env: dep.env ?? process.env,
          maintenant: quand,
          delaiMs: dep.delaiMs ?? DELAI_SOURCE_MS,
          precedente: { derniereVersionLe: o.derniereVersionLe, verifieLe: o.verifieLe },
        });
        return [o, l];
      } catch {
        return [o, { ok: false, raison: "La source ne répond pas." }];
      }
    }),
  );

  // 2. Décisions et résumés (hors verrou : le résumé peut appeler Claude).
  const resumer = dep.resumer ?? resumerParDefaut;
  const aEcrire: { outil: VeilleOutil; lecture: Lecture; decision: ReturnType<typeof deciderApresLecture>; resume?: ResumeNouveaute }[] = [];
  for (const [outil, lecture] of lectures) {
    const decision = deciderApresLecture(outil, lecture, iso);
    let resume: ResumeNouveaute | undefined;
    if (decision.nouveaute) {
      resume = await resumer({ outil: outil.nom, role: outil.role, versionUtilisee: outil.versionUtilisee, versionVue: decision.nouveaute.versionVue, notes: decision.nouveaute.notes });
      // Fichier surveillé changé (LICENSE.md de Remotion) : ROUGE d'office, quoi que dise le résumé.
      if (decision.nouveaute.fichiersChanges.length) {
        resume = { ...resume, rouge: true, risque: resume.risque ?? `${decision.nouveaute.fichiersChanges.join(", ")} a changé : la licence change, à relire avant toute mise à jour.` };
      }
    }
    aEcrire.push({ outil, lecture, decision, resume });
  }

  // 3. Écriture sous le verrou (aucun réseau).
  const creees = await sousVerrou(async () => {
    const d = depots();
    const res: { outil: VeilleOutil; n: VeilleNouveaute }[] = [];
    for (const { outil, lecture, decision, resume } of aEcrire) {
      const courant = (await d.veilleOutils.obtenir(outil.id)) ?? outil;
      const maj = { ...courant, ...decision.patch };
      if (decision.nouveaute && resume) {
        const deja = await d.veilleNouveautes.trouver((n) => n.outilId === outil.id && n.versionVue === decision.nouveaute!.versionVue);
        if (!deja) {
          const n: VeilleNouveaute = {
            id: nouvelId("veille"),
            outilId: outil.id,
            versionVue: decision.nouveaute.versionVue,
            date: decision.nouveaute.date,
            ...(decision.nouveaute.lien ? { lien: decision.nouveaute.lien } : {}),
            resume: { ceQueCaChange: resume.ceQueCaChange, interet: resume.interet, ...(resume.risque ? { risque: resume.risque } : {}) },
            rouge: resume.rouge,
            // Un résumé injecté sans le dire (essais) est compté simulé : jamais « Claude » sans preuve.
            simule: resume.simule !== false,
            statut: "nouvelle",
            ...horodatage(),
          };
          await d.veilleNouveautes.enregistrer(n);
          res.push({ outil: maj, n });
          await creerNotification({
            type: "veille",
            // E2E-2 parcours n° 27 : le titre dit à quoi sert l'outil (« FFmpeg » seul ne parle pas).
            titre: n.rouge ? `${outil.nom} : alerte à lire` : `${outil.nom}${outil.role ? ` (${outil.role.toLowerCase()})` : ""} : nouvelle version`,
            message: n.resume.ceQueCaChange,
            lien: `${LIEN_VEILLE}?nouveaute=${n.id}`,
          });
        }
      }
      const nouveautes = await d.veilleNouveautes.lister((n) => n.outilId === outil.id);
      await d.veilleOutils.modifier(outil.id, { ...decision.patch, etat: etatOutil(maj, nouveautes, lecture.ok), modifieLe: iso });
    }
    await ecrireParametre("veille.derniereLecture", iso);
    return res;
  });

  // 4. E-mails HORS verrou, seulement intérêt fort ou rouge.
  // Lot R3 : l'e-mail ne part que si la carte « Notifications » est reliée (sinon simulé, rien ne part).
  const config = dep.email === undefined ? await emailActif() : dep.email;
  const ecrire = dep.envoyerEmail ?? envoyerEmail;
  let emails = 0;
  for (const { outil, n } of creees) {
    if (!doitEnvoyerEmail(n)) continue;
    const r = await ecrire(config, { titre: n.rouge ? `Veille : alerte sur ${outil.nom}` : `Veille : ${outil.nom} ${n.versionVue}`, message: [n.resume.ceQueCaChange, n.resume.risque].filter(Boolean).join(" "), lien: `${LIEN_VEILLE}?nouveaute=${n.id}` });
    if (r.envoye || r.simule) emails++;
  }

  const muets = lectures.filter(([, l]) => !l.ok).map(([o]) => o.nom);
  await journaliser("veille", `Veille des outils : ${pluriel(lectures.length - muets.length, "outil vérifié", "outils vérifiés")}, ${pluriel(creees.length, "nouveauté", "nouveautés")}${muets.length ? `, impossible de vérifier : ${muets.join(", ")}` : ""}`);
  return {
    lus: lectures.length - muets.length,
    muets,
    nouveautes: creees.map(({ outil, n }) => ({ outil: outil.nom, versionVue: n.versionVue, rouge: n.rouge, interet: n.resume.interet })),
    emails,
  };
}

/** Résumé de la semaine, le lundi matin (cloche + e-mail), une fois par semaine. */
export async function envoyerResumeHebdo(dep: DependancesVeille = {}): Promise<boolean> {
  const quand = dep.maintenant?.() ?? new Date();
  if (!doitEnvoyerResumeHebdo(quand, await lireParametre<string | null>("veille.resumeSemaine", null))) return false;
  const depuis = new Date(quand.getTime() - 7 * 86_400_000).toISOString();
  const outils = await depots().veilleOutils.lister((o) => !o.archiveLe);
  const semaine = await depots().veilleNouveautes.lister((n) => n.creeLe >= depuis);
  const { titre, message } = texteResumeHebdo(outils, semaine);
  await sousVerrou(async () => {
    await creerNotification({ type: "veille", titre, message, lien: LIEN_VEILLE });
    await ecrireParametre("veille.resumeSemaine", semaineIso(quand));
  });
  await (dep.envoyerEmail ?? envoyerEmail)(dep.email === undefined ? await emailActif() : dep.email, { titre, message, lien: LIEN_VEILLE });
  return true;
}

/** Un tour de la tâche quotidienne : lecture si 24 h sont passées, puis résumé du lundi si c'est l'heure. */
export async function tourVeille(dep: DependancesVeille = {}): Promise<void> {
  try {
    const quand = dep.maintenant?.() ?? new Date();
    if (lectureDue(await lireParametre<string | null>("veille.derniereLecture", null), quand)) await verifierVeille(dep);
    await envoyerResumeHebdo(dep);
  } catch (e) {
    console.error("[studio] veille des outils en échec", e);
  }
}

/** Intervalle de la tâche : elle se réveille toutes les 30 min, mais ne lit qu'une fois par jour. */
export const INTERVALLE_VEILLE_MS = 30 * 60_000;
/** Premier tour un peu après le démarrage (la base et la boucle de fond d'abord). */
export const DEPART_VEILLE_MS = 90_000;

/** Lance la tâche quotidienne, UNE fois par processus. Renvoie faux si elle tournait déjà. */
export function demarrerVeille(): boolean {
  const e = etatProcessus();
  if (e.minuterie) return false;
  // Même minuterie pour la lecture de votre site (Source axion-ia.com, 03/10) : une fois par jour, sa propre date.
  const tour = () => {
    void tourVeille();
    void tourSite();
  };
  e.depart = setTimeout(tour, DEPART_VEILLE_MS);
  e.minuterie = setInterval(tour, INTERVALLE_VEILLE_MS);
  e.depart.unref?.();
  e.minuterie.unref?.();
  return true;
}

/** Verrou de la boucle perdu (relecture paquet 4, sécurité P3) : la tâche s'arrête ; elle repart à la reprise du verrou. */
export function arreterVeille(): void {
  const e = etatProcessus();
  if (e.depart) clearTimeout(e.depart);
  if (e.minuterie) clearInterval(e.minuterie);
  e.depart = undefined;
  e.minuterie = undefined;
}

/* --- Lecture pour les écrans ----------------------------------------- */

export interface VueVeille {
  outils: VeilleOutil[];
  nouveautes: VeilleNouveaute[];
  derniereLecture: string | null;
  lectureEnCours: boolean;
}

const ORDRE_ETAT: Record<VeilleOutil["etat"], number> = { attention: 0, nouveaute: 1, injoignable: 2, "a-jour": 3 };

export async function lireVeille(): Promise<VueVeille> {
  await exigerSession();
  await sousVerrou(preparer);
  const d = depots();
  const outils = (await d.veilleOutils.lister((o) => !o.archiveLe)).sort((a, b) => ORDRE_ETAT[a.etat] - ORDRE_ETAT[b.etat] || a.nom.localeCompare(b.nom, "fr"));
  const nouveautes = (await d.veilleNouveautes.lister()).sort((a, b) => b.creeLe.localeCompare(a.creeLe));
  return { outils, nouveautes, derniereLecture: await lireParametre<string | null>("veille.derniereLecture", null), lectureEnCours: etatProcessus().enCours };
}

/** Nombre de nouveautés à regarder (pastille du menu, Réglages > Outils). */
export async function compterNouveautesOuvertes(): Promise<number> {
  return depots().veilleNouveautes.compter(estOuverte);
}

/** Bilan des cartes (Réglages > Outils). */
export async function bilanVeille(): Promise<Record<VeilleOutil["etat"], number> & { ouvertes: number }> {
  await sousVerrou(preparer);
  const b = { "a-jour": 0, nouveaute: 0, attention: 0, injoignable: 0, ouvertes: await compterNouveautesOuvertes() };
  for (const o of await depots().veilleOutils.lister((x) => !x.archiveLe)) b[o.etat]++;
  return b;
}

/* --- Gestes de Will --------------------------------------------------- */

async function recalculerEtat(outilId: Id): Promise<void> {
  const d = depots();
  const outil = await d.veilleOutils.obtenir(outilId);
  if (!outil) return;
  const nouveautes = await d.veilleNouveautes.lister((n) => n.outilId === outilId);
  await d.veilleOutils.modifier(outilId, { etat: etatOutil(outil, nouveautes, outil.etat !== "injoignable") });
}

async function nouveauteExistante(id: Id): Promise<{ n: VeilleNouveaute; outil: VeilleOutil | null }> {
  const n = await depots().veilleNouveautes.obtenir(id);
  if (!n) throw new ErreurStudio("NOUVEAUTE_INTROUVABLE", "Cette nouveauté n'existe plus.");
  return { n, outil: await depots().veilleOutils.obtenir(n.outilId) };
}

/** « Essayer » : une tâche à faire (notification + journal), jamais une mise à jour automatique. */
export async function essayerNouveaute(id: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const { n, outil } = await nouveauteExistante(id);
    if (n.statut === "essayer") return;
    const quand = maintenant();
    await depots().veilleNouveautes.modifier(id, { statut: "essayer", tacheCreeeLe: quand });
    const nom = outil?.nom ?? "Outil";
    await creerNotification({ type: "veille", titre: `À faire : essayer ${nom} ${n.versionVue}`, message: "À essayer à part d'abord. Rien n'est changé sans votre accord.", lien: `${LIEN_VEILLE}?nouveaute=${id}` });
    await journaliser("veille", `À essayer : ${nom} ${n.versionVue}`, { type: "veille", id });
    await recalculerEtat(n.outilId);
  });
}

/** « Ignorer » : rangée, jamais supprimée. */
export async function ignorerNouveaute(id: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const { n, outil } = await nouveauteExistante(id);
    await depots().veilleNouveautes.modifier(id, { statut: "ignoree" });
    await journaliser("veille", `Ignorée : ${outil?.nom ?? "outil"} ${n.versionVue}`, { type: "veille", id });
    await recalculerEtat(n.outilId);
  });
}

/** Remettre une nouveauté rangée parmi celles à regarder. */
export async function reprendreNouveaute(id: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const { n } = await nouveauteExistante(id);
    await depots().veilleNouveautes.modifier(id, { statut: "nouvelle" });
    await recalculerEtat(n.outilId);
  });
}

/** Will ajoute un outil (nom + adresse) : GitHub, npm ou une page à surveiller. Lu à la prochaine vérification. */
export async function ajouterOutil(nom: string, adresse: string): Promise<VeilleOutil> {
  await exigerSession();
  const n = nom.trim().slice(0, 60);
  if (!n) throw new ErreurStudio("NOM_VIDE", "Donnez un nom à l'outil.");
  const source = sourceDepuisAdresse(adresse);
  if (!source) throw new ErreurStudio("ADRESSE_INVALIDE", "Adresse web invalide (elle commence par https://).");
  return sousVerrou(async () => {
    const o: VeilleOutil = { id: nouvelId("outil"), nom: n, role: "Ajouté par vous", source, etat: "injoignable", ajoutePar: "will", ...horodatage() };
    await depots().veilleOutils.enregistrer(o);
    await journaliser("veille", `Outil surveillé ajouté : ${n}`, { type: "veille", id: o.id });
    return o;
  });
}

/** Ranger un outil (plus surveillé, jamais supprimé). */
export async function rangerOutil(id: Id): Promise<void> {
  await exigerSession();
  await sousVerrou(async () => {
    const o = await depots().veilleOutils.obtenir(id);
    if (!o) throw new ErreurStudio("OUTIL_INTROUVABLE", "Cet outil n'existe plus.");
    await depots().veilleOutils.modifier(id, { archiveLe: maintenant() });
    await journaliser("veille", `Outil rangé : ${o.nom}`, { type: "veille", id });
  });
}

/** « Vérifier maintenant » (bouton de la page). */
export async function verifierMaintenant(): Promise<RapportVeille> {
  await exigerSession();
  return verifierVeille();
}
