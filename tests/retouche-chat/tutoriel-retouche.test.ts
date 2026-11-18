import { describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import {
  CLES_REGLAGE_RETOUCHE,
  GENERATEURS_VOIX_PRISE_FILMEE,
  adaptateurRetouche,
  estGenerateurRetouche,
  filtrerOperationsGenerateur,
  retoucheChatActif,
} from "@/services/retouche-chat/generateurs";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;

const etat = vi.hoisted(() => ({ versions: new Map<string, Record<string, unknown>>(), videos: new Map<string, Record<string, unknown>>(), adapter: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/services/_commun", () => ({
  horodatage: () => ({ creeLe: "2026-11-18T00:00:00.000Z", modifieLe: "2026-11-18T00:00:00.000Z" }),
  lireParametre: async (_c: string, defaut: unknown) => defaut,
  depots: () => ({
    videos: { obtenir: async (id: string) => etat.videos.get(id) ?? null },
    versions: { obtenir: async (id: string) => etat.versions.get(id) ?? null, enregistrer: async (v: Record<string, unknown>) => void etat.versions.set(v.id as string, v) },
    plans: { lister: async () => [] },
    travaux: { lister: async () => [] },
  }),
}));
vi.mock("@/services/videos", () => ({ choisirVersion: async () => undefined }));
vi.mock("@/services/fabrication", () => ({ prochainNumero: async () => 2 }));
vi.mock("@/briques/plan-scenes-generateurs/adaptateur", () => ({ adapterPlan: etat.adapter }));

import { portsGenerateurStudio } from "@/services/retouche-chat/generateurs-studio";
import { appliquerRetouche } from "@/services/retouche-chat/service";

const ID = "tutoriel-outil";
const PAS_VOTRE = "Ce texte n'est pas le vôtre : écrivez-le dans votre message, mot pour mot.";

describe("tutoriel : inscription éteinte", () => {
  it("inscrit, clé propre, hors liste des prises filmées", () => {
    expect(estGenerateurRetouche(ID)).toBe(true);
    expect(CLES_REGLAGE_RETOUCHE[ID]).toBe("retoucheChat.tutorielOutil");
    expect([...GENERATEURS_VOIX_PRISE_FILMEE]).not.toContain(ID);
    expect(adaptateurRetouche(ID).operations).not.toContain("modifier-script");
    expect(adaptateurRetouche(ID).consigne).toContain("le script validé se change sur l'écran de validation");
  });

  it("éteint par défaut : seul `true` exact allume", async () => {
    expect(await retoucheChatActif(ID, async (_c, defaut) => defaut)).toBe(false);
    expect(await retoucheChatActif(ID, async () => "true")).toBe(false);
    expect(await retoucheChatActif(ID, async () => 1)).toBe(false);
    expect(await retoucheChatActif(ID, async () => { throw new Error("panne"); })).toBe(false);
    expect(await retoucheChatActif(ID, async () => true)).toBe(true);
  });
});

describe("tutoriel : le texte est celui de Williams", () => {
  const script = { type: "modifier-script", ancien: "a", nouveau: "b" };
  const zoom = { type: "ajuster-zoom", sceneId: "s2", facteur: 1.2 };

  it("modifier-script toujours écarté, même sur « modifie le script »", () => {
    for (const d of ["zoom plus doux", "modifie le script : a devient b"]) {
      const r = filtrerOperationsGenerateur(ID, [script, zoom] as never[], d);
      expect(r.operations.map((o) => o.type)).toEqual(["ajuster-zoom"]);
      expect(r.remarques).toEqual(["Le texte lu est celui que vous avez validé : pour le changer, repassez par l'écran de validation."]);
    }
  });

  it("changer-mot gardé seulement si le mot nouveau est dans la demande (sans casse, espaces doubles admis)", () => {
    const op = { type: "changer-mot", sceneId: "s1", ancien: "x", nouveau: "Stocks  du jour" };
    const ok = filtrerOperationsGenerateur(ID, [op] as never[], "remplace x par stocks du   JOUR");
    expect(ok.operations).toHaveLength(1);
    expect(ok.remarques).toEqual([]);
    const ko = filtrerOperationsGenerateur(ID, [op] as never[], "change le titre de la première scène");
    expect(ko.operations).toEqual([]);
    expect(ko.remarques).toEqual([PAS_VOTRE]);
  });

  it("ajouter-chiffre : valeur ET libellé dans la demande", () => {
    const op = { type: "ajouter-chiffre", sceneId: "s1", valeur: 42, libelle: "commandes" };
    expect(filtrerOperationsGenerateur(ID, [op] as never[], "ajoute 42 commandes").operations).toHaveLength(1);
    expect(filtrerOperationsGenerateur(ID, [op] as never[], "ajoute 42").operations).toEqual([]);
    expect(filtrerOperationsGenerateur(ID, [op] as never[], "ajoute commandes").remarques).toEqual([PAS_VOTRE]);
  });

  it("frontières de nombres et de mots : « 4 » n'est pas dans « 42 », « stock » pas dans « stocks »", () => {
    const quatre = { type: "ajouter-chiffre", sceneId: "s1", valeur: 4, libelle: "commandes" };
    const r1 = filtrerOperationsGenerateur(ID, [quatre] as never[], "ajoute 42 commandes");
    expect(r1.operations).toEqual([]);
    expect(r1.remarques).toEqual([PAS_VOTRE]);
    expect(filtrerOperationsGenerateur(ID, [quatre] as never[], "ajoute 4 commandes.").operations).toHaveLength(1);
    const stock = { type: "changer-mot", sceneId: "s1", ancien: "x", nouveau: "stock" };
    const r2 = filtrerOperationsGenerateur(ID, [stock] as never[], "remplace x par stocks");
    expect(r2.operations).toEqual([]);
    expect(r2.remarques).toEqual([PAS_VOTRE]);
    expect(filtrerOperationsGenerateur(ID, [stock] as never[], "remplace x par « stock » svp").operations).toHaveLength(1);
    const special = { type: "changer-mot", sceneId: "s1", ancien: "x", nouveau: "(a+b)" };
    expect(filtrerOperationsGenerateur(ID, [special] as never[], "mets (a+b) ici").operations).toHaveLength(1);
  });

  it("texte glissé par les parametres : un test par type d'opération", () => {
    const glisse = "Gagnez 3 heures par jour";
    const ops = [
      { type: "ajouter-piece", sceneId: "s1", piece: "legende", parametres: { texte: glisse } },
      { type: "remplacer-piece", sceneId: "s1", ancienne: "titre", nouvelle: "legende", parametres: { titre: glisse } },
      { type: "changer-brique", sceneId: "s1", piece: "legende", parametres: { options: { lignes: [{ libelle: glisse }] } } },
    ];
    for (const op of ops) {
      const ko = filtrerOperationsGenerateur(ID, [op] as never[], "ajoute une légende en bas");
      expect(ko.operations).toEqual([]);
      expect(ko.remarques).toEqual([PAS_VOTRE]);
      const ok = filtrerOperationsGenerateur(ID, [op] as never[], `mets la légende « ${glisse} »`);
      expect(ok.operations).toHaveLength(1);
      expect(ok.remarques).toEqual([]);
    }
    const sansTexte = { type: "ajouter-piece", sceneId: "s1", piece: "legende", parametres: { position: "bas" }, zone: "bas" };
    expect(filtrerOperationsGenerateur(ID, [sansTexte] as never[], "ajoute une légende").operations).toHaveLength(1);
  });

  it("clé de texte hors liste (intitule) → écartée ; clé technique → gardée", () => {
    const f = (parametres: Record<string, unknown>, demande: string) =>
      filtrerOperationsGenerateur(ID, [{ type: "ajouter-piece", sceneId: "s1", piece: "legende", parametres }] as never[], demande);
    const ko = f({ intitule: "Gagnez 3 heures" }, "ajoute une légende");
    expect(ko.operations).toEqual([]);
    expect(ko.remarques).toEqual([PAS_VOTRE]);
    expect(f({ sousTitreCourt: "Gagnez 3 heures" }, "ajoute une légende").operations).toEqual([]);
    expect(f({ contenuHtml: "<b>Gagnez</b>" }, "ajoute une légende").operations).toEqual([]);
    expect(f({ intitule: "Gagnez 3 heures" }, "mets Gagnez 3 heures").operations).toHaveLength(1);
    expect(f({ variante: "grande", couleur: "rouge", position: "bas", icone: "etoile" }, "ajoute une légende").operations).toHaveLength(1);
  });

  it("ajouter-chiffre : prefixe et suffixe doivent être écrits par Williams", () => {
    const base = { type: "ajouter-chiffre", sceneId: "s1", valeur: 42, libelle: "commandes" };
    const suff = { ...base, suffixe: " commandes gagnées chaque jour grâce à l'IA" };
    const r = filtrerOperationsGenerateur(ID, [suff] as never[], "ajoute 42 commandes");
    expect(r.operations).toEqual([]);
    expect(r.remarques).toEqual([PAS_VOTRE]);
    expect(filtrerOperationsGenerateur(ID, [{ ...base, prefixe: "Jusqu'à" }] as never[], "ajoute 42 commandes").operations).toEqual([]);
    expect(filtrerOperationsGenerateur(ID, [{ ...base, suffixe: "%" }] as never[], "ajoute 42 commandes").operations).toEqual([]);
    expect(filtrerOperationsGenerateur(ID, [{ ...base, suffixe: "%" }] as never[], "ajoute 42 commandes avec %").operations).toHaveLength(1);
    expect(filtrerOperationsGenerateur(ID, [{ ...base, prefixe: "Jusqu'à" }] as never[], "ajoute Jusqu'à 42 commandes").operations).toHaveLength(1);
    expect(filtrerOperationsGenerateur(ID, [{ ...base, suffixe: "" }] as never[], "ajoute 42 commandes").operations).toHaveLength(1);
  });

  it("avocat et image-video : comportement inchangé", () => {
    const mot = { type: "changer-mot", sceneId: "s1", ancien: "x", nouveau: "inventé" };
    for (const g of ["avocat", "image-video"] as const) {
      const r = filtrerOperationsGenerateur(g, [script, mot, zoom] as never[], "modifie le script : a devient b");
      expect(r.operations.map((o) => o.type)).toEqual(["modifier-script", "changer-mot", "ajuster-zoom"]);
      expect(r.remarques).toEqual([]);
      const sans = filtrerOperationsGenerateur(g, [script] as never[], "zoom");
      expect(sans.remarques).toEqual(["Le texte lu reste le vôtre : pour le changer, demandez « modifie le script »."]);
    }
  });
});

describe("tutoriel : plan lu dans le projet, jamais dressé", () => {
  it("lireVersionChoisie rend le plan du tutoriel, adapterPlan jamais appelé, issue « plan-pret », aucune version", async () => {
    etat.videos.set("vid", { id: "vid", versionChoisieId: "v1" });
    etat.versions.set("v1", { id: "v1", videoId: "vid", numero: 1, commande: {}, projetMontage: { tutoriel: { plan: { plan } } } });
    const ports = portsGenerateurStudio(ID);
    const choisie = await ports.lireVersionChoisie("vid");
    expect(choisie?.versionId).toBe("v1");
    expect(choisie?.plan.scenes).toHaveLength(plan.scenes.length);
    const r = await appliquerRetouche("vid", { demande: "zoom plus doux", operations: [{ type: "ajuster-zoom", sceneId: plan.scenes[1]!.id, facteur: 1.1 }] }, ports);
    expect(r.statut).toBe("plan-pret");
    expect(etat.versions.size).toBe(1);
    expect(etat.adapter).not.toHaveBeenCalled();
  });

  it("version sans plan de tutoriel : null, toujours pas de plan de repli", async () => {
    etat.versions.set("v1", { id: "v1", videoId: "vid", numero: 1, commande: {}, projetMontage: {} });
    expect(await portsGenerateurStudio(ID).lireVersionChoisie("vid")).toBeNull();
    expect(etat.adapter).not.toHaveBeenCalled();
  });
});
