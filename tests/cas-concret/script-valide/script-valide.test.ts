/**
 * V4-3 · SCRIPT VALIDÉ PAR CAS. Le cas « recrutement-apporteurs » porte le script de la v4 (validé par Will) : même
 * texte (`voix4.json`, mot pour mot), même ordre (`v4.html`). Quand un script validé existe, la fabrication ne fait AUCUN
 * appel d'écriture : elle le passe par les mêmes contrôles (schéma, R02 à R23), puis la chaîne habituelle ; la fin vient
 * toujours de la banque des fins, par réseau. Un script validé refusé par les contrôles arrête la fabrication avec une
 * phrase claire : il n'est jamais réparé en silence.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import type { ReseauCas } from "@/formats/cas-concret";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { regrouperFins } from "@/moteurs/montage-cas-concret/etapes";
import { ErreurFabricationCasConcret, fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins } from "@/moteurs/montage-cas-concret/fins";
import { TOURNURES_APPEL, validerFicheEcrans } from "@/moteurs/montage-cas-concret/regles";
import { ficheDuScriptValide, PHRASE_SCRIPT_VALIDE_REFUSE, scriptValideDuCatalogue, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { doubles, type Doubles } from "../fabriquer/doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const cas = trouverCas("recrutement-apporteurs")!;
const script = scriptValideDuCatalogue("recrutement-apporteurs")!;
const voix4 = JSON.parse(readFileSync(join(process.cwd(), "docs/formats/v4-reference/voix4.json"), "utf8")) as { texte: string };
/** La fin de la v4 : elle n'appartient pas au script validé (elle vient de la banque des fins, par réseau). */
const FIN_V4 = "Écrivez PLAN en commentaire. On vous envoie le plan de cette machine.";

async function echec(d: Doubles): Promise<ErreurFabricationCasConcret> {
  const err = await fabriquerCasConcret(d.options).then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(ErreurFabricationCasConcret);
  return err as ErreurFabricationCasConcret;
}

