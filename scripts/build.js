#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { industries } = require("../data/kb");
const rank = require("../js/rank");

const root = path.join(__dirname, "..");
const origin = "https://nidhi-bhai.github.io/buyer-radar";
const trade = JSON.parse(fs.readFileSync(path.join(root, "data", "trade-snapshots.json"), "utf8"));

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeLabel(type) {
  return rank.TYPE_LABELS[type] || type;
}

function directory(items, hrefPrefix) {
  const goods = items.filter(function (item) { return item.kind === "goods"; });
  const services = items.filter(function (item) { return item.kind === "service"; });
  function list(group) {
    return "<ul>" + group.map(function (item) {
      return '<li><a href="' + hrefPrefix + item.slug + '.html">' + esc(item.name) + "</a></li>";
    }).join("") + "</ul>";
  }
  return (
    '<div class="groups"><div class="group"><h3>Goods</h3>' + list(goods) +
    '</div><div class="group"><h3>Services</h3>' + list(services) + "</div></div>"
  );
}

function shell(options) {
  const prefix = options.depth ? "../" : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(options.title)}</title>
  <meta name="description" content="${esc(options.description)}">
  <link rel="canonical" href="${esc(options.canonical)}">
  <meta property="og:title" content="${esc(options.title)}">
  <meta property="og:description" content="${esc(options.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(options.canonical)}">
  <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,640&family=IBM+Plex+Mono:wght@400;600&family=Public+Sans:wght@400;550;650&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${prefix}css/styles.css">
  ${options.jsonLd ? '<script type="application/ld+json">' + options.jsonLd + "</script>" : ""}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${prefix}">
      <span class="brand-name">Buyer<span>Radar</span></span>
    </a>
    <nav class="nav">
      <a href="${prefix}">Search</a>
      <a href="${prefix}#method">How scoring works</a>
      <a href="${prefix}industries/">All industries</a>
    </nav>
  </header>
  <main>
    ${options.body}
  </main>
  <footer class="site-footer">
    <div>Built by <a href="https://github.com/Nidhi-bhai">Nidhi Karuturi</a></div>
    <div><a href="https://uncomtrade.org/docs/un-comtrade-api/">UN Comtrade API</a></div>
  </footer>
</body>
</html>
`;
}

function channelBlock(channel) {
  const figures = channel.figures
    ? `<p class="figures">primaryValue ${esc(channel.figures.primaryValue)} USD (${esc(channel.figures.primaryValueGrouped)}) · ${esc(channel.figures.period)} imports from World · rank ${esc(channel.figures.rank)} of ${esc(channel.figures.reporterCount)}</p>`
    : "";
  return `<article class="channel">
    <div class="rank-no">${esc(channel.rank)}</div>
    <div>
      <div class="meta-row"><span class="pill">${esc(typeLabel(channel.type))}</span><span class="total">${esc(channel.composite)} / 15</span></div>
      <h3><a href="${esc(channel.url)}">${esc(channel.name)}</a></h3>
      <div class="scores">
        <div class="score"><span>Money</span><b>${esc(channel.money)}</b></div>
        <div class="score"><span>Authority</span><b>${esc(channel.authority)}</b></div>
        <div class="score"><span>Need</span><b>${esc(channel.need)}</b></div>
      </div>
      ${figures}
      <p class="reason">${esc(channel.reason)}</p>
      <p class="source">Source: <a href="${esc(channel.source.url)}">${esc(channel.source.title)}</a></p>
    </div>
  </article>`;
}

function countryTable(industry) {
  if (!industry.hs) {
    return "<p>This is a service. UN Comtrade has no merchandise heading for it, and this page does not invent one.</p>";
  }
  const series = trade.series[industry.hs.code];
  if (!series) return "<p>No Comtrade snapshot is stored for this HS code.</p>";
  const rows = series.reporters.filter(function (row) {
    return Number(row.primaryValue) > 0;
  }).slice(0, 8);
  const body = rows.map(function (row, index) {
    const qty = row.qtyUnitAbbr && row.qtyUnitAbbr !== "N/A" && Number(row.qty) > 0
      ? esc(rank.groupExact(String(row.qty))) + " " + esc(row.qtyUnitAbbr)
      : "—";
    return `<tr><td>${index + 1}</td><td>${esc(row.reporterDesc)}</td><td class="num">${esc(row.primaryValue)}</td><td>${qty}</td></tr>`;
  }).join("");
  return `<p>${esc(industry.hs.note)}</p>
    <p>Official description: ${esc(series.cmdDesc)}. Period ${esc(series.period)}, flow import, partner World. Retrieved ${esc(trade.retrieved)}. Reporters in the response: ${esc(series.reporterCount)}. The preview count ${series.complete ? "matched the stored rows" : "did not match the stored rows"}.</p>
    <p>Source query: <a href="${esc(series.queryUrl)}">${esc(series.queryUrl)}</a></p>
    <table>
      <thead><tr><th>#</th><th>Reporter</th><th>primaryValue USD</th><th>Quantity</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="note">The table is the Comtrade response, not a BuyerRadar estimate. Rank in this table is by primaryValue among reporters stored for this query.</p>`;
}

