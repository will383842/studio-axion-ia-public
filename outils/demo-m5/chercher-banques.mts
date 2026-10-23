/**
 * PREUVE DU LOT M5 (banques) : VRAIE recherche Pexels puis Pixabay sur les phrases du script de démonstration M4,
 * avec le vrai code (`requeteDuPlan` → `chercherPexels` / `chercherPixabay` → `resultatBanqueAcceptable`).
 * Gratuit. Écrit `docs/captures/m5-demo/banques.json` et des réponses ENREGISTRÉES (tronquées) pour les tests
 * sans réseau (`tests/fixtures/a2-pexels.json`, `a2-pixabay.json`). Aucune clé n'est affichée ni écrite.
 * Usage : `pnpm exec tsx outils/demo-m5/chercher-banques.mts`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chargerCles } from "./cles.ts";

const presentes = chargerCles(["PEXELS_API_KEY", "PIXABAY_API_KEY"]);
const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const dom = await charger<typeof import("@/domaine/illustrations")>("@/domaine/illustrations");
const pexels = await charger<typeof import("@/fournisseurs/illustration/pexels")>("@/fournisseurs/illustration/pexels");
const pixabay = await charger<typeof import("@/fournisseurs/illustration/pixabay")>("@/fournisseurs/illustration/pixabay");

const SORTIE = join(process.cwd(), "docs", "captures", "m5-demo");
mkdirSync(SORTIE, { recursive: true });

// Les phrases du script de démonstration M4 (outils/demo-m4/rendre-demo.mts) et leurs intentions.
const phrases: { id: string; texte: string; requete?: string }[] = [
  { id: "s1", texte: "Vous recevez un PV de 135 € ?" },
  { id: "s3", texte: "Vous avez quarante-cinq jours pour le contester, et une seule erreur sur l'avis suffit.", requete: "un avis de contravention sur une table" },
  { id: "s4", texte: "Un client a économisé 2 500 € comme ça." },
  { id: "s5", texte: "Gardez cette vidéo pour le prochain PV." },
  // Intentions de la vidéo de démonstration M5 (cascade complète).
  { id: "m5-contrat", texte: "Relisez chaque ligne avant de signer.", requete: "signature d'un contrat" },
  { id: "m5-argent", texte: "Ce sont des euros que vous gardez.", requete: "billets d'euros sur une table" },
];

const brutPexels: unknown[] = [];
const brutPixabay: unknown[] = [];
const rapport = [];
for (const p of phrases) {
  const req = dom.requeteDuPlan({ id: p.id, ordre: 0, texte: p.texte, requete: p.requete });
  const ligne: Record<string, unknown> = { phrase: p.texte, intention: p.requete, requeteEn: req.requeteEn };
  for (const [nom, cle] of [
    ["pexels", process.env.PEXELS_API_KEY],
    ["pixabay", process.env.PIXABAY_API_KEY],
  ] as const) {
    if (!cle || !req.requeteEn) continue;
    const debut = Date.now();
    // Réponse brute gardée pour les tests (une seule recherche par banque).
    const reponse = await fetch(
      nom === "pexels"
        ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(req.requeteEn)}&orientation=portrait&size=medium&per_page=12`
        : `https://pixabay.com/api/videos/?key=${encodeURIComponent(cle)}&q=${encodeURIComponent(req.requeteEn)}&per_page=100&safesearch=true&video_type=film`,
      nom === "pexels" ? { headers: { Authorization: cle } } : undefined,
    );
    const json = (await reponse.json()) as { videos?: unknown[]; hits?: unknown[]; total_results?: number; totalHits?: number };
    if (nom === "pexels" && brutPexels.length === 0) brutPexels.push({ ...json, videos: (json.videos ?? []).slice(0, 4) });
    if (nom === "pixabay" && brutPixabay.length === 0) brutPixabay.push({ ...json, hits: (json.hits ?? []).slice(0, 4) });
    const candidats = nom === "pexels" ? pexels.lireReponsePexels(json) : pixabay.lireReponsePixabay(json);
    const acceptes = candidats.filter((c) => dom.resultatBanqueAcceptable(c, "9:16", 2, req.requeteEn));
    ligne[nom] = {
      statut: reponse.status,
      ms: Date.now() - debut,
      total: json.total_results ?? json.totalHits ?? 0,
      verticaux: candidats.length,
      acceptes: acceptes.length,
      premier: acceptes[0] ? { id: acceptes[0].idExterne, largeur: acceptes[0].largeur, hauteur: acceptes[0].hauteur, dureeSec: acceptes[0].dureeSec, description: acceptes[0].description, page: acceptes[0].page, licence: acceptes[0].licence.source } : null,
    };
    // Écrit au fil de l'eau ce qui a été trouvé (aucune clé).
    console.log(`${nom.padEnd(8)} « ${req.requeteEn} » : ${candidats.length} verticales, ${acceptes.length} acceptées`);
  }
  rapport.push(ligne);
}
writeFileSync(join(SORTIE, "banques.json"), JSON.stringify({ date: new Date().toISOString(), clesPresentes: presentes, cout: "0 € (banques gratuites)", rapport }, null, 2));
writeFileSync(join(process.cwd(), "tests", "fixtures", "a2-pexels.json"), JSON.stringify(brutPexels[0] ?? {}, null, 1));
writeFileSync(join(process.cwd(), "tests", "fixtures", "a2-pixabay.json"), JSON.stringify(brutPixabay[0] ?? {}, null, 1));
console.log("écrit : docs/captures/m5-demo/banques.json");
