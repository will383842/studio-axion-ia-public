/** CAL-08 · alertes discrètes : case pointillée, icône unique par carte, compteur du jour, filtre « À compléter », liste « Prêt à partir ? ». Aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GrilleSemaine } from "@/components/calendrier/GrilleSemaine";
import { CarteEntreeCalendrier, type EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import { PretAPartir } from "@/components/calendrier/PretAPartir";
import { controlerPretAPartir, premierManque, filtrerACompleter, type PublicationAControler } from "@/services/pret-a-partir";

const AUJ = "2026-11-11";
const carte = (o: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle: "a|linkedin", jour: AUJ, reseau: "linkedin", type: "video", etat: "brouillon", heure: "10:00", ...o });
const complete = (o: Partial<PublicationAControler> = {}): PublicationAControler => ({
  reseau: "linkedin", texte: "Un texte", hashtags: ["#a"], premierCommentaire: "Une question ?", media: { mime: "video/mp4", taille: 1000 }, instant: "2026-11-12T10:00:00+01:00", ...o,
});
const codes = (p: PublicationAControler, mots?: Parameters<typeof controlerPretAPartir>[1]) => controlerPretAPartir(p, mots).map((l) => l.code);

describe("CAL-08 · liste « Prêt à partir ? »", () => {
  it("une publication complète n'a aucun manque", () => expect(codes(complete())).toEqual([]));
  it("texte manquant, avec la phrase pour un contenu apporté à la main", () => {
    const l = controlerPretAPartir(complete({ texte: " ", typeContenu: "video" }));
    expect(l[0]?.code).toBe("texte");
    expect(l[0]?.message).toBe("Il manque le texte : décrivez la vidéo en une phrase, puis Proposer");
  });
  it.each(["linkedin", "instagram", "facebook", "tiktok"] as const)("hashtags manquants sur %s", (reseau) => {
    expect(codes(complete({ reseau, hashtags: [] }))).toContain("hashtags");
  });
  it("premier commentaire : manquant sur LinkedIn, jamais sur TikTok", () => {
    expect(codes(complete({ premierCommentaire: "" }))).toContain("premier-commentaire");
    expect(codes(complete({ reseau: "tiktok", premierCommentaire: "" }))).not.toContain("premier-commentaire");
  });
  it("Instagram : premier commentaire à poser à la main, avec Copier", () => {
    const l = controlerPretAPartir(complete({ reseau: "instagram" })).find((x) => x.code === "premier-commentaire");
    expect(l?.message).toContain("à la main");
    expect(l?.copier).toBe("Une question ?");
  });
  it("mot : à vérifier à la main tant que la lecture n'est pas fournie", () => {
    const l = controlerPretAPartir(complete({ motRequis: true, motAssocie: "GUIDE" })).find((x) => x.code === "mot");
    expect(l?.message).toBe("mot : à vérifier à la main");
  });
  it("mot absent, inactif, ou à répondre à la main", () => {
    expect(controlerPretAPartir(complete({ motRequis: true }), { mots: [] }).find((x) => x.code === "mot")?.message).toMatch(/mot à commenter/i);
    expect(controlerPretAPartir(complete({ motRequis: true, motAssocie: "GUIDE" }), { mots: [] }).find((x) => x.code === "mot")?.message).toBe("mot inactif sur ce réseau");
    const manuel = controlerPretAPartir(complete({ motRequis: true, motAssocie: "GUIDE" }), { mots: [{ mot: "GUIDE", reponse: "manuel" }] }).find((x) => x.code === "mot");
    expect(manuel?.message).toMatch(/à la main/);
    expect(codes(complete({ reseau: "instagram", motRequis: true, motAssocie: "GUIDE" }), { mots: [{ mot: "GUIDE", reponse: "auto" }] })).not.toContain("mot");
  });
  it("fichier absent ou format refusé", () => {
    expect(codes(complete({ media: null }))).toContain("fichier");
    expect(codes(complete({ media: { mime: "video/avi", taille: 10 } }))).toContain("fichier");
  });
  it("date et heure manquantes", () => expect(codes(complete({ instant: null }))).toContain("date"));
  it("jamais bloquant, aucun prix", () => {
    const l = controlerPretAPartir({ reseau: "linkedin" });
    expect(l.length).toBeGreaterThan(3);
    expect(l.every((x) => x.bloquant === false)).toBe(true);
    expect(JSON.stringify(l)).not.toMatch(/€|euro|prix/i);
  });
  it("premierManque et filtre À compléter", () => {
    expect(premierManque(complete({ texte: "" }))).toMatch(/texte/);
    expect(premierManque(complete())).toBeNull();
    const alertes = new Map([["a|linkedin", "Il manque le texte"]]);
    expect(filtrerACompleter([carte(), carte({ cle: "b|linkedin" })], alertes).map((e) => e.cle)).toEqual(["a|linkedin"]);
  });
  it("le composant liste ce qui manque par réseau, vouvoiement", () => {
    const html = renderToStaticMarkup(<PretAPartir publications={[complete({ reseau: "instagram", texte: "" })]} />);
    expect(html).toContain("Prêt à partir ?");
    expect(html).toContain("Instagram");
    expect(html).toContain("Il manque le texte");
    expect(html).toContain("Copier");
  });
  it("le composant dit que tout est prêt", () => {
    expect(renderToStaticMarkup(<PretAPartir publications={[complete()]} />)).toMatch(/Tout est prêt/);
  });
});

describe("CAL-08 · calendrier", () => {
  it("la carte porte au plus UNE icône d'alerte, l'infobulle dit le premier manque", () => {
    const html = renderToStaticMarkup(<CarteEntreeCalendrier entree={carte()} alerte="Il manque le texte" tropProche />);
    expect(html.match(/data-alerte-carte/g)?.length).toBe(1);
    expect(html).toContain('title="Il manque le texte"');
    expect(renderToStaticMarkup(<CarteEntreeCalendrier entree={carte()} />)).not.toContain("data-alerte-carte");
  });
  const grille = (extra = {}) => renderToStaticMarkup(
    <GrilleSemaine semaineDu={AUJ} aujourdhui={AUJ} reseaux={["linkedin"]} entrees={[carte(), carte({ cle: "b|linkedin", jour: "2026-11-12" })]} onAjouter={() => {}} attendu={(_r, j) => j === "2026-11-13"} {...extra} />,
  );
  it("case pointillée du couloir pour le jour qui manque", () => {
    const html = grille();
    expect(html).toMatch(/data-creneau-vide="linkedin\|2026-11-13"/);
    expect(html).toContain("border-dashed");
  });
  it("compteur du jour", () => {
    const html = grille({ alertes: new Map([["a|linkedin", "Il manque le texte"]]), manquesParJour: { [AUJ]: 2 } });
    expect(html).toMatch(/data-compteur-jour="2026-11-11"[^>]*>[^<]*2/);
    expect(html).not.toContain('data-compteur-jour="2026-11-12"');
  });
  it("filtre À compléter : seules les incomplètes", () => {
    const html = grille({ aCompleter: true, alertes: new Map([["a|linkedin", "Il manque le texte"]]) });
    expect(html).toContain('data-carte="a|linkedin"');
    expect(html).not.toContain('data-carte="b|linkedin"');
  });
  it("ajout manuel jamais bloqué : le « + » reste affiché malgré les alertes", () => {
    expect(grille({ alertes: new Map([["a|linkedin", "x"]]) })).toContain("Ajouter sur LinkedIn");
  });
});

describe("CAL-08 · garde-fous", () => {
  it.each(["src/services/pret-a-partir.ts", "src/components/calendrier/PretAPartir.tsx"])("%s : aucune couleur en dur, aucun fetch", (f) => {
    const s = readFileSync(join(__dirname, "../..", f), "utf-8");
    expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|fetch\(/);
  });
});
