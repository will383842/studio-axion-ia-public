/**
 * D4-F2 — la démo facecam applique un plan de scènes retouché (opération `planScenes`).
 * Doubles seulement (transcription, alignement, LLM du plan, rendu) ; aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement } from "@/fournisseurs/types";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo, EtatDemo } from "@/moteurs/montage-demo-facecam/chaine";
import type { RatioDemo } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { ProprietesDemoFacecam } from "@/moteurs/montage-demo-facecam/proprietes";
import type { OperationMontage } from "@/moteurs/types";

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

type Plan = { scenes: { id: string; piece: string; parametres: Record<string, unknown> }[] };

/** Valeur témoin : JSON.stringify du Travail rendu par retoucher sans planScenes, calculée sur master (4b73b452) avant le changement. */
const TEMOIN = "{\"id\":\"t2\",\"type\":\"retouche\",\"cibleId\":\"v1\",\"versionId\":\"ver2\",\"titre\":\"Démo devis\",\"etapes\":[{\"cle\":\"plan\",\"nom\":\"Les scènes touchées\",\"icone\":\"image\",\"dependDe\":[],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"montage\",\"nom\":\"L'écran partagé\",\"icone\":\"ecran-partage\",\"dependDe\":[\"plan\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"controle\",\"nom\":\"La vérification\",\"icone\":\"bouclier\",\"dependDe\":[\"montage\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]}],\"statut\":\"en_file\",\"progression\":0,\"tentatives\":1,\"cleIdempotence\":\"v1:ver2:retouche\",\"fournisseurUtilise\":\"montage-demo-facecam\",\"creeLe\":\"2026-11-08T10:00:00.000Z\",\"modifieLe\":\"2026-11-08T10:00:00.000Z\",\"debuteLe\":\"2026-11-08T10:00:00.000Z\",\"parametres\":{\"demo\":{\"version\":1,\"travaux\":{},\"remarques\":[{\"code\":\"RIEN_A_REFAIRE\",\"message\":\"Aucune scène touchée : la vidéo d'avant est reprise telle quelle.\"}],\"reserves\":[],\"sorties\":{\"4:5\":{\"fichierCle\":\"demo-facecam/v1/ver1/demo-4x5.mp4\"}},\"mots\":[{\"mot\":\"Bonjour\",\"debutSec\":0.03,\"finSec\":0.36},{\"mot\":\"je\",\"debutSec\":0.43,\"finSec\":0.76},{\"mot\":\"vous\",\"debutSec\":0.83,\"finSec\":1.16},{\"mot\":\"montre\",\"debutSec\":1.23,\"finSec\":1.56},{\"mot\":\"comment\",\"debutSec\":1.63,\"finSec\":1.96},{\"mot\":\"on\",\"debutSec\":2.03,\"finSec\":2.36},{\"mot\":\"crée\",\"debutSec\":2.43,\"finSec\":2.76},{\"mot\":\"un\",\"debutSec\":2.83,\"finSec\":3.16},{\"mot\":\"devis\",\"debutSec\":3.23,\"finSec\":3.56},{\"mot\":\"dans\",\"debutSec\":3.63,\"finSec\":3.96},{\"mot\":\"Axion\",\"debutSec\":4.03,\"finSec\":4.36},{\"mot\":\"en\",\"debutSec\":4.43,\"finSec\":4.76},{\"mot\":\"trois\",\"debutSec\":4.83,\"finSec\":5.16},{\"mot\":\"clics.\",\"debutSec\":5.23,\"finSec\":5.56},{\"mot\":\"Je\",\"debutSec\":5.63,\"finSec\":5.96},{\"mot\":\"clique\",\"debutSec\":6.03,\"finSec\":6.36},{\"mot\":\"sur\",\"debutSec\":6.43,\"finSec\":6.76},{\"mot\":\"nouveau\",\"debutSec\":6.83,\"finSec\":7.16},{\"mot\":\"devis\",\"debutSec\":7.23,\"finSec\":7.56},{\"mot\":\"puis\",\"debutSec\":7.63,\"finSec\":7.96},{\"mot\":\"je\",\"debutSec\":8.03,\"finSec\":8.36},{\"mot\":\"choisis\",\"debutSec\":8.43,\"finSec\":8.76},{\"mot\":\"le\",\"debutSec\":8.83,\"finSec\":9.16},{\"mot\":\"client\",\"debutSec\":9.23,\"finSec\":9.56},{\"mot\":\"et\",\"debutSec\":9.63,\"finSec\":9.96},{\"mot\":\"voilà\",\"debutSec\":10.03,\"finSec\":10.36},{\"mot\":\"le\",\"debutSec\":10.43,\"finSec\":10.76},{\"mot\":\"devis\",\"debutSec\":10.83,\"finSec\":11.16},{\"mot\":\"est\",\"debutSec\":11.23,\"finSec\":11.56},{\"mot\":\"prêt.\",\"debutSec\":11.63,\"finSec\":11.96}],\"calage\":\"aligneur\",\"dureeSec\":12.43,\"synchro\":{\"mode\":\"aucune\",\"decalageSec\":0},\"plan\":{\"version\":\"plan-scenes-1\",\"format\":{\"largeur\":1080,\"hauteur\":676,\"fps\":25},\"facecam\":false,\"dureeMs\":12430,\"habillage\":{\"fond\":\"ivoire\",\"accent\":\"terracotta\"},\"mots\":[{\"texte\":\"Bonjour\",\"debutMs\":30,\"finMs\":360},{\"texte\":\"je\",\"debutMs\":430,\"finMs\":760},{\"texte\":\"vous\",\"debutMs\":830,\"finMs\":1160},{\"texte\":\"montre\",\"debutMs\":1230,\"finMs\":1560},{\"texte\":\"comment\",\"debutMs\":1630,\"finMs\":1960},{\"texte\":\"on\",\"debutMs\":2030,\"finMs\":2360},{\"texte\":\"crée\",\"debutMs\":2430,\"finMs\":2760},{\"texte\":\"un\",\"debutMs\":2830,\"finMs\":3160},{\"texte\":\"devis\",\"debutMs\":3230,\"finMs\":3560},{\"texte\":\"dans\",\"debutMs\":3630,\"finMs\":3960},{\"texte\":\"Axion\",\"debutMs\":4030,\"finMs\":4360},{\"texte\":\"en\",\"debutMs\":4430,\"finMs\":4760},{\"texte\":\"trois\",\"debutMs\":4830,\"finMs\":5160},{\"texte\":\"clics.\",\"debutMs\":5230,\"finMs\":5560},{\"texte\":\"Je\",\"debutMs\":5630,\"finMs\":5960},{\"texte\":\"clique\",\"debutMs\":6030,\"finMs\":6360},{\"texte\":\"sur\",\"debutMs\":6430,\"finMs\":6760},{\"texte\":\"nouveau\",\"debutMs\":6830,\"finMs\":7160},{\"texte\":\"devis\",\"debutMs\":7230,\"finMs\":7560},{\"texte\":\"puis\",\"debutMs\":7630,\"finMs\":7960},{\"texte\":\"je\",\"debutMs\":8030,\"finMs\":8360},{\"texte\":\"choisis\",\"debutMs\":8430,\"finMs\":8760},{\"texte\":\"le\",\"debutMs\":8830,\"finMs\":9160},{\"texte\":\"client\",\"debutMs\":9230,\"finMs\":9560},{\"texte\":\"et\",\"debutMs\":9630,\"finMs\":9960},{\"texte\":\"voilà\",\"debutMs\":10030,\"finMs\":10360},{\"texte\":\"le\",\"debutMs\":10430,\"finMs\":10760},{\"texte\":\"devis\",\"debutMs\":10830,\"finMs\":11160},{\"texte\":\"est\",\"debutMs\":11230,\"finMs\":11560},{\"texte\":\"prêt.\",\"debutMs\":11630,\"finMs\":11960}],\"scenes\":[{\"id\":\"zoom\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":30,\"finMs\":1560,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"zoom-camera\",\"parametres\":{\"cible\":{\"x\":70,\"y\":30},\"facteur\":1.8,\"moment\":0.1,\"titreFenetre\":\"Axion\"},\"empreinte\":\"6f174773b3169c00\"},{\"id\":\"clic\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":1560,\"finMs\":7974,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"curseur\",\"parametres\":{\"trajet\":[{\"x\":10,\"y\":10},{\"x\":62,\"y\":44}],\"clic\":true,\"partDeplacement\":0.5},\"empreinte\":\"6aa9aaa8c11e9bf5\"},{\"id\":\"kpi\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":0},\"debutMs\":7974,\"finMs\":11960,\"niveau\":1,\"position\":\"centre\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"carte-kpi\",\"parametres\":{\"libelle\":\"Devis prêts\",\"valeur\":3,\"prefixe\":\"\",\"suffixe\":\"\",\"decimales\":0,\"tendance\":\"hausse\",\"variation\":\"\"},\"empreinte\":\"a9fdf89ef6808ef5\"}]},\"sourcePlan\":\"reprise\",\"scenesTouchees\":[],\"fini\":true}}}";

