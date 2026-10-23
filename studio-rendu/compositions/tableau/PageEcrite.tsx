/**
 * PAGE ÉCRITE (TB-05) : tout ce qui est visible sur la page à l'instant `t` d'après le plan de la scène (déjà écrit,
 * en train de s'écrire). Calques, de l'arrière vers l'avant : surlignés, dessins, bulles, textes, traits orange et
 * marques. Ce qui appartient à une scène suivante de la page n'est pas encore là.
 */
import { BullePreuve } from "./BullePreuve";
import { DessinTrace } from "./DessinTrace";
import { LigneEcrite } from "./LigneEcrite";
import { avancement, boitesImportantes, importantsDe, type PlanScene, type SorteAction } from "./plan";
import { texteChiffre } from "./textes-chiffres";
import { GesteTrace, TraitSouligne, TraitSurligne } from "./Traces";
import type { ElementPlace, PagePlacee } from "./types";

/** Fenêtre (début, durée) d'une partie, pour les gestes du stylo ; déjà fait : (−1, 0). */
function fenetre(plan: PlanScene, elementId: string, partie: string): { debut: number; duree: number } {
  if (plan.etats[elementId] !== "scene") return { debut: -1, duree: 0 };
  const a = plan.actions.find((x) => x.elementId === elementId && x.partie === partie);
  return a ? { debut: a.debut, duree: a.duree } : { debut: -1, duree: 0 };
}

function sorteMarque(e: ElementPlace): SorteAction | null {
  return e.marque === "souligne" ? "souligner" : e.marque === "entoure" ? "entourer" : e.marque === "barre" ? "barrer" : e.marque === "surligne" ? "surligner" : null;
}

export function PageEcrite({ plan, page, t, importants }: { plan: PlanScene; page: PagePlacee; t: number; importants: Record<string, string[]> }) {
  const W = plan.largeur;
  const H = plan.hauteur;
  // Épaisseur des traits : largeur de référence du format (l'image en 9:16, où les deux sont égales).
  const T = plan.largeurTrait ?? W;
  const av = (id: string, partie: string) => avancement(plan, id, partie, t);
  const visibles = page.elements.filter((e) => plan.etats[e.elementId]);
  const textes = visibles.filter((e) => e.type === "ligne" || e.type === "chiffre" || e.type === "mention");
  return (
    <>
      {/* Surlignés (derrière le texte). */}
      {textes
        .filter((e) => e.marque === "surligne")
        .flatMap((e) => e.lignes.map((l, i) => <TraitSurligne key={`${e.elementId}-s${i}`} cible={l.px} u={av(e.elementId, `marque:${i}`)} largeurImage={T} hauteurImage={H} />))}
      {visibles
        .filter((e) => e.type === "dessin")
        .map((e) => (
          <DessinTrace key={e.elementId} dessinId={e.dessinId ?? ""} px={e.px} contour={av(e.elementId, "contour")} teinte={av(e.elementId, "teinte")} largeurImage={T} />
        ))}
      {visibles
        .filter((e) => e.type === "preuve" && plan.bulles[e.elementId])
        .map((e) => (
          <BullePreuve key={e.elementId} element={e} bulle={plan.bulles[e.elementId]} avance={(partie) => av(e.elementId, partie)} largeurImage={W} hauteurImage={H} largeurTrait={T} />
        ))}
      {textes.flatMap((e) =>
        e.lignes.map((l, i) => {
          const u = av(e.elementId, `ligne:${i}`);
          const texte = e.type === "chiffre" && i === 0 ? texteChiffre(l.texte, u) : l.texte;
          return (
            <LigneEcrite
              key={`${e.elementId}-${i}`}
              texte={texte}
              px={l.px}
              taille={e.taillePx ?? 0}
              niveau={e.niveau ?? "corps"}
              u={u}
              largeurImage={W}
            />
          );
        }),
      )}
      {/* Mots importants : en noir, soulignés d'orange. */}
      {textes
        .filter((e) => e.type === "ligne")
        .flatMap((e) =>
          boitesImportantes(e, importantsDe(e, { importants })).map((b, i) => <TraitSouligne key={`${e.elementId}-i${i}`} cible={b} u={av(e.elementId, `important:${i}`)} largeurImage={T} hauteurImage={H} />),
        )}
      {/* Marques des lignes (souligné, entouré, barré). */}
      {textes.flatMap((e) => {
        const sorte = sorteMarque(e);
        if (!sorte || sorte === "surligner") return [];
        if (sorte === "souligner") return e.lignes.map((l, i) => <TraitSouligne key={`${e.elementId}-m${i}`} cible={l.px} u={av(e.elementId, `marque:${i}`)} largeurImage={T} hauteurImage={H} />);
        if (sorte === "entourer") return [<GesteTrace key={`${e.elementId}-m`} sorte="entourer" cible={e.px} {...fenetre(plan, e.elementId, "marque:0")} t={t} largeurImage={T} />];
        return e.lignes.map((l, i) => <GesteTrace key={`${e.elementId}-m${i}`} sorte={sorte} cible={l.px} {...fenetre(plan, e.elementId, `marque:${i}`)} t={t} largeurImage={T} />);
      })}
      {/* Gestes de la fiche : souligner ou barrer un texte, ligne par ligne ; entourer et cocher, dans leur zone. */}
      {page.gestes
        .filter((g) => plan.etats[g.elementId])
        .flatMap((g) => {
          const cible = page.elements.find((e) => e.elementId === g.cibleId);
          const parLigne = (g.geste === "souligner" || g.geste === "barrer") && cible && cible.lignes.length > 0 && cible.type !== "preuve";
          if (parLigne)
            return cible.lignes.map((l, i) =>
              g.geste === "souligner" ? (
                <TraitSouligne key={`${g.elementId}-${i}`} cible={l.px} u={av(g.elementId, `geste:${i}`)} largeurImage={T} hauteurImage={H} />
              ) : (
                <GesteTrace key={`${g.elementId}-${i}`} sorte="barrer" cible={l.px} {...fenetre(plan, g.elementId, `geste:${i}`)} t={t} largeurImage={T} />
              ),
            );
          const zone = g.zone?.px ?? g.cible.px;
          if (g.geste === "souligner") return [<TraitSouligne key={g.elementId} cible={zone} u={av(g.elementId, "geste")} largeurImage={T} hauteurImage={H} />];
          if (g.geste === "pointer") return [];
          return [<GesteTrace key={g.elementId} sorte={g.geste} cible={zone} {...fenetre(plan, g.elementId, "geste")} t={t} largeurImage={T} />];
        })}
    </>
  );
}
