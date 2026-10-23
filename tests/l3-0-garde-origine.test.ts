/**
 * L3-0 — `l3-0-garde-origine` : toute dépense COMMANDÉE par l'Usine passe par la garde d'origine (`reserverPourUsine`,
 * donc `verifierBudgetEtCredits` avec `origine: "usine"`). Cité par le docblock de `verifierEtReserverSelonOrigine`.
 *  1. comportement : sans budget du mois reçu de l'Usine, rien n'est réservé ni engagé ; la dépense manuelle est inchangée ;
 *  2. structure : l'origine « usine » est écrite en dur à un seul endroit (credits.ts), jamais choisie par un appelant ;
 *  3. L3-01 : la liste EXHAUSTIVE (fermée) des sites de dépense du dépôt. Chaque appel d'une porte d'argent hors de
 *     credits.ts y figure, avec sa nature : « garde » (contrôle, réservation et engagement sous le verrou des crédits,
 *     avec l'origine reçue), « pré-vol » (lecture seule ; la réservation sous verrou est faite plus loin, avec la même
 *     origine), « crochet » (un moteur appelle le budget de son branchement, qui garde) ou « hors porte » (jamais
 *     joignable par une commande de l'Usine, raison écrite). Un site nouveau, ou une garde qui perd son origine : rouge ;
 *  4. L3-01 : les portes d'argent d'un coup (`depenserSelonOrigine`), de relance (`reactiverSelonOrigine`) et du lot
 *     d'images (`reserverLot`) refusent une commande de l'Usine sans budget, sous le verrou, avant toute réservation.
 * Dépôts en mémoire, lecteurs de solde vides, aucune clé, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP = "l3-0-garde-origine";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-go-${++n}`, travailId: `trv-go-${n}` });

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(100));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

describe("1. sans budget de l'Usine, une dépense commandée par l'Usine ne réserve ni n'engage rien", () => {
  const rien = async (travailId: string) => {
    expect(await depots().reservations.lister((r) => r.travailId === travailId)).toEqual([]);
    expect(await lireParametre(`budget.engage.${travailId}`, null)).toBeNull();
  };

  it("reserverPourUsine : BUDGET_USINE_ABSENT avant toute réservation", async () => {
    const d = demande();
    await expect(credits.reserverPourUsine(estimation(10), true, "Cette vidéo", d)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await rien(d.travailId);
  });

  it("l'aiguillage avec l'origine « usine » : même refus, même absence de trace", async () => {
    const d = demande();
    await expect(credits.verifierEtReserverSelonOrigine("usine", estimation(10), true, "Cette vidéo", d)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await rien(d.travailId);
  });

  it("la dépense manuelle de Will (sans origine) passe et engage le budget du mois — inchangée", async () => {
    const d = demande();
    await credits.verifierEtReserverSelonOrigine(undefined, estimation(10), true, "Cette vidéo", d);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).not.toBeNull();
  });
});

/* --- 2. garde structurelle ----------------------------------------------------------------------------------------- */

const SRC = join(process.cwd(), "src");
const SANS_COMMENTAIRES = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(nom) ? [p] : [];
  });
}
const lire = (f: string) => SANS_COMMENTAIRES(readFileSync(f, "utf8"));
const corps = (source: string, signature: string) => {
  const debut = source.indexOf(signature);
  expect(debut, `${signature} introuvable`).toBeGreaterThanOrEqual(0);
  return source.slice(debut, source.indexOf("\n}", debut));
};

