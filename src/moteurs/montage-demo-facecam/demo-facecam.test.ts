/**
 * Lot J — démo facecam : vrai rendu branché, de bout en bout avec des DOUBLES (transcription, alignement, LLM du plan,
 * rendu). Aucun réseau : `fetch` est remplacé par une fonction qui échoue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement } from "@/fournisseurs/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { creerMoteurMontageDemoFacecam, moteurMontageDemoFacecam } from ".";
import type { DependancesDemo, EtatDemo } from "./chaine";
import { decalageParLesMots, miseEnPageDemo, recadrage, seCroisent, dansLeRect, zoomA, type RatioDemo } from "./mise-en-page";
import { pistesEcran, planPourCalque } from "./pistes";
import type { ProprietesDemoFacecam } from "./proprietes";

const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";
const motsDe = (texte: string, depuisSec = 0, pas = 0.4): MotHorodate[] => texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(depuisSec + i * pas).toFixed(3), finSec: +(depuisSec + i * pas + 0.33).toFixed(3) }));

/** Double du studio-aligneur `/transcrire` : les mots dépendent de la vidéo lue. */
function transcripteur(motsParSource: Record<string, MotHorodate[]>, options: { panne?: boolean } = {}) {
  const demandes = new Map<string, DemandeFacecam>();
  const soumises: DemandeFacecam[] = [];
  const f: FournisseurFacecam & { soumises: DemandeFacecam[] } = {
    id: "simulation",
    mode: "simulation",
    soumises,
    async soumettre(_route, d) {
      soumises.push(d);
      demandes.set(d.idTravail, d);
      return { statut: "en_file" };
    },
    async suivre(_route, id) {
      const d = demandes.get(id);
      if (!d) return { statut: "echec", erreur: { code: "fichier-inaccessible", reessayable: true, message: "inconnu", travailInconnu: true } };
      if (options.panne) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne simulée." } };
      const mots = motsParSource[d.source] ?? [];
      return { statut: "termine", resultat: { transcriptionCle: `tr/${id}`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, mots } } as never;
    },
  };
  return f;
}

/** Double de l'alignement : décale chaque mot de 30 ms (preuve que les mots calés remplacent la transcription). */
function aligneur(options: { panne?: boolean } = {}): FournisseurAlignement & { demandes: DemandeAlignement[] } {
  const demandes: DemandeAlignement[] = [];
  return {
    id: "double",
    type: "alignement",
    mode: "simulation",
    nom: "Calage",
    reelPrevu: "",
    capacites: { asynchrone: true, accordExige: false },
    demandes,
    async soumettre(d) {
      demandes.push(d);
    },
    async suivre(id) {
      const d = demandes.find((x) => x.idAlignement === id)!;
      if (options.panne) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Panne simulée." } };
      return { statut: "termine", resultat: { mots: (d.reference ?? []).map((m) => ({ ...m, debutSec: +(m.debutSec + 0.03).toFixed(3), finSec: +(m.finSec + 0.03).toFixed(3) })), motsNonAlignes: 0, modele: "double", dureeCalculSec: 0 } };
    },
  };
}

/** Double du LLM du plan : un zoom sur le bouton, un clic, une carte KPI et une scène de niveau 3 (interdite). */
function llmPlan(): AppelClaude & { appels: number } {
  const f = (async (requete: RequeteClaude) => {
    f.appels++;
    const minutage = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l)).map((l) => l.split("\t"));
    const fin = Number(minutage.at(-1)?.[3] ?? 5000);
    const tiers = Math.round(fin / 3);
    const scene = (id: string, debut: number, finMs: number, extra: object) => ({ id, version: 1, mots: { premier: 0, dernier: 0 }, debutMs: debut, finMs, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, ...extra });
    const plan = {
      version: "plan-scenes-1",
      scenes: [
        scene("zoom", 0, tiers, { piece: "zoom-camera", parametres: { cible: { x: 70, y: 30 }, facteur: 1.8, moment: 0.1, titreFenetre: "Axion" } }),
        scene("clic", tiers, 2 * tiers, { piece: "curseur", parametres: { trajet: [{ x: 10, y: 10 }, { x: 62, y: 44 }], clic: true, partDeplacement: 0.5 } }),
        scene("kpi", 2 * tiers, fin, { niveau: 3, piece: "carte-kpi", parametres: { libelle: "Devis prêts", valeur: 3, prefixe: "", suffixe: "", decimales: 0, tendance: "hausse", variation: "" }, code: "while(true){}" }),
      ],
    };
    return { texte: JSON.stringify(plan), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, sortie: 0 } as never };
  }) as unknown as AppelClaude & { appels: number };
  f.appels = 0;
  return f;
}

