/**
 * N-05-VOLET-g2-v21r : la porte du volet « avant / après » dans le plan du tutoriel, l'extraction des 2 captures dans l'état du
 * travail et la copie de rendu signée, derrière `tutoriel.voletAvantApres` ÉTEINT. Moteur réel ; voix, Claude, rendu et
 * extraction SIMULÉS (doubles) : aucun appel réel, aucun réseau, 0 €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CATALOGUE_BRIQUES, type DefinitionBrique } from "@/briques/plan-scenes/catalogue";
import { estGardee } from "@/briques/plan-scenes/pieces-gardees";
import { consignePlan } from "@/briques/plan-scenes/generateur";
import { avecEmpreintes, scenesARerendre } from "@/briques/plan-scenes/empreinte";
import { ID_VOLET } from "@/briques/plan-scenes/poser-captures-volet";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu } from "@/fournisseurs/types";
import type { ReponseClaude, RequeteClaude } from "@/fournisseurs/claude/client";
import { avancerEtape, etatInitial, ETAPES_TUTORIEL, planPourRatio, proprietesTutoriel, type CleEtapeTutoriel, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import { COMPOSITION_TUTORIEL } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { decouperEnMorceaux } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import type { CaptureGardee } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

vi.mock("server-only", () => ({}));
const { copieDeRenduAvecVolet } = await import("@/services/captures-volet-tutoriel");
const { portVoletTutoriel } = await import("@/services/tutoriel-branchements");

const T0 = Date.UTC(2026, 10, 25, 12);
const NB = 6;
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
const CAPTURES: CaptureGardee[] = [
  { cle: "studio/test/videos/v-to/volet-avant-abc.jpg", largeur: 1080, hauteur: 1350, empreinte: "ea", zones: [] },
  { cle: "studio/test/videos/v-to/volet-apres-abc.jpg", largeur: 1080, hauteur: 1350, empreinte: "eb", zones: [] },
];
const signee = (cle: string) => `https://stockage.test/${cle}`;
/** Une autre pièce GARDÉE du catalogue (jamais permise par ce chemin). */
const AUTRE_GARDEE = (Object.values(CATALOGUE_BRIQUES) as DefinitionBrique[]).find((d) => d.id !== ID_VOLET && estGardee(d));

/** Faux Claude : 6 scènes ; la 1re est le volet, la 2e (option) une autre pièce gardée ; le reste des fenêtres d'application. */
function planSix(requete: RequeteClaude, autre = false): string {
  const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l));
  const n = lignes.length;
  const ms = (i: number, col: 2 | 3) => Number(lignes[i].split("\t")[col]);
  const b = Array.from({ length: NB + 1 }, (_, k) => Math.floor((k * n) / NB));
  return JSON.stringify({
    version: "plan-scenes-1",
    habillage: { fond: "ivoire", accent: "terracotta" },
    scenes: Array.from({ length: NB }, (_, k) => ({
      id: `s${k + 1}`,
      version: 1,
      mots: { premier: b[k], dernier: b[k + 1] - 1 },
      debutMs: ms(b[k], 2),
      finMs: k === NB - 1 ? ms(n - 1, 3) : ms(b[k + 1], 2),
      niveau: 1,
      position: k === 0 ? "centre" : "plein",
      transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
      ...(k === 0
        ? { piece: ID_VOLET, parametres: { etiquettes: true } }
        : k === 1 && autre && AUTRE_GARDEE
          ? { piece: AUTRE_GARDEE.id, parametres: AUTRE_GARDEE.exemple }
          : { piece: "fenetre-app", parametres: { titre: "Tableaux", onglets: ["Accueil", "Ventes"], ongletActif: k % 2, contenu: "formulaire" } }),
    })),
  });
}

type Port = NonNullable<OutilsTutoriel["volet"]>;
const portVolet = (captures: Port["captures"] = async () => ({ etat: "fini", captures: CAPTURES })): Port & { appels: number } => {
  const p = {
    appels: 0,
    captures: async (x: Parameters<Port["captures"]>[0]) => (p.appels++, captures(x)),
    copieDeRendu: (plan: PlanValide, projet: unknown, signer: (cle: string) => Promise<string>) => copieDeRenduAvecVolet(plan, projet, { signer }),
  };
  return p;
};

