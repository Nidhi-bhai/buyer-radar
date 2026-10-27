#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { industries } = require("../data/kb");
const rank = require("../js/rank");
const reportLib = require("../js/report");
const purchases = require("../js/purchases");

const root = path.join(__dirname, "..");
const trade = JSON.parse(fs.readFileSync(path.join(root, "data", "trade-snapshots.json"), "utf8"));
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (error) {
    failures.push(name + ": " + error.message);
    console.error("FAIL " + name + "\n  " + error.message);
  }
}

check("at least 40 industries", function () {
  assert.ok(industries.length >= 40, "got " + industries.length);
});

check("every goods HS code has a complete snapshot", function () {
  industries.filter(function (item) { return item.kind === "goods"; }).forEach(function (item) {
    const series = trade.series[item.hs.code];
    assert.ok(series, item.slug + " missing snapshot");
    assert.ok(series.cmdDesc, item.slug + " missing cmdDesc");
    assert.strictEqual(series.complete, true, item.slug + " snapshot incomplete");
    assert.ok(series.reporterCount >= 80, item.slug + " too few reporters");
  });
});

check("cocoa powder description is cocoa powder", function () {
  assert.match(trade.series["180500"].cmdDesc, /cocoa/i);
  assert.match(trade.series["180500"].cmdDesc, /powder/i);
});

const samples = [
  {
    query: "moringa powder",
    slug: "moringa-powder",
    expect: /basket|broader|whole heading/i,
    hs: "121190",
    channel: /BioFach|Medicinal and Botanical/
  },
  {
    query: "B2B SaaS for dentists",
    slug: "b2b-saas-dentists",
    service: true,
    channel: /Offices of Dentists|IDS Cologne|Dentists, General/
  },
  {
    query: "solar panels",
    slug: "solar-panels",
    hs: "854143",
    channel: /Intersolar|photovoltaic|Solar/
  },
  {
    query: "extra virgin olive oil",
    slug: "extra-virgin-olive-oil",
    hs: "150920",
    channel: /Olive Council|Olive Oil Association|extra virgin/i
  },
  {
    query: "industrial valves",
    slug: "industrial-valves",
    hs: "848180",
    channel: /Valve World|Industrial Machinery/
  }
];

const sampleDir = path.join(root, "samples");
fs.mkdirSync(sampleDir, { recursive: true });

