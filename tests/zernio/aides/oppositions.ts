/** Aides des tests de la transmission des « stop » au site (lot 5d). Données 100 % fictives (example.test) ; port et site FAUX. */
import { signatureValide } from "@/fournisseurs/site/signature";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import type { MessageLu } from "@/fournisseurs/zernio-inbox";
import { SchemaOppositionReseau } from "./contrat-site-guides-reseau";
import { COMPTE, ENV, T0, cleConversation, type FauxPort } from "./conversation";

export const CHEMIN_OPP = "/api/interne/oppositions-reseau";
export const CHEMIN_GUIDE = "/api/interne/demandes-guide-reseau";
export const MIN = 60_000;
export const H = 3600_000;

/** Site factice à deux routes ; les statuts de la route des oppositions sont lus dans `opposition()` (0 = site injoignable). */
export interface SiteDouble {
  vus: RequeteSignee[];
  opp: () => RequeteSignee[];
  guide: () => RequeteSignee[];
  reponseOpp: () => number;
  reponseGuide: () => { statut: number; corps?: unknown };
  /** Corps valides selon la copie du schéma strict du site, signatures vérifiées avec le secret fictif. */
  invalides: string[];
  transport: (r: RequeteSignee) => Promise<{ statut: number; corps: unknown }>;
}
export function siteDouble(): SiteDouble {
  const s: SiteDouble = {
    vus: [],
    invalides: [],
    opp: () => s.vus.filter((r) => r.chemin === CHEMIN_OPP),
    guide: () => s.vus.filter((r) => r.chemin === CHEMIN_GUIDE),
    reponseOpp: () => 200,
    reponseGuide: () => ({ statut: 200, corps: {} }),
    transport: async (r) => {
      s.vus.push(r);
      if (r.chemin === CHEMIN_OPP) {
        const h = r.entetes;
        const ok = signatureValide(ENV.SITE_GUIDES_RESEAU_SECRET, { methode: r.methode, chemin: r.chemin, corps: r.corps, horodatage: h["x-axion-horodatage"], nonce: h["x-axion-nonce"], signature: h["x-axion-signature"] });
        let valide = false;
        try {
          valide = ok && SchemaOppositionReseau.safeParse(JSON.parse(r.corps)).success;
        } catch {
          valide = false;
        }
        if (!valide) s.invalides.push(r.corps);
        const statut = s.reponseOpp();
        if (statut === 0) throw new Error("injoignable");
        return { statut, corps: {} };
      }
      return { corps: {}, ...s.reponseGuide() };
    },
  };
  return s;
}

/** Remplace la lecture du port : le texte dépend de l'identifiant du message (table), ou `defaut` ; `surLecture` s'exécute après chaque lecture. */
export function lectureParMessage(fp: FauxPort, table: Record<string, string | MessageLu>, o: { surLecture?: (idMessage: string) => Promise<void> | void; exception?: () => boolean } = {}): void {
  fp.port.lireMessage = async (p) => {
    fp.lire++;
    if (o.exception?.()) throw new Error("panne zernio fictive");
    const v = table[p.idMessage];
    const lu: MessageLu = v === undefined ? { texte: null, postback: null, introuvable: true } : typeof v === "string" ? { texte: v, postback: null } : v;
    await o.surLecture?.(p.idMessage);
    return lu;
  };
}

export const graineConv = (etat: string, extra: Record<string, unknown> = {}) => ({
  etat, reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 5 * H).toISOString(), m1Le: new Date(T0 - 4 * H).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
});

export { cleConversation };
