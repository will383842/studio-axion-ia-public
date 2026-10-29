/**
 * RÉSERVE Image → vidéo · domaine pur : ajout (script resserré en idée), file par rang, lancement, lien, issues
 * idempotentes, retrait conservé, orphelin. Textes fictifs.
 */
import { describe, expect, it } from "vitest";
import {
  ajouterIV,
  appliquerIssueReserveIV,
  lierVideoIV,
  marquerLancementIV,
  NOTE_A_RELIRE_IV,
  orphelinIV,
  prochainIV,
  RESERVE_MAX_IV,
  reserveVideIV,
  retirerIV,
  type ReserveIV,
} from "@/domaine/image-video/reserve";

const T0 = "2030-01-01T10:00:00.000Z";
const SCRIPT = "Chaque lundi, un robot fictif trie les messages reçus, prépare un résumé clair et l'envoie à toute l'équipe avant neuf heures.";
const IDEE = "Un assistant fictif qui range les factures du mois dans le bon dossier";

function avec(...textes: string[]): ReserveIV {
  let r = reserveVideIV();
  textes.forEach((t, i) => {
    const a = ajouterIV(r, { nature: "idee", texte: t, reseaux: ["linkedin"] }, `e${i + 1}`, T0);
    if (!a.ok) throw new Error(a.phrase);
    r = a.reserve;
  });
  return r;
}
const el = (r: ReserveIV, id: string) => r.elements.find((e) => e.id === id)!;
const enCours = (r: ReserveIV, id: string, videoId = "v1") => lierVideoIV(marquerLancementIV(r, id, T0), id, videoId);

describe("ajouterIV", () => {
  it("ajoute un script valide tel quel, à la fin de la file", () => {
    const a = ajouterIV(avec(IDEE), { nature: "script", texte: SCRIPT, reseaux: ["linkedin"] }, "s", T0);
    expect(a.ok && a.element).toMatchObject({ id: "s", nature: "script", etat: "a-faire", rang: 2, essais: 0, ajouteLe: T0 });
    expect(a.ok && a.element.resserre).toBeUndefined();
  });

  it("un script refusé comme script mais accepté comme texte devient une idée resserrée", () => {
    const court = "Trier les factures"; // 3 mots : assez pour une idée, trop court pour un script
    const a = ajouterIV(reserveVideIV(), { nature: "script", texte: court, reseaux: [] }, "s", T0);
    expect(a.ok && a.element).toMatchObject({ nature: "idee", resserre: true });
  });

  it("seul un texte vide est refusé", () => {
    for (const t of ["", "   \n "]) expect(ajouterIV(reserveVideIV(), { nature: "idee", texte: t, reseaux: [] }, "x", T0)).toMatchObject({ ok: false });
    expect(ajouterIV(reserveVideIV(), { nature: "idee", texte: IDEE, reseaux: [] }, "x", T0).ok).toBe(true);
  });

  it("plafond de 300 à fabriquer ; les faits et les retirés ne comptent pas et ne sont jamais purgés", () => {
    let r = reserveVideIV();
    for (let i = 0; i < RESERVE_MAX_IV; i++) r = { ...r, elements: [...r.elements, { id: `p${i}`, nature: "idee", texte: IDEE, reseaux: [], etat: "a-faire", rang: i + 1, ajouteLe: T0, essais: 0 }] };
    expect(ajouterIV(r, { nature: "idee", texte: IDEE, reseaux: [] }, "z", T0)).toMatchObject({ ok: false });
    r = retirerIV(r, "p0");
    const a = ajouterIV(r, { nature: "idee", texte: IDEE, reseaux: [] }, "z", T0);
    expect(a.ok && a.reserve.elements).toHaveLength(RESERVE_MAX_IV + 1);
    expect(a.ok && a.reserve.elements.find((e) => e.id === "p0")?.etat).toBe("retire");
  });
});

describe("file, lancement, lien", () => {
  it("prochainIV : le premier à faire par rang, en sautant les retirés et les en-cours", () => {
    let r = avec(IDEE, IDEE, IDEE);
    expect(prochainIV(r)?.id).toBe("e1");
    r = retirerIV(marquerLancementIV(r, "e1", T0), "e2");
    expect(prochainIV(r)?.id).toBe("e3");
    expect(prochainIV(reserveVideIV())).toBeNull();
  });

  it("marquerLancementIV pose en-cours + lanceeLe ; lierVideoIV pose la vidéo", () => {
    const r = enCours(avec(IDEE), "e1", "v9");
    expect(el(r, "e1")).toMatchObject({ etat: "en-cours", lanceeLe: T0, videoId: "v9" });
  });
});

describe("appliquerIssueReserveIV", () => {
  it("vidéo faite : fait, et jamais touché ensuite", () => {
    let r = appliquerIssueReserveIV(enCours(avec(IDEE), "e1"), "e1", "faite");
    expect(el(r, "e1").etat).toBe("fait");
    r = appliquerIssueReserveIV(r, "e1", "arret");
    expect(el(r, "e1")).toMatchObject({ etat: "fait", essais: 0 });
  });

  it("mise de côté : reste en cours, note « à relire », idempotent", () => {
    const r = appliquerIssueReserveIV(enCours(avec(IDEE), "e1"), "e1", "mise-de-cote");
    expect(el(r, "e1")).toMatchObject({ etat: "en-cours", note: NOTE_A_RELIRE_IV, videoId: "v1" });
    expect(appliquerIssueReserveIV(r, "e1", "mise-de-cote")).toBe(r);
  });

  it.each(["arret", "annulee", "supprimee"] as const)("%s : retour à faire en fin de file, un essai de plus, idempotent", (issue) => {
    const base = enCours(avec(IDEE, IDEE), "e1");
    const r = appliquerIssueReserveIV(base, "e1", issue);
    expect(el(r, "e1")).toMatchObject({ etat: "a-faire", essais: 1, rang: 3 });
    expect(el(r, "e1").videoId).toBeUndefined();
    expect(prochainIV(r)?.id).toBe("e2");
    expect(appliquerIssueReserveIV(r, "e1", issue)).toBe(r);
  });
});

describe("retirerIV et orphelinIV", () => {
  it("retire seulement un à-faire ; l'élément est conservé", () => {
    const r = enCours(avec(IDEE, IDEE), "e1");
    expect(retirerIV(r, "e1")).toBe(r);
    const s = retirerIV(r, "e2");
    expect(s.elements).toHaveLength(2);
    expect(el(s, "e2").etat).toBe("retire");
  });

  it("orphelin : en cours sans vidéo depuis plus de 15 minutes", () => {
    const r = marquerLancementIV(avec(IDEE, IDEE), "e1", T0);
    expect(orphelinIV(r, "2030-01-01T10:15:00.000Z")).toBeNull();
    expect(orphelinIV(r, "2030-01-01T10:15:01.000Z")?.id).toBe("e1");
    expect(orphelinIV(lierVideoIV(r, "e1", "v1"), "2030-01-01T12:00:00.000Z")).toBeNull();
  });
});