samples.forEach(function (sample) {
  check("report: " + sample.query, function () {
    const found = rank.matchQuery(industries, sample.query);
    assert.ok(found.match, "no match");
    assert.strictEqual(found.match.slug, sample.slug);
    assert.strictEqual(found.confidence, "exact");
    const report = rank.buildReport(found.match, trade, sample.query);
    assert.ok(report.channels.length >= 8, "expected a full ranking, got " + report.channels.length);
    assert.strictEqual(report.channels.length >= rank.FREE_LIMIT, true);
    let previous = Infinity;
    report.channels.forEach(function (channel) {
      assert.ok(channel.composite <= previous, "not sorted");
      previous = channel.composite;
      assert.strictEqual(channel.composite, channel.money + channel.authority + channel.need);
      assert.ok(channel.reason && channel.reason.length > 40);
      assert.match(channel.source.url, /^https:\/\//);
      assert.ok(channel.outreachAngle);
      if (channel.type === "country") {
        assert.ok(channel.figures.primaryValue);
        assert.ok(channel.reason.includes(channel.figures.primaryValue), "reason dropped the literal");
        const series = trade.series[channel.figures.cmdCode];
        const stored = series.reporters.find(function (row) {
          return String(row.reporterCode) === String(channel.figures.reporterCode);
        });
        assert.strictEqual(channel.figures.primaryValue, stored.primaryValue);
      } else {
        assert.ok(!channel.figures, "non-country channel has trade figures");
        assert.ok(!/primaryValue/.test(channel.reason));
      }
    });
    assert.ok(report.channels.slice(0, rank.FREE_LIMIT).some(function (channel) {
      return sample.channel.test(channel.name + " " + channel.reason);
    }), "top 5 did not include an expected channel");
    if (sample.service) {
      assert.strictEqual(report.trade.available, false);
      assert.ok(!report.channels.some(function (channel) { return channel.type === "country"; }));
      assert.ok(!/USD \d/.test(reportLib.toMarkdown(report).split("## Ranked channels")[1] || ""));
    } else {
      assert.strictEqual(report.trade.cmdCode, sample.hs);
      assert.ok(report.channels.some(function (channel) { return channel.type === "country"; }));
      if (sample.expect) assert.match(reportLib.toMarkdown(report), sample.expect);
    }
    const markdown = reportLib.toMarkdown(report);
    assert.match(markdown, /Outreach/);
    assert.match(markdown, /UN Comtrade|no import-value ranking|does not report a goods heading/);
    assert.match(markdown, /Nidhi Karuturi/);
    const pdf = reportLib.toPdf(report);
    assert.ok(pdf.startsWith("%PDF-1.4"));
    assert.ok(pdf.includes("%%EOF"));
    const bytes = reportLib.toPdfBytes(report);
    assert.strictEqual(bytes[0], 0x25);
    assert.strictEqual(bytes[1], 0x50);
    fs.writeFileSync(path.join(sampleDir, sample.slug + ".md"), markdown);
    fs.writeFileSync(path.join(sampleDir, sample.slug + ".pdf"), bytes);
    console.log("    channels " + report.channels.length + " top: " + report.channels.slice(0, 5).map(function (channel) {
      return channel.rank + " " + channel.name + " (" + channel.composite + ")";
    }).join(" | "));
  });
});

check("unknown product does not invent a report", function () {
  const found = rank.matchQuery(industries, "quantum widget flux capacitor");
  assert.strictEqual(found.match, null);
});

check("bare tea does not guess between green and black", function () {
  const found = rank.matchQuery(industries, "tea");
  assert.strictEqual(found.match, null);
  assert.ok(found.alternatives.length >= 2);
});

check("purchases persist product, order id, and time", function () {
  const mem = {
    store: {},
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
    setItem: function (key, value) { this.store[key] = String(value); }
  };
  purchases.save(mem, {
    product: "Moringa powder",
    slug: "moringa-powder",
    query: "moringa powder",
    orderId: "ORDER-1",
    purchasedAt: "2026-10-27T08:53:00.000Z"
  });
  const again = purchases.forSlug(mem, "moringa-powder");
  assert.strictEqual(again.product, "Moringa powder");
  assert.strictEqual(again.orderId, "ORDER-1");
  assert.strictEqual(again.purchasedAt, "2026-10-27T08:53:00.000Z");
  const markdown = reportLib.toMarkdown(Object.assign({}, rank.buildReport(industries[0], trade, "moringa powder"), again));
  assert.match(markdown, /Order id: ORDER-1/);
  assert.match(markdown, /email within 7 days with your order id/);
  assert.match(markdown, /nidhi69n@gmail.com/);
});

check("aggregate partners are left out of country rankings", function () {
  industries.filter(function (item) { return item.kind === "goods"; }).forEach(function (item) {
    const report = rank.buildReport(item, trade, item.name);
    report.channels.filter(function (channel) { return channel.type === "country"; }).forEach(function (channel) {
      assert.ok(!rank.isAggregateReporter({
        reporterDesc: channel.figures.reporter,
        reporterCode: channel.figures.reporterCode
      }), item.slug + " ranked " + channel.figures.reporter);
    });
  });
  const moringaPage = fs.readFileSync(path.join(root, "industries", "moringa-powder.html"), "utf8");
  assert.ok(!moringaPage.includes("Other Asia, nes"));
});

check("spam-prone RFQ boards score Need 2 with a caution", function () {
  const spamHosts = ["tradekey.com", "go4worldbusiness.com", "sourcing.alibaba.com"];
  let seen = 0;
  industries.forEach(function (industry) {
    industry.channels.forEach(function (channel) {
      if (channel.type !== "rfq") return;
      const spam = spamHosts.some(function (host) { return channel.url.indexOf(host) !== -1; });
      if (!spam) return;
      seen += 1;
      assert.strictEqual(channel.need, 2, industry.slug + " " + channel.name);
      assert.match(channel.reason, /Caution:/);
      assert.match(channel.reason, /spam-prone/);
    });
  });
  assert.ok(seen >= 10, "expected spam RFQ channels, saw " + seen);
  const valves = industries.find(function (item) { return item.slug === "industrial-valves"; });
  const thomas = valves.channels.find(function (channel) { return channel.name === "ThomasNet"; });
  assert.ok(thomas.need > 2);
});

check("Europages is a marketplace or directory", function () {
  const bananas = industries.find(function (item) { return item.slug === "bananas"; });
  const europages = bananas.channels.find(function (channel) { return channel.name === "Europages"; });
  assert.strictEqual(europages.type, "marketplace");
  assert.strictEqual(rank.TYPE_LABELS.marketplace, "Marketplace / directory");
});

check("NAICS and O*NET are labeled as US classifications", function () {
  const dental = industries.find(function (item) { return item.slug === "b2b-saas-dentists"; });
  const office = dental.channels.find(function (channel) { return channel.name === "Offices of Dentists"; });
  const dentist = dental.channels.find(function (channel) { return channel.type === "job_title"; });
  assert.match(office.reason, /United States industry classification/);
  assert.match(office.source.title, /United States industry classification/);
  assert.match(dentist.reason, /United States occupation classification/);
  assert.match(dentist.source.title, /United States occupation classification/);
  assert.match(rank.TYPE_LABELS.buyer_type, /US NAICS/);
  assert.match(rank.TYPE_LABELS.job_title, /US O\*NET/);
});

check("every industry can sell a report with at least 5 extra channels", function () {
  industries.forEach(function (industry) {
    const report = rank.buildReport(industry, trade, industry.name);
    assert.ok(report.forSale, industry.slug + " extra " + report.extraCount);
    assert.ok(report.extraCount >= 5, industry.slug);
    assert.strictEqual(report.outreachCount, report.channels.length);
  });
});

check("PDF wraps the Comtrade URL", function () {
  const industry = industries.find(function (item) { return item.slug === "moringa-powder"; });
  const report = rank.buildReport(industry, trade, "moringa powder");
  const pdf = reportLib.toPdf(report);
  const url = trade.series["121190"].queryUrl;
  assert.ok(url.length > 92, "url length " + url.length);
  const lines = [];
  const re = /\(((?:\\.|[^\\)])*)\) Tj/g;
  let match;
  while ((match = re.exec(pdf))) {
    lines.push(match[1].replace(/\\([()\\])/g, "$1"));
  }
  lines.forEach(function (line) {
    assert.ok(line.length <= 92, "line " + line.length + ": " + line.slice(0, 120));
  });
  assert.ok(!lines.some(function (line) { return line.indexOf(url) !== -1; }));
  assert.ok(lines.some(function (line) { return line.indexOf("comtradeapi.un.org") !== -1; }));
  assert.ok(lines.some(function (line) { return line.indexOf("includeDesc=true") !== -1; }));
});

