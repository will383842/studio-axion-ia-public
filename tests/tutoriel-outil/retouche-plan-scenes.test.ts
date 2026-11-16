/**
 * R3-01 — le tutoriel d'outil applique un plan de scènes retouché (opération `planScenes`), comme la démo facecam.
 * Doubles seulement (voix, rendu, Claude) ; aucun réseau. Le compteur `journal.claude` compte les appels au double de Claude.
 */
import { describe, expect, it } from "vitest";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, type EtatTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { OperationMontage } from "@/moteurs/types";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

async function mener(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, travail: Travail, jusqua = 400) {
  let t = travail;
  for (let i = 1; i <= jusqua; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error(`pas fini : ${t.statut}`);
}

async function premiereVersion(j: Journal) {
  const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
  const c = commandeTutoriel({ ratios: ["4:5"] });
  const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
  return { moteur, c, parent: { versionId: "ver-1", projetMontage: resultat!.projetMontage, pistes: [] } };
}

const planDuParent = (parent: { projetMontage: Record<string, unknown> }) => (parent.projetMontage.tutoriel as { plan: { plan: PlanValide } }).plan.plan;

async function retoucher(moteur: ReturnType<typeof creerMoteurTutorielOutil>, c: CommandeFabrication, parent: unknown, operations?: OperationMontage[]) {
  return moteur.retoucher({ commande: c, contexte: { travailId: "t-r", versionId: "ver-2", titre: "Retouche", maintenant: T0 }, planIds: [], consigne: "Refaire", parent, ...(operations ? { operations } : {}) } as never);
}

const etatDe = (t: Travail) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;

/** Plan du parent dont le texte de la première scène change. */
function planModifie(parent: { projetMontage: Record<string, unknown> }) {
  const plan = structuredClone(planDuParent(parent)) as PlanValide;
  const s = plan.scenes[0];
  s.parametres = { ...(s.parametres as Record<string, unknown>), titre: "Titre retouché" } as never;
  return plan;
}

describe("R3-01 · opération planScenes (tutoriel)", () => {
  it("scène modifiée : l'état porte ce plan, « repris », aucun appel Claude de plus", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const avant = j.claude.length;
    const plan = planModifie(parent);
    const t = await retoucher(moteur, c, parent, [{ type: "planScenes", plan }]);
    expect(etatDe(t).parent?.plan?.scenes[0].parametres).toMatchObject({ titre: "Titre retouché" });
    const { resultat } = await mener(moteur, c, t);
    const retenu = (resultat!.projetMontage.tutoriel as { plan: { plan: PlanValide; source: string } }).plan;
    expect(retenu.source).toBe("repris");
    expect(retenu.plan.scenes[0].parametres).toMatchObject({ titre: "Titre retouché" });
    expect(j.claude.length - avant).toBe(0);
  });

  it("la dernière opération planScenes gagne", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const intact = structuredClone(planDuParent(parent));
    const t = await retoucher(moteur, c, parent, [{ type: "planScenes", plan: planModifie(parent) }, { type: "planScenes", plan: intact }]);
    expect(etatDe(t).parent?.plan?.scenes[0].parametres).toEqual(planDuParent(parent).scenes[0].parametres);
  });

  it("plan aux mots changés : ignoré, plan d'avant gardé, Claude à 0", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const avant = j.claude.length;
    const plan = planModifie(parent);
    plan.mots = plan.mots.map((m, i) => (i === 0 ? { ...m, texte: "Autre" } : m));
    const t = await retoucher(moteur, c, parent, [{ type: "planScenes", plan }]);
    expect(JSON.stringify(etatDe(t).parent?.plan)).toBe(JSON.stringify(planDuParent(parent)));
    await mener(moteur, c, t);
    expect(j.claude.length - avant).toBe(0);
  });

  it("plan au format changé : ignoré", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const plan = { ...planModifie(parent), format: { largeur: 1, hauteur: 1, fps: 25 } };
    const t = await retoucher(moteur, c, parent, [{ type: "planScenes", plan }]);
    expect(JSON.stringify(etatDe(t).parent?.plan)).toBe(JSON.stringify(planDuParent(parent)));
  });

  it("plan illisible : ignoré, plan d'avant gardé", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const t = await retoucher(moteur, c, parent, [{ type: "planScenes", plan: {} }]);
    expect(JSON.stringify(etatDe(t).parent?.plan)).toBe(JSON.stringify(planDuParent(parent)));
  });

  it("sans parent ou parent sans plan : opération ignorée, comme aujourd'hui", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const op: OperationMontage[] = [{ type: "planScenes", plan: planModifie(parent) }];
    expect(JSON.stringify(await retoucher(moteur, c, undefined, op))).toBe(JSON.stringify(await retoucher(moteur, c, undefined)));
    const vide = { versionId: "ver-1", projetMontage: {}, pistes: [] };
    expect(JSON.stringify(await retoucher(moteur, c, vide, op))).toBe(JSON.stringify(await retoucher(moteur, c, vide)));
  });

  it("sans l'opération (absente, [], corrigerMot) : même Travail qu'avant le changement (témoin)", async () => {
    const j = journalVide();
    const { moteur, c, parent } = await premiereVersion(j);
    const sans = JSON.stringify(await retoucher(moteur, c, parent));
    expect(JSON.stringify(await retoucher(moteur, c, parent, []))).toBe(sans);
    expect(JSON.stringify(await retoucher(moteur, c, parent, [{ type: "corrigerMot", segmentSousTitresId: "s", indexMot: 0, mot: "x" }]))).toBe(sans);
    expect(sans).toBe(TEMOIN);
  });
});

