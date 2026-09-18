import Link from "next/link";
import { Plus } from "lucide-react";

import { JobsFilterBar } from "@/components/jobs/jobs-filter-bar";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Button } from "@/components/ui/button";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listJobs } from "@/lib/data/jobs";
import { getJobFormOptions } from "@/lib/data/job-form-options";

export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; type?: string; priority?: string }>;
}) {
  const params = await searchParams;
  const { organization } = await requireCurrentOrg();

  const [jobs, options] = await Promise.all([
    listJobs(organization.id, {
      statusId: params.status,
      clientId: params.client,
      jobTypeId: params.type,
      priority: params.priority,
    }),
    getJobFormOptions(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Trabajos</h2>
          <p className="text-sm text-muted-foreground">
            {jobs.length} trabajo{jobs.length === 1 ? "" : "s"} en total.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/trabajos/nuevo">
            <Plus /> Nuevo trabajo
          </Link>
        </Button>
      </div>

      <JobsFilterBar statuses={options.statuses} clients={options.clients} jobTypes={options.jobTypes} />
      <JobsTable jobs={jobs} timezone={organization.timezone} />
    </div>
  );
}
