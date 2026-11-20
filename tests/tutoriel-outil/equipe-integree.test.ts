/**
 * T-EXT-55 · l'équipe de rôles intégrée dans la chaîne du tutoriel d'outil, de bout en bout. Doubles : faux Claude (la simulation
 * déterministe de chaque rôle), fausse voix, faux rendu, dossier fictif. Aucun appel réel, 0 €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, validerScriptTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { EtatTutoriel, OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { PortEquipe } from "@/moteurs/montage-tutoriel-outil/chaine";
import { construireDossierValidation } from "@/moteurs/montage-tutoriel-outil/equipe/dossier-validation";
import { figerRegistre } from "@/moteurs/montage-tutoriel-outil/equipe/registre-textes";
import { roleAnalyste } from "@/moteurs/montage-tutoriel-outil/equipe/analyste";
import { roleChefDeProjet } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { roleStrategeValeur } from "@/moteurs/montage-tutoriel-outil/equipe/strategie-valeur";
import type { EtatEquipe } from "@/moteurs/montage-tutoriel-outil/equipe/orchestre";
import { lireJournalRoles, type IdRole } from "@/moteurs/montage-tutoriel-outil/journal-roles";
import { equipeTutorielActive } from "@/services/tutoriel-equipe";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";
import { dossierComplet, fauxScenariste } from "./equipe-doubles";

const T0 = Date.UTC(2026, 10, 19, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

const FILM = {
  version: "navigation-filmee.v1",
  videoCle: "studio/test/film.mp4",
  maquette: "stocks",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 400,
  dureeVoixMs: 60000,
  cibles: [
    { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 },
    { etapeId: "e2", zonePct: { x: 60, y: 50, largeur: 30, hauteur: 12 }, instantMs: 8000, finMs: 10000 },
  ],
};

/** Commande « dossier déposé » : aucune phrase collée, ni idée. */
const commandeDossier = (film?: unknown): CommandeFabrication =>
  commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { depot: { mode: "dossier", fichierId: "f1", attestationImages: true }, fin: "aucune", ...(film ? { navigationFilmee: film } : {}) } } } as never);
const commandeIdee = (): CommandeFabrication => commandeTutoriel({ ratios: ["4:5"], script: { blocs: [], texteComplet: "" }, entrees: { tutorielOutil: { idee: "Suivre ses stocks sans tableur" } } } as never);

interface Equipe {
  port: PortEquipe;
  appels: IdRole[];
  dossierLu: number;
  tronc: { evaluer: string[][]; corrections: [string, string][] };
}

/** Faux port : un appel = la simulation du rôle (aucun Claude). `panne` : le premier appel de ce rôle lève (rien n'est payé). */
function fauxPort(options: { panne?: IdRole; tronc?: boolean } = {}): Equipe {
  const eq: Equipe = { port: undefined as never, appels: [], dossierLu: 0, tronc: { evaluer: [], corrections: [] } };
  let enPanne = options.panne;
  const roles = { "chef-de-projet": roleChefDeProjet, analyste: roleAnalyste, stratege: roleStrategeValeur } as const;
  let fiche: { moments: { id: string; zoneId: string }[] } | undefined;
  eq.port = {
    maintenant: () => new Date(T0).toISOString(),
    async appelerRole(role, entree) {
      if (enPanne === role) {
        enPanne = undefined;
        throw new Error("panne");
      }
      eq.appels.push(role);
      if (role === "scenariste") return fauxScenariste(fiche!);
      const sortie = (roles as Record<string, { simuler(e: typeof entree): unknown }>)[role]!.simuler(entree);
      if (role === "stratege") fiche = sortie as never;
      return sortie;
    },
    async lireDossier() {
      eq.dossierLu++;
      return dossierComplet();
    },
    ...(options.tronc
      ? {
          tronc: {
            evaluer: (versions: readonly { id: string; texte: string }[]) => {
              eq.tronc.evaluer.push(versions.map((v) => v.id));
              return ["Remarque du tronc : la 3e phrase est longue."];
            },
            noterCorrection: (avant: string, apres: string) => void eq.tronc.corrections.push([avant, apres]),
          },
        }
      : {}),
  };
  return eq;
}

