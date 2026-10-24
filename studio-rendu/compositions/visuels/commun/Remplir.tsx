import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cancelRender, continueRender, delayRender, getInputProps } from "remotion";
import { avecDelai, DELAI_DELAYRENDER_MS, DELAI_TITRES_MS } from "./attente-police";
import { attendrePolices } from "./controle-debordement";
import { largeurAuFacteur1, type Colonne } from "./geometrie";
import { dessinsDe, lignesDeTexte, textesTropLarges } from "./occupation";
import { partVide, VIDE_MAX } from "./zones";

/** Variable CSS du facteur de remplissage : les tailles du corps s'écrivent `k(n)` (n px × facteur). */
const VARIABLE = "--remplissage";

/** Taille CSS de `n` px multipliée par le facteur de remplissage de la page (1 tant que `Remplir` n'a pas mesuré). */
export const k = (n: number): string => `calc(${n}px * var(${VARIABLE}, 1))`;

/** Nombre de pas de la dichotomie : précision ≈ (max − 1) / 2^PAS du facteur. */
const PAS = 9;

/** Attend que les titres ajustés AUTRES que ce bloc soient posés : la hauteur laissée au corps en dépend. */
async function attendreAutresTitres(soi: Element): Promise<void> {
  const autre = () => [...(soi.ownerDocument?.querySelectorAll("[data-titre-attente]") ?? [])].some((e) => e !== soi);
  await avecDelai(
    (async () => {
      while (autre()) await new Promise((r) => setTimeout(r, 25));
    })(),
    DELAI_TITRES_MS,
    () => `Un titre est resté en attente après ${DELAI_TITRES_MS / 1000} s : le corps de page ne peut pas être ajusté`,
  );
}

/**
 * Plafond du facteur pour les ESSAIS seulement (`scripts/essai-art1.ts` rend chaque page aussi au facteur 1) : posé dans les propriétés
 * d'entrée APRÈS leur validation ; en production, les propriétés validées (schéma strict) ne peuvent pas le porter.
 */
function plafondEssai(): number {
  const p = (typeof window === "undefined" ? {} : getInputProps()) as { facteurMaxEssai?: unknown };
  return typeof p.facteurMaxEssai === "number" && p.facteurMaxEssai >= 1 ? p.facteurMaxEssai : Infinity;
}

/** Vide visé par le choix de mise en page : un peu sous `VIDE_MAX`, pour garder une marge sur la mesure du rendu. */
const VIDE_VISE = VIDE_MAX - 0.05;

/**
 * Corps de page qui REMPLIT sa place (L9) : les cartes gardent la hauteur de leur contenu (jamais étirées), et le corps de texte, les dessins
 * et les espacements écrits `k(n)` grandissent ensemble, par dichotomie sur le DOM réel (polices chargées), jusqu'au plus grand facteur
 * (au plus `max`) où le contenu tient encore. Le reste éventuel est réparti autour du groupe, centré (« safe center » : un contenu trop haut
 * déborde vers le BAS, où le contrôle de débordement de la zone le voit, jamais vers le haut où il serait coupé en silence). Tant que le
 * facteur n'est pas posé, le bloc porte `data-titre-attente` : le contrôle de débordement et la mesure du rendu l'attendent.
 * `variantes` (2 ou plus) : `children` et `max` reçoivent le numéro d'une mise en page, essayées dans l'ordre ; on garde la PREMIÈRE dont
 * le vide mesuré (`partVide`) reste sous `VIDE_VISE`, sinon la moins vide de celles qui tiennent au facteur 1 (la dernière si aucune ne tient :
 * le contrôle de débordement le dira).
 */
