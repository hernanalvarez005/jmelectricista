import { BusinessHoursPanel } from "@/components/settings/business-hours-panel";
import { JobStatusesPanel } from "@/components/settings/job-statuses-panel";
import { JobTypesPanel } from "@/components/settings/job-types-panel";
import { OrganizationForm } from "@/components/settings/organization-form";
import { ExpenseCategoriesPanel } from "@/components/settings/expense-categories-panel";
import { LaborRatesPanel } from "@/components/settings/labor-rates-panel";
import { PaymentAccountsPanel } from "@/components/settings/payment-accounts-panel";
import { PaymentMethodsPanel } from "@/components/settings/payment-methods-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBusinessHours } from "@/lib/data/business-hours";
import { canAdminister, requireCurrentOrg } from "@/lib/data/current-org";
import { listExpenseCategories } from "@/lib/data/expenses";
import { listMembersWithLabor } from "@/lib/data/labor";
import { todayKeyInTZ } from "@/lib/scheduling/timezone";
import { listPaymentAccounts, listPaymentMethods } from "@/lib/data/payments";
import { listJobStatusesForSettings, listJobTypesForSettings } from "@/lib/data/settings";

export default async function ConfiguracionPage() {
  const { organization, role } = await requireCurrentOrg();
  const isAdmin = canAdminister(role);
  const todayKey = todayKeyInTZ(organization.timezone);

  const [jobTypes, jobStatuses, businessHours, paymentMethods, paymentAccounts, expenseCategories, laborMembers] = await Promise.all([
    listJobTypesForSettings(organization.id),
    listJobStatusesForSettings(organization.id),
    getBusinessHours(organization.id),
    listPaymentMethods(organization.id),
    listPaymentAccounts(organization.id),
    listExpenseCategories(organization.id),
    isAdmin ? listMembersWithLabor(organization.id, todayKey) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">Configuración</h2>

      <Tabs defaultValue="negocio">
        <div className="max-w-full overflow-x-auto">
        <TabsList>
          <TabsTrigger value="negocio">Negocio</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de trabajo</TabsTrigger>
          <TabsTrigger value="estados">Estados</TabsTrigger>
          <TabsTrigger value="horarios">Horarios laborales</TabsTrigger>
          <TabsTrigger value="medios">Medios de pago</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas de cobro</TabsTrigger>
          <TabsTrigger value="gastos">Categorías de gasto</TabsTrigger>
          {isAdmin && <TabsTrigger value="manoobra">Mano de obra</TabsTrigger>}
        </TabsList>
        </div>
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
        <TabsContent value="medios" className="mt-4">
          <PaymentMethodsPanel paymentMethods={paymentMethods} />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          <PaymentAccountsPanel paymentAccounts={paymentAccounts} />
        </TabsContent>
        <TabsContent value="gastos" className="mt-4">
          <ExpenseCategoriesPanel categories={expenseCategories} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="manoobra" className="mt-4">
            <LaborRatesPanel members={laborMembers} currency={organization.currency} todayKey={todayKey} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
