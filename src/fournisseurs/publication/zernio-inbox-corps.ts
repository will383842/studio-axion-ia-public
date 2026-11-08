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

/** NOS domaines par défaut (sous-domaines compris), comme `lien-fin.ts` et `BASE_PUBLIQUE`. Configurable à l'appel. */
export const DOMAINES_PERMIS_PAR_DEFAUT: readonly string[] = ["axion-ia.com"];

const refus = (message: string) => new ErreurZernio("chemin-refuse", `${message} Rien n'a été envoyé.`);
const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Valeurs permises à la place des marqueurs du dictionnaire (bornées, une seule ligne). */
const VALEUR_MARQUEUR: Record<string, string> = {
  "[MOT]": "[\\p{L}\\p{N}' -]{1,30}", // lettres, chiffres, apostrophe, tiret, espace : ni lien ni adresse e-mail
  "[TITRE DU GUIDE]": "[^\\n\\r\\[\\]]{1,200}",
  "[LIEN]": "https://[^\\s\\[\\]]{1,300}",
};

/** Motif d'un texte du dictionnaire + ordre des marqueurs (un groupe capturant par marqueur, pour relire titre et lien). */
function motif(texte: string): { re: RegExp; marqueurs: string[] } {
  let source = "";
  const marqueurs: string[] = [];
  for (const morceau of texte.split(/(\[MOT\]|\[TITRE DU GUIDE\]|\[LIEN\])/)) {
    if (VALEUR_MARQUEUR[morceau]) {
      marqueurs.push(morceau);
      source += `(${VALEUR_MARQUEUR[morceau]})`;
    } else source += echapper(morceau);
  }
  return { re: new RegExp(`^${source}$`, "u"), marqueurs };
}

const MOTIFS = Object.entries(TEXTES_MP).map(([id, t]) => ({ id, publique: id.startsWith("mp-pub-"), ...motif(t.texte) }));

/** Texte conforme à un modèle du dictionnaire v2 du bon côté (public / privé) ? */
export function texteDuDictionnaire(texte: unknown, publique: boolean): texte is string {
  return typeof texte === "string" && texte.length <= 2000 && MOTIFS.some((m) => m.publique === publique && m.re.test(texte));
}

/** Titres et liens relus dans un texte conforme au dictionnaire (jamais recopiés dans une erreur). */
function valeursDuTexte(texte: string, publique: boolean): { titres: string[]; liens: string[] } {
  const titres: string[] = [];
  const liens: string[] = [];
  const m = MOTIFS.find((x) => x.publique === publique && x.re.test(texte));
  const g = m ? texte.match(m.re) : null;
  if (m && g) {
    m.marqueurs.forEach((q, i) => {
      if (q === "[TITRE DU GUIDE]") titres.push(g[i + 1]);
      if (q === "[LIEN]") liens.push(g[i + 1]);
    });
  }
  return { titres, liens };
}

/** Hôte d'un lien : https seulement, sans identifiants ni port, égal à un de NOS domaines ou son sous-domaine. */
function lienDeChezNous(lien: string, domaines: readonly string[]): boolean {
  let u: URL;
  try {
    u = new URL(lien.replace(/[.,;:!?]+$/, ""));
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.port !== "") return false;
  const hote = u.hostname.toLowerCase().replace(/\.$/, "");
  return domaines.some((d) => {
    const dom = d.trim().toLowerCase();
    return dom !== "" && (hote === dom || hote.endsWith(`.${dom}`));
  });
}

/** Liens et titres de guide : seulement NOS domaines et les titres de la liste fermée. Refus typés, valeur jamais recopiée. */
function exigerLiensEtTitres(texte: string, publique: boolean, d: { domainesPermis?: readonly string[]; titresGuidesPermis?: readonly string[] }): void {
  const { titres, liens } = valeursDuTexte(texte, publique);
  const domaines = d.domainesPermis ?? DOMAINES_PERMIS_PAR_DEFAUT;
  for (const lien of liens) {
    if (!lienDeChezNous(lien, domaines)) throw new ErreurZernio("lien-hors-domaine", "Inbox : lien hors de nos domaines. Rien n'a été envoyé.", { champs: ["message"] });
  }
  const permis = d.titresGuidesPermis ?? [];
  for (const titre of titres) {
    if (!permis.includes(titre)) throw new ErreurZernio("guide-inconnu", "Inbox : titre de guide absent de la liste fermée. Rien n'a été envoyé.", { champs: ["message"] });
  }
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
  d: { corps: unknown; query?: Record<string, string | number | boolean>; comptesPermis?: readonly string[]; commentIdChemin?: string; domainesPermis?: readonly string[]; titresGuidesPermis?: readonly string[] },
): void {
  if (route === "lire-messages") {
    if (d.corps !== undefined) throw refus("Inbox : une lecture ne porte pas de corps.");
    const q = d.query ?? {};
    if (Object.keys(q).some((k) => k !== "accountId" && k !== "cursor" && k !== "sortOrder" && k !== "limit")) throw refus("Inbox : seuls accountId, cursor, sortOrder et limit sont permis en paramètre.");
    if (q.sortOrder !== undefined && q.sortOrder !== "asc" && q.sortOrder !== "desc") throw refus("Inbox : sortOrder doit valoir asc ou desc.");
    if (q.limit !== undefined && (typeof q.limit !== "number" || !Number.isInteger(q.limit) || q.limit < 1 || q.limit > 100)) throw refus("Inbox : limit doit être un entier de 1 à 100.");
    if (q.cursor !== undefined && (typeof q.cursor !== "string" || !/^[A-Za-z0-9_=.+/-]{1,512}$/.test(q.cursor))) throw refus("Inbox : curseur illisible.");
    exigerCompte(q.accountId, d.comptesPermis);
    return;
  }
  if (!estObjet(d.corps)) throw refus("Inbox : corps objet attendu.");
  const c = d.corps;
  exigerCompte(c.accountId, d.comptesPermis);
  switch (route) {
    case "reponse-privee":
      if ("buttons" in c) throw new ErreurZernio("boutons-non-supportes", "Inbox : la réponse privée n'accepte pas de boutons. Rien n'a été envoyé.", { champs: ["buttons"] });
      exigerCles(c, ["accountId", "message"]);
      if (!texteDuDictionnaire(c.message, false)) throw refus("Inbox : texte hors du dictionnaire v2.");
      exigerLiensEtTitres(c.message, false, d);
      return;
    case "repondre-commentaire":
      exigerCles(c, ["accountId", "message", "commentId"]);
      if (!texteDuDictionnaire(c.message, true)) throw refus("Inbox : texte hors du dictionnaire v2.");
      exigerLiensEtTitres(c.message, true, d);
      if (typeof c.commentId !== "string" || !new RegExp(`^${SEGMENT_ID}$`).test(c.commentId)) throw refus("Inbox : commentId illisible.");
      return;
    case "envoyer-message":
      exigerCles(c, ["accountId", "message", "buttons"]);
      if (!texteDuDictionnaire(c.message, false)) throw refus("Inbox : texte hors du dictionnaire v2.");
      exigerLiensEtTitres(c.message, false, d);
      if (c.buttons !== undefined) exigerBoutons(c.buttons);
      return;
  }
}