export function Remplir({
  max,
  ecart,
  children,
  style,
  variantes = 1,
}: {
  max: number | ((variante: number) => number);
  ecart?: number;
  children: ReactNode | ((variante: number) => ReactNode);
  style?: CSSProperties;
  variantes?: number;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  const [facteur, setFacteur] = useState<number | null>(null);
  const [variante, setVariante] = useState(0);
  /** Essais déjà faits : facteur et vide de chaque variante qui tient au facteur 1. */
  const essais = useRef<Map<number, { facteur: number; vide: number }>>(new Map());
  const maxVariante = Math.min(plafondEssai(), typeof max === "function" ? max(variante) : max);
  const [attente] = useState(() => delayRender("Remplissage du corps de page", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS }));

  useEffect(() => {
    let vivant = true;
    (async () => {
      await attendrePolices();
      if (cadre.current) await attendreAutresTitres(cadre.current);
      // Deux images : la mise en page de la page (titre posé, variante dessinée) est faite avant de mesurer la place.
      await new Promise<void>((fin) => requestAnimationFrame(() => requestAnimationFrame(() => fin())));
      const c = cadre.current;
      const d = contenu.current;
      if (!c || !d || !vivant) return;
      const deja = essais.current.get(variante);
      if (deja) {
        // Retour à une variante déjà mesurée (la moins vide) : son facteur est connu.
        c.style.setProperty(VARIABLE, String(deja.facteur));
        setFacteur(deja.facteur);
        return;
      }
      const st = getComputedStyle(c);
      const place = { hauteur: c.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom), largeur: c.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) };
      const tient = (f: number) => {
        c.style.setProperty(VARIABLE, String(f));
        // Le cadre total ne suffit pas : un mot insécable plus large que sa colonne (ou une pastille plus large que sa rangée) refuse le facteur.
        return d.scrollHeight <= place.hauteur && d.scrollWidth <= place.largeur && textesTropLarges(d) === 0;
      };
      const derniere = variante >= variantes - 1;
      /** La moins vide des variantes essayées (tri stable : à égalité, la première) ; on y revient si ce n'est pas celle-ci. */
      const choisir = () => {
        const [meilleure, essai] = [...essais.current.entries()].sort((a, b) => a[1].vide - b[1].vide)[0];
        if (meilleure !== variante) return setVariante(meilleure);
        c.style.setProperty(VARIABLE, String(essai.facteur));
        setFacteur(essai.facteur);
      };
      const suivante = () => {
        c.style.removeProperty(VARIABLE);
        setVariante(variante + 1);
      };
      // Facteur 1 : la mise en page de base, contrôlée par l'essai des capacités maximales ; on ne descend jamais dessous.
      if (!tient(1)) {
        // Ne tient pas : notée « vide infini ». Si aucune ne tient, la PREMIÈRE (la mise en page de base) est gardée au facteur 1.
        essais.current.set(variante, { facteur: 1, vide: Infinity });
        if (!derniere) return suivante();
        return choisir();
      }
      let bas = 1;
      let haut = maxVariante;
      if (tient(haut)) bas = haut;
      else
        for (let i = 0; i < PAS; i++) {
          const milieu = (bas + haut) / 2;
          if (tient(milieu)) bas = milieu;
          else haut = milieu;
        }
      const f = Math.floor(bas * 1000) / 1000;
      c.style.setProperty(VARIABLE, String(f));
      const r = c.getBoundingClientRect();
      const vide = partVide({ haut: r.top, bas: r.bottom }, [...lignesDeTexte(c), ...dessinsDe(c, { pourVide: true })]);
      essais.current.set(variante, { facteur: f, vide });
      if (vide <= VIDE_VISE || variantes === 1) return setFacteur(f);
      if (!derniere) return suivante();
      choisir();
    })().catch((e: unknown) => cancelRender(e));
    return () => {
      vivant = false;
    };
  }, [maxVariante, variante, variantes]);

  useEffect(() => {
    if (facteur !== null) requestAnimationFrame(() => continueRender(attente));
  }, [facteur, attente]);

  return (
    <div
      ref={cadre}
      {...(facteur === null ? { "data-titre-attente": "" } : { "data-remplissage": String(facteur), "data-variante": String(variante) })}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "safe center", ...(facteur !== null ? { [VARIABLE]: String(facteur) } : {}), ...style }}
    >
      <div ref={contenu} style={{ flex: "none", display: "flex", flexDirection: "column", gap: ecart === undefined ? undefined : k(ecart) }}>
        {typeof children === "function" ? children(variante) : children}
      </div>
    </div>
  );
}

/** Largeur CSS `base` px diminuée de ce que gagne un élément de `n` px en grandissant avec le facteur : le bord droit du texte ne bouge pas. */
export const moinsK = (base: number, n: number): string => `calc(${base}px - ${n}px * (var(${VARIABLE}, 1) - 1))`;

/** Largeur CSS maximale du texte d'une colonne (`geometrie.ts`) : son bord droit ne bouge pas quand ce qui est à sa gauche grandit. */
export const largeurColonne = (c: Colonne): string => moinsK(largeurAuFacteur1(c), c.croissance + c.recul);

/** Transformation CSS qui agrandit un dessin de taille fixe avec le facteur (à poser sur un bloc de `n` px, dans une enveloppe de `k(n)`). */
export const ECHELLE = `scale(var(${VARIABLE}, 1))`;
