import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { INITIAL_DEMO_STATE } from "@/data/initialDemoState";
import type { SystemState } from "@/lib/types";

const STATE_KEY = "dss_shared_state_v3";

export async function GET() {
  try {
    if (redis) {
      const data = await redis.get<SystemState>(STATE_KEY);
      if (data) {
        return NextResponse.json({ source: "redis", state: data });
      }
    }
  } catch (err) {
    console.error("Redis GET error, falling back to default:", err);
  }

  return NextResponse.json({ source: "default", state: INITIAL_DEMO_STATE });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { state: SystemState };
    if (redis && body?.state) {
      await redis.set(STATE_KEY, body.state);
      return NextResponse.json({ success: true, savedTo: "redis" });
    }
  } catch (err) {
    console.error("Redis POST error:", err);
  }
  return NextResponse.json({ success: true, savedTo: "local_only" });
}

export async function DELETE() {
  try {
    if (redis) {
      await redis.set(STATE_KEY, INITIAL_DEMO_STATE);
      return NextResponse.json({ success: true, resetTo: "redis" });
    }
  } catch (err) {
    console.error("Redis DELETE error:", err);
  }
  return NextResponse.json({ success: true, resetTo: "local_only" });
}
