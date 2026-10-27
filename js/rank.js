(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BuyerRadarRank = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var FREE_LIMIT = 5;
  var TYPE_ORDER = {
    country: 0,
    buyer_type: 1,
    tradeshow: 2,
    job_title: 3,
    marketplace: 4,
    rfq: 5,
    community: 6
  };
  var TYPE_LABELS = {
    country: "Importing country",
    buyer_type: "Buyer company type (US NAICS)",
    tradeshow: "Trade show",
    job_title: "Job title (US O*NET)",
    marketplace: "Marketplace / directory",
    rfq: "RFQ board",
    community: "Community"
  };
  var SPAM_RFQ_URLS = {
    "https://www.tradekey.com/": true,
    "https://www.go4worldbusiness.com/": true,
    "https://sourcing.alibaba.com/": true
  };
  var RFQ_CAUTION =
    "Caution: this RFQ board is spam-prone. Many posts are recycled or unqualified. Confirm the company, the quantity, and who can sign before you reply.";
  var NEED_BY_SPECIFICITY = { specific: 5, close: 4, broad: 3 };

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function tokens(value) {
    return normalize(value)
      .split(" ")
      .filter(function (token) {
        return token.length > 2;
      });
  }

  function phrases(industry) {
    return [industry.name].concat(industry.aliases || []);
  }

  function scoreIndustry(industry, query) {
    var q = normalize(query);
    var best = 0;
    phrases(industry).forEach(function (phrase) {
      var text = normalize(phrase);
      if (!text) return;
      if (text === q) best = Math.max(best, 100);
      else if (q.length >= 4 && text.indexOf(q) !== -1) best = Math.max(best, 40 + q.length);
      else if (text.length >= 4 && q.indexOf(text) !== -1) best = Math.max(best, 30 + text.length);
      else {
        var overlap = 0;
        var qTokens = tokens(q);
        var pTokens = tokens(text);
        qTokens.forEach(function (token) {
          if (pTokens.indexOf(token) !== -1) overlap += token.length >= 5 ? 3 : 1;
        });
        best = Math.max(best, overlap);
      }
    });
    if (industry.hs && industry.hs.code && q.replace(/\s/g, "") === industry.hs.code) best = Math.max(best, 100);
    return best;
  }

  function matchQuery(industries, query) {
    var q = normalize(query);
    var ranked = (industries || [])
      .map(function (industry) {
        return { industry: industry, score: q ? scoreIndustry(industry, q) : 0 };
      })
      .filter(function (item) {
        return item.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score || a.industry.name.localeCompare(b.industry.name);
      });

    if (!ranked.length) {
      return { query: query, match: null, confidence: null, alternatives: [] };
    }

    var top = ranked[0];
    var second = ranked[1];
    var exact =
      phrases(top.industry).some(function (phrase) {
        return normalize(phrase) === q;
      }) || (top.industry.hs && q.replace(/\s/g, "") === top.industry.hs.code);

    if (exact) {
      return {
        query: query,
        match: top.industry,
        confidence: top.industry.hs && q.replace(/\s/g, "") === top.industry.hs.code && normalize(top.industry.name) !== q ? "hs" : "exact",
        alternatives: ranked.slice(1, 4)
      };
    }

    var ambiguous = second && second.score >= top.score * 0.75 && top.score < 40;
    if (ambiguous || top.score < 3) {
      return {
        query: query,
        match: null,
        confidence: null,
        alternatives: ranked.slice(0, 4)
      };
    }

    return {
      query: query,
      match: top.industry,
      confidence: "partial",
      alternatives: ranked.slice(1, 4)
    };
  }

  function numeric(value) {
    var number = Number(value);
    return number === number && isFinite(number) ? number : null;
  }

  function moneyFromRank(rank) {
    if (rank === 1) return 5;
    if (rank <= 3) return 4;
    if (rank <= 10) return 3;
    return 2;
  }

  function groupExact(literal) {
    var text = String(literal);
    var negative = text.charAt(0) === "-";
    var body = negative ? text.slice(1) : text;
    var parts = body.split(".");
    var grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var shown = parts.length > 1 ? grouped + "." + parts.slice(1).join(".") : grouped;
    return (negative ? "-" : "") + shown;
  }

  function isAggregateReporter(row) {
    var name = String((row && row.reporterDesc) || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    if (String(row && row.reporterCode) === "0") return true;
    if (name === "world" || name === "areas, nes" || name === "other asia, nes") return true;
    if (/^other\b/.test(name) && /\bnes$/.test(name)) return true;
    return false;
  }

  function applyEditorialPolicy(channel) {
    if (!channel || channel.type !== "rfq" || !SPAM_RFQ_URLS[channel.url]) return channel;
    var reason = String(channel.reason || "").replace(/Need is \d+/, "Need is 2");
    if (reason.indexOf("Caution:") === -1) reason = reason.replace(/\s+$/, "") + " " + RFQ_CAUTION;
    if (channel.need === 2 && reason === channel.reason) return channel;
    return Object.assign({}, channel, { need: 2, reason: reason });
  }

  function usableQty(row) {
    if (!row.qtyUnitAbbr || row.qtyUnitAbbr === "N/A") return null;
    var qty = numeric(row.qty);
    if (qty === null || qty <= 0) return null;
    return { qty: String(row.qty), unit: row.qtyUnitAbbr, estimated: Boolean(row.isQtyEstimated) };
  }

  function specificityNote(specificity) {
    if (specificity === "specific") {
      return "The official heading names this product, so the import value is a direct Comtrade measure of recorded trade in it.";
    }
    if (specificity === "close") {
      return "The official heading names this product but is a bit wider than one commercial form. The dollars are real for the heading, not a private estimate, and they are not a pure measure of one SKU.";
    }
    return "This heading is a basket shared with other products. The dollars are real for the heading and are not a measure of this product alone.";
  }

  function countryChannels(industry, series) {
    if (!industry.hs || !series || !series.reporters) return [];
    var eligible = series.reporters.filter(function (row) {
      var value = numeric(row.primaryValue);
      return value !== null && value > 0 && row.reporterDesc && !isAggregateReporter(row);
    });
    var total = eligible.length;
    var need = NEED_BY_SPECIFICITY[industry.hs.specificity] || 3;
    return eligible.slice(0, 6).map(function (row, index) {
      var rank = index + 1;
      var money = moneyFromRank(rank);
      var qty = usableQty(row);
      var literal = String(row.primaryValue);
      var qtySentence = qty
        ? " Reported quantity: " +
          groupExact(qty.qty) +
          " " +
          qty.unit +
          (qty.estimated ? " (Comtrade flagged the quantity as estimated)." : " (quantity not flagged as estimated).")
        : " Comtrade did not return a usable quantity unit for this row.";
      var completeness = series.complete
        ? "The preview count matched the rows stored (" + series.rowsReturned + "), under the 500-row cap."
        : "The preview reported count " +
          series.apiCount +
          " and " +
          series.rowsReturned +
          " rows were stored, so this rank is only among stored rows.";
      var reason = [
        row.reporterDesc +
          " reported primaryValue " +
          literal +
          " USD (shown with separators as " +
          groupExact(literal) +
          ") for HS " +
          series.cmdCode +
          " imports from the world in " +
          series.period +
          ". That number is the UN Comtrade public-preview CIF primary value for partner World.",
        qtySentence.trim(),
        "Money is " +
          money +
          " because this reporter ranks " +
          rank +
          " of " +
          total +
          " reporters in that response by primaryValue.",
        "Authority is 4 because the country is where the buyers are: importers and distributors there hold the purchase order, and the country itself does not.",
        "Need is " + need + ". " + specificityNote(industry.hs.specificity),
        "Official commodity description: " + (series.cmdDesc || "not returned") + ".",
        completeness
      ].join(" ");
      var angle =
        "Do not email a country. Use " +
        row.reporterDesc +
        " as a map: find importers there that already clear HS " +
        series.cmdCode +
        " and open with the Comtrade fact that " +
        row.reporterDesc +
        " reported primaryValue " +
        literal +
        " USD of this heading in " +
        series.period +
        ". Offer a first-container spec sheet, not a market-size story.";
      return {
        id: "country-" + (row.reporterISO || row.reporterCode) + "-" + series.cmdCode,
        type: "country",
        name: row.reporterDesc + " — reported imports of HS " + series.cmdCode,
        url: series.queryUrl,
        money: money,
        authority: 4,
        need: need,
        reason: reason,
        outreachAngle: angle,
        source: {
          title: "UN Comtrade public preview API, HS " + series.cmdCode + ", " + series.period + " imports from World",
          url: series.queryUrl
        },
        figures: {
          primaryValue: literal,
          primaryValueGrouped: groupExact(literal),
          qty: qty ? qty.qty : null,
          qtyGrouped: qty ? groupExact(qty.qty) : null,
          qtyUnit: qty ? qty.unit : null,
          qtyEstimated: qty ? qty.estimated : null,
          period: series.period,
          reporter: row.reporterDesc,
          reporterISO: row.reporterISO || null,
          reporterCode: row.reporterCode,
          rank: rank,
          reporterCount: total,
          cmdCode: series.cmdCode,
          cmdDesc: series.cmdDesc || null,
          classificationCode: row.classificationCode || null,
          queryUrl: series.queryUrl,
          flowDesc: series.flowDesc || "Import",
          partnerDesc: series.partnerDesc || "World"
        }
      };
    });
  }

  function withComposite(channel) {
    var money = channel.money;
    var authority = channel.authority;
    var need = channel.need;
    return Object.assign({}, channel, { composite: money + authority + need });
  }

  function compareChannels(a, b) {
    if (b.composite !== a.composite) return b.composite - a.composite;
    if (b.money !== a.money) return b.money - a.money;
    if (b.authority !== a.authority) return b.authority - a.authority;
    if (b.need !== a.need) return b.need - a.need;
    var typeDelta = (TYPE_ORDER[a.type] || 9) - (TYPE_ORDER[b.type] || 9);
    if (typeDelta) return typeDelta;
    return String(a.name).localeCompare(String(b.name));
  }

  function tradeMeta(industry, snapshot) {
    if (!industry.hs) {
      return {
        available: false,
        kind: "service",
        note: "This is a service. UN Comtrade merchandise statistics do not report a goods heading for it, so this report has no import-value ranking and no invented one."
      };
    }
    var series = snapshot && snapshot.series ? snapshot.series[industry.hs.code] : null;
    if (!series) {
      return {
        available: false,
        kind: "missing",
        cmdCode: industry.hs.code,
        note:
          "Import figures for HS " +
          industry.hs.code +
          " are not in the stored Comtrade snapshot, so this report does not include a country ranking and does not estimate one."
      };
    }
    return {
      available: true,
      kind: "goods",
      cmdCode: series.cmdCode,
      cmdDesc: series.cmdDesc,
      period: series.period,
      queryUrl: series.queryUrl,
      apiCount: series.apiCount,
      rowsReturned: series.rowsReturned,
      reporterCount: series.reporterCount,
      complete: series.complete,
      retrieved: snapshot.retrieved,
      documentation: snapshot.documentation,
      database: snapshot.database,
      specificity: industry.hs.specificity,
      hsNote: industry.hs.note,
      classificationSource: industry.hs.classificationSource || null
    };
  }

  function buildReport(industry, snapshot, query) {
    var series = industry.hs && snapshot && snapshot.series ? snapshot.series[industry.hs.code] : null;
    var channels = (industry.channels || [])
      .map(applyEditorialPolicy)
      .map(withComposite)
      .concat(countryChannels(industry, series).map(withComposite));
    channels.sort(compareChannels);
    channels.forEach(function (channel, index) {
      channel.rank = index + 1;
    });
    var extraCount = Math.max(0, channels.length - FREE_LIMIT);
    return {
      query: query || industry.name,
      industry: {
        id: industry.id,
        slug: industry.slug,
        name: industry.name,
        summary: industry.summary,
        kind: industry.kind,
        hs: industry.hs || null
      },
      channels: channels,
      freeLimit: FREE_LIMIT,
      extraCount: extraCount,
      outreachCount: channels.length,
      forSale: extraCount >= 5,
      trade: tradeMeta(industry, snapshot),
      methodology: methodology(snapshot)
    };
  }

  function methodology(snapshot) {
    return {
      scale: "Each channel is scored from 1 to 5 on Money (budget), Authority (who can say yes), and Need (fit with this product). The total is the sum, out of 15.",
      ties: "Ties break by Money, then Authority, then Need, then channel type (importing country, buyer type, trade show, job title, marketplace, RFQ board, community), then name.",
      editorial:
        "Scores on curated channels are editorial judgments explained in the reason and tied to a public page. Company types use the United States NAICS classification from the U.S. Census Bureau. Job titles use the United States O*NET occupation classification. Shows, marketplaces, directories, and communities cite their own sites. These scores are not measurements.",
      countries:
        "Importing-country Money is not editorial. Rank 1 in the Comtrade response scores 5, ranks 2–3 score 4, ranks 4–10 score 3. Authority is 4 because importers in that country hold the order. Need is 5, 4, or 3 according to whether the HS heading is specific, close, or a broad basket. The dollar figure is the unmodified primaryValue literal.",
      retrieved: snapshot && snapshot.retrieved ? snapshot.retrieved : null,
      documentation: "https://uncomtrade.org/docs/un-comtrade-api/"
    };
  }

  return {
    FREE_LIMIT: FREE_LIMIT,
    TYPE_LABELS: TYPE_LABELS,
    normalize: normalize,
    matchQuery: matchQuery,
    buildReport: buildReport,
    groupExact: groupExact,
    moneyFromRank: moneyFromRank,
    isAggregateReporter: isAggregateReporter,
    applyEditorialPolicy: applyEditorialPolicy
  };
});
