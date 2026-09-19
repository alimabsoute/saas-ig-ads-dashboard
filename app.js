/* SaaS IG Ad & Content Dashboard — plain JS, no dependencies. */
(function () {
  "use strict";

  var overlay = document.getElementById("overlay");
  var dialog = document.getElementById("dialog");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function badgeClass(size) {
    return size === "big brand" ? "big" : size === "indie" ? "indie" : "small";
  }

  var state = {
    tab: "paid",
    paid:    { category: "all", format: "all", size: "all", hashtag: "", q: "", sort: "run" },
    organic: { category: "all", format: "all", size: "all", hashtag: "", q: "", sort: "eng" }
  };

  var SORTS = {
    paid: [
      { v: "run", label: "Longest-running first" },
      { v: "az",  label: "Brand A–Z" }
    ],
    organic: [
      { v: "eng", label: "Highest engagement first" },
      { v: "az",  label: "Brand A–Z" }
    ]
  };

  /* ---------------- data ---------------- */

  function boot(data) {
    if (!Array.isArray(data) || !data.length) { showError(); return; }
    document.getElementById("count-paid").textContent =
      "(" + data.filter(function (e) { return e.tab === "paid"; }).length + ")";
    document.getElementById("count-organic").textContent =
      "(" + data.filter(function (e) { return e.tab === "organic"; }).length + ")";
    buildFilters("paid", data);
    buildFilters("organic", data);
    render("paid", data);
    render("organic", data);
    renderPatterns();
    wireTabs(data);
  }

  function showError() {
    document.querySelector("main .wrap, main").insertAdjacentHTML("afterbegin",
      '<div class="wrap"><div class="load-error"><strong>Could not load data.</strong> ' +
      "Serve this folder over http(s) (e.g. GitHub Pages) or keep <code>assets/data.js</code> next to <code>index.html</code>.</div></div>");
  }

  if (window.DASHBOARD_DATA && window.DASHBOARD_DATA.length) {
    boot(window.DASHBOARD_DATA);
  } else {
    fetch("assets/data.json").then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(boot).catch(showError);
  }

  /* ---------------- tabs ---------------- */

  function wireTabs(data) {
    var tabs = document.querySelectorAll("#tabs .tab");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        state.tab = t.getAttribute("data-tab");
        ["paid", "organic", "patterns"].forEach(function (name) {
          document.getElementById("view-" + name).hidden = name !== state.tab;
        });
      });
    });
  }

  /* ---------------- filters ---------------- */

  function uniqSorted(data, tab, key) {
    var seen = {};
    data.forEach(function (e) {
      if (e.tab === tab && e[key]) seen[e[key]] = true;
    });
    return Object.keys(seen).sort();
  }

  function buildFilters(tab, data) {
    var s = state[tab];
    var box = document.getElementById("filters-" + tab);
    var cats = uniqSorted(data, tab, "category");
    var fmts = uniqSorted(data, tab, "format");
    var sizes = uniqSorted(data, tab, "size");

    function opts(list, allLabel) {
      return '<option value="all">' + esc(allLabel) + "</option>" +
        list.map(function (v) { return '<option value="' + esc(v) + '">' + esc(cap(v)) + "</option>"; }).join("");
    }

    box.innerHTML =
      '<label>Category<select data-f="category">' + opts(cats, "All categories") + "</select></label>" +
      '<label>Format<select data-f="format">' + opts(fmts, "All formats") + "</select></label>" +
      '<label>Company size<select data-f="size">' + opts(sizes, "All sizes") + "</select></label>" +
      '<label>Hashtag<input type="text" data-f="hashtag" placeholder="#buildinpublic"></label>' +
      '<label>Search<input type="text" data-f="q" placeholder="brand, hook, copy…"></label>' +
      '<label>Sort<select data-f="sort">' +
        SORTS[tab].map(function (o) { return '<option value="' + o.v + '"' + (o.v === s.sort ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") +
      "</select></label>";

    box.querySelectorAll("select").forEach(function (el) {
      el.addEventListener("change", function () {
        s[el.getAttribute("data-f")] = el.value;
        render(tab, window.DASHBOARD_DATA || []);
      });
    });
    var deb = null;
    box.querySelectorAll('input[type="text"]').forEach(function (el) {
      el.addEventListener("input", function () {
        clearTimeout(deb);
        deb = setTimeout(function () {
          s[el.getAttribute("data-f")] = el.value.trim();
          render(tab, window.DASHBOARD_DATA || []);
        }, 220);
      });
    });
  }

  /* ---------------- filtering + sorting ---------------- */

  function normTag(t) { return t.replace(/^#+/, "").toLowerCase(); }

  function applyFilters(tab, data) {
    var s = state[tab];
    var q = s.q.toLowerCase();
    var hq = normTag(s.hashtag);
    var out = data.filter(function (e) {
      if (e.tab !== tab) return false;
      if (s.category !== "all" && e.category !== s.category) return false;
      if (s.format !== "all" && e.format !== s.format) return false;
      if (s.size !== "all" && e.size !== s.size) return false;
      if (hq) {
        var tags = (e.hashtags || []).map(normTag);
        if (tags.indexOf(hq) === -1 && tags.every(function (t) { return t.indexOf(hq) === -1; })) return false;
      }
      if (q) {
        var hay = [e.brand, e.account, e.hook, e.copy, e.angle, e.cta].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (tab === "paid" && s.sort === "run") {
      out.sort(function (a, b) { return (b.run_days == null ? -1 : b.run_days) - (a.run_days == null ? -1 : a.run_days); });
    } else if (tab === "organic" && s.sort === "eng") {
      out.sort(function (a, b) {
        var ra = a.engagement_rank == null ? 1e9 : a.engagement_rank;
        var rb = b.engagement_rank == null ? 1e9 : b.engagement_rank;
        return ra - rb;
      });
    } else {
      out.sort(function (a, b) { return a.brand.localeCompare(b.brand); });
    }
    return out;
  }

  /* ---------------- cards ---------------- */

  function rowHtml(label, val) {
    if (!val) return "";
    return '<div><dt>' + esc(label) + "</dt><dd>" + esc(val) + "</dd></div>";
  }

  function cardHtml(e, full) {
    var tags = (e.hashtags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    var acct = e.account ? ' <span class="acct">' + esc(e.account) + "</span>" : "";
    var libLine = e.library_id ? rowHtml("Ad ID", "Meta Ad Library ID " + e.library_id) : "";
    return (
      '<div class="card-top"><div><span class="brand">' + esc(e.brand) + "</span>" + acct + "</div>" +
      '<span class="badge ' + badgeClass(e.size) + '">' + esc(e.size) + "</span></div>" +
      '<div class="chips"><span class="chip">' + esc(e.category) + '</span><span class="chip">' + esc(cap(e.format)) + "</span></div>" +
      '<p class="hook">' + esc(e.hook) + "</p>" +
      '<p class="copy' + (full ? "" : " clamp") + '">' + esc(e.copy) + "</p>" +
      '<dl class="rows">' +
        rowHtml("Angle", e.angle) + rowHtml("CTA", e.cta) + rowHtml("Visual", e.visual) + libLine +
      "</dl>" +
      '<div class="why"><strong>Why it worked</strong><p class="' + (full ? "" : "clamp") + '">' + esc(e.why_it_worked) + "</p></div>" +
      '<p class="proof">' + esc(e.proof) + "</p>" +
      (tags ? '<div class="hashtags">' + tags + "</div>" : "") +
      (e.source_url
        ? '<a class="src" href="' + esc(e.source_url) + '" target="_blank" rel="noopener" data-stop="1">Source: ' + esc(e.source_name) + " ↗</a>"
        : '<span class="src" style="color:var(--muted)">Source: ' + esc(e.source_name) + "</span>")
    );
  }

  function render(tab, data) {
    var list = applyFilters(tab, data);
    var grid = document.getElementById("grid-" + tab);
    document.getElementById("rc-" + tab).innerHTML =
      "Showing <strong>" + list.length + "</strong> of " +
      data.filter(function (e) { return e.tab === tab; }).length;
    if (!list.length) {
      grid.innerHTML = '<div class="empty">No matches — loosen a filter or clear the search.</div>';
      return;
    }
    grid.innerHTML = list.map(function (e) {
      return '<article class="card" data-id="' + esc(e.id) + '">' + cardHtml(e, false) + "</article>";
    }).join("");
    grid.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function (ev) {
        if (ev.target.closest("[data-stop]")) return;
        openModal(card.getAttribute("data-id"), data);
      });
    });
  }

  /* ---------------- modal ---------------- */

  function openModal(id, data) {
    var e = null;
    for (var i = 0; i < data.length; i++) if (data[i].id === id) { e = data[i]; break; }
    if (!e) return;
    dialog.innerHTML =
      '<button class="close" aria-label="Close">×</button>' +
      "<h2>" + esc(e.brand) + (e.account ? ' <span class="acct">' + esc(e.account) + "</span>" : "") + "</h2>" +
      '<div class="chips" style="margin:8px 0"><span class="badge ' + badgeClass(e.size) + '">' + esc(e.size) + "</span>" +
      '<span class="chip">' + esc(e.category) + '</span><span class="chip">' + esc(cap(e.format)) + "</span>" +
      '<span class="chip">' + (e.tab === "paid" ? "Paid ad" : "Organic post") + "</span></div>" +
      '<p class="hook">' + esc(e.hook) + "</p>" +
      '<p class="copy">' + esc(e.copy) + "</p>" +
      '<dl class="rows">' + rowHtml("Angle", e.angle) + rowHtml("CTA", e.cta) + rowHtml("Visual", e.visual) +
        (e.library_id ? rowHtml("Ad ID", "Meta Ad Library ID " + e.library_id) : "") + "</dl>" +
      '<div class="why"><strong>Why it worked</strong><p>' + esc(e.why_it_worked) + "</p></div>" +
      '<p class="proof">' + esc(e.proof) + "</p>" +
      ((e.hashtags && e.hashtags.length)
        ? '<div class="hashtags">' + e.hashtags.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + "</div>"
        : "") +
      (e.source_url
        ? '<p style="margin-top:12px"><a class="src" href="' + esc(e.source_url) + '" target="_blank" rel="noopener">Source: ' + esc(e.source_name) + " ↗</a></p>"
        : '<p class="src" style="color:var(--muted)">Source: ' + esc(e.source_name) + "</p>");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    dialog.querySelector(".close").addEventListener("click", closeModal);
  }

  function closeModal() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }
  overlay.addEventListener("click", function (ev) { if (ev.target === overlay) closeModal(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeModal(); });

  /* ---------------- patterns tab ---------------- */

  var PATTERNS = [
    {
      title: "Paid ads — recurring hooks",
      items: [
        "<strong>Quantified outcome in the headline.</strong> Slack (\"Reduce your email by 48.6%\"), Sleeknote (\"400–600% more email subscribers\"), Zoom (\"58% of Fortune 500\"). Oddly precise numbers read as researched, not marketing.",
        "<strong>Pain-first questions.</strong> \"Still buried in email threads?\" (Slack variant). Name the felt pain before the product.",
        "<strong>Competitor conquest.</strong> Heap vs. Google Analytics, Search Atlas vs. Ahrefs/Semrush (\"cancel… and save thousands/month\"). Works when you anchor on a known brand and supply proof.",
        "<strong>Secret/insider framing.</strong> Hootsuite's \"little-known secret\" (verified badge in 3 steps). Curiosity + FOMO.",
        "<strong>Value equations.</strong> \"Grammarly + Gmail = Perfect Emails.\" Five-word value props.",
        "<strong>Social proof as the whole ad.</strong> Zoom's stat. Let customers and logos do the selling."
      ]
    },
    {
      title: "Paid ads — recurring angles",
      items: [
        "<strong>Objection removal up front.</strong> HubSpot (free/unlimited/secure), Dropbox (14-day trial matched to time-to-value + 2-min setup), Asana (price/features/learning curve in one ad).",
        "<strong>Problem → Agitate → Solve.</strong> The dominant B2B SaaS structure.",
        "<strong>Before/after transformation.</strong> Monday.com and Grammarly carousels/videos; the swipe-driven reveal creates curiosity engagement.",
        "<strong>Humor as pattern interrupt.</strong> Zendesk (tin-can phone), Descript (wit + \"create something human\"), Toggl (programmer comic).",
        "<strong>Borrowed authority.</strong> Adobe via TechCrunch, Datadog via Amazon's tag, Heap via client logos.",
        "<strong>Free value before the pitch.</strong> HubSpot's free Instagram ROI guide has run 6 months — lead magnets that double as trust builders.",
        "<strong>Hyper-segmentation.</strong> Datadog's one-ad-per-integration approach: CTR 1%→3%, CPA −40%, demos +75% (only hard numbers in the research)."
      ]
    },
    {
      title: "Paid ads — formats & CTAs",
      items: [
        "<strong>Single image still dominates volume</strong> — best when the creative shows the product interface, a specific result, or a customer quote.",
        "<strong>Video (15–30s)</strong> drives 2–3x engagement of static. Winning structure: problem in first 3 seconds, product solving it in seconds 4–15, clear CTA. Screen recordings with voiceover beat polished brand videos.",
        "<strong>Carousel is a hot format in 2026:</strong> before/after narratives, \"5 reasons teams switch,\" or stacked proof points — one benefit per card, each card standalone.",
        "<strong>UGC / founder-led lo-fi</strong> outperforms polished creative (Replit's hoodie talking-head; 41% higher CTR per TripleDart).",
        "<strong>Lead ads (instant forms)</strong> work for free trials and gated content; pre-filled fields cut friction.",
        "<strong>CTA ladder:</strong> free trial / free product is the default SaaS action; \"Learn More\" as a deliberate low-pressure CTA (Descript, Zendesk); content-first CTAs (read the guide) for top/mid-funnel; demo CTAs for sales-led products."
      ]
    },
    {
      title: "Organic — recurring hooks",
      items: [
        "<strong>Persona/character as the hook.</strong> Duo the unhinged owl, \"Chris from SEMrush,\" AI cartoon characters debating topics. People follow people (or owls), not logos.",
        "<strong>Trend-jack with an audience angle.</strong> Squid Game, Spotify Wrapped, Inside Out 2 — winners translate trends into their audience's daily life instead of just reacting.",
        "<strong>Pain-point memes.</strong> One image that says \"that's exactly how it feels\" (algorithm-update cat). Compression of complex pain into a native format.",
        "<strong>The topic, not the product.</strong> ryee's character videos hook on weight loss/money/relationships; the app enters mid-conversation.",
        "<strong>Stunt/spectacle.</strong> Killing the mascot — manufactured cultural moments, not just trend-following. $0 budget, 1.7B impressions.",
        "<strong>Specific numbers in build-in-public.</strong> \"1,800 downloads,\" \"$30K in 3 months.\" #BuildInPublic posts with real numbers perform 3x."
      ]
    },
    {
      title: "Organic — formats, captions & hashtags",
      items: [
        "<strong>Reels dominate reach:</strong> ~30.8% average reach (2x carousels/statics). Instagram's 2026 algorithm weights DM shares 3–5x more than likes — engineer content to be shared in DMs/Slack.",
        "<strong>Five reel archetypes that scale:</strong> vox-pop, creator-style talking head, meme-style, product vignette (one action on screen), behind-the-scenes.",
        "<strong>Carousels for education</strong> (Shopify tutorials); <strong>UGC/templates for community</strong> (Notion templates as billboards, Trello workspace showcases, Mailchimp customer films).",
        "<strong>Captions:</strong> short + conversational + in-character. \"People-problem\" framing over enterprise framing (\"How to use AI to win over your boss\" beats \"AI's impact on enterprise marketing\"). Minimal text on meme posts.",
        "<strong>Comment-for-link CTA</strong> (\"Comment APP and I'll send you the link\") — doubles as an engagement hack since comments feed the algorithm.",
        "<strong>Hashtags: niche &gt; broad.</strong> #VibeDrawing, #MCP, #AIAgents beat #AI/#Design (\"too competitive, minimal organic reach\"). 3–5 tags max, placed at end."
      ]
    }
  ];

  var STEAL = [
    {
      n: 1, name: "Quantified outcome headline",
      rows: [
        ["inkspell", "5,500 shapes. One infinite canvas. Zero lag — sketch 3x faster."],
        ["oporae", "One link, 4 layouts, 60 seconds: a product page that actually pitches."],
        ["ai-pulse", "3 repos. 50 seconds. Zero fluff."],
        ["forkfox", "The #1 dish at 12 Philly spots, ranked from 400+ reviews."],
        ["free-tools-atlas", "127 free tools. $0. One searchable page."]
      ]
    },
    {
      n: 2, name: "Competitor conquest",
      rows: [
        ["inkspell", "Cancel the $15/mo whiteboard app — sketch free on an infinite canvas."],
        ["oporae", "A link tells them where. A page shows them why."],
        ["ai-pulse", "Stop skimming 40 AI newsletters. Watch 50 seconds instead."],
        ["forkfox", "Yelp ranks restaurants. ForkFox ranks the actual dishes."],
        ["free-tools-atlas", "Bookmarked 30 \"free tools\" lists? This one is actually free."]
      ]
    },
    {
      n: 3, name: "Before/after transformation",
      rows: [
        ["inkspell", "Carousel: scattered sketches across 6 apps → one organized infinite canvas."],
        ["oporae", "Before: a bare link in bio. After: a page that pitches while you sleep."],
        ["ai-pulse", "Before: 2 hours doomscrolling AI Twitter. After: one 50-second brief."],
        ["forkfox", "Before: scrolling 200 reviews. After: the top 3 dishes, ranked."],
        ["free-tools-atlas", "Before: 14 open tabs. After: one atlas."]
      ]
    },
    {
      n: 4, name: "Founder-led lo-fi video",
      rows: [
        ["inkspell", "Talking head, no polish: sketch a full page in 30 seconds on camera."],
        ["oporae", "Screen-record building a showcase page in 60 seconds with voiceover."],
        ["ai-pulse", "\"3 repos blew up today — here's the 50-second version.\""],
        ["forkfox", "Taste-test the #1 ranked dish on camera."],
        ["free-tools-atlas", "Scroll the atlas live: \"5 tools here replaced $80/mo of subscriptions.\""]
      ]
    },
    {
      n: 5, name: "Comment-for-link CTA",
      rows: [
        ["inkspell", "\"Comment CANVAS and I'll send you the link.\""],
        ["oporae", "\"Comment PAGE and I'll draft one for your product.\""],
        ["ai-pulse", "\"Comment PULSE for today's repo list.\""],
        ["forkfox", "\"Comment PHILLY for the full ranked list.\""],
        ["free-tools-atlas", "\"Comment TOOLS and I'll DM you the atlas.\""]
      ]
    },
    {
      n: 6, name: "Pain-point meme / trend-jack",
      rows: [
        ["inkspell", "Meme: \"POV: your whiteboard app lags on stroke 400.\""],
        ["oporae", "Starter-pack meme: nobody clicks the link in your bio."],
        ["ai-pulse", "\"AI Twitter today\" chaos meme → \"or watch 50 seconds.\""],
        ["forkfox", "\"What should we order?\" group-chat chaos meme."],
        ["free-tools-atlas", "\"Free trial\" (credit card required) meme."]
      ]
    }
  ];

  function renderPatterns() {
    var html = '<div class="playbook"><h2>The Playbook — patterns across winners</h2>' +
      "<p style='color:var(--muted);font-size:14px;margin:6px 0 0'>Aggregated from all 61 examples. Hooks, angles, formats, and CTAs that keep showing up.</p>";
    PATTERNS.forEach(function (p) {
      html += "<h3>" + esc(p.title) + "</h3><ul>" +
        p.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
    });
    html += "</div>";
    html += '<div class="playbook"><h2>Steal this for your products</h2>' +
      "<p style='color:var(--muted);font-size:14px;margin:6px 0 14px'>The 6 strongest patterns, mapped to your products with one concrete angle each.</p></div>";
    STEAL.forEach(function (s) {
      html += '<div class="steal"><h4><span class="n">' + s.n + "</span>" + esc(s.name) + "</h4>" +
        '<table><thead><tr><th>Product</th><th>Angle to steal</th></tr></thead><tbody>' +
        s.rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
        "</tbody></table></div>";
    });
    document.getElementById("patterns").innerHTML = html;
  }
})();