const equipeDe = (t: Travail): EtatEquipe | undefined => (t.parametres?.tutoriel as EtatTutoriel | undefined)?.equipe;
const etatDe = (t: Travail): EtatTutoriel => t.parametres!.tutoriel as EtatTutoriel;

/** Un tour de moteur à la fois (jamais plus d'un pas) ; rend aussi ce qui a été appelé pendant ce tour. */
async function tour(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, t: Travail, i: number, eq?: Equipe) {
  const avant = eq?.appels.length ?? 0;
  const r = await moteur.avancer(t, c, T0 + i * 1000);
  return { ...r, appelsDuTour: (eq?.appels.length ?? 0) - avant };
}

/** Mène jusqu'à une pause, un échec ou la fin ; vérifie « un rôle payant par pas ». */
async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail, eq?: Equipe, depart = 0) {
  let t = travail;
  let resultat;
  for (let i = depart; i < depart + 400; i++) {
    const r = await tour(moteur, c, t, i, eq);
    expect(r.appelsDuTour).toBeLessThanOrEqual(1);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut) || t.parametres?.pause) break;
  }
  return { travail: t, resultat };
}

const moteurAvec = (j: Journal, equipe?: PortEquipe) => creerMoteurTutorielOutil({ outils: une({ ...outilsDoubles(j), ...(equipe ? { equipe } : {}) } as OutilsTutoriel) });
const lancer = (m: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, id = "t-eq") => m.lancer(c, { travailId: id, versionId: "ver-1", titre: "Tuto", maintenant: T0 });

/** Ce que fait l'action de T-EXT-33 « valider » : le registre est figé dans l'équipe avant de reprendre. */
function avecRegistreFige(t: Travail): Travail {
  const e = equipeDe(t)!;
  const f = figerRegistre(e.registre!, new Date(T0).toISOString());
  if (!f.ok) throw new Error(f.erreur);
  return { ...t, parametres: { ...t.parametres, tutoriel: { ...etatDe(t), equipe: { ...e, registre: f.registre } } } };
}

