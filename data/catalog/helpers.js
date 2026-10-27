function censusUrl(code) {
  return "https://www.census.gov/naics/?input=" + code + "&year=2022&details=" + code;
}

function buyer(code, title, money, authority, need, reason, angle) {
  var url = censusUrl(code);
  return {
    type: "buyer_type",
    name: title,
    url: url,
    money: money,
    authority: authority,
    need: need,
    reason: reason,
    outreachAngle: angle,
    source: {
      title: "U.S. Census Bureau, NAICS 2022, " + code + " — " + title,
      url: url
    }
  };
}

function job(code, title, money, authority, need, reason, angle) {
  var url = "https://www.onetonline.org/link/summary/" + code;
  return {
    type: "job_title",
    name: title,
    url: url,
    money: money,
    authority: authority,
    need: need,
    reason: reason,
    outreachAngle: angle,
    source: {
      title: "O*NET OnLine " + code + " — " + title,
      url: url
    }
  };
}

function place(type, name, url, money, authority, need, reason, angle, sourceTitle) {
  return {
    type: type,
    name: name,
    url: url,
    money: money,
    authority: authority,
    need: need,
    reason: reason,
    outreachAngle: angle,
    source: { title: sourceTitle || name, url: url }
  };
}

var HS_SOURCE = {
  title: "World Customs Organization — HS Nomenclature 2022 edition",
  url: "https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition.aspx"
};

function goods(fields) {
  fields.kind = "goods";
  fields.hs.classificationSource = HS_SOURCE;
  return fields;
}

function service(fields) {
  fields.kind = "service";
  fields.hs = null;
  return fields;
}

module.exports = {
  buyer: buyer,
  job: job,
  place: place,
  goods: goods,
  service: service,
  HS_SOURCE: HS_SOURCE
};
