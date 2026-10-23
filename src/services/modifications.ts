/**
 * « DEMANDER UNE MODIFICATION » (lot M3 ; plan PARTIE A §2 étape 9 (c), B.9).
 * La demande libre de Will (« enlève l'image d'hôpital ») est traduite en OPÉRATIONS typées par le générateur central
 * (`FournisseurScript.interpreterDemande` : Claude, simulé par mots-clés tant qu'il n'est pas relié). Le studio montre
 * le résumé, le coût et les plans touchés ; RIEN ne s'exécute sans la confirmation de Will. Une demande hors des
 * capacités d'une retouche reçoit une réponse claire, avec le prix de la vidéo à refaire.
 * L'historique est une conversation conservée par vidéo (jamais effacée : une proposition abandonnée reste visible).
 *
 * 17/10 (défaut vu par Will sur un tableau animé) : la lecture dépend du FORMAT. Le tableau animé n'a pas de plans :
 * sa demande est traduite sur la fiche de scènes (`montage-tableau/demande.ts`, écrans touchés, boutons du catalogue)
 * et confirmée par le chemin des boutons (`retoucherTableau`). Un format qui ne sait pas retoucher un passage le dit
 * avec ce qui a été compris et le prix pour refaire la vidéo. Les exemples affichés (`exemplesModification`) sont
 * ceux que la vidéo permet vraiment.
 */
