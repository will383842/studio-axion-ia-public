/**
 * X3-06 : plan nu (Aucun) et niveau 1 (Sobre) pour la démo facecam et le tutoriel d'outil.
 * Doubles seulement ; aucun réseau, aucune dépense. Tout éteint : sans cran, chaînes identiques.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandeFabrication, MotHorodate, Travail } from "@/domaine/types";
import type { DemandeFacecam, FournisseurFacecam } from "@/fournisseurs/facecam";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import type { RequeteClaude } from "@/fournisseurs/claude/client";
import { planNiveau1, planNu } from "@/briques/plan-scenes/plan-nu";
import { schemaPlanBrut, type PlanValide } from "@/briques/plan-scenes/schema";
import { planDeRepli, validerPlan } from "@/briques/plan-scenes/validateur";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";
import type { DependancesDemo, EtatDemo } from "@/moteurs/montage-demo-facecam/chaine";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "../tutoriel-outil/doubles";

const PHRASE = "Bonjour je vous montre comment on crée un devis dans Axion en trois clics. Je clique sur nouveau devis puis je choisis le client et voilà le devis est prêt.";
const motsDe = (texte: string): MotHorodate[] => texte.split(/\s+/).map((mot, i) => ({ mot, debutSec: +(i * 0.4).toFixed(3), finSec: +(i * 0.4 + 0.33).toFixed(3) }));
const minute = motsDe(PHRASE).map((m) => ({ texte: m.mot, debutMs: Math.round(m.debutSec * 1000), finMs: Math.round(m.finSec * 1000) }));
const contexte = { mots: minute, format: { largeur: 1080, hauteur: 676, fps: 25 as const }, facecam: false, dureeMs: 12430 };

/* ---------- Brique pure ---------- */

/** Plan de départ : une scène niveau 1, une scène niveau 2 avec calques, une scène niveau 3 avec code. */
function planRiche(): PlanValide {
  const scene = (id: string, debutMs: number, finMs: number, extra: object) => ({ id, version: 1, mots: { premier: 0, dernier: 0 }, debutMs, finMs, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, ...extra });
  const brut = {
    version: "plan-scenes-1",
    scenes: [
      scene("a", 0, 3000, { piece: "legende", parametres: { texte: "Bonjour", sousTexte: "", style: "titre" } }),
      scene("b", 3000, 8000, {
        niveau: 2,
        piece: "legende",
        parametres: { texte: "Devis", sousTexte: "", style: "titre" },
        calques: [{ piece: "curseur", parametres: { trajet: [{ x: 10, y: 10 }, { x: 60, y: 40 }], clic: true, partDeplacement: 0.5 }, debutMs: 0, zone: "plein" }],
      }),
    ],
  };
  return validerPlan(brut, contexte).plan;
}

