/**
 * VISAGE HEYGEN — contrat `FournisseurVisage` (lot B1 : Looks ; lot R7 : doubles du compte et rendus).
 *
 * ÉTEINT : inscrit par `visagesHeygen()` seulement si `HEYGEN_API_KEY` ET `FOURNISSEUR_VISAGE=heygen`. Les appels
 * PAYANTS (création d'un double, d'un look, d'un rendu) ne sont faits que par les services qui ont d'abord annoncé le
 * prix et réservé le crédit (`verifierEtReserver`), toujours avec un `Idempotency-Key`.
 *  - `creerDouble` : refus clair — Will crée son double DANS L'APPLICATION HEYGEN (décision du 03/10) ;
 *  - `listerDoubles` : les doubles du compte (`GET /v3/avatars/looks`, privés, digital_twin), gratuit ;
 *  - `suivre` : `GET /v3/avatars/looks/{id}` (gratuit) ;
 *  - `rendre` : `POST /v3/videos` Avatar V, webm 1080p 9:16 contain, sur l'audio fourni (`audioUrl`, ou `audioCle`
 *    signée 24 h par le stockage) ; crochet « réveil » si `HEYGEN_WEBHOOK_SECRET` existe ;
 *  - `suivreRendu` : `GET /v3/videos/{id}` (gratuit) ;
 *  - `recuperer` : le webm est COPIÉ en flux de HeyGen vers le stockage avec les gardes de `telechargement.ts`
 *    (hôtes HeyGen seulement, redirections revalidées, taille annoncée et plafonnée, jamais en mémoire) ;
 *  - `tester`, `noterQualite` : Will essaie et juge son double dans l'application HeyGen ;
 *  - `retrouverRendu` : `GET /v3/videos?title=` (gratuit) — reprise après panne sans second envoi payant (lot R7e) ;
 *  - `listerLooks`, `garderApercuLook` (correcteur réel 2, 04/10) : les looks du compte (Will dans un décor fait DANS
 *    l'application HeyGen), lus GRATUITEMENT pour être reliés à un décor ; l'image d'aperçu est copiée chez nous avec
 *    les mêmes gardes que le webm. Un rendu « decor-du-look » est un mp4 AVEC le fond du look (ni détourage, ni uni) ;
 *  - `creerLook` (`POST /v3/avatars`, payant) : TOUJOURS refusé SANS APPEL (`LOOKS_HEYGEN_PAR_LE_STUDIO`, constante
 *    séparée du réglage du rendu) — les décors réalistes se font dans l'application HeyGen (relecture exactitude
 *    `3042b94`, n° 2).
 * LOT R7e : `rendre` n'envoie RIEN tant que Will n'a pas allumé « Votre avatar parle dans le studio » (Réglages ›
 * Connexions › Double) : le réglage est relu juste avant chaque envoi (`renduAllume`), éteint par défaut.
 */
import { createHash } from "node:crypto";
import type { FournisseurVisage, StockageFichiers } from "../types";
import { ErreurHeygen, type ClientHeygen } from "./client";
import { adresseRappelHeygen } from "./crochet";
import { listerDoublesDuCompte } from "./doubles";
import { creerLooksHeygen, lookExistantDepuis, statutLook } from "./looks";
import { copierEnFlux, type Resoudre } from "./telechargement";
import { CENTIMES_USD_PAR_SECONDE_AVATAR_V, creerRendusHeygen, DECORS_DANS_HEYGEN, etatRendu, FOND_UNI_AVATAR, LOOKS_HEYGEN_PAR_LE_STUDIO, MESSAGE_SANS_FOND_IMPOSSIBLE } from "./rendus";
import { centimes } from "@/lib/montants";

/** Clé d'idempotence d'une demande de look : même look de base + même consigne = même clé (24 h chez HeyGen). */
export function cleIdempotenceDemande(visageId: string, prompt: string, images: string[] = []): string {
  return "look-" + createHash("sha256").update(`${visageId}\n${prompt}\n${images.join("\n")}`).digest("hex").slice(0, 40);
}

const refus = (message: string) => new ErreurHeygen({ code: "refuse", reessayable: false, message });

