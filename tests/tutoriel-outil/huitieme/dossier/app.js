(function () {
  var etats = {};
  function montrer(id) {
    document.querySelectorAll(".ecran").forEach(function (e) { e.classList.toggle("visible", e.id === id); });
    document.querySelectorAll("header button").forEach(function (b) { b.classList.toggle("actif", b.getAttribute("data-aller") === id); });
  }
  function remplir() {
    var d = window.donneesAtelier;
    document.getElementById("liste-commandes").innerHTML = d.commandes.map(function (c) { return "<div class='carte'>" + c.client + " · " + c.etape + " · prêt " + c.pret + "</div>"; }).join("");
    document.getElementById("lignes-planning").innerHTML = d.machines.map(function (m) { return "<tr><td>" + m.nom + "</td><td>" + m.jour + "</td><td>" + m.tache + "</td></tr>"; }).join("");
    document.getElementById("liste-stocks").innerHTML = d.stocks.map(function (s) { return "<div class='carte'>" + s.bois + " · " + s.planches + " planches" + (s.planches < s.seuil ? " · à commander" : "") + "</div>"; }).join("");
  }
  window.demoMaquette = {
    aller: function (id, etat) {
      montrer(id);
      var racine = document.getElementById(id);
      if (racine && (etat === "avant" || etat === "maintenant")) { racine.className = "ecran visible etat-" + etat; etats[id] = etat; }
    },
    reinitialiser: function () { etats = {}; remplir(); montrer("commandes"); document.querySelectorAll(".ecran").forEach(function (e) { e.className = e.id === "commandes" ? "ecran visible etat-maintenant" : "ecran etat-maintenant"; }); }
  };
  document.querySelectorAll("header button").forEach(function (b) { b.addEventListener("click", function () { window.demoMaquette.aller(b.getAttribute("data-aller"), "maintenant"); }); });
  remplir();
  window.demoMaquette.reinitialiser();
})();
