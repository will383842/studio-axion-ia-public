#!/usr/bin/env node
// L0-18 · Coordinateur de fusion SANS IA. Commandes `gh` seulement, aucun modèle, aucun secret hors le jeton automatique du dépôt.
// Il fusionne (gh pr merge --squash) une PR de usine/* seulement si : la CI est verte, le marque « relu-<commit> » liée au commit relu est posée, aucun label
// d'attente ou sensible, aucun fichier de .github/, et le dépôt n'est pas à l'arrêt. MODE PAR DÉFAUT : « à blanc » (il liste,
// il ne fusionne ni ne pose rien) tant que COORDINATEUR_FUSION n'est pas exactement « oui ». Il ne retire jamais pilotage/ARRET.
// Il ne lit ni n'exécute jamais le code d'une PR : seulement des métadonnées renvoyées par gh.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PLAFOND_EXECUTIONS = 320;
export const PLAFOND_BRANCHES = 200;
export const SEUIL_ARRET = 0.8;
// Contrôles de la CI (workflow « verifier ») : les check runs portent le NOM DES JOBS de .github/workflows/verifier.yml.
export const CONTROLES_CI = [
  "garde de zone et de fichiers autorisés",
  "eslint et tsc différentiels",
  "règles de fer (sans IA, sans réseau)",
  "tests des fichiers touchés",
  "next build",
];
// Marque de relecture liée au commit relu : « relu-<7 à 40 premiers caractères du SHA relu> ». Le relecteur la pose sur le commit qu'il a lu ;
// si la tête de la PR a bougé depuis, la marque ne correspond plus et la PR attend une nouvelle relecture.
const MARQUE_RELU = /^relu-([0-9a-f]{7,40})$/;
// Labels qui laissent la PR au fondateur (ou en attente) : jamais fusionnée ici.
const LABELS_BLOQUANTS = ["sensible-a-fusionner", "attend-fondateur", "attend-zone", "manuel", "bloque", "a-corriger"];

const nomsLabels = (pr) => (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l?.name)).filter(Boolean);

/** Décision pure pour une PR. Retourne { action: "fusionner" | "attendre", raison }. */
export function decider(pr) {
  const attendre = (raison) => ({ action: "attendre", raison });
  if (pr.isDraft) return attendre("brouillon");
  if (pr.isCrossRepository) return attendre("venue d'un fork");
  if (pr.baseRefName !== "master") return attendre("base autre que master");
  if (!String(pr.headRefName ?? "").startsWith("usine/")) return attendre("hors branche usine/*");
  const labels = nomsLabels(pr);
  const bloquant = labels.find((l) => LABELS_BLOQUANTS.includes(l));
  if (bloquant) return attendre(`label ${bloquant}`);
  const sha = String(pr.headRefOid ?? "").toLowerCase();
  const marques = labels.map((l) => MARQUE_RELU.exec(l)?.[1]).filter(Boolean);
  if (marques.length === 0) return attendre("pas encore relue");
  if (!sha || !marques.some((m) => sha.startsWith(m))) return attendre("relue sur un autre commit que la tête actuelle");
  if ((pr.files ?? []).some((f) => String(f.path ?? "").startsWith(".github/"))) return attendre("touche .github/ : sensible");
  const verifs = pr.statusCheckRollup ?? [];
  for (const nom of CONTROLES_CI) {
    const controle = verifs.find((c) => c.name === nom);
    if (!controle || controle.status !== "COMPLETED" || controle.conclusion !== "SUCCESS") return attendre(`contrôle « ${nom} » pas vert`);
  }
  if (verifs.some((c) => c.status === "COMPLETED" && ["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED"].includes(c.conclusion))) return attendre("un contrôle est rouge");
  if (verifs.some((c) => c.status !== "COMPLETED")) return attendre("un contrôle est en cours");
  return { action: "fusionner", raison: "CI verte, relue, non sensible" };
}

