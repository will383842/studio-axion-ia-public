/**
 * T-EXT-28 · 8e tableau de bord INCONNU (« Espace démo · Atelier », menuiserie) : la chaîne du tutoriel de valeur doit le
 * traverser sans fiche nouvelle, du zip jusqu'à la vidéo découpée en scènes. Tout est en mémoire, tout est double :
 * Claude (`simuler` des rôles ou double de `outilsDoubles`), voix, rendu. 0 €, aucun fichier écrit.
 *
 * Règle de la fiche : si un maillon casse, ce test reste ROUGE et son message nomme le maillon (« maillon : … ») ; aucune
 * réparation de production ici. Le dépôt (T-EXT-33, `deposerTutoriel`) et le contrôle des
 * entrées (T-EXT-41, `extraireZipSur`) sont les VRAIES pièces de master, avec des dépendances et des ports en mémoire.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));

import { creerZip } from "../../src/lib/zip";
import { extraireZipSur, type PortsZip, type ResultatZip } from "../../src/services/zip-tutoriel";
import { deposerTutoriel, type DependancesDepotTutoriel } from "../../src/services/tutoriel-depot";
import type { RequeteClaude } from "../../src/fournisseurs/claude/client";
import type { PlanValide } from "../../src/briques/plan-scenes/schema";
import type { CommandeFabrication, Licence, Travail } from "../../src/domaine/types";
import type { RapportControleImage, IdControle } from "../../src/briques/controle-image";
import type { LectureRegard } from "../../src/briques/regardeur";
import { creerMoteurTutorielOutil } from "../../src/moteurs/montage-tutoriel-outil";
import { ENTREE_DEVIS_TUTORIEL, accordValide, etablirDevis, lireAccordDevis } from "../../src/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { decouperEnMorceaux } from "../../src/moteurs/montage-tutoriel-outil/decoupage-scenes";
import { noterTutoriel } from "../../src/moteurs/montage-tutoriel-outil/grille-qualite";
import { estCleScene, INDEX_VIDE, rangerScenes } from "../../src/moteurs/montage-tutoriel-outil/index-scenes";
import { entreeAnalyste, lireCarteZones, roleAnalyste, type FichierDossier } from "../../src/moteurs/montage-tutoriel-outil/equipe/analyste";
import { classerParRegles, etablirCahier, type InventaireDossier } from "../../src/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { controlerAvantValidation, controlerApresCalage, publiable } from "../../src/moteurs/montage-tutoriel-outil/equipe/controleur";
import { completerManque, roleMaquettiste } from "../../src/moteurs/montage-tutoriel-outil/equipe/maquettiste";
import { instantsTutoriel, textesPermisDuRegistre, verdictRegardTutoriel } from "../../src/moteurs/montage-tutoriel-outil/equipe/regardeur";
import { realiser } from "../../src/moteurs/montage-tutoriel-outil/equipe/realisateur";
import { etablirRegistre, figerRegistre, verifierRendu } from "../../src/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { entreeScenariste, figerScriptChoisi, lirePropositionScripts, roleScenariste } from "../../src/moteurs/montage-tutoriel-outil/equipe/scenariste";
import { entreeStrategeValeur, lireFicheValeur, roleStrategeValeur } from "../../src/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 20, 9);
const DOSSIER = join(__dirname, "huitieme", "dossier");
const NOMS_PACKS = ["Stocks", "Tâches", "Taches", "Connaissances", "Knowledge", "Clients", "Facturation", "Rendez-vous"];

/** Fait casser le test avec le NOM du maillon (règle de la fiche : on nomme, on ne répare pas). */
function maillon(nom: string, raison: string): never {
  throw new Error(`8e tableau : maillon : ${nom} — ${raison}`);
}
function exiger<T>(nom: string, lecture: { ok: boolean; erreurs?: string[] } & T): asserts lecture is { ok: true } & T {
  if (!lecture.ok) maillon(nom, (lecture.erreurs ?? []).join(" | ") || "refusé");
}

/* ------------------------------------------------------------------ */
/* Dossier → zip en mémoire                                            */
/* ------------------------------------------------------------------ */

function dossierAtelier(): FichierDossier[] {
  return readdirSync(DOSSIER)
    .sort()
    .map((nom) => ({ chemin: `atelier/${nom}`, contenu: readFileSync(join(DOSSIER, nom), "utf8") }));
}