describe("X3-06 · planNu / planNiveau1 (purs)", () => {
  it("planNu : 0 scène, donc 0 pièce et 0 calque ; gabarit du plan de repli (format, mots, durée)", () => {
    const nu = planNu(contexte);
    const repli = planDeRepli(contexte);
    expect(nu.scenes).toEqual([]);
    expect(nu.mots).toEqual(minute);
    expect(nu.format).toEqual(contexte.format);
    expect(nu.dureeMs).toBe(repli.dureeMs);
    expect(nu.habillage).toEqual(repli.habillage);
  });

  it("planNu : le plan est lisible par le schéma et validerPlan n'y ajoute aucune scène (pas de pièce, pas de calque)", () => {
    const nu = planNu(contexte);
    expect(schemaPlanBrut.safeParse(nu).success).toBe(true);
    const sceneSansPiece = nu.scenes.filter((s) => s.piece || s.calques?.length);
    expect(sceneSansPiece).toEqual([]);
  });

  it("planNu : déterministe (même entrée, même sortie)", () => {
    expect(planNu(contexte)).toEqual(planNu(contexte));
  });

  it("planNiveau1 : 0 calque, tout en niveau 1, pièces principales gardées, empreinte rafraîchie seulement si la scène change", () => {
    const riche = planRiche();
    expect(riche.scenes.some((s) => s.calques?.length)).toBe(true);
    const n1 = planNiveau1(riche);
    expect(n1.scenes.map((s) => s.id)).toEqual(riche.scenes.map((s) => s.id));
    expect(n1.scenes.every((s) => s.niveau === 1 && !s.calques && s.code === undefined)).toBe(true);
    expect(n1.scenes.map((s) => s.piece)).toEqual(riche.scenes.map((s) => s.piece));
    expect(n1.scenes[0]).toBe(riche.scenes[0]); // scène déjà niveau 1 : intacte
    expect(n1.scenes[1].empreinte).not.toBe(riche.scenes[1].empreinte);
    expect(n1.scenes[1].empreinte).toMatch(/^[0-9a-f]{16}$/);
  });

  it("planNiveau1 : l'entrée n'est pas modifiée ; un plan déjà niveau 1 est rendu à l'identique", () => {
    const riche = planRiche();
    const avant = JSON.stringify(riche);
    planNiveau1(riche);
    expect(JSON.stringify(riche)).toBe(avant);
    const n1 = planNiveau1(riche);
    expect(JSON.stringify(planNiveau1(n1))).toBe(JSON.stringify(n1));
  });

  it("garde statique : ni service, ni moteur, ni argent, ni date, ni hasard", () => {
    const src = readFileSync("src/briques/plan-scenes/plan-nu.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/@\/services|@\/moteurs|studio-rendu|fournisseurs|tarif|plafond|argent|Date\b|Math\.random/);
  });
});

/* ---------- Démo facecam ---------- */

function transcripteur(motsParSource: Record<string, MotHorodate[]>): FournisseurFacecam {
  const demandes = new Map<string, DemandeFacecam>();
  return {
    id: "simulation",
    mode: "simulation",
    async soumettre(_r, d) {
      demandes.set(d.idTravail, d);
      return { statut: "en_file" };
    },
    async suivre(_r, id) {
      const d = demandes.get(id)!;
      const mots = motsParSource[d.source] ?? [];
      return { statut: "termine", resultat: { transcriptionCle: `tr/${id}`, dureeSec: (mots.at(-1)?.finSec ?? 0) + 0.5, mots } } as never;
    },
  };
}

/** Faux `genererPlan` : compte ses appels ; renvoie un plan avec un calque (niveau 2). */
function llmPlan() {
  const f = (async (requete: RequeteClaude) => {
    f.appels++;
    const lignes = requete.messages[0].contenu.split("\n").filter((l) => /^\d+\t/.test(l)).map((l) => l.split("\t"));
    const fin = Number(lignes.at(-1)?.[3] ?? 5000);
    const plan = {
      version: "plan-scenes-1",
      scenes: [
        {
          id: "s1", version: 1, mots: { premier: 0, dernier: 0 }, debutMs: 0, finMs: fin, niveau: 2, position: "centre",
          transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 },
          piece: "legende", parametres: { texte: "Devis", sousTexte: "", style: "titre" },
          calques: [{ piece: "carte-kpi", parametres: { libelle: "Devis prêts", valeur: 3, prefixe: "", suffixe: "", decimales: 0, tendance: "hausse", variation: "" }, debutMs: 0, zone: "plein" }],
        },
      ],
    };
    return { texte: JSON.stringify(plan), modeleDemande: requete.modele, modele: requete.modele, replis: [], stopReason: "end_turn", jetons: { entree: 0, sortie: 0 } as never };
  }) as unknown as AppelClaude & { appels: number };
  f.appels = 0;
  return f;
}

let horloge = Date.UTC(2026, 10, 8, 10);
function depsDemo(appelerPlan?: AppelClaude): DependancesDemo {
  const rendu = creerServiceRenduSimule(() => horloge);
  return {
    facecam: transcripteur({ "https://r2.exemple/lire/rush/face.mp4": motsDe(PHRASE) }),
    ...(appelerPlan ? { appelerPlan } : {}),
    rendu,
    urlLecture: async (cle) => `https://r2.exemple/lire/${cle}`,
    urlDepot: async (cle) => `https://r2.exemple/deposer/${cle}`,
  };
}
const commandeDemo = (dosage?: CommandeFabrication["dosageMotion"]) =>
  ({ videoId: "v1", formatId: "demo-facecam", ratios: ["4:5"], briques: { "sous-titres": true }, distribution: [], dureeCibleSec: 60, script: { blocs: [], texteComplet: "" }, entrees: { demoFacecam: { facecam: { cle: "rush/face.mp4" } } }, ...(dosage ? { dosageMotion: dosage } : {}) }) as unknown as CommandeFabrication;
const ctx = { travailId: "t1", versionId: "ver1", titre: "Démo devis", maintenant: horloge };

