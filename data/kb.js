const food = require("./catalog/goods-food");
const foodMore = require("./catalog/goods-food-2");
const industrial = require("./catalog/goods-industrial");
const services = require("./catalog/services");
const rank = require("../js/rank");

const industries = food.concat(foodMore, industrial, services);
industries.forEach(function (industry) {
  industry.channels = industry.channels.map(rank.applyEditorialPolicy);
});

function assertKb(list) {
  if (list.length < 40) {
    throw new Error("Knowledge base has " + list.length + " industries; at least 40 are required.");
  }
  const slugs = new Set();
  const aliases = new Map();
  list.forEach(function (industry) {
    if (!industry.id || !industry.slug || !industry.name || !industry.summary) {
      throw new Error("Industry is missing identity fields: " + industry.id);
    }
    if (slugs.has(industry.slug)) throw new Error("Duplicate slug " + industry.slug);
    slugs.add(industry.slug);
    if (!industry.channels || industry.channels.length < 6) {
      throw new Error(industry.slug + " needs at least 6 curated channels");
    }
    (industry.aliases || []).concat([industry.name]).forEach(function (alias) {
      const key = alias.toLowerCase();
      if (aliases.has(key) && aliases.get(key) !== industry.slug) {
        throw new Error('Alias "' + alias + '" is used by ' + aliases.get(key) + " and " + industry.slug);
      }
      aliases.set(key, industry.slug);
    });
    if (industry.kind === "goods") {
      if (!industry.hs || !/^\d{6}$/.test(industry.hs.code)) throw new Error("Bad HS code on " + industry.slug);
      if (!["specific", "close", "broad"].includes(industry.hs.specificity)) {
        throw new Error("Bad specificity on " + industry.slug);
      }
      if (!industry.hs.note || !industry.hs.classificationSource) throw new Error("Missing HS note on " + industry.slug);
    } else if (industry.hs) {
      throw new Error("Service should not have an HS code: " + industry.slug);
    }
    industry.channels.forEach(function (channel) {
      ["type", "name", "url", "reason", "outreachAngle"].forEach(function (field) {
        if (!channel[field]) throw new Error(industry.slug + " channel missing " + field);
      });
      ["money", "authority", "need"].forEach(function (field) {
        if (!Number.isInteger(channel[field]) || channel[field] < 1 || channel[field] > 5) {
          throw new Error(industry.slug + " " + channel.name + " has an invalid " + field);
        }
      });
      if (!/^https:\/\//.test(channel.url)) throw new Error("URL must be https: " + channel.url);
      if (!channel.source || !/^https:\/\//.test(channel.source.url) || !channel.source.title) {
        throw new Error("Missing source on " + industry.slug + " / " + channel.name);
      }
      if (channel.type !== "country" && /primaryValue|\$\d/.test(channel.reason)) {
        throw new Error("Curated reason looks like a trade figure: " + industry.slug + " / " + channel.name);
      }
    });
  });
}

assertKb(industries);

module.exports = {
  industries: industries,
  assertKb: assertKb
};