/** Ports en mémoire de la vraie `extraireZipSur` : le choix « dossier ouvert » est passé par le test (aucun interrupteur réel). */
const PORTS_MEMOIRE: PortsZip = {
  lireParametre: async () => true,
  inflate: (donnees, maxOutputLength) => inflateRawSync(donnees, { maxOutputLength }),
  journaliser: async () => {},
};

/** Contrôle des entrées (T-EXT-41) : la vraie `extraireZipSur`, ports en mémoire. */
function controlerEntrees(zip: Uint8Array): Promise<ResultatZip> {
  return extraireZipSur(zip, { attestationImages: false }, PORTS_MEMOIRE);
}

function zipDe(fichiers: FichierDossier[]): Uint8Array {
  return creerZip(fichiers.map((f) => ({ nom: f.chemin, donnees: new TextEncoder().encode(f.contenu) })));
}

/** Les couleurs réellement écrites dans les feuilles de style du dossier. */
function couleursDuDossier(fichiers: FichierDossier[]): string[] {
  return [...new Set(fichiers.filter((f) => /\.css$/i.test(f.chemin)).flatMap((f) => f.contenu.match(/#[0-9a-fA-F]{6}\b/g) ?? []))];
}

function inventaire(fichiers: FichierDossier[]): InventaireDossier {
  const texte = (re: RegExp) => fichiers.filter((f) => re.test(f.chemin)).map((f) => f.contenu).join("\n");
  const js = texte(/\.m?js$/i);
  return {
    maquette: fichiers.some((f) => /index\.html?$/i.test(f.chemin)),
    maquetteVivante: /window\.demoMaquette\s*=/.test(js),
    tableauDeBord: /data-zone=/.test(texte(/\.html?$/i)),
    captures: 0,
    donnees: false,
    scripts: [],
    flux: false,
    conversation: false,
    notes: fichiers.find((f) => /LISEZMOI/i.test(f.chemin))?.contenu,
  };
}

/* ------------------------------------------------------------------ */
/* Boucle du moteur (modèle de bout-en-bout.test.ts)                    */
/* ------------------------------------------------------------------ */

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail, jusqua = 600) {
  let t = travail;
  let resultat;
  for (let i = 0; i < jusqua; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { travail: t, resultat };
}

function rapportImageReussi(): RapportControleImage {
  const ids: IdControle[] = ["volume", "crete", "image-noire", "image-figee", "duree", "note-qualite", "zone-sure", "bande-sous-titres", "taille-texte", "contraste", "premiere-image"];
  return { controles: ids.map((id) => ({ id, libelle: id, bloquant: true, etat: "reussi" as const, raison: "mesuré sur le double" })), verdict: "livrable", nonFaits: 0, resume: "Livrable" };
}


/**
 * Faux Claude du plan de scènes (double, 0 €) : TROIS scènes, une par tiers des mots, sur le modèle de `planLlm` de
 * `doubles.ts` (dont le plan n'en a que deux). Même contrat : le plan est jugé ensuite par le validateur du moteur.
 */
function planEnTroisScenes(requete: RequeteClaude): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const t1 = Math.floor(n / 3);
  const t2 = Math.floor((2 * n) / 3);
  const transition = { entree: "fondu", sortie: "fondu", dureeMs: 400 };
  const calques = [
    { piece: "curseur", parametres: { trajet: [{ x: 20, y: 20 }, { x: 70, y: 60 }], clic: true, partDeplacement: 0.6 }, debutMs: 0, zone: "plein" },
    { piece: "zoom-camera", parametres: { cible: { x: 70, y: 60 }, facteur: 1.6, moment: 0.3, titreFenetre: "Tableaux" }, debutMs: 300, zone: "plein" },
  ];
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "ivoire", accent: "terracotta" },
    scenes: [
      { id: "s1", version: 1, mots: { premier: 0, dernier: t1 - 1 }, debutMs: ms(0, 2), finMs: ms(t1, 2), niveau: 1, position: "plein", transition, piece: "fenetre-app", parametres: { titre: "Tableaux", onglets: ["Accueil", "Ventes"], ongletActif: 0, contenu: "formulaire" } },
      { id: "s2", version: 1, mots: { premier: t1, dernier: t2 - 1 }, debutMs: ms(t1, 2), finMs: ms(t2, 2), niveau: 2, position: "plein", transition, piece: "legende", parametres: { texte: "Tableau prêt", sousTexte: "", style: "titre" }, calques },
      { id: "s3", version: 1, mots: { premier: t2, dernier: n - 1 }, debutMs: ms(t2, 2), finMs: ms(n - 1, 3), niveau: 2, position: "plein", transition, piece: "legende", parametres: { texte: "Tableau prêt", sousTexte: "", style: "titre" }, calques },
    ],
  });
}

