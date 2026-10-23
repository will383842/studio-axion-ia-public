/**
 * CORRECTEUR 3 (audit B, 03/10) : plus aucun texte de script SIMULÉ quand Claude est relié.
 *  - B1 : « Une idée » › « Écrire le texte » ouvre le vrai générateur (écran Sujet, idée remplie, retour à la vidéo) ;
 *         le texte d'une version revient dans la vidéo, mot pour mot. L'ancien `generer` simulé est refusé si Claude est relié.
 *  - B2 : l'icône « En faire une vidéo » des Idées mène à la même vraie chaîne.
 *  - B10 : /scripts/<id> : note et « Améliorer » simulés masqués quand Claude est relié (aucun rôle adapté à un texte
 *          seul) ; un texte rattaché à un sujet renvoie à ses retouches réelles, prix affiché.
 *  - B14 : « Ranger pour moi » (simulé) : masqué et refusé quand Claude est relié, marqué « Essai » sinon.
 *  - B9, B11, B16 : message d'essai seulement sans Claude, prix calculés, code mort supprimé.
 * Claude « relié » = choisi + clé d'essai ; son `fetch` refuse tout appel (AUCUN appel réseau, AUCUNE vraie clé).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "./helpers/g0";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const scripts = await import("@/services/scripts");
const mat = await import("@/services/matieres");
const { ecrireParametre } = await import("@/services/_commun");
const { assemblerBlocs, texteDesBlocs } = await import("@/domaine/derivations-generateur");
const { lienEcrireTexte, lienRetourAvecVersion, lienSujet, retourAssistant, retourValide } = await import("@/domaine/retour-video");
const { formatAvocat } = await import("@/formats/avocat");

const MDP = "essai-c3-scripts";
const RACINE = join(__dirname, "..");
const src = (f: string) => readFileSync(join(RACINE, f), "utf8");
let appelsReseau = 0;
const fetchInterdit = (async () => {
  appelsReseau++;
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  appelsReseau = 0;
  await auth.seConnecter(MDP, false);
  // Lot A5 : réglage absent = chaîne courte ; ce test éprouve la GRANDE chaîne, il la demande donc expressément.
  // Lot L5 : ces tests écrivent plusieurs fois le même sujet de banc ; le contrôle « déjà traité » n'est pas leur objet.
  await ecrireParametre("sujets.garde", "eteint");
  (await import("@/services/generation-claude")).forcerChainePourEssai("grande");
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  bg.arreterBoucleGeneration();
  gc.injecterClaudePourEssai(null);
});

async function relierClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  expect(await gc.claudeBranche()).toBe(true);
}

const BLOC = { id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre patron lit vos mails ?" }] };

describe("B1 · « Une idée » › « Écrire le texte » passe par le vrai générateur", () => {
  it("l'ancien `generer` (textes types simulés) est refusé quand Claude est relié, sans aucun appel", async () => {
    await relierClaude();
    await expect(scripts.genererScripts({ formatId: "avocat", sujet: "Votre patron lit vos mails" })).rejects.toThrow(/« Écrire »/);
    expect(appelsReseau).toBe(0);
  });

  it("sans Claude, l'essai reste possible (0 €)", async () => {
    expect((await scripts.genererScripts({ formatId: "avocat", sujet: "Votre patron lit vos mails" })).length).toBe(3);
  });

  it("liens : écran Sujet avec l'idée, retour à la vidéo seulement vers l'assistant", () => {
    expect(lienEcrireTexte({ idee: "Relancer les devis", retour: "/nouvelle/avocat?brouillon=video-1" })).toBe("/ecrire/atelier?texte=Relancer+les+devis&retour=%2Fnouvelle%2Favocat%3Fbrouillon%3Dvideo-1");
    expect(lienEcrireTexte({ ideeId: "idee-1", retour: "/nouvelle/avocat" })).toBe("/ecrire/atelier?idee=idee-1&retour=%2Fnouvelle%2Favocat");
    expect(retourValide("https://exemple.fr/nouvelle/avocat")).toBeUndefined();
    expect(retourValide("//exemple.fr")).toBeUndefined();
    expect(retourValide("/nouvelle/avocat?brouillon=x&y=1")).toBeUndefined();
    expect(retourAssistant("avocat", "video-1")).toBe("/nouvelle/avocat?brouillon=video-1");
    expect(lienSujet("sujet-1", "/nouvelle/avocat")).toBe("/ecrire/sujets/sujet-1?retour=%2Fnouvelle%2Favocat");
    expect(lienRetourAvecVersion("/nouvelle/avocat?brouillon=video-1", "var-1")).toBe("/nouvelle/avocat?brouillon=video-1&variante=var-1");
    expect(lienRetourAvecVersion("/nouvelle/avocat", "var-1")).toBe("/nouvelle/avocat?variante=var-1");
    expect(lienRetourAvecVersion("https://exemple.fr", "var-1")).toBeUndefined();
  });

  it("le texte d'une version écrite par le générateur revient dans la vidéo, mot pour mot", async () => {
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: SUJETS_BANC[0].reseaux, formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" } as never);
    expect(r.ok).toBe(true);
    await bg.tourBoucleGeneration();
    const [v] = await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId && !x.archiveLe);
    const script = (await depots().scripts.obtenir(v.scriptId))!;
    const t = await scripts.texteDeVersionPourVideo(v.id);
    expect(t.formatId).toBe("avocat");
    expect(texteDesBlocs(t.blocs)).toBe(texteDesBlocs(assemblerBlocs(script, v)));
    expect(t.sujet.length).toBeGreaterThan(3);
  });

  it("écrans : l'assistant n'appelle plus `generer` ; l'idée part vers l'écran Sujet et revient avec la version", () => {
    const etape = src("src/assistant/etapes/Script.tsx");
    expect(etape).not.toMatch(/genererScriptsAction/);
    expect(etape).toMatch(/lienEcrireTexte\(/);
    expect(src("src/app/(studio)/ecrire/atelier/page.tsx")).toMatch(/retourValide\(sp\.retour\)/);
    expect(src("src/components/generateur/EcranSujet.tsx")).toMatch(/lienSujet\(/);
    expect(src("src/app/(studio)/ecrire/sujets/[id]/page.tsx")).toMatch(/retourValide\(sp\.retour\)/);
    expect(src("src/components/generateur/FicheSujet.tsx")).toMatch(/Utiliser dans ma vidéo/);
    const page = src("src/app/(studio)/nouvelle/[format]/page.tsx");
    expect(page).toMatch(/texteDeVersionPourVideo\(sp\.variante\)/);
    // Le texte revenu n'est pas encore en base : il doit être enregistré au premier passage.
    expect(src("src/assistant/Assistant.tsx")).toMatch(/useRef\(initial\.scriptId \? JSON\.stringify\(initial\.blocs\) : ""\)/);
  });
});

describe("B2 · « En faire une vidéo » (Idées) mène à la vraie chaîne", () => {
  it("l'icône ouvre l'écran Sujet avec l'idée et le retour à la vidéo, plus l'ancien assistant simulé", () => {
    const s = src("src/components/ecrire/OngletIdees.tsx");
    expect(s).not.toMatch(/href=\{`\/nouvelle\/\$\{formatVideo\}\?idee=/);
    expect(s).toMatch(/lienEcrireTexte\(\{ ideeId: i\.id, retour: retourAssistant\(formatVideo\) \}\)/);
  });
});

describe("B10 · /scripts/<id> : note et « Améliorer »", () => {
  it("« Améliorer » et la note simulés sont refusés quand Claude est relié ; une version enregistrée n'a plus de note inventée", async () => {
    await relierClaude();
    await expect(scripts.ameliorerBloc("avocat", BLOC, "ameliorer")).rejects.toThrow(/« Écrire »/);
    await expect(scripts.noterScriptEssai(formatAvocat.id, [BLOC], 45)).rejects.toThrow(/« Écrire »/);
    const id = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Mails", blocs: [BLOC] });
    const m = await scripts.modifierScript(id, { blocs: [{ ...BLOC, segments: [{ id: "s1", texte: "Votre patron peut-il lire vos mails ?" }] }] });
    expect(m.notes).toBeUndefined();
    expect(appelsReseau).toBe(0);
  });

  it("sans Claude, l'essai reste possible", async () => {
    expect((await scripts.ameliorerBloc("avocat", BLOC, "ameliorer")).segments.length).toBeGreaterThan(0);
    expect((await scripts.noterScriptEssai("avocat", [BLOC], 45)).globale).toBeGreaterThan(0);
  });

  it("écrans : la fiche masque la note et « Améliorer » quand Claude est relié, et renvoie aux retouches réelles du sujet", () => {
    const fiche = src("src/components/ecrire/FicheScript.tsx");
    expect(fiche).toMatch(/ecritureReelle/);
    expect(fiche).toMatch(/ameliorer=\{ecritureReelle \? undefined :/);
    expect(fiche).toMatch(/\/ecrire\/sujets\/\$\{script\.scriptMaitreId\}/);
    expect(src("src/app/(studio)/scripts/[id]/page.tsx")).toMatch(/claudeBranche\(\)/);
    const etape = src("src/assistant/etapes/Script.tsx");
    expect(etape).toMatch(/ameliorer=\{ecritureReelle \? undefined :/);
  });
});

describe("B14 · « Ranger pour moi »", () => {
  it("refusé quand Claude est relié (aucun rôle réel : on ne montre pas un rangement inventé)", async () => {
    await relierClaude();
    await expect(mat.rangerPourMoi("Une phrase. Une autre phrase.")).rejects.toThrow(/Découper/);
  });
  it("sans Claude : essai permis, marqué comme tel", async () => {
    expect((await mat.rangerPourMoi("Une phrase. Une autre phrase.")).simule).toBe(true);
    const s = src("src/components/matieres/FeuilleEnVrac.tsx");
    expect(s).toMatch(/rangementEssai &&/);
    expect(s).not.toMatch(/Ranger pour moi · ≈ 0,01 €/);
  });
});

describe("B9 · B11 · B16", () => {
  it("B9 : « rien n'est payé » seulement si Claude n'est pas relié", () => {
    const s = src("src/components/generateur/FicheSujet.tsx");
    expect(s).not.toMatch(/messageSucces="texte d'essai, rien n'est payé"/);
    expect(s).not.toMatch(/messageSucces="écriture relancée, rien n'est payé"/);
    expect(s).toMatch(/else if \(contexte\.ecritureSimulee\) notifier\.essai\(`\$\{libelle\} : écriture lancée, rien n'est payé`\);\n\s+else notifier\.succes/);
    expect(s).toMatch(/ecritureSimulee/);
    expect(src("src/app/(studio)/ecrire/sujets/[id]/page.tsx")).toMatch(/ecritureSimulee=\{!\(await claudeBranche\(\)\)\}/);
  });

  it("B11 : plus aucun prix écrit en dur, ils sont calculés (plafond × taux du réglage)", async () => {
    for (const f of ["src/components/generateur/EcranSujet.tsx", "src/components/generateur/FicheSujet.tsx"]) expect(src(f)).not.toMatch(/\d,\d\d €/);
    expect(src("src/app/(studio)/ecrire/atelier/page.tsx")).toMatch(/prixLancement\(\)/);
    await ecrireParametre("taux.usdEur", 0.5);
    expect((await bg.prixLancement()).centimes).toBe(75);
    expect((await bg.prixRetouche()).centimes).toBe((await bg.prixLancement(true)).centimes);
  });

  it("B16 : le code mort Atelier.tsx est supprimé", () => {
    expect(existsSync(join(RACINE, "src/components/ecrire/Atelier.tsx"))).toBe(false);
  });
});
