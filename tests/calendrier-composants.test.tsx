/**
 * Composants du calendrier (L4-03) : grilles semaine et mois, carte, pastille de statut, barre de vue, barre de
 * filtres, alerte de proximité. Rendu serveur seulement (renderToStaticMarkup), données fictives, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlerteProximite, JOURS_PROXIMITE, SEUIL_PROXIMITE, clesTropProches, pairesTropProches } from "@/components/calendrier/AlerteProximite";
import { BarreFiltres, RESEAUX_CALENDRIER, basculerReseau, filtrerParReseau } from "@/components/calendrier/BarreFiltres";
import { BarreVue, libellePeriode } from "@/components/calendrier/BarreVue";
import { CarteEntreeCalendrier, RepereReseau, TYPES_CONTENU, cartesDepuisEntrees, estVerrouillee, styleReseau, type EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import { GrilleMois } from "@/components/calendrier/GrilleMois";
import { GrilleSemaine } from "@/components/calendrier/GrilleSemaine";
import { ETATS_CALENDRIER, LIBELLES_ETAT, PastilleStatutPlan, STATUTS_VERS_ETAT, etatDepuisStatut, statutConnu } from "@/components/calendrier/PastilleStatutPlan";
import type { EntreeCalendrier } from "@/domaine/calendrier";
import { STATUTS_PLAN } from "@/domaine/plan-editorial/statuts";
import { empreinte } from "@/domaine/proximite/empreinte";
import { scoreProximite } from "@/domaine/proximite/score";

const AUJOURDHUI = "2026-11-11"; // mercredi
const rendre = (el: ReactElement) => renderToStaticMarkup(el);
const compter = (html: string, motif: string) => html.split(motif).length - 1;

/** Ce qu'une personne lit ou entend : textes, aria-label et title (ni classes ni attributs techniques). */
function lisible(html: string): string {
  const attributs = [...html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  return [html.replace(/<[^>]*>/g, " "), ...attributs].join(" ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

/** Aplatit l'arbre React (les composants sans crochet sont déroulés) pour atteindre les gestionnaires de clic. */
function noeuds(n: ReactNode, acc: ReactElement<Record<string, unknown>>[] = []): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(n)) {
    for (const x of n) noeuds(x, acc);
    return acc;
  }
  if (!isValidElement(n)) return acc;
  const el = n as ReactElement<Record<string, unknown>>;
  if (typeof el.type === "function") {
    try {
      return noeuds((el.type as (p: unknown) => ReactNode)(el.props), acc);
    } catch {
      /* composant à crochets (lien) : gardé tel quel */
    }
  }
  acc.push(el);
  noeuds(el.props.children as ReactNode, acc);
  return acc;
}

function cliquer(el: ReactElement, libelle: string): void {
  const cible = noeuds(el).find((n) => typeof n.props.onClick === "function" && n.props["aria-label"] === libelle);
  if (!cible) throw new Error(`Aucun élément cliquable « ${libelle} ».`);
  (cible.props.onClick as () => void)();
}

let n = 0;
function carte(p: Partial<EntreeCarte> = {}): EntreeCarte {
  n += 1;
  return { cle: `publication:p${n}`, jour: AUJOURDHUI, reseau: "linkedin", type: "video", etat: "programme", heure: "09:00", titre: "Votre première automatisation en quarante-cinq minutes.", ...p };
}

describe("PastilleStatutPlan", () => {
  it("affiche le libellé de la maquette pour chaque état", () => {
    const attendus = { brouillon: "Brouillon", a_valider: "À valider", programme: "Programmé", publie: "Publié", a_corriger: "À corriger", idee: "Idée de l'IA" };
    expect([...ETATS_CALENDRIER].sort()).toEqual(Object.keys(attendus).sort());
    for (const etat of ETATS_CALENDRIER) {
      expect(LIBELLES_ETAT[etat].libelle).toBe(attendus[etat]);
      expect(lisible(rendre(<PastilleStatutPlan etat={etat} />))).toContain(attendus[etat]);
    }
  });

  it("chaque état a un ton distinct de la maquette (jamais la couleur d'un réseau)", () => {
    expect(LIBELLES_ETAT.brouillon.ton).toBe("neutre");
    expect(LIBELLES_ETAT.a_valider.ton).toBe("ambre");
    expect(LIBELLES_ETAT.programme.ton).toBe("sauge");
    expect(LIBELLES_ETAT.publie.ton).toBe("contour");
    expect(LIBELLES_ETAT.a_corriger.ton).toBe("brique");
    expect(LIBELLES_ETAT.idee.ton).toBe("pointille");
    expect(rendre(<PastilleStatutPlan etat="programme" />)).not.toContain("--res-");
  });

  it("traduit chaque statut du plan et chaque statut de publication, sans jamais montrer le mot interne", () => {
    expect(etatDepuisStatut("propose")).toBe("idee");
    expect(etatDepuisStatut("a_valider")).toBe("a_valider");
    expect(etatDepuisStatut("valide")).toBe("brouillon");
    expect(etatDepuisStatut("programme")).toBe("programme");
    expect(etatDepuisStatut("publie")).toBe("publie");
    expect(etatDepuisStatut("echec")).toBe("a_corriger");
    expect(etatDepuisStatut("archive")).toBeNull();
    expect(etatDepuisStatut("brouillon")).toBe("brouillon");
    expect(etatDepuisStatut("programmee")).toBe("programme");
    expect(etatDepuisStatut("publiee")).toBe("publie");
    for (const s of STATUTS_PLAN) {
      const etat = etatDepuisStatut(s);
      if (s === "archive") continue;
      expect(ETATS_CALENDRIER).toContain(etat);
    }
    for (const etat of ETATS_CALENDRIER) expect(etatDepuisStatut(etat)).toBe(etat);
  });

  it("statut vide : « Brouillon » (rien n'est décidé), jamais d'erreur", () => {
    for (const s of ["", "   ", undefined, null]) expect(etatDepuisStatut(s)).toBe("brouillon");
  });

  it("statut inconnu : jamais « Brouillon » en silence (écarté et signalé), y compris les propriétés de l'objet", () => {
    for (const s of ["n'importe quoi", "refusee", "manquee", "constructor", "__proto__", "toString"]) {
      expect(etatDepuisStatut(s)).toBeNull();
      expect(statutConnu(s)).toBe(false);
    }
    expect(statutConnu("")).toBe(true);
    expect(statutConnu("archive")).toBe(true);
    expect(statutConnu(" publie ")).toBe(true);
  });

  it("la table des statuts peut être fournie de l'extérieur (CAL-10) et remplace la table par défaut", () => {
    const table = { ...STATUTS_VERS_ETAT, refusee: "refusee", manquee: "manquee", archive: null };
    expect(etatDepuisStatut("refusee", table)).toBe("refusee");
    expect(etatDepuisStatut("refusee")).toBeNull();
    expect(etatDepuisStatut("programme", { programme: "publie" })).toBe("publie");
    expect(etatDepuisStatut("publie", { programme: "publie" })).toBeNull();
    expect(statutConnu("manquee", table)).toBe(true);
  });

  it("la table des libellés peut être fournie de l'extérieur ; un état sans libellé se dit « État à vérifier », jamais « Brouillon »", () => {
    const libelles = { refusee: { libelle: "Refusée", ton: "brique" }, publie: { libelle: "Publiée", ton: "sauge" } } as const;
    expect(lisible(rendre(<PastilleStatutPlan etat="refusee" libelles={libelles} />))).toContain("Refusée");
    expect(lisible(rendre(<PastilleStatutPlan etat="publie" libelles={libelles} />))).toContain("Publiée");
    expect(lisible(rendre(<PastilleStatutPlan etat="programme" libelles={libelles} />))).toContain("Programmé");
    for (const html of [rendre(<PastilleStatutPlan etat="refusee" />), rendre(<PastilleStatutPlan etat="constructor" libelles={libelles} />)]) {
      expect(lisible(html)).toContain("État à vérifier");
      expect(lisible(html)).not.toContain("Brouillon");
    }
    const carteRefusee = carte({ etat: "refusee" });
    expect(rendre(<CarteEntreeCalendrier entree={carteRefusee} libellesEtat={libelles} />)).toContain('aria-label="LinkedIn, Vidéo, 09:00, Refusée"');
    const grille = rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={[carteRefusee]} libellesEtat={libelles} />);
    expect(lisible(grille)).toContain("Refusée");
    expect(lisible(grille)).not.toContain("État à vérifier");
  });
});

