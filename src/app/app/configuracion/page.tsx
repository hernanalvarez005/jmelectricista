import { BusinessHoursPanel } from "@/components/settings/business-hours-panel";
import { JobStatusesPanel } from "@/components/settings/job-statuses-panel";
import { JobTypesPanel } from "@/components/settings/job-types-panel";
import { OrganizationForm } from "@/components/settings/organization-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBusinessHours } from "@/lib/data/business-hours";
import { requireCurrentOrg } from "@/lib/data/current-org";
import { listJobStatusesForSettings, listJobTypesForSettings } from "@/lib/data/settings";

export default async function ConfiguracionPage() {
  const { organization } = await requireCurrentOrg();

  const [jobTypes, jobStatuses, businessHours] = await Promise.all([
    listJobTypesForSettings(organization.id),
    listJobStatusesForSettings(organization.id),
    getBusinessHours(organization.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Configuración</h2>

      <Tabs defaultValue="negocio">
        <TabsList>
          <TabsTrigger value="negocio">Negocio</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de trabajo</TabsTrigger>
          <TabsTrigger value="estados">Estados</TabsTrigger>
          <TabsTrigger value="horarios">Horarios laborales</TabsTrigger>
        </TabsList>
        <TabsContent value="negocio" className="mt-4">
          <OrganizationForm organization={organization} />
        </TabsContent>
        <TabsContent value="tipos" className="mt-4">
          <JobTypesPanel jobTypes={jobTypes} />
        </TabsContent>
        <TabsContent value="estados" className="mt-4">
          <JobStatusesPanel jobStatuses={jobStatuses} />
        </TabsContent>
        <TabsContent value="horarios" className="mt-4">
          <BusinessHoursPanel businessHours={businessHours} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