let horloge = Date.UTC(2026, 10, 8, 10);
function deps(o: { facecam: FournisseurFacecam; alignement?: FournisseurAlignement; appelerPlan?: AppelClaude; renduEnPanne?: RatioDemo[] }) {
  const rendu = creerServiceRenduSimule(() => horloge);
  const demandesRendu: DemandeRendu[] = [];
  const d: DependancesDemo = {
    facecam: o.facecam,
    ...(o.alignement ? { alignement: o.alignement } : {}),
    ...(o.appelerPlan ? { appelerPlan: o.appelerPlan } : {}),
    rendu: {
      async soumettre(demande) {
        demandesRendu.push(demande);
        return rendu.soumettre(demande);
      },
      async etat(id) {
        const demande = demandesRendu.find((x) => x.idRendu === id);
        const ratio = (demande?.parametres.proprietes as ProprietesDemoFacecam | undefined)?.miseEnPage.ratio;
        if (ratio && o.renduEnPanne?.includes(ratio)) return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "Rendu en panne." } };
        return rendu.etat(id);
      },
    },
    urlLecture: async (cle) => `https://r2.exemple/lire/${cle}`,
    urlDepot: async (cle) => `https://r2.exemple/deposer/${cle}`,
  };
  return { d, demandesRendu };
}

const commande = (demoFacecam: Record<string, unknown>, ratios: string[] = ["9:16"]) =>
  ({ videoId: "v1", formatId: "demo-facecam", ratios, briques: { "sous-titres": true }, distribution: [], dureeCibleSec: 60, script: { blocs: [], texteComplet: "" }, entrees: { demoFacecam } }) as unknown as CommandeFabrication;
const ctx = { travailId: "t1", versionId: "ver1", titre: "Démo devis", maintenant: horloge };