/** Les doubles de la suite, avec le faux Claude à trois scènes. */
function outilsDeLaSuite(journal: Journal, scriptEcrit: string): ReturnType<typeof une> {
  const base = outilsDoubles(journal, { scriptEcrit });
  return une({ ...base, claude: async (requete) => (requete.json ? { ...(await base.claude(requete)), texte: planEnTroisScenes(requete) } : base.claude(requete)) });
}

/** Maillons d'AMONT (dépôt → script choisi → accord du devis), communs aux deux tests. */
async function amont() {
    /* ---- dépôt (T-EXT-33, vrai `deposerTutoriel`) et contrôle des entrées (T-EXT-41, vraie `extraireZipSur`) ---- */
    const aLeDisque: string[] = []; // appels aux doubles d'écriture : rien n'est écrit sur disque, seuls les doubles sont appelés
    const zip = zipDe(dossierAtelier());
    const controle = await controlerEntrees(zip);
    if (!controle.ok) maillon("contrôle des entrées", controle.rapport.refus.join(" | "));
    const fichiers: FichierDossier[] = [...controle.fichiers].map(([chemin, donnees]) => ({ chemin, contenu: new TextDecoder().decode(donnees) }));
    expect(fichiers.map((f) => f.chemin.split("/").pop()).sort()).toEqual(["LISEZMOI.md", "app.js", "demo-data.js", "index.html", "styles.css"]);
    const dep: DependancesDepotTutoriel = {
      interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: false }),
      fichier: async (id) => ({ id, nom: "atelier.zip", taille: zip.length, cleStockage: `essai/${id}.zip` }),
      octets: async () => zip,
      extraire: (o, opts) => extraireZipSur(o, opts, PORTS_MEMOIRE),
      brouillon: async () => {
        aLeDisque.push("brouillon");
        return { id: "v-huit" };
      },
      ratios: async () => void aLeDisque.push("ratios"),
      lancer: async () => {
        aLeDisque.push("lancer");
        return { statut: "lancee", travailId: "t-huit" };
      },
      abandonner: async () => void aLeDisque.push("abandonner"),
    };
    const depot = await deposerTutoriel({ mode: "dossier", fichierId: "f-atelier", attestationImages: false }, dep);
    if (depot.statut !== "lancee") maillon("dépôt", `${depot.phrase}${depot.rapport ? ` : ${depot.rapport.refus.join(" | ")}` : ""}`);

    /* ---- chef de projet : cas 1, entrée B ---- */
    const demande = { dossier: inventaire(fichiers), ratios: ["4:5", "9:16", "1:1"] };
    const decision = classerParRegles(demande);
    if (decision.cas !== 1 || decision.entree !== "B") maillon("chef de projet", `cas ${decision.cas} / entrée ${decision.entree} au lieu de cas 1 / entrée B (${decision.raisons.join(" ; ")})`);
    const cahierLu = etablirCahier(demande, decision);
    if (!cahierLu.ok) maillon("chef de projet", cahierLu.attente.message);
    const cahier = cahierLu.cahier;
    expect(cahier.ratios).toEqual(["4:5", "9:16", "1:1"]);
    expect(cahier.scriptsFournis).toEqual([]);

    /* ---- analyste : la carte des zones ---- */
    const entreeA = { cahier, fichiers };
    const carteLue = lireCarteZones(roleAnalyste.simuler(entreeAnalyste(entreeA)), entreeA);
    exiger("analyste", carteLue);
    const carte = carteLue.carte;
    if (carte.zones.length < 3) maillon("analyste", `${carte.zones.length} zone(s) relevée(s), 3 attendues`);
    expect(carte.zones.map((z) => z.id).sort()).toEqual(["commandes", "planning", "stocks"]);

    /* ---- maquettiste : il manque le scénario de parcours ---- */
    const contexte = { metier: "atelier de menuiserie", carteZones: carte.zones.map((z) => ({ id: z.id, libelle: z.nom })), interdits: NOMS_PACKS, maquette: carte.maquette };
    const scenario = await completerManque({ manque: "scenario-parcours", contexte, appeler: async (e) => roleMaquettiste.simuler(e) });
    if (scenario.statut !== "proposition" || scenario.manque !== "scenario-parcours") maillon("maquettiste", scenario.statut === "a-revoir" ? scenario.erreurs.join(" | ") : "pas de scénario");
    expect(scenario.scenario.etapes.length).toBeGreaterThanOrEqual(3);

    /* ---- stratège de valeur ---- */
    const ficheLue = lireFicheValeur(roleStrategeValeur.simuler(entreeStrategeValeur(carte, cahier)), carte, cahier);
    exiger("stratège de valeur", ficheLue);
    const fiche = ficheLue.fiche;

    /* ---- scénariste : deux versions ---- */
    const entreeS = { cahier, carte, fiche, dureeFinSec: 0 };
    const propLue = lirePropositionScripts(roleScenariste.simuler(entreeScenariste(entreeS)), entreeS);
    exiger("scénariste", propLue);
    const proposition = propLue.proposition;
    expect(proposition.versions.map((v) => v.id)).toEqual(["A", "B"]);

    /* ---- choix simulé de Williams (version 1 = A) et accord du devis simulé ---- */
    const script = figerScriptChoisi(proposition, { version: "A" });
    const motsScript = script.texte.split(/\s+/).filter(Boolean).length;
    const devis = etablirDevis({ roles: [{ id: "tutoriel-claude", essaisMax: 1 }], caracteresScript: script.texte.length, texteScript: script.texte, motsScript, voixDejaPayee: false, ratios: cahier.ratios, essai: true });
    const accord = { empreinte: devis.empreinte, le: "2026-11-20T09:00:00Z" };
    const entreesAccord = { [ENTREE_DEVIS_TUTORIEL]: accord };
    expect(lireAccordDevis(entreesAccord)).toEqual(accord);
    expect(accordValide(devis, lireAccordDevis(entreesAccord))).toBe(true);
    return { aLeDisque, fichiers, cahier, carte, fiche, proposition, script, devis, entreesAccord };
}

