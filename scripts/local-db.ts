import EmbeddedPostgres from "embedded-postgres";

async function main() {
  console.log("-> جاري تشغيل سيرفر PostgreSQL المحلي...");
  
  const pg = new EmbeddedPostgres({
    databaseDir: "./.local-pg-data",
    port: 5432,
    user: "postgres",
    password: "postgres",
    database: "evo_store",
    persistent: true,
  });

  await pg.initialise();
  await pg.start();
  
  console.log("✅ قاعدة بيانات PostgreSQL شغالّة محلياً على البورت 5432!");
  console.log("رابط الاتصال: postgresql://postgres:postgres@localhost:5432/evo_store");

  process.on("SIGINT", async () => {
    console.log("إيقاف قاعدة البيانات...");
    await pg.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("فشل تشغيل PostgreSQL المحلي:", err);
  process.exit(1);
});
