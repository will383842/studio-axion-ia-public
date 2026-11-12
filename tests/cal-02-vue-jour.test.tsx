/**
 * CAL-02 : vue du jour (heure par heure) de /calendrier, avec la bascule Semaine | Mois.
 * Services doublés, données fictives, aucun réseau. « Aujourd'hui » est figé au mercredi 11 novembre 2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const listerCalendrier = vi.fn(async (_d: string, _f: string) => [] as unknown[]);
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: (d: string, f: string) => listerCalendrier(d, f), listerAProgrammer: async () => [] }));

const { default: Page } = await import("../src/app/(studio)/calendrier/page");

async function rendre(params: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
}

let n = 0;
function pub(date: string, reseau: string, texte: string, sur: Record<string, unknown> = {}) {
  n += 1;
  return { id: `p${n}`, reseau, statut: "programmee", via: "buffer", date, texte, videoId: `v${n}`, video: { titre: `Titre ${n}`, vignette: null, video: null }, ...sur };
}
const jourDe = (jour: string, publications: unknown[]) => [{ jour, publications }];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
  listerCalendrier.mockClear();
  n = 0;
});
afterEach(() => vi.useRealTimers());

describe("CAL-02 : ?vue=jour&date=…", () => {
  it("demande exactement la journée de Paris (bornes de minuit à minuit, heure d'hiver)", async () => {
    await rendre({ vue: "jour", date: "2026-11-11" });
    const [debut, fin] = listerCalendrier.mock.calls[0];
    expect(debut).toBe("2026-11-10T23:00:00.000Z");
    expect(fin).toBe("2026-11-11T22:59:59.999Z");
  });

  it("le jour du passage à l'heure d'hiver dure 25 h : la fin est le minuit suivant, heure de Paris", async () => {
    await rendre({ vue: "jour", date: "2026-10-25" });
    const [debut, fin] = listerCalendrier.mock.calls[0];
    expect(debut).toBe("2026-10-24T22:00:00.000Z");
    expect(fin).toBe("2026-10-25T22:59:59.999Z");
  });

  it("affiche les publications du jour triées par heure de Paris, quel que soit l'ordre reçu", async () => {
    const tard = pub("2026-11-11T16:00:00Z", "instagram", "Texte de l'après-midi"); // 17:00 Paris
    const tot = pub("2026-11-11T08:30:00Z", "linkedin", "Texte du matin"); // 09:30 Paris
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [tard, tot]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain("09:30");
    expect(h).toContain("17:00");
    expect(h.indexOf("Texte du matin")).toBeGreaterThan(-1);
    expect(h.indexOf("Texte du matin")).toBeLessThan(h.indexOf("Texte de l&#x27;après-midi"));
  });

  it("montre le début du texte, coupé s'il est long, et le titre du jour en toutes lettres", async () => {
    const long = `Deux entreprises, même métier. ${"mot ".repeat(80)}FIN-DU-TEXTE`;
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [pub("2026-11-11T09:00:00Z", "linkedin", long)]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain("Deux entreprises, même métier.");
    expect(h).not.toContain("FIN-DU-TEXTE");
    expect(h).toContain("…");
    expect(h).toMatch(/mercredi 11 novembre/i);
  });

  it("montre les créneaux libres : une heure sans publication est dite « Libre », une heure occupée non", async () => {
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [pub("2026-11-11T08:30:00Z", "linkedin", "Texte du matin")]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toMatch(/data-heure="10"[^>]*>(?:(?!<\/li>).)*Libre/s);
    expect(h).not.toMatch(/data-heure="09"[^>]*>(?:(?!<\/li>).)*Libre/s);
    expect(h).toContain('data-heure="08"');
    expect(h).toContain('data-heure="19"');
  });

  it("une publication hors des heures habituelles ouvre sa propre ligne (06:15 et 22:45)", async () => {
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [pub("2026-11-11T05:15:00Z", "facebook", "Très tôt"), pub("2026-11-11T21:45:00Z", "facebook", "Très tard")]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain('data-heure="06"');
    expect(h).toContain('data-heure="22"');
    expect(h).toContain("Très tôt");
    expect(h).toContain("Très tard");
  });

  it("limite exacte : 23:59 de Paris appartient au jour, minuit pile au jour suivant (même si le service le renvoie)", async () => {
    listerCalendrier.mockResolvedValueOnce([
      { jour: "2026-11-11", publications: [pub("2026-11-11T22:59:00Z", "linkedin", "Dernière minute du jour")] },
      { jour: "2026-11-12", publications: [pub("2026-11-11T23:00:00Z", "linkedin", "Premier instant du lendemain")] },
    ]);
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain("Dernière minute du jour");
    expect(h).toContain("23:59");
    expect(h).not.toContain("Premier instant du lendemain");
  });

  it("jour vide à venir : toutes les heures sont libres et la page le dit", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-20" });
    expect(h).toContain("Rien de prévu ce jour.");
    expect(h.match(/>Libre</g)?.length).toBeGreaterThanOrEqual(12);
  });

  it("jour passé vide : aucune invitation à y placer quoi que ce soit", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-02" });
    expect(h).toContain("Journée passée, rien n&#x27;avait été publié.");
    expect(h).not.toContain(">Libre<");
  });

  it("un essai n'est jamais montré comme programmé", async () => {
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [pub("2026-11-11T09:00:00Z", "linkedin", "Un essai", { via: "simulation" })]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain("Essai");
    expect(h).not.toContain("Programmé");
  });

  it("date absente, illisible ou inexistante : retombe sur aujourd'hui sans planter", async () => {
    for (const date of [undefined, "n'importe quoi", "2026-02-30", ""]) {
      listerCalendrier.mockClear();
      const h = await rendre(date === undefined ? { vue: "jour" } : { vue: "jour", date });
      expect(h).toMatch(/mercredi 11 novembre/i);
      expect(listerCalendrier.mock.calls[0][0]).toBe("2026-11-10T23:00:00.000Z");
    }
  });
});

describe("CAL-02 : filtres par réseau dans la vue du jour", () => {
  const deux = () => jourDe("2026-11-11", [pub("2026-11-11T09:00:00Z", "linkedin", "Texte LinkedIn"), pub("2026-11-11T10:00:00Z", "instagram", "Texte Instagram")]);

  it("sans filtre : tous les réseaux ; ?reseaux=linkedin : seul LinkedIn reste", async () => {
    listerCalendrier.mockResolvedValueOnce(deux());
    const tous = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(tous).toContain("Texte LinkedIn");
    expect(tous).toContain("Texte Instagram");
    listerCalendrier.mockResolvedValueOnce(deux());
    const un = await rendre({ vue: "jour", date: "2026-11-11", reseaux: "linkedin" });
    expect(un).toContain("Texte LinkedIn");
    expect(un).not.toContain("Texte Instagram");
  });

  it("valeur vide ou inconnue : aucun réseau affiché, dit en clair, pas de plantage", async () => {
    listerCalendrier.mockResolvedValueOnce(deux());
    const h = await rendre({ vue: "jour", date: "2026-11-11", reseaux: "" });
    expect(h).toContain("Aucun réseau affiché. Rallumez un réseau ci-dessus.");
    expect(h).not.toContain("Texte LinkedIn");
    listerCalendrier.mockResolvedValueOnce(deux());
    expect(await rendre({ vue: "jour", date: "2026-11-11", reseaux: "myspace" })).toContain("Aucun réseau affiché.");
  });

  it("les pastilles allument et éteignent un réseau en gardant la date", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-11", reseaux: "linkedin,instagram" });
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-11&amp;reseaux=linkedin"'); // éteindre Instagram
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-11&amp;reseaux=linkedin,instagram,facebook"'); // allumer Facebook
  });
});

describe("CAL-02 : bascule Semaine | Mois", () => {
  it("garde la date et les filtres ; « Semaine » reste enfoncé dans la vue du jour", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-11", reseaux: "linkedin,tiktok" });
    expect(h).toContain('href="/calendrier?vue=semaine&amp;date=2026-11-11&amp;reseaux=linkedin,tiktok"');
    expect(h).toContain('href="/calendrier?vue=mois&amp;date=2026-11-11&amp;reseaux=linkedin,tiktok"');
    expect(h).toMatch(/aria-label="Afficher la semaine" aria-current="true"/);
  });

  it("deux boutons seulement : pas de troisième bouton « Jour »", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).not.toMatch(/>Jour</);
    expect(h).not.toContain("Afficher le jour");
    expect(h).toContain(">Semaine<");
    expect(h).toContain(">Mois<");
  });

  it("flèches jour précédent / suivant et « Aujourd'hui » gardent la vue du jour et les filtres", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-30", reseaux: "linkedin" });
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-29&amp;reseaux=linkedin"');
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-12-01&amp;reseaux=linkedin"');
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-11&amp;reseaux=linkedin"');
  });

  it("un lien « Retour à la semaine » ramène à la semaine de ce jour", async () => {
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).toContain("Retour à la semaine");
  });

  it("depuis la semaine et le mois, la bascule garde la date demandée", async () => {
    const s = await rendre({ vue: "semaine", date: "2026-12-09" });
    expect(s).toContain('href="/calendrier?vue=mois&amp;date=2026-12-09"');
    const m = await rendre({ vue: "mois", date: "2026-12" });
    expect(m).toContain('href="/calendrier?vue=semaine&amp;date=2026-12-01"');
  });

  it("la vue Jour s'ouvre par un clic sur un jour du mois", async () => {
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-12-10", [pub("2026-12-10T09:00:00Z", "linkedin", "Texte")]));
    const h = await rendre({ vue: "mois", date: "2026-12" });
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-12-10"');
  });

  it("la vue Jour s'ouvre aussi depuis la liste de la semaine (mobile)", async () => {
    const h = await rendre({ vue: "semaine", date: "2026-11-11" });
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-11"');
  });

  it("rien n'est retiré : ?semaine=N et la semaine par défaut fonctionnent toujours", async () => {
    const h = await rendre({ semaine: "1" });
    expect(h).toContain("Semaine prochaine");
    expect(h).toContain("/calendrier?semaine=2");
  });
});

describe("CAL-02 : textes", () => {
  it("vouvoiement, aucun prix, aucun mot de message automatique", async () => {
    listerCalendrier.mockResolvedValueOnce(jourDe("2026-11-11", [pub("2026-11-11T09:00:00Z", "linkedin", "Texte")]));
    const h = await rendre({ vue: "jour", date: "2026-11-11" });
    expect(h).not.toMatch(/€|\$|\bprix\b|\btarif\b/i);
    expect(h).not.toMatch(/message automatique/i);
  });
});
