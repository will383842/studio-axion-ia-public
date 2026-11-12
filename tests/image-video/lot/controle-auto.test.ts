/**
 * LOT D'IMAGES · L2 — porte « carte » automatique (plan § d.1). En lot (`demande.lot`), aucune porte n'attend Will : la
 * carte est validée par le contrôle automatique, ou la vidéo est MISE DE CÔTÉ sans payer la suite. Sans `demande.lot`,
 * rien ne change. Aucun réseau : outils simulés.
 */
import { describe, expect, it } from "vitest";
import { controlerCarte, type CarteImage } from "@/domaine/image-video/carte";
import { avancerJusquAArretIV, controleAutomatiqueScriptIV, doutesDeLaCarte, etatInitialIV, miseDeCoteCarteIV, miseDeCoteScriptIV, validerCarteIV, validerScriptIV, type EtatFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { lectureDeCarte } from "@/moteurs/montage-image-video/lecture/simulation";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../doubles-fabrication";

const LOT = { id: "lot-iv-0123456789ab", rang: 1 };

async function fabriquer(carte: CarteImage, enLot: boolean, o: Parameters<typeof outilsSimules>[2] = {}) {
  const m = monde();
  const demande = demandeEssai(carte, enLot ? { lot: LOT } : {});
  const e = await avancerJusquAArretIV(etatInitialIV(demande), outilsSimules(carte, m, { cartesValidees: 0, ...o }));
  return { e, m };
}
const reservationsPayees = (e: EtatFabricationIV) => [...new Set(e.caisse.reservations.map((r) => r.etape))];

function evaluer(carte: CarteImage) {
  const controle = controlerCarte(carte);
  return miseDeCoteCarteIV(carte, controle, doutesDeLaCarte(carte, controle));
}

describe("critères de la porte carte (PUR)", () => {
  it("carte propre : aucune mise de côté", () => {
    expect(evaluer(carteFixe("E"))).toBeNull();
    expect(evaluer(carteFixe("B"))).toBeNull();
  });
  it("C1 : erreur bloquante de la carte", () => {
    const c = carteFixe("E");
    c.noeuds.push({ ...c.noeuds[0], id: "orphelin", libelle: "Orphelin", ordre: 99 });
    const r = evaluer(c);
    expect(r?.motif).toBe("Ce que j'ai compris de l'image a un défaut.");
    expect(r?.phrases.some((p) => p.includes("orphelin"))).toBe(true);
  });
  it("C2 : écarts entre les deux lectures", () => {
    const c = carteFixe("E");
    c.lecture.ecarts = [{ champ: "titre", lectureA: "a", lectureB: "b" }];
    expect(evaluer(c)?.motif).toBe("Les deux lectures de l'image ne disent pas la même chose.");
  });
  it("C3 : alerte du contrôle (photo de personnes)", () => {
    const c = carteFixe("E");
    c.noeuds[0].photoPersonnes = true;
    const r = evaluer(c);
    expect(r?.motif).toBe("Un point de l'image est incertain.");
    expect(r?.phrases.join(" ")).toContain("photo de personnes");
  });
  it("C4 : chiffre lu une seule fois, le chiffre est cité", () => {
    const c = carteFixe("E");
    c.chiffres[0].lu = "une-seule";
    const r = evaluer(c);
    expect(r?.motif).toContain("Un chiffre n'a été lu qu'une fois");
    expect(r?.motif).toContain(c.chiffres[0].brut);
  });
  it("C5 : formule trop affirmative non tranchée, citée", () => {
    const c = carteFixe("C");
    const r = evaluer(c);
    expect(r?.motif).toContain("Une formule trop affirmative est à trancher");
    expect(r?.motif).toContain("0 demande perdue");
  });
});

describe("machine : la carte en lot", () => {
  it("carte propre → validée automatiquement (par: reglage), l'écriture suit, sans décision de Will", async () => {
    const carte = carteFixe("E");
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 1500 })), outilsSimules(carte, monde(), { cartesValidees: 0 }), { pasMax: 1 });
    expect(e.etape).toBe("ecriture");
    expect(e.carte?.par).toBe("reglage");
    expect(e.carte?.carte.validation?.par).toBe("reglage");
    expect(e.miseDeCote).toBeUndefined();
    expect(e.journal.join(" ")).toContain("validée par le contrôle automatique du lot");
  });
  it("carte à problème → carte-a-valider + miseDeCote porte carte, rien de payé après la lecture", async () => {
    const carte = carteFixe("E");
    const b = lectureDeCarte(carte);
    b.titre = `${b.titre} (autre)`;
    const { e } = await fabriquer(carte, true, { lectures: { b } });
    expect(e.etape).toBe("carte-a-valider");
    expect(e.miseDeCote).toMatchObject({ porte: "carte", motif: "Les deux lectures de l'image ne disent pas la même chose." });
    expect(e.miseDeCote?.phrases.length).toBeGreaterThan(0);
    expect(e.carte).toBeUndefined();
    expect(reservationsPayees(e).every((x) => x === "lecture")).toBe(true);
  });
  it("C7 : type inconnu → plus de refus (R1) : le code déduit le type, la vidéo continue", async () => {
    const { e } = await fabriquer(carteFixe("E"), true, { lectures: { a: { ...lectureDeCarte(carteFixe("E")), type: "inconnu" }, b: { ...lectureDeCarte(carteFixe("E")), type: "inconnu" } } });
    expect(e.refus).toBeUndefined();
    expect(e.etape).not.toBe("refusee");
    // Le type est celui du code (carte E), l'adaptation est écrite, et la vidéo continue en lot (carte validée ou mise de côté à la porte, pas un arrêt).
    const proposee = e.propositionCarte?.carte ?? e.carte?.carte;
    expect(proposee?.types).toEqual(carteFixe("E").types);
    expect(proposee?.adaptations?.some((x) => /^Adapté automatiquement : type déduit/.test(x))).toBe(true);
    expect(["carte-a-valider", "ecriture", "script-a-valider"]).toContain(e.etape);
  });
  it("sans lot : comportement actuel exact (la carte attend Will, aucune mise de côté)", async () => {
    const { e } = await fabriquer(carteFixe("E"), false);
    expect(e.etape).toBe("carte-a-valider");
    expect(e.miseDeCote).toBeUndefined();
    expect(e.carte).toBeUndefined();
  });
  it("la validation de Will efface la mise de côté et l'écriture reprend", async () => {
    const carte = carteFixe("E");
    const b = lectureDeCarte(carte);
    b.titre = `${b.titre} (autre)`;
    const { e } = await fabriquer(carte, true, { lectures: { b } });
    expect(e.miseDeCote).toBeDefined();
    const apres = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-17T10:00:00.000Z" });
    expect(apres.miseDeCote).toBeUndefined();
    expect(apres.etape).toBe("ecriture");
    expect(apres.carte?.par).toBe("will");
  });
});

