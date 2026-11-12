/**
 * CAL-05 : vue Mois. Le 1er sous le bon jour, six rangées, jours de Paris, clic vers la vue Jour, un repère par réseau.
 * Rendu serveur seulement, données fictives, aucun appel réel.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrilleMois } from "@/components/calendrier/GrilleMois";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import { adresseVueJour, plageMois } from "@/lib/calendrier-plages";
import { cleJour as jourDeParis } from "@/lib/dates"; // doublon retiré : le jour de Paris vient de cleJour

const AUJOURDHUI = "2026-11-11";
const rendre = (mois: string, entrees: EntreeCarte[] = [], extra: Partial<Parameters<typeof GrilleMois>[0]> = {}) =>
  renderToStaticMarkup(<GrilleMois mois={mois} aujourdhui={AUJOURDHUI} entrees={entrees} {...extra} />);
const compter = (html: string, motif: string) => html.split(motif).length - 1;

let n = 0;
function carte(p: Partial<EntreeCarte> = {}): EntreeCarte {
  n += 1;
  return { cle: `publication:cal05-${n}`, jour: AUJOURDHUI, reseau: "linkedin", type: "video", etat: "programme", heure: "09:00", titre: "Titre fictif", ...p };
}

/** Les jours d'une rangée, dans l'ordre d'affichage. */
function rangee(html: string, lundi: string): string[] {
  const debut = html.indexOf(`data-semaine="${lundi}"`);
  const fin = html.indexOf('data-semaine="', debut + 1);
  const morceau = html.slice(debut, fin === -1 ? undefined : fin);
  return [...morceau.matchAll(/data-jour="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]!);
}

describe("CAL-05 : le 1er du mois sous le bon jour, toujours 6 rangées", () => {
  it("novembre 2026 : le 1er est un dimanche, donc la 7e case de la première rangée (qui part du lundi 26 octobre)", () => {
    const html = rendre("2026-11");
    expect(compter(html, 'data-semaine="')).toBe(6);
    expect(compter(html, 'data-jour="')).toBe(42);
    const premiere = rangee(html, "2026-10-26");
    expect(premiere).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(premiere.indexOf("2026-11-01")).toBe(6);
  });

  it("février 2027 : le 1er est un lundi, donc la 1re case ; six rangées quand même (les deux dernières sont de mars)", () => {
    const html = rendre("2027-02");
    expect(compter(html, 'data-semaine="')).toBe(6);
    expect(compter(html, 'data-jour="')).toBe(42);
    expect(rangee(html, "2027-02-01")[0]).toBe("2027-02-01");
    expect(html).toContain('data-jour="2027-03-14"');
    const plage = plageMois("2027-02-15");
    expect(plage.semaines).toHaveLength(6);
    expect(plage.semaines.every((s) => s.length === 7)).toBe(true);
    expect(plage.semaines[0]![0]).toBe("2027-02-01");
  });

  it("chaque 1er de 2026 et 2027 tombe sous la bonne colonne (lundi = 0), sans jamais manquer de rangée", () => {
    const attendu = (jour: string) => (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7;
    for (let a = 2026; a <= 2027; a++) {
      for (let m = 1; m <= 12; m++) {
        const mois = `${a}-${String(m).padStart(2, "0")}`;
        const plage = plageMois(`${mois}-01`);
        expect(plage.semaines).toHaveLength(6);
        expect(plage.jours.indexOf(`${mois}-01`)).toBe(attendu(`${mois}-01`));
      }
    }
  });
});

describe("CAL-05 : les jours sont ceux de Paris", () => {
  it("une publication du 30 novembre à 23 h 30 (Paris) reste le 30 ; à 0 h 30 elle est le 1er décembre", () => {
    expect(jourDeParis("2026-11-30T22:30:00.000Z")).toBe("2026-11-30"); // 23 h 30 à Paris (hiver, UTC+1)
    expect(jourDeParis("2026-11-30T23:30:00.000Z")).toBe("2026-12-01"); // 0 h 30 à Paris
    expect(jourDeParis("2026-06-30T21:30:00.000Z")).toBe("2026-06-30"); // 23 h 30 à Paris (été, UTC+2)
    expect(jourDeParis("2026-06-30T22:30:00.000Z")).toBe("2026-07-01");
  });

  it("limites : minuit pile, changements d'heure, jour de 25 h", () => {
    expect(jourDeParis("2026-11-29T23:00:00.000Z")).toBe("2026-11-30"); // minuit pile à Paris
    expect(jourDeParis("2026-11-29T22:59:59.999Z")).toBe("2026-11-29");
    expect(jourDeParis("2026-10-25T22:30:00.000Z")).toBe("2026-10-25"); // jour de 25 h : 23 h 30 à Paris
    expect(jourDeParis("2027-03-27T23:30:00.000Z")).toBe("2027-03-28"); // veille du saut de printemps
  });

  it("dans la grille, la publication de 23 h 30 compte dans le 30 et pas dans le 1er décembre", () => {
    const html = rendre("2026-11", [carte({ jour: jourDeParis("2026-11-30T22:30:00.000Z")!, reseau: "instagram" })]);
    expect(html).toContain('aria-label="lundi 30 novembre, 1 publication : Instagram 1"');
    expect(html).toContain('aria-label="mardi 1 décembre, 0 publication"');
  });
});

describe("CAL-05 : un clic sur un jour ouvre la vue Jour de ce jour ; un repère par réseau", () => {
  it("l'adresse du jour est celle de la vue Jour (jamais la semaine), filtres gardés", () => {
    expect(adresseVueJour("2026-11-30")).toBe("/calendrier?vue=jour&date=2026-11-30");
    expect(adresseVueJour("2026-11-30", "&reseaux=linkedin")).toBe("/calendrier?vue=jour&date=2026-11-30&reseaux=linkedin");
  });

  it("chaque case du mois, y compris un jour du mois voisin, mène à sa propre vue Jour", () => {
    const html = rendre("2026-11", [], { lienJour: (j) => adresseVueJour(j) });
    expect(compter(html, "<a ")).toBe(42);
    expect(html).toContain('href="/calendrier?vue=jour&amp;date=2026-11-11"');
    expect(html).toContain('href="/calendrier?vue=jour&amp;date=2026-12-03"');
    expect(html).not.toContain("vue=semaine");
  });

  it("un jour avec une publication par réseau montre quatre repères, un par réseau, avec nom et nombre", () => {
    const entrees = (["linkedin", "instagram", "facebook", "tiktok"] as const).map((reseau) => carte({ reseau }));
    const html = rendre("2026-11", entrees);
    for (const [reseau, nom] of [["linkedin", "LinkedIn"], ["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]] as const) {
      expect(html).toContain(`data-reseau="${reseau}"`);
      expect(html).toContain(`title="${nom} : 1"`);
    }
    expect(html).toContain('aria-label="mercredi 11 novembre, 4 publications : LinkedIn 1, Instagram 1, Facebook 1, TikTok 1"');
  });
});
