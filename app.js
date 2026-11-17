(() => {
  "use strict";

  // Supabase (EU Frankfurt). Publishable key is public by design; only the functions below are exposed.
  const SUPA_URL = "https://hnhnwnycrfixoafamnbe.supabase.co";
  const SUPA_KEY = "sb_publishable_dL_gdRbq4gPZOkZHCYioJg_m3AeA14q";
  const EXAM = "January 2027";

  const ERR = {
    INVALID_CODE: "This code does not exist. Check it again.",
    BLOCKED: "This code has been blocked. Please talk to your teacher.",
    BAD_NICK: "Nickname: 3–16 letters, numbers or _ (no spaces).",
    NICK_TAKEN: "This nickname is already taken.",
    NO_NICK: "Choose a nickname first.",
    TOO_FAST: "Slow down – please wait about a minute between two saved activities, then try again.",
    PANEL_LIMIT: "You've already logged 5 speaking sessions today. Great work – come back tomorrow!",
    BAD_OPPONENT: "This player does not exist.",
    TOO_MANY_OPEN: "You already have 5 open duels. Wait for answers first.",
    BAD_DUEL: "This duel is not available any more.",
    BAD_RESULT: "Something went wrong with your result."
  };

  async function rpc(fn, args) {
    let res;
    try {
      res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SUPA_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
    } catch (e) { throw new Error("No connection to the server."); }
    const text = await res.text(); const data = text ? JSON.parse(text) : null;
    if (!res.ok) { const k = data && data.message; throw new Error(ERR[k] || k || "Server error"); }
    return data;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem("ml_" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("ml_" + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem("ml_" + k); } catch (e) {} }
  };
  const state = { code: store.get("code", null), me: null };
  const $main = document.getElementById("main");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const MODES = {
    vocab1: { name: "Vocab · " + LISTS.vocab1.title, icon: "🔤", sub: LISTS.vocab1.sub },
    vocab2: { name: "Vocab · " + LISTS.vocab2.title, icon: "🔤", sub: LISTS.vocab2.sub },
    vocab3: { name: "Vocab · " + LISTS.vocab3.title, icon: "🔤", sub: LISTS.vocab3.sub },
    toolkit: { name: "Discussion Toolkit", icon: "🗣️", sub: "Which move fits the situation? All options are polite – only one does the job." },
    language: { name: "Language Lab", icon: "🛠️", sub: "Germanisms, false friends, collocations, reporting verbs" },
    argument: { name: "Argument Lab", icon: "🧩", sub: "Analyse opinion pieces: structure, techniques, reporting verbs (part I)" },
    quiz: { name: "Media & Shakespeare Quiz", icon: "❓", sub: "Concepts, cases and Shakespeare – think twice!" }
  };

  // seeded random
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, rand) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const newSeed = () => Math.floor(Math.random() * 2147483647);

  // answer checking
  function norm(s) {
    return String(s).toLowerCase().replace(/[’`´]/g, "'").replace(/…|\.\.\./g, "").replace(/\bsomething\b/g, "sth").replace(/\bsth\.?/g, "sth")
      .replace(/\bsomebody\b|\bsomeone\b/g, "sb").replace(/\bsb\.?/g, "sb").replace(/[.!?,;:]+/g, "").replace(/^to\s+/, "")
      .replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").replace(/\s*\/\s*/g, " / ").trim();
  }
  const isCorrect = (input, answers) => norm(input).length > 0 && answers.some((a) => norm(a) === norm(input));
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  const almost = (input, answers) => answers.some((a) => lev(norm(input), norm(a)) === 1);

  function level(xp) {
    let cur = LEVELS[0], next = null;
    LEVELS.forEach((l, i) => { if (xp >= l[0]) { cur = l; next = LEVELS[i + 1] || null; } });
    return { name: cur[1], next: next ? next[1] : null, toNext: next ? next[0] - xp : 0, pct: next ? Math.round(((xp - cur[0]) / (next[0] - cur[0])) * 100) : 100 };
  }
  function touchStreak() {
    const today = new Date().toISOString().slice(0, 10); const s = store.get("streak", { last: null, days: 0 });
    if (s.last === today) return; const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    s.days = s.last === y ? s.days + 1 : 1; s.last = today; store.set("streak", s);
  }
  function renderMe() {
    const el = document.getElementById("me");
    el.innerHTML = state.me && state.me.nickname ? `<b>${esc(state.me.nickname)}</b> · ${esc(level(state.me.xp).name)}<br>${state.me.xp} XP` : (state.code ? "" : "not signed in");
  }
  async function refreshMe() { if (state.code) { try { state.me = await rpc("login", { p_code: state.code }); renderMe(); } catch (e) {} } }

  function go(tab, arg) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.go === tab));
    window.scrollTo(0, 0);
    ({ home: viewHome, learn: viewLearn, practice: viewPractice, speak: viewSpeak, duels: viewDuels, ranking: viewRanking })[tab](arg);
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { e.preventDefault(); go(b.dataset.go); } });

  // ---------- Home / sign in ----------
  function viewHome() {
    if (!state.code) return viewSignIn();
    if (state.me && !state.me.nickname) return viewNickname();
    const me = state.me || { xp: 0, week: 0 };
    const lv = level(me.xp); const streak = store.get("streak", { days: 0 }).days;
    $main.innerHTML = `
      <div class="card hero"><h1>Welcome back, ${esc(me.nickname || "")}! 📰</h1>
        <div class="row" style="justify-content:space-between">
          <div><div class="muted">Rank</div><div class="stat" style="color:#fff">${esc(lv.name)}</div></div>
          <div><div class="muted">XP</div><div class="stat" style="color:#fff">${me.xp}</div></div>
          <div><div class="muted">This week</div><div class="stat" style="color:#fff">${me.week}</div></div>
          <div><div class="muted">Streak</div><div class="stat" style="color:#fff">🔥 ${streak}</div></div>
        </div>
        <div class="levelbar" style="margin-top:10px"><div style="width:${lv.pct}%"></div></div>
        <div class="muted" style="margin-top:6px">${lv.next ? `${lv.toNext} XP to <b>${esc(lv.next)}</b>` : "Editor-in-Chief – the newsroom is yours! 🏆"} ${me.team ? ` · Exam group <b>${me.team}</b>` : ""}</div>
      </div>
      <div class="card"><b>🎯 Countdown: oral exam in ${EXAM}</b><p class="muted">Part I: present the line of argument of your text · Part II: discuss with your group. Train both here – and remember: language counts 30 of 50 points.</p></div>
      <div class="grid">
        <div class="tile" data-go="learn"><b>📚 Learn</b><small>Flashcards, discussion phrases, argument structure</small></div>
        <div class="tile" data-go="practice"><b>🎯 Practice</b><small>Vocab, toolkit, language lab, argument lab, quiz</small></div>
        <div class="tile" data-go="speak"><b>🎙️ Speak</b><small>Present a text (part I), quick responses, panel cards (part II)</small></div>
        <div class="tile" data-go="duels"><b>⚔️ Duels</b><small>Challenge a classmate</small></div>
        <div class="tile" data-go="ranking"><b>🏆 Ranking</b><small>Exam groups & top 10</small></div>
      </div>
      ${me.course === "teacher" ? '<p class="center" style="margin-top:20px"><a class="btn alt" href="teacher.html">🧑‍🏫 Teacher dashboard</a></p>' : ""}
      <p class="muted center" style="margin-top:20px"><a href="#" id="logout">Sign out on this device</a></p>`;
    document.getElementById("logout").onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (window.confirm("Sign out? Keep your code – you need it to sign in again.")) { store.del("code"); state.code = null; state.me = null; renderMe(); go("home"); } };
  }
  function viewSignIn() {
    $main.innerHTML = `<div class="card hero"><h1>Welcome to the Media Lab 📰</h1><p class="muted">Vocabulary, discussion skills and the content of our unit – train for your oral exam and compete with your course.</p></div>
      <div class="card"><h2>Sign in with your code</h2><p class="muted">You get your code from your teacher (e.g. INK-4K7P).</p>
        <input type="text" id="code" placeholder="INK-4K7P" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false">
        <div class="row" style="margin-top:12px"><button class="btn" id="go">Sign in</button></div><div class="err" id="err"></div></div>
      <div class="card"><h2>No code yet?</h2><p class="muted">You can still learn and practise. Your points are not saved.</p><button class="btn alt" data-go="learn">Start learning</button></div>`;
    const inp = document.getElementById("code"); inp.focus();
    const submit = async () => { const code = inp.value.trim().toUpperCase(); if (!code) return;
      try { state.me = await rpc("login", { p_code: code }); state.code = code; store.set("code", code); renderMe(); go("home"); } catch (e) { document.getElementById("err").textContent = e.message; } };
    document.getElementById("go").onclick = submit; inp.onkeydown = (e) => { if (e.key === "Enter") submit(); };
  }
  function viewNickname() {
    $main.innerHTML = `<div class="card"><h1>Choose your nickname</h1><p class="muted">Everybody sees it in the ranking. <b>Don't use your real name.</b> 3–16 letters or numbers.</p>
      <input type="text" id="nick" placeholder="e.g. BreakingNews7" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="16">
      <div class="row" style="margin-top:12px"><button class="btn" id="save">Save</button></div><div class="err" id="err"></div></div>`;
    const inp = document.getElementById("nick"); inp.focus();
    const save = async () => { try { state.me = await rpc("set_nickname", { p_code: state.code, p_nick: inp.value.trim() }); renderMe(); go("home"); } catch (e) { document.getElementById("err").textContent = e.message; } };
    document.getElementById("save").onclick = save; inp.onkeydown = (e) => { if (e.key === "Enter") save(); };
  }

  // ---------- Learn ----------
  function viewLearn() {
    const tiles = Object.entries(LISTS).map(([k, l]) => {
      const boxes = store.get("box_" + k, {}); const n = l.words.length;
      const known = l.words.filter((w) => (boxes[w[0]] || 0) >= 1).length, mastered = l.words.filter((w) => (boxes[w[0]] || 0) >= 3).length;
      const pct = Math.round((l.words.reduce((s, w) => s + Math.min(boxes[w[0]] || 0, 3), 0) / (3 * n)) * 100);
      return `<div class="tile" data-list="${k}"><b>${esc(l.title)}</b><small>${esc(l.sub)} · ${n} words</small><div class="progress"><div style="width:${pct}%"></div></div><small>✔ ${known} known · ⭐ ${mastered} mastered</small></div>`;
    }).join("");
    $main.innerHTML = `<h1>📚 Learn</h1><h2>Vocabulary (flashcards)</h2><div class="grid">${tiles}</div>
      <h2>Skills</h2><div class="grid">
        <div class="tile" id="phr"><b>🗣️ Discussion phrases</b><small>Conceding, clarifying, interrupting, referring, compromising …</small></div>
        <div class="tile" id="arg"><b>🧩 Line of argument</b><small>Building blocks, persuasive techniques, reporting verbs</small></div></div>`;
    $main.querySelectorAll("[data-list]").forEach((t) => (t.onclick = () => flashcards(t.dataset.list)));
    document.getElementById("phr").onclick = phrases; document.getElementById("arg").onclick = argumentHelp;
  }
  function flashcards(key) {
    const list = LISTS[key]; const boxes = store.get("box_" + key, {}); let dir = store.get("dir", "de");
    const queue = shuffle(list.words, rng(newSeed())).sort((a, b) => (boxes[a[0]] || 0) - (boxes[b[0]] || 0)).slice(0, 15);
    let i = 0, flipped = false, done = 0;
    const draw = () => {
      if (i >= queue.length) { touchStreak();
        $main.innerHTML = `<div class="card center"><div class="big">🎉</div><h1>Round finished!</h1><p class="muted">${done} cards known in this round.</p><div class="row" style="justify-content:center"><button class="btn" id="again">Next round</button><button class="btn alt" data-go="learn">Back</button></div></div>`;
        document.getElementById("again").onclick = () => flashcards(key); return; }
      const w = queue[i], box = boxes[w[0]] || 0;
      $main.innerHTML = `<div class="row" style="justify-content:space-between"><h1>${esc(list.title)}</h1>
          <div class="toggle"><button data-dir="de" class="${dir === "de" ? "on" : ""}">DE → EN</button><button data-dir="en" class="${dir === "en" ? "on" : ""}">EN → DE</button></div></div>
        <div class="progress"><div style="width:${(i / queue.length) * 100}%"></div></div>
        <div class="flash ${flipped ? "back" : ""}" id="card">${esc(flipped ? (dir === "de" ? w[1] : w[0]) : (dir === "de" ? w[0] : w[1]))}</div>
        <p class="muted center">${flipped ? "Did you know it?" : "Think of the answer, then tap the card."} · Box ${box + 1}/5</p>
        <div class="row" style="justify-content:center">${flipped ? `<button class="btn lime" id="yes">✔ I knew it</button><button class="btn alt" id="no">✘ Not yet</button>` : `<button class="btn" id="flip">Show answer</button>`}</div>`;
      $main.querySelectorAll("[data-dir]").forEach((b) => (b.onclick = () => { dir = b.dataset.dir; store.set("dir", dir); flipped = false; draw(); }));
      const flip = () => { flipped = true; draw(); };
      if (!flipped) { document.getElementById("card").onclick = flip; document.getElementById("flip").onclick = flip; }
      else {
        document.getElementById("yes").onclick = () => { boxes[w[0]] = Math.min(box + 1, 4); store.set("box_" + key, boxes); done++; i++; flipped = false; draw(); };
        document.getElementById("no").onclick = () => { boxes[w[0]] = 0; store.set("box_" + key, boxes); queue.push(w); i++; flipped = false; draw(); };
      }
    };
    draw();
  }
  function phrases() {
    $main.innerHTML = `<h1>🗣️ Discussion phrases</h1><p class="muted">Use at least one phrase from each box in every discussion. Your goal for part II: react to others, not just state your opinion.</p>
      ${TOOLKIT_PHRASES.map((g) => `<div class="card"><b>${esc(g.f)}</b><ul>${g.p.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}
      <div class="row"><button class="btn" data-go="practice">Practise the toolkit</button><button class="btn alt" data-go="speak">Use it: panel cards</button></div>`;
  }
  function argumentHelp() {
    $main.innerHTML = `<h1>🧩 Presenting a line of argument</h1>
      <div class="card"><b>The building blocks</b><ul>${FUNCTIONS.map((f) => `<li><b>${esc(f)}</b> – ${esc(FUNCTION_HELP[f])}</li>`).join("")}</ul>
        <p class="muted">Careful: real texts don't follow a fixed order. Many start with an anecdote or with the opposing view, some save the claim for the end.</p></div>
      <div class="card"><b>Persuasive techniques</b><ul>${TECHNIQUES.map((t) => `<li><b>${esc(t[0])}</b> – ${esc(t[1])}</li>`).join("")}</ul></div>
      <div class="card"><b>Reporting verbs (what the author does)</b><ul>${REPORTING_VERBS.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></div>
      <div class="card"><b>Part I – how to present your text</b><ol>
        <li><b>Introduction:</b> In her blog post '…', published on/in …, the author argues that …</li>
        <li><b>Structure:</b> She begins by … · She supports this by … · She then concedes that … · However, she counters this by … · She concludes by …</li>
        <li><b>Your view:</b> I (partly) agree with her because …</li></ol>
        <p class="muted">Useful verbs: argue, claim, point out, illustrate, concede, admit, counter, reject, emphasise, conclude, call for.</p></div>
      <div class="row"><button class="btn" id="try">Try the Argument Lab (no points)</button><button class="btn alt" data-go="learn">Back</button></div>`;
    document.getElementById("try").onclick = () => playRound({ mode: "argument", seed: newSeed(), scored: false });
  }

  // ---------- Practice ----------
  function viewPractice() {
    $main.innerHTML = `<h1>🎯 Practice</h1><p class="muted">10 questions per round. Every correct answer = 1 XP${state.code ? "" : " (sign in to save your XP)"}.</p>
      <div class="grid">${Object.entries(MODES).map(([k, m]) => `<div class="tile" data-mode="${k}"><b>${m.icon} ${esc(m.name)}</b><small>${esc(m.sub)}</small></div>`).join("")}</div>`;
    $main.querySelectorAll("[data-mode]").forEach((t) => (t.onclick = () => playRound({ mode: t.dataset.mode, seed: newSeed(), scored: !!state.code })));
  }
  function renderText(text, h) {
    let html = "<p>";
    text.s.forEach((s, k) => {
      if (k > 0 && text.br.includes(k)) html += "</p><p>";
      html += k === h ? `<span class="hl">${esc(s)}</span> ` : `${esc(s)} `;
    });
    return html + "</p>";
  }
  function buildRound(mode, seed) {
    const rand = rng(seed);
    if (mode.startsWith("vocab")) return shuffle(LISTS[mode].words, rand).slice(0, 10).map((w) => ({ t: "type", q: w[0], answers: w.slice(1) }));
    const opts = (x) => shuffle(x.o.map((o, i) => ({ o, ok: i === x.a })), rand);
    if (mode === "toolkit") return shuffle(TOOLKIT, rand).slice(0, 10).map((x) => ({ t: "mc", head: "What's the best move?", q: x.s, opts: opts(x), why: x.why }));
    if (mode === "language") return shuffle(LANGUAGE, rand).slice(0, 10).map((x) => ({ t: "mc", head: "Language Lab", q: x.k, opts: opts(x), why: x.why }));
    if (mode === "quiz") return shuffle(QUIZ, rand).slice(0, 10).map((x) => ({ t: "mc", head: "Quiz", q: x.q, opts: opts(x) }));
    if (mode === "argument") {
      // two texts, five analysis questions each
      return shuffle(ARGUMENTS, rand).slice(0, 2).flatMap((text) => text.q.map((x) => ({ t: "text", text, h: x.h, q: x.k, opts: opts(x), why: x.why })));
    }
  }
  function playRound(opts) {
    const qs = buildRound(opts.mode, opts.seed); let i = 0, score = 0; const started = Date.now();
    const next = () => { i++; i < qs.length ? draw() : finish(); };
    const header = () => `<div class="row" style="justify-content:space-between"><b>${esc(MODES[opts.mode].name)}</b><span class="muted">${i + 1} / ${qs.length} · ✔ ${score}</span></div><div class="progress"><div style="width:${(i / qs.length) * 100}%"></div></div>`;
    const fb = (ok, text) => `<div class="feedback ${ok ? "ok" : "bad"}">${ok ? "✔ Correct!" : "✘ " + text}</div><div class="row" style="margin-top:12px"><button class="btn" id="next">Next ➜</button></div>`;
    const bindNext = () => { const b = document.getElementById("next"); b.onclick = next; b.focus(); };
    function draw() {
      const q = qs[i];
      if (q.t === "type") {
        $main.innerHTML = `${header()}<div class="card"><div class="muted">Translate into English:</div><div class="prompt">${esc(q.q)}</div>
          <input type="text" id="ans" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"><div class="row" style="margin-top:12px"><button class="btn" id="check">Check</button></div><div id="fb"></div></div>`;
        const inp = document.getElementById("ans"); inp.focus(); let done = false;
        const check = () => { if (done) return; done = true; inp.disabled = true; document.getElementById("check").remove();
          const ok = isCorrect(inp.value, q.answers); if (ok) score++;
          document.getElementById("fb").innerHTML = fb(ok, (!ok && almost(inp.value, q.answers) ? "Almost! Check your spelling: " : "Correct answer: ") + "<b>" + esc(q.answers[0]) + "</b>"); bindNext(); };
        document.getElementById("check").onclick = check; inp.onkeydown = (e) => { if (e.key === "Enter") check(); };
      } else if (q.t === "mc") {
        $main.innerHTML = `${header()}<div class="card"><div class="muted">${esc(q.head)}</div><div class="prompt" style="font-size:20px">${esc(q.q)}</div>
          <div class="choices" style="grid-template-columns:1fr">${q.opts.map((o, k) => `<button data-k="${k}" style="text-align:left;font-size:17px">${esc(o.o)}</button>`).join("")}</div><div id="fb"></div></div>`;
        const btns = $main.querySelectorAll("[data-k]");
        btns.forEach((b) => (b.onclick = () => { const o = q.opts[+b.dataset.k];
          btns.forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.k].ok) x.classList.add("ok"); });
          if (o.ok) score++; else b.classList.add("bad");
          document.getElementById("fb").innerHTML = fb(o.ok, "Better: <b>" + esc(q.opts.find((x) => x.ok).o) + "</b>") + (q.why ? `<p class="muted">💡 ${esc(q.why)}</p>` : ""); bindNext(); }));
      } else if (q.t === "text") {
        $main.innerHTML = `${header()}<div class="card"><h2 style="margin:0">“${esc(q.text.t)}”</h2><div class="muted">${esc(q.text.by)}</div>
          <div class="textbox" style="margin-top:10px">${renderText(q.text, q.h)}</div></div>
          <div class="card"><div class="prompt" style="font-size:19px">${q.h === null ? "" : "🖍️ "}${esc(q.q)}</div>
          <div class="choices" style="grid-template-columns:1fr">${q.opts.map((o, k) => `<button data-k="${k}" style="text-align:left;font-size:16px">${esc(o.o)}</button>`).join("")}</div><div id="fb"></div></div>`;
        const btns = $main.querySelectorAll("[data-k]");
        btns.forEach((b) => (b.onclick = () => { const o = q.opts[+b.dataset.k];
          btns.forEach((x) => { x.disabled = true; if (q.opts[+x.dataset.k].ok) x.classList.add("ok"); });
          if (o.ok) score++; else b.classList.add("bad");
          document.getElementById("fb").innerHTML = fb(o.ok, "Better: <b>" + esc(q.opts.find((x) => x.ok).o) + "</b>") + (q.why ? `<p class="muted">💡 ${esc(q.why)}</p>` : ""); bindNext();
          document.getElementById("fb").scrollIntoView({ behavior: "smooth", block: "nearest" }); }));
        window.scrollTo(0, 0);
      } else if (q.t === "label") {
        const textHtml = q.text.s.map((s, k) => k < q.k ? `<span class="done">${esc(s[0])} </span>` : k === q.k ? `<span class="hl">${esc(s[0])}</span> ` : "").join("");
        $main.innerHTML = `${header()}<div class="card"><div class="muted">What is the function of the highlighted sentence?</div><h2 style="margin-top:6px">“${esc(q.text.t)}”</h2>
          <p class="textbox">${textHtml}</p><div class="fn">${FUNCTIONS.map((f) => `<button data-f="${f}" title="${esc(FUNCTION_HELP[f])}">${esc(f)}</button>`).join("")}</div><div id="fb"></div></div>`;
        const btns = $main.querySelectorAll("[data-f]");
        btns.forEach((b) => (b.onclick = () => { const ok = b.dataset.f === q.a; if (ok) score++; else b.classList.add("bad");
          btns.forEach((x) => { x.disabled = true; if (x.dataset.f === q.a) x.classList.add("ok"); });
          document.getElementById("fb").innerHTML = fb(ok, `It's a <b>${esc(q.a)}</b> – ${esc(FUNCTION_HELP[q.a])}.`); bindNext(); }));
      }
    }
    async function finish() {
      const secs = Math.round((Date.now() - started) / 1000); touchStreak();
      $main.innerHTML = `<div class="card center"><div class="big">${score >= 9 ? "🏆" : score >= 6 ? "👍" : "💪"}</div><h1>${score} / ${qs.length}</h1><p class="muted">Time: ${secs} s</p>
        <div id="srv" class="muted">${opts.scored ? "Saving …" : opts.duel ? "Sending …" : "Practice only – no points saved."}</div>
        <div class="row" style="justify-content:center;margin-top:14px"><button class="btn" id="again">Play again</button><button class="btn alt" data-go="${opts.duel ? "duels" : "practice"}">Back</button></div></div>`;
      document.getElementById("again").onclick = () => opts.duel ? go("duels") : playRound({ ...opts, seed: newSeed() });
      const srv = document.getElementById("srv");
      try {
        if (opts.duel && opts.duel.kind === "create") {
          await rpc("create_duel", { p_code: state.code, p_opponent: opts.duel.opponent, p_mode: opts.mode, p_seed: opts.seed, p_score: score, p_time: secs });
          srv.innerHTML = `Duel sent to <b>${esc(opts.duel.opponent)}</b>. +${score} XP. Now it's their turn! ⚔️`;
        } else if (opts.duel && opts.duel.kind === "answer") {
          const r = await rpc("play_duel", { p_code: state.code, p_duel: opts.duel.id, p_score: score, p_time: secs });
          srv.innerHTML = `<b>${{ win: "You won! 🎉 +5 bonus XP", loss: "You lost this time. 💪", draw: "Draw! +2 bonus XP" }[r.result]}</b><br>${esc(opts.duel.other)}: ${r.other_score} / 10 in ${r.other_time} s`;
        } else if (opts.scored) {
          state.me = await rpc("submit_result", { p_code: state.code, p_mode: opts.mode, p_score: score, p_total: qs.length }); srv.innerHTML = `+${score} XP saved ✔`;
        }
        await refreshMe();
      } catch (e) { srv.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
    }
    draw();
  }

  // ---------- Speak (part II training) ----------
  function viewSpeak() {
    const done = state.me ? state.me.panel_today : 0;
    $main.innerHTML = `<h1>🎙️ Speak</h1>
      <p class="muted">Every speaking session = 3 XP (max. 5 per day${state.code ? `, today: ${done}/5` : ""}). Be honest – it's your exam. 😉 Tip: record yourself and listen to it.</p>
      <div class="grid">
        <div class="tile" id="sp1"><b>📄 Part I: present a text</b><small>Read an opinion piece (3 min), then present its line of argument (2 min).</small></div>
        <div class="tile" id="sp2"><b>⚡ Quick response</b><small>A provocative statement – 30 seconds to react with a given discussion move.</small></div>
        <div class="tile" id="draw"><b>🎴 Part II: panel card</b><small>1 min to prepare, 3 min to discuss with your group or a partner.</small></div>
      </div>
      <div class="card" style="margin-top:12px"><b>All panel cards</b><ul class="list">${PANEL.map((p, k) => `<li><span>${esc(p.q)}</span><button class="btn small alt" data-p="${k}">Use</button></li>`).join("")}</ul></div>`;
    document.getElementById("draw").onclick = () => panel(Math.floor(Math.random() * PANEL.length));
    document.getElementById("sp1").onclick = () => presentText(Math.floor(Math.random() * ARGUMENTS.length));
    document.getElementById("sp2").onclick = () => drill(shuffle(DRILLS, rng(newSeed())), 0);
    $main.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => panel(+b.dataset.p)));
  }
  function runTimer(el, ph, secs, label, then) {
    let left = secs; ph.textContent = label; clearInterval(timerId);
    const show = () => { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; };
    show(); timerId = setInterval(() => { left--; show(); if (left <= 0) { clearInterval(timerId); then && then(); } }, 1000);
  }
  function logButton(checkSel, min) {
    return async () => {
      const n = $main.querySelectorAll(checkSel + ":checked").length; const res = document.getElementById("res");
      if (!state.code) { res.innerHTML = '<p class="muted">Well done! Sign in to collect XP for speaking.</p>'; return; }
      if (n < min) { res.innerHTML = `<p class="err">Tick what you managed to do (at least ${min}).</p>`; return; }
      try { state.me = await rpc("submit_panel", { p_code: state.code, p_functions: n }); renderMe(); touchStreak(); clearInterval(timerId);
        res.innerHTML = `<div class="feedback ok">+3 XP saved ✔ – ${n} point${n === 1 ? "" : "s"} on your checklist.</div>`; document.getElementById("log").disabled = true; }
      catch (e) { res.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
  }
  function presentText(k) {
    const text = ARGUMENTS[k]; clearInterval(timerId);
    const checks = ["Introductory sentence: title, author, type of text, main claim", "Structure: how the text begins, develops and ends", "At least three precise reporting verbs (argues, concedes, dismisses …)", "One persuasive technique and its effect", "Your own, reasoned opinion", "Spoke freely, with notes only"];
    $main.innerHTML = `<div class="card"><div class="muted">Part I practice – present the line of argument</div><h2 style="margin:4px 0">“${esc(text.t)}”</h2><div class="muted">${esc(text.by)}</div>
        <div class="textbox" style="margin-top:10px">${renderText(text, -1)}</div></div>
      <div class="card"><div class="timer" id="t">3:00</div><p class="center muted" id="phase">Reading and notes: claim, structure, techniques.</p>
        <div class="row" style="justify-content:center"><button class="btn" id="start">▶ Start</button><button class="btn alt" id="skip">I'm ready – start presenting</button><button class="btn alt" id="other">Other text</button></div></div>
      <div class="card"><b>Checklist after your presentation</b>${checks.map((c, n) => `<label class="check"><input type="checkbox" data-c="${n}"> <span>${esc(c)}</span></label>`).join("")}
        <div class="row" style="margin-top:12px"><button class="btn lime" id="log">✔ Log session (+3 XP)</button><button class="btn alt" data-go="speak">Back</button></div><div id="res"></div>
        <p class="muted">Then check yourself: do the Argument Lab questions for this text in Practice.</p></div>`;
    const t = document.getElementById("t"), ph = document.getElementById("phase");
    const present = () => runTimer(t, ph, 120, "Present now: introduction – structure – techniques – your opinion.", () => { ph.textContent = "Time's up – tick your checklist."; });
    document.getElementById("start").onclick = () => runTimer(t, ph, 180, "Reading and notes: claim, structure, techniques.", present);
    document.getElementById("skip").onclick = present;
    document.getElementById("other").onclick = () => presentText((k + 1) % ARGUMENTS.length);
    document.getElementById("log").onclick = logButton("[data-c]", 2);
  }
  function drill(list, n) {
    const d = list[n % list.length]; clearInterval(timerId);
    $main.innerHTML = `<div class="card hero"><div class="muted">Quick response · ${n + 1}</div><h1 style="margin-top:4px">“${esc(d.st)}”</h1><p style="margin:0"><b>Your move:</b> ${esc(d.fn)}</p></div>
      <div class="card"><div class="timer" id="t">0:30</div><p class="center muted" id="phase">Read the statement – press start and answer out loud.</p>
        <div class="row" style="justify-content:center"><button class="btn" id="start">▶ Start (30 s)</button><button class="btn alt" id="next">Next statement ➜</button></div></div>
      <div class="card"><b>Need help?</b> <button class="btn small alt" id="help">Show phrases</button><div id="ph"></div></div>
      <div class="card"><b>After 3 or more statements: log your session</b>
        <label class="check"><input type="checkbox" data-c="0"> <span>I answered at least three statements out loud.</span></label>
        <label class="check"><input type="checkbox" data-c="1"> <span>I used the required move each time.</span></label>
        <label class="check"><input type="checkbox" data-c="2"> <span>I gave a reason or an example each time.</span></label>
        <div class="row" style="margin-top:12px"><button class="btn lime" id="log">✔ Log session (+3 XP)</button><button class="btn alt" data-go="speak">Back</button></div><div id="res"></div></div>`;
    const t = document.getElementById("t"), ph = document.getElementById("phase");
    document.getElementById("start").onclick = () => runTimer(t, ph, 30, "Go! Use the required move.", () => { ph.textContent = "Time's up – next statement?"; });
    document.getElementById("next").onclick = () => drill(list, n + 1);
    document.getElementById("help").onclick = () => { document.getElementById("ph").innerHTML = TOOLKIT_PHRASES.map((g) => `<p><b>${esc(g.f)}:</b> ${g.p.map(esc).join(" · ")}</p>`).join(""); };
    document.getElementById("log").onclick = logButton("[data-c]", 1);
  }
  let timerId = null;
  function panel(k) {
    const p = PANEL[k]; clearInterval(timerId);
    $main.innerHTML = `<div class="card hero"><div class="muted">Panel discussion</div><h1 style="margin-top:4px">${esc(p.q)}</h1></div>
      <div class="card"><b>Think about …</b><ul>${p.think.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p><b>Solution question:</b> ${esc(p.sol)}</p></div>
      <div class="card"><div class="timer" id="t">1:00</div><p class="center muted" id="phase">Preparation: collect arguments and examples.</p>
        <div class="row" style="justify-content:center"><button class="btn" id="start">▶ Start</button><button class="btn alt" id="skip">Skip to discussion</button></div></div>
      <div class="card"><b>Which moves did you use?</b>
        ${TOOLKIT_PHRASES.map((g, n) => `<label class="check"><input type="checkbox" data-c="${n}"> <span><b>${esc(g.f)}</b><br><span class="muted">${esc(g.p[0])}</span></span></label>`).join("")}
        <div class="row" style="margin-top:12px"><button class="btn lime" id="log">✔ Log session (+3 XP)</button><button class="btn alt" data-go="speak">Back</button></div><div id="res"></div></div>`;
    const t = document.getElementById("t"), ph = document.getElementById("phase");
    const run = (secs, label, then) => { let left = secs; ph.textContent = label; clearInterval(timerId);
      const show = () => { t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; };
      show(); timerId = setInterval(() => { left--; show(); if (left <= 0) { clearInterval(timerId); then && then(); } }, 1000); };
    const discuss = () => run(180, "Discussion: react to each other, use your phrases, look for a solution!", () => { ph.textContent = "Time's up – now tick the moves you used."; });
    document.getElementById("start").onclick = () => run(60, "Preparation: collect arguments and examples.", discuss);
    document.getElementById("skip").onclick = discuss;
    document.getElementById("log").onclick = async () => {
      const n = $main.querySelectorAll("[data-c]:checked").length; const res = document.getElementById("res");
      if (!state.code) { res.innerHTML = '<p class="muted">Well done! Sign in to collect XP for speaking.</p>'; return; }
      if (n === 0) { res.innerHTML = '<p class="err">Tick at least one move you used.</p>'; return; }
      try { state.me = await rpc("submit_panel", { p_code: state.code, p_functions: n }); renderMe(); touchStreak(); clearInterval(timerId);
        res.innerHTML = `<div class="feedback ok">+3 XP – ${n} discussion move${n === 1 ? "" : "s"} used. Next time try one more! 💪</div>`; document.getElementById("log").disabled = true; }
      catch (e) { res.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
  }

  // ---------- Duels ----------
  async function viewDuels() {
    if (!state.code) { $main.innerHTML = `<h1>⚔️ Duels</h1><div class="card"><p>Sign in with your code to challenge others.</p><button class="btn" data-go="home">Sign in</button></div>`; return; }
    $main.innerHTML = `<h1>⚔️ Duels</h1><p class="muted">Loading …</p>`;
    let duels, players;
    try { [duels, players] = await Promise.all([rpc("my_duels", { p_code: state.code }), rpc("list_players", { p_code: state.code })]); }
    catch (e) { $main.innerHTML = `<h1>⚔️ Duels</h1><p class="err">${esc(e.message)}</p>`; return; }
    const todo = duels.filter((d) => d.status === "open" && !d.i_challenged), waiting = duels.filter((d) => d.status === "open" && d.i_challenged), done = duels.filter((d) => d.status === "done");
    const res = (d) => d.my_score > d.other_score || (d.my_score === d.other_score && d.my_time < d.other_time) ? "🏆 won" : d.my_score === d.other_score && d.my_time === d.other_time ? "🤝 draw" : "lost";
    $main.innerHTML = `<h1>⚔️ Duels</h1>
      <div class="card"><h2 style="margin-top:0">New duel</h2><p class="muted">You play 10 questions first, then your opponent gets the same ones. More points win – if it's a draw, the faster player wins. Winner: +5 XP.</p>
        <input type="text" id="opp" list="players" placeholder="Nickname of your opponent" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false">
        <datalist id="players">${players.map((p) => `<option value="${esc(p.nickname)}">`).join("")}</datalist>
        <p class="muted" style="margin:12px 0 0">Then tap a topic to start:</p>
        <div class="row" style="margin-top:8px">${Object.entries(MODES).map(([k, m]) => `<button class="btn small alt" data-dm="${k}">${m.icon} ${esc(m.name.replace("Vocab · ", ""))}</button>`).join("")}</div><div class="err" id="err"></div></div>
      <div class="card"><h2 style="margin-top:0">Your turn (${todo.length})</h2>${todo.length ? `<ul class="list">${todo.map((d) => `<li><span><b>${esc(d.other)}</b> challenged you · ${esc(MODES[d.mode].name)}</span><button class="btn small" data-play="${d.id}">Play</button></li>`).join("")}</ul>` : '<p class="muted">No open challenges.</p>'}</div>
      <div class="card"><h2 style="margin-top:0">Waiting for … (${waiting.length})</h2>${waiting.length ? `<ul class="list">${waiting.map((d) => `<li><span><b>${esc(d.other)}</b> · ${esc(MODES[d.mode].name)}</span><span class="muted">you: ${d.my_score}/10</span></li>`).join("")}</ul>` : '<p class="muted">Nothing open.</p>'}</div>
      <div class="card"><h2 style="margin-top:0">Results</h2>${done.length ? `<ul class="list">${done.map((d) => `<li><span>vs. <b>${esc(d.other)}</b> · ${d.my_score}:${d.other_score}</span><span>${res(d)}</span></li>`).join("")}</ul>` : '<p class="muted">No results yet.</p>'}</div>`;
    $main.querySelectorAll("[data-dm]").forEach((b) => (b.onclick = () => { const opp = document.getElementById("opp").value.trim(); const known = players.find((p) => p.nickname.toLowerCase() === opp.toLowerCase());
      if (!known) { document.getElementById("err").textContent = "Choose a nickname from the list."; return; }
      playRound({ mode: b.dataset.dm, seed: newSeed(), scored: false, duel: { kind: "create", opponent: known.nickname } }); }));
    $main.querySelectorAll("[data-play]").forEach((b) => (b.onclick = () => { const d = todo.find((x) => String(x.id) === b.dataset.play); playRound({ mode: d.mode, seed: d.seed, scored: false, duel: { kind: "answer", id: d.id, other: d.other } }); }));
  }

  // ---------- Ranking ----------
  async function viewRanking() {
    $main.innerHTML = `<h1>🏆 Ranking</h1><p class="muted">Loading …</p>`;
    let lb; try { lb = await rpc("leaderboard"); } catch (e) { $main.innerHTML = `<h1>🏆 Ranking</h1><p class="err">${esc(e.message)}</p>`; return; }
    const mine = state.me && state.me.nickname, max = Math.max(1, ...lb.teams.map((t) => t.per_player));
    const table = (rows) => rows.length ? `<table class="rank">${rows.map((r, n) => `<tr${r.nickname === mine ? ' style="background:#fbfce9"' : ""}><td>${n + 1}.</td><td>${esc(r.nickname)}${r.team ? ` <span class="badge team">G${r.team}</span>` : ""}</td><td>${r.pts}</td></tr>`).join("")}</table>` : '<p class="muted">No points yet – be the first!</p>';
    const teacherNote = state.me && state.me.course === "teacher" ? `<div class="card"><b>🧑‍🏫 Teacher account</b><p class="muted">Not part of the ranking. Your XP: ${state.me.xp}.</p></div>` : "";
    $main.innerHTML = `<h1>🏆 Ranking</h1>${teacherNote}
      <div class="card"><h2 style="margin-top:0">Exam groups (this week)</h2><p class="muted">Points per member – you prepare for the exam as a team!</p>
        ${lb.teams.length ? lb.teams.map((t, n) => `<div><b>${n === 0 ? "🥇 " : n === 1 ? "🥈 " : n === 2 ? "🥉 " : ""}Group ${t.team}</b> <span class="muted">· ${esc(t.members)}</span>
          <div class="bar"><div style="width:${Math.max(8, (t.per_player / max) * 100)}%;background:var(--petrol)">${t.per_player}</div></div></div>`).join("") : '<p class="muted">The groups appear as soon as your teacher has assigned the exam groups.</p>'}</div>
      <div class="card"><h2 style="margin-top:0">Top 10 this week</h2>${table(lb.week_top)}<p class="muted">The weekly ranking starts again every Monday.</p></div>
      <div class="card"><h2 style="margin-top:0">Hall of Fame (all XP)</h2>${table(lb.all_top)}</div>`;
  }

  (async () => {
    if (state.code) { try { state.me = await rpc("login", { p_code: state.code }); } catch (e) { if (e.message === ERR.INVALID_CODE || e.message === ERR.BLOCKED) { store.del("code"); state.code = null; } } }
    renderMe(); go("home");
  })();
})();
