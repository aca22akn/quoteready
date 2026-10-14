import { db } from "@/lib/server/supabase";

export async function GET() {
  try {
    const { error } = await db().from("products").select("id").limit(1);
    if (error) throw new Error("db");
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { ok: false, error: { code: "DB_UNAVAILABLE", message: "The database could not be reached." } },
      { status: 503 },
    );
  }
}