import "server-only";
import type { CommandeFabrication, Id, Montant } from "@/domaine/types";
import type { DemandeModification } from "@/fournisseurs";
import { idMoteurDeCommande, moteurDeCommande } from "@/moteurs";
import { ID_MOTEUR_CAS_CONCRET } from "@/moteurs/montage-cas-concret";
import { exemplesTableau, traduireDemandeTableau } from "@/moteurs/montage-tableau/demande";
import type { OperationRetouche } from "@/moteurs/montage-tableau/retouches";
import { exemplesDemandeSimulee } from "@/fournisseurs/simulation/script";
import type { OperationMontage } from "@/moteurs/types";
import { nouvelId } from "@/lib/ids";
import { centimes } from "@/lib/montants";
import { creerVerrou, depots, ErreurStudio, fournisseur, journaliser, lireParametre, ecrireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { estimerRetoucheVideo, lancerRetouche } from "./fabrication";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import { ficheTableauDeLaVideo, prixRefaireTableau, retoucherTableau } from "./tableau-vue";
import { preparerReglagesMoteur } from "./cas-concret-reglages";
import { abandonnerRetouche, confirmerRetouche, exemplesRetouche, proposerRetouche, suivreRetouche, type DependancesRetouche, type EtatRetouche } from "./cas-concret-retouches";

export type StatutProposition = "en-cours" | "proposee" | "confirmee" | "abandonnee" | "hors-capacite" | "incomprise";

/** Un échange de la conversation : la demande de Will et la réponse du studio. */
export interface PropositionModification {
  id: Id;
  date: string;
  /** Texte de Will, tel quel. */
  demande: string;
  /** Réponse du studio (vouvoiement, sans jargon). */
  resume: string;
  operations: OperationMontage[];
  /** Plans touchés (identifiants de la version courante) et leur numéro affiché. */
  planIds: Id[];
  plansTouches: number[];
  /** Ce que numérotent `plansTouches` : des plans (par défaut) ou des écrans (tableau animé, scènes de la fiche). */
  unite?: "plan" | "ecran";
  /** Tableau animé : l'opération du catalogue des boutons, lancée par `retoucherTableau` à la confirmation. */
  operationsTableau?: OperationRetouche[];
  cout: Montant;
  /** Hors capacités : pourquoi, et le prix de la vidéo à refaire. */
  horsCapacite?: { message: string; prixVideo: Montant };
  statut: StatutProposition;
  versionId: Id;
  travailId?: Id;
  /** Cas concret : la demande est lue et confirmée par `cas-concret-retouches` (appel détaché, aperçu du moteur). */
  retoucheCasConcret?: true;
}

const cle = (videoId: Id) => `modifications.${videoId}`;

export async function historiqueModifications(videoId: Id): Promise<PropositionModification[]> {
  return lireParametre<PropositionModification[]>(cle(videoId), []);
}

const verrouHistorique = creerVerrou();

/** Lit l'historique et le réécrit d'un seul tenant : une écriture lente d'une autre demande n'en efface jamais une neuve. */
function modifierHistorique(videoId: Id, f: (liste: PropositionModification[]) => PropositionModification[]): Promise<void> {
  return verrouHistorique(async () => ecrireParametre(cle(videoId), f(await historiqueModifications(videoId))));
}

/** Remplace la proposition de même identifiant dans l'historique relu à l'instant. */
const remplacerDansHistorique = (videoId: Id, suite: PropositionModification) => modifierHistorique(videoId, (liste) => liste.map((x) => (x.id === suite.id ? suite : x)));

/** Plans touchés par des opérations (PUR, testé). Le titre d'ouverture touche les plans des 3 premières secondes. */
export function plansTouchesPar(operations: OperationMontage[], plans: { id: Id; debutSec: number; finSec: number; sourceImage: string }[]): Id[] {
  const ids = new Set<Id>();
  for (const o of operations) {
    switch (o.type) {
      case "remplacerIllustration":
      case "changerAngle":
      case "changerCadrage":
        ids.add(o.planId);
        break;
      case "deplacerIncrustation":
        ids.add(o.planId);
        ids.add(o.versPlanId);
        break;
      case "modifierTitre":
        for (const p of plans) if (p.debutSec < 3) ids.add(p.id);
        break;
      case "ajusterRythme":
        for (const p of plans) if ((o.depuisSec === undefined || p.finSec > o.depuisSec) && (o.jusquaSec === undefined || p.debutSec < o.jusquaSec)) ids.add(p.id);
        break;
      case "refaireSegmentVoix":
        // La phrase relue est raccordée sur une coupe : les plans de ce segment sont refaits (B.3).
        for (const p of plans as { id: Id; debutSec: number; finSec: number; sourceImage: string; segmentId?: string }[]) if (p.segmentId === o.segmentId) ids.add(p.id);
        break;
      case "corrigerMot":
        // Gratuit : un nouveau calque de sous-titres, aucun plan refait (B.0 §20).
        break;
    }
  }
  return [...ids].filter((id) => plans.some((p) => p.id === id));
}

/** Ce que Will veut, en quelques mots, pour une réponse « hors capacités » qui montre qu'elle a été comprise. */
export function intentionDe(texte: string): string | null {
  const t = texte.toLowerCase();
  const n = t.match(/(?:[ée]cran|sc[eè]ne|plan)\s*(?:n°\s*)?(\d+)/)?.[1];
  const ou = n ? ` (${/plan/.test(t) ? "plan" : "écran"} ${n})` : "";
  if (/mise en page|disposition/.test(t)) return `changer la mise en page${ou}`;
  if (/chiffre|nombre/.test(t) && /plus t[oô]t|avant|d[eè]s le d[ée]but/.test(t)) return "faire apparaître le chiffre plus tôt";
  if (/\bmot|texte|[ée]crit|orthographe|faute/.test(t)) return `changer un mot à l'écran${ou}`;
  if (/(enl[eè]v|retir|supprim)\S*\s+(le\s+|l')?(plan|[ée]cran|sc[eè]ne)/.test(t)) return `retirer un passage${ou}`;
  if (/image|illustration|dessin/.test(t)) return `changer une image${ou}`;
  if (/serr|large|cadr|angle/.test(t)) return "changer le cadrage";
  if (/rythme|plus vite|plus lent/.test(t)) return "changer le rythme";
  if (/titre/.test(t)) return "changer le titre";
  if (/\bfin\b|appel/.test(t)) return "changer la fin";
  return null;
}

/** Réponse d'un format qui ne sait pas retoucher un passage : ce qui est compris, et qu'il faut refaire la vidéo. */
function messageSansRetouche(texte: string): string {
  const intention = intentionDe(texte);
  return `${intention ? `Compris : ${intention}. ` : ""}La retouche d'un passage n'est pas encore disponible pour cette vidéo : pour ce changement, il faut refaire la vidéo. Votre vidéo reste telle quelle.`;
}

/** Note affichée à la place des exemples quand le format ne sait pas retoucher un passage. */
export const NOTE_SANS_RETOUCHE = "Ce format ne sait pas encore retoucher un passage : décrivez le changement, le studio vous donne le prix pour refaire la vidéo.";

/** La vidéo peut-elle être retouchée par passage ? (même règle que `lancerRetouche`.) */
const retouchable = (video: { estDemo?: boolean }, commande: CommandeFabrication) => {
  const moteur = moteurDeCommande(commande);
  return !!video.estDemo || (moteur.capacites.retoucheParPlan && !moteur.refusRetouche?.(commande));
};

/**
 * Exemples cliquables de la conversation, selon le format et la vidéo : chacun est compris et donne une proposition.
 * Un format qui ne sait pas retoucher : aucun exemple, une note. Lecture seule (rien n'est enregistré ni lancé).
 */
export async function exemplesModification(videoId: Id): Promise<{ exemples: string[]; note?: string }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) return { exemples: [] };
  // Réglage `casConcret.retouches` : relu avant d'interroger le moteur (son refus est synchrone).
  await preparerReglagesMoteur(courante.commande);
  if (!retouchable(video, courante.commande)) return { exemples: [], note: NOTE_SANS_RETOUCHE };
  if (idMoteurDeCommande(courante.commande) === ID_MOTEUR_CAS_CONCRET) return { exemples: await exemplesRetouche(videoId) };
  if (idMoteurDeCommande(courante.commande) === "montage-tableau") {
    const tableau = await ficheTableauDeLaVideo(videoId).catch(() => null);
    return { exemples: tableau?.fiche ? exemplesTableau(tableau.fiche, tableau.contexte) : [] };
  }
  const plans = await d.plans.lister((p) => p.versionId === courante.id);
  return { exemples: exemplesDemandeSimulee(plans.map((p) => ({ id: p.id, ordre: p.ordre, texte: p.texte, debutSec: p.debutSec, finSec: p.finSec, sourceImage: p.sourceImage, angle: p.angle }))) };
}

/** Tableau animé : la demande traduite sur la fiche de scènes (écrans), prix par l'estimateur de retouche du moteur. */
async function propositionTableau(videoId: Id, texte: string, base: Pick<PropositionModification, "id" | "date" | "demande" | "versionId">, prixVideo: () => Promise<PropositionModification["cout"]>): Promise<PropositionModification> {
  const vide = { operations: [], planIds: [], plansTouches: [], cout: centimes(0), unite: "ecran" as const };
  let tableau: Awaited<ReturnType<typeof ficheTableauDeLaVideo>> = null;
  try {
    tableau = await ficheTableauDeLaVideo(videoId);
  } catch {
    return { ...base, ...vide, resume: "La fiche de scènes n'a pas pu être lue. Réessayez dans un instant.", statut: "incomprise" };
  }
  if (!tableau?.fiche) {
    const message = `La fiche de scènes de cette vidéo est introuvable : la retouche n'est pas possible. Pour ce changement, il faut refaire la vidéo.`;
    return { ...base, ...vide, resume: message, horsCapacite: { message, prixVideo: await prixVideo() }, statut: "hors-capacite" };
  }
  const r = traduireDemandeTableau(tableau.fiche, texte, tableau.contexte);
  if (!r) {
    const exemples = exemplesTableau(tableau.fiche, tableau.contexte);
    return { ...base, ...vide, resume: `Je n'ai pas trouvé quoi changer sur le tableau.${exemples.length ? ` Vous pouvez par exemple demander : « ${exemples.join(" », « ")} ».` : ""}`, statut: "incomprise" };
  }
  if (r.genre === "hors-capacite") return { ...base, ...vide, resume: r.message, horsCapacite: { message: r.message, prixVideo: centimes(await prixRefaireTableau(tableau.fiche)) }, statut: "hors-capacite" };
  // Retouche payante (voix refaite) : `retoucherTableau` annonce son prix à la confirmation (accord sur le montant).
  const cout = (await moteurDeCommande(tableau.version.commande).estimerRetouche(tableau.version.commande, [])).total;
  return { ...base, ...vide, resume: r.resume, plansTouches: r.ecrans, cout, operationsTableau: [r.operation], statut: "proposee" };
}

/** Majuscule initiale d'une phrase (« je refais la voix… » → « Je refais la voix… »). */
const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Cas concret : l'état de la demande (`cas-concret-retouches`) devient une proposition de la conversation. En lecture : on
 * attend (rien n'est montré ni lancé) ; comprise : ce qui change, ce qui est refait, le prix ; refusée (hors liste, règle,
 * « déplacer une étape ») : la phrase claire et le prix pour refaire la vidéo.
 */
async function propositionCasConcret(base: Pick<PropositionModification, "id" | "date" | "demande" | "versionId">, etat: EtatRetouche, prixVideo: () => Promise<Montant>): Promise<PropositionModification> {
  const vide = { operations: [], planIds: [], plansTouches: [], cout: centimes(0), retoucheCasConcret: true as const };
  switch (etat.statut) {
    case "proposee":
      return { ...base, ...vide, resume: `${etat.changements.join(". ")}. ${majuscule(etat.refaits)}.`, cout: centimes(etat.centimes), statut: "proposee" };
    case "refusee":
      return { ...base, ...vide, resume: etat.phrase, horsCapacite: { message: etat.phrase, prixVideo: await prixVideo() }, statut: "hors-capacite" };
    case "en-cours":
      return { ...base, ...vide, resume: etat.phrase, statut: "en-cours" };
    case "aucune":
      return { ...base, ...vide, resume: "Cette demande n'est plus en cours : écrivez-la de nouveau.", statut: "incomprise" };
  }
}

/**
 * Cas concret : relit une demande « en cours » (l'appel Claude n'est jamais attendu). Une autre demande est passée entre-temps
 * ou le réglage est éteint : la proposition est close, rien n'est lancé.
 */
export async function suivreModification(videoId: Id, propositionId: Id, dep: DependancesRetouche = {}): Promise<PropositionModification> {
  await exigerSession();
  const liste = await historiqueModifications(videoId);
  const p = liste.find((x) => x.id === propositionId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette proposition n'existe plus.");
  if (p.statut !== "en-cours" || !p.retoucheCasConcret) return p;
  const etat = await suivreRetouche(videoId, dep);
  const prixVideo = async () => {
    const courante = (await depots().versions.obtenir(p.versionId))?.commande;
    return courante ? (await moteurDeCommande(courante).estimer(courante)).total : centimes(0);
  };
  const lue = etat.statut !== "aucune" && etat.demande !== p.demande ? ({ statut: "aucune" } as const) : etat;
  const suite = await propositionCasConcret({ id: p.id, date: p.date, demande: p.demande, versionId: p.versionId }, lue, prixVideo);
  await remplacerDansHistorique(videoId, suite);
  return suite;
}

/** Traduit la demande et calcule ce qu'elle coûterait. Ne lance RIEN. */
export async function proposerModification(videoId: Id, texte: string, dep: DependancesRetouche = {}): Promise<PropositionModification> {
  await exigerSession();
  const demandeTexte = texte.trim();
  if (!demandeTexte) throw new ErreurStudio("DEMANDE_VIDE", "Écrivez ce que vous voulez changer.");
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version à modifier.");
  const plans = (await d.plans.lister((p) => p.versionId === courante.id)).sort((a, b) => a.ordre - b.ordre);
  const demande: DemandeModification = {
    texte: demandeTexte,
    plans: plans.map((p) => ({ id: p.id, ordre: p.ordre, texte: p.texte, debutSec: p.debutSec, finSec: p.finSec, sourceImage: p.sourceImage, angle: p.angle })),
    titreOuverture: video.titre,
  };
  // Vérif A2 (10/10) : une vidéo dont le moteur ne sait pas retoucher un passage pour de vrai (avocat réel) n'a plus de
  // prix proposé puis refusé à la confirmation : la réponse le dit tout de suite, sans lire la demande (rien n'est payé).
  await preparerReglagesMoteur(courante.commande);
  const moteur = moteurDeCommande(courante.commande);
  const prixVideo = async () => (await moteur.estimer(courante.commande)).total;
  if (!retouchable(video, courante.commande)) {
    const message = messageSansRetouche(demandeTexte);
    const proposition: PropositionModification = { id: nouvelId("modif"), date: maintenant(), demande: demandeTexte, versionId: courante.id, operations: [], resume: message, planIds: [], plansTouches: [], cout: centimes(0), horsCapacite: { message, prixVideo: await prixVideo() }, statut: "hors-capacite" };
    await modifierHistorique(videoId, (liste) => [...liste, proposition]);
    return proposition;
  }
  if (idMoteurDeCommande(courante.commande) === ID_MOTEUR_CAS_CONCRET) {
    const base = { id: nouvelId("modif"), date: maintenant(), demande: demandeTexte, versionId: courante.id };
    const proposition = await propositionCasConcret(base, await proposerRetouche(videoId, demandeTexte, dep), prixVideo);
    await modifierHistorique(videoId, (liste) => [...liste, proposition]);
    return proposition;
  }
  if (idMoteurDeCommande(courante.commande) === "montage-tableau") {
    const proposition = await propositionTableau(videoId, demandeTexte, { id: nouvelId("modif"), date: maintenant(), demande: demandeTexte, versionId: courante.id }, prixVideo);
    await modifierHistorique(videoId, (liste) => [...liste, proposition]);
    return proposition;
  }
  const reponse = await (await fournisseur("script")).interpreterDemande(demande);
  const base = { id: nouvelId("modif"), date: maintenant(), demande: demandeTexte, versionId: courante.id, operations: reponse.operations };
  let proposition: PropositionModification;
  if (reponse.horsCapacite) {
    proposition = { ...base, resume: reponse.horsCapacite, operations: [], planIds: [], plansTouches: [], cout: centimes(0), horsCapacite: { message: reponse.horsCapacite, prixVideo: await prixVideo() }, statut: "hors-capacite" };
  } else if (!reponse.operations.length) {
    proposition = { ...base, resume: reponse.resume, planIds: [], plansTouches: [], cout: centimes(0), statut: "incomprise" };
  } else {
    const planIds = plansTouchesPar(reponse.operations, plans);
    const cout = planIds.length ? (await estimerRetoucheVideo(videoId, planIds)).total : centimes(0);
    proposition = { ...base, resume: reponse.resume, planIds, plansTouches: plans.filter((p) => planIds.includes(p.id)).map((p) => p.ordre), cout, statut: "proposee" };
  }
  await modifierHistorique(videoId, (liste) => [...liste, proposition]);
  return proposition;
}

/** Will confirme : la retouche part, seuls les plans touchés sont refaits (et payés). */
export async function confirmerModification(videoId: Id, propositionId: Id, options: { confirme?: AccordPrix } = {}, dep: DependancesRetouche = {}): Promise<{ travailId: Id }> {
  await exigerSession();
  const liste = await historiqueModifications(videoId);
  const p = liste.find((x) => x.id === propositionId);
  if (!p) throw new ErreurStudio("INTROUVABLE", "Cette proposition n'existe plus.");
  if (p.statut === "en-cours") throw new ErreurStudio("PAS_PRETE", "Cette demande n'est pas encore prête : patientez un instant.");
  if (p.statut !== "proposee") throw new ErreurStudio("DEJA_TRAITEE", "Cette proposition a déjà été traitée.");
  const video = await depots().videos.obtenir(videoId);
  if (video?.versionChoisieId !== p.versionId) throw new ErreurStudio("VERSION_CHANGEE", "La vidéo a changé depuis : redemandez la modification.");
  // Cas concret : l'aperçu est recalculé et le chemin de retouche du studio reçoit les opérations (réservation « au plus »).
  if (p.retoucheCasConcret) {
    const issue = await confirmerRetouche(videoId, accordPropre(options.confirme), { ...dep, demande: p.demande });
    if (issue.statut === "refusee") throw new ErreurStudio("RETOUCHE_INDISPONIBLE", issue.phrase);
    if (issue.statut === "accord-requis") throw new ErreurStudio("CONFIRMATION_REQUISE", issue.phrase, issue.centimes);
    return terminer(videoId, p, issue.travailId);
  }
  // Tableau animé : le chemin des boutons (règles revérifiées, voix refaite seulement avec un accord sur son montant).
  if (p.operationsTableau?.length) {
    const issue = await retoucherTableau(videoId, p.operationsTableau[0], { accord: options.confirme });
    if (issue.statut === "refusee") throw new ErreurStudio("RETOUCHE_INDISPONIBLE", issue.phrase);
    if (issue.statut === "accord-requis") throw new ErreurStudio("CONFIRMATION_REQUISE", issue.phrase, issue.centimes);
    return terminer(videoId, p, issue.travailId);
  }
  // Les opérations typées sont gardées dans la conversation ; la retouche reçoit les plans touchés et la demande.
  const r = await lancerRetouche(videoId, p.planIds, `Demande : ${p.demande} — ${p.resume}`, options);
  return terminer(videoId, p, r.travailId);
}

/** La proposition confirmée est marquée « lancée » dans la conversation. */
async function terminer(videoId: Id, p: PropositionModification, travailId: Id): Promise<{ travailId: Id }> {
  await modifierHistorique(videoId, (liste) => liste.map((x) => (x.id === p.id ? { ...x, statut: "confirmee" as const, travailId } : x)));
  await journaliser("retouche", `Modification confirmée : « ${p.demande} »`, { type: "video", id: videoId });
  return { travailId };
}

/** Will renonce : la proposition reste dans la conversation, marquée « abandonnée » (rien n'est effacé). */
export async function abandonnerModification(videoId: Id, propositionId: Id): Promise<void> {
  await exigerSession();
  const liste = await historiqueModifications(videoId);
  const p = liste.find((x) => x.id === propositionId && x.statut === "proposee");
  // Cas concret : la demande gardée est oubliée avec la proposition (la même phrase repartira de zéro).
  if (p?.retoucheCasConcret) await abandonnerRetouche(videoId, p.demande);
  await modifierHistorique(videoId, (relue) => relue.map((x) => (x.id === propositionId && x.statut === "proposee" ? { ...x, statut: "abandonnee" as const } : x)));
}