describe("V4-3 · le script validé de « recrutement-apporteurs » est celui de la v4", () => {
  it("existe pour ce cas seulement, à la version du cas", () => {
    expect(script.casId).toBe(cas.id);
    expect(script.versionCas).toBe(cas.version);
    expect(["rappels-rendez-vous", "email-difficile", "compte-rendu-dicte", "audit-une-journee", "contact-vers-crm", "devis-signe-alerte"].map(scriptValideDuCatalogue)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it("le texte dit est celui de voix4.json, mot pour mot, sans la fin, SAUF l'accroche (écart voulu du 18/10)", () => {
    expect(voix4.texte.endsWith(FIN_V4)).toBe(true);
    // Écart voulu : Will a validé le 18/10 (v-9b52c1ffadca) « Nos collaborateurs, on les recrute en… » à la place de
    // « On recrute nos collaborateurs en… » de la v4, pour éviter le « euh » après « recrute » ; R03 : « recrute » reste.
    const ACCROCHE_V4 = "On recrute nos collaborateurs en";
    const ACCROCHE_VALIDEE = "Nos collaborateurs, on les recrute en";
    const corpsV4 = voix4.texte.slice(0, -FIN_V4.length).trim();
    expect(corpsV4.startsWith(ACCROCHE_V4)).toBe(true);
    expect(script.ecrans[0].texteDit).toBe(ACCROCHE_VALIDEE);
    expect(script.valideLe).toBe("2026-10-18");
    expect(texteDuCorps({ ecrans: script.ecrans } as never)).toBe(ACCROCHE_VALIDEE + corpsV4.slice(ACCROCHE_V4.length));
  });

  it("l'accroche validée le 18/10 : lignes affichées et événements recalés sur les mots (surMot = rang du mot dit)", () => {
    const accroche = script.ecrans[0];
    if (accroche.type !== "accroche") throw new Error("pas une accroche");
    expect(accroche.lignes).toEqual(["Nos collaborateurs,", "on les recrute", "*en…*"]);
    expect(accroche.motOrange).toBe("en…");
    expect(accroche.etiquette).toBe("Recrutement · cas réel");
    const mots = accroche.texteDit.split(" ");
    expect(accroche.evenements).toEqual([{ cible: "titre-2", surMot: 2, avanceMs: 0 }, { cible: "titre-3", surMot: 5, avanceMs: 0 }]);
    expect(mots[2]).toBe("on");
    expect(mots[5]).toBe("en");
    // R03 : le mot exact de la promesse reste dans l'accroche.
    expect(accroche.texteDit).toContain("recrute");
  });

  it("l'ordre des plans de v4.html : accroche → 15 minutes → avant → bascule → étapes, la visio AVANT le contrat → résultat → question", () => {
    expect(script.ecrans.map((e) => e.type)).toEqual(["accroche", "chiffre", "liste-avant", "titre", "etape", "etape", "etape", "etape", "objet", "etape", "titre", "etape", "objet", "resultat", "question"]);
    const dits = script.ecrans.map((e) => e.texteDit);
    const visio = dits.findIndex((t) => t.startsWith("Nous, on arrive pour la visio"));
    const contrat = dits.findIndex((t) => t.startsWith("Derrière, le contrat part tout seul"));
    expect(visio).toBeGreaterThan(0);
    expect(contrat).toBeGreaterThan(visio);
  });

  it("la liste « avant » montre les 6 tâches sur un seul écran, comme le plan s4", () => {
    const liste = script.ecrans.find((e) => e.type === "liste-avant");
    expect(liste?.type === "liste-avant" && liste.taches).toEqual(["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous", "Envoyer le contrat", "Courir après la signature"]);
  });

  it("finit sur la question au public : aucune fin, aucun appel dans le script", () => {
    expect(script.ecrans[script.ecrans.length - 1].type).toBe("question");
    const tout = script.ecrans.map((e) => JSON.stringify(e)).join(" ").toLowerCase();
    for (const t of [...TOURNURES_APPEL, "écrivez", "plan de cette"]) expect(tout).not.toContain(t);
  });

  const COMBINAISONS: { reseaux: ReseauCas[]; avecMot: boolean; motSur: ReseauCas[] }[] = [
    { reseaux: ["facebook", "instagram", "tiktok", "linkedin"], avecMot: false, motSur: [] },
    { reseaux: ["facebook", "instagram", "tiktok", "linkedin"], avecMot: true, motSur: ["facebook", "instagram", "tiktok", "linkedin"] },
    { reseaux: ["linkedin"], avecMot: false, motSur: [] },
    { reseaux: ["instagram"], avecMot: true, motSur: ["instagram"] },
  ];
  for (const c of COMBINAISONS) {
    it(`passe les mêmes contrôles (schéma, R02 à R23), fins de ${c.reseaux.join(", ")}${c.avecMot ? " au mot" : ""} comprises`, () => {
      const plan = regrouperFins(planDesFins({ reseaux: c.reseaux, offre: cas.offre, nature: cas.nature, mot: cas.mot, motDit: cas.motDit, avecMot: c.avecMot, motSur: c.motSur, table: TABLE_FINS_DIAGNOSTIC }));
      const fiche = ficheDuScriptValide(script, FIXE, cas);
      const v = validerFicheEcrans(fiche, { cas, texteScript: texteDuCorps(fiche), motsInterdits: [], fins: plan.fins });
      expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    });
  }
});

describe("V4-3 · fabrication avec un script validé", () => {
  it("aucun appel d'écriture ; la voix lit le script ; la fin vient de la banque, réseau par réseau", async () => {
    const d = doubles();
    d.options.scriptValide = script;
    const cr = await fabriquerCasConcret(d.options);
    expect(d.appelsEcriture()).toBe(0);
    expect(d.roles).toEqual([]);
    expect(cr.ecriture).toEqual({ appels: 0, simule: false, scriptValide: true });
    expect(texteDuCorps(cr.fiche)).toBe(texteDuCorps({ ecrans: script.ecrans } as never));
    expect(d.lus[0]).toContain("Nous, on arrive pour la visio. Quinze minutes. C'est notre seul travail. Derrière, le contrat part tout seul.");
    // Une fin par groupe de réseaux, tirée de la banque ; jamais la fin écrite de la v4.
    expect(cr.fins.map((f) => f.reseaux)).toEqual([["facebook"], ["instagram", "tiktok"], ["linkedin"]]);
    for (const f of cr.plan.fins) {
      expect(f.appels.length).toBeGreaterThan(0);
      expect(f.ecrans.map((e) => e.texteDit).join(" ")).not.toContain("Écrivez PLAN");
    }
  });

  it("deux fabrications du même cas : même texte, même ordre, mêmes écrans", async () => {
    const a = doubles();
    a.options.scriptValide = script;
    const b = doubles();
    b.options.scriptValide = script;
    b.options.videoId = "video-cc-2";
    const [x, y] = [await fabriquerCasConcret(a.options), await fabriquerCasConcret(b.options)];
    expect(x.fiche.ecrans.map((e) => [e.type, e.texteDit])).toEqual(y.fiche.ecrans.map((e) => [e.type, e.texteDit]));
  });

  it("un script validé refusé par les contrôles arrête la fabrication avant toute voix, avec une phrase claire, sans réparation", async () => {
    const abime: ScriptValide = structuredClone(script);
    const resultat = abime.ecrans.findIndex((e) => e.type === "resultat");
    abime.ecrans[resultat] = { ...abime.ecrans[resultat], texteDit: "Résultat : dix heures gagnées, à chaque recrutement. Et" };
    const d = doubles();
    d.options.scriptValide = abime;
    const err = await echec(d);
    expect(err.etape).toBe("fiche");
    expect(err.raisons[0]).toBe(PHRASE_SCRIPT_VALIDE_REFUSE);
    expect(err.raisons.slice(1).join(" ")).toContain("nombres des faits");
    expect(d.lus).toEqual([]);
    expect(d.appelsEcriture()).toBe(0);
  });

  it("un script validé pour une autre version du cas est refusé (à faire revalider)", async () => {
    const d = doubles();
    d.options.scriptValide = { ...script, versionCas: cas.version + 1 };
    const err = await echec(d);
    expect(err.etape).toBe("fiche");
    expect(err.raisons.join(" ")).toContain("version");
    expect(d.lus).toEqual([]);
  });

  it("un script validé d'un autre cas est refusé", async () => {
    const d = doubles({ casId: "rappels-rendez-vous" });
    d.options.scriptValide = script;
    const err = await echec(d);
    expect(err.etape).toBe("fiche");
    expect(err.raisons.join(" ")).toContain("recrutement-apporteurs");
  });
});