export interface DependancesVisageHeygen {
  /** Stockage des fichiers (R2) : signer l'audio, déposer le webm rendu. */
  stockage?: () => Promise<StockageFichiers>;
  /** Copie du webm (tests : doublée). */
  fetch?: typeof fetch;
  /** Résolution DNS de l'hôte du webm (tests : doublée). */
  resoudre?: Resoudre;
  environnement?: Record<string, string | undefined>;
  /**
   * Lot R7e : lit le réglage de Will « Votre avatar parle dans le studio » (inscription : `services/rendu-double.ts`).
   * Absent : éteint. Relu avant CHAQUE envoi payant.
   */
  renduAllume?: () => Promise<boolean>;
  /** Tests seulement : force la réponse du réglage (sinon `renduAllume`, sinon éteint). */
  renduAvatarAutorise?: boolean;
  /** Tests seulement : force l'autorisation de `creerLook` (sinon `looksAllumes`, sinon `LOOKS_HEYGEN_PAR_LE_STUDIO`). */
  looksAutorises?: boolean;
  /**
   * Correcteur réel 2 (F1) : lit le réglage de Will « Créer vos décors avec HeyGen » (éteint par défaut). Relu avant
   * CHAQUE création payante. Absent : `LOOKS_HEYGEN_PAR_LE_STUDIO` (éteint).
   */
  looksAllumes?: () => Promise<boolean>;
}

/** Message quand le réglage du rendu est éteint (phrase simple). */
export const MESSAGE_RENDU_ETEINT = "Votre avatar ne parle pas dans le studio : allumez-le dans Réglages, Connexions, Double, ou faites la vidéo dans l'application HeyGen.";

/** Erreur « l'avatar ne sait pas être rendu sans fond » : le moteur passe alors au fond uni (si rien n'est encore parti). */
export class ErreurSansFond extends ErreurHeygen {
  readonly sansFondImpossible = true;
  constructor() {
    super({ code: "refuse", reessayable: false, message: MESSAGE_SANS_FOND_IMPOSSIBLE });
  }
}