describe("CarteEntreeCalendrier", () => {
  it("montre le réseau (picto et nom), l'heure, le type (icône et libellé) et l'état", () => {
    const html = rendre(<CarteEntreeCalendrier entree={carte({ reseau: "instagram", type: "carrousel", heure: "16:15", etat: "a_valider" })} />);
    expect(html).toContain('aria-label="Instagram, Carrousel, 16:15, À valider"');
    expect(html).toContain(">IG<");
    expect(html).toContain("16:15");
    expect(html).toContain("Carrousel");
    expect(html).toContain("<svg");
    expect(html).toContain("À valider");
  });

  it("chaque type a un libellé et une icône qui lui sont propres", () => {
    expect(Object.keys(TYPES_CONTENU).sort()).toEqual(["carrousel", "image", "infographie", "video"]);
    expect(new Set(Object.values(TYPES_CONTENU).map((t) => t.libelle)).size).toBe(4);
    expect(new Set(Object.values(TYPES_CONTENU).map((t) => t.icone)).size).toBe(4);
    expect(TYPES_CONTENU.video.libelle).toBe("Vidéo");
    expect(TYPES_CONTENU.infographie.libelle).toBe("Infographie");
  });

  it("le titre n'apparaît que sur demande ; une heure vide ou illisible n'est pas affichée", () => {
    const e = carte({ titre: "Le devis qui part tout seul." });
    expect(rendre(<CarteEntreeCalendrier entree={e} />)).not.toContain("Le devis qui part tout seul.");
    expect(rendre(<CarteEntreeCalendrier entree={e} avecTitre />)).toContain("Le devis qui part tout seul.");
    for (const heure of [undefined, "", "25:99", "9h", "09:00:00"]) {
      const html = rendre(<CarteEntreeCalendrier entree={carte({ heure })} />);
      expect(html).toContain('aria-label="LinkedIn, Vidéo, Programmé"');
      expect(lisible(html)).not.toMatch(/\d\d:\d\d|9h/);
    }
  });

  it("couleur du réseau : un point d'extension (--res-<réseau>), aucune couleur figée dans le composant", () => {
    expect(styleReseau("tiktok")).toEqual({ "--c": "var(--res-tiktok, var(--trait-fort))" });
    const html = rendre(<CarteEntreeCalendrier entree={carte({ reseau: "facebook" })} />);
    expect(html).toContain("--c:var(--res-facebook, var(--trait-fort))");
    expect(html).toContain('data-reseau="facebook"');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it("verrou : publiée ou jour passé ; aujourd'hui et demain restent modifiables", () => {
    expect(estVerrouillee(carte({ etat: "publie" }), AUJOURDHUI)).toBe(true);
    expect(estVerrouillee(carte({ jour: "2026-11-10" }), AUJOURDHUI)).toBe(true);
    expect(estVerrouillee(carte({ jour: AUJOURDHUI }), AUJOURDHUI)).toBe(false);
    expect(estVerrouillee(carte({ jour: "2026-11-12" }), AUJOURDHUI)).toBe(false);
    expect(estVerrouillee(carte({ jour: "pas une date" }), AUJOURDHUI)).toBe(false);
    const html = rendre(<CarteEntreeCalendrier entree={carte({ etat: "publie" })} verrouillee />);
    expect(html).toContain("Verrouillée");
    expect(rendre(<CarteEntreeCalendrier entree={carte()} />)).not.toContain("Verrouillée");
  });

  it("avec href : un lien ; avec onOuvrir : un bouton qui rend l'entrée ; sans rien : ni lien ni bouton", () => {
    const e = carte();
    expect(rendre(<CarteEntreeCalendrier entree={e} href="/calendrier?entree=p1" />)).toContain('href="/calendrier?entree=p1"');
    const onOuvrir = vi.fn();
    const el = <CarteEntreeCalendrier entree={e} onOuvrir={onOuvrir} />;
    expect(rendre(el)).toContain("<button");
    cliquer(el, "LinkedIn, Vidéo, 09:00, Programmé");
    expect(onOuvrir).toHaveBeenCalledWith(e);
    const nu = rendre(<CarteEntreeCalendrier entree={e} />);
    expect(nu).not.toContain("<button");
    expect(nu).not.toContain("<a ");
  });

  it("cartesDepuisEntrees : une carte par réseau connu ; archive, réseau inconnu et liste vide ne donnent rien", () => {
    const base: EntreeCalendrier = { cle: "creneau:c1", jour: AUJOURDHUI, famille: "carrousel", origine: "creneau", titre: "Les sept fuites de temps dans une PME.", vignette: null, lien: null, reseaux: ["linkedin", "instagram", "reseau-inconnu"], mediaId: "v1", statut: "a_valider" };
    const cartes = cartesDepuisEntrees([base, { ...base, cle: "creneau:c2", statut: "archive" }, { ...base, cle: "creneau:c3", reseaux: [] }]);
    expect(cartes.map((c) => c.cle)).toEqual(["creneau:c1|linkedin", "creneau:c1|instagram"]);
    expect(cartes[0]).toMatchObject({ jour: AUJOURDHUI, reseau: "linkedin", type: "carrousel", etat: "a_valider", titre: base.titre, mediaId: "v1" });
    expect(cartesDepuisEntrees([])).toEqual([]);
    // Statut inconnu : aucune carte « Brouillon », et l'appelant est prévenu une fois par entrée.
    const surStatutInconnu = vi.fn();
    expect(cartesDepuisEntrees([{ ...base, statut: "refusee" }, base], { surStatutInconnu }).map((c) => c.cle)).toEqual(["creneau:c1|linkedin", "creneau:c1|instagram"]);
    expect(surStatutInconnu).toHaveBeenCalledTimes(1);
    expect(surStatutInconnu.mock.calls[0][0]).toBe("refusee");
    expect(cartesDepuisEntrees([{ ...base, statut: "refusee" }])).toEqual([]);
    expect(cartesDepuisEntrees([{ ...base, statut: "refusee" }], { statuts: { ...STATUTS_VERS_ETAT, refusee: "refusee" } })[0]).toMatchObject({ etat: "refusee" });
    expect(cartesDepuisEntrees([{ ...base, statut: "archive" }], { surStatutInconnu })).toEqual([]);
    expect(surStatutInconnu).toHaveBeenCalledTimes(1);
    expect(cartesDepuisEntrees([{ ...base, famille: "video", statut: "programmee", reseaux: ["tiktok"] }])[0]).toMatchObject({ type: "video", etat: "programme", reseau: "tiktok" });
  });
});

describe("GrilleMois", () => {
  const lignes = (html: string) => compter(html, 'data-semaine="');

  it("a toujours 6 lignes de 7 jours (novembre 2026, février 2027) et marque aujourd'hui une seule fois", () => {
    const nov = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} />);
    expect(lignes(nov)).toBe(6);
    expect(compter(nov, 'data-jour="')).toBe(42);
    expect(compter(nov, 'aria-current="date"')).toBe(1);
    expect(nov).toMatch(/aria-current="date"[^>]*data-jour="2026-11-11"|data-jour="2026-11-11"[^>]*aria-current="date"/);
    const fev = rendre(<GrilleMois mois="2027-02" aujourdhui={AUJOURDHUI} entrees={[]} />);
    expect(lignes(fev)).toBe(6);
    expect(compter(fev, 'data-jour="')).toBe(42);
    expect(fev).toContain('data-jour="2027-02-01"');
    expect(compter(fev, 'aria-current="date"')).toBe(0);
  });

  it("commence un lundi, sous les sept en-têtes de la maquette ; les jours hors du mois sont signalés", () => {
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} />);
    for (const j of ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]) expect(html).toContain(`>${j}<`);
    expect(html.indexOf('data-jour="2026-10-26"')).toBeGreaterThan(-1);
    expect(html.indexOf('data-jour="2026-10-26"')).toBeLessThan(html.indexOf('data-jour="2026-10-27"'));
    expect(html).toContain('data-jour="2026-12-06"');
    expect(compter(html, 'data-hors-mois="true"')).toBe(12);
  });

  it("chaque jour porte un repère par réseau (picto, nombre et nom), sans compter les idées", () => {
    const entrees = [carte({ reseau: "linkedin" }), carte({ reseau: "linkedin", heure: "12:15" }), carte({ reseau: "instagram" }), carte({ reseau: "tiktok", etat: "idee" }), carte({ jour: "illisible" })];
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} />);
    expect(html).toContain('aria-label="mercredi 11 novembre, 3 publications : LinkedIn 2, Instagram 1"');
    expect(html).toContain('title="LinkedIn : 2"');
    expect(html).toContain('title="Instagram : 1"');
    expect(html).not.toContain('title="TikTok');
    expect(html).toContain('aria-label="jeudi 12 novembre, 0 publication"');
    expect(html).toContain("Chaque pastille donne le nombre de publications d&#x27;un réseau.");
    expect(html).not.toContain("Cliquez sur un jour");
    const ouvrable = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} lienJour={(j) => `/c?${j}`} />);
    expect(ouvrable).toContain("Cliquez sur un jour pour l&#x27;ouvrir.");
    expect(rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} onOuvrirJour={() => {}} />)).toContain("Cliquez sur un jour pour l&#x27;ouvrir.");
  });

  it("lecteur d'écran : le libellé du jour dit le détail par réseau, dans l'ordre des réseaux allumés", () => {
    const entrees = [carte({ reseau: "instagram" }), carte({ reseau: "linkedin" }), carte({ reseau: "linkedin", heure: "12:00" }), carte({ reseau: "tiktok", etat: "idee" })];
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} />);
    expect(html).toContain('aria-label="mercredi 11 novembre, 3 publications : LinkedIn 2, Instagram 1"');
    expect(html).toContain('aria-label="jeudi 12 novembre, 0 publication"');
    const un = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[carte({ reseau: "facebook" })]} />);
    expect(un).toContain('aria-label="mercredi 11 novembre, 1 publication : Facebook 1"');
  });

  it("rôles vrais : un tableau et des cellules (aucune navigation aux flèches n'existe), jamais « grid »", () => {
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} lienJour={(j) => `/c?${j}`} />);
    expect(html).toContain('role="table"');
    expect(compter(html, 'role="cell"')).toBe(42);
    expect(compter(html, 'role="columnheader"')).toBe(7);
    expect(html).not.toMatch(/role="(grid|gridcell)"/);
  });

  it("le repère par réseau est le composant exporté RepereReseau (point d'extension de CAL-06)", () => {
    const repere = rendre(<RepereReseau reseau="linkedin" nombre={2} />);
    expect(repere).toContain('title="LinkedIn : 2"');
    expect(repere).toContain('data-reseau="linkedin"');
    expect(repere).toContain("--c:var(--res-linkedin, var(--trait-fort))");
    expect(repere).toMatch(/>in 2</);
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[carte({ reseau: "linkedin" }), carte({ reseau: "linkedin", heure: "12:00" })]} />);
    expect(html).toContain(repere);
  });

  it("un jour s'ouvre par lien ou par clic", () => {
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} lienJour={(j) => `/calendrier?vue=jour&date=${j}`} />);
    expect(html).toContain('href="/calendrier?vue=jour&amp;date=2026-11-30"');
    const onOuvrirJour = vi.fn();
    cliquer(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} onOuvrirJour={onOuvrirJour} />, "lundi 30 novembre, 0 publication");
    expect(onOuvrirJour).toHaveBeenCalledWith("2026-11-30");
  });

  it("mois vide ou illisible : retombe sur le mois d'aujourd'hui, toujours 6 lignes", () => {
    for (const mois of ["", "2026-13", "novembre", "2026-11-11"]) {
      const html = rendre(<GrilleMois mois={mois} aujourdhui={AUJOURDHUI} entrees={[]} />);
      expect(lignes(html)).toBe(6);
      expect(html).toContain('data-jour="2026-11-30"');
    }
  });

  it("le filtre par réseau retire les repères des réseaux éteints", () => {
    const entrees = [carte({ reseau: "linkedin" }), carte({ reseau: "instagram" })];
    const html = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} reseaux={["linkedin"]} />);
    expect(html).toContain('title="LinkedIn : 1"');
    expect(html).not.toContain('title="Instagram');
    expect(html).toContain('aria-label="mercredi 11 novembre, 1 publication : LinkedIn 1"');
  });
});

