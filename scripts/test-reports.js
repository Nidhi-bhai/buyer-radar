#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { industries } = require("../data/kb");
const rank = require("../js/rank");
const reportLib = require("../js/report");

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

check("generated pages and sitemap", function () {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  industries.forEach(function (industry) {
    const file = path.join(root, "industries", industry.slug + ".html");
    assert.ok(fs.existsSync(file), "missing " + file);
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, new RegExp("Where to find buyers for " + industry.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Nidhi Karuturi/);
    assert.match(html, /https:\/\/github\.com\/Nidhi-bhai/);
    assert.ok(!html.includes("**Outreach:**"), "SEO page leaked an outreach label");
    assert.match(sitemap, new RegExp(industry.slug + "\\.html"));
  });
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /Nidhi Karuturi/);
  assert.match(home, /industries\/moringa-powder\.html/);
  assert.match(fs.readFileSync(path.join(root, "config.js"), "utf8"), /PAYPAL_CLIENT_ID/);
  assert.ok(!/-----BEGIN|sk_live|client_secret/i.test(fs.readFileSync(path.join(root, "config.js"), "utf8")));
});

if (failures.length) {
  console.error("\n" + failures.length + " failed");
  process.exit(1);
}
console.log("\nall checks passed");
