/**
 * CAL-12b : mode Agenda sur téléphone, la semaine en liste jour par jour. Sans DOM (pas de jsdom) : on lit le rendu
 * serveur et on pilote les crochets factices. Données fictives. Le défilement horizontal ne se mesure pas sans
 * navigateur : on vérifie les classes qui l'empêchent (pas de largeur fixe, conteneur qui rétrécit et coupe).
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({
  decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })),
}));

const { monter, trouver } = await import("../aides/crochets-factices");
const { VueAgenda } = await import("@/components/calendrier/VueAgenda");
const { CarteEntreeCalendrier } = await import("@/components/calendrier/CarteEntreeCalendrier");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");
type Entree = import("@/components/calendrier/apercu-reseau").EntreeApercu;

const AUJOURDHUI = "2026-11-11"; // mercredi ; semaine du 9 au 15 novembre
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const entree = (sur: Partial<Entree> = {}): Entree => ({
  cle: "creneau:c1|linkedin",
  jour: "2026-11-12",
  reseau: "linkedin",
  type: "video",
  etat: "a_valider",
  heure: "09:00",
  titre: "Le devis qui part tout seul",
  texte: "Trois e-mails sur quatre se trient sans vous.",
  ...sur,
});
const liste = (): Entree[] => [
  entree(),
  entree({ cle: "creneau:c2|instagram", reseau: "instagram", jour: "2026-11-12", heure: "08:00", type: "image", etat: "brouillon", titre: "Image du matin" }),
  entree({ cle: "creneau:c3|tiktok", reseau: "tiktok", jour: "2026-11-14", heure: "18:30", titre: "Court du samedi" }),
];
const props = (sur: Record<string, unknown> = {}) => ({ entrees: liste(), semaineDu: AUJOURDHUI, aujourdhui: AUJOURDHUI, ...sur });

describe("VueAgenda : une liste jour par jour, sans défilement horizontal", () => {
  it("montre les sept jours de la semaine, lundi d'abord, chacun avec son nom en titre", () => {
    const h = rendre(<VueAgenda {...props()} />);
    for (const j of ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]) {
      expect(h).toContain(`data-jour="${j}"`);
    }
    expect(h.indexOf('data-jour="2026-11-09"')).toBeLessThan(h.indexOf('data-jour="2026-11-15"'));
    expect(h).toContain("lundi 9 novembre");
    expect(h).toContain("dimanche 15 novembre");
  });

  it("marque aujourd'hui (aria-current) et lui seul", () => {
    const h = rendre(<VueAgenda {...props()} />);
    expect(h.match(/aria-current="date"/g)).toHaveLength(1);
    expect(h).toMatch(/data-jour="2026-11-11"[^>]*aria-current="date"|aria-current="date"[^>]*data-jour="2026-11-11"/);
  });

  it("classe les publications d'un jour par heure et les met dans le bon jour", () => {
    const h = rendre(<VueAgenda {...props()} />);
    const jeudi = h.slice(h.indexOf('data-jour="2026-11-12"'), h.indexOf('data-jour="2026-11-13"'));
    expect(jeudi.indexOf("creneau:c2|instagram")).toBeGreaterThan(-1);
    expect(jeudi.indexOf("creneau:c2|instagram")).toBeLessThan(jeudi.indexOf("creneau:c1|linkedin"));
    expect(jeudi).not.toContain("creneau:c3|tiktok");
    expect(h.slice(h.indexOf('data-jour="2026-11-14"'))).toContain("creneau:c3|tiktok");
  });

  it("ne crée aucun défilement horizontal : conteneur qui rétrécit et coupe, aucune largeur fixe", () => {
    const h = rendre(<VueAgenda {...props()} />);
    expect(h).toMatch(/class="[^"]*\bw-full\b[^"]*\bmin-w-0\b|class="[^"]*\bmin-w-0\b[^"]*\bw-full\b/);
    expect(h).toContain("overflow-x-hidden");
    expect(h).not.toMatch(/\b(min-)?w-\[\d+px\]/);
    expect(h).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(h).toContain("break-words");
  });

  it("n'emploie aucune couleur hors du thème", () => {
    const h = rendre(<VueAgenda {...props()} />);
    expect(h).not.toMatch(/\b(bg|text|border)-(black|white)\b|#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });

  it("donne aux boutons au moins 38 px de haut", () => {
    const cartes = trouver(monter(VueAgenda, props()).rendre(), (e) => e.type === CarteEntreeCalendrier);
    expect(cartes).toHaveLength(3);
    for (const c of cartes) expect(String(c.props.className)).toContain("min-h-[38px]");
    // Une carte à gestes est rendue en <button> : la classe passée arrive jusqu'au bouton.
    const h = rendre(<VueAgenda {...props()} />);
    expect(h.match(/<button[^>]*min-h-\[38px\]/g)).toHaveLength(3);
  });
});

describe("VueAgenda : un jour sans publication", () => {
  it("le dit en une phrase, en vouvoyant, avec l'état du jour (à venir ou passé)", () => {
    const h = rendre(<VueAgenda {...props()} />);
    const lundi = h.slice(h.indexOf('data-jour="2026-11-09"'), h.indexOf('data-jour="2026-11-10"'));
    const dimanche = h.slice(h.indexOf('data-jour="2026-11-15"'));
    expect(lundi).toContain("Vous n&#x27;aviez rien prévu ce jour-là.");
    expect(dimanche).toContain("Vous n&#x27;avez rien de prévu ce jour.");
    for (const phrase of [lundi, dimanche]) expect(phrase).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
  });

  it("un jour avec publications ne dit pas qu'il est vide", () => {
    const h = rendre(<VueAgenda {...props()} />);
    const jeudi = h.slice(h.indexOf('data-jour="2026-11-12"'), h.indexOf('data-jour="2026-11-13"'));
    expect(jeudi).not.toContain("rien");
  });

  it("une semaine entière sans publication : sept phrases, aucun bouton", () => {
    const m = monter(VueAgenda, props({ entrees: [] }));
    const arbre = m.rendre();
    expect(trouver(arbre, (e) => e.type === CarteEntreeCalendrier)).toHaveLength(0);
    expect(rendre(<VueAgenda {...props({ entrees: [] })} />).match(/rien /gi)).toHaveLength(7);
  });

  it("un filtre qui masque tout laisse les jours dits sans publication, sans rien cacher d'autre", () => {
    const h = rendre(<VueAgenda {...props({ criteres: { reseaux: [], types: [], etats: [] } })} />);
    expect(h).not.toContain("data-carte");
    expect(h.match(/rien /gi)).toHaveLength(7);
  });

  it("jour illisible : la semaine d'aujourd'hui ; aujourd'hui illisible aussi : une phrase, pas d'erreur", () => {
    expect(rendre(<VueAgenda {...props({ semaineDu: "pas-un-jour" })} />)).toContain('data-jour="2026-11-11"');
    const h = rendre(<VueAgenda {...props({ semaineDu: "x", aujourdhui: "y" })} />);
    expect(h).toContain("Semaine illisible");
    expect(h).not.toContain("data-jour");
  });

  it("une entrée à la limite de la semaine (lundi et dimanche) est montrée, celle de la semaine suivante non", () => {
    const h = rendre(
      <VueAgenda
        {...props({
          entrees: [
            entree({ cle: "creneau:a|linkedin", jour: "2026-11-09" }),
            entree({ cle: "creneau:b|linkedin", jour: "2026-11-15" }),
            entree({ cle: "creneau:c|linkedin", jour: "2026-11-16" }),
          ],
        })}
      />,
    );
    expect(h).toContain("creneau:a|linkedin");
    expect(h).toContain("creneau:b|linkedin");
    expect(h).not.toContain("creneau:c|linkedin");
  });
});

describe("VueAgenda : un appui ouvre le tiroir de CAL-12", () => {
  it("fermé d'abord ; un appui sur une publication monte ApercuPublication pour CETTE entrée", () => {
    const m = monter(VueAgenda, props());
    const avant = m.rendre();
    expect(trouver(avant, (e) => e.type === ApercuPublication)).toHaveLength(0);
    const carte = trouver(avant, (e) => e.type === CarteEntreeCalendrier && (e.props.entree as Entree).cle === "creneau:c3|tiktok")[0];
    (carte.props.onOuvrir as (x: Entree) => void)(carte.props.entree as Entree);
    const ouvert = trouver(m.rendre(), (e) => e.type === ApercuPublication);
    expect(ouvert).toHaveLength(1);
    expect((ouvert[0].props.entree as Entree).cle).toBe("creneau:c3|tiktok");
    expect(ouvert[0].props.aujourdhui).toBe(AUJOURDHUI);
  });

  it("le tiroir se ferme, et Suivante / Précédente parcourent l'ordre de la liste filtrée", () => {
    const m = monter(VueAgenda, props({ criteres: { types: [], etats: [], reseaux: ["linkedin", "tiktok"] } }));
    const ouvrir = (cle: string) => {
      const c = trouver(m.rendre(), (e) => e.type === CarteEntreeCalendrier && (e.props.entree as Entree).cle === cle)[0];
      (c.props.onOuvrir as (x: Entree) => void)(c.props.entree as Entree);
    };
    ouvrir("creneau:c1|linkedin");
    const panneau = () => trouver(m.rendre(), (e) => e.type === ApercuPublication)[0];
    (panneau().props.onSuivante as () => void)();
    expect((panneau().props.entree as Entree).cle).toBe("creneau:c3|tiktok");
    (panneau().props.onPrecedente as () => void)();
    expect((panneau().props.entree as Entree).cle).toBe("creneau:c1|linkedin");
    (panneau().props.onFermer as () => void)();
    expect(trouver(m.rendre(), (e) => e.type === ApercuPublication)).toHaveLength(0);
  });

  it("changer la date sans action fournie donne une phrase claire, et ne déplace rien", () => {
    const m = monter(VueAgenda, props());
    (() => {
      const c = trouver(m.rendre(), (e) => e.type === CarteEntreeCalendrier)[0];
      (c.props.onOuvrir as (x: Entree) => void)(c.props.entree as Entree);
    })();
    (trouver(m.rendre(), (e) => e.type === ApercuPublication)[0].props.onChangerDate as (j: string) => void)("2026-11-13");
    const p = trouver(m.rendre(), (e) => e.type === ApercuPublication)[0];
    expect(String(p.props.message)).toContain("vue Semaine");
    expect((p.props.entree as Entree).jour).toBe("2026-11-12");
  });

  it("avec une action fournie, la date choisie lui est transmise avec l'entrée", () => {
    const onChangerDate = vi.fn();
    const m = monter(VueAgenda, props({ onChangerDate }));
    (() => {
      const c = trouver(m.rendre(), (e) => e.type === CarteEntreeCalendrier)[0];
      (c.props.onOuvrir as (x: Entree) => void)(c.props.entree as Entree);
    })();
    (trouver(m.rendre(), (e) => e.type === ApercuPublication)[0].props.onChangerDate as (j: string) => void)("2026-11-13");
    expect(onChangerDate).toHaveBeenCalledWith("2026-11-13", expect.objectContaining({ jour: "2026-11-12" }));
  });
});
