/**
 * PUBLICATION RÉELLE PAR ZERNIO (z1p). Fournisseur « zernio » du registre ; s'appuie sur le client à liste fermée (z1c).
 *
 * - Brouillon d'abord (`isDraft: true`) ; la promotion en « programmé » est faite plus tard par le client (D5).
 *   Jamais `publishNow`, jamais `facebookSettings.draft` ni `tiktokSettings.draft`.
 * - Clé d'idempotence neutre (D4) : `Idempotency-Key: studio-<hex>`. Après une erreur 5xx ou un délai dépassé : la
 *   liste des posts est LUE (retrouver `metadata.studioCle`) avant toute conclusion ; jamais de renvoi à l'aveugle.
 * - Sans clé : le fournisseur n'est pas inscrit (voir `inscription.ts`), la simulation reste.
 */
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import type { StatutPublication } from "@/domaine/types";
import type { CanalPublication, DemandePublication, EtatPublicationExterne, FournisseurPublication } from "../types";
import { creerClientZernio, enteteIdempotenceStudio, type ClientZernio, type OptionsClientZernio, type PostZernio } from "./zernio-client";
import { analyserCible, corpsPostZernio, lireCreateurTiktok, mediasDemandes, plateformeZernio, premierCommentaireTransmissibleZernio, type CreateurTiktok } from "./zernio-corps";
import { ErreurZernio } from "./zernio-erreurs";
import { lecteurMediaParDefaut, televerserMedias, type LecteurMedia } from "./zernio-medias";

const HEX_64 = /^[0-9a-f]{64}$/;

export interface OptionsPublicationZernio {
  /** Client déjà construit (tests) ; sinon créé avec la clé et `client`. */
  clientPret?: ClientZernio;
  client?: Partial<OptionsClientZernio>;
  lire?: LecteurMedia;
  maintenant?: () => number;
}

/** Statut Studio d'un statut Zernio. */
export function statutDepuisZernio(statut: string | undefined): StatutPublication {
  switch ((statut ?? "").toLowerCase()) {
    case "published":
      return "publiee";
    case "scheduled":
    case "publishing":
      return "programmee";
    case "failed":
    case "partial":
    case "cancelled":
      return "echec";
    default:
      return "brouillon";
  }
}

function etatDepuisPost(p: PostZernio): EtatPublicationExterne {
  const cible = p.platforms[0];
  const accountId = cible ? (typeof cible.accountId === "string" ? cible.accountId : cible.accountId?._id) : undefined;
  return {
    idExterne: p._id,
    canalId: accountId,
    statut: statutDepuisZernio(p.status),
    date: p.scheduledFor,
    envoyeeLe: typeof cible?.publishedAt === "string" ? cible.publishedAt : undefined,
    lien: cible?.platformPostUrl || undefined,
    erreur: cible?.errorMessage,
    texte: p.content,
    creeeLe: typeof p.createdAt === "string" ? p.createdAt : undefined,
  };
}

/** Clé neutre en hexadécimal : celle du service si elle l'est, sinon dérivée de la demande. */
function cleHex(d: DemandePublication): string {
  if (d.cleEnvoi && HEX_64.test(d.cleEnvoi)) return d.cleEnvoi;
  return cleEnvoiPublication(d.cleEnvoi ?? d.fichierCle, d.reseau, d.date, d.cible ?? d.canalId ?? null);
}

