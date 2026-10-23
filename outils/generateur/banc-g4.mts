/**
 * BANC DE FIN DE LOT G4 (plan v5 B.7.7 ; ordres de Will du 03/10) — APPELS RÉELS, BUDGET BORNÉ.
 *
 *   pnpm exec tsx --conditions=react-server outils/generateur/banc-g4.mts --tour 1 [--sujets 1,2,3] [--budget 2.2]
 *       [--deux-corps 1,3] [--juger] [--sortie docs/captures/g4-banc]
 *
 * - Clé lue dans `~/.claude/secrets/studio.env` (ou l'environnement), JAMAIS affichée ni écrite.
 * - Budget : avant CHAQUE appel, dépensé + pire cas du rôle ; au-delà du budget, rien ne part et le banc s'arrête
 *   proprement (ce qui est écrit est gardé). Le coût réel de chaque appel est additionné (modèle renvoyé).
 * - Les 3 sujets de `tests/generateur/banc/registre-banc-g4.ts` (TEST) s'enchaînent dans UNE série (diversité).
 * - `--juger` : notation à l'AVEUGLE par des juges indépendants (Sonnet, deux ordres, et Opus) des versions produites
 *   face à 3 transcriptions de vidéos modèles (D01, D08, D06), sur la grille /100 de B.7.5.
 * - Sorties : `<sortie>/tour-<n>/` (scripts lisibles, états, journal des appels : temps et coût), sorties brutes des
 *   rôles dans `<sortie>/tour-<n>/brut/` (anonymisées ensuite en fixtures par `exporter-fixtures-g4.mts`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { elementDiversite, type ElementDiversite } from "../../src/domaine/controles-script/diversite";
import { raconteUnClient } from "../../src/domaine/controles-script/probleme";
import { envoyerMessage, ErreurClaude } from "../../src/fournisseurs/claude/client";
import { lireSortie } from "../../src/fournisseurs/claude/inscription";
import { masquerSecrets } from "../../src/fournisseurs/claude/secret";
import { coutUsd, MODELE_ECRITURE, MODELE_JUGE } from "../../src/fournisseurs/claude/tarifs";
import { executerChaine, texteVersion, type EtatChaine, type ExecuteurRoles, type SortieExecution } from "../../src/generateur/chaine";
import { construireRequete, pireCasRole, type DefinitionRole, type EntreeRole } from "../../src/generateur/roles/types";
import { CONTEXTE_BANC, SUJETS_BANC } from "../../tests/generateur/banc/registre-banc-g4";
import { etapeZeroBanc, TOURNURES_G4 } from "../../tests/helpers/g4";

const args = process.argv.slice(2);
const arg = (n: string, d?: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "1") : d;
};
const TOUR = arg("tour", "1")!;
const BUDGET = Number(arg("budget", "2.2"));
const SUJETS = (arg("sujets", "1,2,3") ?? "").split(",").map(Number).filter(Boolean);
const DEUX_CORPS = new Set((arg("deux-corps", "1") ?? "").split(",").map(Number));
const JUGER = args.includes("--juger");
const SORTIE = join(process.cwd(), arg("sortie", "docs/captures/g4-banc")!, `tour-${TOUR}`);
const BRUT = join(SORTIE, "brut");
mkdirSync(BRUT, { recursive: true });

function lireCle(): string {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return env;
  const f = join(homedir(), ".claude", "secrets", "studio.env");
  const ligne = existsSync(f) ? readFileSync(f, "utf8").split(/\r?\n/).find((l) => l.startsWith("ANTHROPIC_API_KEY=")) : undefined;
  const cle = ligne?.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!cle) throw new Error("ANTHROPIC_API_KEY absente.");
  return cle;
}
const SIMULATION = args.includes("--simulation");
const REJOUER = args.flatMap((x, i) => (args[i - 1] === "--rejouer" ? [x] : [])).map((x) => ({ role: x.split(":")[0], fichier: x.split(":")[1], utilise: false }));
const SEP = String.fromCharCode(10, 10);
const LANCEMENT = new Date().toISOString().slice(11, 19).replace(/:/g, "");
const CLE = SIMULATION ? "" : lireCle();

/* ---------- Exécutant réel, budget borné ---------- */
interface Appel {
  sujet: string;
  role: string;
  modele: string;
  dureeMs: number;
  coutUsd: number;
  jetons: unknown;
  stop: string | null;
  invalide?: string;
}
const journal: Appel[] = [];
let depense = 0;
let sujetCourant = "";
let nBrut = 0;