/* ------------------------------------------------------------------ */
/* L3 — porte « script » (plan § d.2)                                    */
/* ------------------------------------------------------------------ */

/** Le script de la carte propre E, tel que l'écriture simulée le propose, hors lot (la machine s'arrête à la porte). */
async function scriptPropose(plafondCentimes = 1500) {
  const carte = carteFixe("E");
  const m = monde();
  const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes })), outilsSimules(carte, m, { cartesValidees: 99 }));
  expect(e.etape).toBe("script-a-valider");
  return { e, m, carte };
}

describe("critères de la porte script (PUR)", () => {
  it("script propre, prix dans le plafond : aucune mise de côté", async () => {
    const { e } = await scriptPropose();
    expect(e.propositionScript!.formules).toHaveLength(0);
    expect(miseDeCoteScriptIV(e.propositionScript!)).toBeNull();
  });
  it("S1 : une phrase à trancher", async () => {
    const { e } = await scriptPropose();
    const p = structuredClone(e.propositionScript!);
    p.aTrancher = [{ regle: "phrase-choc", priorite: 5, message: "La phrase-choc est à reformuler.", pourWill: true } as never];
    const r = miseDeCoteScriptIV(p);
    expect(r?.motif).toBe("Le script a une phrase à trancher.");
    expect(r?.phrases).toEqual(["La phrase-choc est à reformuler."]);
  });
  it("S2 : formule absolue dans le script, citée", async () => {
    const { e } = await scriptPropose();
    const p = structuredClone(e.propositionScript!);
    p.formules = [{ cle: "f1", texte: "zéro erreur", proposition: "très peu d'erreurs", ecranId: "e1" }];
    expect(miseDeCoteScriptIV(p)?.motif).toBe("Une formule trop affirmative est dans le script : « zéro erreur ».");
  });
  it("S4 : prix de la suite inconnu", async () => {
    const { e } = await scriptPropose();
    const p = structuredClone(e.propositionScript!);
    p.prix.auPlusCentimes = 0;
    expect(miseDeCoteScriptIV(p)?.motif).toBe("Le prix de la voix n'a pas pu être calculé.");
  });
  it("S5 : la voix dépasserait le prix accordé", async () => {
    const { e } = await scriptPropose();
    const p = structuredClone(e.propositionScript!);
    p.prix.plafondCentimes = p.prix.engageCentimes + p.prix.auPlusCentimes - 1;
    expect(miseDeCoteScriptIV(p)?.motif).toContain("La voix dépasserait le prix accordé pour cette vidéo");
  });
});

