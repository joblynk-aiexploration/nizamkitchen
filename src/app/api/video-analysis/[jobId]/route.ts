import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getAnalysisJob } from "@/server/video-analysis/video-analysis-jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });

  const { jobId } = await params;
  const job = await getAnalysisJob(jobId);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  return NextResponse.json(job);
}
