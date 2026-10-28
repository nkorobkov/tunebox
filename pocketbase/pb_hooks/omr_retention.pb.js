/// <reference path="../pb_data/types.d.ts" />

// Retention for the recognition service's records (omr_conversions, see the
// 1784300000_omr_conversions migration): every night, delete conversions older than
// 90 days. Deleting a record also deletes its stored files (uploaded image, MusicXML).
//
// NOTE: like routerAdd, cronAdd callbacks run in their own scope, so everything they
// need is defined inside the callback.

cronAdd("omr_conversions_retention", "17 3 * * *", () => {
    const RETENTION_DAYS = 90;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400 * 1000)
        .toISOString().replace("T", " ");
    let deleted = 0;
    for (;;) {
        const batch = $app.findRecordsByFilter(
            "omr_conversions", "created < {:cutoff}", "created", 200, 0, { cutoff: cutoff });
        if (!batch.length) break;
        for (const record of batch) {
            $app.delete(record);
            deleted++;
        }
    }
    if (deleted) {
        $app.logger().info("omr_conversions retention", "deleted", deleted, "cutoff", cutoff);
    }
});