check("generated pages and sitemap", function () {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  industries.forEach(function (industry) {
    const file = path.join(root, "industries", industry.slug + ".html");
    assert.ok(fs.existsSync(file), "missing " + file);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, new RegExp("Where to find buyers for " + industry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Nidhi Karuturi/);
    assert.match(html, /https:\/\/github\.com\/Nidhi-bhai/);
    assert.match(html, /nidhi69n@gmail.com/);
    assert.match(html, /email within 7 days with your order id/);
    assert.match(html, /property="og:image"/);
    const description = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(description.length <= 155, industry.slug + " description " + description.length);
    assert.ok(!html.includes("**Outreach:**"), "SEO page leaked an outreach label");
    assert.ok(!/config\.js|PAYPAL_CLIENT_ID|refresh-trade|CORS/.test(html), industry.slug + " has setup text");
    assert.match(sitemap, new RegExp(industry.slug + "\\.html"));
  });
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /Nidhi Karuturi/);
  assert.match(home, /industries\/moringa-powder\.html/);
  assert.match(home, /nidhi69n@gmail.com/);
  assert.match(home, /email within 7 days with your order id/);
  assert.match(home, /Download again|id="library"/);
  assert.match(home, /property="og:image"/);
  const homeDescription = home.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(homeDescription.length <= 155, "home description " + homeDescription.length);
  assert.ok(!/PAYPAL_CLIENT_ID|refresh-trade|from <code>config\.js<\/code>/.test(home));
  const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.match(app, /Download again/);
  assert.match(app, /Full report not available yet/);
  assert.match(app, /localStorage/);
  assert.ok(!/config\.js|refresh-trade|static site/.test(app));
  assert.match(fs.readFileSync(path.join(root, "config.js"), "utf8"), /PAYPAL_CLIENT_ID/);
  assert.ok(!/-----BEGIN|sk_live|client_secret/i.test(fs.readFileSync(path.join(root, "config.js"), "utf8")));
  assert.ok(fs.existsSync(path.join(root, "og.png")));
});

if (failures.length) {
  console.error("\n" + failures.length + " failed");
  process.exit(1);
}
console.log("\nall checks passed");