describe("8e tableau de bord inconnu : la chaîne passe sans fiche nouvelle", () => {
  it("du zip à la vidéo découpée en scènes, avec des doubles, à 0 €", async () => {
    const { aLeDisque, fichiers, cahier, carte, fiche, proposition, script, entreesAccord } = await amont();
    /* ---- réalisateur ---- */
    const parcoursLu = realiser({ cahier, carte, fiche, script, largeur: 1080, hauteur: 1350 });
    exiger("réalisateur", parcoursLu);
    const parcours = parcoursLu.parcours;

    /* ---- registre des textes (T-EXT-40) ---- */
    const textesMaquette = fichiers
      .filter((f) => /index\.html$/.test(f.chemin))
      .map(() => carte.zones.map((z) => ({ etapeId: z.id, textes: [] as string[], creee: false })))
      .flat();
    const registreBrut = etablirRegistre({ script: { phrases: script.phrases.map((p) => p.texte), origine: "choisi" }, fin: cahier.fin, parcours: { etapes: parcours.gestes.map((g) => ({ id: g.etapeId })) }, textesMaquette });
    const fige = figerRegistre(registreBrut, "2026-11-20T09:01:00Z");
    if (!fige.ok) maillon("registre des textes", fige.erreur);
    const registre = fige.registre;

    /* ---- contrôleur sans IA, avant l'écran de validation ---- */
    const avant = controlerAvantValidation({
      cahier, carte, fiche, proposition, parcours, textesMaquette,
      couleurs: couleursDuDossier(fichiers), polices: ["Manrope"], noms: [], script, dureeFinSec: 0, mentionExemple: true,
    });
    const echoues = avant.controles.filter((c) => c.etat === "echoue" && c.bloquant);
    if (echoues.length > 0) maillon("contrôleur", echoues.map((c) => `${c.id} : ${c.details.join(" ; ")}`).join(" | "));

    /* ---- moteur avec les doubles (Claude, voix, rendu) ---- */
    const j: Journal = { voix: [], claude: [], rendus: [] };
    const moteur = creerMoteurTutorielOutil({ outils: outilsDeLaSuite(j, script.texte) });
    const commande = commandeTutoriel({
      dureeCibleSec: 48,
      ratios: ["4:5", "9:16", "1:1"],
      script: { blocs: [], texteComplet: script.texte },
      entrees: { tutorielOutil: { scriptColle: true }, ...entreesAccord },
    });
    const t0 = await moteur.lancer(commande, { travailId: "t-huit", versionId: "ver-1", titre: "8e tableau", maintenant: T0 });
    const { travail, resultat } = await mener(moteur, commande, t0);
    if (travail.statut !== "termine" || !resultat) maillon("moteur", `statut « ${travail.statut} »${travail.erreur ? ` : ${travail.erreur.code}` : ""}${travail.parametres?.pause ? ` : pause ${JSON.stringify(travail.parametres.pause)}` : ""}`);

    // la vidéo se termine, trois formats dans l'ordre, durée 40 à 55 s
    expect(resultat.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16", "1:1"]);
    const dureeSec = resultat.sorties[0].dureeSec;
    expect(dureeSec).toBeGreaterThanOrEqual(40);
    expect(dureeSec).toBeLessThanOrEqual(55);

    /* ---- chaque texte dit et affiché est au registre ---- */
    const projet = resultat.projetMontage.tutoriel as { plan: { plan: PlanValide } };
    const plan = projet.plan.plan;
    const verifie = verifierRendu(registre, { voix: script.texte, sousTitres: script.phrases.map((p) => p.texte), ecran: [] });
    if (!verifie.ok) maillon("registre des textes", `${verifie.message} ${verifie.details.join(" | ")}`);
    const extra = verifierRendu(registre, { voix: script.texte, sousTitres: [], ecran: [{ texte: "Phrase que personne n'a choisie", ou: "ecran-studio" }] });
    expect(extra.ok).toBe(false);

    /* ---- aucun nom de pack dans les sorties ---- */
    const sorties = JSON.stringify({ script, carte, fiche, parcours, plan, rendus: j.rendus.map((d) => d.parametres) });
    for (const nom of NOMS_PACKS) expect(sorties, `nom de pack « ${nom} » dans les sorties`).not.toContain(nom);

    /* ---- grille : proposable sur les doubles (regard fabriqué à la main, jamais roleRegard.simuler) ---- */
    const finMs = 0;
    const instants = instantsTutoriel(plan, { finMs, registre });
    const lecture: LectureRegard = { images: instants.map((i) => ({ nom: i.nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false })) };
    const regard = verdictRegardTutoriel(instants, lecture, { textesPermis: textesPermisDuRegistre(registre) });
    const apres = controlerApresCalage({ script, parcours, etapes: [], dureeVoixMs: dureeSec * 1000, dureeFinMs: 0 });
    expect(apres.controles.find((c) => c.id === "TUT-DUREE")?.etat).toBe("reussi");
    const controleur = { ...avant, controles: [...avant.controles, ...apres.controles.filter((c) => c.id === "TUT-DUREE")] };
    const grille = noterTutoriel({ controleImage: rapportImageReussi(), controleur, regardeur: regard, dureeSec, imageFixeMaxSec: 0, niveauSonoreLufs: -14 });
    if (!grille.proposable) maillon("grille de qualité", `note ${grille.note} ; ${grille.criteres.filter((c) => c.etat !== "reussi").map((c) => `${c.id}:${c.etat}`).join(", ")}`);
    expect(grille.proposable).toBe(true);
    void publiable;

    /* ---- découpe en scènes (T-EXT-14), index (T-EXT-15) ---- */
    const decoupe = decouperEnMorceaux({ plan });
    if (!decoupe.ok) maillon("découpe en scènes", decoupe.erreurs.join(" | "));
    expect(decoupe.morceaux.length).toBeGreaterThanOrEqual(3);
    const index = rangerScenes(INDEX_VIDE, decoupe.morceaux, {
      videoId: "v-to", versionVideoId: "ver-1", maquette: carte.maquette, sujet: null,
      licence: licenceExemple(), famille: ["v-to"], le: "2026-11-20T09:05:00Z",
    });
    expect(index.entrees.length).toBeGreaterThanOrEqual(3);
    expect(index.entrees.every((e) => estCleScene(e.cle) && e.etat === "brouillon")).toBe(true);

    /* ---- 0 € : rien de réel ; rien n'est écrit dans le dépôt ---- */
    expect(j.voix.length).toBe(1);
    expect(resultat.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    expect(aLeDisque).toEqual(["brouillon", "ratios", "lancer"]);
  });

  it("aval indépendant du parcours : moteur (doubles) → découpe → index, depuis le script choisi (0 €)", async () => {
    const { cahier, carte, script, entreesAccord } = await amont();
    const registre = figerRegistre(etablirRegistre({ script: { phrases: script.phrases.map((p) => p.texte), origine: "choisi" }, fin: cahier.fin, parcours: {}, textesMaquette: [] }), "2026-11-20T09:01:00Z");
    if (!registre.ok) maillon("registre des textes", registre.erreur);
    const j: Journal = { voix: [], claude: [], rendus: [] };
    const moteur = creerMoteurTutorielOutil({ outils: outilsDeLaSuite(j, script.texte) });
    const commande = commandeTutoriel({ dureeCibleSec: 48, ratios: ["4:5", "9:16", "1:1"], script: { blocs: [], texteComplet: script.texte }, entrees: { tutorielOutil: { scriptColle: true }, ...entreesAccord } });
    const t0 = await moteur.lancer(commande, { travailId: "t-huit-aval", versionId: "ver-1", titre: "8e tableau", maintenant: T0 });
    const { travail, resultat } = await mener(moteur, commande, t0);
    if (travail.statut !== "termine" || !resultat) maillon("moteur", `statut « ${travail.statut} »${travail.erreur ? ` : ${travail.erreur.code}` : ""}`);
    expect(resultat.sorties.map((s) => s.ratio)).toEqual(["4:5", "9:16", "1:1"]);
    expect(resultat.sorties[0].dureeSec).toBeGreaterThanOrEqual(40);
    expect(resultat.sorties[0].dureeSec).toBeLessThanOrEqual(55);
    const verifie = verifierRendu(registre.registre, { voix: script.texte, sousTitres: script.phrases.map((p) => p.texte), ecran: [] });
    if (!verifie.ok) maillon("registre des textes", `${verifie.message} ${verifie.details.join(" | ")}`);
    const plan = (resultat.projetMontage.tutoriel as { plan: { plan: PlanValide } }).plan.plan;
    const sorties = JSON.stringify({ script, carte, plan, rendus: j.rendus.map((d) => d.parametres) });
    for (const nom of NOMS_PACKS) expect(sorties, `nom de pack « ${nom} » dans les sorties`).not.toContain(nom);
    const decoupe = decouperEnMorceaux({ plan });
    if (!decoupe.ok) maillon("découpe en scènes", decoupe.erreurs.join(" | "));
    expect(decoupe.morceaux.length).toBeGreaterThanOrEqual(3);
    const index = rangerScenes(INDEX_VIDE, decoupe.morceaux, { videoId: "v-to", versionVideoId: "ver-1", maquette: carte.maquette, sujet: null, licence: licenceExemple(), famille: ["v-to"], le: "2026-11-20T09:05:00Z" });
    expect(index.entrees.length).toBeGreaterThanOrEqual(3);
    expect(index.entrees.every((e) => estCleScene(e.cle) && e.etat === "brouillon")).toBe(true);
    expect(j.voix.length).toBe(1);
    expect(resultat.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
  });

  it("le dossier est écrit d'après le brief : aucun nom de pack, aucun bleu, aucun script externe, aucun montant", () => {
    const tout = dossierAtelier().map((f) => f.contenu).join("\n");
    for (const nom of NOMS_PACKS) expect(tout).not.toContain(nom);
    expect(tout).not.toMatch(/#(?:0[0-9a-f]{2}[c-f][0-9a-f]{2}|[0-4][0-9a-f][5-9a-f][0-9a-f]{3})\b|\bblue\b|\bbleu\b/i);
    expect(tout).not.toMatch(/<script[^>]+src=["']?(?:https?:)?\/\//i);
    expect(tout).not.toMatch(/€|\beuros?\b|\$/);
    expect(tout).toContain("window.demoMaquette");
    expect(tout).toContain("exemple");
    expect(dossierAtelier().some((f) => /scenario|script/i.test(f.chemin))).toBe(false);
  });

  it("un dossier piégé est refusé avant toute chose (chemin remontant, script externe), chaque piège séparément", async () => {
    const remontant = await controlerEntrees(zipDe([...dossierAtelier(), { chemin: "../evil.js", contenu: "x" }]));
    expect(remontant.ok).toBe(false);
    expect(remontant.rapport.refus.join(" | ")).toContain("chemin qui sort du dossier (« .. »)");
    const externe = await controlerEntrees(zipDe([...dossierAtelier(), { chemin: "atelier/x.html", contenu: '<script src="https://cdn.example/x.js"></script>' }]));
    expect(externe.ok).toBe(false);
    expect(externe.rapport.refus.join(" | ")).toContain("src : adresse externe");
  });
});

function licenceExemple(): Licence {
  return { type: "propriete", usageCommercial: true, reseaux: [], source: "dossier-fourni" };
}
