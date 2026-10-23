/**
 * ESSAI RÉEL DE CLAUDE (lot G0, critère « appel réel ≤ 0,05 $ ») — À LANCER UNE FOIS, QUAND WILL A DONNÉ SA CLÉ.
 *
 *   pnpm exec tsx --conditions=react-server outils/generateur/essai-claude.mts [chemin du fichier de clés]
 *
 * - Clé `ANTHROPIC_API_KEY` lue dans le fichier de clés (par défaut `~/.claude/secrets/studio.env`, ligne
 *   `ANTHROPIC_API_KEY=…`) ou dans l'environnement ; JAMAIS affichée ni écrite (seulement « …4 derniers »).
 * - Budget : le PIRE CAS de tous les appels est calculé AVANT le premier ; au-delà de 0,05 $, rien ne part. Le coût réel
 *   est additionné après chaque appel ; au-delà de 0,05 $, l'essai s'arrête.
 * - Ce qui est vérifié (plan v5 B.3.2, B.3.3, B.3.4, B.10 G0) :
 *    1. un appel Opus 5.5 (rôle « sonde », effort `low`, sortie structurée, repli « default ») : modèle renvoyé, jetons,
 *       coût réel au tarif de la table ;
 *    2. le même appel une 2e fois : `cache_read_input_tokens` > 0 (contexte ≥ 512 jetons, minimum d'Opus 5.5) ;
 *    3. un modèle qui n'existe pas : forme exacte de l'erreur « modèle introuvable » (404, gratuit) → `bloquee-modele` ;
 *    4. trois tirages identiques sur Sonnet 5.5 (juge oui/non) : variance des tirages ;
 *    5. la forme d'un refus de FACTURATION ne se provoque pas : elle sera relevée au premier vrai refus (journal).
 * - Sortie : `docs/captures/g0-claude/essai.json` (aucune clé, aucun texte de client).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { envoyerMessage, ErreurClaude, type RequeteClaude, type ReponseClaude } from "../../src/fournisseurs/claude/client";
import { masquerSecrets } from "../../src/fournisseurs/claude/secret";
import { coutUsd, MODELE_ECRITURE, MODELE_JUGE, pireCasUsd, jetonsEstimes, TARIFS_CLAUDE } from "../../src/fournisseurs/claude/tarifs";
import { construireRequete, schemaJson, type DefinitionRole } from "../../src/generateur/roles/types";

const BUDGET_USD = 0.05;
const FICHIER_CLES = process.argv[2] ?? join(homedir(), ".claude", "secrets", "studio.env");
const SORTIE = join(process.cwd(), "docs", "captures", "g0-claude");

function lireCle(): string {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return env;
  if (!existsSync(FICHIER_CLES)) throw new Error(`Aucune clé : ni ANTHROPIC_API_KEY, ni fichier ${FICHIER_CLES}.`);
  const ligne = readFileSync(FICHIER_CLES, "utf8").split(/\r?\n/).find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  const cle = ligne?.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!cle) throw new Error(`ANTHROPIC_API_KEY absente de ${FICHIER_CLES}.`);
  return cle;
}

/** Contexte fixe d'environ 900 jetons (au-dessus du minimum de 512 mis en cache sur Opus 5.5), toujours identique. */
const CONTEXTE = Array.from({ length: 12 }, (_, i) => `Repère ${i + 1} : Axion-IA forme les dirigeants de PME à l'usage concret de l'intelligence artificielle, avec des cas réels, des chiffres sourcés, sans promesse excessive ni jargon, en vouvoyant le spectateur, avec une issue utilisable tout de suite et une limite dite honnêtement.`).join("\n");

const roleSondeEssai: DefinitionRole = {
  id: "sonde-essai",
  version: 1,
  consigne: "Tu vérifies le branchement du studio vidéo Axion-IA. Réponds par une seule phrase courte, en français, qui reprend le sujet donné.",
  schema: z.object({ phrase: z.string() }),
  modele: MODELE_ECRITURE,
  effort: "low",
  maxTokens: 400,
  simuler: () => ({ phrase: "" }),
};

const schemaJuge = z.object({ accrocheConcrete: z.boolean(), coutDitTot: z.boolean(), issueDonnee: z.boolean() });
const requeteJuge: RequeteClaude = {
  modele: MODELE_JUGE,
  maxTokens: 300,
  effort: "low",
  systeme: [{ texte: "Tu es un juge. Réponds oui (true) ou non (false) à chaque question sur le texte fourni, sans commentaire." }],
  messages: [{ role: "user", contenu: "<texte>Vous recevez un PV de stationnement. Vous avez 45 jours pour le contester. Le geste : photographiez tout de suite le panneau.</texte>\nQuestions : l'accroche est-elle concrète ? le coût est-il dit tôt ? une issue est-elle donnée ?" }],
  schema: schemaJson(schemaJuge),
};

