/// <reference path="../pb_data/types.d.ts" />

// Proxy for thesession.org API to avoid CORS issues in the SPA.
// Hardened with input validation and length caps.
//
// NOTE: PocketBase JSVM (goja) isolates each routerAdd callback into its own
// scope — top-level const and helper functions are NOT visible inside the
// callbacks, so all validation logic must be inlined here.
//
// NOTE: routes are public (no auth) so existing frontend fetch() calls keep
// working. When the SPA is updated to send the auth token on these requests,
// add `$apis.requireAuth("users")` as a third argument to routerAdd.

routerAdd("GET", "/api/session/search", (e) => {
    const rawQ = e.request.url.query().get("q") || "";
    const q = rawQ.replace(/[\r\n]/g, "").slice(0, 100);
    if (!q) throw new BadRequestError("Missing query.");

    const page = parseInt(e.request.url.query().get("page") || "1", 10);
    const perpage = parseInt(e.request.url.query().get("perpage") || "20", 10);
    if (isNaN(page) || page < 1 || page > 1000) throw new BadRequestError("Invalid page.");
    if (isNaN(perpage) || perpage < 1 || perpage > 50) throw new BadRequestError("Invalid perpage.");

    const url = "https://thesession.org/tunes/search?q=" + encodeURIComponent(q) +
        "&format=json&perpage=" + perpage + "&page=" + page;

    const res = $http.send({ url: url, method: "GET" });
    return e.json(res.statusCode, res.json);
});

routerAdd("GET", "/api/session/tune/{id}", (e) => {
    const id = e.request.pathValue("id");
    if (!/^\d{1,10}$/.test(id)) throw new BadRequestError("Invalid tune id.");

    const url = "https://thesession.org/tunes/" + id + "?format=json";
    const res = $http.send({ url: url, method: "GET" });
    return e.json(res.statusCode, res.json);
});
