/**
 * GARDE DES APPELS PAYANTS (lot J). PUR : la décision est injectée, la garde ne fait que l'appliquer.
 *
 * Une option payante ne part JAMAIS sans confirmation valide. Le contrôle est fait au moment de l'appel au
 * fournisseur réel (pas seulement à l'écran) : les fabriques `fournisseurHiggsfield` et `choisirFournisseurMulticamera`
 * enveloppent le client réel avec cette garde. Sans garde fournie, c'est `GARDE_REFUS` : tout appel payant est refusé.
 *
 * Une passe (Décor IA d'une vidéo, angles d'une vidéo) fait plusieurs appels payants : la confirmation est consommée
 * au PREMIER, et la réponse vaut pour les suivants de la même passe (même enveloppe). Une autre passe, une autre
 * version : une nouvelle confirmation est nécessaire.
 */
import type { FournisseurMulticamera } from "@/fournisseurs/multicamera";
import type { FournisseurHiggsfield } from "@/fournisseurs/higgsfield/types";
import type { IdOptionPayante } from "./types";

export interface GardeOptionPayante {
  optionId: IdOptionPayante;
  /** Vrai seulement si une confirmation valide existe (et le plafond le permet) ; la consomme. */
  autoriser(): Promise<boolean>;
}

export const MESSAGE_NON_CONFIRMEE = "Option payante non confirmée : rien n'est dépensé, la version gratuite sort.";

export class ErreurOptionNonConfirmee extends Error {
  constructor(readonly optionId: IdOptionPayante | "inconnue") {
    super(MESSAGE_NON_CONFIRMEE);
    this.name = "ErreurOptionNonConfirmee";
  }
}

/** La garde par défaut d'un client réel : refuse tout. */
export function gardeRefus(optionId: IdOptionPayante): GardeOptionPayante {
  return { optionId, autoriser: async () => false };
}

/** Consomme la confirmation une seule fois par enveloppe ; une erreur vaut refus. */
export function autorisationUnique(garde: GardeOptionPayante | undefined): () => Promise<boolean> {
  let decision: Promise<boolean> | null = null;
  return () => (decision ??= garde ? garde.autoriser().then((ok) => ok === true, () => false) : Promise.resolve(false));
}

/** Client Higgsfield réel gardé : `lancer` (le seul appel qui débite des crédits) exige la confirmation. */
export function garderHiggsfield(f: FournisseurHiggsfield, garde: GardeOptionPayante | undefined): FournisseurHiggsfield {
  if (f.mode !== "reel") return f;
  const autorise = autorisationUnique(garde);
  return {
    ...f,
    lireSolde: () => f.lireSolde(),
    envoyerMedia: (m) => f.envoyerMedia(m),
    suivre: (id) => f.suivre(id),
    telecharger: (url) => f.telecharger(url),
    async lancer(demande) {
      if (!(await autorise())) return { ok: false, erreur: { code: "refuse", reessayable: false, message: MESSAGE_NON_CONFIRMEE } };
      return f.lancer(demande);
    },
  };
}

/** Fournisseur multicaméra réel gardé : créer un look et rendre un angle (HeyGen) exigent la confirmation. */
export function garderMulticamera<F extends FournisseurMulticamera>(f: F, garde: GardeOptionPayante | undefined): F {
  if (f.mode !== "reel") return f;
  const autorise = autorisationUnique(garde);
  const exiger = async () => {
    if (!(await autorise())) throw new ErreurOptionNonConfirmee(garde?.optionId ?? "inconnue");
  };
  return {
    ...f,
    async preparerLook(d) {
      await exiger();
      return f.preparerLook(d);
    },
    async rendreAngle(d) {
      await exiger();
      return f.rendreAngle(d);
    },
  };
}