describe("2. l'origine « usine » est écrite en dur à un seul endroit", () => {
  const credits_ts = join(SRC, "services/credits.ts");
  const autres = sources(SRC).filter((f) => f !== credits_ts);

  it("aucun fichier hors credits.ts ne fixe `origine: \"usine\"`", () => {
    expect(autres.filter((f) => /origine\s*:\s*["']usine["']/.test(lire(f)))).toEqual([]);
  });

  it("dans credits.ts, `reserverPourUsine` fixe « usine » et l'aiguillage n'y mène que par elle", () => {
    const source = lire(credits_ts);
    expect(corps(source, "export function reserverPourUsine")).toMatch(/verifierEtReserver\([^)]*origine:\s*"usine"/);
    expect(corps(source, "export function verifierEtReserverSelonOrigine")).toMatch(/origine === "usine" \? reserverPourUsine\(/);
  });

  it("`verifierEtReserver` transmet l'origine à la garde `verifierBudgetEtCredits`", () => {
    expect(corps(lire(credits_ts), "export async function verifierEtReserver(")).toMatch(/verifierBudgetEtCredits\([^)]*origine:\s*options\.origine/);
  });

  // Dette L3-0 : une dépense qui réserve sans passer par l'engagement échappe au budget du mois (restant = budget − dépensé − engagé).
  it("aucun fichier hors credits.ts n'appelle `reserverCredits` (réserver sans engager) : tout passe par `verifierEtReserver`", () => {
    expect(autres.filter((f) => /(?<![A-Za-z])reserverCredits\(/.test(lire(f))).map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});

/* --- 3. L3-01 : liste exhaustive des sites de dépense ------------------------------------------------------------- */

type Nature = "garde" | "pré-vol" | "crochet" | "hors porte";
interface Site {
  fichier: string;
  appel: string;
  n: number;
  nature: Nature;
  pourquoi: string;
}

/** Portes d'argent de credits.ts (toute dépense passe par l'une d'elles). */
const PORTES = ["verifierEtReserverSelonOrigine", "depenserSelonOrigine", "reactiverSelonOrigine", "reserverPourUsine", "verifierEtReserver", "verifierBudgetEtCredits", "reserverLot"];
/** Portes qui prennent l'origine en premier argument (jamais un littéral : l'origine vient de l'appelant). */
const AVEC_ORIGINE = ["verifierEtReserverSelonOrigine", "depenserSelonOrigine", "reactiverSelonOrigine"];

const SITES: Site[] = [
  { fichier: "src/services/generation-claude.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "écriture du script (`executerRoleFacture`) : origine figée au lancement de l'écriture" },
  { fichier: "src/services/depense-claude-video.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "textes d'une vidéo (`executerRolePourVideo`), écriture du cas concret, Claude de l'image → vidéo" },
  { fichier: "src/services/comite-editorial.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "comité éditorial (hors porte au lot 3, origine transmise par `travaillerComite` et `jugerALaDemande`)" },
  { fichier: "src/services/decors.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "décor demandé à fal.ai (`demanderDecor`)" },
  { fichier: "src/services/decors.ts", appel: "depenserSelonOrigine", n: 1, nature: "garde", pourquoi: "look de décor HeyGen (`preparerLookDecor`)" },
  { fichier: "src/services/fabrication.ts", appel: "verifierEtReserverSelonOrigine", n: 3, nature: "garde", pourquoi: "lancement, retouche, format ajouté : origine de la commande (`CommandeFabrication.origine`)" },
  { fichier: "src/services/fabrication.ts", appel: "depenserSelonOrigine", n: 1, nature: "garde", pourquoi: "maquette rapide (`maquetteRapide`) : la voix payée sur place" },
  { fichier: "src/services/travaux.ts", appel: "reactiverSelonOrigine", n: 1, nature: "garde", pourquoi: "« Réessayer » : coût restant contrôlé et réservation réactivée d'un seul tenant, origine de la commande" },
  { fichier: "src/services/prononciations.ts", appel: "depenserSelonOrigine", n: 1, nature: "garde", pourquoi: "écoute d'une phrase par une voix payante" },
  { fichier: "src/services/image-video.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "voix HeyGen de l'image → vidéo, origine de la commande" },
  { fichier: "src/services/image-video.ts", appel: "verifierBudgetEtCredits", n: 1, nature: "pré-vol", pourquoi: "Claude et transcription : Claude est réservé par `executerRolePourVideo` avec la même origine" },
  { fichier: "src/services/cas-concret-branchements.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "voix du cas concret, origine de la commande" },
  { fichier: "src/services/cas-concret-branchements.ts", appel: "verifierBudgetEtCredits", n: 1, nature: "pré-vol", pourquoi: "écriture Claude du cas concret : réservée par `executerRolePourVideo` avec la même origine" },
  { fichier: "src/services/tableau-branchements.ts", appel: "verifierEtReserverSelonOrigine", n: 1, nature: "garde", pourquoi: "voix du tableau animé, origine de la commande" },
  { fichier: "src/services/fabrication-reseaux.ts", appel: "verifierBudgetEtCredits", n: 2, nature: "pré-vol", pourquoi: "pré-vols « Fabriquer » : la réservation se fait au lancement (fabrication.ts)" },
  { fichier: "src/moteurs/montage-tableau/fabriquer.ts", appel: "verifierEtReserver", n: 2, nature: "crochet", pourquoi: "crochet `budget.verifierEtReserver` du branchement (tableau-branchements.ts, garde)" },
  { fichier: "src/moteurs/montage-cas-concret/fabriquer.ts", appel: "verifierEtReserver", n: 1, nature: "crochet", pourquoi: "crochet `budget.verifierEtReserver` du branchement (cas-concret-branchements.ts, garde)" },
  { fichier: "src/services/tableau-outils.ts", appel: "verifierEtReserver", n: 1, nature: "hors porte", pourquoi: "branchements du lanceur en ligne de commande (`scripts/tableau/fabriquer.ts`), jamais une route" },
  { fichier: "scripts/tableau/fabriquer.ts", appel: "verifierEtReserver", n: 1, nature: "hors porte", pourquoi: "lanceur en ligne de commande de Will, crochet de tableau-outils.ts" },
  { fichier: "src/services/image-video-lot.ts", appel: "reserverLot", n: 2, nature: "hors porte", pourquoi: "lot d'images lancé par Will dans le studio (`reserverLot` accepte l'origine pour le lot 4)" },
];

describe("3. L3-01 : liste exhaustive des sites de dépense (fermée)", () => {
  const RACINE = process.cwd();
  const fichiers = [...sources(SRC), ...sources(join(RACINE, "scripts"))].filter((f) => f !== join(SRC, "services/credits.ts"));
  const compter = (texte: string, appel: string) => (texte.match(new RegExp(`(?<![A-Za-z0-9_])${appel}\\(`, "g")) ?? []).length;

  it("chaque appel d'une porte d'argent hors de credits.ts est dans la liste, au bon nombre (un site nouveau : rouge)", () => {
    const trouves: string[] = [];
    for (const f of fichiers) {
      const texte = lire(f);
      for (const appel of PORTES) {
        const n = compter(texte, appel);
        if (n) trouves.push(`${f.slice(RACINE.length + 1)} · ${appel} × ${n}`);
      }
    }
    expect(trouves.sort()).toEqual(SITES.map((s) => `${s.fichier} · ${s.appel} × ${s.n}`).sort());
  });

  it("une garde reçoit l'origine de son appelant (jamais `undefined`, « studio » ni « usine » écrits en dur)", () => {
    const fautifs = fichiers.filter((f) => AVEC_ORIGINE.some((a) => new RegExp(`${a}\\(\\s*(undefined|["'])`).test(lire(f))));
    expect(fautifs.map((f) => f.slice(RACINE.length + 1))).toEqual([]);
  });

  it("aucune garde n'appelle plus `verifierEtReserver` sans origine ; seuls les crochets et le hors-porte le gardent", () => {
    const directs = SITES.filter((s) => s.appel === "verifierEtReserver").map((s) => s.nature);
    expect(new Set(directs)).toEqual(new Set(["crochet", "hors porte"]));
  });

  it("chaque site dit pourquoi (une ligne écrite, relue par l'auditeur argent)", () => {
    for (const s of SITES) expect(s.pourquoi.length, s.fichier).toBeGreaterThan(20);
  });
});

/* --- 4. L3-01 : portes d'un coup, de relance et du lot ------------------------------------------------------------ */

describe("4. L3-01 : dépense d'un coup, relance et lot d'images, avec l'origine", () => {
  it("depenserSelonOrigine (« usine », sans budget) : BUDGET_USINE_ABSENT, l'appel payant ne part pas, rien n'est réservé", async () => {
    const d = demande();
    const payer = vi.fn(async () => "payé");
    await expect(credits.depenserSelonOrigine("usine", estimation(10), true, "Ce décor", d, payer)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(payer).not.toHaveBeenCalled();
    expect(await depots().reservations.lister((r) => r.travailId === d.travailId)).toEqual([]);
  });

  it("depenserSelonOrigine (Will) : réserve et engage pendant l'appel, puis rend l'engagement (consommé) ; en panne : libéré", async () => {
    const d = demande();
    const vu = await credits.depenserSelonOrigine(undefined, estimation(10), true, "Ce décor", d, async () => (await lireParametre<{ statut: string } | null>(`budget.engage.${d.travailId}`, null))?.statut);
    expect(vu).toBe("active");
    expect((await lireParametre<{ statut: string } | null>(`budget.engage.${d.travailId}`, null))?.statut).toBe("consommee");
    const e = demande();
    await expect(credits.depenserSelonOrigine(undefined, estimation(10), true, "Ce décor", e, async () => Promise.reject(new Error("panne")))).rejects.toThrow("panne");
    expect((await lireParametre<{ statut: string } | null>(`budget.engage.${e.travailId}`, null))?.statut).toBe("liberee");
  });

  it("reactiverSelonOrigine (« usine », sans budget) : refus, la réservation libérée du travail ne redevient pas active", async () => {
    const d = demande();
    await credits.verifierEtReserver(estimation(10), true, "Cette vidéo", d);
    await credits.libererReservation(d.travailId, "liberee");
    // L3-01 (audit) : `ensuite` reçoit la réactivation et l'appelle lui-même (sous le verrou de la boucle, pris DANS `ensuite`).
    const ensuite = vi.fn(async (reactiver: () => Promise<void>) => reactiver());
    await expect(credits.reactiverSelonOrigine("usine", d.travailId, estimation(10), true, "Cette relance", {}, ensuite)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(ensuite).not.toHaveBeenCalled();
    expect((await lireParametre<{ statut: string } | null>(`budget.engage.${d.travailId}`, null))?.statut).toBe("liberee");
    await credits.reactiverSelonOrigine(undefined, d.travailId, estimation(10), true, "Cette relance", {}, ensuite);
    expect(ensuite).toHaveBeenCalledOnce();
    expect((await lireParametre<{ statut: string } | null>(`budget.engage.${d.travailId}`, null))?.statut).toBe("active");
  });

  it("reserverLot avec l'origine « usine » sans budget : refus, rien n'est réservé ni engagé ; sans origine : inchangé", async () => {
    await expect(credits.reserverLot("lot-usine", [ligne(10)], eur(10), true, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(await depots().reservations.lister((r) => r.travailId === "lot:lot-usine")).toEqual([]);
    expect(await lireParametre("budget.engage.lot:lot-usine", null)).toBeNull();
    await credits.reserverLot("lot-will", [ligne(10)], eur(10), true);
    expect(await lireParametre("budget.engage.lot:lot-will", null)).not.toBeNull();
  });
});

/* --- 5. L3-01 (audit) : options payantes, HORS PORTE (clic « Confirmer » de Will uniquement) ---------------------- */

/**
 * Les passes payantes de la fabrication (décor IA Higgsfield `decor-ia.ts`, ultra réaliste et effet réaliste IA
 * `effet-realiste-ia.ts` via `options-payantes-higgsfield.ts`, multicaméra HeyGen `multicamera.ts` via
 * `options-payantes-multicamera.ts`) ne passent PAS par une porte d'argent de credits.ts : ni verrou Postgres, ni
 * réservation, ni origine. Elles sont « hors porte » parce qu'aucun appel réel ne part sans le jeton d'une demande
 * CONFIRMÉE, et que seule `confirmerOptionPayante` (action « Confirmer » de Will, `exigerSession()` en tête) confirme
 * une demande : une commande de l'Usine ne peut pas en produire. Le plafond du mois est revérifié par `autoriser`.
 * Liste FERMÉE, comme § 3 : un point d'entrée nouveau, ou une confirmation sans session, fait rougir.
 */
const OPTIONS_HORS_PORTE: Site[] = [
  { fichier: "src/services/decor-ia.ts", appel: "preparerOptionPayante", n: 1, nature: "hors porte", pourquoi: "Décor IA Higgsfield (`passeDecorFacecam`) : jeton du clic « Confirmer » de Will uniquement" },
  { fichier: "src/services/options-payantes-higgsfield.ts", appel: "preparerOptionPayante", n: 1, nature: "hors porte", pourquoi: "ultra réaliste et effet réaliste IA (effet-realiste-ia.ts) : jeton du clic « Confirmer » de Will uniquement" },
  { fichier: "src/services/options-payantes-multicamera.ts", appel: "preparerOptionPayante", n: 1, nature: "hors porte", pourquoi: "multicaméra HeyGen (multicamera.ts) : jeton du clic « Confirmer » de Will uniquement" },
  { fichier: "src/app/(studio)/videos/actions-options-payantes.ts", appel: "confirmerOptionPayante", n: 1, nature: "hors porte", pourquoi: "action serveur du bouton « Confirmer » de la carte, session de Will exigée" },
];

describe("5. L3-01 : options payantes hors porte (clic de Will uniquement)", () => {
  const RACINE = process.cwd();
  const OPTIONS_TS = join(SRC, "services/options-payantes.ts");
  const fichiers = [...sources(SRC), ...sources(join(RACINE, "scripts"))].filter((f) => f !== OPTIONS_TS && !f.endsWith(".test.ts"));
  const compter = (texte: string, appel: string) => (texte.match(new RegExp(`(?<![A-Za-z0-9_])${appel}\\(`, "g")) ?? []).length;

  it("chaque point d'entrée d'une option payante hors de options-payantes.ts est dans la liste, au bon nombre", () => {
    const trouves: string[] = [];
    for (const f of fichiers) {
      const texte = lire(f);
      for (const appel of ["preparerOptionPayante", "gardePourTravail", "confirmerOptionPayante"]) {
        const n = compter(texte, appel);
        if (n) trouves.push(`${f.slice(RACINE.length + 1)} · ${appel} × ${n}`);
      }
    }
    expect(trouves.sort()).toEqual(OPTIONS_HORS_PORTE.map((s) => `${s.fichier} · ${s.appel} × ${s.n}`).sort());
  });

  it("seule `confirmerOptionPayante` confirme une demande, et elle exige la session de Will avant tout", () => {
    const texte = lire(OPTIONS_TS);
    expect(compter(texte, "confirmer")).toBe(1);
    const corps = texte.slice(texte.indexOf("export async function confirmerOptionPayante("));
    expect(corps.slice(0, corps.indexOf("confirmer(")).match(/await\s+exigerSession\(\)/)).not.toBeNull();
    // Aucun autre fichier n'importe la confirmation de la brique.
    expect(fichiers.filter((f) => /(?<![A-Za-z0-9_.])confirmer\(/.test(lire(f)) && /briques\/options-payantes/.test(lire(f))).map((f) => f.slice(RACINE.length + 1))).toEqual([]);
  });

  it("la raison « hors porte » est écrite dans options-payantes.ts (relue par l'auditeur argent)", () => {
    expect(readFileSync(OPTIONS_TS, "utf8")).toMatch(/HORS PORTE \(L3-01[^)]*\)[\s\S]*clic « Confirmer » de Will/);
    for (const s of OPTIONS_HORS_PORTE) expect(s.pourquoi.length, s.fichier).toBeGreaterThan(20);
  });
});

/* --- 6. L3-01 (audit, mineur) : dette pour le lot 4, appels de `executerRolePourVideo` SANS `origine` -------------- */

/**
 * Ces appels réservent bien sous le verrou des crédits (`depense-claude-video.ts`, garde), mais sans transmettre
 * `origine` : la dépense y est donc toujours comptée comme une commande de Will. À brancher au lot 4 (porte de commande
 * de l'Usine), quand chacun de ces chemins pourra être commandé par l'Usine :
 *  - src/services/publications.ts ~l.160 : texte de publication par réseau ;
 *  - src/services/site-videos.ts ~l.299 : passeport web du site ;
 *  - src/services/tableau-creation.ts ~l.620 : découpage du tableau animé ;
 *  - src/services/tableau-scripts/client-studio.ts ~l.97 : passes du script du tableau ;
 *  - src/services/monteur-facecam.ts ~l.424, ~l.1003, ~l.1050 : monteur face caméra (discussion, relecture, consignes) ;
 *  - src/services/facecam-animee.ts ~l.183 : réalisateur V4 (fichier d'une autre session, NON modifié ici).
 * Fichiers d'autres sessions, listés seulement, jamais modifiés par L3-01 : src/app/(studio)/image-video/**,
 * src/app/(studio)/nouvelle/[format]/**, src/components/creation/*, src/services/facecam-animee.ts,
 * src/services/cas-concret-socle.ts (aucun n'appelle `executerRolePourVideo` sans origine au 18/10 hors facecam-animee.ts).
 * Liste FERMÉE : un appel nouveau sans origine, ou un appel branché, la fait rougir (la mettre à jour, avec le lot 4).
 */
const SANS_ORIGINE_LOT_4 = [
  "src/services/facecam-animee.ts × 1",
  "src/services/monteur-facecam.ts × 3",
  "src/services/publications.ts × 1",
  "src/services/site-videos.ts × 1",
  "src/services/tableau-creation.ts × 1",
  "src/services/tableau-scripts/client-studio.ts × 1",
];

describe("6. L3-01 : appels de `executerRolePourVideo` sans origine (dette écrite pour le lot 4)", () => {
  const RACINE = process.cwd();
  it("la liste écrite est exactement celle du dépôt", () => {
    const trouves: string[] = [];
    for (const f of [...sources(SRC), ...sources(join(RACINE, "scripts"))].filter((x) => !x.endsWith(".test.ts"))) {
      const lignes = lire(f).split("\n").filter((l) => /(?<![A-Za-z0-9_])executerRolePourVideo\(/.test(l) && !/function\s+executerRolePourVideo/.test(l));
      const n = lignes.filter((l) => !/origine/.test(l.slice(l.indexOf("executerRolePourVideo(")))).length;
      if (n) trouves.push(`${f.slice(RACINE.length + 1)} × ${n}`);
    }
    expect(trouves.sort()).toEqual([...SANS_ORIGINE_LOT_4].sort());
  });
});
