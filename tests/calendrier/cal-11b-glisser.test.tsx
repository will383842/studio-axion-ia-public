/** CAL-11b · Reprogrammation : la grille de la semaine accepte le glisser-déposer. Aucun appel réel, rien n'est enregistré ici. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GrilleSemaine, GesteDeplacement, MESSAGE_AUTRE_RESEAU, decisionDepot, jourVoisin, peutGlisser } from "@/components/calendrier/GrilleSemaine";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";

const AUJ = "2026-11-11"; // mercredi
const carte = (cle: string, o: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle, jour: "2026-11-13", reseau: "linkedin", type: "video", etat: "brouillon", heure: "09:00", titre: "T", ...o });
const future = carte("a|linkedin");
const rendre = (p: Partial<Parameters<typeof GrilleSemaine>[0]> = {}) => renderToStaticMarkup(<GrilleSemaine semaineDu={AUJ} aujourdhui={AUJ} entrees={[future]} {...p} />);

describe("CAL-11b · qui peut glisser", () => {
  it("une publication future se glisse", () => expect(peutGlisser(future, AUJ)).toBe(true));
  it("une publication passée ou publiée ne se glisse pas", () => {
    expect(peutGlisser(carte("p", { jour: "2026-11-10" }), AUJ)).toBe(false);
    expect(peutGlisser(carte("q", { etat: "publie" }), AUJ)).toBe(false);
  });
});

describe("CAL-11b · où déposer", () => {
  it("même réseau, jour non passé : permis", () => expect(decisionDepot(future, { reseau: "linkedin", jour: "2026-11-14" }, AUJ)).toEqual({ ok: true, jour: "2026-11-14" }));
  it("autre réseau : refusé avec le message Dupliquer", () => {
    const r = decisionDepot(future, { reseau: "tiktok", jour: "2026-11-14" }, AUJ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ouvrez la publication et choisissez Dupliquer");
    expect(MESSAGE_AUTRE_RESEAU).toContain("ouvrez la publication et choisissez Dupliquer");
  });
  it("jour passé : refusé", () => expect(decisionDepot(future, { reseau: "linkedin", jour: "2026-11-10" }, AUJ).ok).toBe(false));
  it("même jour : rien à faire", () => expect(decisionDepot(future, { reseau: "linkedin", jour: future.jour }, AUJ).ok).toBe(false));
  it("une carte verrouillée ne se dépose nulle part", () => expect(decisionDepot(carte("p", { jour: "2026-11-10" }), { reseau: "linkedin", jour: "2026-11-14" }, AUJ).ok).toBe(false));
});

describe("CAL-11b · le geste change la date une seule fois", () => {
  it("un dépôt valide appelle onDeplacer une fois ; un second lâcher ne fait rien", () => {
    const onDeplacer = vi.fn();
    const g = new GesteDeplacement(AUJ, onDeplacer);
    g.saisir(future);
    expect(g.lacher({ reseau: "linkedin", jour: "2026-11-14" }).ok).toBe(true);
    expect(g.lacher({ reseau: "linkedin", jour: "2026-11-14" }).ok).toBe(false);
    expect(onDeplacer).toHaveBeenCalledTimes(1);
    expect(onDeplacer).toHaveBeenCalledWith(future, "2026-11-14");
  });
  it("un dépôt refusé ou un geste annulé ne change aucune date", () => {
    const onDeplacer = vi.fn();
    const g = new GesteDeplacement(AUJ, onDeplacer);
    g.saisir(future);
    expect(g.lacher({ reseau: "tiktok", jour: "2026-11-14" }).ok).toBe(false);
    g.saisir(future);
    g.annuler();
    expect(g.lacher({ reseau: "linkedin", jour: "2026-11-14" }).ok).toBe(false);
    g.saisir(carte("q", { etat: "publie" }));
    expect(g.lacher({ reseau: "linkedin", jour: "2026-11-14" }).ok).toBe(false);
    expect(onDeplacer).not.toHaveBeenCalled();
  });
  it("hors de toute case : rien ne change", () => {
    const onDeplacer = vi.fn();
    const g = new GesteDeplacement(AUJ, onDeplacer);
    g.saisir(future);
    expect(g.lacher(null).ok).toBe(false);
    expect(onDeplacer).not.toHaveBeenCalled();
  });
});

describe("CAL-11b · clavier : jour voisin permis", () => {
  const jours = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  it("flèche droite et gauche", () => {
    expect(jourVoisin(future, 1, jours, AUJ)).toBe("2026-11-14");
    expect(jourVoisin(future, -1, jours, AUJ)).toBe("2026-11-12");
  });
  it("jamais vers un jour passé ni hors de la semaine", () => {
    expect(jourVoisin(carte("p", { jour: "2026-11-11" }), -1, jours, AUJ)).toBeNull();
    expect(jourVoisin(carte("p", { jour: "2026-11-15" }), 1, jours, AUJ)).toBeNull();
  });
  it("une carte verrouillée ne bouge pas", () => expect(jourVoisin(carte("p", { etat: "publie" }), 1, jours, AUJ)).toBeNull());
});

describe("CAL-11b · rendu", () => {
  it("sans onDeplacer : rien de déplaçable (rendu d'avant)", () => {
    const html = rendre();
    expect(html).not.toContain("data-glissable");
    expect(html).not.toContain("data-zone-annonce");
  });
  it("avec onDeplacer : seule la carte future est déplaçable, et l'aide est dite aux lecteurs d'écran", () => {
    const html = rendre({ entrees: [future, carte("v|linkedin", { jour: "2026-11-10" }), carte("w|linkedin", { etat: "publie", jour: "2026-11-12" })], onDeplacer: () => {} });
    expect((html.match(/data-glissable="/g) ?? []).length).toBe(1);
    expect(html).toContain("data-zone-annonce");
    expect(html).toContain("Alt");
  });
  it("aucun bandeau « Annuler » tant que rien n'a été déplacé", () => expect(rendre({ onDeplacer: () => {} })).not.toContain("Annuler"));
  it("aucun prix", () => expect(rendre({ onDeplacer: () => {} })).not.toMatch(/€|\$|prix|tarif/i));
});