function outils(j: Journal, plus: Partial<OutilsTutoriel> = {}, autre = false): OutilsTutoriel & { signatures: Record<string, string>[] } {
  const base = outilsDoubles(j);
  const signatures: Record<string, string>[] = [];
  const claude: OutilsTutoriel["claude"] = async (requete) => {
    if (!requete.json) return base.claude!(requete);
    j.claude.push(requete);
    return { texte: planSix(requete, autre), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 10, sortie: 10 } } as unknown as ReponseClaude;
  };
  const signer: OutilsTutoriel["rendu"]["signer"] = async (lectures, depot) => (signatures.push({ ...lectures }), base.rendu.signer(lectures, depot));
  return { ...base, claude, rendu: { ...base.rendu, signer }, ...plus, signatures };
}

const volets = (p: PlanValide | undefined) => ((p?.scenes ?? []) as unknown as { piece: string; parametres: Record<string, unknown> }[]).filter((s) => s.piece === ID_VOLET);
const planDe = (d: DemandeRendu) => (d.parametres.proprietes as { plan: PlanValide }).plan;
const compos = (j: Journal) => j.rendus.filter((d) => d.parametres.composition === COMPOSITION_TUTORIEL);
const ENTREES_PERMISES = ["audio", "filmNavigation"];
const entreesPermises = (ds: DemandeRendu[]) => ds.filter((d) => d.operation === "composition").forEach((d) => expect(Object.keys(d.entrees).every((n) => ENTREES_PERMISES.includes(n))).toBe(true));

async function faire(cle: CleEtapeTutoriel, etat: EtatTutoriel, o: OutilsTutoriel, c: CommandeFabrication = commandeTutoriel()) {
  let e = etat;
  for (let i = 0; i < 60; i++) {
    const r = await avancerEtape(cle, e, c, o, "t-volet");
    e = r.etat;
    if (r.statut === "faite") return e;
  }
  throw new Error(`l'étape ${cle} ne finit pas`);
}

async function jusqua(derniere: CleEtapeTutoriel, o: OutilsTutoriel, depart?: EtatTutoriel, c: CommandeFabrication = commandeTutoriel()) {
  let e = depart ?? etatInitial(c);
  for (const cle of ETAPES_TUTORIEL) {
    e = await faire(cle, e, o, c);
    if (cle === derniere) break;
  }
  return e;
}

/** La demande du rendu entier telle que master la construit (copie figée de `demandeRendu` d'avant g2). */
async function demandeDeMaster(etat: EtatTutoriel, o: OutilsTutoriel, c: CommandeFabrication, ratio: "4:5" | "9:16"): Promise<DemandeRendu> {
  const nom = ratio.replace(":", "x");
  const cle = o.rendu.cle(`tutoriel-${nom}.mp4`);
  const voix = etat.audio?.fichierCle;
  const signe = await outilsDoubles(journalVide()).rendu.signer(voix ? { audio: voix } : {}, { cle, mime: "video/mp4" });
  return {
    idRendu: `t-volet-${nom}-0`,
    operation: "composition",
    file: "longue",
    entrees: signe.lectures,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: COMPOSITION_TUTORIEL, proprietes: proprietesTutoriel(etat, ratio, c.briques["sous-titres"] !== false, o, undefined, c) },
  };
}

describe("N-05-VOLET-g2 · éteint", () => {
  it("(a) éteint = demande de rendu identique, octet pour octet (même avec des captures dans l'état)", async () => {
    const j = journalVide();
    const o = outils(j);
    const avantMontage = await jusqua("plan", o);
    expect(volets(avantMontage.plan!.plan)).toHaveLength(0);
    const e = await faire("montage", avantMontage, o);
    const attendue = await demandeDeMaster(avantMontage, o, commandeTutoriel(), "4:5");
    expect(JSON.stringify(compos(j)[0])).toBe(JSON.stringify(attendue));
    expect(e.captures).toBeUndefined();
    // Même état, des captures déjà là, port absent : rien ne change.
    const j2 = journalVide();
    await faire("montage", { ...avantMontage, captures: CAPTURES }, outils(j2));
    expect(JSON.stringify(compos(j2)[0])).toBe(JSON.stringify(attendue));
    entreesPermises([...j.rendus, ...j2.rendus]);
  });
});

