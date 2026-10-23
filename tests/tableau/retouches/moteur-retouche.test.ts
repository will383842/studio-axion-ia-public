/**
 * TB-20 : la retouche par boutons passe par `retoucher` du moteur (doubles de `tests/tableau/moteur/doubles.ts`).
 * Ce que l'aperçu annonce est ce que la chaîne refait : une retouche d'image ne relit pas la voix et ne rend que les
 * scènes qui montrent la page touchée ; changer ce qui est dit relit la voix une fois ; un refus ne lance rien.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { MoteurVideo, OperationMontage, ResultatFabrication } from "../../../src/moteurs/types";
import { ID_SCENE_FIN } from "../../../src/moteurs/montage-tableau/fabriquer";
import { OPERATION_NON_PRISE_EN_CHARGE, RETOUCHE_REFUSEE, apercuRetouche, type OperationRetouche } from "../../../src/moteurs/montage-tableau";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { contexteExemple, ficheDemonstration } from "../regles/exemples";
import { banc } from "../moteur/doubles";

const T0 = Date.UTC(2026, 9, 11, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
/** Les opérations du tableau passent par le champ commun `operations` (type ouvert côté service). */
const ops = (...o: OperationRetouche[]) => o as unknown as OperationMontage[];

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

async function fabriquee() {
  const b = banc(ficheDemonstration, { appels: ["fin-commune"] });
  const c = b.commande(ficheDemonstration);
  const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-v1")));
  expect(fin.travail.statut).toBe("termine");
  const parent = { versionId: "ver-t-v1", projetMontage: fin.resultat!.projetMontage, pistes: [] };
  return { b, c, parent, scenesAvant: b.d.scenesSoumises().length };
}

const idsRendus = (b: ReturnType<typeof banc>, depuis: number) => b.d.scenesSoumises().slice(depuis).map((d) => (d.parametres as { proprietes: { scene: { id: string } } }).proprietes.scene.id);
const { texteScript: _s, ...regles } = contexteExemple(ficheDemonstration);
void _s;