async function versionDAvant() {
  const facecam = transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE) });
  const { d } = deps({ facecam, alignement: aligneur(), appelerPlan: llmPlan() });
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  const c = commande({ facecam: { cle: "rush/face.mp4" } }, ["4:5"]);
  const { resultat } = await jusquAuBout(moteur, c, await moteur.lancer(c, ctx));
  return { resultat: resultat!, c };
}

async function retoucher(projetMontage: Record<string, unknown>, c: CommandeFabrication, operations?: OperationMontage[]) {
  const { d, demandesRendu } = deps({ facecam: transcripteur({}) });
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  const lance = await moteur.retoucher({ commande: c, contexte: { ...ctx, travailId: "t2", versionId: "ver2" }, planIds: [], parent: { projetMontage }, ...(operations ? { operations } : {}) } as never);
  return { moteur, lance, demandesRendu };
}

describe("D4-F2 · opération planScenes", () => {
  it("avec un plan dont une scène change : sourcePlan « retouche », cette seule scène touchée", async () => {
    const { resultat, c } = await versionDAvant();
    const plan = structuredClone((resultat.projetMontage.reprise as { plan: Plan }).plan);
    const kpi = plan.scenes.find((s) => s.piece === "carte-kpi")!;
    kpi.parametres = { ...kpi.parametres, valeur: 4 };
    const { lance } = await retoucher(resultat.projetMontage, c, [{ type: "planScenes", plan }]);
    const etat = lance.parametres?.demo as EtatDemo;
    expect(etat.sourcePlan).toBe("retouche");
    expect(etat.scenesTouchees).toEqual([kpi.id]);
    expect(etat.plan!.scenes.find((s) => s.id === kpi.id)!.parametres).toMatchObject({ valeur: 4 });
  });

  it("la dernière opération planScenes gagne", async () => {
    const { resultat, c } = await versionDAvant();
    const plan = structuredClone((resultat.projetMontage.reprise as { plan: Plan }).plan);
    const kpi = plan.scenes.find((s) => s.piece === "carte-kpi")!;
    const autre = structuredClone(plan);
    autre.scenes.find((s) => s.id === kpi.id)!.parametres = { ...kpi.parametres, valeur: 9 };
    const { lance } = await retoucher(resultat.projetMontage, c, [{ type: "planScenes", plan: autre }, { type: "planScenes", plan }]);
    expect((lance.parametres?.demo as EtatDemo).scenesTouchees).toEqual([]);
  });

  it("plan identique : aucune scène touchée, sorties d'avant reprises sans rendu", async () => {
    const { resultat, c } = await versionDAvant();
    const plan = structuredClone((resultat.projetMontage.reprise as { plan: Plan }).plan);
    const { moteur, lance, demandesRendu } = await retoucher(resultat.projetMontage, c, [{ type: "planScenes", plan }]);
    expect((lance.parametres?.demo as EtatDemo).scenesTouchees).toEqual([]);
    const { resultat: r2 } = await jusquAuBout(moteur, c, lance);
    expect(demandesRendu).toHaveLength(0);
    expect(r2!.sorties[0].fichierCle).toBe(resultat.sorties[0].fichierCle);
  });

  it("plan invalide : pas d'exception, remarques de validation dans l'état", async () => {
    const { resultat, c } = await versionDAvant();
    const { lance } = await retoucher(resultat.projetMontage, c, [{ type: "planScenes", plan: {} }]);
    const etat = lance.parametres?.demo as EtatDemo;
    expect(etat.sourcePlan).toBe("retouche");
    expect(etat.remarques.length).toBeGreaterThan(0);
  });

  it("sans reprise : l'opération est ignorée, tout est refait comme aujourd'hui", async () => {
    const { c } = await versionDAvant();
    const a = await retoucher({}, c);
    const b = await retoucher({}, c, [{ type: "planScenes", plan: {} }]);
    expect(JSON.stringify(b.lance)).toBe(JSON.stringify(a.lance));
  });

  it("sans l'opération : même Travail qu'aujourd'hui (sans operations, [], autre opération)", async () => {
    const { resultat, c } = await versionDAvant();
    const sans = JSON.stringify((await retoucher(resultat.projetMontage, c)).lance);
    expect(JSON.stringify((await retoucher(resultat.projetMontage, c, [])).lance)).toBe(sans);
    expect(JSON.stringify((await retoucher(resultat.projetMontage, c, [{ type: "corrigerMot", segmentSousTitresId: "s", indexMot: 0, mot: "x" }])).lance)).toBe(sans);
    expect(sans).toBe(TEMOIN);
  });
});
