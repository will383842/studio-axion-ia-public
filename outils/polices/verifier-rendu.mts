/**
 * POLICES-P3-b — outil LOCAL (lancé à la main, jamais en CI, jamais par le Studio) : ouvre une composition dans le
 * navigateur déjà présent sur le poste et dit, pour chaque texte visible, quelle famille est demandée et si elle est
 * vraiment chargée. Le calcul est dans `analyse.ts` (pur, testé en CI).
 *
 * Usage (racine) :
 *   pnpm exec tsx outils/polices/verifier-rendu.mts --composition planche-etiquettes-9x16-ivoire --entree planche --sortie /tmp/polices
 * `--entree planche` : studio-rendu/compositions/petits-objets/planche/entree.ts ; `--entree racine` : studio-rendu/compositions/index.ts.
 * `--sortie` : dossier HORS du dépôt (reçoit le relevé JSON). Navigateur : STUDIO_RENDU_NAVIGATEUR, puis /opt/pw-browsers/chromium-* ;
 * JAMAIS téléchargé. Une entrée Remotion temporaire est créée dans `studio-rendu/.verif-polices-tmp/` (non suivie) puis supprimée.
 * Piège : `document.fonts.check()` répond vrai pour une famille inconnue ; on regarde `document.fonts` avec `status === "loaded"`.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { analyserPolices, decouperPile, type ReleveTexte } from "./analyse.ts";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const MARQUE = "POLICES-RELEVE ";

function argument(nom: string): string | undefined {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function trouverNavigateur(): string | null {
  const env = process.env.STUDIO_RENDU_NAVIGATEUR;
  if (env) return existsSync(env) ? env : null;
  const base = "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  const dossier = readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().pop();
  if (dossier) for (const sous of ["chrome-linux/chrome", "chrome-linux64/chrome"]) if (existsSync(join(base, dossier, sous))) return join(base, dossier, sous);
  return existsSync(join(base, "chromium")) ? join(base, "chromium") : null;
}

const composition = argument("--composition");
const entreeNom = argument("--entree") ?? "planche";
const sortieArg = argument("--sortie");
const ENTREES: Record<string, string> = {
  planche: join(RACINE, "studio-rendu", "compositions", "petits-objets", "planche", "entree.ts"),
  racine: join(RACINE, "studio-rendu", "compositions", "index.ts"),
};
if (!composition || !sortieArg || !ENTREES[entreeNom]) {
  console.error("Usage : --composition <id> --entree <planche|racine> --sortie <dossier hors du dépôt>");
  process.exit(2);
}
const SORTIE = resolve(sortieArg);
const rel = relative(RACINE, SORTIE);
if (rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep) && !/^[A-Za-z]:/.test(rel))) {
  console.error("--sortie doit être HORS du dépôt.");
  process.exit(2);
}
const navigateur = trouverNavigateur();
if (!navigateur) {
  console.error("BLOQUÉ : aucun Chromium local (STUDIO_RENDU_NAVIGATEUR ou /opt/pw-browsers) ; rien n'est téléchargé.");
  process.exit(3);
}
mkdirSync(SORTIE, { recursive: true });

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string; ignoreRegisterRootWarning?: boolean }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: Record<string, unknown>) => Promise<unknown>;
  renderStill: (o: Record<string, unknown>) => Promise<unknown>;
};

// Sonde injectée dans la page : retient le rendu (`delayRender`) jusqu'à ce que `document.fonts.ready` soit passé et que du texte
// soit posé, puis relève chaque nœud de texte visible (le dernier relevé non vide fait foi).
const SONDE = `
import { continueRender, delayRender } from "remotion";
const nettoyer = (f) => f.trim().replace(/^["']+|["']+$/g, "").trim();
const releve = () => {
  const chargees = Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => nettoyer(f.family));
  const sortie = [];
  const arbre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = arbre.nextNode(); n; n = arbre.nextNode()) {
    const texte = (n.textContent || "").trim();
    const el = n.parentElement;
    if (!texte || !el) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0 || r.width === 0 || r.height === 0) continue;
    sortie.push({ texte: texte.slice(0, 60), pile: s.fontFamily, chargees });
  }
  return sortie;
};
const attente = delayRender("polices : relevé du navigateur", { timeoutInMilliseconds: 60000 });
const lancer = async () => {
  await document.fonts.ready;
  for (let i = 0; i < 100; i += 1) {
    const lignes = releve();
    if (lignes.length > 0) {
      await document.fonts.ready;
      console.log(${JSON.stringify(MARQUE)} + JSON.stringify(releve()));
      break;
    }
    await new Promise((ok) => setTimeout(ok, 100));
  }
  continueRender(attente);
};
lancer();
`;

const dossierTmp = join(RACINE, "studio-rendu", ".verif-polices-tmp");
mkdirSync(dossierTmp, { recursive: true });
const entreeTmp = join(dossierTmp, "index.ts");
let dernier: { texte: string; pile: string; chargees: string[] }[] = [];
let code = 0;
try {
  writeFileSync(entreeTmp, `import ${JSON.stringify(ENTREES[entreeNom])};\n${SONDE}\n`);
  const serveUrl = await bundle({ entryPoint: entreeTmp, ignoreRegisterRootWarning: true });
  const nav = { browserExecutable: navigateur };
  const comp = await selectComposition({ serveUrl, id: composition, inputProps: {}, ...nav });
  const dossierImage = mkdtempSync(join(SORTIE, "rendu-"));
  const onBrowserLog = (log: { text: string }) => {
    if (!log.text.startsWith(MARQUE)) return;
    try {
      const lu = JSON.parse(log.text.slice(MARQUE.length)) as typeof dernier;
      if (lu.length > 0) dernier = lu;
    } catch {
      /* ligne tronquée : on garde la précédente */
    }
  };
  await renderStill({ composition: comp, serveUrl, output: join(dossierImage, "image.png"), frame: 0, inputProps: {}, onBrowserLog, chromiumOptions: { gl: "swangle" }, ...nav });
  rmSync(dossierImage, { recursive: true, force: true });
  if (dernier.length === 0) {
    console.error("BLOQUÉ : la sonde n'a rien relevé (onBrowserLog n'a reçu aucune ligne). Pas de contournement par une dépendance neuve.");
    code = 4;
  } else {
    const releves: ReleveTexte[] = dernier.map((d) => ({ texte: d.texte, famillesDemandees: decouperPile(d.pile), chargees: d.chargees }));
    const analyse = analyserPolices(releves);
    writeFileSync(join(SORTIE, `${composition}.json`), JSON.stringify({ composition, textes: releves.length, chargees: [...new Set(dernier.flatMap((d) => d.chargees))], ...analyse }, null, 2));
    console.log(`${composition} : ${releves.length} textes, ${analyse.ecarts.length} écart(s), polices rendues : ${analyse.policesRendues.join(" | ")}`);
    for (const e of analyse.ecarts) console.log(`  écart : « ${e.texte} » demande « ${e.demandee} » (${e.motif}), rendu : ${e.rendue}`);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
process.exit(code);