const executeur: ExecuteurRoles = {
  async executer<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<SortieExecution<z.infer<S>>> {
    // `--rejouer role:fichier` : une sortie déjà PAYÉE (enregistrée dans brut/) est rejouée à 0 $, une fois.
    const rejeu = REJOUER.find((x) => x.role === role.id && !x.utilise);
    if (rejeu) {
      rejeu.utilise = true;
      const sortie = JSON.parse(readFileSync(join(BRUT, rejeu.fichier), "utf8")).sortie;
      console.log(`  ${role.id.padEnd(12)} rejoué depuis ${rejeu.fichier} (0 $, déjà payé)`);
      return { ok: true, donnees: role.schema ? (role.schema.parse(sortie) as z.infer<S>) : undefined, coutUsd: 0, modele: "rejeu", stopReason: "end_turn" };
    }
    const pire = pireCasRole(role, entree);
    if (SIMULATION) {
      const req = construireRequete(role, entree);
      const tailles = req.systeme.map((b) => b.texte.length);
      console.log(`  [sim] ${role.id} système ${tailles.join("+")} car., variable ${entree.variable.length} car., pire cas ${pire.toFixed(3)} $`);
      if (args.includes("--montrer") && !existsSync(join(BRUT, `requete-${role.id}.txt`))) writeFileSync(join(BRUT, `requete-${role.id}.txt`), [...req.systeme.map((b) => b.texte), "=== VARIABLE ===", entree.variable].join(SEP));
      const brut = role.simuler(entree);
      return { ok: true, donnees: (role.schema ? role.schema.parse(brut) : undefined) as z.infer<S>, coutUsd: 0, modele: "simulation", stopReason: "end_turn" };
    }
    if (depense + pire > BUDGET) {
      console.log(`Budget : ${depense.toFixed(3)} $ + pire cas ${pire.toFixed(3)} $ > ${BUDGET} $ : arrêt avant « ${role.id} ».`);
      return { ok: false, arret: "plafond-atteint", message: "Budget du banc atteint." };
    }
    const debut = Date.now();
    for (let essai = 1; ; essai++) {
      try {
        const rep = await envoyerMessage(construireRequete(role, entree), { cle: CLE, delaiInactiviteMs: 150_000, delaiTotalMs: 300_000 });
        const r = lireSortie(role, rep);
        let cout = coutUsd(rep.jetons, rep.modele);
        if (rep.modele !== rep.modeleDemande) cout = Math.max(cout, coutUsd(rep.jetons, rep.modeleDemande));
        depense += cout;
        const a: Appel = { sujet: sujetCourant, role: role.id, modele: rep.modele, dureeMs: Date.now() - debut, coutUsd: +cout.toFixed(5), jetons: rep.jetons, stop: rep.stopReason, invalide: r.invalide };
        journal.push(a);
        console.log(`  ${role.id.padEnd(12)} ${rep.modele} ${(a.dureeMs / 1000).toFixed(1)} s ${cout.toFixed(4)} $ (total ${depense.toFixed(3)} $)${r.invalide ? ` INVALIDE ${r.invalide}` : ""}`);
        writeFileSync(join(BRUT, `${sujetCourant}-${LANCEMENT}-${String(++nBrut).padStart(3, "0")}-${role.id}.json`), JSON.stringify({ role: role.id, version: role.version, sortie: r.donnees ?? rep.texte }, null, 1));
        return { ok: true, donnees: r.donnees, invalide: r.invalide, marqueur: r.marqueur, coutUsd: cout, modele: rep.modele, stopReason: rep.stopReason };
      } catch (e) {
        const err = e instanceof ErreurClaude ? e : null;
        if (err?.code === "surcharge" && essai < 3) {
          await new Promise((r) => setTimeout(r, 3000 * essai));
          continue;
        }
        if (err?.code === "facturation") return { ok: false, arret: "en-attente-credit", message: err.message };
        if (err?.code === "modele-introuvable") return { ok: false, arret: "bloquee-modele", message: err.message };
        throw new Error(masquerSecrets((e as Error).message, [CLE]));
      }
    }
  },
};

