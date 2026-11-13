/** CAL-11c · Bouton « Déplacer » (clavier, téléphone), panneau « À programmer », contenus liés. Aucun appel réel, rien n'est envoyé. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BoutonDeplacer, HEURE_PLACEMENT, MESSAGE_RIEN_A_PLACER, PanneauAProgrammer, contenusLies, creerGardePlacement, deciderPlacement } from "@/components/calendrier/DecalerEntree";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const AUJ = "2026-11-11";
const carte = (cle: string, o: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle, jour: "2026-11-13", reseau: "linkedin", type: "video", etat: "brouillon", heure: "09:00", titre: "T", mediaId: "m1", ...o });
const li = carte("a|linkedin");
const tt = carte("a|tiktok", { reseau: "tiktok" });
const autre = carte("b|tiktok", { reseau: "tiktok", mediaId: "m2" });
const ig = carte("a|instagram", { reseau: "instagram", etat: "publie" });

describe("CAL-11c · contenus liés", () => {
  it("les versions des autres réseaux du même média sont proposées, pas les autres médias", () => {
    expect(contenusLies(li, [li, tt, autre]).map((e) => e.cle)).toEqual(["a|tiktok"]);
  });
  it("une version publiée ou passée n'est pas proposée", () => {
    expect(contenusLies(li, [li, ig])).toEqual([]);
    expect(contenusLies(li, [li, carte("p|tiktok", { reseau: "tiktok", jour: "2026-11-01" })], AUJ)).toEqual([]);
  });
  it("sans média, aucun lien", () => expect(contenusLies(carte("x", { mediaId: null }), [carte("x", { mediaId: null }), carte("y", { reseau: "tiktok", mediaId: null })])).toEqual([]));
});

describe("CAL-11c · placer un contenu « À programmer »", () => {
  const c = { id: "s1", reseau: "linkedin" as const, type: "video" as const, titre: "Un contenu" };
  it("même réseau, jour à venir : 9 h, « À valider »", () => expect(deciderPlacement(c, { reseau: "linkedin", jour: "2026-11-14" }, AUJ)).toEqual({ ok: true, jour: "2026-11-14", heure: HEURE_PLACEMENT, statut: "a_valider" }));
  it("l'heure est 9 h", () => expect(HEURE_PLACEMENT).toBe("09:00"));
  it("autre réseau : refus avec un message", () => {
    const r = deciderPlacement(c, { reseau: "tiktok", jour: "2026-11-14" }, AUJ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("Ce contenu est prévu pour LinkedIn.");
  });
  it("jour passé : refus", () => expect(deciderPlacement(c, { reseau: "linkedin", jour: "2026-11-10" }, AUJ).ok).toBe(false));
  it("liste vide : message de la maquette", () => {
    expect(MESSAGE_RIEN_A_PLACER).toBe("Rien à placer. Ajoutez une publication ou importez un fichier.");
    expect(renderToStaticMarkup(<PanneauAProgrammer contenus={[]} aujourdhui={AUJ} onPlacer={() => {}} />)).toContain(MESSAGE_RIEN_A_PLACER);
  });
  it("le panneau liste les contenus avec un bouton « Placer » d'au moins 44 px", () => {
    const html = renderToStaticMarkup(<PanneauAProgrammer contenus={[c]} aujourdhui={AUJ} onPlacer={() => {}} />);
    expect(html).toContain("Un contenu");
    expect(html).toContain("Placer");
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("À programmer");
    expect(html).toContain("Elle ne partira qu&#x27;après votre validation");
  });
});

describe("CAL-11c · bouton « Déplacer »", () => {
  it("un vrai bouton nommé, d'au moins 44 px, fermé au départ", () => {
    const html = renderToStaticMarkup(<BoutonDeplacer entree={li} entrees={[li, tt]} aujourdhui={AUJ} onDeplacer={() => {}} onAnnuler={() => {}} />);
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain("Déplacer");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("min-h-[44px]");
    expect(html).not.toContain("Annuler");
  });
  it("une publication publiée ou passée n'offre pas le bouton", () => {
    expect(renderToStaticMarkup(<BoutonDeplacer entree={ig} entrees={[ig]} aujourdhui={AUJ} onDeplacer={() => {}} onAnnuler={() => {}} />)).toBe("");
  });
  it("aucun prix", () => expect(renderToStaticMarkup(<PanneauAProgrammer contenus={[]} aujourdhui={AUJ} onPlacer={() => {}} />)).not.toMatch(/€|\$|prix|tarif/i));
  it("anti double clic : un second « Placer » sur le même contenu est ignoré, jusqu'à l'annulation", () => {
    const g = creerGardePlacement();
    expect(g.tenter("a")).toBe(true);
    expect(g.tenter("a")).toBe(false);
    expect(g.tenter("b")).toBe(true);
    g.retirer("a");
    expect(g.deja("a")).toBe(false);
    expect(g.tenter("a")).toBe(true);
  });
});