describe("retouche par boutons, par le moteur", () => {
  it("retouche d'image : voix reprise, seules les scènes annoncées par l'aperçu sont rendues", async () => {
    const { b, c, parent, scenesAvant } = await fabriquee();
    const op: OperationRetouche = { type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "loupe" };
    const apercu = apercuRetouche(ficheDemonstration, op, regles);
    expect(apercu).toMatchObject({ ok: true, voixRefaite: false, payant: false });

    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-r1"), planIds: [], consigne: "", parent, operations: ops(op) });
    expect(t).toMatchObject({ type: "retouche", statut: "en_file" });
    const fin = await jusquAuBout(b.moteur, c, t);
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
    expect([...idsRendus(b, scenesAvant)].sort()).toEqual([...apercu.scenesRefaites].sort());
    expect(idsRendus(b, scenesAvant)).not.toContain(ID_SCENE_FIN);
    expect(fin.resultat!.lignesReelles.map((l) => l.etape)).not.toContain("Voix");
    const gardee = (fin.resultat!.projetMontage.tableau as { fiche?: FicheTableau }).fiche;
    expect(gardee?.scenes[2].elements.find((e) => e.id === "e06")).toMatchObject({ dessinId: "loupe" });
  });

  it("une seconde retouche repart de la fiche déjà retouchée", async () => {
    const { b, c, parent } = await fabriquee();
    const r1 = await jusquAuBout(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-a"), planIds: [], consigne: "", parent, operations: ops({ type: "remplacerDessin", sceneId: "s03", elementId: "e06", dessinId: "loupe" }) }));
    const parent2 = { versionId: "ver-t-a", projetMontage: r1.resultat!.projetMontage, pistes: [] };
    const r2 = await jusquAuBout(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-b"), planIds: [], consigne: "", parent: parent2, operations: ops({ type: "changerGeste", sceneId: "s06", elementId: "e12", geste: "souligner" }) }));
    expect(r2.travail.statut).toBe("termine");
    const f = (r2.resultat!.projetMontage.tableau as { fiche: FicheTableau }).fiche;
    expect(f.scenes[2].elements.find((e) => e.id === "e06")).toMatchObject({ dessinId: "loupe" });
    expect(f.scenes[5].elements.find((e) => e.id === "e12")).toMatchObject({ geste: "souligner" });
  });

  it("changer ce qui est dit : la voix est relue une fois (payée), comme annoncé", async () => {
    const { b, c, parent } = await fabriquee();
    const op: OperationRetouche = { type: "modifierTexteDit", sceneId: "s03", texte: "Geste deux : demandez trois idées de publication à partir de la question." };
    expect(apercuRetouche(ficheDemonstration, op, regles)).toMatchObject({ ok: true, voixRefaite: true, payant: true });
    const fin = await jusquAuBout(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-dit"), planIds: [], consigne: "", parent, operations: ops(op) }));
    expect(fin.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(2);
  });

  it("changer la fin : refusé sans la bibliothèque des appels, accepté avec", async () => {
    const { b, c, parent, scenesAvant } = await fabriquee();
    const refus = await b.moteur.retoucher({ commande: c, contexte: ctx("t-f1"), planIds: [], consigne: "", parent, operations: ops({ type: "changerFin", appelId: "fin-inconnue" }) });
    expect(refus).toMatchObject({ statut: "echec", erreur: { code: RETOUCHE_REFUSEE, reessayable: false } });
    expect(refus.erreur?.messagePourWill).toMatch(/choisissez-en une/);
    const ok = await jusquAuBout(b.moteur, c, await b.moteur.retoucher({ commande: c, contexte: ctx("t-f2"), planIds: [], consigne: "", parent, operations: ops({ type: "changerFin", appelId: "fin-commune" }) }));
    expect(ok.travail.statut).toBe("termine");
    expect(b.d.lectures()).toBe(1);
    expect(idsRendus(b, scenesAvant)).toEqual([]);
  });

  it("refusée par les règles : rien n'est lancé ni rendu, une phrase claire pour Will", async () => {
    const { b, c, parent, scenesAvant } = await fabriquee();
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-x"), planIds: [], consigne: "", parent, operations: ops({ type: "remplacerTexteLigne", sceneId: "s03", elementId: "e05", texte: "Abonnez-vous vite" }) });
    expect(t).toMatchObject({ type: "retouche", statut: "echec", erreur: { code: RETOUCHE_REFUSEE, reessayable: false } });
    expect(t.erreur?.messagePourWill).toMatch(/^Cette retouche n'est pas possible/);
    expect((await b.moteur.avancer(t, c, T0)).travail.statut).toBe("echec");
    expect(b.d.scenesSoumises()).toHaveLength(scenesAvant);
    expect(b.d.lectures()).toBe(1);
  });

  it("hors catalogue : toujours « non pris en charge » ; mal formée : refus lisible", async () => {
    const { b, c, parent } = await fabriquee();
    const inconnue = await b.moteur.retoucher({ commande: c, contexte: ctx("t-i"), planIds: [], consigne: "", parent, operations: [{ type: "modifierTitre", texte: "Autre" }] });
    expect(inconnue.erreur?.code).toBe(OPERATION_NON_PRISE_EN_CHARGE);
    const malFormee = await b.moteur.retoucher({ commande: c, contexte: ctx("t-m"), planIds: [], consigne: "", parent, operations: [{ type: "remplacerDessin", sceneId: "s03" }] as unknown as OperationMontage[] });
    expect(malFormee.erreur).toMatchObject({ code: RETOUCHE_REFUSEE });
    expect(malFormee.erreur?.messagePourWill).toMatch(/incomplète/);
  });

  it("moteur non relié : refus lisible, rien n'est lancé", async () => {
    const b = banc(ficheDemonstration, null);
    const c = b.commande(ficheDemonstration);
    const t = await b.moteur.retoucher({ commande: c, contexte: ctx("t-nr"), planIds: [], consigne: "", operations: ops({ type: "changerGeste", sceneId: "s06", elementId: "e12", geste: "souligner" }) });
    expect(t).toMatchObject({ statut: "echec", erreur: { code: "TABLEAU_NON_RELIE" } });
  });
});