const TEMOIN = "{\"id\":\"t-r\",\"type\":\"retouche\",\"cibleId\":\"v-to\",\"versionId\":\"ver-2\",\"titre\":\"Retouche\",\"etapes\":[{\"cle\":\"script\",\"nom\":\"Le script\",\"icone\":\"ecrire\",\"dependDe\":[],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"voix\",\"nom\":\"La voix\",\"icone\":\"micro\",\"dependDe\":[\"script\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"calage\",\"nom\":\"Le calage des mots\",\"icone\":\"sous-titres\",\"dependDe\":[\"voix\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"plan\",\"nom\":\"Le plan de scènes\",\"icone\":\"baguette\",\"dependDe\":[\"calage\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]},{\"cle\":\"montage\",\"nom\":\"Le montage 4:5\",\"icone\":\"film\",\"dependDe\":[\"plan\"],\"statut\":\"en_attente\",\"progression\":0,\"sortieFichierIds\":[]}],\"statut\":\"en_file\",\"progression\":0,\"tentatives\":1,\"cleIdempotence\":\"v-to:ver-2:retouche\",\"fournisseurUtilise\":\"montage-tutoriel-outil\",\"creeLe\":\"2026-11-08T09:00:00.000Z\",\"modifieLe\":\"2026-11-08T09:00:00.000Z\",\"debuteLe\":\"2026-11-08T09:00:00.000Z\",\"finEstimee\":\"2026-11-08T09:03:14.000Z\",\"parametres\":{\"tutoriel\":{\"ratios\":[\"4:5\"],\"rendus\":[],\"reserves\":[],\"parent\":{\"plan\":{\"version\":\"plan-scenes-1\",\"format\":{\"largeur\":1080,\"hauteur\":1350,\"fps\":25},\"facecam\":false,\"dureeMs\":20750,\"habillage\":{\"fond\":\"ivoire\",\"accent\":\"terracotta\"},\"mots\":[{\"texte\":\"Créez\",\"debutMs\":0,\"finMs\":350},{\"texte\":\"votre\",\"debutMs\":400,\"finMs\":750},{\"texte\":\"premier\",\"debutMs\":800,\"finMs\":1150},{\"texte\":\"tableau\",\"debutMs\":1200,\"finMs\":1550},{\"texte\":\"de\",\"debutMs\":1600,\"finMs\":1950},{\"texte\":\"bord\",\"debutMs\":2000,\"finMs\":2350},{\"texte\":\"en\",\"debutMs\":2400,\"finMs\":2750},{\"texte\":\"une\",\"debutMs\":2800,\"finMs\":3150},{\"texte\":\"minute.\",\"debutMs\":3200,\"finMs\":3550},{\"texte\":\"Ouvrez\",\"debutMs\":3600,\"finMs\":3950},{\"texte\":\"l'outil\",\"debutMs\":4000,\"finMs\":4350},{\"texte\":\"et\",\"debutMs\":4400,\"finMs\":4750},{\"texte\":\"cliquez\",\"debutMs\":4800,\"finMs\":5150},{\"texte\":\"sur\",\"debutMs\":5200,\"finMs\":5550},{\"texte\":\"Nouveau\",\"debutMs\":5600,\"finMs\":5950},{\"texte\":\"tableau.\",\"debutMs\":6000,\"finMs\":6350},{\"texte\":\"Tapez\",\"debutMs\":6400,\"finMs\":6750},{\"texte\":\"le\",\"debutMs\":6800,\"finMs\":7150},{\"texte\":\"nom\",\"debutMs\":7200,\"finMs\":7550},{\"texte\":\"de\",\"debutMs\":7600,\"finMs\":7950},{\"texte\":\"votre\",\"debutMs\":8000,\"finMs\":8350},{\"texte\":\"projet.\",\"debutMs\":8400,\"finMs\":8750},{\"texte\":\"Ajoutez\",\"debutMs\":8800,\"finMs\":9150},{\"texte\":\"la\",\"debutMs\":9200,\"finMs\":9550},{\"texte\":\"carte\",\"debutMs\":9600,\"finMs\":9950},{\"texte\":\"des\",\"debutMs\":10000,\"finMs\":10350},{\"texte\":\"ventes\",\"debutMs\":10400,\"finMs\":10750},{\"texte\":\"du\",\"debutMs\":10800,\"finMs\":11150},{\"texte\":\"mois.\",\"debutMs\":11200,\"finMs\":11550},{\"texte\":\"Le\",\"debutMs\":11600,\"finMs\":11950},{\"texte\":\"graphique\",\"debutMs\":12000,\"finMs\":12350},{\"texte\":\"se\",\"debutMs\":12400,\"finMs\":12750},{\"texte\":\"remplit\",\"debutMs\":12800,\"finMs\":13150},{\"texte\":\"tout\",\"debutMs\":13200,\"finMs\":13550},{\"texte\":\"seul.\",\"debutMs\":13600,\"finMs\":13950},{\"texte\":\"Glissez\",\"debutMs\":14000,\"finMs\":14350},{\"texte\":\"la\",\"debutMs\":14400,\"finMs\":14750},{\"texte\":\"liste\",\"debutMs\":14800,\"finMs\":15150},{\"texte\":\"des\",\"debutMs\":15200,\"finMs\":15550},{\"texte\":\"clients\",\"debutMs\":15600,\"finMs\":15950},{\"texte\":\"à\",\"debutMs\":16000,\"finMs\":16350},{\"texte\":\"droite.\",\"debutMs\":16400,\"finMs\":16750},{\"texte\":\"Votre\",\"debutMs\":16800,\"finMs\":17150},{\"texte\":\"tableau\",\"debutMs\":17200,\"finMs\":17550},{\"texte\":\"de\",\"debutMs\":17600,\"finMs\":17950},{\"texte\":\"bord\",\"debutMs\":18000,\"finMs\":18350},{\"texte\":\"est\",\"debutMs\":18400,\"finMs\":18750},{\"texte\":\"prêt,\",\"debutMs\":18800,\"finMs\":19150},{\"texte\":\"partagé\",\"debutMs\":19200,\"finMs\":19550},{\"texte\":\"avec\",\"debutMs\":19600,\"finMs\":19950},{\"texte\":\"votre\",\"debutMs\":20000,\"finMs\":20350},{\"texte\":\"équipe.\",\"debutMs\":20400,\"finMs\":20750}],\"scenes\":[{\"id\":\"s1\",\"version\":1,\"mots\":{\"premier\":0,\"dernier\":25},\"debutMs\":0,\"finMs\":10400,\"niveau\":1,\"position\":\"haut\",\"transition\":{\"entree\":\"fondu\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"fenetre-app\",\"parametres\":{\"titre\":\"Tableaux\",\"onglets\":[\"Accueil\",\"Ventes\"],\"ongletActif\":0,\"contenu\":\"formulaire\"},\"empreinte\":\"abef7df7d90e2d18\"},{\"id\":\"s2\",\"version\":1,\"mots\":{\"premier\":26,\"dernier\":51},\"debutMs\":10400,\"finMs\":20750,\"niveau\":2,\"position\":\"haut\",\"transition\":{\"entree\":\"glisse-haut\",\"sortie\":\"fondu\",\"dureeMs\":400},\"piece\":\"legende\",\"parametres\":{\"texte\":\"Tableau prêt\",\"sousTexte\":\"\",\"style\":\"titre\"},\"calques\":[{\"piece\":\"curseur\",\"parametres\":{\"trajet\":[{\"x\":20,\"y\":20},{\"x\":70,\"y\":60}],\"clic\":true,\"partDeplacement\":0.6},\"debutMs\":0,\"zone\":\"plein\"},{\"piece\":\"zoom-camera\",\"parametres\":{\"cible\":{\"x\":70,\"y\":60},\"facteur\":1.6,\"moment\":0.3,\"titreFenetre\":\"Tableaux\"},\"debutMs\":300,\"zone\":\"plein\"}],\"empreinte\":\"d641971eca178aa7\"}]},\"audio\":{\"fichierCle\":\"studio/test/audio-maitre/v-to/brut.mp3\",\"dureeSec\":21.05,\"mots\":[{\"mot\":\"Créez\",\"debutSec\":0,\"finSec\":0.35},{\"mot\":\"votre\",\"debutSec\":0.4,\"finSec\":0.75},{\"mot\":\"premier\",\"debutSec\":0.8,\"finSec\":1.15},{\"mot\":\"tableau\",\"debutSec\":1.2,\"finSec\":1.55},{\"mot\":\"de\",\"debutSec\":1.6,\"finSec\":1.95},{\"mot\":\"bord\",\"debutSec\":2,\"finSec\":2.35},{\"mot\":\"en\",\"debutSec\":2.4,\"finSec\":2.75},{\"mot\":\"une\",\"debutSec\":2.8,\"finSec\":3.15},{\"mot\":\"minute.\",\"debutSec\":3.2,\"finSec\":3.55},{\"mot\":\"Ouvrez\",\"debutSec\":3.6,\"finSec\":3.95},{\"mot\":\"l'outil\",\"debutSec\":4,\"finSec\":4.35},{\"mot\":\"et\",\"debutSec\":4.4,\"finSec\":4.75},{\"mot\":\"cliquez\",\"debutSec\":4.8,\"finSec\":5.15},{\"mot\":\"sur\",\"debutSec\":5.2,\"finSec\":5.55},{\"mot\":\"Nouveau\",\"debutSec\":5.6,\"finSec\":5.95},{\"mot\":\"tableau.\",\"debutSec\":6,\"finSec\":6.35},{\"mot\":\"Tapez\",\"debutSec\":6.4,\"finSec\":6.75},{\"mot\":\"le\",\"debutSec\":6.8,\"finSec\":7.15},{\"mot\":\"nom\",\"debutSec\":7.2,\"finSec\":7.55},{\"mot\":\"de\",\"debutSec\":7.6,\"finSec\":7.95},{\"mot\":\"votre\",\"debutSec\":8,\"finSec\":8.35},{\"mot\":\"projet.\",\"debutSec\":8.4,\"finSec\":8.75},{\"mot\":\"Ajoutez\",\"debutSec\":8.8,\"finSec\":9.15},{\"mot\":\"la\",\"debutSec\":9.2,\"finSec\":9.55},{\"mot\":\"carte\",\"debutSec\":9.6,\"finSec\":9.95},{\"mot\":\"des\",\"debutSec\":10,\"finSec\":10.35},{\"mot\":\"ventes\",\"debutSec\":10.4,\"finSec\":10.75},{\"mot\":\"du\",\"debutSec\":10.8,\"finSec\":11.15},{\"mot\":\"mois.\",\"debutSec\":11.2,\"finSec\":11.55},{\"mot\":\"Le\",\"debutSec\":11.6,\"finSec\":11.95},{\"mot\":\"graphique\",\"debutSec\":12,\"finSec\":12.35},{\"mot\":\"se\",\"debutSec\":12.4,\"finSec\":12.75},{\"mot\":\"remplit\",\"debutSec\":12.8,\"finSec\":13.15},{\"mot\":\"tout\",\"debutSec\":13.2,\"finSec\":13.55},{\"mot\":\"seul.\",\"debutSec\":13.6,\"finSec\":13.95},{\"mot\":\"Glissez\",\"debutSec\":14,\"finSec\":14.35},{\"mot\":\"la\",\"debutSec\":14.4,\"finSec\":14.75},{\"mot\":\"liste\",\"debutSec\":14.8,\"finSec\":15.15},{\"mot\":\"des\",\"debutSec\":15.2,\"finSec\":15.55},{\"mot\":\"clients\",\"debutSec\":15.6,\"finSec\":15.95},{\"mot\":\"à\",\"debutSec\":16,\"finSec\":16.35},{\"mot\":\"droite.\",\"debutSec\":16.4,\"finSec\":16.75},{\"mot\":\"Votre\",\"debutSec\":16.8,\"finSec\":17.15},{\"mot\":\"tableau\",\"debutSec\":17.2,\"finSec\":17.55},{\"mot\":\"de\",\"debutSec\":17.6,\"finSec\":17.95},{\"mot\":\"bord\",\"debutSec\":18,\"finSec\":18.35},{\"mot\":\"est\",\"debutSec\":18.4,\"finSec\":18.75},{\"mot\":\"prêt,\",\"debutSec\":18.8,\"finSec\":19.15},{\"mot\":\"partagé\",\"debutSec\":19.2,\"finSec\":19.55},{\"mot\":\"avec\",\"debutSec\":19.6,\"finSec\":19.95},{\"mot\":\"votre\",\"debutSec\":20,\"finSec\":20.35},{\"mot\":\"équipe.\",\"debutSec\":20.4,\"finSec\":20.75}],\"empreinte\":\"am-0a64502dc6e313\",\"reutilise\":false,\"coutCentimes\":12,\"caracteres\":297,\"fournisseur\":\"heygen\"}}}}}";
