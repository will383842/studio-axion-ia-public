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
  SITE_VIDEOS_SECRET: "secret-fictif-site-conversation",
};
const OK: ResultatEcritureInbox = { statut: "envoye", idMessage: "msg-sortant-fictif" };

export interface FauxPort {
  port: PortInboxZernio;
  pub: Array<{ texte: string; cle: string; idPost: string }>;
  prive: Array<{ texte: string }>;
  lire: number;
  envoyes: Array<{ texte: string; cle: string }>;
  total: () => number;
  /** Réponses configurables. */
  reponses: { pub: () => ResultatEcritureInbox; prive: () => ResultatEcritureInbox; envoyer: () => ResultatEcritureInbox; texte: () => string | null };
}
export function fauxPort(): FauxPort {
  const f: FauxPort = {
    pub: [], prive: [], lire: 0, envoyes: [],
    total: () => f.pub.length + f.prive.length + f.lire + f.envoyes.length,
    reponses: { pub: () => OK, prive: () => OK, envoyer: () => OK, texte: () => null },
    port: {
      repondreCommentaire: async (p) => (f.pub.push({ texte: p.texte, cle: p.cle, idPost: p.idPost }), f.reponses.pub()),
      repondreEnPrive: async (p) => (f.prive.push({ texte: p.texte }), f.reponses.prive()),
      lireMessage: async () => (f.lire++, { texte: f.reponses.texte(), postback: null }),
      envoyerMessage: async (p) => (f.envoyes.push({ texte: p.texte, cle: p.cle }), f.reponses.envoyer()),
    },
  };
  return f;
}

export interface FauxSite {
  vus: RequeteSignee[];
  reponses: () => { statut: number; corps?: unknown };
  transport: (r: RequeteSignee) => Promise<{ statut: number; corps?: unknown }>;
}
export function fauxSite(): FauxSite {
  const s: FauxSite = { vus: [], reponses: () => ({ statut: 200, corps: {} }), transport: async (r) => (s.vus.push(r), s.reponses()) };
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
