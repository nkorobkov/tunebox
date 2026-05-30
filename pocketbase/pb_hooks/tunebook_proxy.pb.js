/// <reference path="../pb_data/types.d.ts" />

// Proxy for thesession.org member tunebook listing.
// GET /api/session/tunebook/{memberId}?page=N
//   forwards to https://thesession.org/members/{memberId}/tunebook?format=json&perpage=50&page=N
//
// NOTE: PocketBase JSVM (goja) isolates each routerAdd callback into its own
// scope — keep all validation logic inlined here, matching session_proxy.pb.js.

routerAdd("GET", "/api/session/tunebook/{memberId}", (e) => {
    const memberId = e.request.pathValue("memberId");
    if (!/^\d{1,10}$/.test(memberId)) throw new BadRequestError("Invalid member id.");

    const page = parseInt(e.request.url.query().get("page") || "1", 10);
    if (isNaN(page) || page < 1 || page > 1000) throw new BadRequestError("Invalid page.");

    const url = "https://thesession.org/members/" + memberId +
        "/tunebook?format=json&perpage=50&page=" + page;

    const res = $http.send({ url: url, method: "GET" });
    return e.json(res.statusCode, res.json);
});