describe("controleAutomatiqueScriptIV (la machine en lot)", () => {
  it("script propre → validé par le contrôle automatique : la voix, sans décision de Will", async () => {
    const { e } = await scriptPropose();
    const apres = controleAutomatiqueScriptIV(structuredClone(e));
    expect(apres.etape).toBe("voix");
    expect(apres.miseDeCote).toBeUndefined();
    expect(apres.journal.at(-1)).toBe("Script sans doute : validé par le contrôle automatique du lot.");
  });
  it("S3 : la porte de Will refuse (question de commentaire) → mise de côté avec son message", async () => {
    const { e } = await scriptPropose();
    const c = structuredClone(e);
    c.propositionScript!.fiche.questionCommentaire.texteDit = "Écrivez OUI en commentaire pour recevoir le guide";
    const apres = controleAutomatiqueScriptIV(c);
    expect(apres.etape).toBe("script-a-valider");
    expect(apres.miseDeCote?.porte).toBe("script");
    expect(apres.miseDeCote?.motif).toMatch(/contrôles|commentaire/);
  });
  it("S1/S2/S4/S5 : la vidéo reste à la porte script, mise de côté, sans voix", async () => {
    const { e } = await scriptPropose();
    const c = structuredClone(e);
    c.propositionScript!.prix.auPlusCentimes = 0;
    const apres = controleAutomatiqueScriptIV(c);
    expect(apres.etape).toBe("script-a-valider");
    expect(apres.miseDeCote).toMatchObject({ porte: "script", motif: "Le prix de la voix n'a pas pu être calculé." });
    expect(apres.script).toBeUndefined();
  });
  it("la validation de Will efface la mise de côté", async () => {
    const { e } = await scriptPropose();
    const c = structuredClone(e);
    c.propositionScript!.prix.auPlusCentimes = 0;
    const mis = controleAutomatiqueScriptIV(c);
    const apres = validerScriptIV(mis, { proposition: mis.propositionScript!.empreinte });
    expect(apres.miseDeCote).toBeUndefined();
    expect(apres.etape).toBe("voix");
  });
});

describe("machine de bout en bout, en lot", () => {
  it("carte et script propres → la voix démarre sans aucune décision ; sans lot, la porte script attend Will", async () => {
    const carte = carteFixe("E");
    const m = monde();
    const lot = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 1500 })), outilsSimules(carte, m, { cartesValidees: 0 }), { pasMax: 4 });
    expect(["voix", "mise-en-scene", "rendu", "controles", "livraison", "prete"]).toContain(lot.etape);
    expect(lot.carte?.par).toBe("reglage");
    expect(lot.script).toBeDefined();
    expect(lot.miseDeCote).toBeUndefined();
    const seul = await scriptPropose();
    expect(seul.e.etape).toBe("script-a-valider");
    expect(seul.e.miseDeCote).toBeUndefined();
  });
  it("aucune voix payée quand le script est mis de côté (plafond trop bas)", async () => {
    const carte = carteFixe("E");
    const m = monde();
    // Plafond juste au-dessus de la lecture + l'écriture : la suite dépasserait le prix accordé.
    const e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { lot: LOT, plafondCentimes: 100 })), outilsSimules(carte, m, { cartesValidees: 0 }));
    expect(e.etape).toBe("script-a-valider");
    expect(e.miseDeCote?.porte).toBe("script");
    expect(e.miseDeCote?.motif).toContain("La voix dépasserait le prix accordé");
    expect(reservationsPayees(e).every((x) => x === "lecture" || x === "ecriture")).toBe(true);
    expect(m.lus).toHaveLength(0);
  });
});
