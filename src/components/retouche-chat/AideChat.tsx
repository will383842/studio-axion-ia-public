/**
 * AIDE COURTE DU CHAT DE RETOUCHE (lot R4) — « ce que le chat peut faire », en mots simples. Chaque retouche de la liste
 * fermée (`briques/operations.ts`) y a sa phrase (garde dans les tests). Aucun prix.
 */
export interface LigneAide {
  titre: string;
  exemple: string;
  types: string[];
}

export const AIDE_CHAT: readonly LigneAide[] = [
  { titre: "Changer un mot à l'écran", exemple: "Remplace « gratuit » par « offert ».", types: ["changer-mot"] },
  { titre: "Ajouter un chiffre", exemple: "Ajoute 3 heures gagnées par semaine.", types: ["ajouter-chiffre"] },
  { titre: "Changer ou ajouter un élément", exemple: "Mets un graphique à la place de la liste.", types: ["changer-brique", "ajouter-piece", "retirer-piece", "remplacer-piece"] },
  { titre: "Ajouter une légende", exemple: "Ajoute une légende « Un clic » sur la deuxième scène.", types: ["ajouter-piece"] },
  { titre: "Déplacer une scène", exemple: "Décale la scène 3 un peu plus tôt.", types: ["decaler-scene"] },
  { titre: "Changer les couleurs et les entrées", exemple: "Fond noir, accent orange, entrée en fondu.", types: ["changer-habillage", "changer-transition"] },
  { titre: "Ajouter du dynamisme", exemple: "Rends la vidéo plus dynamique.", types: ["ajouter-dynamisme"] },
  { titre: "Zoomer", exemple: "Zoome sur le bouton dans la scène 2.", types: ["ajuster-zoom"] },
  { titre: "Modifier le script", exemple: "Seulement si vous le demandez : « modifie le script ».", types: ["modifier-script"] },
];

export function AideChat() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-texte">Ce que le chat peut faire</h2>
      <p className="text-sm text-texte-doux">Écrivez ce que vous voulez changer. Le chat vous dit ce qui sera refait avant d&apos;appliquer. La voix ne change jamais sans votre accord, et vous pouvez revenir à la version d&apos;avant.</p>
      <ul className="space-y-2">
        {AIDE_CHAT.map((l) => (
          <li key={l.titre} className="rounded-2xl border border-trait bg-surface-1 p-3">
            <p className="text-sm font-medium text-texte">{l.titre}</p>
            <p className="text-sm text-texte-doux">{l.exemple}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
