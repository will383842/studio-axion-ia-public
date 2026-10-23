/**
 * PHRASE DE MESURE DU CALAGE (lot « calage », D3) — UNE phrase de la vraie voix HeyGen de Will, écrite pour la mesure :
 * des pauses marquées (ponctuation) suivies de mots qui commencent par un son VOISÉ (la référence indépendante de
 * `mesurer_calage.py` : reprise de la voix après une coupure). Les 5 phrases du lot M0b n'en offraient que 2.
 *
 *   pnpm exec tsx outils/alignement/phrase-heygen.mts [6|7|8|9] [chemin du fichier de clés]
 *
 * Phrases 7 à 9 (ajoutées par la reprise du lot, 02/10) : même principe, pour mesurer sur plus de mots (la phrase 6 et
 * les 5 du lot M0b n'en donnaient que 7).
 *
 * Clé `HEYGEN_API_KEY` lue dans le fichier de clés (par défaut `~/.claude/secrets/studio.env`), jamais affichée ni
 * écrite. Appels : `GET /v3/voices?type=private` (gratuit), `GET /v3/users/me` × 2 (gratuit, solde avant / après),
 * `POST /v3/voices/speech` × 1 (≈ 0,03 $ ; plafond du lot : 0,50 $). Aucune vidéo, aucun look.
 * Sorties : `docs/captures/d3-calage/<n>-mesure.mp3`, `<n>-mesure.heygen.json`, `<n>-mesure.cout.json`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { creerClientHeygen, mimeDepuisOctets } from "../../src/fournisseurs/heygen/client";
import { creerFournisseurVoixHeygen } from "../../src/fournisseurs/heygen/voix";
import { stockageSimulation } from "../../src/fournisseurs/simulation/autres";
// Essai sur ce poste (entrées servies par 127.0.0.1) : mode essai EXPLICITE de studio-rendu (relecture sécurité R45).
process.env.STUDIO_RENDU_ESSAI ??= "1";

const NUMERO = process.argv[2] ?? "6";
const FICHIER_CLES = process.argv[3] ?? join(homedir(), ".claude", "secrets", "studio.env");
const SORTIE = join(process.cwd(), "docs", "captures", "d3-calage");
const NOM_VOIX_WILL = /^DJI_04/;
const TEXTES: Record<string, string> = {
  "6": "Bonjour. Mardi, votre dossier est arrivé. Le juge a lu vos lettres ; la décision viendra lundi. Avec nous, vous avancez. Merci, et à bientôt.",
  "7": "Lundi, nous avons lu le contrat. Mais voilà : la clause est nulle. Alors, gardez votre calme. Nous allons agir. Bonne nouvelle, non ?",
  "8": "Le bail est signé. Mais le loyer a doublé ! Rassurez-vous : la loi vous protège. Leur demande est abusive. Merci de votre confiance.",
  "9": "Bonsoir. Votre amende est réduite. Le dossier avance bien ; la mairie a répondu. Demain, nous écrirons au juge. À lundi, et bon courage.",
};
const TEXTE = TEXTES[NUMERO];
if (!TEXTE) throw new Error(`Phrase inconnue : ${NUMERO} (6 à 9).`);
const PLAFOND_USD = 0.1;

function lireCle(): string {
  const ligne = readFileSync(FICHIER_CLES, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("HEYGEN_API_KEY="));
  const cle = ligne?.slice("HEYGEN_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!cle) throw new Error("HEYGEN_API_KEY absente du fichier de clés.");
  return cle;
}

async function main() {
  mkdirSync(SORTIE, { recursive: true });
  const client = creerClientHeygen({ cle: lireCle() });
  const voix = creerFournisseurVoixHeygen({ client, stockage: () => stockageSimulation, environnement: "dev" });
  const solde = async () => (await client.requete<{ wallet?: { remaining_balance?: number } }>("GET", "/v3/users/me")).wallet?.remaining_balance ?? NaN;
  const will = (await voix.listerVoixExistantes()).find((v) => NOM_VOIX_WILL.test(v.nom));
  if (!will?.utilisable) throw new Error("La voix de Will (« DJI_04… ») est introuvable ou ne produit pas de son seul.");
  const avant = await solde();
  // Estimation prudente : 0,08 $ pour 288 caractères au lot M0b.
  const estimation = (TEXTE.length * 0.08) / 288;
  if (estimation > PLAFOND_USD) throw new Error(`Estimation ${estimation.toFixed(3)} $ au-dessus du plafond.`);
  const r = await voix.lire({ idExterne: will.idExterne, texte: TEXTE, reglages: { vitesse: 1, stabilite: 60, emotion: 50 }, prononciations: [] });
  const { octets } = await client.telecharger(r.fichierCle);
  const ext = mimeDepuisOctets(octets) === "audio/wav" ? "wav" : "mp3";
  writeFileSync(join(SORTIE, `${NUMERO}-mesure.${ext}`), octets);
  writeFileSync(join(SORTIE, `${NUMERO}-mesure.heygen.json`), JSON.stringify({ texte: TEXTE, mots: r.mots, dureeSec: r.dureeSec }, null, 2));
  await new Promise((ok) => setTimeout(ok, 5000));
  const apres = await solde();
  const cout = { date: new Date().toISOString(), appel: "POST /v3/voices/speech × 1", caracteres: TEXTE.length, soldeAvantUsd: avant, soldeApresUsd: apres, depenseUsd: +(avant - apres).toFixed(4) };
  writeFileSync(join(SORTIE, `${NUMERO}-mesure.cout.json`), JSON.stringify(cout, null, 2));
  console.log(`${NUMERO}-mesure : ${r.dureeSec.toFixed(2)} s, ${r.mots.length} mots ; dépense relevée ${cout.depenseUsd} $.`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
