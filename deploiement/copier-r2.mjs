/**
 * COPIE HORS SITE des sauvegardes de la base vers R2 (audit D, B8) et alerte e-mail en cas d'échec.
 * Lancé par `deploiement/sauvegarder.sh` DANS un conteneur jetable de l'image du studio (Node 22 y est déjà) :
 *
 *   node copier-r2.mjs envoyer <nom> < fichier.sql.gz   → studio/sauvegardes/<nom> dans le seau R2 (R2_BUCKET)
 *   node copier-r2.mjs alerte "<titre>" "<message>"      → e-mail ZeptoMail (EMAIL_SECOURS_*), si configuré
 *
 * Aucune nouvelle clé : les variables R2_* et EMAIL_SECOURS_* du studio (/opt/studio-axion-ia/.env), passées par
 * l'environnement (jamais sur la ligne de commande). Aucune dépendance : signature V4 identique à celle du studio
 * (`src/fournisseurs/r2/signature.ts`, vérifiée par les tests).
 *
 * RIEN N'EST JAMAIS EFFACÉ NI ÉCRASÉ dans R2 : aucune requête DELETE ; un objet du même nom déjà présent avec la même
 * taille est considéré comme déjà copié, avec une autre taille c'est un ÉCHEC (rien n'est remplacé).
 */