/* ---------- Rendu lisible ---------- */
function rendreSujet(code: string, titre: string, etat: EtatChaine, statut: string): string {
  const l: string[] = [`# ${titre}`, "", `Statut : **${statut}**${etat.arret ? ` · arrêt ${etat.arret.type} à l'étape ${etat.arret.etape} : ${etat.arret.message}` : ""} · coût réel : **${etat.coutUsd.toFixed(3)} $**`, ""];
  const a = etat.stratege?.angles[etat.angleRetenu ?? 0];
  if (a) l.push("## Angle retenu", "", `**${a.titre}** (${a.structure}, ${a.typeAngle}, ${a.intensite})`, "", `- Problème : ${a.probleme}`, `- Coût : ${a.cout}`, `- Issue : ${a.issue}`, `- Cible : ${a.cible}`, "");
  if (etat.fond) l.push("## Fond", "", `- Mot-clé : ${etat.fond.motCle} · livraison : ${etat.fond.livraison}`, `- Exception (${etat.fond.exception.source}) : ${etat.fond.exception.texte || "—"}`, `- Envoi : ${etat.fond.envoi.destinataireRole} · ${etat.fond.envoi.phrase}`, "");
  if (etat.finalistes) l.push("## Accroches finalistes", "", ...etat.finalistes.map((f) => `- [${f.famille}] ${f.dit} (oui juge : ${f.ouiJuge})`), "", `Exclues par le code : ${(etat.exclues ?? []).map((x) => `${x.id} (${x.raisons.join(", ")})`).join(" ; ") || "aucune"}`, "");
  if (etat.preference) l.push(`Duel PREF-01 : A/B ${etat.preference.ordreAB}, B/A ${etat.preference.ordreBA} → gagnant ${etat.preference.gagnant}`, "");
  for (const v of etat.versions ?? []) {
    l.push(`## Version ${v.reseau} · ${v.dureeSec} s · note code ${v.note.globale} (${v.note.voyant})`, "", "```", texteVersion(etat, v), "```", "");
    l.push(`Encadré : ${v.declinaison.encadre} · appel ${v.appel.type}${v.appel.selonObjectif ? "" : " (défaut du réseau)"} · boucle : ${v.boucle ? v.declinaison.boucle : "aucune"}`, "");
    l.push(`Publication : ${v.declinaison.publication.texte.replace(/\n+/g, " / ")}`, "");
    if (v.declinaison.publication.post) l.push(`Post : ${v.declinaison.publication.post.texte.replace(/\n+/g, " / ")}`, "");
    if (v.prompteur) l.push("Téléprompteur :", "```", v.prompteur, "```", "");
    const viol = v.violations.filter((x) => x.niveau !== "info");
    l.push(`Contrôles : ${viol.length ? viol.map((x) => `${x.controle} (${x.niveau}) ${x.message}`).join(" ; ") : "aucun écart"}`, "");
    const ech = v.verdicts?.reponses.filter((r) => r.reponse === "non" || r.reponse === "oui").map((r) => `${r.id}=${r.reponse}`).join(", ");
    if (ech) l.push(`Juge (étape 12) : ${ech}`, "");
  }
  const k = etat.corps?.[etat.gagnant ?? 0];
  if (k?.verdicts) l.push("## Juges du corps (étape 9, indicatifs)", "", ...k.verdicts.elements[0].reponses.map((r) => `- ${r.id} : ${r.reponse} — ${r.motif}`), "");
  return l.join("\n");
}

/* ---------- Déroulé ---------- */
const serie: ElementDiversite[] = [];
function ajouterASerie(etat: EtatChaine, rupture?: ElementDiversite["rupture"]): void {
  const v = etat.versions?.[0];
  if (!v) return;
  const k = etat.corps?.[etat.gagnant ?? 0];
  const corps = (k?.blocs ?? []).flatMap((b) => b.segments.map((x) => x.texte));
  serie.push(elementDiversite({ accroche: v.declinaison.accroche, appel: v.appel.texte, boucle: v.boucle ? v.declinaison.boucle : "", derniereInfo: corps.at(-1) ?? "", texte: texteVersion(etat, v), recit: raconteUnClient(corps.join(" ")), intensite: etat.stratege?.angles[etat.angleRetenu ?? 0]?.intensite, rupture }));
}
const resultats: { code: string; statut: string; coutUsd: number; dureeMs: number; etat: EtatChaine }[] = [];
for (const n of SUJETS) {
  const s = SUJETS_BANC[n - 1];
  sujetCourant = s.code;
  console.log(`\n=== Sujet ${n} : ${s.code} ===`);
  const z0 = etapeZeroBanc(s, serie, s.code === "sujet-excel-de-will" ? { mode: "teleprompteur" } : {});
  if (!z0.ok) {
    console.log(`Étape 0 : ${z0.manque.type} (0 $) : ${z0.manque.ceQuIlFaudrait}`);
    resultats.push({ code: s.code, statut: `arret-etape-0 ${z0.manque.type}`, coutUsd: 0, dureeMs: 0, etat: { version: 1, etape: 0, coutUsd: 0, journal: [] } });
    continue;
  }
  console.log(`Étape 0 : ${z0.donnees.combinaisons.map((c) => `${c.structure}/${c.ancrages[0]?.type}`).join(", ")} ; diversité : ${JSON.stringify(z0.donnees.diversite)}`);
  const debut = Date.now();
  const fichierEtat = join(SORTIE, `${s.code}.json`);
  const reprise = args.includes("--reprendre") && existsSync(fichierEtat) ? (JSON.parse(readFileSync(fichierEtat, "utf8")) as { statut: string; etat: EtatChaine }) : null;
  if (reprise?.statut === "terminee") {
    console.log("Déjà terminé : repris tel quel.");
    resultats.push({ code: s.code, statut: "terminee", coutUsd: reprise.etat.coutUsd, dureeMs: 0, etat: reprise.etat });
    ajouterASerie(reprise.etat, z0.donnees.diversite?.rupture);
    continue;
  }
  if (reprise) {
    // Après une correction du code ou des consignes : on repart de la dernière étape TERMINÉE (rien n'est repayé avant).
    delete reprise.etat.arret;
    if (reprise.etat.etape < 6) delete reprise.etat.corps;
    console.log(`Reprise depuis l'étape ${reprise.etat.etape} (${reprise.etat.coutUsd.toFixed(3)} $ déjà payés).`);
  }
  const r = await executerChaine(z0.donnees, executeur, {
    deuxCorps: DEUX_CORPS.has(n),
    tiragesJuges: 1,
    toursCorrection: Number(arg("tours", "1")),
    reecriture: !args.includes("--sans-reecriture"),
    rejuge: !args.includes("--sans-rejuge"),
    tournures: TOURNURES_G4,
    contexteWill: { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues },
  }, reprise?.etat, async (e) => writeFileSync(fichierEtat, JSON.stringify({ statut: "en-cours", etat: e, choix: z0.donnees.combinaisons, diversite: z0.donnees.diversite }, null, 1)));
  const dureeMs = Date.now() - debut;
  resultats.push({ code: s.code, statut: r.statut, coutUsd: r.etat.coutUsd, dureeMs, etat: r.etat });
  writeFileSync(join(SORTIE, `${s.code}.json`), JSON.stringify({ statut: r.statut, etat: r.etat, choix: z0.donnees.combinaisons, diversite: z0.donnees.diversite }, null, 1));
  writeFileSync(join(SORTIE, `${s.code}.md`), rendreSujet(s.code, s.titre, r.etat, r.statut));
  console.log(`→ ${r.statut} en ${(dureeMs / 1000).toFixed(0)} s, ${r.etat.coutUsd.toFixed(3)} $`);
  ajouterASerie(r.etat, z0.donnees.diversite?.rupture);
  if (r.statut === "attente") break;
}
writeFileSync(join(SORTIE, "serie-diversite.json"), JSON.stringify(serie, null, 1));

/* ---------- Notation à l'aveugle face aux vidéos modèles ---------- */
const schemaNotes = z.object({ notes: z.array(z.object({ id: z.string(), total: z.number(), accroche: z.number(), defauts: z.array(z.string()) })) });
let aveugle: unknown = null;
if (JUGER) {
  const avocatref = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "g3-avocatref-transcriptions.json"), "utf8")).videos as { code: string; segments: { texte: string }[] }[];
  const modeles = ["D01", "D02", "D03"].map((c) => ({ source: `modele-${c}`, texte: avocatref.find((x) => x.code === c)!.segments.map((s) => s.texte).join(" ") }));
  const nos = resultats.flatMap((r) => {
    const v = [...(r.etat.versions ?? [])].sort((a, b) => b.note.globale - a.note.globale)[0];
    return v ? [{ source: `banc-${r.code}-${v.reseau}`, texte: texteVersion(r.etat, v).replace(/\n/g, " ") }] : [];
  });
  const tous = [...nos, ...modeles];
  const lettres = "ABCDEFGHIJ";
  const melange = (graine: number) => tous.map((t, i) => ({ t, k: (i * 7 + graine * 3) % 11 })).sort((a, b) => a.k - b.k).map((x) => x.t);
  const consigne =
    "Tu es un juge indépendant : directeur éditorial de courtes vidéos face caméra d'experts (droit, conseil, entreprise). On te donne des textes DITS, anonymes, de sujets différents. Note chacun sur 100 selon cette grille, sans tenir compte du sujet ni de l'expertise juridique : accroche 20, preuve et ancrage concret 12, rétention (chaque phrase relance) 12, envie de l'envoyer 10, livraison nette 8, mot-clé clair 8, oralité naturelle 8, appel ou fin 6, émotion juste 6, concret 4, ton posé 4, structure 2. Sois exigeant : 85 = publiable tel quel par un professionnel. Donne aussi la note de l'accroche /20 et 1 à 3 défauts précis par texte.";
  const juges: { id: string; modele: string; graine: number }[] = [
    { id: "juge-sonnet-ordre-1", modele: MODELE_JUGE, graine: 1 },
    { id: "juge-sonnet-ordre-2", modele: MODELE_JUGE, graine: 5 },
    { id: "juge-opus", modele: MODELE_ECRITURE, graine: 9 },
  ].filter((j) => !args.includes("--sans-opus") || j.modele !== MODELE_ECRITURE);
  const sorties: { juge: string; notes: { source: string; total: number; accroche: number; defauts: string[] }[] }[] = [];
  sujetCourant = "aveugle";
  for (const j of juges) {
    const ordre = melange(j.graine);
    const role: DefinitionRole<typeof schemaNotes> = { id: `aveugle-${j.id}`, version: 1, consigne, schema: schemaNotes, modele: j.modele, effort: "medium", maxTokens: 2000, simuler: () => ({ notes: [] }) };
    const variable = ordre.map((t, i) => `<texte id="${lettres[i]}">${t.texte}</texte>`).join("\n");
    const r = await executeur.executer(role, { contexte: {}, variable });
    if (!r.ok || !r.donnees) break;
    sorties.push({ juge: j.id, notes: r.donnees.notes.map((n) => ({ source: ordre[lettres.indexOf(n.id)]?.source ?? n.id, total: n.total, accroche: n.accroche, defauts: n.defauts })) });
  }
  const moyenne = (pref: string) => {
    const xs = sorties.flatMap((s) => s.notes.filter((n) => n.source.startsWith(pref)).map((n) => n.total));
    return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null;
  };
  aveugle = { textes: tous.map((t) => t.source), juges: sorties, moyenneBanc: moyenne("banc-"), moyenneModeles: moyenne("modele-"), parTexte: tous.map((t) => ({ source: t.source, moyenne: moyenne(t.source) })) };
  writeFileSync(join(SORTIE, "notes-aveugle.json"), JSON.stringify(aveugle, null, 1));
  writeFileSync(join(SORTIE, "textes-juges.md"), tous.map((t) => `## ${t.source}\n\n${t.texte}\n`).join("\n"));
}

const synthese = {
  tour: TOUR,
  le: new Date().toISOString(),
  budgetUsd: BUDGET,
  depenseUsd: +depense.toFixed(4),
  sujets: resultats.map((r) => ({ code: r.code, statut: r.statut, coutUsd: +r.coutUsd.toFixed(4), dureeSec: Math.round(r.dureeMs / 1000), versions: r.etat.versions?.map((v) => ({ reseau: v.reseau, dureeSec: v.dureeSec, note: v.note.globale, voyant: v.note.voyant, bloquants: v.violations.filter((x) => x.bloquant).map((x) => x.controle) })) })),
  appels: journal,
  aveugle,
};
writeFileSync(join(SORTIE, "synthese.json"), JSON.stringify(synthese, null, 1));
console.log(`\nDépense réelle du tour : ${depense.toFixed(3)} $`);