async function jusquAuBout(moteur: ReturnType<typeof creerMoteurMontageDemoFacecam>, c: CommandeFabrication, travail: Awaited<ReturnType<typeof moteur.lancer>>) {
  let t = travail;
  for (let i = 0; i < 200; i++) {
    horloge += 1000;
    const r = await moteur.avancer(t, c, horloge);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error(`pas fini : ${t.statut}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("mise en page moitié / moitié", () => {
  for (const ratio of ["4:5", "9:16", "1:1", "16:9"] as RatioDemo[]) {
    it(`${ratio} : deux moitiés égales, sous-titres dans la moitié écran, rien sur le visage`, () => {
      const m = miseEnPageDemo(ratio);
      expect(seCroisent(m.ecran, m.facecam)).toBe(false);
      const aire = (r: { largeur: number; hauteur: number }) => r.largeur * r.hauteur;
      expect(Math.abs(aire(m.ecran) - aire(m.facecam)) / aire(m.ecran)).toBeLessThan(0.01);
      expect(dansLeRect(m.sousTitres, m.ecran)).toBe(true);
      expect(seCroisent(m.sousTitres, m.facecam)).toBe(false);
    });
  }
  it("4:5 : l'écran en haut, la facecam en bas (1080 × 1350)", () => {
    const m = miseEnPageDemo("4:5");
    expect([m.largeur, m.hauteur, m.disposition]).toEqual([1080, 1350, "haut-bas"]);
    expect(m.ecran.y).toBe(0);
    expect(m.facecam.y).toBe(m.ecran.hauteur);
  });
  it("recadrage propre : proportions de la cible, sans sortir de la moitié de la source", () => {
    const r = recadrage({ largeur: 1920, hauteur: 1080 }, "gauche", { largeur: 1080, hauteur: 674 }, { x: 0.5, y: 0.42 });
    expect(r.largeur / r.hauteur).toBeCloseTo(1080 / 674, 2);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.largeur).toBeLessThanOrEqual(960);
  });
  it("zoom doux : monte puis redescend, jamais au-delà du facteur", () => {
    const z = [{ debutMs: 1000, finMs: 3000, x: 70, y: 30, facteur: 1.8 }];
    expect(zoomA(z, 500).facteur).toBe(1);
    expect(zoomA(z, 1100).facteur).toBeGreaterThan(1);
    expect(zoomA(z, 2000).facteur).toBe(1.8);
    expect(zoomA(z, 2950).facteur).toBeLessThan(1.8);
  });
  it("synchronisation par l'audio : le décalage est retrouvé par les mots communs ; aucun mot commun → null", () => {
    const facecam = motsDe(PHRASE, 2);
    const ecran = motsDe(PHRASE, 0.5);
    expect(decalageParLesMots(facecam, ecran)?.decalageSec).toBeCloseTo(1.5, 2);
    expect(decalageParLesMots(facecam, motsDe("musique seule sans aucune parole reconnue ici"))).toBeNull();
  });
});

describe("chaîne réelle avec doubles", () => {
  it("deux fichiers : voix réelle transcrite et calée, synchro par l'audio, plan LLM réparé, 4:5 puis 9:16, fiche complète", async () => {
    const facecam = transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE, 2), "https://r2.exemple/lire/rush/ecran.mp4": motsDe(PHRASE, 0.5) });
    const alignement = aligneur();
    const llm = llmPlan();
    const { d, demandesRendu } = deps({ facecam, alignement, appelerPlan: llm });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/face.mp4" }, ecran: { cle: "rush/ecran.mp4" }, consignes: [{ type: "legende", debutMs: 0, finMs: 2000, texte: "Nouveau devis" }] });
    expect(moteur.refusAuLancement?.(c)).toBeNull();
    const lance = await moteur.lancer(c, ctx);
    expect(lance.parametres?.pause).toBeUndefined();
    const { travail, resultat } = await jusquAuBout(moteur, c, lance);
    expect(travail.statut).toBe("termine");
    expect(travail.etapes.every((e) => e.statut === "terminee")).toBe(true);
    // Aucune voix de synthèse : la transcription lit les vidéos de Williams, le calage part de SES mots.
    expect(facecam.soumises.map((s) => s.source)).toEqual(["https://r2.exemple/lire/rush/face.mp4", "https://r2.exemple/lire/rush/ecran.mp4"]);
    expect(alignement.demandes[0].texte.startsWith("Bonjour je vous montre")).toBe(true);
    expect(llm.appels).toBe(1);
    const etat = travail.parametres?.demo as EtatDemo;
    expect(etat.synchro).toEqual({ mode: "audio", decalageSec: 1.5 });
    expect(etat.calage).toBe("aligneur");
    expect(etat.mots![0].debutSec).toBeCloseTo(2.03, 3);
    // Niveau 3 interdit : replié par le validateur du lot C.
    expect(etat.plan!.scenes.every((s) => s.niveau !== 3)).toBe(true);
    // 4:5 d'abord, puis l'export 9:16.
    expect(demandesRendu.map((r) => (r.parametres.proprietes as ProprietesDemoFacecam).miseEnPage.ratio)).toEqual(["4:5", "9:16"]);
    const p = demandesRendu[0].parametres.proprietes as ProprietesDemoFacecam;
    expect(demandesRendu[0].parametres.composition).toBe("DemoFacecam");
    expect(demandesRendu[0].entrees).toEqual({ facecam: "https://r2.exemple/lire/rush/face.mp4", ecran: "https://r2.exemple/lire/rush/ecran.mp4" });
    expect(p.decalageEcranSec).toBe(1.5);
    // Motion autour de l'écran : zoom et clic réels venus du plan, légende de Williams ; pièces gestuelles retirées du calque.
    expect(p.zooms[0]).toMatchObject({ x: 70, y: 30, facteur: 1.8 });
    expect(p.clics[0]).toMatchObject({ x: 62, y: 44 });
    expect(p.legendes).toEqual([{ debutMs: 0, finMs: 2000, texte: "Nouveau devis" }]);
    expect(p.plan.scenes.some((s) => s.piece === "zoom-camera" || s.piece === "curseur")).toBe(false);
    expect(p.plan.format).toEqual({ largeur: p.miseEnPage.ecran.largeur, hauteur: p.miseEnPage.ecran.hauteur, fps: 25 });
    expect(p.sousTitres.length).toBeGreaterThan(0);
    expect(p.carteFin.titre).toBe("Axion IA");
    expect(p.images).toBe(Math.ceil(((etat.dureeSec! * 1000 + 2500) * 25) / 1000));
    // Fiche vidéo.
    expect(resultat!.sorties.map((s) => [s.ratio, s.resolution])).toEqual([
      ["4:5", "1080x1350"],
      ["9:16", "1080x1920"],
    ]);
    expect(resultat!.lignesReelles.every((l) => l.total.centimes === 0)).toBe(true);
    expect(resultat!.sousTitres![0].mots[0].mot).toBe("Bonjour");
    expect(resultat!.noteQualite.alertes.some((a) => a.gravite === "bloquant")).toBe(false);
    expect((resultat!.projetMontage.scenes as unknown[]).length).toBe(etat.plan!.scenes.length);
  });

  it("une seule vidéo déjà en écran partagé, longue (8 min) : jamais de refus, sans LLM → plan simple avec remarque", async () => {
    const longue = Array.from({ length: 60 }, () => PHRASE).join(" ");
    const facecam = transcripteur({ "https://r2.exemple/lire/rush/seule.mp4": motsDe(longue, 0, 0.3) });
    const { d, demandesRendu } = deps({ facecam, alignement: aligneur() });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/seule.mp4" }, ecranPartage: { ecran: "gauche" } }, ["4:5"]);
    const { travail, resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
    expect(travail.statut).toBe("termine");
    expect(resultat!.sorties[0].dureeSec).toBeGreaterThan(480);
    const p = demandesRendu[0].parametres.proprietes as ProprietesDemoFacecam;
    expect(demandesRendu[0].entrees.ecran).toBe(demandesRendu[0].entrees.facecam);
    expect(p.recadrageEcran.x + p.recadrageEcran.largeur).toBeLessThanOrEqual(960);
    expect(p.recadrageFacecam.x).toBeGreaterThanOrEqual(960);
    expect(p.decalageEcranSec).toBe(0);
    expect(resultat!.noteQualite.alertes.map((a) => a.message)).toContain("Motion design simple (légendes) : la composition par l'IA n'est pas branchée.");
  });

  it("briques ratées : transcription en panne, rendu 9:16 en panne → réserves « À vérifier », le 4:5 est livré", async () => {
    const { d } = deps({ facecam: transcripteur({}, { panne: true }), renduEnPanne: ["9:16"] });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/face.mp4", dureeSec: 42 } });
    const { travail, resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
    expect(travail.statut).toBe("termine");
    expect(resultat!.sorties.map((s) => s.ratio)).toEqual(["4:5"]);
    expect(resultat!.sorties[0].dureeSec).toBeCloseTo(44.5, 1);
    const reserves = resultat!.noteQualite.alertes.filter((a) => a.gravite === "attention").map((a) => a.message);
    expect(reserves.some((m) => m.startsWith("À vérifier · Sous-titres"))).toBe(true);
    expect(reserves.some((m) => m.startsWith("À vérifier · Format 9:16"))).toBe(true);
  });

  it("alignement en panne : les mots de la transcription sont gardés, réserve de calage", async () => {
    const { d } = deps({ facecam: transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE) }), alignement: aligneur({ panne: true }) });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/face.mp4" } }, ["4:5"]);
    const { travail, resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
    expect((travail.parametres?.demo as EtatDemo).calage).toBe("transcription");
    expect(resultat!.noteQualite.alertes.some((a) => a.message.startsWith("À vérifier · Calage"))).toBe(true);
  });

  it("rendu 4:5 impossible : échec réessayable (rien d'autre n'est jeté), puis « Réessayer » repart", async () => {
    const { d } = deps({ facecam: transcripteur({}), renduEnPanne: ["4:5"] });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/face.mp4", dureeSec: 10 } }, ["4:5"]);
    const { travail } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.reessayable).toBe(true);
    const repris = await moteur.reessayer(travail, horloge);
    expect((repris.parametres?.demo as EtatDemo).plan).toBeDefined();
    expect((repris.parametres?.demo as EtatDemo).travaux["rendu-4:5"]).toBeUndefined();
  });

  it("sans serveurs reliés : pause claire (jamais un échec, jamais une vidéo d'essai)", async () => {
    const t = await moteurMontageDemoFacecam.lancer(commande({ facecam: { cle: "rush/face.mp4" } }), ctx);
    expect(t.statut).toBe("en_file");
    expect(t.parametres?.pause).toMatchObject({ code: "PAS_ENCORE_BRANCHE" });
  });
});

describe("retouche : parties touchées seulement (empreintes de scènes)", () => {
  async function versionDAvant() {
    const facecam = transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE) });
    const llm = llmPlan();
    const { d } = deps({ facecam, alignement: aligneur(), appelerPlan: llm });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c = commande({ facecam: { cle: "rush/face.mp4" } }, ["4:5"]);
    const { resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
    return { resultat: resultat!, c };
  }

  it("rien de touché : la vidéo d'avant est reprise, aucune transcription ni rendu", async () => {
    const { resultat, c } = await versionDAvant();
    const facecam = transcripteur({});
    const { d, demandesRendu } = deps({ facecam });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const lance = await moteur.retoucher({ commande: c, contexte: { ...ctx, travailId: "t2", versionId: "ver2" }, planIds: [], parent: { projetMontage: resultat.projetMontage } } as never);
    const { resultat: r2 } = await jusquAuBout(moteur, c, lance);
    expect(facecam.soumises).toHaveLength(0);
    expect(demandesRendu).toHaveLength(0);
    expect(r2!.sorties[0].fichierCle).toBe(resultat.sorties[0].fichierCle);
  });

  it("une scène changée : seule elle est touchée, la parole n'est pas retranscrite, la vidéo est refaite", async () => {
    const { resultat } = await versionDAvant();
    const reprise = resultat.projetMontage.reprise as { plan: { scenes: { id: string; piece: string; parametres: Record<string, unknown> }[] } };
    const plan = structuredClone(reprise.plan);
    const kpi = plan.scenes.find((s) => s.piece === "carte-kpi")!;
    kpi.parametres = { ...kpi.parametres, valeur: 4 };
    const facecam = transcripteur({});
    const { d, demandesRendu } = deps({ facecam });
    const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
    const c2 = commande({ facecam: { cle: "rush/face.mp4" }, plan }, ["4:5"]);
    const lance = await moteur.retoucher({ commande: c2, contexte: { ...ctx, travailId: "t3", versionId: "ver3" }, planIds: [], parent: { projetMontage: resultat.projetMontage } } as never);
    expect(lance.etapes.map((e) => e.cle)).toEqual(["plan", "montage", "controle"]);
    const { resultat: r3 } = await jusquAuBout(moteur, c2, lance);
    expect(r3!.projetMontage.scenesTouchees).toEqual([kpi.id]);
    expect(facecam.soumises).toHaveLength(0);
    expect(demandesRendu).toHaveLength(1);
    expect(r3!.sorties[0].fichierCle).not.toBe(resultat.sorties[0].fichierCle);
  });
});

describe("pistes écran", () => {
  it("la consigne de Williams passe avant le zoom du plan qui la chevauche", async () => {
    const llm = llmPlan();
    const r = await llm({ modele: "m", maxTokens: 1, messages: [{ role: "user", contenu: "0\ta\t0\t3000" }] } as never);
    const { validerPlan } = await import("@/briques/plan-scenes/validateur");
    const plan = validerPlan(JSON.parse(r.texte), { mots: [{ texte: "a", debutMs: 0, finMs: 3000 }], format: { largeur: 1080, hauteur: 676, fps: 25 }, facecam: false }).plan;
    const p = pistesEcran(plan, [{ type: "zoom", debutMs: 0, finMs: 900, x: 10, y: 10, facteur: 2 }]);
    expect(p.zooms[0]).toMatchObject({ x: 10, y: 10, facteur: 2 });
    expect(p.zooms.every((z, i) => i === 0 || z.debutMs >= p.zooms[i - 1].finMs)).toBe(true);
    expect(planPourCalque(plan).scenes.length).toBeLessThan(plan.scenes.length);
  });
});
