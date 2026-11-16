import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationRetouche } from "@/briques/operations";
import { comprendreDemande } from "@/services/retouche-chat/comprendre";
import { creerAppelEssai } from "@/services/retouche-chat/essai-a-blanc";
import { CLE_REGLAGE_LECTURE_REGLES, lireParRegles } from "@/services/retouche-chat/lecture-regles";
import { lireOperations } from "@/services/retouche-chat/schema";

const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: PLAN_DEMO.facecam, dureeMs: PLAN_DEMO.dureeMs }).plan;

const CAS: [string, OperationRetouche[]][] = [
  ["remplace assistant par robot à l'écran", [{ type: "changer-mot", sceneId: "s2", ancien: "assistant", nouveau: "robot" }]],
  ["Corrige « remplit » en « complète »", [{ type: "changer-mot", sceneId: "s2", ancien: "remplit", nouveau: "complète" }]],
  ["enlève la pièce de la scène 2", [{ type: "retirer-piece", sceneId: "s2", piece: "curseur" }]],
  ["retire la carte de 0:12", [{ type: "retirer-piece", sceneId: "s3", piece: "carte-kpi" }]],
  ["zoom sur la scène 2", [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.5 }]],
  ["zoom plus doux", [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.15 }]],
  ["Fond noir", [{ type: "changer-habillage", habillage: { fond: "noir" } }]],
  ["mets un fond clair", [{ type: "changer-habillage", habillage: { fond: "ivoire" } }]],
  ["plus dynamique", [{ type: "ajouter-dynamisme", intensite: "leger" }]],
  ["beaucoup plus dynamique", [{ type: "ajouter-dynamisme", intensite: "fort" }]],
  ["transition fondu scène 3", [{ type: "changer-transition", sceneId: "s3", entree: "fondu", sortie: "fondu" }]],
  ["mets une transition zoom doux sur la scène 1", [{ type: "changer-transition", sceneId: "s1", entree: "zoom-doux", sortie: "zoom-doux" }]],
];
const SANS_SENS = ["", "coupe le bruitage", "bonjour", "zoom sur la scène 9", "transition scène 2", "remplace truc inexistant par machin", "modifie le script : remplace assistant par robot"];

describe("lireParRegles", () => {
  it("clé du réglage", () => expect(CLE_REGLAGE_LECTURE_REGLES).toBe("retoucheChat.lectureRegles"));
  it.each(CAS)("« %s » → opération attendue, valide au schéma", (phrase, attendu) => {
    const ops = lireParRegles(phrase, plan);
    expect(ops).toEqual(attendu);
    expect(lireOperations(ops)).toEqual({ operations: attendu, remarques: [] });
  });
  it("phrase non comprise → []", () => {
    for (const p of SANS_SENS.filter((x) => !x.startsWith("modifie"))) expect(lireParRegles(p, plan)).toEqual([]);
  });
  it("jamais modifier-script", () => {
    for (const p of [...CAS.map((c) => c[0]), ...SANS_SENS]) expect(lireParRegles(p, plan).some((o) => o.type === "modifier-script")).toBe(false);
  });
});

describe("comprendreDemande : panne de l'IA", () => {
  const panne = () => creerAppelEssai([new Error("panne")]);
  it("sans option : comme aujourd'hui (égal à l'appel témoin)", async () => {
    const a = panne();
    const b = panne();
    expect(await comprendreDemande({ phrase: "remplace assistant par robot", plan }, a.appeler)).toEqual(await comprendreDemande({ phrase: "remplace assistant par robot", plan }, b.appeler, {}));
  });
  it("avec lectureRegles: true → règles, source simple, un seul appel", async () => {
    const a = panne();
    const r = await comprendreDemande({ phrase: "fond noir", plan }, a.appeler, { lectureRegles: true });
    expect(r.operations).toEqual([{ type: "changer-habillage", habillage: { fond: "noir" } }]);
    expect(r.source).toBe("simple");
    expect(r.remarques).toContain("Lecture de votre demande sans IA.");
    expect(a.appels.length).toBe(1);
  });
  it("lectureRegles autre que true : éteint", async () => {
    const a = panne();
    const r = await comprendreDemande({ phrase: "fond noir", plan }, a.appeler, { lectureRegles: undefined });
    expect(r.operations).toEqual([]);
  });
});

describe("éteint = identique à master", () => {
  const VALEURS: [string, OperationRetouche[], string][] = [
    ["plus dynamique", [{ type: "ajouter-dynamisme", intensite: "leger" }], "Lecture simple de votre demande (l'IA n'a pas répondu)."],
    ["beaucoup plus de punch", [{ type: "ajouter-dynamisme", intensite: "fort" }], "Lecture simple de votre demande (l'IA n'a pas répondu)."],
    ["du motion design", [{ type: "ajouter-dynamisme", intensite: "leger" }], "Lecture simple de votre demande (l'IA n'a pas répondu)."],
    ["fond noir", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["remplace assistant par robot", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["enlève la pièce de la scène 2", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["zoom sur la scène 2", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["transition fondu scène 3", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["coupe le bruitage", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
    ["bonjour", [], "Je n'ai pas pu lire votre demande : reformulez-la ou précisez la scène."],
  ];
  it.each(VALEURS)("« %s »", async (phrase, operations, remarque) => {
    const r = await comprendreDemande({ phrase, plan }, creerAppelEssai([new Error("panne")]).appeler);
    expect(r).toEqual({ operations, remarques: [remarque], source: "simple" });
  });
});