async function demoJusquAuBout(c: CommandeFabrication, llm?: AppelClaude) {
  const d = depsDemo(llm);
  const moteur = creerMoteurMontageDemoFacecam({ chaine: () => d });
  let t = await moteur.lancer(c, ctx);
  for (let i = 0; i < 200; i++) {
    horloge += 1000;
    const r = await moteur.avancer(t, c, horloge);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, etat: t.parametres?.demo as EtatDemo, resultat: r.resultat };
  }
  throw new Error("pas fini");
}

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("X3-06 · démo facecam", () => {
  it("aucun : plan nu (0 scène), genererPlan NON appelé, vidéo livrée", async () => {
    const llm = llmPlan();
    const { etat, resultat } = await demoJusquAuBout(commandeDemo({ cran: "aucun", choisiPar: "video" }), llm);
    expect(llm.appels).toBe(0);
    expect(etat.plan!.scenes).toEqual([]);
    expect(resultat).toBeDefined();
    expect(etat.mots!.length).toBeGreaterThan(0); // sous-titres : les mots sont gardés
  });

  it("sobre : le plan du LLM est gardé mais sans aucun calque", async () => {
    const llm = llmPlan();
    const { etat } = await demoJusquAuBout(commandeDemo({ cran: "sobre", choisiPar: "video" }), llm);
    expect(llm.appels).toBe(1);
    expect(etat.plan!.scenes.length).toBeGreaterThan(0);
    expect(etat.plan!.scenes.every((s) => !s.calques?.length && s.niveau === 1)).toBe(true);
    expect(etat.mots!.length).toBeGreaterThan(0);
  });

  it("éteint = identique : sans cran, équilibré et dynamique rendent le même plan (avec calques d'avant)", async () => {
    const sans = await demoJusquAuBout(commandeDemo(), llmPlan());
    const equilibre = await demoJusquAuBout(commandeDemo({ cran: "equilibre", choisiPar: "code" }), llmPlan());
    const dynamique = await demoJusquAuBout(commandeDemo({ cran: "dynamique", choisiPar: "code" }), llmPlan());
    expect(sans.etat.plan!.scenes.some((s) => s.calques?.length)).toBe(true);
    expect(JSON.stringify(equilibre.etat.plan)).toBe(JSON.stringify(sans.etat.plan));
    expect(JSON.stringify(dynamique.etat.plan)).toBe(JSON.stringify(sans.etat.plan));
    expect(JSON.stringify(equilibre.etat)).toBe(JSON.stringify(sans.etat));
  });
});

/* ---------- Tutoriel d'outil ---------- */

const T0 = Date.UTC(2026, 10, 8, 9);
async function tutoJusquAuBout(c: CommandeFabrication) {
  const j: Journal = { voix: [], claude: [], rendus: [] };
  const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
  let t: Travail = await moteur.lancer(c, { travailId: "t-nu", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  let resultat;
  for (let i = 0; i < 400; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut)) break;
  }
  const plan = (resultat!.projetMontage.tutoriel as { plan: { plan: PlanValide; source: string } }).plan;
  return { j, travail: t, resultat, plan, appelsPlan: j.claude.filter((r) => r.json).length };
}

describe("X3-06 · tutoriel d'outil", () => {
  it("aucun : plan nu (0 scène), AUCUN appel Claude pour le plan, vidéo livrée avec sous-titres", async () => {
    const r = await tutoJusquAuBout(commandeTutoriel({ dosageMotion: { cran: "aucun", choisiPar: "video" } }));
    expect(r.travail.statut).toBe("termine");
    expect(r.appelsPlan).toBe(0);
    expect(r.plan.plan.scenes).toEqual([]);
    const propr = r.j.rendus.find((d) => d.operation === "composition")!.parametres.proprietes as { sousTitres?: unknown };
    expect(propr.sousTitres).toBeDefined();
  });

  it("sobre : 1 appel pour le plan, 0 calque, tout en niveau 1", async () => {
    const r = await tutoJusquAuBout(commandeTutoriel({ dosageMotion: { cran: "sobre", choisiPar: "video" } }));
    expect(r.travail.statut).toBe("termine");
    expect(r.appelsPlan).toBe(1);
    expect(r.plan.plan.scenes.length).toBeGreaterThan(0);
    expect(r.plan.plan.scenes.every((s) => !s.calques?.length && s.niveau === 1)).toBe(true);
  });

  it("éteint = identique : sans cran, équilibré et dynamique gardent les calques et donnent le même plan", async () => {
    const sans = await tutoJusquAuBout(commandeTutoriel());
    const equilibre = await tutoJusquAuBout(commandeTutoriel({ dosageMotion: { cran: "equilibre", choisiPar: "code" } }));
    const dynamique = await tutoJusquAuBout(commandeTutoriel({ dosageMotion: { cran: "dynamique", choisiPar: "code" } }));
    expect(sans.plan.plan.scenes.some((s) => s.calques?.length)).toBe(true);
    expect(JSON.stringify(equilibre.plan)).toBe(JSON.stringify(sans.plan));
    expect(JSON.stringify(dynamique.plan)).toBe(JSON.stringify(sans.plan));
  });
});
