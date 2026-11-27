/**
 * L4-08 : passerelle visuel -> créneau -> Publication. Les dépôts sont passés en paramètre (doublure en test).
 * Isolation : aucun appel réseau, diffuseur ou modèle d'IA. Une Publication « programmee » est une ligne du Studio,
 * rien ne part : l'envoi reste décidé ailleurs, par le fondateur.
 * Les transitions (visuel et créneau) sont portées par L1-04 et L1-08 ; ce module ne fait que les appeler.
 */
import { nomDuReseau } from "@/reseaux/hors-video";
import "server-only";
import type { Depot, LotEcritures } from "@/domaine/depots";
import { heureAffichageParis, transitionner } from "@/domaine/plan-editorial/statuts";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { resoudreCleEnvoi } from "@/services/envois-planifies";
import type { Evenement, Publication } from "@/domaine/types";
import { cleJour } from "@/lib/dates";
import type { ReseauEnvoiCreneau } from "@/domaine/reseaux-visuel-envoi";
import type { Visuel } from "@/domaine/visuels/visuel";
import { transitionPermise } from "@/domaine/visuels/statuts";
import { changerStatut, estConfie, identifiantsProgrammation, peutProgrammer, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";

export interface DepotsPasserelle extends DepotsPlan {
  publications: Depot<Publication>;
  visuels: Depot<Visuel>;
  /** Journal d'activité : trace d'un retrait du calendrier (facultatif pour les doublures de `programmerVisuel`). */
  evenements?: Depot<Evenement>;
  /** Envois planifiés : sert à résoudre la clé propre au créneau (facultatif ; absent = clé ancienne). */
  envoisPlanifies?: Depot<EnvoiPlanifie>;
}

/**
 * Programme un visuel depuis un créneau prêt : une Publication par réseau (source = le visuel), puis le visuel et le
 * créneau passent à « programme ». Idempotent : un rejeu rend les mêmes Publications et ne recrée rien.
 */
export async function programmerVisuel(d: DepotsPasserelle, creneauId: string, maintenant: string): Promise<Publication[]> {
  const c = await d.creneaux.obtenir(creneauId);
  if (!c) throw new Error(`Créneau introuvable : ${creneauId}`);
  if (!c.visuelId || c.videoId) throw new Error(`Le créneau ${creneauId} n'a pas de visuel unique.`);
  const v = await d.visuels.obtenir(c.visuelId);
  if (!v) throw new Error(`Visuel introuvable : ${c.visuelId}`);

  const deja = c.statut === "programme" && v.statut === "programme";
  if (!deja) {
    const porte = peutProgrammer(c);
    // Reprise après coupure : le créneau est resté « valide » alors que le visuel est déjà « programme ».
    if (!porte.ok) throw new Error(porte.raison);
    if (v.statut !== "valide" && v.statut !== "programme") throw new Error(`Visuel non validé (statut « ${v.statut} ») : il ne peut pas être programmé.`);
    // Un visuel n'est programmé que par UN créneau : un autre créneau déjà « programme » pour ce visuel (même date ou non, même réseau ou non)
    // en possède les Publications ; le 2e passerait « programme » sans Publication à lui. La reprise du créneau lui-même (même id) passe.
    const autre = await d.creneaux.trouver((x) => x.id !== c.id && x.visuelId === v.id && x.statut === "programme");
    if (autre) throw new Error(`Visuel déjà programmé sur un autre créneau (${autre.id}) : refus, rien d'écrit.`);
  }

  const lignes = identifiantsProgrammation(c);
  // Une Publication existe déjà pour ce visuel et ce réseau si elle porte l'id courant ou celui d'une version
  // antérieure (le créneau a été décalé depuis) : on la réutilise, on ne recrée jamais.
  const plan: { reseau: ReseauEnvoiCreneau; id: string; existante: Publication | null }[] = [];
  for (const { reseau, cle: cleAncienne } of lignes) {
    // Même clé que l'envoi du créneau (une entrée de l'ancienne clé peut appartenir à un autre créneau).
    const cle = d.envoisPlanifies
      ? await resoudreCleEnvoi(d.envoisPlanifies, { videoId: v.id, reseau, versionCreneau: c.decalages, creneauId: c.id })
      : cleAncienne;
    const id = `pub_${cle}`;
    const existante = (await d.publications.obtenir(id))
      ?? (await d.publications.trouver((p) => p.visuelId === v.id && p.reseau === reseau && p.statut === "programmee"));
    plan.push({ reseau, id, existante });
  }
  // Un rejeu n'est accepté que s'il ne change rien ; sinon la porte s'applique (créneau confié à renvoyer = refus).
  if (deja && plan.some((l) => !l.existante || l.existante.date !== c.heuresParReseau[l.reseau])) {
    if (c.aRenvoyer) throw new Error("À renvoyer à l'usine après un décalage : le rejeu est refusé.");
    if (plan.some((l) => !l.existante)) { const porte = peutProgrammer(c); if (!porte.ok) throw new Error(porte.raison); }
  }
  // Hors rejeu (!deja), une Publication existante à une autre date n'est pas déplacée (message neutre : ce peut être le créneau lui-même,
  // resté « programme » puis décalé, ou une Publication restante). Une reprise après coupure garde les mêmes dates et passe.
  if (!deja && plan.some((l) => l.existante && l.existante.date !== c.heuresParReseau[l.reseau])) {
    throw new Error("Publication existante à une autre date : refus, aucune Publication déplacée.");
  }
  const publications: Publication[] = [];
  for (const { reseau, id, existante } of plan) {
    const date = c.heuresParReseau[reseau]!;
    if (!existante) {
      publications.push(await d.publications.enregistrer({
        id, visuelId: v.id, reseau, statut: "programmee", via: "manuel",
        date, texte: c.textes?.[reseau]?.texte?.trim() || v.titre, creeLe: maintenant, modifieLe: maintenant,
      }));
    } else {
      // La légende du créneau (relue par la personne) prend la place du titre ; sans légende, le texte reste tel quel.
      const legende = c.textes?.[reseau]?.texte?.trim();
      const modif: Partial<Publication> = {};
      if (existante.date !== date) modif.date = date;
      if (legende && existante.texte !== legende) modif.texte = legende;
      if (Object.keys(modif).length > 0) publications.push(await d.publications.modifier(existante.id, { ...modif, modifieLe: maintenant } as Partial<Publication>));
      else publications.push(existante);
    }
  }

  if (v.statut === "valide") {
    if (!transitionPermise("valide", "programme")) throw new Error("Transition valide -> programme refusée pour un visuel.");
    await d.visuels.modifier(v.id, { statut: "programme" } as Partial<Visuel>);
  }
  if (c.statut === "valide") await changerStatut(d, c.id, "programme", "studio", maintenant);
  return publications;
}

/** Refus d'un retrait du calendrier : la phrase est celle de `PHRASES_RETRAIT`, rien n'a été écrit. */
export class RefusRetrait extends Error {}

export const PHRASES_RETRAIT = {
  introuvable: "Ce carrousel est introuvable. Rechargez la page.",
  absent: "Ce carrousel n'est pas au calendrier.",
  publiee: "Déjà publiée : elle ne se retire pas du calendrier.",
  confiee: "Cette publication a déjà été confiée à l'outil de publication : retirez-la d'abord là-bas. Rien n'a été changé ici.",
  usine: "Cette entrée a été confiée à l'usine : elle ne se retire pas d'ici.",
  passee: "L'heure est passée : cette publication ne se retire plus d'ici.",
} as const;

const JOUR_COURT = (instant: string): string => cleJour(instant).split("-").reverse().slice(0, 2).join("/");

/**
 * Défait `programmerEnUnClic` tant que RIEN n'est parti : efface les Publications « manuel » jamais envoyées, archive le
 * créneau (avec `retireLe`), remet le visuel à « valide », trace au journal. Un seul lot, un seul `appliquer`.
 * Refus (sans aucune écriture) : publiée, confiée à l'outil de publication ou à l'usine, ou heure passée.
 */
export async function retirerVisuel(
  d: DepotsPasserelle,
  visuelId: string,
  maintenant: string,
  appliquer: (lot: LotEcritures) => Promise<void>,
): Promise<{ creneauId: string; retirees: { reseau: string; date: string }[] }> {
  const v = await d.visuels.obtenir(visuelId);
  if (!v) throw new RefusRetrait(PHRASES_RETRAIT.introuvable);

  const pubs = await d.publications.lister((p) => p.visuelId === v.id);
  if (pubs.some((p) => p.statut === "publiee")) throw new RefusRetrait(PHRASES_RETRAIT.publiee);
  const confiee = pubs.some((p) =>
    !(p.statut === "programmee" && p.via === "manuel")
    || Boolean(p.idExterne) || Boolean(p.etatEnvoi) || Boolean(p.urlPubliee)
    || Boolean(p.stats) || (Array.isArray(p.releves) && p.releves.length > 0));
  if (confiee) throw new RefusRetrait(PHRASES_RETRAIT.confiee);

  const c = await d.creneaux.trouver((x) => x.visuelId === v.id && x.statut === "programme");
  if (v.statut !== "programme" || !c) throw new RefusRetrait(PHRASES_RETRAIT.absent);
  if (estConfie(c) || c.aRenvoyer) throw new RefusRetrait(PHRASES_RETRAIT.usine);

  const t = Date.parse(maintenant);
  const heures = Object.values(c.heuresParReseau).filter((h): h is string => Boolean(h));
  if (c.jourVise < cleJour(maintenant) || heures.some((h) => Date.parse(h) <= t) || pubs.some((p) => Date.parse(p.date) <= t)) {
    throw new RefusRetrait(PHRASES_RETRAIT.passee);
  }

  const r1 = transitionner(c, "valide", "studio");
  if (!r1.ok) throw new Error(r1.raison);
  const r2 = transitionner(r1.creneau, "archive", "studio");
  if (!r2.ok) throw new Error(r2.raison);
  const creneau = { ...r2.creneau, retireLe: maintenant };

  if (!transitionPermise("programme", "valide")) throw new Error("Transition programme -> valide refusée pour un visuel.");
  const visuel: Visuel = { ...v, statut: "valide", modifieLe: maintenant };

  const retirees = pubs
    .map((p) => ({ reseau: p.reseau as string, date: p.date }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const detail = retirees.map((r) => `${nomDuReseau(r.reseau)} le ${JOUR_COURT(r.date)} à ${heureAffichageParis(r.date)}`).join(", ");
  const evenement: Evenement = {
    id: "ev_retrait_" + c.id, type: "calendrier",
    message: `Carrousel « ${v.titre} » retiré du calendrier avant tout envoi : ${detail}. Lignes retirées : ${pubs.map((p) => p.id).join(", ")}.`,
    entite: "visuel", entiteId: v.id, date: maintenant, creeLe: maintenant, modifieLe: maintenant,
  };

  const lot: LotEcritures = {
    supprimer: pubs.map((p) => ({ collection: "publications" as const, id: p.id })),
    enregistrer: [
      { collection: "creneauxEditoriaux", entite: creneau },
      { collection: "visuels", entite: visuel },
      { collection: "evenements", entite: evenement },
    ],
  };
  await appliquer(lot);
  return { creneauId: c.id, retirees };
}
