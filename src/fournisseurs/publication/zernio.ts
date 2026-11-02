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
import { analyserCible, compteLinkedinEstProfil, corpsPostZernio, lireCreateurTiktok, mediasDemandes, plateformeZernio, premierCommentaireTransmissibleZernio, type CreateurTiktok, type DemandeZernio } from "./zernio-corps";
import { ErreurZernio } from "./zernio-erreurs";
import { pageInterdite, type PagesInterdites } from "./zernio-pages-interdites";
import { lecteurMediaParDefaut, televerserMedias, type LecteurMedia } from "./zernio-medias";

const HEX_64 = /^[0-9a-f]{64}$/;

export interface OptionsPublicationZernio {
  /** Client déjà construit (tests) ; sinon créé avec la clé et `client`. */
  clientPret?: ClientZernio;
  client?: Partial<OptionsClientZernio>;
  lire?: LecteurMedia;
  maintenant?: () => number;
  /** Pages Facebook jamais ciblées (tests) ; sinon la liste du dépôt. */
  pagesInterdites?: PagesInterdites;
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

/**
 * Clé neutre en hexadécimal : celle du service si elle l'est, sinon dérivée de `cleEnvoi` (identifiant stable de l'envoi).
 * Sans `cleEnvoi` : refus. `fichierCle` est une adresse signée qui change à chaque signature : jamais une base de clé.
 */
function cleHex(d: DemandePublication): string {
  if (!d.cleEnvoi?.trim()) throw new ErreurZernio("refuse", "Cet envoi n'a pas d'empreinte (clé d'envoi) : rien n'a été envoyé.");
  if (HEX_64.test(d.cleEnvoi)) return d.cleEnvoi;
  return cleEnvoiPublication(d.cleEnvoi, d.reseau, d.date, d.cible ?? d.canalId ?? null);
}

// En-tête x-request-id : ce fournisseur n'en pose AUCUN aujourd'hui. Si un jour il en pose un, la valeur doit d'abord
// passer par `motsInterditsEnvoi` (zernio-filtre) avant d'être transmise au client.
export function creerPublicationZernio(cle: string, options: OptionsPublicationZernio = {}): FournisseurPublication {
  const client = options.clientPret ?? creerClientZernio({ cle, ...options.client });
  const lire = options.lire ?? lecteurMediaParDefaut;
  const maintenant = () => options.maintenant?.() ?? Date.now();

  async function retrouver(studioCle: string): Promise<PostZernio | undefined> {
    // Limite connue : seuls les 50 derniers posts sont lus (le client ne filtre pas par compte ni par date). Un envoi
    // plus ancien que ces 50 posts resterait « à vérifier » : jamais de renvoi automatique dans ce cas.
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

    async envoyer(demande: DemandeZernio) {
      const hex = cleHex(demande);
      const d: DemandeZernio = { ...demande, cleEnvoi: hex };
      const instant = maintenant();
      const cible = analyserCible(d.cible ?? d.canalId);
      // 1. Tout refus pur, avant le réseau (TikTok : réglages fictifs prudents, remplacés par les vrais ensuite).
      const niveau = d.niveauConfidentialiteTiktok ?? "";
      const prudent: CreateurTiktok = { privacyLevels: [niveau], allowComment: false, allowDuet: false, allowStitch: false };
      corpsPostZernio(d, { maintenant: instant, createurTiktok: prudent, profilLinkedinProuve: true });
      // LinkedIn profil : prouvé par la lecture du compte (jamais présumé).
      const profilLinkedinProuve = cible.profilLinkedin ? compteLinkedinEstProfil((await client.listerComptes()).find((c) => c._id === cible.accountId)) : false;
      const demandes = mediasDemandes(d);
      // 2. Réglages du créateur TikTok, puis médias.
      const createurTiktok = plateformeZernio(d.reseau) === "tiktok" ? lireCreateurTiktok(await client.infoCreateurTiktok(cible.accountId)) : undefined;
      const hotesPublics = new Set<string>();
      const medias = await televerserMedias(client, lire, demandes, hotesPublics);
      const corps = corpsPostZernio(d, { maintenant: instant, createurTiktok, medias, hotesPublics, profilLinkedinProuve });
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
        if (e instanceof ErreurZernio && e.code === "doublon" && e.existingPostId) {
          // Le doublon est jugé par compte : le post d'origine peut être celui d'une autre page. On relit et on compare la clé.
          let origine: PostZernio | undefined;
          try {
            origine = await client.lirePost(e.existingPostId);
          } catch {
            origine = undefined;
          }
          if (origine?.metadata?.studioCle === hex) return { idExterne: origine._id, via: "zernio" as const, statut: statutDepuisZernio(origine.status) === "brouillon" ? ("brouillon" as const) : ("programmee" as const), ...commentaire(d) };
          // Clé différente ou post illisible : pas de conclusion « envoyé », l'envoi reste à vérifier (identifiant non transmis).
          throw new ErreurZernio("doublon", e.message, { statut: e.statut, detailTechnique: e.detailTechnique });
        }
        throw e;
      }
      if (resultat.issue !== "ok") {
        // Écriture réussie (2xx) : le post existe chez Zernio. Jamais un refus net : l'envoi reste « à vérifier ».
        throw new ErreurZernio("creation-incomplete", "Zernio n'a pas pu créer cette publication : vérifiez le compte et le contenu.", {
          statut: 200,
          detailTechnique: resultat.echecs.map((x) => `${x.platform}: ${x.errorCategory ?? "?"}`).join("; "),
        });
      }
      return { idExterne: resultat.post._id, via: "zernio" as const, statut: corps.isDraft ? ("brouillon" as const) : ("programmee" as const), ...commentaire(d) };
    },

    async listerCanaux() {
      const canaux: CanalPublication[] = [];
      // Facebook : deux comptes peuvent exposer les MÊMES pages. Un seul canal par page (identifiant de page), tenu par le compte
      // dont la page PAR DÉFAUT est cette page. Sans tel compte, tous les canaux de cette page restent : la cible est alors refusée (jamais tirée au hasard).
      const facebook = new Map<string, { base: CanalPublication; page: { id: string; name?: string; parDefaut?: boolean }; compte: string }[]>();
      for (const c of await client.listerComptes()) {
        const base: CanalPublication = { id: c._id, organisationId: "zernio", nom: c.displayName ?? c.username ?? "Compte", service: c.platform, deconnecte: c.isActive === false };
        if (c.platform === "facebook") {
          for (const p of await client.pagesFacebook(c._id)) {
            if (pageInterdite(p.id, p.name, options.pagesInterdites)) continue;
            const l = facebook.get(p.id) ?? [];
            l.push({ base, page: p, compte: c._id });
            facebook.set(p.id, l);
          }
        } else if (c.platform === "linkedin") {
          // Pas de canal « profil » implicite : le profil n'est proposé que si le compte lu est un profil personnel.
          if (compteLinkedinEstProfil(c)) canaux.push({ ...base, id: `${c._id}:li:profil`, genre: "profile" });
          for (const o of await client.organisationsLinkedin(c._id)) canaux.push({ ...base, id: `${c._id}:li:${o.id}`, nom: o.localizedName ?? o.name ?? base.nom, genre: "page" });
        } else canaux.push(base);
      }
      for (const [idPage, l] of facebook) {
        const dePage = l.filter((x) => x.page.parDefaut);
        const retenus = l.length > 1 && dePage.length === 1 ? dePage : l;
        for (const x of retenus) canaux.push({ ...x.base, id: `${x.compte}:fb:${idPage}`, nom: x.page.name ?? x.base.nom, genre: "page" });
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
