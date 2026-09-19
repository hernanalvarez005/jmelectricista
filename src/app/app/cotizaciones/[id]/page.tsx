import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteDetailsForm } from "@/components/quotes/quote-details-form";
import { QuoteItemsTable } from "@/components/quotes/quote-items-table";
import { QuotePdfButton } from "@/components/quotes/quote-pdf-button";
import { QuoteShareCard } from "@/components/quotes/quote-share-card";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPublicQuoteUrl, getAppBaseUrl } from "@/lib/app-url";
import { canOperate, requireCurrentOrg } from "@/lib/data/current-org";
import { getActiveQuoteShareLink } from "@/lib/data/quote-share";
import { formatDateTime } from "@/lib/format/dates";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/phone";
import { listMaterialsForQuoteItems } from "@/lib/data/materials";
import { getQuoteDetail } from "@/lib/data/quotes";
import { listJobStatusesForSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { quoteStatusLabels } from "@/lib/validations/quote";

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  rejected: "destructive",
  expired: "secondary",
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization, role } = await requireCurrentOrg();

  const detail = await getQuoteDetail(organization.id, id);
  if (!detail) notFound();

  const supabase = await createClient();
  const [materials, jobStatuses, { count: jobMaterialsCount }, shareLink, { data: quoteClient }] = await Promise.all([
    listMaterialsForQuoteItems(organization.id),
    listJobStatusesForSettings(organization.id),
    supabase
      .from("job_materials")
      .select("id", { count: "exact", head: true })
      .eq("job_id", detail.quote.job_id),
    getActiveQuoteShareLink(organization.id, detail.quote.id),
    supabase.from("clients").select("phone").eq("id", detail.quote.client_id).maybeSingle(),
  ]);
  const phoneState = normalizeWhatsAppPhone(quoteClient?.phone, organization.default_country_code).status;
  const shareUrl = shareLink ? buildPublicQuoteUrl(await getAppBaseUrl(), shareLink.token) : null;

  const isDraft = detail.quote.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{detail.quote.quote_number}</h2>
            <Badge variant={statusVariant[detail.quote.status] ?? "outline"}>
              {quoteStatusLabels[detail.quote.status] ?? detail.quote.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.clientName} ·{" "}
            <Link href={`/app/trabajos/${detail.quote.job_id}`} className="hover:underline">
              {detail.jobTitle}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuotePdfButton quoteId={detail.quote.id} />
          <QuoteStatusActions
            quoteId={detail.quote.id}
            jobId={detail.quote.job_id}
            status={detail.quote.status}
            jobStatuses={jobStatuses.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compartir con el cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteShareCard
            quoteId={detail.quote.id}
            isDraft={isDraft}
            canShare={canOperate(role)}
            shareUrl={shareUrl}
            openCount={shareLink?.openCount ?? 0}
            lastOpenedLabel={shareLink?.lastOpenedAt ? formatDateTime(shareLink.lastOpenedAt, organization.timezone) : null}
            phoneState={phoneState}
            clientHref={`/app/clientes/${detail.quote.client_id}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ítems</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteItemsTable
            quoteId={detail.quote.id}
            jobId={detail.quote.job_id}
            items={detail.items}
            materials={materials}
            currency={organization.currency}
            isDraft={isDraft}
            hasJobMaterials={(jobMaterialsCount ?? 0) > 0}
            subtotal={Number(detail.quote.subtotal)}
            discountAmount={Number(detail.quote.discount_amount)}
            total={Number(detail.quote.total)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteDetailsForm quote={detail.quote} jobId={detail.quote.job_id} isDraft={isDraft} />
        </CardContent>
      </Card>
    </div>
  );
}