const requeteSonde = construireRequete(roleSondeEssai, { contexte: { contexteAxion: CONTEXTE }, variable: "<brief>Les PV de stationnement des véhicules de société</brief>" });

function pireCasRequete(r: RequeteClaude): number {
  const texte = [...r.systeme.map((b) => b.texte), ...r.messages.map((m) => m.contenu), r.schema ? JSON.stringify(r.schema) : ""].join("\n");
  return pireCasUsd(r.modele, jetonsEstimes(texte), r.maxTokens);
}

async function main(): Promise<void> {
  const cle = lireCle();
  const finCle = `…${cle.slice(-4)}`;
  const prevus = [requeteSonde, requeteSonde, requeteJuge, requeteJuge, requeteJuge];
  const pireCas = prevus.reduce((s, r) => s + pireCasRequete(r), 0);
  console.log(`Clé ${finCle} · pire cas de l'essai : ${pireCas.toFixed(4)} $ (budget ${BUDGET_USD} $)`);
  if (pireCas > BUDGET_USD) throw new Error("Pire cas au-dessus du budget : rien ne part.");

  let total = 0;
  const appels: Record<string, unknown>[] = [];
  async function appeler(nom: string, r: RequeteClaude): Promise<ReponseClaude | null> {
    if (total + pireCasRequete(r) > BUDGET_USD) {
      appels.push({ nom, saute: "budget" });
      return null;
    }
    const debut = Date.now();
    const rep = await envoyerMessage(r, { cle });
    const cout = coutUsd(rep.jetons, rep.modele);
    total += cout;
    appels.push({ nom, modeleDemande: rep.modeleDemande, modele: rep.modele, replis: rep.replis, stopReason: rep.stopReason, jetons: rep.jetons, coutUsd: Number(cout.toFixed(6)), dureeMs: Date.now() - debut, texte: rep.texte.slice(0, 300) });
    console.log(`${nom} : ${rep.modele}, ${JSON.stringify(rep.jetons)}, ${cout.toFixed(5)} $, ${Date.now() - debut} ms`);
    return rep;
  }

  // 1 et 2 : sonde, puis la même pour le cache.
  const a = await appeler("sonde-1", requeteSonde);
  const b = await appeler("sonde-2-cache", requeteSonde);

  // 3 : modèle introuvable (404, gratuit).
  let modele: Record<string, unknown> = {};
  try {
    await envoyerMessage({ ...requeteSonde, modele: "claude-modele-inexistant-g0" }, { cle });
    modele = { resultat: "ACCEPTÉ ?! (inattendu)" };
  } catch (e) {
    modele = e instanceof ErreurClaude ? { code: e.code, statut: e.statut, message: e.message } : { message: masquerSecrets(String(e), [cle]) };
  }
  console.log(`modèle introuvable : ${JSON.stringify(modele)}`);

  // 4 : variance des tirages Sonnet.
  const tirages: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const r = await appeler(`juge-sonnet-${i}`, requeteJuge);
    if (r) tirages.push(r.texte);
  }

  const resultat = {
    le: new Date().toISOString(),
    cle: finCle,
    tarifs: TARIFS_CLAUDE,
    pireCasUsd: Number(pireCas.toFixed(6)),
    totalUsd: Number(total.toFixed(6)),
    budgetTenu: total <= BUDGET_USD,
    cache: { ecritAuPremier: a?.jetons.cacheEcrit ?? null, luAuSecond: b?.jetons.cacheLu ?? null, verifie: (b?.jetons.cacheLu ?? 0) > 0 },
    modeleIntrouvable: modele,
    varianceSonnet: { tirages, identiques: tirages.length === 3 && new Set(tirages).size === 1 },
    facturation: "non provoquée : forme relevée au premier vrai refus (journal du studio, `en-attente-credit`)",
    appels,
  };
  mkdirSync(SORTIE, { recursive: true });
  writeFileSync(join(SORTIE, "essai.json"), masquerSecrets(JSON.stringify(resultat, null, 2), [cle]));
  console.log(`Total réel : ${total.toFixed(5)} $ (${resultat.budgetTenu ? "≤" : ">"} ${BUDGET_USD} $) · cache lu : ${resultat.cache.verifie ? "oui" : "NON"} · tirages Sonnet identiques : ${resultat.varianceSonnet.identiques ? "oui" : "non"}`);
}

main().catch((e) => {
  console.error(masquerSecrets(e instanceof Error ? e.message : String(e), [process.env.ANTHROPIC_API_KEY]));
  process.exit(1);
});
