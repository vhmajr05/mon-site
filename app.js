(function () {
  var C = window.CONFIG || {};
  var DEMO = !(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  var $ = function (id) { return document.getElementById(id); };

  // --- Horloge et date ---
  function tick() {
    var d = new Date();
    $("clock").textContent = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    $("date").textContent = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
  tick(); setInterval(tick, 1000);

  // --- Écran de verrouillage : balayage vers le haut ---
  var lock = $("lock"), startY = null, dy = 0;
  function unlock() {
    lock.style.transform = "";
    lock.classList.remove("dragging");
    lock.classList.add("gone");
    $("app").hidden = false;
  }
  lock.addEventListener("pointerdown", function (e) { startY = e.clientY; dy = 0; lock.classList.add("dragging"); lock.setPointerCapture(e.pointerId); });
  lock.addEventListener("pointermove", function (e) {
    if (startY === null) return;
    dy = Math.min(0, e.clientY - startY);
    lock.style.transform = "translateY(" + dy + "px)";
  });
  function release() {
    if (startY === null) return;
    startY = null;
    if (dy < -120 || dy === 0) { unlock(); } // balayage OU simple appui
    else { lock.classList.remove("dragging"); lock.style.transform = ""; }
  }
  lock.addEventListener("pointerup", release);
  lock.addEventListener("pointercancel", release);
  lock.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " " || e.key === "ArrowUp") unlock(); });

  // --- Textes de l'accueil et mode démo ---
  $("siteName").textContent = C.SITE_NAME || "Mon site";
  $("tagline").textContent = C.TAGLINE || "";
  document.title = C.SITE_NAME || "Mon site";
  $("banner").hidden = !DEMO;

  // --- Navigation entre vues ---
  function go(name) {
    ["home", "write", "wall"].forEach(function (v) { $(v).hidden = v !== name; });
    if (name === "wall") loadWall();
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-go]"); if (b) go(b.dataset.go);
  });
  go("home");

  // --- Formulaire ---
  var msg = $("msg"), status = $("status"), send = $("send");
  msg.addEventListener("input", function () { $("count").textContent = msg.value.length + " / 500"; });
  function say(text, type) { status.textContent = text; status.className = "status " + (type || ""); }

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    if ($("website").value) return; // piège anti-robot : un humain ne le voit pas
    var nick = $("nick").value.trim(), text = msg.value.trim();
    if (text.length < 3) return say("Ton message doit contenir au moins 3 caractères.", "err");
    if (text.length > 500) return say("Ton message dépasse 500 caractères.", "err");
    var last = 0;
    try { last = +localStorage.getItem("lastSend") || 0; } catch (x) {}
    var wait = 60 - Math.floor((Date.now() - last) / 1000);
    if (wait > 0) return say("Patiente encore " + wait + " s avant d'envoyer un autre message.", "err");

    send.disabled = true; say("Envoi en cours…");
    if (DEMO) {
      setTimeout(function () {
        send.disabled = false;
        say("Mode démonstration : ton message n'a PAS été enregistré.", "err");
      }, 600);
      return;
    }
    fetch(C.SUPABASE_URL + "/rest/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: C.SUPABASE_ANON_KEY, Prefer: "return=minimal" },
      body: JSON.stringify({ nickname: nick || null, content: text })
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      try { localStorage.setItem("lastSend", String(Date.now())); } catch (x) {}
      msg.value = ""; $("count").textContent = "0 / 500";
      say("Merci ! Ton message est enregistré et apparaîtra après validation.", "ok");
    }).catch(function () {
      say("L'envoi a échoué. Vérifie ta connexion et réessaie dans un instant.", "err");
    }).finally(function () { send.disabled = false; });
  });

  // --- Mur ---
  function loadWall() {
    var list = $("list"); list.textContent = "";
    if (DEMO) {
      $("wallNote").textContent = "Exemples fictifs affichés en mode démonstration.";
      [["Alex", "Super site, l'écran de verrouillage est superbe !"], ["Anonyme", "Bravo pour le design."]].forEach(function (m) {
        var d = document.createElement("div"); d.className = "item";
        var p = document.createElement("p"); p.textContent = m[1];
        var s = document.createElement("small"); s.textContent = m[0] + " (exemple)";
        d.append(p, s); list.append(d);
      });
    } else {
      $("wallNote").textContent = "Chargement…";
      fetch(C.SUPABASE_URL + "/rest/v1/messages?select=nickname,content,created_at&approved=eq.true&order=created_at.desc&limit=50",
        { headers: { apikey: C.SUPABASE_ANON_KEY } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (rows) {
          $("wallNote").textContent = rows.length ? "" : "Aucun message pour l'instant. Sois le premier !";
          rows.forEach(function (m) {
            var d = document.createElement("div"); d.className = "item";
            var p = document.createElement("p"); p.textContent = m.content;
            var s = document.createElement("small"); s.textContent = m.nickname || "Anonyme";
            d.append(p, s); list.append(d);
          });
        })
        .catch(function () { $("wallNote").textContent = "Impossible de charger les messages. Réessaie plus tard."; });
    }
  }
})();
