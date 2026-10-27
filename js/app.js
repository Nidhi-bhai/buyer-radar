(function () {
  var form = document.getElementById("search-form");
  var input = document.getElementById("q");
  var results = document.getElementById("results");
  var library = document.getElementById("library");
  if (!form || !results) return;

  var state = { industries: [], trade: null, paypalReady: false };
  var CONTACT = "nidhi69n@gmail.com";
  var REFUND = "Refunds: email within 7 days with your order id.";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function config() {
    return window.BUYERRADAR_CONFIG || { PAYPAL_CLIENT_ID: "YOUR_PAYPAL_CLIENT_ID", PRICE_USD: "19.00", CURRENCY: "USD" };
  }

  function typeLabel(type) {
    return BuyerRadarRank.TYPE_LABELS[type] || type;
  }

  function storage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
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

  function withPurchase(report, record) {
    return Object.assign({}, report, {
      orderId: record.orderId,
      purchasedAt: record.purchasedAt
    });
  }

  function downloadReport(report, record, kind) {
    var full = record ? withPurchase(report, record) : report;
    if (kind === "md") {
      download(
        "buyerradar-" + report.industry.slug + ".md",
        new Blob([BuyerRadarReport.toMarkdown(full)], { type: "text/markdown;charset=utf-8" })
      );
      return;
    }
    download(
      "buyerradar-" + report.industry.slug + ".pdf",
      new Blob([BuyerRadarReport.toPdfBytes(full)], { type: "application/pdf" })
    );
  }

  function reportFor(record) {
    var industry = state.industries.filter(function (item) { return item.slug === record.slug; })[0];
    if (!industry) return null;
    return BuyerRadarRank.buildReport(industry, state.trade, record.query || record.product);
  }

  function whenText(iso) {
    if (!iso) return "";
    return String(iso).slice(0, 16).replace("T", " ") + " UTC";
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

  function offerCopy(report) {
    return "The free tier is the top " + report.freeLimit + ". $" + config().PRICE_USD + " adds " +
      report.extraCount + " more channels and " + report.outreachCount +
      " outreach angles, one on every channel, as a Markdown file and a PDF.";
  }

  function purchaseBox(record, again) {
    return (
      '<div class="downloads" id="downloads">' +
      '<p class="order-id">Order id: ' + esc(record.orderId) + "</p>" +
      '<p class="note">Purchased ' + esc(whenText(record.purchasedAt)) + ". " + esc(REFUND) +
      ' <a href="mailto:' + CONTACT + '">' + CONTACT + "</a></p>" +
      '<button type="button" id="dl-pdf">' + (again ? "Download again" : "Download PDF") + "</button>" +
      '<button type="button" class="secondary" id="dl-md">Download Markdown</button>' +
      "</div>"
    );
  }

  function bindDownloads(report, record) {
    var pdf = document.getElementById("dl-pdf");
    var md = document.getElementById("dl-md");
    if (pdf) pdf.addEventListener("click", function () { downloadReport(report, record, "pdf"); });
    if (md) md.addEventListener("click", function () { downloadReport(report, record, "md"); });
  }

  function renderPaywall(report) {
    var cfg = config();
    var placeholder = !cfg.PAYPAL_CLIENT_ID || cfg.PAYPAL_CLIENT_ID === "YOUR_PAYPAL_CLIENT_ID";
    if (!report.forSale) {
      return (
        '<div class="paywall" id="paywall">' +
        "<h2>Full report not available yet</h2>" +
        "<p>The free tier is the top " + report.freeLimit + ". This industry has " + report.extraCount +
        " more channels, and a paid report is offered only when there are at least 5 more.</p>" +
        "</div>"
      );
    }
    var checkout = placeholder
      ? "<p class=\"note\">Checkout is unavailable right now. Email <a href=\"mailto:" + CONTACT + "\">" + CONTACT + "</a>.</p>"
      : "<p>" + esc(offerCopy(report)) + "</p>" +
        "<p class=\"note\">" + esc(REFUND) + " Contact <a href=\"mailto:" + CONTACT + "\">" + CONTACT + "</a>.</p>" +
        '<div id="paypal-button"></div>';
    return (
      '<div class="paywall" id="paywall">' +
      "<h2>The rest of the ranking is the $19 report</h2>" +
      checkout +
      "</div>"
    );
  }

  function renderLibrary() {
    if (!library) return;
    var store = storage();
    var saved = store ? BuyerRadarPurchases.read(store) : [];
    if (!saved.length) {
      library.innerHTML = "";
      return;
    }
    library.innerHTML =
      '<div class="panel library"><h2>Your reports</h2>' +
      saved.map(function (record) {
        return (
          '<article data-slug="' + esc(record.slug) + '">' +
          "<div><strong>" + esc(record.product) + "</strong>" +
          '<div class="order-id">Order id: ' + esc(record.orderId) + "</div>" +
          '<div class="note">Purchased ' + esc(whenText(record.purchasedAt)) + "</div></div>" +
          '<button type="button" data-download="' + esc(record.slug) + '">Download again</button>' +
          "</article>"
        );
      }).join("") +
      "</div>";
  }

  function loadPayPal(report) {
    var cfg = config();
    if (!report.forSale) return;
    if (!cfg.PAYPAL_CLIENT_ID || cfg.PAYPAL_CLIENT_ID === "YOUR_PAYPAL_CLIENT_ID") return;
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
          return actions.order.capture().then(function (details) {
            var orderId = (data && data.orderID) || (details && details.id) || "";
            var record = {
              product: report.industry.name,
              slug: report.industry.slug,
              query: report.query,
              orderId: orderId,
              purchasedAt: new Date().toISOString()
            };
            var store = storage();
            if (store) BuyerRadarPurchases.save(store, record);
            showUnlocked(report, record, false);
            renderLibrary();
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
      if (holder) holder.textContent = "Payment could not load. Email " + CONTACT + ".";
    };
    document.head.appendChild(script);
  }

  function showUnlocked(report, record, again) {
    var list = document.getElementById("channel-list");
    if (list) {
      list.innerHTML = report.channels.map(function (channel) {
        return channelCard(channel, false);
      }).join("");
    }
    var slot = document.getElementById("paywall-slot");
    if (slot) slot.innerHTML = purchaseBox(record, again);
    bindDownloads(report, record);
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
    var store = storage();
    var prior = store ? BuyerRadarPurchases.forSlug(store, report.industry.slug) : null;
    var confidence = found.confidence === "exact" ? "Exact match" : found.confidence === "hs" ? "HS code match" : "Closest industry";
    var visible = prior ? report.channels : report.channels.slice(0, report.freeLimit);
    results.innerHTML =
      '<div class="panel">' +
      '<p class="kicker">' + esc(confidence) + " · " + esc(report.industry.kind) + "</p>" +
      "<h2>" + esc(report.industry.name) + "</h2>" +
      "<p>" + esc(report.industry.summary) + "</p>" +
      "<p class=\"note\">Free tier: the top " + report.freeLimit + " channels.</p>" +
      tradeBanner(report) +
      '<div id="channel-list">' +
      visible.map(function (channel) { return channelCard(channel, !prior); }).join("") +
      "</div>" +
      '<div id="paywall-slot">' + (prior ? purchaseBox(prior, true) : renderPaywall(report)) + "</div>" +
      '<p><a href="industries/' + esc(report.industry.slug) + '.html">SEO page for this industry</a></p>' +
      "</div>";
    if (prior) bindDownloads(report, prior);
    else loadPayPal(report);
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
  if (library) {
    library.addEventListener("click", function (event) {
      var button = event.target.closest("[data-download]");
      if (!button) return;
      var store = storage();
      var record = store ? BuyerRadarPurchases.forSlug(store, button.getAttribute("data-download")) : null;
      if (!record) return;
      var report = reportFor(record);
      if (!report) return;
      downloadReport(report, record, "pdf");
    });
  }

  Promise.all([
    fetch("data/industries.json").then(function (response) { return response.json(); }),
    fetch("data/trade-snapshots.json").then(function (response) { return response.json(); })
  ]).then(function (payload) {
    state.industries = payload[0].industries;
    state.trade = payload[1];
    renderLibrary();
    var preset = new URLSearchParams(location.search).get("q");
    if (preset) {
      input.value = preset;
      renderMatch(preset);
    }
  }).catch(function (error) {
    results.innerHTML = '<div class="panel"><p>The knowledge base did not load. ' + esc(error.message) + "</p></div>";
  });
})();
