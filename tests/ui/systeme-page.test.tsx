/** Système de page commun (lot 0) : rendu serveur seulement (renderToStaticMarkup). */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BandeauAnnuler, ConteneurPage, GroupeFiltres, OngletsLiens, PanneauFiltres, Pastille, PuceLien, PucesActives, Section } from "@/components/ui";
import { ETAPES_EDITORIALES, STATUTS_VIDEO } from "@/domaine/libelles";

const rendre = (el: ReactElement) => renderToStaticMarkup(el);

describe("système de page commun", () => {
  it("PanneauFiltres fermé garde ses liens et son compteur", () => {
    const html = rendre(
      <PanneauFiltres nombre={2}>
        <GroupeFiltres titre="Réseau">
          <PuceLien href="/videos?reseau=tiktok" actif>
            TikTok
          </PuceLien>
        </GroupeFiltres>
      </PanneauFiltres>,
    );
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain('href="/videos?reseau=tiktok"');
    expect(html).toContain("Filtres");
    expect(html).toContain(">2<");
    expect(html).toContain('aria-current="true"');
  });

  it("PucesActives : retrait et Tout effacer, rien sans puce", () => {
    const html = rendre(<PucesActives puces={[{ libelle: "TikTok", href: "/v" }]} effacerHref="/tout" />);
    expect(html).toContain('href="/v"');
    expect(html).toContain('href="/tout"');
    expect(html).toContain("Tout effacer");
    expect(rendre(<PucesActives puces={[]} effacerHref="/tout" />)).toBe("");
  });

  it("OngletsLiens avec plus garde tous les href dans le HTML", () => {
    const html = rendre(<OngletsLiens libelle="Formats" onglets={[{ href: "/a", libelle: "A", actif: true }]} plus={[{ href: "/b", libelle: "B", actif: false }]} />);
    expect(html).toContain('href="/a"');
    expect(html).toContain('href="/b"');
    expect(html).toContain("Plus");
    expect(html).toContain("bg-texte");
  });

  it("OngletsLiens sans plus reste sans menu Plus", () => {
    expect(rendre(<OngletsLiens libelle="F" onglets={[{ href: "/a", libelle: "A", actif: false }]} />)).not.toContain("<details");
  });

  it("Pastille : tons encre, contour, pointille et répartition des états", () => {
    expect(rendre(<Pastille ton="encre">Validée</Pastille>)).toContain("bg-surface-1 text-texte border-texte/25");
    expect(rendre(<Pastille ton="pointille">Idée de l'IA</Pastille>)).toContain("border-dashed");
    expect(rendre(<Pastille ton="contour">Publiée</Pastille>)).toContain("bg-transparent");
    expect(STATUTS_VIDEO.en_file.tonalite).toBe("neutre");
    expect(ETAPES_EDITORIALES.validee.tonalite).toBe("encre");
    expect(ETAPES_EDITORIALES.programmee.tonalite).toBe("sauge");
    expect(ETAPES_EDITORIALES.publiee.tonalite).toBe("contour");
  });

  it("Section produit un h2 relié par aria-labelledby", () => {
    const html = rendre(
      <Section id="mes-infos" titre="Mes infos" sousTitre="Une phrase.">
        Contenu
      </Section>,
    );
    expect(html).toContain('aria-labelledby="mes-infos-titre"');
    expect(html).toMatch(/<h2 id="mes-infos-titre"[^>]*>Mes infos<\/h2>/);
    expect(html).toContain("Une phrase.");
  });

  it("ConteneurPage lecture", () => {
    expect(rendre(<ConteneurPage largeur="lecture">x</ConteneurPage>)).toContain("mx-auto max-w-3xl");
    expect(rendre(<ConteneurPage>x</ConteneurPage>)).not.toContain("max-w-3xl");
  });

  it("BandeauAnnuler : role status, message, bouton Annuler, zone des onglets du bas", () => {
    const html = rendre(<BandeauAnnuler message="Vidéo archivée." onAnnuler={() => undefined} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Vidéo archivée.");
    expect(html).toContain("Annuler");
    expect(html).toContain("--hauteur-onglets-bas");
  });
});