describe("N-05-VOLET-g2 · allumé", () => {
  it("(b) allumé sans captures (null) → copie sans volet, rendu identique à aujourd'hui", async () => {
    const j = journalVide();
    const port = portVolet(async () => null);
    const o = outils(j, { volet: port });
    const avantMontage = await jusqua("plan", o);
    expect(volets(avantMontage.plan!.plan)).toHaveLength(1);
    const e = await faire("montage", avantMontage, o);
    expect(e.captures).toEqual([]);
    const sansVolet: EtatTutoriel = { ...avantMontage, plan: { ...avantMontage.plan!, plan: { ...avantMontage.plan!.plan, scenes: avantMontage.plan!.plan.scenes.filter((s) => s.piece !== ID_VOLET) } } };
    const attendue = await demandeDeMaster(sansVolet, outils(journalVide()), commandeTutoriel(), "4:5");
    expect(JSON.stringify(compos(j)[0])).toBe(JSON.stringify(attendue));
    expect(o.signatures.every((s) => !("voletAvant" in s) && !("voletApres" in s))).toBe(true);
    entreesPermises(j.rendus);
    // Copie qui lève : volet retiré, rendu identique à aujourd'hui, jamais un échec.
    const leve = { ...portVolet(), copieDeRendu: async () => { throw new Error("signature"); } };
    const j3 = journalVide();
    await faire("montage", { ...avantMontage, captures: CAPTURES }, outils(j3, { volet: leve }));
    expect(JSON.stringify({ ...compos(j3)[0], entrees: {} })).toBe(JSON.stringify({ ...attendue, entrees: {} }));
  });

  it("(c) allumé avec captures → les 2 images signées dans `proprietes.plan`, plan gardé intact, `entrees` sans volet", async () => {
    const j = journalVide();
    const o = outils(j, { volet: portVolet() });
    const avantMontage = await jusqua("plan", o);
    const garde = JSON.stringify(avantMontage.plan);
    const e = await faire("montage", avantMontage, o);
    const v = volets(planDe(compos(j)[0]!));
    expect(v).toHaveLength(1);
    expect(v[0]!.parametres).toMatchObject({ avant: signee(CAPTURES[0]!.cle), apres: signee(CAPTURES[1]!.cle) });
    expect(JSON.stringify(e.plan)).toBe(garde);
    expect(volets(e.plan!.plan)[0]!.parametres).not.toHaveProperty("avant");
    expect(Object.keys(compos(j)[0]!.entrees)).toEqual(["audio"]);
    // Le MÊME appel de signature porte la voix et les 2 images (même durée de validité).
    expect(o.signatures.find((s) => "voletAvant" in s)).toEqual({ audio: e.audio!.fichierCle, voletAvant: CAPTURES[0]!.cle, voletApres: CAPTURES[1]!.cle });
    entreesPermises(j.rendus);
  });

  it("(d) empreinte du format identique allumé ou éteint (jamais de copie signée dedans)", async () => {
    const o = outils(journalVide(), { volet: portVolet(), retouchePartielle: true });
    const avantMontage = await jusqua("plan", o);
    const allume = await faire("montage", avantMontage, o);
    const eteint = await faire("montage", avantMontage, outils(journalVide(), { retouchePartielle: true }));
    expect(allume.empreintesFormats?.["4:5"]).toBeTruthy();
    expect(allume.empreintesFormats).toEqual(eteint.empreintesFormats);
  });

  it("(e) copie appliquée dans `demandeRendu` ET `demandePlage`", async () => {
    const c = commandeTutoriel();
    const o1 = outils(journalVide(), { volet: portVolet(), retouchePartielle: true });
    const v1 = await jusqua("exports", o1, undefined, c);
    expect(v1.captures).toEqual(CAPTURES);
    // Retouche : la scène 4 change seule ; même voix, même fin → rendu par plages.
    const brut = structuredClone(v1.plan!.plan);
    brut.scenes[3]!.parametres = { ...(brut.scenes[3]!.parametres as Record<string, unknown>), titre: "Tableaux 4" } as never;
    const plan = avecEmpreintes(brut);
    const etat: EtatTutoriel = {
      ...v1,
      rendus: [],
      reserves: [],
      empreintesFormats: undefined,
      regard: undefined,
      plan: { ...v1.plan!, plan, scenesTouchees: scenesARerendre(v1.plan!.plan, plan) },
      parent: { plan: v1.plan!.plan, audio: v1.audio, rendus: Object.fromEntries(v1.rendus.map((r) => [r.ratio, r.sortie!])), empreintesFormats: v1.empreintesFormats, fin: v1.fin },
    };
    const j = journalVide();
    await avancerEtape("montage", etat, c, outils(j, { volet: portVolet(), retouchePartielle: true }), "t-volet");
    const plages = j.rendus.filter((d) => d.parametres.mode === "plage");
    expect(plages.length).toBeGreaterThan(0);
    // Chaque plage porte les propriétés complètes : le plan est la COPIE signée (jamais le plan gardé).
    for (const d of plages) {
      const v = volets(planDe(d));
      expect(v).toHaveLength(1);
      expect(v[0]!.parametres).toMatchObject({ avant: signee(CAPTURES[0]!.cle), apres: signee(CAPTURES[1]!.cle) });
      expect(Object.keys(d.entrees).some((n) => n.startsWith("volet"))).toBe(false);
    }
    entreesPermises(j.rendus);
    // Rendu entier (v1) : la copie signée aussi.
    expect(volets(planDe(v1.rendus[0]!.demande))[0]!.parametres.avant).toBe(signee(CAPTURES[0]!.cle));
  });

  it("(f) volet gardé après fusion avec le parent, `planPourRatio`, découpe en morceaux et plan fourni par une retouche", async () => {
    const o = outils(journalVide(), { volet: portVolet() });
    const avecVolet = (await jusqua("plan", o)).plan!.plan;
    // planPourRatio (9:16) : le volet validé reste.
    expect(volets(planPourRatio(avecVolet, "9:16"))).toHaveLength(1);
    // Découpe en morceaux : la scène du volet est rendable seule.
    const d = decouperEnMorceaux({ plan: avecVolet });
    expect(d.ok).toBe(true);
    // Fusion avec le parent : nouveau minutage (mots décalés) ; la scène du volet du parent est reprise puis revalidée.
    const base = await jusqua("calage", outils(journalVide()));
    const decale = base.motsPlan!.map((m) => ({ ...m, debutMs: m.debutMs + 10, finMs: m.finMs + 10 }));
    const apres = await faire("plan", { ...base, motsPlan: decale, parent: { plan: avecVolet } }, outils(journalVide(), { volet: portVolet() }));
    expect(volets(apres.plan!.plan)).toHaveLength(1);
  });

  it("(f) retouche : volet gardé si le parent en a un ; ajouté à un parent SANS volet = retiré", async () => {
    const T = (n: number) => T0 + n * 1000;
    const mener = async (moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail) => {
      let t = travail;
      for (let i = 1; i <= 600; i++) {
        const r = await moteur.avancer(t, c, T(i));
        t = r.travail;
        if (r.resultat || t.statut === "echec") return r.resultat!;
      }
      throw new Error("pas fini");
    };
    const retoucher = (moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, parent: unknown, plan: PlanValide) =>
      moteur.retoucher({ commande: c, contexte: { travailId: "t-r", versionId: "ver-2", titre: "Retouche", maintenant: T0 }, planIds: [], consigne: "Refaire", parent, operations: [{ type: "planScenes", plan }] } as never);
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const premiere = async (o: OutilsTutoriel) => {
      const moteur = creerMoteurTutorielOutil({ outils: une(o) });
      const r = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
      return { moteur, parent: { versionId: "ver-1", projetMontage: r.projetMontage, pistes: [] } };
    };
    const planParent = (p: { projetMontage: Record<string, unknown> }) => (p.projetMontage.tutoriel as { plan: { plan: PlanValide } }).plan.plan;
    const etatDe = (t: Travail) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;
    // Parent avec volet : la retouche le garde.
    const a = await premiere(outils(journalVide(), { volet: portVolet() }));
    expect(volets(planParent(a.parent))).toHaveLength(1);
    const modifie = structuredClone(planParent(a.parent));
    modifie.scenes[2]!.parametres = { ...(modifie.scenes[2]!.parametres as Record<string, unknown>), titre: "Retouché" } as never;
    const ta = await retoucher(a.moteur, c, a.parent, modifie);
    expect(volets(etatDe(ta).parent!.plan)).toHaveLength(1);
    // Parent sans volet : un volet glissé par la retouche est retiré.
    const b = await premiere(outils(journalVide()));
    const sans = planParent(b.parent);
    expect(volets(sans)).toHaveLength(0);
    const ajoute = structuredClone(sans);
    ajoute.scenes[0] = { ...ajoute.scenes[0]!, position: "centre", piece: ID_VOLET, parametres: { etiquettes: true } } as never;
    const tb = await retoucher(b.moteur, c, b.parent, ajoute);
    expect(volets(etatDe(tb).parent!.plan)).toHaveLength(0);
  });

  it("(g) liste réduite au volet seul : aucune autre pièce gardée n'entre par ce chemin", async () => {
    expect(AUTRE_GARDEE).toBeDefined();
    const j = journalVide();
    const e = await jusqua("plan", outils(j, { volet: portVolet() }, true));
    expect(volets(e.plan!.plan)).toHaveLength(1);
    expect(e.plan!.plan.scenes.some((s) => s.piece === AUTRE_GARDEE!.id)).toBe(false);
    const requete = j.claude.find((r) => r.json)!;
    expect(requete.systeme?.[0]?.texte).toBe(consignePlan([ID_VOLET]));
  });

  it("(h) consigne : éteint = `consignePlan([])` d'avant, octet pour octet ; allumé = `consignePlan([ID_VOLET])`", async () => {
    const jE = journalVide();
    await jusqua("plan", outils(jE));
    expect(jE.claude.find((r) => r.json)!.systeme?.[0]?.texte).toBe(consignePlan([]));
    const jA = journalVide();
    await jusqua("plan", outils(jA, { volet: portVolet() }));
    expect(jA.claude.find((r) => r.json)!.systeme?.[0]?.texte).toBe(consignePlan([ID_VOLET]));
    expect(consignePlan([ID_VOLET]).length).toBeGreaterThan(consignePlan([]).length);
  });

  it("(i) aucune entrée inconnue envoyée au serveur de rendu (allumé, éteint, sans captures, exports)", async () => {
    for (const plus of [{}, { volet: portVolet() }, { volet: portVolet(async () => null) }] as Partial<OutilsTutoriel>[]) {
      const j = journalVide();
      await jusqua("exports", outils(j, plus));
      expect(j.rendus.length).toBeGreaterThan(0);
      entreesPermises(j.rendus);
    }
  });

  it("(j) captures : une seule extraction par travail ; en-cours → reprise ; fini → état puis projet ; null ou levée → []", async () => {
    // en-cours au 1er tour, puis fini.
    let tour = 0;
    const port = portVolet(async () => (tour++ === 0 ? { etat: "en-cours" } : { etat: "fini", captures: CAPTURES }));
    const j = journalVide();
    const o = outils(j, { volet: port });
    const avantMontage = await jusqua("plan", o);
    const r1 = await avancerEtape("montage", avantMontage, commandeTutoriel(), o, "t-volet");
    expect(r1.statut).toBe("en-cours");
    expect(r1.etat).toEqual(avantMontage);
    expect(compos(j)).toHaveLength(0);
    const fin = await faire("exports", await faire("montage", r1.etat, o), o);
    expect(fin.captures).toEqual(CAPTURES);
    expect(port.appels).toBe(2);
    // null ou levée : [] sans échec.
    for (const p of [portVolet(async () => null), portVolet(async () => { throw new Error("aligneur"); })]) {
      const e = await faire("montage", avantMontage, outils(journalVide(), { volet: p }));
      expect(e.captures).toEqual([]);
      expect(p.appels).toBe(1);
    }
    // Projet écrit dans la version.
    const c = commandeTutoriel({ ratios: ["4:5"] });
    const moteur = creerMoteurTutorielOutil({ outils: une(outils(journalVide(), { volet: portVolet() })) });
    let t = await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
    let projet: Record<string, unknown> | undefined;
    for (let i = 1; i <= 600 && !projet; i++) {
      const r = await moteur.avancer(t, c, T0 + i * 1000);
      t = r.travail;
      projet = r.resultat?.projetMontage;
    }
    expect((projet!.tutoriel as { captures?: unknown }).captures).toEqual(CAPTURES);
  });
});

