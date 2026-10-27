(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BuyerRadarPurchases = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var KEY = "buyerradar.purchases.v1";

  function read(storage) {
    try {
      var raw = storage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function save(storage, record) {
    var list = read(storage).filter(function (item) {
      return item.slug !== record.slug;
    });
    list.unshift({
      product: record.product,
      slug: record.slug,
      query: record.query || record.product,
      orderId: record.orderId,
      purchasedAt: record.purchasedAt
    });
    storage.setItem(KEY, JSON.stringify(list));
    return list;
  }

  function forSlug(storage, slug) {
    var found = read(storage).filter(function (item) {
      return item.slug === slug;
    });
    return found[0] || null;
  }

  return { KEY: KEY, read: read, save: save, forSlug: forSlug };
});
