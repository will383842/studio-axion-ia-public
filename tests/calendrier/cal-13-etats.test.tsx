/** CAL-13 : états du calendrier (chargement, erreur, hors ligne, vide, filtre vide, semaine passée, envoi éteint). Aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { default: Chargement } = await import("../../src/app/(studio)/calendrier/loading");
const { default: Erreur } = await import("../../src/app/(studio)/calendrier/error");
const { VueVide, ETATS_VIDES } = await import("@/components/calendrier/VueVide");
const { BandeauHorsLigne, BandeauEnvoiEteint } = await import("@/components/calendrier/BandeauHorsLigne");

const TEXTE_VIDE = "Votre calendrier est vide. Cliquez sur + Ajouter, choisissez le réseau, joignez la vidéo, validez : elle partira seule à l'heure choisie.";
const html = (n: React.ReactElement) => renderToStaticMarkup(n).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("CAL-13 : calendrier vide", () => {
  it("dit la phrase exacte de la maquette et propose + Ajouter", () => {
    const h = html(<VueVide etat="vide" lienAjouter="/calendrier?vue=jour" />);
    expect(h).toContain(TEXTE_VIDE);
    expect(h).toContain('href="/calendrier?vue=jour"');
  });
});

describe("CAL-13 : filtre vide et semaine passée", () => {
  it("filtre vide : dit qu'aucune publication ne correspond et offre « Tout afficher »", () => {
    const h = html(<VueVide etat="filtre-vide" lienTout="/calendrier" />);
    expect(h).toContain("Aucune publication ne correspond à ce filtre.");
    expect(h).toContain('href="/calendrier"');
    expect(h).not.toContain(TEXTE_VIDE);
  });
  it("semaine passée : dit qu'elle est passée, renvoie à aujourd'hui et n'invite pas à ajouter", () => {
    const h = html(<VueVide etat="semaine-passee" lienAujourdhui="/calendrier?date=2026-11-13" lienAjouter="/ajout" />);
    expect(h).toContain("Cette semaine est passée : rien n'y est planifié.");
    expect(h).toContain("Revenir à aujourd'hui");
    expect(h).not.toContain("/ajout");
  });
  it("les trois états vides se distinguent (marqueur et texte propres)", () => {
    const rendus = ETATS_VIDES.map((e) => html(<VueVide etat={e} lienAjouter="/a" lienTout="/t" lienAujourdhui="/j" />));
    expect(new Set(ETATS_VIDES.map((e) => rendus[ETATS_VIDES.indexOf(e)].match(/data-etat="([^"]+)"/)?.[1])).size).toBe(3);
    expect(new Set(rendus).size).toBe(3);
  });
});

describe("CAL-13 : chargement et erreur", () => {
  it("chargement : zone annoncée « Chargement du calendrier… »", () => {
    const h = html(<Chargement />);
    expect(h).toContain('role="status"');
    expect(h).toContain("Chargement du calendrier…");
    expect(h).toContain('data-etat="chargement"');
  });
  it("erreur : phrase claire, rien de perdu, bouton Réessayer sans détail technique", () => {
    const retry = vi.fn();
    const h = html(<Erreur error={Object.assign(new Error("SQL secret boom"), { digest: "d1" })} retry={retry} />);
    expect(h).toContain("Le calendrier n'a pas pu s'afficher");
    expect(h).toContain("Rien n'est perdu");
    expect(h).toContain("Réessayer");
    expect(h).toContain('data-etat="erreur"');
    expect(h).not.toContain("SQL secret boom");
  });
});

describe("CAL-13 : hors ligne", () => {
  it("hors ligne : bandeau annoncé qui dit qu'aucun geste n'est enregistré en silence", () => {
    const h = html(<BandeauHorsLigne enLigne={false} />);
    expect(h).toContain('role="status"');
    expect(h).toContain('data-etat="hors-ligne"');
    expect(h).toContain("Vous êtes hors ligne");
    expect(h).toContain("ne sont pas enregistrés");
  });
  it("en ligne : aucun bandeau", () => {
    expect(html(<BandeauHorsLigne enLigne />)).toBe("");
  });
});

describe("CAL-13 : envoi automatique éteint", () => {
  it("éteint : bandeau avec la phrase de la maquette et le lien vers calendrier/securite", () => {
    const h = html(<BandeauEnvoiEteint eteint />);
    expect(h).toContain("L'envoi automatique est éteint : rien ne partira.");
    expect(h).toContain(">Allumer</a>");
    expect(h).toContain('href="/calendrier/securite"');
  });
  it("allumé : aucun bandeau", () => {
    expect(html(<BandeauEnvoiEteint eteint={false} />)).toBe("");
  });
});

describe("CAL-13 : les six états se distinguent", () => {
  it("chargement, erreur, hors ligne, vide, filtre vide, semaine passée : six marqueurs différents", () => {
    const marques = [
      html(<Chargement />),
      html(<Erreur error={new Error("x")} retry={() => {}} />),
      html(<BandeauHorsLigne enLigne={false} />),
      html(<VueVide etat="vide" />),
      html(<VueVide etat="filtre-vide" />),
      html(<VueVide etat="semaine-passee" />),
    ].map((h) => h.match(/data-etat="([^"]+)"/)?.[1]);
    expect(new Set(marques).size).toBe(6);
  });
  it("aucun prix ni symbole monétaire dans ces écrans", () => {
    const tout = [html(<Chargement />), html(<VueVide etat="vide" />), html(<BandeauHorsLigne enLigne={false} />), html(<BandeauEnvoiEteint eteint />)].join("");
    expect(tout).not.toMatch(/[€$]|\bEUR\b/);
  });
});