describe("GrilleSemaine", () => {
  const semaine = (p: Partial<Parameters<typeof GrilleSemaine>[0]> = {}) => <GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={[]} {...p} />;

  it("sept jours à partir du lundi, aujourd'hui marqué une seule fois, une ligne par réseau avec picto et nom", () => {
    const html = rendre(semaine());
    expect(compter(html, 'data-entete-jour="')).toBe(7);
    expect(html.indexOf('data-entete-jour="2026-11-09"')).toBeLessThan(html.indexOf('data-entete-jour="2026-11-15"'));
    expect(compter(html, 'aria-current="date"')).toBe(1);
    expect(html).toMatch(/aria-current="date"[^>]*data-entete-jour="2026-11-11"|data-entete-jour="2026-11-11"[^>]*aria-current="date"/);
    expect(compter(html, 'data-couloir="')).toBe(4);
    for (const nom of ["LinkedIn", "Instagram", "Facebook", "TikTok"]) expect(html).toContain(nom);
    expect(compter(html, 'data-case="')).toBe(28);
    expect(compter(html, 'data-aujourdhui="true"')).toBe(4);
  });

  it("range chaque carte dans la case de son réseau et de son jour, par heure", () => {
    const entrees = [carte({ cle: "b", heure: "16:15", reseau: "instagram" }), carte({ cle: "a", heure: "09:45", reseau: "instagram" }), carte({ cle: "c", reseau: "linkedin", jour: "2026-11-13" }), carte({ cle: "hors", jour: "2026-11-16" })];
    const html = rendre(semaine({ entrees }));
    expect(compter(html, 'data-carte="')).toBe(3);
    expect(html.indexOf('data-carte="a"')).toBeLessThan(html.indexOf('data-carte="b"'));
    const caseIg = html.slice(html.indexOf('data-case="instagram|2026-11-11"'), html.indexOf('data-case="instagram|2026-11-12"'));
    expect(compter(caseIg, 'data-carte="')).toBe(2);
    expect(html).not.toContain('data-carte="hors"');
  });

  it("jour passé : pas de « + » ; aujourd'hui et après : un « + » nommé ; créneau attendu et vide : « Créneau vide »", () => {
    const onAjouter = vi.fn();
    const el = semaine({ onAjouter, attendu: (reseau, jour) => reseau === "linkedin" && jour === "2026-11-12", entrees: [carte({ reseau: "instagram", jour: "2026-11-12" })] });
    const html = rendre(el);
    expect(html).not.toContain("Ajouter sur LinkedIn, mardi 10 novembre");
    expect(html).toContain('aria-label="Ajouter sur LinkedIn, mercredi 11 novembre"');
    expect(compter(html, 'aria-label="Ajouter sur ')).toBe(20);
    expect(compter(html, 'data-passe="true"')).toBe(8);
    expect(compter(html, "Créneau vide")).toBe(1);
    cliquer(el, "Ajouter sur TikTok, dimanche 15 novembre");
    expect(onAjouter).toHaveBeenCalledWith("2026-11-15", "tiktok");
    expect(rendre(semaine({ lienAjout: (j, r) => `/calendrier?ajout=${j}|${r}` }))).toContain('href="/calendrier?ajout=2026-11-11|facebook"');
    expect(compter(rendre(semaine()), "Ajouter sur ")).toBe(0);
  });

  it("le verrou et l'alerte « Trop proches » descendent jusqu'aux cartes", () => {
    const html = rendre(semaine({ entrees: [carte({ cle: "x", jour: "2026-11-09" }), carte({ cle: "y" })], tropProches: new Set(["y"]) }));
    expect(compter(html, "Verrouillée")).toBe(1);
    expect(compter(html, "Trop proches")).toBe(1);
  });

  it("un jour s'ouvre par son en-tête, une carte par lien ou par clic", () => {
    const e = carte({ cle: "z" });
    const html = rendre(semaine({ entrees: [e], lienJour: (j) => `/calendrier?vue=jour&date=${j}`, lienEntree: (x) => `/calendrier?entree=${x.cle}` }));
    expect(html).toContain('href="/calendrier?vue=jour&amp;date=2026-11-14"');
    expect(html).toContain('href="/calendrier?entree=z"');
    const onOuvrirJour = vi.fn();
    const onOuvrirEntree = vi.fn();
    const el = semaine({ entrees: [e], onOuvrirJour, onOuvrirEntree });
    cliquer(el, "Ouvrir la journée du samedi 14 novembre");
    expect(onOuvrirJour).toHaveBeenCalledWith("2026-11-14");
    cliquer(el, "LinkedIn, Vidéo, 09:00, Programmé");
    expect(onOuvrirEntree).toHaveBeenCalledWith(e);
  });

  it("le rôle d'en-tête de colonne est sur un conteneur, jamais sur le lien ou le bouton (qui gardent leur rôle à l'oral)", () => {
    const variantes = [semaine({ lienJour: (j) => `/c?${j}` }), semaine({ onOuvrirJour: () => {} }), semaine()];
    for (const el of variantes) {
      const html = rendre(el);
      expect(html).not.toMatch(/<(a|button)\b[^>]*\brole=/);
      expect(compter(html, 'role="columnheader"')).toBe(8);
    }
    const lien = rendre(variantes[0]);
    expect(lien).toMatch(/<div role="columnheader"><a [^>]*data-entete-jour="2026-11-09"/);
    expect(rendre(variantes[1])).toMatch(/<div role="columnheader"><button [^>]*data-entete-jour="2026-11-09"/);
  });

  describe("densité : maxParCase et « + N autres » (point d'extension de RC-37 et CAL-09)", () => {
    const quatre = ["09:00", "10:00", "11:00", "12:00"].map((heure, i) => carte({ cle: `d${i}`, heure }));
    const caseDe = (html: string) => html.slice(html.indexOf('data-case="linkedin|2026-11-11"'), html.indexOf('data-case="linkedin|2026-11-12"'));

    it("au-delà de la limite : les premières cartes (par heure) et un bouton nommé qui rend la case", () => {
      const onVoirPlus = vi.fn();
      const el = semaine({ entrees: [...quatre].reverse(), maxParCase: 2, onVoirPlus });
      const c = caseDe(rendre(el));
      expect(compter(c, 'data-carte="')).toBe(2);
      expect(c).toContain('data-carte="d0"');
      expect(c).toContain('data-carte="d1"');
      expect(c).not.toContain('data-carte="d2"');
      expect(lisible(c)).toContain("+ 2 autres");
      cliquer(el, "Voir les 2 autres publications sur LinkedIn, mercredi 11 novembre");
      expect(onVoirPlus).toHaveBeenCalledWith("linkedin", "2026-11-11");
    });

    it("par lien (rendu serveur), et « + 1 autre » au singulier", () => {
      const html = rendre(semaine({ entrees: quatre.slice(0, 3), maxParCase: 2, lienPlus: (r, j) => `/c?plus=${r}|${j}` }));
      expect(html).toContain('href="/c?plus=linkedin|2026-11-11"');
      expect(html).toContain('aria-label="Voir l&#x27;autre publication sur LinkedIn, mercredi 11 novembre"');
      expect(lisible(html)).toContain("+ 1 autre");
      expect(lisible(html)).not.toContain("+ 1 autres");
    });

    it("à la limite exacte ou en dessous : aucun « + N autres » ; les autres cases ne sont pas touchées", () => {
      for (const max of [4, 5, 100]) expect(rendre(semaine({ entrees: quatre, maxParCase: max, onVoirPlus: () => {} }))).not.toContain("autre");
      const html = rendre(semaine({ entrees: [...quatre, carte({ cle: "ig", reseau: "instagram" })], maxParCase: 3, onVoirPlus: () => {} }));
      expect(compter(html, 'data-carte="')).toBe(4);
      expect(compter(html, "+ 1 autre")).toBe(1);
    });

    it("limite absente, nulle, négative, fractionnaire ou illisible, ou sans lien ni geste : toutes les cartes restent montrées", () => {
      for (const maxParCase of [undefined, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const html = rendre(semaine({ entrees: quatre, maxParCase, onVoirPlus: () => {} }));
        expect(compter(html, 'data-carte="'), String(maxParCase)).toBe(4);
        expect(html).not.toContain("autre");
      }
      const sansGeste = rendre(semaine({ entrees: quatre, maxParCase: 1 }));
      expect(compter(sansGeste, 'data-carte="')).toBe(4);
      expect(sansGeste).not.toContain("autre");
    });

    it("la limite compte les cartes d'un jour passé aussi (consultation), et le rejeu donne le même rendu", () => {
      const passees = quatre.map((e) => ({ ...e, jour: "2026-11-10", cle: `p${e.cle}` }));
      const el = semaine({ entrees: passees, maxParCase: 1, onVoirPlus: () => {} });
      expect(rendre(el)).toContain("+ 3 autres");
      expect(rendre(el)).toBe(rendre(el));
    });
  });

  it("états vides de la maquette", () => {
    expect(rendre(semaine({ reseaux: [] }))).toContain("Aucun réseau affiché. Rallumez un réseau ci-dessus.");
    expect(lisible(rendre(semaine()))).toContain("Rien de prévu cette semaine. Cliquez sur « + » dans un jour pour ajouter une publication.");
    expect(rendre(semaine({ filtresActifs: true }))).toContain("Aucune publication avec ces filtres.");
    expect(rendre(semaine({ semaineDu: "2026-11-02" }))).toContain("Semaine terminée : consultation seule.");
    expect(rendre(semaine({ entrees: [carte()] }))).not.toContain("Rien de prévu");
  });

  it("repère vide ou illisible : la semaine d'aujourd'hui", () => {
    for (const semaineDu of ["", "2026-02-30", "demain"]) expect(rendre(semaine({ semaineDu }))).toContain('data-entete-jour="2026-11-09"');
  });

  it("semaine à cheval sur le changement d'heure d'automne : sept jours distincts", () => {
    const html = rendre(semaine({ semaineDu: "2026-10-25" }));
    for (const j of ["2026-10-19", "2026-10-24", "2026-10-25"]) expect(compter(html, `data-entete-jour="${j}"`)).toBe(1);
  });
});

describe("BarreFiltres (filtre simple par réseau)", () => {
  it("une pastille par réseau, avec picto, nom et état allumé ou éteint", () => {
    expect(RESEAUX_CALENDRIER).toEqual(["linkedin", "instagram", "facebook", "tiktok"]);
    const html = rendre(<BarreFiltres actifs={["linkedin", "tiktok"]} onBasculer={() => {}} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="LinkedIn"|aria-label="LinkedIn"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*aria-label="Instagram"|aria-label="Instagram"[^>]*aria-pressed="false"/);
    expect(compter(html, 'aria-pressed="true"')).toBe(2);
    expect(compter(html, 'aria-pressed="false"')).toBe(2);
    for (const t of [">in<", ">IG<", ">f<", ">TT<", "LinkedIn", "Instagram", "Facebook", "TikTok"]) expect(html).toContain(t);
    expect(html).toContain("--c:var(--res-linkedin, var(--trait-fort))");
  });

  it("le filtre LinkedIn fonctionne : seules les publications LinkedIn restent, dans la liste et dans les grilles", () => {
    const entrees = [carte({ cle: "li", reseau: "linkedin" }), carte({ cle: "ig", reseau: "instagram" }), carte({ cle: "fb", reseau: "facebook" }), carte({ cle: "tt", reseau: "tiktok" })];
    const onBasculer = vi.fn();
    const barre = <BarreFiltres actifs={[...RESEAUX_CALENDRIER]} onBasculer={onBasculer} />;
    cliquer(barre, "Instagram");
    expect(onBasculer).toHaveBeenCalledWith("instagram");
    let actifs = [...RESEAUX_CALENDRIER];
    for (const r of ["instagram", "facebook", "tiktok"] as const) actifs = basculerReseau(actifs, r);
    expect(actifs).toEqual(["linkedin"]);
    const restantes = filtrerParReseau(entrees, actifs);
    expect(restantes.map((e) => e.cle)).toEqual(["li"]);
    const html = rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={restantes} reseaux={actifs} />);
    expect(compter(html, 'data-couloir="')).toBe(1);
    expect(html).toContain('data-couloir="linkedin"');
    expect(html).toContain('data-carte="li"');
    for (const cle of ["ig", "fb", "tt"]) expect(html).not.toContain(`data-carte="${cle}"`);
    // Même sans filtrer la liste, la grille ne montre que les réseaux allumés.
    expect(compter(rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={entrees} reseaux={actifs} />), 'data-carte="')).toBe(1);
  });

  it("basculer rallume dans l'ordre de la barre ; tout éteint puis rejeu : rien ne se perd", () => {
    expect(basculerReseau(["tiktok"], "linkedin")).toEqual(["linkedin", "tiktok"]);
    expect(basculerReseau(["linkedin"], "linkedin")).toEqual([]);
    expect(basculerReseau(basculerReseau([], "facebook"), "facebook")).toEqual([]);
    expect(filtrerParReseau([carte()], [])).toEqual([]);
    expect(filtrerParReseau([], ["linkedin"])).toEqual([]);
    const actifs = ["linkedin"] as const;
    basculerReseau(actifs, "tiktok");
    expect(actifs).toEqual(["linkedin"]);
  });

  it("par liens (rendu serveur) : chaque pastille porte son adresse", () => {
    const html = rendre(<BarreFiltres actifs={["linkedin"]} lienReseau={(r) => `/calendrier?reseaux=${r}`} />);
    expect(html).toContain('href="/calendrier?reseaux=instagram"');
    expect(html).toContain('aria-label="LinkedIn, affiché"');
    expect(html).toContain('aria-label="Instagram, masqué"');
    expect(html).not.toContain("aria-current");
  });

  it("« Effacer les filtres (N) » n'apparaît que si un autre filtre est actif", () => {
    const onEffacer = vi.fn();
    expect(rendre(<BarreFiltres actifs={[]} onBasculer={() => {}} onEffacer={onEffacer} />)).not.toContain("Effacer les filtres");
    const el = <BarreFiltres actifs={[]} onBasculer={() => {}} nombreFiltres={2} onEffacer={onEffacer} />;
    expect(rendre(el)).toContain("Effacer les filtres (2)");
    cliquer(el, "Effacer les filtres (2)");
    expect(onEffacer).toHaveBeenCalledTimes(1);
    expect(rendre(<BarreFiltres actifs={[]} nombreFiltres={-1} onEffacer={onEffacer} />)).not.toContain("Effacer les filtres");
  });
});