export function creerPublicationZernio(cle: string, options: OptionsPublicationZernio = {}): FournisseurPublication {
  const client = options.clientPret ?? creerClientZernio({ cle, ...options.client });
  const lire = options.lire ?? lecteurMediaParDefaut;
  const maintenant = () => options.maintenant?.() ?? Date.now();

  async function retrouver(studioCle: string): Promise<PostZernio | undefined> {
    const posts = await client.listerPosts({ limit: 50 });
    return posts.find((p) => p.metadata?.studioCle === studioCle);
  }

  return {
    id: "zernio",
    type: "publication",
    nom: "Publication (Zernio)",
    reelPrevu: "Zernio",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },

    async envoyer(demande) {
      const hex = cleHex(demande);
      const d: DemandePublication = { ...demande, cleEnvoi: hex };
      const instant = maintenant();
      const cible = analyserCible(d.cible ?? d.canalId);
      // 1. Tout refus pur, avant le réseau (TikTok : réglages fictifs prudents, remplacés par les vrais ensuite).
      const prudent: CreateurTiktok = { privacyLevels: ["SELF_ONLY"], allowComment: false, allowDuet: false, allowStitch: false };
      corpsPostZernio(d, { maintenant: instant, createurTiktok: prudent });
      const demandes = mediasDemandes(d);
      // 2. Réglages du créateur TikTok, puis médias.
      const createurTiktok = plateformeZernio(d.reseau) === "tiktok" ? lireCreateurTiktok(await client.infoCreateurTiktok(cible.accountId)) : undefined;
      const hotesPublics = new Set<string>();
      const medias = await televerserMedias(client, lire, demandes, hotesPublics);
      const corps = corpsPostZernio(d, { maintenant: instant, createurTiktok, medias, hotesPublics });
      // 3. Création, clé d'idempotence neutre.
      let resultat;
      try {
        resultat = await client.creerPost(corps, enteteIdempotenceStudio(hex));
      } catch (e) {
        if (e instanceof ErreurZernio && e.code === "a-verifier") {
          // État inconnu : lire d'abord. Trouvé = envoi réussi ; sinon l'envoi reste « à vérifier » (aucun renvoi automatique).
          const trouve = await retrouver(hex);
          if (trouve) return { idExterne: trouve._id, via: "zernio" as const, statut: statutDepuisZernio(trouve.status) === "brouillon" ? ("brouillon" as const) : ("programmee" as const), ...commentaire(d) };
        }
        throw e;
      }
      if (resultat.issue !== "ok") {
        throw new ErreurZernio("refuse", "Zernio n'a pas pu créer cette publication : vérifiez le compte et le contenu.", {
          detailTechnique: resultat.echecs.map((x) => `${x.platform}: ${x.errorCategory ?? "?"}`).join("; "),
        });
      }
      return { idExterne: resultat.post._id, via: "zernio" as const, statut: corps.isDraft ? ("brouillon" as const) : ("programmee" as const), ...commentaire(d) };
    },

    async listerCanaux() {
      const canaux: CanalPublication[] = [];
      for (const c of await client.listerComptes()) {
        const base: CanalPublication = { id: c._id, organisationId: "zernio", nom: c.displayName ?? c.username ?? "Compte", service: c.platform, deconnecte: c.isActive === false };
        if (c.platform === "facebook") {
          for (const p of await client.pagesFacebook(c._id)) canaux.push({ ...base, id: `${c._id}:fb:${p.id}`, nom: p.name ?? base.nom, genre: "page" });
        } else if (c.platform === "linkedin") {
          canaux.push({ ...base, genre: "profile" });
          for (const o of await client.organisationsLinkedin(c._id)) canaux.push({ ...base, id: `${c._id}:li:${o.id}`, nom: o.localizedName ?? o.name ?? base.nom, genre: "page" });
        } else canaux.push(base);
      }
      return canaux;
    },

    async lireEtat(idExterne) {
      return etatDepuisPost(await client.lirePost(idExterne));
    },

    async publicationsRecentes({ canalId, depuis }) {
      const compte = canalId.split(":")[0];
      const posts = await client.listerPosts({ limit: 50 });
      return posts.map(etatDepuisPost).filter((e) => e.canalId === compte && (!e.creeeLe || e.creeeLe >= depuis));
    },
  };
}

function commentaire(d: DemandePublication): { premierCommentaire?: "transmis" | "a-la-main" } {
  if (!d.premierCommentaire?.trim()) return {};
  return { premierCommentaire: premierCommentaireTransmissibleZernio(d.reseau) ? "transmis" : "a-la-main" };
}