/** Plafonds mesurables : arrêt à 80 %. Les jetons ne sont jamais mesurés ici : « estimation » seulement. */
export function calculerPlafonds({ branches, executions }, plafonds = {}) {
  const pb = plafonds.branches ?? PLAFOND_BRANCHES;
  const pe = plafonds.executions ?? PLAFOND_EXECUTIONS;
  return {
    branches, executions, plafondBranches: pb, plafondExecutions: pe,
    arret: branches >= pb * SEUIL_ARRET || executions >= pe * SEUIL_ARRET,
    jetons: "estimation : non mesurés ici (aucun relevé fiable)",
  };
}

const json = (t) => JSON.parse(t || "null");

/** Un tour du coordinateur. `gh(args)` renvoie la sortie texte ; `env` : variables ; aucun effet hors de gh. */
export function coordonner({ gh, env, depot, log = () => {} }) {
  const aBlanc = env.COORDINATEUR_FUSION !== "oui";
  const jour = new Date().toISOString().slice(0, 10);
  let arretPresent = false;
  try {
    gh(["api", `repos/${depot}/contents/pilotage/ARRET`]);
    arretPresent = true;
  } catch {
    arretPresent = false;
  }
  const branches = (json(gh(["api", `repos/${depot}/git/matching-refs/heads/usine/`, "--paginate"])) ?? []).length;
  const executions = json(gh(["api", `repos/${depot}/actions/runs?created=>=${jour}&per_page=1`]))?.total_count ?? 0;
  const plafonds = calculerPlafonds({ branches, executions });
  log(`branches usine/* : ${branches}/${plafonds.plafondBranches} ; exécutions du jour : ${executions}/${plafonds.plafondExecutions} ; jetons : ${plafonds.jetons}`);

  let arretPose = false;
  if (plafonds.arret && !arretPresent) {
    log("80 % d'un plafond atteint : pilotage/ARRET est nécessaire.");
    if (!aBlanc) {
      const contenu = Buffer.from(`Posé par le coordinateur sans IA le ${jour} : 80 % d'un plafond atteint. Retiré seulement par le fondateur.\n`).toString("base64");
      gh(["api", "-X", "PUT", `repos/${depot}/contents/pilotage/ARRET`, "-f", "message=Arrêt : 80 % d'un plafond", "-f", `content=${contenu}`]);
      arretPose = true;
    }
  }

  const fusionnables = [];
  const numeros = (json(gh(["pr", "list", "--state", "open", "--base", "master", "--json", "number", "--limit", "100", "--repo", depot])) ?? []).map((p) => p.number);
  for (const n of numeros) {
    const pr = json(gh(["pr", "view", String(n), "--json", "number,isDraft,headRefName,headRefOid,baseRefName,isCrossRepository,labels,statusCheckRollup,files", "--repo", depot]));
    const d = decider(pr);
    log(`PR ${n} : ${d.action} (${d.raison})`);
    if (d.action !== "fusionner") continue;
    fusionnables.push(n);
    if (aBlanc || arretPresent || plafonds.arret) continue;
    gh(["pr", "merge", String(n), "--squash", "--match-head-commit", pr.headRefOid, "--repo", depot]);
    log(`PR ${n} fusionnée (squash).`);
  }
  if (aBlanc) log("Mode à blanc : rien n'a été fusionné ni posé. Réglage COORDINATEUR_FUSION=oui pour l'allumer.");
  return { aBlanc, fusionnables, arretPose, arretNecessaire: plafonds.arret, arretPresent, plafonds };
}

const ghReel = (args) => execFileSync("gh", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const depot = process.env.GITHUB_REPOSITORY;
  if (!depot) {
    console.error("GITHUB_REPOSITORY absent");
    process.exit(1);
  }
  coordonner({ gh: ghReel, env: process.env, depot, log: (m) => console.log(m) });
}