describe("BarreVue", () => {
  it("porte la période avec ses flèches, « Aujourd'hui » et le bouton segmenté « Semaine | Mois »", () => {
    const html = rendre(<BarreVue vue="semaine" periode="Semaine du 9 au 15 novembre" onPrecedent={() => {}} onSuivant={() => {}} onAujourdhui={() => {}} onChangerVue={() => {}} />);
    expect(html).toContain('aria-label="Période précédente"');
    expect(html).toContain('aria-label="Période suivante"');
    expect(html).toContain("Semaine du 9 au 15 novembre");
    expect(lisible(html)).toContain("Aujourd'hui");
    expect(html).toContain('aria-label="Affichage"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Semaine</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Mois</);
    expect(html).not.toMatch(/>Jour</);
  });

  it("vue Mois : « Mois » est enfoncé ; vue Jour : « Semaine » reste enfoncé (pas de troisième bouton)", () => {
    expect(rendre(<BarreVue vue="mois" periode="novembre 2026" onChangerVue={() => {}} />)).toMatch(/aria-pressed="true"[^>]*>Mois</);
    const jour = rendre(<BarreVue vue="jour" periode="mercredi 11 novembre" onChangerVue={() => {}} />);
    expect(jour).toMatch(/aria-pressed="true"[^>]*>Semaine</);
    expect(compter(jour, "aria-pressed=")).toBe(2);
  });

  it("les clics rendent le bon geste", () => {
    const g = { onPrecedent: vi.fn(), onSuivant: vi.fn(), onAujourdhui: vi.fn(), onChangerVue: vi.fn() };
    const el = <BarreVue vue="semaine" periode="x" {...g} />;
    cliquer(el, "Période précédente");
    cliquer(el, "Période suivante");
    cliquer(el, "Revenir à aujourd'hui");
    cliquer(el, "Afficher le mois");
    cliquer(el, "Afficher la semaine");
    expect(g.onPrecedent).toHaveBeenCalledTimes(1);
    expect(g.onSuivant).toHaveBeenCalledTimes(1);
    expect(g.onAujourdhui).toHaveBeenCalledTimes(1);
    expect(g.onChangerVue.mock.calls).toEqual([["mois"], ["semaine"]]);
  });

  it("par liens (rendu serveur) : cinq adresses, la vue courante est signalée", () => {
    const html = rendre(<BarreVue vue="mois" periode="novembre 2026" liens={{ precedent: "/c?p=1", suivant: "/c?p=2", aujourdhui: "/c", semaine: "/c?vue=semaine", mois: "/c?vue=mois" }} />);
    for (const h of ["/c?p=1", "/c?p=2", "/c", "/c?vue=semaine", "/c?vue=mois"]) expect(html).toContain(`href="${h}"`);
    expect(html).toMatch(/aria-current="true"[^>]*>Mois</);
  });

  it("libellePeriode : semaine, semaine à cheval sur deux mois, mois, jour, vide et illisible", () => {
    expect(libellePeriode("semaine", "2026-11-11")).toBe("Semaine du 9 au 15 novembre");
    expect(libellePeriode("semaine", "2026-11-09")).toBe("Semaine du 9 au 15 novembre");
    expect(libellePeriode("semaine", "2026-12-02")).toBe("Semaine du 30 novembre au 6 décembre");
    expect(libellePeriode("mois", "2026-11")).toBe("novembre 2026");
    expect(libellePeriode("mois", "2026-11-30")).toBe("novembre 2026");
    expect(libellePeriode("jour", "2026-11-11")).toBe("mercredi 11 novembre");
    for (const v of ["semaine", "mois", "jour"] as const) for (const r of ["", "2026-02-30", "bientôt"]) expect(libellePeriode(v, r)).toBe("");
  });
});

describe("AlerteProximite", () => {
  const SUJET = "Le devis qui part tout seul : démonstration en direct.";
  const a = () => carte({ cle: "a", jour: "2026-11-11", reseau: "linkedin", titre: SUJET });
  const b = (p: Partial<EntreeCarte> = {}) => carte({ cle: "b", jour: "2026-11-13", reseau: "instagram", titre: SUJET, ...p });

  it("deux entrées proches → « Trop proches », avec le réseau et le jour de chacune", () => {
    const html = rendre(<AlerteProximite entrees={[a(), b()]} />);
    expect(html).toContain("Trop proches");
    expect(html).toContain('role="status"');
    expect(lisible(html)).toContain("LinkedIn, mercredi 11 novembre");
    expect(lisible(html)).toContain("Instagram, vendredi 13 novembre");
    expect([...clesTropProches(pairesTropProches([a(), b()]))].sort()).toEqual(["a", "b"]);
  });

  it("sujets différents, ou sujet vide : aucune alerte, rien n'est rendu", () => {
    expect(rendre(<AlerteProximite entrees={[a(), b({ titre: "Ce que nous refusons de faire quand nous accompagnons une équipe." })]} />)).toBe("");
    expect(rendre(<AlerteProximite entrees={[a(), b({ titre: "" })]} />)).toBe("");
    expect(rendre(<AlerteProximite entrees={[carte({ titre: undefined }), carte({ titre: undefined })]} />)).toBe("");
    expect(rendre(<AlerteProximite entrees={[]} />)).toBe("");
    expect(rendre(<AlerteProximite entrees={[a()]} />)).toBe("");
  });

  it("écart en jours : à la limite exacte l'alerte tient, un jour de plus elle tombe", () => {
    expect(JOURS_PROXIMITE).toBe(7);
    expect(pairesTropProches([a(), b({ jour: "2026-11-18" })])).toHaveLength(1);
    expect(pairesTropProches([a(), b({ jour: "2026-11-19" })])).toHaveLength(0);
    expect(pairesTropProches([a(), b({ jour: "2026-11-04" })])).toHaveLength(1);
    expect(pairesTropProches([a(), b({ jour: "2026-11-03" })])).toHaveLength(0);
    expect(pairesTropProches([a(), b({ jour: "2026-11-19" })], { joursMax: 8 })).toHaveLength(1);
    expect(pairesTropProches([a(), b({ jour: "2026-11-12" })], { joursMax: 0 })).toHaveLength(0);
  });

  it("score : au seuil exact l'alerte tient, juste en dessous elle tombe", () => {
    const x = "automatisation devis facture";
    const y = "automatisation devis relance";
    const score = scoreProximite(empreinte({ sujet: x }), empreinte({ sujet: y }));
    expect(score).toBe(SEUIL_PROXIMITE);
    const paire = [carte({ cle: "x", titre: x }), carte({ cle: "y", titre: y, jour: "2026-11-12" })];
    expect(pairesTropProches(paire)).toHaveLength(1);
    expect(pairesTropProches(paire)[0]).toMatchObject({ score: 0.5, ecartJours: 1 });
    expect(pairesTropProches(paire, { seuil: 0.51 })).toHaveLength(0);
    expect(pairesTropProches(paire, { seuil: 0 })).toHaveLength(1);
  });

  it("le même contenu décliné sur plusieurs réseaux n'est pas une alerte ; deux publications déjà parties non plus", () => {
    expect(pairesTropProches([{ ...a(), mediaId: "v1" }, b({ mediaId: "v1" })])).toHaveLength(0);
    expect(pairesTropProches([{ ...a(), mediaId: "v1" }, b({ mediaId: "v2" })])).toHaveLength(1);
    expect(pairesTropProches([{ ...a(), mediaId: null }, b({ mediaId: null })])).toHaveLength(1);
    expect(pairesTropProches([{ ...a(), etat: "publie" }, b({ etat: "publie" })])).toHaveLength(0);
    expect(pairesTropProches([{ ...a(), etat: "publie" }, b({ etat: "programme" })])).toHaveLength(1);
  });

  it("jour illisible : ignoré ; rejeu : même résultat, liste intacte ; chaque paire une seule fois, la plus proche d'abord", () => {
    expect(pairesTropProches([a(), b({ jour: "bientôt" })])).toHaveLength(0);
    const liste = [a(), b(), carte({ cle: "c", jour: "2026-11-12", titre: SUJET, reseau: "facebook" })];
    const copie = JSON.stringify(liste);
    const un = pairesTropProches(liste);
    const deux = pairesTropProches(liste);
    expect(un).toEqual(deux);
    expect(JSON.stringify(liste)).toBe(copie);
    expect(un.map((p) => `${p.a.cle}-${p.b.cle}`)).toEqual(["a-c", "c-b", "a-b"]);
    expect(un.map((p) => p.ecartJours)).toEqual([1, 1, 2]);
  });

  it("la signature posée par l'usine compte comme un axe de proximité", () => {
    const sig = [carte({ cle: "s1", titre: "", signatureUsine: "serie-devis" }), carte({ cle: "s2", titre: "", signatureUsine: "serie-devis", jour: "2026-11-12" })];
    expect(pairesTropProches(sig)).toHaveLength(1);
  });
});

describe("aucun libellé interdit", () => {
  const INTERDITS = [
    /\b(propose|a_valider|a_corriger|valide|programmee|publiee|echec|archive|idee)\b/, // statuts internes bruts
    /[ÉE]chec|Erreur|erreur/,
    /Buffer|diffuseur/i,
    /quota|jauge/i,
    /€|\beuros?\b|\bprix\b|\btarif/i,
    /Supprimer|supprim/i,
    /undefined|\bnull\b|NaN|Invalid Date|\[object/,
    /\bUTC\b|GMT/,
    /\b(tu|ton|tes|toi)\b/i,
  ];

  it("dans tous les composants, pour chaque état, chaque type et chaque réseau", () => {
    const types = Object.keys(TYPES_CONTENU) as (keyof typeof TYPES_CONTENU)[];
    const entrees = ETATS_CALENDRIER.flatMap((etat, i) => RESEAUX_CALENDRIER.map((reseau, k) => carte({ etat, reseau, type: types[(i + k) % types.length], jour: `2026-11-${String(9 + ((i + k) % 7)).padStart(2, "0")}`, titre: "Le devis qui part tout seul : démonstration en direct." })));
    const html = [
      rendre(<BarreVue vue="semaine" periode={libellePeriode("semaine", AUJOURDHUI)} onPrecedent={() => {}} onSuivant={() => {}} onAujourdhui={() => {}} onChangerVue={() => {}} />),
      rendre(<BarreFiltres actifs={["linkedin"]} onBasculer={() => {}} nombreFiltres={1} onEffacer={() => {}} />),
      rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={entrees} onAjouter={() => {}} attendu={() => true} tropProches={clesTropProches(pairesTropProches(entrees))} />),
      rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={[]} reseaux={[]} />),
      rendre(<GrilleSemaine semaineDu="2026-11-02" aujourdhui={AUJOURDHUI} entrees={[]} filtresActifs />),
      rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} />),
      rendre(<AlerteProximite entrees={entrees} />),
      ...entrees.map((e) => rendre(<CarteEntreeCalendrier entree={e} avecTitre verrouillee tropProche />)),
      ...["", "inconnu", ...STATUTS_PLAN].map((s) => {
        const etat = etatDepuisStatut(s);
        return etat ? rendre(<PastilleStatutPlan etat={etat} />) : "";
      }),
    ].join("\n");
    const texte = lisible(html);
    expect(texte).toContain("Trop proches");
    expect(texte).toContain("Idée de l'IA");
    for (const motif of INTERDITS) expect(texte, String(motif)).not.toMatch(motif);
  });
});

