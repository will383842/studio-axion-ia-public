/**
 * E-MAIL DE SECOURS des notifications (lot M1b, B.0 §13 ; relié à l'écran au lot R3) : quand aucun téléphone n'a reçu
 * la notification, ou quand Will a choisi « par e-mail ». Service d'envoi : ZeptoMail (API HTTP, région UE), le même
 * compte que le site axion-ia.com (domaine vérifié, SPF `include:eu.zeptomail.net`, DMARC `p=reject`).
 * Configuré seulement si `EMAIL_SECOURS_CLE`, `EMAIL_SECOURS_EXPEDITEUR` et `EMAIL_SECOURS_DESTINATAIRE` existent et sont
 * valables ; sinon l'envoi est SIMULÉ (rien ne part, une ligne au journal du serveur, sans adresse ni jeton).
 * L'envoi réel n'a lieu que si la carte « Notifications » est reliée (`services/notifications.ts`).
 */
export interface ConfigEmail {
  cle: string;
  expediteur: string;
  destinataire: string;
  /** Point d'accès ZeptoMail (région UE par défaut). */
  adresse: string;
  /** Adresse publique du studio, pour les liens (toujours absolus). */
  site: string;
}

export const DELAI_EMAIL_MS = 15_000;
/** Adresse de réponse, comme le site (boîte réellement relevée ; jamais de « noreply@ »). */
export const ADRESSE_REPONSE = "contact@axion-ia.com";

const ADRESSE_VALABLE = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const SANS_REPONSE = /^(no[-_.]?reply|donotreply|do-not-reply)@/i;

export function configEmail(env: Record<string, string | undefined> = process.env): ConfigEmail | null {
  const cle = env.EMAIL_SECOURS_CLE?.trim();
  const expediteur = env.EMAIL_SECOURS_EXPEDITEUR?.trim();
  const destinataire = env.EMAIL_SECOURS_DESTINATAIRE?.trim();
  if (!cle || !expediteur || !destinataire) return null;
  // DMARC p=reject : une adresse mal formée ou « noreply@ » ferait refuser l'e-mail en silence. Mieux vaut « non relié ».
  if (!ADRESSE_VALABLE.test(expediteur) || SANS_REPONSE.test(expediteur) || !ADRESSE_VALABLE.test(destinataire)) return null;
  return {
    cle,
    expediteur,
    destinataire,
    adresse: env.EMAIL_SECOURS_ADRESSE?.trim() || "https://api.zeptomail.eu/v1.1/email",
    site: (env.STUDIO_ADRESSE?.trim() || "https://studio.axion-ia.com").replace(/\/+$/, ""),
  };
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Lien ABSOLU vers le studio. Un lien vers un autre site est refusé : on renvoie l'accueil du studio. */
export function lienAbsolu(site: string, lien?: string): string {
  if (!lien) return site;
  try {
    const base = new URL(site);
    const cible = new URL(lien, `${base.origin}/`);
    return cible.origin === base.origin ? cible.href : site;
  } catch {
    return site;
  }
}

/** Corps de la requête ZeptoMail (pur, testé). Le jeton n'y figure jamais (il va dans l'en-tête). */
export function corpsEmail(config: ConfigEmail, n: { titre: string; message?: string; lien?: string }) {
  const lien = lienAbsolu(config.site, n.lien);
  const titre = echapper(n.titre);
  const message = n.message ? `<p style="margin:0 0 20px;font:15px/1.55 Arial,Helvetica,sans-serif;color:#5b4a40">${echapper(n.message)}</p>` : "";
  const htmlbody =
    `<div style="background:#f7f1ea;padding:24px 12px">` +
    `<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #eadfd3">` +
    `<p style="margin:0 0 6px;font:600 12px/1.4 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#C65A2E">Studio Axion-IA</p>` +
    `<p style="margin:0 0 12px;font:700 20px/1.35 Arial,Helvetica,sans-serif;color:#2b1d14">${titre}</p>` +
    message +
    `<a href="${echapper(lien)}" style="display:inline-block;background:#C65A2E;color:#ffffff;text-decoration:none;font:600 15px/1 Arial,Helvetica,sans-serif;padding:14px 22px;border-radius:999px">Ouvrir le studio</a>` +
    `</div>` +
    `<p style="max-width:520px;margin:14px auto 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#8a7768;text-align:center">Vous recevez cet e-mail parce que les notifications du studio sont réglées ainsi. Pour changer : Réglages, puis Notifications.</p>` +
    `</div>`;
  return {
    from: { address: config.expediteur, name: "Studio Axion-IA" },
    to: [{ email_address: { address: config.destinataire } }],
    reply_to: [{ address: ADRESSE_REPONSE, name: "Axion-IA" }],
    subject: n.titre,
    htmlbody,
    textbody: `${n.titre}\n\n${n.message ? `${n.message}\n\n` : ""}Ouvrir le studio : ${lien}`,
    // Liens laissés tels quels (aucune réécriture de suivi) : l'adresse reste celle du studio.
    track_clicks: false,
    track_opens: false,
  };
}

export interface ResultatEmail {
  envoye: boolean;
  simule: boolean;
  /** Statut HTTP de ZeptoMail quand il refuse (401 : jeton refusé…). Jamais le corps de la réponse. */
  statut?: number;
}

export async function envoyerEmail(config: ConfigEmail | null, n: { titre: string; message?: string; lien?: string }, appeler: typeof fetch = fetch): Promise<ResultatEmail> {
  if (!config) {
    console.info(`[studio] e-mail de secours simulé : ${n.titre}`);
    return { envoye: false, simule: true };
  }
  try {
    const r = await appeler(config.adresse, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Zoho-enczapikey ${config.cle}` },
      body: JSON.stringify(corpsEmail(config, n)),
      signal: AbortSignal.timeout(DELAI_EMAIL_MS),
    });
    return r.ok ? { envoye: true, simule: false } : { envoye: false, simule: false, statut: r.status };
  } catch {
    return { envoye: false, simule: false };
  }
}
