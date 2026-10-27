(function () {
  var C = window.CONFIG || {}, $ = function (id) { return document.getElementById(id); };
  var token = null, tab = 0;
  try { token = sessionStorage.getItem("adminToken"); } catch (x) {}

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, opts.headers || {});
    return fetch(C.SUPABASE_URL + path, opts).then(function (r) {
      if (r.status === 401) { logout(); throw new Error("expired"); }
      if (!r.ok) throw new Error(r.status);
      return r.status === 204 || opts.method === "PATCH" ? null : r.json();
    });
  }
  function show() { $("login").hidden = !!token; $("panel").hidden = !token; if (token) load(); }
  function logout() { token = null; try { sessionStorage.removeItem("adminToken"); } catch (x) {} $("lstatus").textContent = ""; show(); }

  $("login").addEventListener("submit", function (e) {
    e.preventDefault();
    var s = $("lstatus"); s.className = "status"; s.textContent = "Connexion…";
    fetch(C.SUPABASE_URL + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey: C.SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("pass").value })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.access_token) throw new Error("bad");
      token = d.access_token; $("pass").value = "";
      try { sessionStorage.setItem("adminToken", token); } catch (x) {}
      show();
    }).catch(function () { s.className = "status err"; s.textContent = "Email ou mot de passe incorrect."; });
  });
  $("logout").onclick = logout;
  ["t0", "t1", "t2"].forEach(function (id, i) {
    $(id).onclick = function () { tab = i; ["t0", "t1", "t2"].forEach(function (t) { $(t).className = ""; }); $(id).className = "on"; load(); };
  });
  var FILTER = ["approved=eq.false&removed=eq.false", "approved=eq.true", "approved=eq.false&removed=eq.true"];
  var EMPTY = ["Rien à valider pour l'instant.", "Aucun message publié.", "Aucun message retiré."];

  function btn(label, cls, fn) { var b = document.createElement("button"); b.textContent = label; b.className = cls; b.onclick = fn; return b; }

  function load() {
    var list = $("list"); list.textContent = ""; $("note").textContent = "Chargement…";
    api("/rest/v1/messages?select=*&" + FILTER[tab] + "&order=created_at.desc&limit=100").then(function (rows) {
      $("note").textContent = rows.length ? "" : EMPTY[tab];
      rows.forEach(function (m) {
        var d = document.createElement("div"); d.className = "item";
        var p = document.createElement("p"); p.textContent = m.content;
        var t = document.createElement("small"); t.className = "tag";
        t.textContent = (m.nickname || "Anonyme") + " · " + new Date(m.created_at).toLocaleString("fr-FR");
        var row = document.createElement("div"); row.className = "row";
        row.append(
          btn(["Approuver", "Retirer du mur", "Republier"][tab], tab === 1 ? "" : "ok", function () {
            var body = tab === 1 ? { approved: false, removed: true } : { approved: true, removed: false };
            api("/rest/v1/messages?id=eq." + m.id, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=minimal" } }).then(load).catch(fail);
          }),
          btn("Supprimer", "del", function () {
            if (confirm("Supprimer définitivement ce message ?")) api("/rest/v1/messages?id=eq." + m.id, { method: "DELETE" }).then(load).catch(fail);
          })
        );
        d.append(p, t, row); list.append(d);
      });
    }).catch(fail);
  }
  function fail(e) { if (e.message !== "expired") $("note").textContent = "Erreur. Vérifie que ton compte est bien administrateur."; }
  show();
})();