function industryPage(industry) {
  const report = rank.buildReport(industry, trade, industry.name);
  const free = report.channels.slice(0, rank.FREE_LIMIT).map(channelBlock).join("");
  const description = "Where to find buyers for " + industry.name + ". Ranked channels scored on money, authority, and need, with sources. " + industry.summary;
  const canonical = origin + "/industries/" + industry.slug + ".html";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Where to find buyers for " + industry.name,
    description: industry.summary,
    author: { "@type": "Person", name: "Nidhi Karuturi", url: "https://github.com/Nidhi-bhai" },
    about: industry.name,
    url: canonical
  });
  const body = `<article class="page-intro">
    <p class="kicker">Where to find buyers</p>
    <h1>Where to find buyers for ${esc(industry.name)}</h1>
    <p class="lede">${esc(industry.summary)}</p>
    <p><a class="button" href="../?q=${encodeURIComponent(industry.name)}">Open the live ranking</a></p>
    <h2>Importing countries</h2>
    ${countryTable(industry)}
    <h2>Top 5 channels on the free ranking</h2>
    <p>These are the first five channels after Money, Authority, and Need are summed. Outreach angles are in the paid report, not on this page.</p>
    ${free}
    <p><a href="../?q=${encodeURIComponent(industry.name)}">See this ranking in the tool</a> · <a href="./">All industries</a></p>
  </article>`;
  return shell({
    title: "Where to find buyers for " + industry.name + " | BuyerRadar",
    description: description,
    canonical: canonical,
    jsonLd: jsonLd,
    depth: true,
    body: body
  });
}

const industryDir = path.join(root, "industries");
fs.mkdirSync(industryDir, { recursive: true });
industries.forEach(function (industry) {
  fs.writeFileSync(path.join(industryDir, industry.slug + ".html"), industryPage(industry));
});

const indexBody = `<article class="page-intro">
  <p class="kicker">${industries.length} industries</p>
  <h1>Where to find buyers, by product</h1>
  <p class="lede">Each page is the public brief for one industry: the HS heading when there is one, the UN Comtrade import table, and the top five scored channels. The full report with outreach angles stays in the tool.</p>
  ${directory(industries, "")}
</article>`;
fs.writeFileSync(path.join(industryDir, "index.html"), shell({
  title: "Industries | BuyerRadar",
  description: "SEO pages for every BuyerRadar industry: where to find buyers, with sources and UN Comtrade figures for goods.",
  canonical: origin + "/industries/",
  depth: true,
  body: indexBody
}));

const homePath = path.join(root, "index.html");
const home = fs.readFileSync(homePath, "utf8");
const marker = /<!-- DIRECTORY:START -->[\s\S]*<!-- DIRECTORY:END -->/;
if (!marker.test(home)) throw new Error("Directory markers missing from index.html");
const injected = home.replace(
  marker,
  "<!-- DIRECTORY:START -->\n" + directory(industries, "industries/") + "\n<!-- DIRECTORY:END -->"
);
fs.writeFileSync(homePath, injected);

fs.writeFileSync(path.join(root, "data", "industries.json"), JSON.stringify({
  product: "BuyerRadar",
  count: industries.length,
  industries: industries
}, null, 2) + "\n");

const urls = [origin + "/"].concat(industries.map(function (industry) {
  return origin + "/industries/" + industry.slug + ".html";
})).concat([origin + "/industries/"]);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(function (url) {
  return `  <url><loc>${url}</loc></url>`;
}).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(root, "robots.txt"), `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`);

console.log("built " + industries.length + " industry pages");
