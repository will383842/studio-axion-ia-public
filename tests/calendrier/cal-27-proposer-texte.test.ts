/**
 * CAL-27 · bouton « Proposer le texte et le premier commentaire » (ajout manuel). Aucun appel réel : l'appel à Claude est
 * une doublure injectée. Le bouton PROPOSE ; rien n'est écrit ni envoyé ici, et la saisie à la main reste toujours possible.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
const { monter, trouver, texteDe, attendre } = await import("../aides/crochets-factices");
const { proposerTexteImporte } = await import("@/services/texte-post");
const { ProposerTexte } = await import("@/components/calendrier/ProposerTexte");
const { AjouterEntree } = await import("@/components/calendrier/AjouterEntree");

const DESCRIPTION = "Une courte vidéo qui montre comment préparer votre devis en trois étapes simples.";
const RESEAUX = ["linkedin", "instagram", "tiktok"] as const;

describe("service : proposerTexteImporte", () => {
  it("vidéo + une phrase : un texte par réseau, un premier commentaire (aucun sur TikTok), aucun fait absent de la description", async () => {
    const r = await proposerTexteImporte({ type: "video", description: DESCRIPTION, reseaux: [...RESEAUX], simulation: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.propositions.map((p) => p.reseau)).toEqual([...RESEAUX]);
    for (const p of r.propositions) {
      expect(p.texte.length).toBeGreaterThan(0);
      expect(p.controle, `${p.reseau} : contrôleur`).toEqual([]);
      expect(p.texte).not.toMatch(/\d/); // la description ne contient aucun chiffre en chiffres
    }
    const par = Object.fromEntries(r.propositions.map((p) => [p.reseau, p.premierCommentaire]));
    expect(par.tiktok).toBeNull();
    expect(par.linkedin).toBeTruthy();
    expect(par.instagram).toBeTruthy();
    expect(par.linkedin).not.toBe(par.instagram);
  });

  it("un chiffre inventé par l'IA est refusé par le contrôleur de texte, avec reprise puis repli", async () => {
    const appeler = vi.fn(async () => ({ texte: "Gagnez 40 % de temps sur vos devis.", motsDiese: ["#Devis", "#Conseil", "#Gestion"] }));
    const r = await proposerTexteImporte({ type: "video", description: DESCRIPTION, reseaux: ["linkedin"], appeler });
    expect(appeler).toHaveBeenCalledTimes(2);
    if (!r.ok) throw new Error("attendu : ok");
    expect(r.propositions[0]!.source).toBe("repli");
    expect(r.propositions[0]!.texte).not.toContain("40");
    expect(r.essai).toBe(false);
  });

  it("sans description (vidéo) : demande une phrase, n'appelle rien", async () => {
    const appeler = vi.fn();
    const r = await proposerTexteImporte({ type: "video", description: "   ", reseaux: ["linkedin"], appeler });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.demande).toMatch(/phrase/);
    expect(appeler).not.toHaveBeenCalled();
  });

  it("panne de l'IA : repli, jamais d'exception ; en simulation le texte est signalé comme essai", async () => {
    const r = await proposerTexteImporte({ type: "video", description: DESCRIPTION, reseaux: ["linkedin"], appeler: async () => { throw new Error("panne"); } });
    expect(r.ok && r.propositions[0]!.source).toBe("repli");
    const s = await proposerTexteImporte({ type: "carrousel", description: DESCRIPTION, texteDesPages: "Vos devis\nTrois étapes", reseaux: ["linkedin"], simulation: true });
    expect(s.ok && s.essai).toBe(true);
  });
});

describe("composant : ProposerTexte", () => {
  const boutonDe = (m: ReturnType<typeof monter>) => trouver(m.rendre(), (e) => e.type === "button" && /Proposer le texte et le premier commentaire/.test(texteDe(e.props.children as never)))[0]!;
  const champs = (m: ReturnType<typeof monter>) => trouver(m.rendre(), (e) => e.type === "textarea");

  it("le bouton propose, les champs se remplissent et restent modifiables ; la simulation est signalée en français", async () => {
    const m = monter(ProposerTexte, { type: "video" as const, reseaux: [...RESEAUX], proposer: (d: Parameters<typeof proposerTexteImporte>[0]) => proposerTexteImporte({ ...d, simulation: true }) });
    const description = trouver(m.rendre(), (e) => e.type === "input" || (e.type === "textarea" && e.props["aria-label"] === "Description"))[0]!;
    (description.props.onChange as (e: unknown) => void)({ target: { value: DESCRIPTION } });
    (boutonDe(m).props.onClick as () => void)();
    await attendre();
    expect(texteDe(m.rendre())).toMatch(/texte d'essai/i);
    const apres = champs(m);
    expect(apres.length).toBeGreaterThanOrEqual(RESEAUX.length);
    expect(String(apres[0]!.props.value).length).toBeGreaterThan(0);
    (apres[0]!.props.onChange as (e: unknown) => void)({ target: { value: "Ma version." } });
    expect(String(champs(m)[0]!.props.value)).toBe("Ma version.");
  });

  it("sans description : demande une phrase ; en panne : message clair, champs vides éditables, jamais bloquant", async () => {
    const vide = monter(ProposerTexte, { type: "video" as const, reseaux: ["linkedin" as const], proposer: proposerTexteImporte });
    (boutonDe(vide).props.onClick as () => void)();
    await attendre();
    expect(texteDe(vide.rendre())).toMatch(/phrase/);

    const panne = monter(ProposerTexte, { type: "video" as const, reseaux: ["linkedin" as const], proposer: async () => { throw new Error("hors service"); } });
    (trouver(panne.rendre(), (e) => e.type === "input")[0]!.props.onChange as (e: unknown) => void)({ target: { value: DESCRIPTION } });
    (boutonDe(panne).props.onClick as () => void)();
    await attendre();
    expect(texteDe(panne.rendre())).toMatch(/à la main/);
    const f = champs(panne)[0]!;
    expect(f.props.disabled).not.toBe(true);
    expect(f.props.readOnly).not.toBe(true);
  });

  it("aucun prix affiché, vouvoiement", () => {
    const m = monter(ProposerTexte, { type: "video" as const, reseaux: ["linkedin" as const], proposer: proposerTexteImporte });
    const t = texteDe(m.rendre());
    expect(t).not.toMatch(/€|\$|euros?\b/i);
    expect(t).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
  });
});

describe("ajout manuel", () => {
  it("le bouton n'est jamais obligatoire : sans proposeur, le formulaire d'ajout reste inchangé", () => {
    const m = monter(AjouterEntree, { jour: "2026-12-10", compteCible: "compte-fictif" });
    expect(texteDe(m.rendre())).not.toMatch(/Proposer le texte/);
    expect(trouver(m.rendre(), (e) => e.type === "button" && e.props.type === "submit")).toHaveLength(1);
  });

  it("avec un proposeur, le bouton apparaît dans le formulaire", () => {
    const m = monter(AjouterEntree, { jour: "2026-12-10", compteCible: "compte-fictif", proposer: proposerTexteImporte });
    expect(trouver(m.rendre(), (e) => e.type === ProposerTexte)).toHaveLength(1);
  });
});
