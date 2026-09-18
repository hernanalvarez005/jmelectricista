import { JobForm } from "@/components/jobs/job-form";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { getJobFormOptions } from "@/lib/data/job-form-options";

export default async function NuevoTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const { organization } = await requireCurrentOrg();
  const options = await getJobFormOptions(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Nuevo trabajo</h2>
      <JobForm options={options} defaultClientId={clientId} />
    </div>
  );
}
