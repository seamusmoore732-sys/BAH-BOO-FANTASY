/*! LeagueStories v1 – matchup storylines + all-time streak leaderboard. No dependencies. MIT.
 *
 * A "game" is: { season, week, po, A, B, pa, pb, src }
 *   A / B = manager names, pa / pb = their scores, po = playoff flag, src = optional league label.
 *   Games with agg:true (two-week playoff totals) are kept for results but ignored for scoring stats.
 *
 * LeagueStories.streakLeaderboard(games, { limit: 10, minLen: 2 })
 *   -> { win: [run], loss: [run], active: [run] }
 *      run = { manager, type: "W"|"L", len, from: "2024 Wk 3", to: "2024 Wk 6", active: bool }
 *
 * LeagueStories.matchupStories(games, matchups)
 *   matchups = games to preview (unplayed, pa/pb = 0) or recap (already played).
 *   Only games BEFORE each matchup's week are used as history.
 *   -> [{ season, week, A, B, headline, lines: [text], recap }]
 *
 * Browser: <script src="storylines.js"></script>  ->  window.LeagueStories
 * Node:    const LeagueStories = require("./storylines.js")
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LeagueStories = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const key = g => g.season * 100 + g.week;
  const res = (p, q) => (p > q ? "W" : p < q ? "L" : "T");
  const f1 = n => (+n).toFixed(1);
  const sortG = gs => [...gs].sort((a, b) => key(a) - key(b) || ((a.src || "") > (b.src || "") ? 1 : -1));
  const tag = g => g.season + " Wk " + g.week;
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  // per-manager chronological results
  function logs(games) {
    const L = {};
    sortG(games).forEach(g => {
      [[g.A, g.B, g.pa, g.pb], [g.B, g.A, g.pb, g.pa]].forEach(([m, o, p, q]) => {
        (L[m] = L[m] || []).push({ o, p, q, r: res(p, q), g });
      });
    });
    return L;
  }
  // every win/loss run in a result list (ties break a run)
  function runs(list) {
    const out = [];
    let c = null;
    list.forEach(x => {
      if (x.r === "T") { c = null; return; }
      if (c && c.type === x.r) { c.len++; c.end = x.g; }
      else { c = { type: x.r, len: 1, start: x.g, end: x.g }; out.push(c); }
    });
    return out;
  }
  // current streak at the end of a result list
  function now(list) {
    const last = list[list.length - 1];
    if (!last || last.r === "T") return { type: "", len: 0 };
    let n = 0;
    for (let i = list.length - 1; i >= 0 && list[i].r === last.r; i--) n++;
    return { type: last.r, len: n };
  }

  function streakLeaderboard(games, o) {
    o = Object.assign({ limit: 10, minLen: 2 }, o);
    const L = logs(games), all = [];
    Object.keys(L).forEach(m => {
      const rs = runs(L[m]), lastG = L[m][L[m].length - 1].g;
      rs.forEach((r, i) => all.push({
        manager: m, type: r.type, len: r.len, from: tag(r.start), to: tag(r.end),
        active: i === rs.length - 1 && r.end === lastG
      }));
    });
    const by = t => all.filter(r => r.type === t && r.len >= o.minLen)
      .sort((a, b) => b.len - a.len || (a.active ? -1 : 1)).slice(0, o.limit);
    return { win: by("W"), loss: by("L"), active: all.filter(r => r.active && r.len >= o.minLen).sort((a, b) => b.len - a.len) };
  }

  function matchupStories(games, matchups) {
    const all = sortG(games);
    return matchups.map(mu => {
      const A = mu.A, B = mu.B;
      const L = logs(all.filter(g => key(g) < key(mu))), la = L[A] || [], lb = L[B] || [];
      const lines = [];
      let top = 0, headline = "";
      const add = (pts, t, h) => { lines.push([pts, t]); if (h && pts > top) { top = pts; headline = h; } };
      const h2h = la.filter(x => x.o === B);
      const w = h2h.filter(x => x.r === "W").length, l = h2h.filter(x => x.r === "L").length;
      const rec = ls => {
        const s = ls.filter(x => x.g.season === mu.season && !x.g.po);
        return s.filter(x => x.r === "W").length + "-" + s.filter(x => x.r === "L").length;
      };

      // ---- history between the two managers
      if (!h2h.length) add(3, "First meeting on record between " + A + " and " + B + ".", "First-ever meeting");
      else {
        add(2, w === l
          ? "The series is tied " + w + "-" + l + " over " + plural(h2h.length, "game") + "."
          : (w > l ? A : B) + " leads the series " + Math.max(w, l) + "-" + Math.min(w, l) + ".");
        const lm = h2h[h2h.length - 1];
        add(2, "Last meeting (" + tag(lm.g) + "): " + (lm.r === "W" ? A : lm.r === "L" ? B : "nobody") + " took it " +
          f1(Math.max(lm.p, lm.q)) + "–" + f1(Math.min(lm.p, lm.q)) + ".");
        if (lm.r !== "T") add(4, (lm.r === "W" ? B : A) + " is out for revenge after a " +
          f1(Math.abs(lm.p - lm.q)) + "-point loss last time.", "Revenge game");
        const n = now(h2h);
        if (n.len >= 3) add(5, (n.type === "W" ? A : B) + " has won the last " + n.len + " meetings.",
          (n.type === "W" ? B : A) + " looks to end a " + n.len + "-game skid vs " + (n.type === "W" ? A : B));
        if (h2h.length >= 4 && Math.abs(w - l) <= 1)
          add(3, "A true rivalry: " + h2h.length + " meetings and never more than one win apart.", "Even rivalry");
        const close = h2h.filter(x => !x.g.agg && Math.abs(x.p - x.q) < 5).length;
        if (close >= 2) add(2, close + " of their " + h2h.length + " meetings were decided by under 5 points.");
      }

      // ---- each team's form
      [[A, la], [B, lb]].forEach(([m, ls]) => {
        const c = now(ls);
        const best = Math.max(0, ...runs(ls).filter(r => r.type === "W").map(r => r.len));
        if (c.len >= 3) add(3 + c.len, m + " has " + (c.type === "W" ? "won " : "lost ") + c.len + " straight.",
          c.type === "W" ? m + " on a " + c.len + "-game heater" : m + " in a " + c.len + "-game slump");
        if (c.type === "W" && c.len >= 3 && c.len >= best) add(4, m + " is on the longest win streak of their career.");
        else if (c.type === "W" && c.len >= 2 && best - c.len === 1) add(3, m + " is one win from matching a career-best streak of " + best + ".");
        const sl = ls.filter(x => !x.g.agg);
        if (sl.length >= 4) {
          const rc = sl.slice(-3).reduce((s, x) => s + x.p, 0) / 3, av = sl.reduce((s, x) => s + x.p, 0) / sl.length;
          if (Math.abs(rc - av) >= 10) add(2, m + " is averaging " + f1(rc) + " over the last 3, " + f1(Math.abs(rc - av)) +
            (rc > av ? " above" : " below") + " their career mark of " + f1(av) + ".");
        }
      });
      const ca = now(la), cb = now(lb);
      if (ca.type && cb.type && ca.len >= 2 && cb.len >= 2) {
        const same = ca.type === cb.type;
        add(6, (same ? (ca.type === "W" ? "Two hot teams collide" : "Two struggling teams meet") : "Streak clash") +
          ": " + A + " (" + ca.type + ca.len + ") vs " + B + " (" + cb.type + cb.len + ").",
          same ? (ca.type === "W" ? "Hot teams collide" : "Strugglers meet") : "Streak clash");
      }
      add(1, "This season: " + A + " (" + rec(la) + ") vs " + B + " (" + rec(lb) + ").");

      // ---- recap (only if the game has been played)
      let recap = "";
      if (mu.pa || mu.pb) {
        const m = Math.abs(mu.pa - mu.pb), win = mu.pa > mu.pb ? A : mu.pa < mu.pb ? B : null;
        recap = win
          ? win + " won " + f1(Math.max(mu.pa, mu.pb)) + "–" + f1(Math.min(mu.pa, mu.pb)) + (m < 5 ? " in a nail-biter" : m >= 40 ? " in a blowout" : "") + "."
          : "They tied " + f1(mu.pa) + "–" + f1(mu.pb) + ".";
        if (win) recap += " Series: " + A + " " + (w + (win === A ? 1 : 0)) + "–" + (l + (win === B ? 1 : 0)) + " " + B + ".";
      }
      return {
        season: mu.season, week: mu.week, A, B, headline: headline || A + " vs " + B,
        lines: lines.sort((a, b) => b[0] - a[0]).slice(0, 5).map(x => x[1]), recap
      };
    });
  }

  return { streakLeaderboard, matchupStories };
});