describe("N-05-VOLET-g2 · porte du service", () => {
  const FILM = { version: "navigation-filmee.v1", videoCle: "studio/test/film.mp4", maquette: "tableau", largeur: 1080, hauteur: 1350, debutFilmMs: 400, dureeVoixMs: 60000, cibles: [{ etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 }] };
  const deps = { extraire: async () => ({ statut: "en-cours" as const }), cle: (n: string) => `studio/test/videos/v-to/${n}` };
  const avecFilm = { tutorielOutil: { scriptColle: true, navigationFilmee: FILM } };
  const biblio = (permis: boolean) => {
    const base = profilNeutre("tutoriel-outil");
    const profil: ProfilVideo = { ...base, capacites: { ...base.capacites, [ID.objetEcran]: { permis } } as ProfilVideo["capacites"], verrous: [] };
    return { ...avecFilm, bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-25" } };
  };

  it("(k) porte : absent, \"true\", 1 → absent ; true sans film → absent ; bibliothèque qui ne permet pas → absent ; true + film → présent", () => {
    for (const v of [undefined, false, "true", 1, null]) expect(portVoletTutoriel(v, avecFilm, deps)).toBeUndefined();
    expect(portVoletTutoriel(true, { tutorielOutil: { scriptColle: true } }, deps)).toBeUndefined();
    expect(portVoletTutoriel(true, biblio(false), deps)).toBeUndefined();
    expect(portVoletTutoriel(true, avecFilm, deps)).toBeDefined();
    expect(portVoletTutoriel(true, biblio(true), deps)).toBeDefined();
  });

  it("(k) le port branché tire les 2 images par le port d'extraction injecté (une demande, 2 clés)", async () => {
    const appels: unknown[] = [];
    const p = portVoletTutoriel(true, avecFilm, { ...deps, extraire: async (d) => (appels.push(d), { statut: "fini", images: Object.entries(d.cles).map(([nom, cle]) => ({ nom, cle })) }) })!;
    const r = await p.captures({ idTravail: "t1", entrees: avecFilm, deja: { captures: undefined } });
    expect(appels).toHaveLength(1);
    expect(r?.etat).toBe("fini");
    // La copie de rendu branchée est celle de N-05-VOLET-f (adresses signées posées sur une COPIE).
    const plan = (await jusqua("plan", outils(journalVide(), { volet: portVolet() }))).plan!.plan;
    const copie = await p.copieDeRendu(plan, { captures: CAPTURES }, async (cle) => signee(cle));
    expect(volets(copie)[0]!.parametres).toMatchObject({ avant: signee(CAPTURES[0]!.cle), apres: signee(CAPTURES[1]!.cle) });
    expect(volets(plan)[0]!.parametres).not.toHaveProperty("avant");
  });

  it("(l) garde de texte : `chaine.ts` n'importe aucun service ; aucune écriture de réglage", () => {
    const chaine = readFileSync("src/moteurs/montage-tutoriel-outil/chaine.ts", "utf8");
    expect(chaine).not.toMatch(/from\s+"(@\/services|\.\.\/\.\.\/services)/);
    const branchements = readFileSync("src/services/tutoriel-branchements.ts", "utf8");
    expect(branchements).toMatch(/lireParametre<unknown>\("tutoriel\.voletAvantApres", false\)/);
    // Le port n'est posé dans les outils que s'il existe ; l'extraction passe par l'étape « images » de NOTRE aligneur (0 €).
    expect(branchements).toMatch(/\.\.\.\(portVolet \? \{ volet: portVolet \} : \{\}\)/);
    expect(branchements).toMatch(/fournisseurFacecam\(\{ reel: true \}\)[\s\S]*etape: "images"/);
    for (const f of ["src/services/tutoriel-branchements.ts", "src/moteurs/montage-tutoriel-outil/chaine.ts"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/ecrireParametre|parametres\.enregistrer/);
    }
  });
});
