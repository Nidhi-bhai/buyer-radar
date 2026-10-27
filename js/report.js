(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BuyerRadarReport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function labels() {
    if (typeof module === "object" && module.exports) return require("./rank.js").TYPE_LABELS;
    return globalThis.BuyerRadarRank.TYPE_LABELS;
  }

  function line(label, value) {
    return "- " + label + ": " + value;
  }

  function toMarkdown(report) {
    var typeLabels = labels();
    var industry = report.industry;
    var out = [];
    out.push("# BuyerRadar report: " + industry.name);
    out.push("");
    out.push("Query: " + report.query);
    out.push("Industry: " + industry.name + " (`" + industry.slug + "`)");
    out.push("");
    out.push(industry.summary);
    out.push("");
    out.push("## How the scores work");
    out.push("");
    out.push(report.methodology.scale);
    out.push("");
    out.push(report.methodology.ties);
    out.push("");
    out.push(report.methodology.editorial);
    out.push("");
    out.push(report.methodology.countries);
    out.push("");
    out.push("## Trade data");
    out.push("");
    var trade = report.trade;
    if (!trade.available) {
      out.push(trade.note);
    } else {
      out.push(trade.hsNote);
      out.push("");
      out.push(line("HS code", trade.cmdCode));
      out.push(line("Official description", trade.cmdDesc || "not returned"));
      out.push(line("Flow", "Import (flowCode M), partner World"));
      out.push(line("Period", String(trade.period)));
      out.push(line("Retrieved", trade.retrieved || "unknown"));
      out.push(line("Reporters stored", String(trade.reporterCount)));
      out.push(line("API count", String(trade.apiCount)));
      out.push(line("Preview complete", trade.complete ? "yes, count matched stored rows and was under 500" : "no"));
      out.push(line("Query", trade.queryUrl));
      out.push(line("API documentation", trade.documentation || report.methodology.documentation));
      out.push(line("Database", trade.database || "https://comtradeplus.un.org/"));
      if (trade.classificationSource) {
        out.push(line("HS nomenclature", trade.classificationSource.title + " — " + trade.classificationSource.url));
      }
    }
    out.push("");
    out.push("## Ranked channels");
    out.push("");
    out.push(
      "The free tier of the site is the top " +
        report.freeLimit +
        ". This file adds " +
        (report.extraCount != null ? report.extraCount : Math.max(0, report.channels.length - report.freeLimit)) +
        " more channels and " +
        report.channels.length +
        " outreach angles, one on every channel."
    );
    out.push("");
    report.channels.forEach(function (channel) {
      var typeLabel = typeLabels[channel.type] || channel.type;
      out.push("### " + channel.rank + ". " + channel.name);
      out.push("");
      out.push(line("Type", typeLabel));
      out.push(line("Money", String(channel.money) + " / 5"));
      out.push(line("Authority", String(channel.authority) + " / 5"));
      out.push(line("Need", String(channel.need) + " / 5"));
      out.push(line("Total", String(channel.composite) + " / 15"));
      out.push(line("Link", channel.url));
      if (channel.figures) {
        out.push(line("primaryValue USD", channel.figures.primaryValue));
        out.push(line("primaryValue with separators", channel.figures.primaryValueGrouped));
        if (channel.figures.qty) {
          out.push(
            line(
              "Quantity",
              channel.figures.qty +
                " " +
                channel.figures.qtyUnit +
                (channel.figures.qtyEstimated ? " (estimated flag)" : "")
            )
          );
        }
        out.push(
          line(
            "Rank among reporters",
            channel.figures.rank + " of " + channel.figures.reporterCount + " in the stored Comtrade response"
          )
        );
      }
      out.push("");
      out.push(channel.reason);
      out.push("");
      out.push("**Outreach:** " + channel.outreachAngle);
      out.push("");
      out.push("Source: " + channel.source.title + " — " + channel.source.url);
      out.push("");
    });
    out.push("## Limits");
    out.push("");
    out.push(
      "Editorial scores are judgments, not statistics. Every trade dollar in this report is a UN Comtrade primaryValue literal from the query above. BuyerRadar did not estimate a market size, a growth rate, or a buyer count."
    );
    out.push("");
    if (report.orderId) {
      out.push("Order id: " + report.orderId);
      if (report.purchasedAt) out.push("Purchased: " + report.purchasedAt);
      out.push("");
    }
    out.push("Contact: nidhi69n@gmail.com");
    out.push("Refunds: email within 7 days with your order id.");
    out.push("");
    out.push("Built by Nidhi Karuturi — https://github.com/Nidhi-bhai");
    out.push("");
    return out.join("\n");
  }

  function winAnsi(text) {
    var value = String(text)
      .replace(/\u2014/g, "-")
      .replace(/\u2013/g, "-")
      .replace(/\u2018|\u2019/g, "'")
      .replace(/\u201c|\u201d/g, '"')
      .replace(/\u2026/g, "...")
      .replace(/\u00a0/g, " ")
      .replace(/\u2022/g, "-");
    var out = "";
    for (var i = 0; i < value.length; i += 1) {
      var code = value.charCodeAt(i);
      if (code === 10 || code === 13 || code === 9) {
        out += " ";
      } else if (code >= 32 && code <= 255) {
        out += value.charAt(i);
      } else {
        out += "?";
      }
    }
    return out;
  }

  function pieces(word, width) {
    if (word.length <= width) return [word];
    var out = [];
    var rest = word;
    while (rest.length > width) {
      var window = rest.slice(0, width);
      var breakAt = -1;
      ["&", "?", "/", "="].forEach(function (mark) {
        var at = window.lastIndexOf(mark);
        if (at > breakAt) breakAt = at;
      });
      var cut = breakAt >= 16 ? breakAt + 1 : width;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) out.push(rest);
    return out;
  }

  function wrap(text, width) {
    var words = winAnsi(text).split(/\s+/).filter(Boolean);
    var lines = [];
    var current = "";
    function append(part) {
      if (!current) {
        current = part;
        return;
      }
      if ((current + " " + part).length <= width) current += " " + part;
      else {
        lines.push(current);
        current = part;
      }
    }
    words.forEach(function (word) {
      pieces(word, width).forEach(append);
    });
    if (current) lines.push(current);
    if (!lines.length) lines.push("");
    return lines;
  }

  function pdfEscape(text) {
    return winAnsi(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function toPdf(report) {
    var markdown = toMarkdown(report);
    var paragraphs = markdown.split("\n");
    var lines = [];
    paragraphs.forEach(function (paragraph) {
      if (!paragraph.trim()) {
        lines.push("");
        return;
      }
      var heading = /^#{1,3}\s+/.test(paragraph);
      var content = paragraph.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "");
      wrap(content, heading ? 78 : 92).forEach(function (lineText) {
        lines.push(lineText);
      });
    });

    var pageWidth = 612;
    var pageHeight = 792;
    var margin = 54;
    var leading = 12;
    var usable = pageHeight - margin * 2;
    var perPage = Math.floor(usable / leading);
    var pages = [];
    for (var offset = 0; offset < lines.length; offset += perPage) {
      pages.push(lines.slice(offset, offset + perPage));
    }
    if (!pages.length) pages.push([""]);

    var objects = [];
    function add(body) {
      objects.push(body);
      return objects.length;
    }

    var fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    var fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    var pageIds = [];
    var contentIds = [];

    pages.forEach(function (pageLines, pageIndex) {
      var commands = ["BT", "/F2 11 Tf", "54 " + (pageHeight - margin) + " Td"];
      var first = true;
      pageLines.forEach(function (text) {
        if (!first) commands.push("0 -" + leading + " Td");
        first = false;
        var isHead = /^(BuyerRadar report|How the scores|Trade data|Ranked channels|Limits|\d+\. )/.test(text);
        commands.push((isHead ? "/F2 11 Tf " : "/F1 9 Tf ") + "(" + pdfEscape(text) + ") Tj");
      });
      commands.push("ET");
      commands.push("BT /F1 8 Tf 54 32 Td (" + pdfEscape("BuyerRadar  |  page " + (pageIndex + 1) + " of " + pages.length + "  |  Built by Nidhi Karuturi") + ") Tj ET");
      var stream = commands.join("\n") + "\n";
      var contentId = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream");
      contentIds.push(contentId);
      pageIds.push(null);
    });

    var kids = pageIds.map(function (_, index) {
      return "PAGE" + index;
    });
    var pagesId = add("<< /Type /Pages /Count " + pages.length + " /Kids [" + pages.map(function () { return "KID"; }).join(" ") + "] >>");
    // Rebuild pages object after we know page object ids. We'll fill Kids after creating pages.
    pages.forEach(function (_, index) {
      var id = add(
        "<< /Type /Page /Parent " +
          pagesId +
          " 0 R /MediaBox [0 0 " +
          pageWidth +
          " " +
          pageHeight +
          "] /Contents " +
          contentIds[index] +
          " 0 R /Resources << /Font << /F1 " +
          fontRegular +
          " 0 R /F2 " +
          fontBold +
          " 0 R >> >> >>"
      );
      pageIds[index] = id;
    });

    var pagesBody =
      "<< /Type /Pages /Count " +
      pages.length +
      " /Kids [" +
      pageIds.map(function (id) { return id + " 0 R"; }).join(" ") +
      "] >>";
    objects[pagesId - 1] = pagesBody;

    var catalogId = add("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");
    var chunks = ["%PDF-1.4\n"];
    var offsets = [0];
    objects.forEach(function (body, index) {
      offsets.push(chunks.join("").length);
      chunks.push(String(index + 1) + " 0 obj\n" + body + "\nendobj\n");
    });
    var xrefAt = chunks.join("").length;
    var xref = ["xref\n0 " + (objects.length + 1) + "\n", "0000000000 65535 f \n"];
    for (var i = 1; i < offsets.length; i += 1) {
      xref.push(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
    }
    chunks.push(xref.join(""));
    chunks.push("trailer << /Size " + (objects.length + 1) + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n");
    return chunks.join("");
  }

  function toPdfBytes(report) {
    var binary = toPdf(report);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 255;
    return bytes;
  }

  return { toMarkdown: toMarkdown, toPdf: toPdf, toPdfBytes: toPdfBytes };
});
