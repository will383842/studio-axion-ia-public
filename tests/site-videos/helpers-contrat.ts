/** Exemples du contrat studio → site (version 1) : construits ici, écrits dans docs/site-videos/contrat/ et comparés par le test S4.1. */
import { corpsPasseport, chaineASigner, VERSION_CONTRAT } from "@/domaine/site-videos/contrat";
import type { PasseportWeb } from "@/domaine/site-videos/types";
import { creerSiteFactice } from "@/fournisseurs/site/simulation";
import { CHEMIN_REGLAGES, CHEMIN_VIDEOS } from "@/fournisseurs/site/fournisseur";
import { sha256Hex, signerAppel } from "@/fournisseurs/site/signature";

export const SECRET_EXEMPLE = "secret-d-exemple-du-contrat";
export const HORODATAGE_EXEMPLE = 1760781600;
export const NONCE_EXEMPLE = "00112233445566778899aabbccddeeff";

export const PASSEPORT_EXEMPLE: PasseportWeb = {
  version: 3,
  titreWeb: "Automatiser ses devis en 10 minutes",
  resume: "Un devis prend trop de temps : voici la méthode en trois gestes pour le faire en dix minutes, avec un modèle que vous réutilisez à chaque fois.",
  transcription: "Vos devis vous prennent trop de temps. Voici comment les faire en dix minutes. Premier geste : un modèle. Deuxième geste : vos prix. Troisième geste : l'envoi. Essayez dès aujourd'hui.",
  chapitres: [
    { debutSec: 0, finSec: 6.4, libelle: "Accroche", blocRecette: "accroche" },
    { debutSec: 6.4, finSec: 30.2, libelle: "Cœur", blocRecette: "coeur" },
    { debutSec: 30.2, finSec: 47.2, libelle: "Appel", blocRecette: "appel" },
  ],
  aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun outil à payer."],
  questions: [
    { question: "Faut-il un logiciel ?", reponse: "Non, un modèle suffit." },
    { question: "Combien de temps faut-il ?", reponse: "Dix minutes par devis." },
  ],
  rubrique: "Automatisation",
  motsCles: ["devis", "automatisation"],
  credits: ["Musique : Studio Axion IA"],
  lienService: "/fr/services/automatisation",
  sortieId: "sortie_privee_1",
  ratio: "9:16",
  contenuGenere: true,
  origines: { titreWeb: "will", resume: "claude" },
  modifieLe: "2026-10-18T10:00:00.000Z",
};

export function corpsExemple() {
  return corpsPasseport({
    idStudio: "vid_exemple",
    passeport: PASSEPORT_EXEMPLE,
    slugPropose: "automatiser-ses-devis-en-10-minutes",
    generateur: "avocat",
    langue: "fr",
    dureeSec: 47.2,
    largeur: 1080,
    hauteur: 1920,
    publieLe: "2026-10-18T10:05:00.000Z",
    urls: {
      video: "https://axion-ia.com/medias/videos/vid_exemple/automatiser-ses-devis-en-10-minutes-v3-1a2b3c4d.mp4",
      vignette: "https://axion-ia.com/medias/videos/vid_exemple/automatiser-ses-devis-en-10-minutes-v3-5e6f7a8b.jpg",
      vtt: "https://axion-ia.com/medias/videos/vid_exemple/automatiser-ses-devis-en-10-minutes-v3-9c0d1e2f.vtt",
    },
    vignette: { largeur: 1280, hauteur: 720 },
  });
}

const json = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

/** Nom du fichier → contenu exact. */
export async function construireExemples(): Promise<Record<string, string>> {
  const corps = corpsExemple();
  const site = creerSiteFactice({ secret: SECRET_EXEMPLE, maintenant: () => HORODATAGE_EXEMPLE * 1000 });
  const appeler = (methode: "GET" | "POST" | "DELETE", chemin: string, c?: unknown, nonce = NONCE_EXEMPLE) => {
    const texte = c === undefined ? "" : JSON.stringify(c);
    return site.traiter({ methode, chemin, corps: texte, entetes: signerAppel({ secret: SECRET_EXEMPLE, methode, chemin, corps: texte, horodatageSec: HORODATAGE_EXEMPLE, nonce }) });
  };
  const reglages = await appeler("GET", CHEMIN_REGLAGES, undefined, "a".repeat(32));
  const publication = await appeler("POST", CHEMIN_VIDEOS, corps, "b".repeat(32));
  const retrait = await appeler("DELETE", `${CHEMIN_VIDEOS}/vid_exemple`, undefined, "c".repeat(32));
  const texteCorps = JSON.stringify(corps);
  const entetes = signerAppel({ secret: SECRET_EXEMPLE, methode: "POST", chemin: CHEMIN_VIDEOS, corps: texteCorps, horodatageSec: HORODATAGE_EXEMPLE, nonce: NONCE_EXEMPLE });
  const chaine = chaineASigner({ horodatage: String(HORODATAGE_EXEMPLE), nonce: NONCE_EXEMPLE, methode: "POST", chemin: CHEMIN_VIDEOS, sha256Corps: sha256Hex(texteCorps) });
  return {
    "passeport.exemple.json": json(corps),
    "reponse-publication.exemple.json": json(publication.corps),
    "reponse-retrait.exemple.json": json(retrait.corps),
    "reglages.exemple.json": json(reglages.corps),
    "signature.exemple.md": [
      "# Signature des appels du studio (contrat version " + VERSION_CONTRAT + ")",
      "",
      "Exemple vérifié par le test `s4-contrat` : changer une ligne ici sans changer le code (ou l'inverse) fait échouer le test.",
      "",
      "Chaque appel porte trois en-têtes :",
      "",
      "- `x-axion-horodatage` : secondes Unix ;",
      "- `x-axion-nonce` : 16 octets aléatoires en hexadécimal ;",
      "- `x-axion-signature` : `HMAC-SHA256(secret, \"<horodatage>.<nonce>.<MÉTHODE>.<chemin>.<sha256 hex du corps>\")` en hexadécimal (corps vide : sha256 de la chaîne vide).",
      "",
      "Le site refuse (401) : signature fausse (comparaison en temps constant), horodatage à plus de 300 s, nonce déjà vu dans les 10 dernières minutes.",
      "",
      "## Exemple (`POST /api/interne/videos`, corps = `passeport.exemple.json` sérialisé sans espace)",
      "",
      `- secret : \`${SECRET_EXEMPLE}\``,
      `- horodatage : \`${entetes["x-axion-horodatage"]}\``,
      `- nonce : \`${entetes["x-axion-nonce"]}\``,
      `- sha256 du corps : \`${sha256Hex(texteCorps)}\``,
      `- chaîne signée : \`${chaine}\``,
      `- signature : \`${entetes["x-axion-signature"]}\``,
      "",
    ].join("\n"),
  };
}