import { createHash, createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PREFIXE_SAUVEGARDES = "studio/sauvegardes/";
const DELAI_RESEAU_MS = 10 * 60_000;
const DELAI_EMAIL_MS = 15_000;
const NOM_VALABLE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

/* --- Signature V4 par adresse (même algorithme que src/fournisseurs/r2/signature.ts) --- */

export function encoderRfc3986(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function dateAmz(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function signerAdresse(identifiants, demande) {
  const date = demande.date ?? new Date();
  const amz = dateAmz(date);
  const jour = amz.slice(0, 8);
  const portee = `${jour}/${identifiants.region}/s3/aws4_request`;
  const expire = Math.max(1, Math.min(604_800, Math.round(demande.expireSec)));
  const parametres = {
    ...(demande.parametres ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${identifiants.cleAcces}/${portee}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expire),
    "X-Amz-SignedHeaders": "host",
  };
  const requete = Object.keys(parametres)
    .sort()
    .map((k) => `${encoderRfc3986(k)}=${encoderRfc3986(parametres[k])}`)
    .join("&");
  const chemin = demande.chemin.split("/").map(encoderRfc3986).join("/");
  const canonique = [demande.methode, chemin, requete, `host:${demande.hote}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aSigner = ["AWS4-HMAC-SHA256", amz, portee, createHash("sha256").update(canonique, "utf8").digest("hex")].join("\n");
  const h = (cle, s) => createHmac("sha256", cle).update(s, "utf8").digest();
  const cleSignature = h(h(h(h(`AWS4${identifiants.secret}`, jour), identifiants.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", cleSignature).update(aSigner, "utf8").digest("hex");
  return `https://${demande.hote}${chemin}?${requete}&X-Amz-Signature=${signature}`;
}

/** Configuration R2 lue dans l'environnement (mêmes règles que le studio), ou null si une variable manque. */
export function configR2(env) {
  const compte = env.R2_ACCOUNT_ID?.trim();
  const cleAcces = env.R2_ACCESS_KEY_ID?.trim();
  const secret = env.R2_SECRET_ACCESS_KEY?.trim();
  const seau = env.R2_BUCKET?.trim();
  if (!compte || !cleAcces || !secret || !seau) return null;
  // Relecture paquet 4 (sécurité P4) : la copie vise TOUJOURS le point d'accès S3 du compte. Un domaine personnalisé
  // (R2_PUBLIC_HOST) ne sert pas l'API S3 en chemin /{seau}/{clé} : il n'est gardé que s'il est lui-même un point d'accès
  // S3 de Cloudflare (ex. {compte}.eu.r2.cloudflarestorage.com pour un seau européen).
  const public_ = (env.R2_PUBLIC_HOST?.trim() ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const hote = public_.endsWith(".r2.cloudflarestorage.com") ? public_ : `${compte}.r2.cloudflarestorage.com`;
  return { cleAcces, secret, seau, hote };
}

/**
 * Envoie une sauvegarde dans R2 (sans jamais écraser). Renvoie { cle, taille, deja } ; lève une Error sinon.
 * `appeler` : fetch injectable (tests, aucun réseau).
 */
export async function envoyerSauvegarde({ env, nom, contenu, appeler = fetch, maintenant = () => new Date() }) {
  const config = configR2(env);
  if (!config) throw new Error("variables R2_* incomplètes (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)");
  if (!NOM_VALABLE.test(nom)) throw new Error(`nom de sauvegarde refusé : ${nom}`);
  if (!contenu?.length) throw new Error("sauvegarde vide : rien n'est envoyé");
  const cle = `${PREFIXE_SAUVEGARDES}${nom}`;
  const identifiants = { cleAcces: config.cleAcces, secret: config.secret, region: "auto" };
  const adresse = (methode) => signerAdresse(identifiants, { methode, hote: config.hote, chemin: `/${config.seau}/${cle}`, expireSec: 3600, date: maintenant() });
  const tailleDistante = async () => {
    const r = await appeler(adresse("HEAD"), { method: "HEAD", signal: AbortSignal.timeout(60_000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`R2 a répondu ${r.status} à la vérification`);
    return Number(r.headers.get("content-length"));
  };
  const avant = await tailleDistante();
  if (avant !== null) {
    if (avant === contenu.length) return { cle, taille: avant, deja: true };
    throw new Error(`${cle} existe déjà dans R2 avec une autre taille (${avant} au lieu de ${contenu.length}) : rien n'est écrasé`);
  }
  const r = await appeler(adresse("PUT"), {
    method: "PUT",
    body: contenu,
    headers: { "content-type": "application/gzip", "content-length": String(contenu.length) },
    signal: AbortSignal.timeout(DELAI_RESEAU_MS),
  });
  if (!r.ok) throw new Error(`R2 a refusé l'envoi (${r.status})`);
  const apres = await tailleDistante();
  if (apres !== contenu.length) throw new Error(`copie R2 incomplète : ${apres ?? "absente"} octets au lieu de ${contenu.length}`);
  return { cle, taille: apres, deja: false };
}

/** Alerte par e-mail (ZeptoMail, mêmes variables que l'e-mail de secours du studio). false : non configuré ou refusé. */
export async function envoyerAlerte({ env, titre, message, appeler = fetch }) {
  const cle = env.EMAIL_SECOURS_CLE?.trim();
  const expediteur = env.EMAIL_SECOURS_EXPEDITEUR?.trim();
  const destinataire = env.EMAIL_SECOURS_DESTINATAIRE?.trim();
  if (!cle || !expediteur || !destinataire) return false;
  const corps = {
    from: { address: expediteur, name: "Studio Axion-IA" },
    to: [{ email_address: { address: destinataire } }],
    subject: titre,
    textbody: `${titre}\n\n${message}\n\nServeur : journal /opt/studio-axion-ia/sauvegardes/sauvegardes.log`,
    track_clicks: false,
    track_opens: false,
  };
  try {
    const r = await appeler(env.EMAIL_SECOURS_ADRESSE?.trim() || "https://api.zeptomail.eu/v1.1/email", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Zoho-enczapikey ${cle}` },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(DELAI_EMAIL_MS),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function lireEntree() {
  const morceaux = [];
  for await (const m of process.stdin) morceaux.push(m);
  return Buffer.concat(morceaux);
}

async function principal(args) {
  const [mode, ...reste] = args;
  if (mode === "envoyer" && reste.length === 1) {
    const r = await envoyerSauvegarde({ env: process.env, nom: reste[0], contenu: await lireEntree() });
    console.log(`${r.deja ? "déjà dans R2" : "copiée dans R2"} : ${r.cle} (${r.taille} octets)`);
    return 0;
  }
  if (mode === "alerte" && reste.length === 2) {
    const ok = await envoyerAlerte({ env: process.env, titre: reste[0], message: reste[1] });
    console.log(ok ? "alerte envoyée par e-mail" : "alerte NON envoyée (EMAIL_SECOURS_* absent ou refusé)");
    return 0;
  }
  console.error('usage : node copier-r2.mjs envoyer <nom> < fichier   |   node copier-r2.mjs alerte "<titre>" "<message>"');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ÉCHEC : ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    },
  );
}