describe("T-EXT-55 · équipe éteinte (défaut) : rien ne change", () => {
  it.each([undefined, false, "true", 1])("réglage %s : `equipeTutorielActive` est faux, le port n'est pas fourni", async (v) => {
    const lire = (async (id: string, defaut: unknown) => (id === "tutoriel.equipe" || id === "tutoriel.claude" ? v : defaut)) as <T>(id: string, d: T) => Promise<T>;
    expect(await equipeTutorielActive(lire)).toBe(false);
  });

  it("`tutoriel.equipe` sans `tutoriel.claude` (ou l'inverse) : éteint ; les deux exactement `true` : allumé ; lecture en échec : éteint", async () => {
    const lecteur = (valeurs: Record<string, unknown>) => (async (id: string, d: unknown) => (id in valeurs ? valeurs[id] : d)) as <T>(id: string, d: T) => Promise<T>;
    expect(await equipeTutorielActive(lecteur({ "tutoriel.equipe": true }))).toBe(false);
    expect(await equipeTutorielActive(lecteur({ "tutoriel.claude": true }))).toBe(false);
    expect(await equipeTutorielActive(lecteur({ "tutoriel.equipe": true, "tutoriel.claude": true }))).toBe(true);
    expect(await equipeTutorielActive((async () => { throw new Error("lecture"); }) as never)).toBe(false);
  });

  it("script collé : le même travail qu'aujourd'hui, port absent ou présent mais sans dossier ni idée", async () => {
    const run = async (avecPort: boolean) => {
      const j = journalVide();
      const eq = fauxPort();
      const m = moteurAvec(j, avecPort ? eq.port : undefined);
      const c = commandeTutoriel({ ratios: ["4:5"] });
      const fin = await mener(m, c, await lancer(m, c), eq);
      expect(eq.appels).toEqual([]);
      return JSON.stringify({ travail: fin.travail, resultat: fin.resultat, voix: j.voix });
    };
    expect(await run(true)).toBe(await run(false));
  });

  it("idée seule, équipe éteinte : TO_SCRIPT_NON_ECRIT, 0 appel, 0 voix", async () => {
    const j = journalVide();
    const m = moteurAvec(j);
    const c = commandeIdee();
    const { travail } = await mener(m, c, await lancer(m, c));
    expect(travail.statut).toBe("en_file");
    expect(travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_NON_ECRIT" });
    expect(j.claude).toHaveLength(0);
    expect(j.voix).toHaveLength(0);
  });
});

describe("T-EXT-55 · équipe allumée : un rôle par pas, jusqu'à l'écran de validation", () => {
  it("dossier déposé : un seul appel payant par pas, dans l'ordre ; arrêt TO_SCRIPT_A_VALIDER ; journal et dossier lisibles ; aucune voix", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const m = moteurAvec(j, eq.port);
    const c = commandeDossier();
    const { travail } = await mener(m, c, await lancer(m, c), eq);
    expect(travail.statut).toBe("en_file");
    expect(travail.erreur).toBeUndefined();
    expect(travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER" });
    expect(eq.appels).toEqual(["stratege", "scenariste"]);
    expect(j.voix).toHaveLength(0);
    expect(j.claude).toHaveLength(0);

    // La forme lue par l'écran de validation (T-EXT-24) : construireDossierValidation l'accepte telle quelle.
    const e = equipeDe(travail)!;
    const vue = construireDossierValidation({ cahier: e.cahier!, carte: e.carte!, fiche: e.fiche!, proposition: e.propositionScripts!, verdict: e.verdict!, ...(e.parcours ? { parcours: e.parcours } : {}), ...(e.registre ? { registre: e.registre } : {}) });
    expect(vue.versions.map((v) => v.id)).toEqual(["A", "B"]);
    expect(JSON.stringify(vue)).not.toMatch(/€|\$|Douleur|Solution/);

    // Le journal de T-EXT-34 : chaque rôle fait, le scénariste attend Williams, jamais une sortie dedans.
    const journal = lireJournalRoles(travail.parametres);
    expect(journal.map((l) => [l.role, l.etat])).toEqual([
      ["chef-de-projet", "fait"],
      ["analyste", "fait"],
      ["stratege", "fait"],
      ["scenariste", "attend-williams"],
      ["realisateur", "fait"],
      ["controleur", "fait"],
      ["documentaliste", "fait"],
    ]);
    // Un appel revenu = une ligne de compte par rôle (le chef et l'analyste travaillent par règles).
    expect(etatDe(travail).appelsClaude?.roles).toEqual({ stratege: 1, scenariste: 1 });
  });

  it("un second tour sans changement ne rappelle rien", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const m = moteurAvec(j, eq.port);
    const c = commandeDossier();
    const arret = await mener(m, c, await lancer(m, c), eq);
    const avant = eq.appels.length;
    const encore = await m.avancer(arret.travail, c, T0 + 900_000);
    expect(eq.appels).toHaveLength(avant);
    expect(encore.travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER" });
    expect(etatDe(encore.travail).appelsClaude?.roles).toEqual({ stratege: 1, scenariste: 1 });
  });

  it("panne du stratège puis « Réessayer » : échec lisible sans montant, le chef et l'analyste ne sont pas rappelés, rien n'est payé deux fois", async () => {
    const j = journalVide();
    const eq = fauxPort({ panne: "stratege" });
    const m = moteurAvec(j, eq.port);
    const c = commandeDossier();
    const panne = await mener(m, c, await lancer(m, c), eq);
    expect(panne.travail.statut).toBe("echec");
    expect(panne.travail.erreur).toMatchObject({ code: "TO_EQUIPE_PANNE", reessayable: true });
    expect(panne.travail.erreur?.messagePourWill).not.toMatch(/€|\$|\d/);
    expect(eq.appels).toEqual([]);
    const reprise = await mener(m, c, await m.reessayer(panne.travail, T0 + 100_000), eq, 100);
    expect(reprise.travail.parametres?.pause).toMatchObject({ code: "TO_SCRIPT_A_VALIDER" });
    expect(eq.appels).toEqual(["stratege", "scenariste"]);
    // Le résultat payé du stratège est gardé dans le registre 45a : même entrée, jamais un second appel.
    const payes = Object.keys(equipeDe(reprise.travail)!.payes);
    expect(payes.filter((k) => k.startsWith("Tutoriel · stratege:"))).toHaveLength(1);
  });

  it("phrase seule (aucun dossier) : le chef met en pause avec sa phrase, 0 appel, 0 voix, sans échec", async () => {
    const j = journalVide();
    const eq = fauxPort();
    const m = moteurAvec(j, eq.port);
    const c = commandeIdee();
    const { travail } = await mener(m, c, await lancer(m, c), eq);
    expect(travail.statut).toBe("en_file");
    expect(travail.parametres?.pause).toMatchObject({ code: expect.stringMatching(/^TO_(CAS_V2|DEMANDE_VIDE)$/) });
    expect(eq.appels).toEqual([]);
    expect(j.voix).toHaveLength(0);
  });
});

describe("T-EXT-55 · le choix de Williams, puis la fabrication", () => {
  async function jusquAuChoix(options: { film?: unknown; tronc?: boolean } = {}) {
    const j = journalVide();
    const eq = fauxPort({ tronc: options.tronc });
    const m = moteurAvec(j, eq.port);
    const c = commandeDossier(options.film);
    const arret = await mener(m, c, await lancer(m, c), eq);
    return { j, eq, m, c, arret };
  }

  it("version B choisie, registre figé : la voix lit le texte de B, mot pour mot", async () => {
    const { j, m, c, arret, eq } = await jusquAuChoix({ film: FILM });
    const e = equipeDe(arret.travail)!;
    const texteB = e.propositionScripts!.versions[1].phrases.map((p) => p.texte).join(" ");
    const reprise = validerScriptTutoriel(avecRegistreFige(arret.travail), undefined, { version: "B" });
    expect(reprise.statut).toBe("en_cours");
    const appelsAvant = eq.appels.length;
    const fin = await mener(m, c, reprise, eq, 100);
    expect(fin.travail.statut).toBe("termine");
    expect(eq.appels).toHaveLength(appelsAvant);
    const t = etatDe(fin.travail);
    expect(t.script).toMatchObject({ texte: texteB, source: "valide" });
    expect(t.audio?.mots.map((x) => x.mot).join(" ")).toBe(texteB);
    expect(j.voix.length).toBeGreaterThan(0);
    expect(t.equipe?.scriptChoisi).toMatchObject({ source: "choisi", texte: texteB });
  });

  it("correction : le texte de Williams est gardé au caractère près, aucun appel de rôle de plus", async () => {
    const { m, c, arret, eq } = await jusquAuChoix({ film: FILM });
    const corrige = "Chaque jour,   vous perdez du temps à chercher. Ma phrase à moi ! Votre entreprise respire.";
    const appelsAvant = eq.appels.length;
    const reprise = validerScriptTutoriel(avecRegistreFige(arret.travail), undefined, { corrige });
    const fin = await mener(m, c, reprise, eq, 100);
    expect(fin.travail.statut).toBe("termine");
    expect(etatDe(fin.travail).script).toMatchObject({ texte: corrige, source: "valide" });
    expect(eq.appels).toHaveLength(appelsAvant);
  });

  it("registre pas figé, ou aucun choix : rien ne change", async () => {
    const { arret } = await jusquAuChoix();
    expect(validerScriptTutoriel(arret.travail, undefined, { version: "B" })).toBe(arret.travail);
    const fige = avecRegistreFige(arret.travail);
    expect(validerScriptTutoriel(fige)).toBe(fige);
    expect(validerScriptTutoriel(fige, "un texte qui n'est dans aucune version")).toBe(fige);
    expect(validerScriptTutoriel(fige, undefined, { version: "C" as never })).toBe(fige);
    expect(validerScriptTutoriel(fige, undefined, { corrige: "   " })).toBe(fige);
  });

  it("le texte exact d'une version, ou celui déjà choisi par l'écran (T-EXT-33), est accepté", async () => {
    const { arret } = await jusquAuChoix();
    const fige = avecRegistreFige(arret.travail);
    const a = equipeDe(fige)!.propositionScripts!.versions[0].phrases.map((p) => p.texte).join(" ");
    expect(etatDe(validerScriptTutoriel(fige, a)).script).toMatchObject({ texte: a, source: "valide" });
  });

  it("après le calage, sans film : TO_FILM_A_CAPTURER (sans échec) ; le film déposé, la vidéo reprend sans refaire la voix", async () => {
    const { j, m, c, arret } = await jusquAuChoix();
    const reprise = validerScriptTutoriel(avecRegistreFige(arret.travail), undefined, { version: "A" });
    const attente = await mener(m, c, reprise, undefined, 100);
    expect(attente.travail.statut).toBe("en_file");
    expect(attente.travail.erreur).toBeUndefined();
    expect(attente.travail.parametres?.pause).toMatchObject({ code: "TO_FILM_A_CAPTURER" });
    expect(attente.travail.parametres?.pause).toMatchObject({ message: expect.stringContaining("Rien n'a échoué") });
    expect(etatDe(attente.travail).equipe?.verdictCalage).toBeDefined();
    expect(etatDe(attente.travail).plan).toBeUndefined();
    const voix = j.voix.length;
    // Le film arrive dans les entrées de la commande : la suite d'aujourd'hui (plan, montage).
    const avecFilm = commandeDossier(FILM);
    const fin = await mener(m, avecFilm, { ...attente.travail, statut: "en_cours" }, undefined, 200);
    expect(fin.travail.statut).toBe("termine");
    expect(j.voix).toHaveLength(voix);
    expect(etatDe(fin.travail).plan).toBeDefined();
  });

  it("tronc fourni : `evaluer` une fois avec les 2 versions, ses remarques gardées, le texte des versions inchangé ; `noterCorrection` seulement pour une correction", async () => {
    const sans = await jusquAuChoix();
    const avecTronc = await jusquAuChoix({ tronc: true, film: FILM });
    expect(avecTronc.eq.tronc.evaluer).toEqual([["A", "B"]]);
    const e = equipeDe(avecTronc.arret.travail)!;
    expect(e.remarquesTronc).toEqual(["Remarque du tronc : la 3e phrase est longue."]);
    expect(e.propositionScripts).toEqual(equipeDe(sans.arret.travail)!.propositionScripts);

    // Version choisie : rien noté.
    const choisi = await mener(avecTronc.m, avecTronc.c, validerScriptTutoriel(avecRegistreFige(avecTronc.arret.travail), undefined, { version: "A" }), avecTronc.eq, 100);
    expect(choisi.travail.statut).toBe("termine");
    expect(avecTronc.eq.tronc.corrections).toEqual([]);

    // Correction : notée une fois (avant, après), même après plusieurs tours.
    const autre = await jusquAuChoix({ tronc: true, film: FILM });
    const corrige = "Chaque jour, vous perdez du temps à chercher. Ma phrase à moi ! Votre entreprise respire.";
    const fin = await mener(autre.m, autre.c, validerScriptTutoriel(avecRegistreFige(autre.arret.travail), undefined, { corrige }), autre.eq, 100);
    expect(fin.travail.statut).toBe("termine");
    expect(autre.eq.tronc.corrections).toHaveLength(1);
    expect(autre.eq.tronc.corrections[0]![1]).toBe(corrige);
  });

  it("port `tronc` absent (cas de master) : aucune remarque, aucune note", async () => {
    const { arret, eq } = await jusquAuChoix();
    expect(equipeDe(arret.travail)!.remarquesTronc).toBeUndefined();
    expect(eq.tronc).toEqual({ evaluer: [], corrections: [] });
  });
});

describe("T-EXT-55 · gardes de lecture du texte", () => {
  const lire = (f: string) => readFileSync(f, "utf8");

  it("`tutoriel-equipe.ts` : une seule ligne d'appel de l'exécuteur gardé, elle porte `origine`", () => {
    const lignes = lire("src/services/tutoriel-equipe.ts").split("\n").filter((l) => /\bexecuter\(/.test(l));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatch(/origine/);
    expect(lignes[0]).toMatch(/plafondPropre/);
  });

  it("l'ancien écrivain est retiré : `requeteScript`, `ecrireScript` et `MODELE_SCRIPT_TUTORIEL` n'existent plus dans src ni tests", () => {
    const script = lire("src/moteurs/montage-tutoriel-outil/script.ts");
    expect(script).not.toMatch(/export (async )?function (requeteScript|ecrireScript)|MODELE_SCRIPT_TUTORIEL/);
    const chaine = lire("src/moteurs/montage-tutoriel-outil/chaine.ts");
    expect(chaine).not.toMatch(/ecrireScript/);
    expect(chaine).toMatch(/MOTS_PAR_SECONDE/);
    expect(script).toMatch(/export const MOTS_PAR_SECONDE/);
  });
});

