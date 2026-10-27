(function () {
  var form = document.getElementById("search-form");
  var input = document.getElementById("q");
  var results = document.getElementById("results");
  if (!form || !results) return;

  var state = { industries: [], trade: null, paypalReady: false };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function config() {
    return window.BUYERRADAR_CONFIG || { PAYPAL_CLIENT_ID: "AAb5cq2I0Xx3lFhRJNBjnuGCVT5VDtWfWHgAuSasCoaA_F4cFzLmDWcDmYhsXG6panQVSaRPR3gvrgE9w", PRICE_USD: "19.00", CURRENCY: "USD" };
  }

  function typeLabel(type) {
    return BuyerRadarRank.TYPE_LABELS[type] || type;
  }

  function download(filename, blob) {
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
  }

  function channelCard(channel, locked) {
    var figures = "";
    if (channel.figures) {
      var qty = channel.figures.qty
        ? "<div>Quantity " + esc(channel.figures.qtyGrouped) + " " + esc(channel.figures.qtyUnit) +
          (channel.figures.qtyEstimated ? " (Comtrade estimated flag)" : "") + "</div>"
        : "";
      figures =
        '<div class="figures">primaryValue ' + esc(channel.figures.primaryValue) + " USD" +
        " (" + esc(channel.figures.primaryValueGrouped) + ")" +
        " · " + esc(channel.figures.period) + " " + esc(channel.figures.flowDesc) +
        " from " + esc(channel.figures.partnerDesc) +
        " · rank " + esc(channel.figures.rank) + " of " + esc(channel.figures.reporterCount) +
        qty + "</div>";
    }
    var outreach = locked
      ? ""
      : '<div class="outreach"><strong>Outreach.</strong> ' + esc(channel.outreachAngle) + "</div>";
    return (
      '<article class="channel">' +
      '<div class="rank-no">' + esc(channel.rank) + "</div>" +
      "<div>" +
      '<div class="meta-row"><span class="pill">' + esc(typeLabel(channel.type)) + "</span>" +
      '<span class="total">' + esc(channel.composite) + " / 15</span></div>" +
      "<h3><a href=\"" + esc(channel.url) + '" rel="noopener noreferrer">' + esc(channel.name) + "</a></h3>" +
      '<div class="scores">' +
      score("Money", channel.money) + score("Authority", channel.authority) + score("Need", channel.need) +
      "</div>" +
      figures +
      '<p class="reason">' + esc(channel.reason) + "</p>" +
      outreach +
      '<p class="source">Source: <a href="' + esc(channel.source.url) + '" rel="noopener noreferrer">' +
      esc(channel.source.title) + "</a></p>" +
      "</div></article>"
    );
  }

  function score(label, value) {
    return '<div class="score"><span>' + esc(label) + "</span><b>" + esc(value) + "</b></div>";
  }

  function tradeBanner(report) {
    var trade = report.trade;
    if (!trade.available) return '<div class="warn">' + esc(trade.note) + "</div>";
    var leaders = report.channels.filter(function (channel) { return channel.type === "country"; }).slice(0, 3);
    var list = leaders.map(function (channel) {
      return "<li>" + esc(channel.figures.reporter) + ": primaryValue " + esc(channel.figures.primaryValue) +
        " USD (" + esc(channel.figures.period) + ", rank " + esc(channel.figures.rank) +
        " of " + esc(channel.figures.reporterCount) + ")</li>";
    }).join("");
    return (
      '<div class="warn"><strong>HS ' + esc(trade.cmdCode) + " · " + esc(trade.period) + ".</strong> " +
      esc(trade.hsNote) + " Official description: " + esc(trade.cmdDesc) + ". " +
      "Snapshot retrieved " + esc(trade.retrieved) + ". " +
      '<a href="' + esc(trade.queryUrl) + '">Comtrade query</a> · ' +
      '<a href="' + esc(trade.documentation) + '">API documentation</a>.' +
      (list ? "<p>Largest reported importers in that response. They are also scored in the ranking below.</p><ul>" + list + "</ul>" : "") +
      "</div>"
    );
  }

  function renderPaywall(report) {
    var cfg = config();
    var placeholder = !cfg.PAYPAL_CLIENT_ID || cfg.PAYPAL_CLIENT_ID === "AAb5cq2I0Xx3lFhRJNBjnuGCVT5VDtWfWHgAuSasCoaA_F4cFzLmDWcDmYhsXG6panQVSaRPR3gvrgE9w";
    var hidden = report.channels.length - report.freeLimit;
    var note = placeholder
      ? "PayPal is not configured. The site owner replaces PAYPAL_CLIENT_ID in config.js with a PayPal REST app client id. Do not put a PayPal secret in the repo. Until then the full file stays locked in the page, even though a static site cannot truly hide a public JSON file."
      : "PayPal Smart Buttons charge " + cfg.PRICE_USD + " " + cfg.CURRENCY + " once. After PayPal confirms the capture in this browser, the downloads appear. There is no server to re-check that payment later.";
    return (
      '<div class="paywall" id="paywall">' +
      "<h2>The rest of the ranking is the $19 report</h2>" +
      "<p>" + hidden + " more channels, each with an outreach angle, as Markdown and PDF. The free five above stay free.</p>" +
      "<p class=\"note\">" + esc(note) + "</p>" +
      '<div id="paypal-button"></div>' +
      '<div class="downloads" id="downloads" hidden></div>' +
      "</div>"
    );
  }

  function showDownloads(report) {
    var box = document.getElementById("downloads");
    if (!box) return;
    box.hidden = false;
    box.innerHTML =
      '<button type="button" id="dl-md">Download Markdown</button>' +
      '<button type="button" class="secondary" id="dl-pdf">Download PDF</button>';
    document.getElementById("dl-md").addEventListener("click", function () {
      download(
        "buyerradar-" + report.industry.slug + ".md",
        new Blob([BuyerRadarReport.toMarkdown(report)], { type: "text/markdown;charset=utf-8" })
      );
    });
    document.getElementById("dl-pdf").addEventListener("click", function () {
      download(
        "buyerradar-" + report.industry.slug + ".pdf",
        new Blob([BuyerRadarReport.toPdfBytes(report)], { type: "application/pdf" })
      );
    });
    var rest = report.channels.slice(report.freeLimit).map(function (channel) {
      return channelCard(channel, false);
    }).join("");
    var existing = document.getElementById("locked-channels");
    if (existing) existing.innerHTML = rest;
  }

  function loadPayPal(report) {
    var cfg = config();
    if (!cfg.PAYPAL_CLIENT_ID || cfg.PAYPAL_CLIENT_ID === "AAb5cq2I0Xx3lFhRJNBjnuGCVT5VDtWfWHgAuSasCoaA_F4cFzLmDWcDmYhsXG6panQVSaRPR3gvrgE9w") return;
    function renderButtons() {
      var holder = document.getElementById("paypal-button");
      if (!holder || !window.paypal) return;
      holder.innerHTML = "";
      window.paypal.Buttons({
        style: { layout: "horizontal", color: "gold", shape: "rect", label: "pay" },
        createOrder: function (data, actions) {
          return actions.order.create({
            purchase_units: [{
              description: "BuyerRadar full report: " + report.industry.name,
              amount: { currency_code: cfg.CURRENCY || "USD", value: cfg.PRICE_USD || "19.00" }
            }]
          });
        },
        onApprove: function (data, actions) {
          return actions.order.capture().then(function () {
            showDownloads(report);
          });
        }
      }).render("#paypal-button");
    }
    if (window.paypal) {
      renderButtons();
      return;
    }
    if (state.paypalReady) return;
    var script = document.createElement("script");
    script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(cfg.PAYPAL_CLIENT_ID) +
      "&currency=" + encodeURIComponent(cfg.CURRENCY || "USD") + "&intent=capture";
    script.onload = function () {
      state.paypalReady = true;
      renderButtons();
    };
    script.onerror = function () {
      var holder = document.getElementById("paypal-button");
      if (holder) holder.textContent = "PayPal’s script did not load. Check the client id and your connection.";
    };
    document.head.appendChild(script);
  }

  function renderMatch(query) {
    var found = BuyerRadarRank.matchQuery(state.industries, query);
    if (!found.match) {
      var options = found.alternatives.length
        ? '<div class="choices">' + found.alternatives.map(function (item) {
          return '<a href="?q=' + encodeURIComponent(item.industry.name) + '">' + esc(item.industry.name) + "</a>";
        }).join("") + "</div>"
        : "<p>Nothing in the knowledge base is close. Try one of the sample products.</p>";
      results.innerHTML =
        '<div class="panel"><h2>No ranked report for “' + esc(query) + "”</h2>" +
        "<p>BuyerRadar only ranks products in the curated list. It will not invent companies, countries, or trade numbers.</p>" +
        options + "</div>";
      return;
    }
    var report = BuyerRadarRank.buildReport(found.match, state.trade, query);
    var free = report.channels.slice(0, report.freeLimit);
    var confidence = found.confidence === "exact" ? "Exact match" : found.confidence === "hs" ? "HS code match" : "Closest industry";
    results.innerHTML =
      '<div class="panel">' +
      '<p class="kicker">' + esc(confidence) + " · " + esc(report.industry.kind) + "</p>" +
      "<h2>" + esc(report.industry.name) + "</h2>" +
      "<p>" + esc(report.industry.summary) + "</p>" +
      tradeBanner(report) +
      free.map(function (channel) { return channelCard(channel, true); }).join("") +
      '<div id="locked-channels"></div>' +
      renderPaywall(report) +
      '<p><a href="industries/' + esc(report.industry.slug) + '.html">SEO page for this industry</a></p>' +
      "</div>";
    loadPayPal(report);
    if (location.protocol !== "file:") {
      var url = new URL(location.href);
      url.searchParams.set("q", query);
      history.replaceState(null, "", url);
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    renderMatch(input.value.trim());
  });
  document.querySelectorAll("[data-q]").forEach(function (button) {
    button.addEventListener("click", function () {
      input.value = button.getAttribute("data-q");
      renderMatch(input.value);
    });
  });
  results.addEventListener("click", function (event) {
    var link = event.target.closest(".choices a");
    if (!link) return;
    event.preventDefault();
    var query = new URL(link.href).searchParams.get("q");
    input.value = query;
    renderMatch(query);
  });

  Promise.all([
    fetch("data/industries.json").then(function (response) { return response.json(); }),
    fetch("data/trade-snapshots.json").then(function (response) { return response.json(); })
  ]).then(function (payload) {
    state.industries = payload[0].industries;
    state.trade = payload[1];
    var preset = new URLSearchParams(location.search).get("q");
    if (preset) {
      input.value = preset;
      renderMatch(preset);
    }
  }).catch(function (error) {
    results.innerHTML = '<div class="panel"><p>The knowledge base did not load. ' + esc(error.message) + "</p></div>";
  });
})();
