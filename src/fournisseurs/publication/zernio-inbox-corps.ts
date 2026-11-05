/**
 * Validation des corps « inbox » Zernio (liste fermée, 4 routes). PUR : aucun réseau.
 *
 * - texte : issu du dictionnaire v2 uniquement (`TEXTES_MP`, valeurs de marqueurs bornées) ; aucun texte libre ;
 * - accountId : dans la liste fermée fournie à l'appel ;
 * - boutons : postback seulement, 3 au plus, titre et charge bornés.
 * Chaque refus lève `ErreurZernio("chemin-refuse")` AVANT le réseau, sans recopier le texte refusé.
 */
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import { ErreurZernio } from "./zernio-erreurs";

export type RouteInboxZernio = "repondre-commentaire" | "reponse-privee" | "lire-messages" | "envoyer-message";

/** Un segment d'identifiant : lettres, chiffres, `_`, `-` seulement. */
export const SEGMENT_ID = "[A-Za-z0-9_-]{1,128}";

/** Format dédié de l'Idempotency-Key inbox : `inbox-<sha256 hex>`. */
export const IDEMPOTENCE_INBOX = /^inbox-[0-9a-f]{64}$/;

export const BOUTONS_MAX = 3;
export const BOUTON_TITRE_MAX = 20;
const BOUTON_PAYLOAD = /^[A-Za-z0-9_:-]{1,64}$/;

const refus = (message: string) => new ErreurZernio("chemin-refuse", `${message} Rien n'a été envoyé.`);
const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Valeurs permises à la place des marqueurs du dictionnaire (bornées, une seule ligne). */
const VALEUR_MARQUEUR: Record<string, string> = {
  "[MOT]": "[^\\n\\r\\[\\]]{1,60}",
  "[TITRE DU GUIDE]": "[^\\n\\r\\[\\]]{1,200}",
  "[LIEN]": "https://[^\\s\\[\\]]{1,300}",
};

function motif(texte: string): RegExp {
  let source = "";
  for (const morceau of texte.split(/(\[MOT\]|\[TITRE DU GUIDE\]|\[LIEN\])/)) {
    source += VALEUR_MARQUEUR[morceau] ?? echapper(morceau);
  }
  return new RegExp(`^${source}$`);
}

const MOTIFS = Object.entries(TEXTES_MP).map(([id, t]) => ({ id, publique: id.startsWith("mp-pub-"), re: motif(t.texte) }));

/** Texte conforme à un modèle du dictionnaire v2 du bon côté (public / privé) ? */
export function texteDuDictionnaire(texte: unknown, publique: boolean): texte is string {
  return typeof texte === "string" && texte.length <= 2000 && MOTIFS.some((m) => m.publique === publique && m.re.test(texte));
}

function exigerCompte(accountId: unknown, comptes: readonly string[] | undefined): void {
  if (!comptes || comptes.length === 0) throw refus("Inbox : liste fermée de comptes absente.");
  if (typeof accountId !== "string" || !comptes.includes(accountId)) throw refus("Inbox : compte hors de la liste fermée.");
}

function exigerCles(corps: Record<string, unknown>, permises: readonly string[]): void {
  if (Object.keys(corps).some((k) => !permises.includes(k))) throw refus("Inbox : champ non permis dans le corps.");
}

function exigerBoutons(boutons: unknown): void {
  if (!Array.isArray(boutons) || boutons.length === 0 || boutons.length > BOUTONS_MAX) throw refus(`Inbox : 1 à ${BOUTONS_MAX} boutons attendus.`);
  for (const b of boutons) {
    if (!estObjet(b)) throw refus("Inbox : bouton illisible.");
    exigerCles(b, ["type", "title", "payload"]);
    if (b.type !== "postback") throw refus("Inbox : seuls les boutons postback sont permis.");
    if (typeof b.title !== "string" || b.title.trim().length === 0 || b.title.length > BOUTON_TITRE_MAX) throw refus("Inbox : titre de bouton borné.");
    if (typeof b.payload !== "string" || !BOUTON_PAYLOAD.test(b.payload)) throw refus("Inbox : charge de bouton illisible.");
  }
}

/**
 * Vérifie le corps (ou la requête de lecture) d'une route inbox. `ids` : segments déjà extraits du chemin (validés par le motif).
 */
export function verifierCorpsInbox(
  route: RouteInboxZernio,
  d: { corps: unknown; query?: Record<string, string | number | boolean>; comptesPermis?: readonly string[]; commentIdChemin?: string },
): void {
  if (route === "lire-messages") {
    if (d.corps !== undefined) throw refus("Inbox : une lecture ne porte pas de corps.");
    const q = d.query ?? {};
    if (Object.keys(q).some((k) => k !== "accountId")) throw refus("Inbox : seul accountId est permis en paramètre.");
    exigerCompte(q.accountId, d.comptesPermis);
    return;
  }
  if (!estObjet(d.corps)) throw refus("Inbox : corps objet attendu.");
  const c = d.corps;
  exigerCompte(c.accountId, d.comptesPermis);
  switch (route) {
    case "reponse-privee":
      exigerCles(c, ["accountId", "message"]);
      if (!texteDuDictionnaire(c.message, false)) throw refus("Inbox : texte hors du dictionnaire v2.");
      return;
    case "repondre-commentaire":
      exigerCles(c, ["accountId", "message", "commentId"]);
      if (!texteDuDictionnaire(c.message, true)) throw refus("Inbox : texte hors du dictionnaire v2.");
      if (typeof c.commentId !== "string" || !new RegExp(`^${SEGMENT_ID}$`).test(c.commentId)) throw refus("Inbox : commentId illisible.");
      return;
    case "envoyer-message":
      exigerCles(c, ["accountId", "message", "buttons"]);
      if (!texteDuDictionnaire(c.message, false)) throw refus("Inbox : texte hors du dictionnaire v2.");
      if (c.buttons !== undefined) exigerBoutons(c.buttons);
      return;
  }
}
