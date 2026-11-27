import { describe, expect, it } from "vitest";
import { duJourSansRemplacees, entreesAFaire, estRemplacee, type PubAFaire } from "@/components/calendrier/a-faire";
import { libelleLigne } from "@/components/calendrier/PanneauAFaire";

const base = { texte: "Texte inventé du carrousel", date: "2026-11-19T09:00:00.000Z", reseau: "linkedin", via: "zernio", visuelId: "vis_a" };
let n = 0;
const pub = (o: Partial<PubAFaire>): PubAFaire => ({ id: `p${++n}`, statut: "echec", ...base, modifieLe: "2026-11-19T08:00:00.000Z", ...o }) as PubAFaire;
const aCorriger = (l: ReturnType<typeof entreesAFaire>) => l.filter((e) => e.etat === "a_corriger");

describe("« À corriger » : tentatives remplacées", () => {
  it("3 échecs + 2 brouillons remplacés par 2 publications réussies plus récentes → aucune ligne", () => {
    const reussies = [pub({ statut: "publiee", modifieLe: "2026-11-20T08:00:00.000Z" }), pub({ id: "pub_envoi:vis_a:linkedin:v0:cre_x", statut: "publiee", modifieLe: "2026-11-20T08:05:00.000Z" })];
    const tentatives = [pub({}), pub({}), pub({ etatEnvoi: "refuse" }), pub({ statut: "brouillon", etatEnvoi: "refuse" }), pub({ statut: "brouillon", etatEnvoi: "refuse" })];
    const l = entreesAFaire([...tentatives, ...reussies]);
    expect(aCorriger(l)).toHaveLength(0);
    expect(l.filter((e) => e.etat === "brouillon")).toHaveLength(0);
    expect(estRemplacee(tentatives[0], [...tentatives, ...reussies])).toBe(true);
  });

  it("une réussite plus ancienne ne remplace pas", () => {
    const ancienne = pub({ statut: "publiee", modifieLe: "2026-11-18T08:00:00.000Z" });
    expect(aCorriger(entreesAFaire([ancienne, pub({})]))).toHaveLength(1);
  });

  it("3 échecs sans réussite → 1 ligne « 3 tentatives » avec le réseau", () => {
    const l = aCorriger(entreesAFaire([pub({}), pub({}), pub({})]));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ tentatives: 3, raison: "envoi en échec" });
    expect(libelleLigne(l[0])).toContain("3 tentatives");
    expect(libelleLigne(l[0])).toContain(l[0].reseau!);
    expect(l[0].reseau).not.toBe("linkedin");
  });

  it("deux réseaux différents → 2 lignes", () => {
    const l = aCorriger(entreesAFaire([pub({}), pub({}), pub({ reseau: "instagram" })]));
    expect(l).toHaveLength(2);
    expect(new Set(l.map((e) => e.reseau)).size).toBe(2);
  });

  it("un brouillon seul reste visible avec sa raison", () => {
    const l = entreesAFaire([pub({ statut: "brouillon" })]);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ etat: "brouillon", raison: "brouillon non envoyé" });
  });

  it("1 · deux comptes du même réseau ne se remplacent jamais, ni ne se regroupent", () => {
    const reussieB = pub({ statut: "publiee", canalId: "compte_B", modifieLe: "2026-11-20T08:00:00.000Z" });
    const echecA = pub({ canalId: "compte_A" });
    expect(estRemplacee(echecA, [echecA, reussieB])).toBe(false);
    expect(aCorriger(entreesAFaire([echecA, reussieB]))).toHaveLength(1);
    expect(aCorriger(entreesAFaire([echecA, pub({ canalId: "compte_B" })]))).toHaveLength(2);
    // même compte : remplacée ; compte inconnu d'un côté : on ne masque pas à l'aveugle… sauf règle publications.ts (absent = compatible)
    expect(estRemplacee(echecA, [echecA, { ...reussieB, canalId: "compte_A" }])).toBe(true);
  });

  it("2 · une réussite ne masque un échec que si elle est postérieure à l'ÉCHEC (modifieLe), pas à la création", () => {
    const echec = pub({ creeLe: "2026-11-16T08:00:00.000Z", modifieLe: "2026-11-21T10:00:00.000Z" }); // créé lundi, échoué vendredi
    const reussie = pub({ statut: "publiee", creeLe: "2026-11-16T09:00:00.000Z", modifieLe: "2026-11-16T09:30:00.000Z" });
    expect(estRemplacee(echec, [echec, reussie])).toBe(false);
    expect(aCorriger(entreesAFaire([echec, reussie]))).toHaveLength(1);
  });

  it("3 · en cas de doute (horodatage absent), l'échec reste affiché", () => {
    const reussie = pub({ statut: "publiee", modifieLe: "2026-11-20T08:00:00.000Z" });
    const sansDate = pub({ modifieLe: undefined });
    expect(estRemplacee(sansDate, [sansDate, reussie])).toBe(false);
    const echec = pub({});
    expect(estRemplacee(echec, [echec, pub({ statut: "publiee", modifieLe: undefined })])).toBe(false);
  });

  it("4 · la vue jour décide « remplacée » sur la même base que le panneau (la semaine)", () => {
    const echec = pub({ date: "2026-11-19T09:00:00.000Z" });
    const reussie = pub({ statut: "publiee", date: "2026-11-20T09:00:00.000Z", modifieLe: "2026-11-20T10:00:00.000Z" });
    const semaine = [echec, reussie];
    const cle = (d: string) => d.slice(0, 10);
    expect(aCorriger(entreesAFaire(semaine))).toHaveLength(0);
    expect(duJourSansRemplacees(semaine, "2026-11-19", cle)).toHaveLength(0);
    expect(duJourSansRemplacees(semaine, "2026-11-20", cle)).toHaveLength(1);
  });
});