export function creerFournisseurVisageHeygen(client: ClientHeygen, deps: DependancesVisageHeygen = {}): FournisseurVisage {
  const renduAllume = async () => deps.renduAvatarAutorise ?? (deps.renduAllume ? (await deps.renduAllume()) === true : false);
  const looks = creerLooksHeygen(client);
  const rendus = creerRendusHeygen(client);
  const env = () => deps.environnement ?? process.env;
  const stockage = async () => {
    if (!deps.stockage) throw refus("Le stockage des fichiers n'est pas relié : le double ne peut pas être rendu.");
    return deps.stockage();
  };
  return {
    id: "heygen",
    type: "visage",
    nom: "Double HeyGen",
    reelPrevu: "HeyGen",
    mode: "reel",
    capacites: {
      asynchrone: true,
      accordExige: true,
      resolutionMax: 1080,
      fondTransparent: true,
      tarif: { unite: "seconde", prixUnitaire: centimes(CENTIMES_USD_PAR_SECONDE_AVATAR_V * 0.9) },
      tarifUsd: { unite: "seconde", centimesUsd: CENTIMES_USD_PAR_SECONDE_AVATAR_V },
    },
    async creerDouble() {
      throw refus("Votre double se crée dans l'application HeyGen : la console l'utilise ensuite (Personnages › Choisir mon double HeyGen).");
    },
    async listerDoubles() {
      return listerDoublesDuCompte(client);
    },
    async suivre(idExterne) {
      const s = statutLook(await looks.lire(idExterne));
      return { statut: s.statut, progression: s.progression };
    },
    async tester() {
      throw refus("Essayez votre double dans l'application HeyGen.");
    },
    async noterQualite() {
      throw refus("Votre double se juge dans l'application HeyGen.");
    },
    async rendre(demande) {
      // GARDE-FOU (lot R7e) : réglage de Will relu avant chaque envoi ; éteint = aucun appel, rien de payé.
      if (!(await renduAllume())) throw refus(MESSAGE_RENDU_ETEINT);
      let audioUrl = demande.audioUrl;
      if (!audioUrl) {
        const s = await stockage();
        audioUrl = s.urlLectureDuree ? await s.urlLectureDuree(demande.audioCle, 24 * 3600) : "";
      }
      if (!audioUrl || !/^https:\/\//.test(audioUrl)) throw refus("Le son de la vidéo n'est pas lisible par HeyGen (stockage non relié).");
      const avecSonFond = demande.fond === "decor-du-look";
      const fondUni = demande.fond === "uni" ? (demande.couleurFond && /^#[0-9a-f]{6}$/i.test(demande.couleurFond) ? demande.couleurFond : FOND_UNI_AVATAR) : undefined;
      const callbackUrl = demande.callbackId ? adresseRappelHeygen(env(), demande.callbackId) : undefined;
      try {
        const r = await rendus.creer({ lookId: demande.visageId, audioUrl, titre: demande.titre ?? "Studio Axion", motionPrompt: demande.motionPrompt, callbackUrl, callbackId: callbackUrl ? demande.callbackId : undefined, cleIdempotence: demande.cleIdempotence, fondUni, ...(avecSonFond ? { avecSonFond: true } : {}), ...(demande.referenceLookId ? { referenceLookId: demande.referenceLookId } : {}) });
        return { idTravailExterne: r.videoId };
      } catch (e) {
        // Avatar entraîné sans détourage : la demande webm est REFUSÉE par HeyGen (rien n'est rendu).
        if (!fondUni && !avecSonFond && e instanceof ErreurHeygen && e.code === "refuse" && e.sansFondImpossible) throw new ErreurSansFond();
        throw e;
      }
    },
    async retrouverRendu(titre, options) {
      const v = await rendus.retrouver(titre, options);
      return v ? { idTravailExterne: v.videoId } : null;
    },
    async suivreRendu(idTravailExterne) {
      return etatRendu(await rendus.lire(idTravailExterne));
    },
    async recuperer(idTravailExterne, options) {
      const v = await rendus.lire(idTravailExterne);
      if (v.status !== "completed" || !v.video_url) throw new ErreurHeygen({ code: "indisponible", reessayable: true, message: "Le rendu HeyGen n'est pas encore prêt." });
      const s = await stockage();
      // Repli « fond uni » et décor du look : mp4 ; sinon webm transparent.
      const [nom, mime] = options?.fond === "uni" || options?.fond === "decor-du-look" ? ["double.mp4", "video/mp4"] : ["double.webm", "video/webm"];
      const { cleStockage } = await s.preparerDepot({ fichierId: `rendu-${idTravailExterne}`.replace(/[^A-Za-z0-9_-]/g, "-"), nom, mime, taille: 0, typeEntite: "visage", entiteId: "heygen" });
      const depot = s.urlDepotDuree ? await s.urlDepotDuree(cleStockage, 3600, mime) : "";
      if (!/^https?:\/\//.test(depot)) throw refus("Le stockage des fichiers n'est pas relié : le rendu ne peut pas être gardé.");
      await copierEnFlux(v.video_url, depot, mime, { appeler: deps.fetch, resoudre: deps.resoudre });
      return { videoCle: cleStockage, dureeSec: Number(v.duration) || 0 };
    },
    async listerLooks() {
      return (await looks.listerPrives()).filter((l) => l?.id).map(lookExistantDepuis);
    },
    async garderApercuLook(idExterne) {
      const look = lookExistantDepuis(await looks.lire(idExterne));
      if (!look.apercuUrl) return { look };
      const s = await stockage();
      const ext = /\.(webp|png)(?:[?#]|$)/i.exec(look.apercuUrl)?.[1]?.toLowerCase();
      const [nom, mime] = ext === "webp" ? ["apercu-look.webp", "image/webp"] : ext === "png" ? ["apercu-look.png", "image/png"] : ["apercu-look.jpg", "image/jpeg"];
      const { cleStockage } = await s.preparerDepot({ fichierId: `apercu-look-${idExterne}`.replace(/[^A-Za-z0-9_-]/g, "-"), nom, mime, taille: 0, typeEntite: "visage", entiteId: "heygen" });
      const depot = s.urlDepotDuree ? await s.urlDepotDuree(cleStockage, 3600, mime) : "";
      if (!/^https?:\/\//.test(depot)) return { look };
      // Mêmes gardes que le webm (hôtes HeyGen, redirections revalidées, taille annoncée), plafond d'une image : 20 Mo.
      await copierEnFlux(look.apercuUrl, depot, mime, { appeler: deps.fetch, resoudre: deps.resoudre, plafond: 20 * 1024 * 1024 });
      return { look, apercuCle: cleStockage, mime };
    },
    async creerLook(demande) {
      // GARDE-FOU (F1) : réglage de Will relu avant chaque création ; éteint (défaut) = aucun appel, rien de payé.
      const autorise = deps.looksAutorises ?? (deps.looksAllumes ? (await deps.looksAllumes()) === true : LOOKS_HEYGEN_PAR_LE_STUDIO);
      if (!autorise) throw refus(DECORS_DANS_HEYGEN);
      const images = demande.imagesReference ?? [];
      // Le look est rangé dans le GROUPE de l'avatar de Will (lu sur son look filmé, gratuit).
      const base = await looks.lire(demande.visageId).catch(() => null);
      const l = await looks.creer({
        lookBaseId: demande.visageId,
        ...(base?.group_id ? { groupeId: base.group_id } : {}),
        nom: `Décor · ${demande.prompt.slice(0, 60)}`,
        consigne: demande.prompt,
        imagesReference: images,
        cleIdempotence: cleIdempotenceDemande(demande.visageId, demande.prompt, images),
      });
      return { idExterne: l.id, statut: statutLook(l).statut };
    },
  };
}
