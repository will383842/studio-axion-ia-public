/**
 * CAL-26b · formulaire d'ajout en quatre questions, carte en trois lignes avec la pastille du compte, légende.
 * Sans DOM (mini-moteur de crochets). Aucun appel réel : l'action serveur est simulée.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ComptesEnvoi } from "@/domaine/comptes-envoi";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
type Saisie = Record<string, unknown>;
const ajouterEntree = vi.fn(async (s: Saisie): Promise<unknown> => ({ ok: true as const, donnees: { id: "c1", ...s } }));
vi.mock("@/app/(studio)/calendrier/actions/ajouter", () => ({ ajouterEntree: (s: Saisie) => ajouterEntree(s) }));
vi.mock("@/lib/envoi-multipart", () => ({ envoyerFichier: vi.fn() }));

const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { AjouterEntree } = await import("@/components/calendrier/AjouterEntree");
const carte = await import("@/components/calendrier/CarteEntreeCalendrier");
const { LegendeCalendrier } = await import("@/components/calendrier/LegendeCalendrier");

const COMPTES: ComptesEnvoi = {
  linkedin: { choix: [{ id: "li-profil", nom: "Fondateur", genre: "profile" }, { id: "li-page", nom: "Entreprise", genre: "page" }] },
};
const base = { jour: "2026-12-10", compteCible: "compte-fictif" };
const soumettre = async (m: ReturnType<typeof monter>) => {
  const f = trouver(m.rendre(), (e) => e.type === "form")[0]!;
  (f.props.onSubmit as (e: unknown) => void)({ preventDefault: () => undefined });
  await attendre();
};
const champ = (m: ReturnType<typeof monter>, nom: string, valeur: string) =>
  trouver(m.rendre(), (e) => e.type === "input" && e.props.name === nom && e.props.value === valeur)[0]!;

describe("formulaire d'ajout : quatre questions", () => {
  it("pose les quatre questions de la maquette, au vouvoiement, sans prix", () => {
    const html = renderToStaticMarkup(createElement(AjouterEntree, base));
    for (const q of ["1. Sur quels réseaux", "2. Quel type", "3. Le contenu", "4. Quand"]) expect(html).toContain(q);
    for (const t of ["Vidéo", "Carrousel", "Infographie", "Image"]) expect(html).toContain(t);
    expect(html).toMatch(/Rien ne part sans votre validation/);
    expect(html).not.toMatch(/€|\$|euros?\b|\b(tu|ton|ta|tes)\b/i);
  });

  it("« 1 bis » : une case par compte, libellé « LinkedIn · Profil / Page », aucun compte coché par défaut", () => {
    const html = renderToStaticMarkup(createElement(AjouterEntree, { ...base, comptesReseau: COMPTES }));
    expect(html).toContain("1 bis. Sur quel compte");
    expect(html).toContain("LinkedIn · Fondateur");
    expect(html).toContain("LinkedIn · Entreprise");
    expect(html).toMatch(/Profil/);
    expect(html).toMatch(/Page/);
    expect(html.match(/name="compte-linkedin"[^>]*checked/g) ?? []).toHaveLength(0);
    expect(renderToStaticMarkup(createElement(AjouterEntree, base))).not.toContain("1 bis");
  });

  it("le « + » d'une case future : réseau et date arrivent déjà cochés", () => {
    const html = renderToStaticMarkup(createElement(AjouterEntree, { ...base, reseau: "instagram" }));
    expect(html).toMatch(/value="instagram"[^>]*checked|checked[^>]*value="instagram"/);
    expect(html).not.toMatch(/value="linkedin"[^>]*checked|checked[^>]*value="linkedin"/);
    expect(html).toContain('value="2026-12-10"');
  });

  it("cocher deux réseaux crée deux publications, chacune avec sa clé", async () => {
    ajouterEntree.mockClear();
    const m = monter(AjouterEntree, { ...base, reseau: "linkedin" as const });
    (champ(m, "reseau", "instagram").props.onChange as (e: unknown) => void)({ target: { checked: true } });
    await soumettre(m);
    expect(ajouterEntree).toHaveBeenCalledTimes(2);
    const [a, b] = ajouterEntree.mock.calls.map((c) => c[0]);
    expect([a!.reseau, b!.reseau].sort()).toEqual(["instagram", "linkedin"]);
    expect(a!.cle).not.toBe(b!.cle);
    expect(texteDe(m.rendre())).toMatch(/Proposée|à valider/);
  });

  it("deux comptes cochés sur LinkedIn : une publication par compte", async () => {
    ajouterEntree.mockClear();
    const m = monter(AjouterEntree, { ...base, reseau: "linkedin" as const, comptesReseau: COMPTES });
    for (const id of ["li-profil", "li-page"]) (champ(m, "compte-linkedin", id).props.onChange as (e: unknown) => void)({ target: { checked: true } });
    await soumettre(m);
    expect(ajouterEntree.mock.calls.map((c) => c[0]!.compteCible).sort()).toEqual(["li-page", "li-profil"]);
  });

  it("aucun compte coché : l'ajout n'est pas bloqué, il part sur le compte par défaut", async () => {
    ajouterEntree.mockClear();
    const m = monter(AjouterEntree, { ...base, reseau: "linkedin" as const, comptesReseau: COMPTES });
    await soumettre(m);
    expect(ajouterEntree).toHaveBeenCalledTimes(1);
    expect(ajouterEntree.mock.calls[0]![0]).toMatchObject({ compteCible: "compte-fictif" });
  });

  it("une date passée : avertissement confirmable, jamais un refus", async () => {
    ajouterEntree.mockClear();
    ajouterEntree.mockResolvedValueOnce({ ok: false, message: "x", aConfirmer: "passe", avertissement: "Ce jour est passé." });
    const m = monter(AjouterEntree, { ...base, jour: "2026-11-01" });
    await soumettre(m);
    expect(texteDe(m.rendre())).toMatch(/Ce jour est passé\./);
    const bouton = trouver(m.rendre(), (e) => e.type === "button" && /quand même/.test(texteDe(e)))[0]!;
    (bouton.props.onClick as () => void)();
    await attendre();
    expect(ajouterEntree.mock.calls.at(-1)![0]).toMatchObject({ confirmerPasse: true });
  });

  it("un seul bouton d'envoi, et il ne publie rien", () => {
    const m = monter(AjouterEntree, base);
    expect(trouver(m.rendre(), (e) => e.type === "button" && e.props.type === "submit")).toHaveLength(1);
    expect(texteDe(m.rendre())).not.toMatch(/Publier/);
  });
});

describe("« + » d'une case", () => {
  it("une case future a un « + » qui ouvre le formulaire avec réseau et date", () => {
    const ouvrir = vi.fn();
    const el = carte.PlusCase({ jour: "2026-12-10", aujourdhui: "2026-12-01", reseau: "facebook", onOuvrir: ouvrir }) as { props: Record<string, unknown> };
    (el.props.onClick as () => void)();
    expect(ouvrir).toHaveBeenCalledWith({ jour: "2026-12-10", reseau: "facebook" });
  });
  it("une case passée n'a pas de « + »", () => {
    expect(carte.PlusCase({ jour: "2026-11-01", aujourdhui: "2026-12-01", reseau: "facebook", onOuvrir: () => undefined })).toBeNull();
  });
  it("aujourd'hui garde son « + »", () => {
    expect(carte.PlusCase({ jour: "2026-12-01", aujourdhui: "2026-12-01", reseau: "facebook", onOuvrir: () => undefined })).not.toBeNull();
  });
});

describe("carte en trois lignes", () => {
  const entree = { cle: "a", jour: "2026-12-10", reseau: "linkedin", type: "video", etat: "valider", heure: "09:00", compte: "Page" } as const;
  it("ligne 1 : réseau, heure et pastille du compte ; ligne 2 : type ; ligne 3 : état", () => {
    const html = renderToStaticMarkup(createElement(carte.CarteEntreeCalendrier, { entree }));
    expect(html.match(/data-ligne="\d"/g)).toEqual(['data-ligne="1"', 'data-ligne="2"', 'data-ligne="3"']);
    const l1 = html.split('data-ligne="2"')[0]!;
    expect(l1).toContain("09:00");
    expect(l1).toContain("data-compte");
    expect(l1).toContain("Page");
    expect(html.split('data-ligne="2"')[1]!.split('data-ligne="3"')[0]).toContain("Vidéo");
  });
  it("sans compte (réseau à un seul compte) : pas de pastille ; le lecteur d'écran dit le compte quand il existe", () => {
    expect(renderToStaticMarkup(createElement(carte.CarteEntreeCalendrier, { entree: { ...entree, compte: undefined } }))).not.toContain("data-compte");
    expect(carte.libelleCarte(entree)).toContain("Page");
  });
});

describe("légende", () => {
  it("nomme les réseaux, les états, le verrou et le créneau attendu, sans prix", () => {
    const html = renderToStaticMarkup(createElement(LegendeCalendrier));
    for (const m of ["LinkedIn", "Instagram", "Facebook", "Légende", "déjà partie ou passée", "créneau attendu"]) expect(html).toContain(m);
    expect(html).toMatch(/À valider/);
    expect(html).not.toMatch(/€|\$|euros?\b/i);
  });
});