describe("contraste (WCAG AA, 4,5:1) : aucune opacité sur du texte", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const jeton = (nom: string) => css.match(new RegExp(`--${nom}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? "";
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };

  it("les textes de remplacement (éteint, hors du mois, case passée) ont 4,5:1 sur tous les fonds clairs", () => {
    for (const texte of ["texte", "texte-doux", "texte-faible"]) {
      for (const fond of ["fond", "surface-1", "surface-2", "surface-3"]) {
        expect(jeton(texte), texte).not.toBe("");
        expect(contraste(jeton(texte), jeton(fond)), `${texte} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("ni la barre de filtres (réseau éteint), ni le mois (jours voisins), ni la semaine (cases passées) n'estompent par l'opacité", () => {
    const entrees = [carte({ jour: "2026-11-09" }), carte({ cle: "futur", jour: "2026-11-13" })];
    const html = [
      rendre(<BarreFiltres actifs={["linkedin"]} onBasculer={() => {}} />),
      rendre(<BarreFiltres actifs={["linkedin"]} lienReseau={(r) => `/c?${r}`} />),
      rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={entrees} />),
      rendre(<GrilleSemaine semaineDu={AUJOURDHUI} aujourdhui={AUJOURDHUI} entrees={entrees} onAjouter={() => {}} />),
    ].join("\n");
    expect(html).not.toMatch(/\bopacity-/);
    expect(html).toContain("border-dashed");
  });

  it("un réseau éteint garde un texte doux sur fond plein (pointillé, pas d'opacité) ; un jour hors du mois, un texte faible", () => {
    const eteint = rendre(<BarreFiltres actifs={["linkedin"]} onBasculer={() => {}} />);
    expect(eteint).toMatch(/aria-label="Instagram"[^>]*class="[^"]*border-dashed[^"]*bg-surface-2[^"]*text-texte-doux|class="[^"]*border-dashed[^"]*bg-surface-2[^"]*text-texte-doux[^"]*"[^>]*aria-label="Instagram"/);
    const mois = rendre(<GrilleMois mois="2026-11" aujourdhui={AUJOURDHUI} entrees={[]} />);
    expect(mois).toMatch(/<b class="tabular-nums text-texte-faible">26<\/b>/);
  });
});
