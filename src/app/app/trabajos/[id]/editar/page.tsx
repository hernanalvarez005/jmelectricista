import { notFound } from "next/navigation";

import { JobForm } from "@/components/jobs/job-form";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getJobDetail } from "@/lib/data/jobs";
import { getJobFormOptions } from "@/lib/data/job-form-options";

export default async function EditarTrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireCurrentOrg();

  const [detail, options] = await Promise.all([
    getJobDetail(organization.id, id),
    getJobFormOptions(organization.id),
  ]);

  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Editar trabajo</h2>
      <JobForm options={options} job={detail.job} />
    </div>
  );
}
