/** Aides des tests du parcours de conversation (lot 3a). Données 100 % fictives ; aucun réseau. */
import { vi } from "vitest";
import type { PortInboxZernio, ResultatEcritureInbox } from "@/fournisseurs/zernio-inbox";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import { empreintePersonne, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";

export const T0 = Date.parse("2026-10-18T10:00:30.000Z");
export const COMPTE = "compte-fictif-100";
export const POST = "post-plateforme-fictif-200";
export const TITRE = "Guide d'exemple";
export const ADRESSE_FICTIVE = "personne-fictive@example.test";
export const SECRET_EMPREINTE = "secret-fictif-empreinte-conversation-0123456789";
export const ENV = {
  PARCOURS_CONVERSATION_ENABLED: "1",
  STUDIO_EMPREINTE_SECRET: SECRET_EMPREINTE,
  SITE_VIDEOS_URL: "https://site.exemple",
  SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-conversation-0123456789",
};
const OK: ResultatEcritureInbox = { statut: "envoye", idMessage: "msg-sortant-fictif" };

export interface FauxPort {
  port: PortInboxZernio;
  pub: Array<{ texte: string; cle: string; idPost: string }>;
  prive: Array<{ texte: string }>;
  lire: number;
  envoyes: Array<{ texte: string; cle: string }>;
  total: () => number;
  /** Comptes pour lesquels le faux port accepte d'ÉCRIRE / de LIRE ; absent = tous. Hors liste : refus compté dans `refuses` (écriture) ou panne (lecture). */
  ecritureAutorisee?: string[];
  lectureAutorisee?: string[];
  refuses: number;
  /** Réponses configurables. */
  horsEcriture: (idCompte: string) => boolean;
  refus: () => ResultatEcritureInbox;
  reponses: { pub: () => ResultatEcritureInbox; prive: () => ResultatEcritureInbox; envoyer: () => ResultatEcritureInbox; texte: () => string | null;
    /** Si présent, remplace la lecture : résultat complet du port (panne, introuvable…). */
    lecture?: () => import("@/fournisseurs/zernio-inbox").MessageLu;
  };
}
export function fauxPort(): FauxPort {
  const f: FauxPort = {
    pub: [], prive: [], lire: 0, envoyes: [], refuses: 0,
    total: () => f.pub.length + f.prive.length + f.lire + f.envoyes.length,
    horsEcriture: (idCompte) => !!f.ecritureAutorisee && !f.ecritureAutorisee.includes(idCompte) && (f.refuses++, true),
    refus: () => ({ statut: "refuse", code: "compte_hors_liste" }),
    reponses: { pub: () => OK, prive: () => OK, envoyer: () => OK, texte: () => null },
    port: {
      repondreCommentaire: async (p) => (f.pub.push({ texte: p.texte, cle: p.cle, idPost: p.idPost }), f.horsEcriture(p.idCompte) ? f.refus() : f.reponses.pub()),
      repondreEnPrive: async (p) => (f.prive.push({ texte: p.texte }), f.horsEcriture(p.idCompte) ? f.refus() : f.reponses.prive()),
      lireMessage: async (p) => (f.lire++, f.lectureAutorisee && !f.lectureAutorisee.includes(p.idCompte) ? { texte: null, postback: null, panne: true } : f.reponses.lecture ? f.reponses.lecture() : { texte: f.reponses.texte(), postback: null }),
      envoyerMessage: async (p) => (f.envoyes.push({ texte: p.texte, cle: p.cle }), f.horsEcriture(p.idCompte) ? f.refus() : f.reponses.envoyer()),
    },
  };
  return f;
}

export interface FauxSite {
  vus: RequeteSignee[];
  reponses: () => { statut: number; corps?: unknown };
  transport: (r: RequeteSignee) => Promise<{ statut: number; corps: unknown }>;
}
export function fauxSite(): FauxSite {
  const s: FauxSite = { vus: [], reponses: () => ({ statut: 200, corps: {} }), transport: async (r) => (s.vus.push(r), { corps: {}, ...s.reponses() }) };
  return s;
}

export const cleConversation = (id: string): string => {
  const k = lireClesEmpreinte(ENV);
  if (!k.ok) throw new Error("clés attendues");
  return empreintePersonne(k.courante, "zernio-conversation", id);
};

let n = 0;
export async function deposerCommentaire(depots: () => any, o: { idAuteur?: string; idCommentaire?: string; motSeul?: string | null; proprio?: boolean; estReponse?: boolean; idCompte?: string; idPost?: string | null; ageMs?: number; reseau?: string } = {}): Promise<string> {
  const idEvenement = `evt-com-${++n}`;
  const m = new Date(T0 - (o.ageMs ?? 1000)).toISOString();
  await depots().evenementsFournisseurs.enregistrer({
    id: `evf-${idEvenement}`, fournisseur: "zernio", idEvenement, type: "zernio.commentaire", recuLe: m, traite: false, creeLe: m, modifieLe: m,
    charge: { idCommentaire: o.idCommentaire ?? `com-${n}`, idPostPlateforme: o.idPost === undefined ? POST : o.idPost, idCompte: o.idCompte ?? COMPTE, reseau: o.reseau ?? "instagram", idAuteur: o.idAuteur ?? "auteur-fictif-400", proprio: o.proprio ?? false, motSeul: o.motSeul === undefined ? "GUIDE" : o.motSeul, estReponse: o.estReponse ?? false, etat: "a_faire" },
  });
  return idEvenement;
}
export async function deposerMessage(depots: () => any, o: { idExpediteur?: string; idConversation?: string | null; idMessage?: string; idCompte?: string; occurredAt?: string; avance?: number } = {}): Promise<string> {
  const idEvenement = `evt-msg-${++n}`;
  const m = new Date(T0 - 500 + (o.avance ?? 0)).toISOString();
  await depots().evenementsFournisseurs.enregistrer({
    id: `evf-${idEvenement}`, fournisseur: "zernio", idEvenement, type: "zernio.message", recuLe: m, traite: false, creeLe: m, modifieLe: m,
    charge: { idMessage: o.idMessage ?? `msg-${n}`, idConversation: o.idConversation === undefined ? "conv-fictive-700" : o.idConversation, idCompte: o.idCompte ?? COMPTE, idExpediteur: o.idExpediteur ?? "auteur-fictif-400", ...(o.occurredAt ? { occurredAt: o.occurredAt } : {}), etat: "a_faire" },
  });
  return idEvenement;
}
export const evenement = async (depots: () => any, idEvenement: string) => (await depots().evenementsFournisseurs.lister((x: any) => x.idEvenement === idEvenement))[0];

export function silencerConsole(): void {
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
}

/** Enregistre la validation du mot GUIDE (écran /mots) pour ce titre : la garde du parcours la revérifie avant tout envoi. */
export async function validerGuideAuParcours(titre: string = TITRE): Promise<void> {
  const { empreinteGuideParcours } = await import("@/domaine/guide-reseau/empreinte-guide");
  const { ecrireParametre } = await import("@/services/_commun");
  const e = empreinteGuideParcours(titre);
  if (!e.ok) throw new Error(e.raison);
  await ecrireParametre("mots.validation.guide-parcours", { empreinte: e.empreinte, valideLe: "2026-01-01T00:00:00.000Z" });
}

/** Enregistre (écran /mots) la validation des formulations données : empreinte = sha256(version + "\n" + texte brut). Par défaut une seule par groupe. */
export const FORMULATIONS_VALIDEES_PAR_DEFAUT = ["mp-m1-v4-1", "mp-adresse-refusee-v3-1"] as const;
export async function validerFormulationsAuParcours(versions: readonly string[] = FORMULATIONS_VALIDEES_PAR_DEFAUT): Promise<void> {
  const { TEXTES_MP } = await import("@/domaine/guide-reseau/textes-mp");
  const { createHash } = await import("node:crypto");
  const { ecrireParametre } = await import("@/services/_commun");
  const v: Record<string, { empreinte: string; valideLe: string }> = {};
  for (const id of versions) {
    const b = (TEXTES_MP as Record<string, { version: string; texte: string }>)[id];
    v[id] = { empreinte: createHash("sha256").update(`${b.version}\n${b.texte}`).digest("hex"), valideLe: "2026-01-01T00:00:00.000Z" };
  }
  await ecrireParametre("parcours.validation.formulations", v);
}
