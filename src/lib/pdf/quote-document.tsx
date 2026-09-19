import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { brand } from "@/lib/brand";
import { formatDateOnly } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

const colors = brand.colors;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: colors.primaryDark, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 48, height: 48 },
  businessName: { fontSize: 14, fontWeight: 700, marginTop: 6 },
  quoteBox: { alignItems: "flex-end" },
  quoteNumber: { fontSize: 14, fontWeight: 700 },
  accentBar: { height: 3, backgroundColor: colors.electricYellow, marginVertical: 14 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.mutedText,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  section: { marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  table: { borderTopWidth: 1, borderTopColor: colors.border },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.primaryDark,
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.4, textAlign: "right" },
  colSubtotal: { flex: 1.4, textAlign: "right" },
  totalsBox: { alignSelf: "flex-end", width: 220, marginTop: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.primaryDark,
  },
  totalFinalLabel: { fontSize: 11, fontWeight: 700 },
  totalFinalValue: { fontSize: 11, fontWeight: 700 },
  footer: { marginTop: 28, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  footerText: { fontSize: 8.5, color: colors.mutedText, marginBottom: 4 },
});

/**
 * Datos mínimos para renderizar el PDF. Tanto el PDF interno como el público se arman SOLO con esto:
 * ningún campo de costos, márgenes ni datos internos puede llegar al documento.
 */
export type QuoteDocumentData = {
  organizationName: string;
  currency: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string | null;
  clientName: string;
  clientAddress: string | null;
  jobTitle: string;
  jobDescription: string | null;
  items: { key: string; description: string; quantity: number; unit: string; unitPrice: number; subtotal: number }[];
  subtotal: number;
  discountAmount: number;
  total: number;
  terms: string | null;
  notes: string | null;
};

export function QuoteDocument({ data, logoAbsolutePath }: { data: QuoteDocumentData; logoAbsolutePath: string }) {
  const organization = { name: data.organizationName, currency: data.currency };
  const quote = {
    quote_number: data.quoteNumber,
    issue_date: data.issueDate,
    valid_until: data.validUntil,
    subtotal: data.subtotal,
    discount_amount: data.discountAmount,
    total: data.total,
    terms: data.terms,
    notes: data.notes,
  };
  const { clientName, clientAddress, jobTitle, jobDescription, items } = data;
  return (
    <Document title={`${quote.quote_number} - ${clientName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoAbsolutePath} style={styles.logo} />
            <Text style={styles.businessName}>{organization.name}</Text>
          </View>
          <View style={styles.quoteBox}>
            <Text style={styles.quoteNumber}>{quote.quote_number}</Text>
            <Text>{formatDateOnly(quote.issue_date)}</Text>
          </View>
        </View>

        <View style={styles.accentBar} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente</Text>
          <Text>{clientName}</Text>
          {clientAddress && <Text>{clientAddress}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trabajo</Text>
          <Text>{jobTitle}</Text>
          {jobDescription && <Text>{jobDescription}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle</Text>
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.colDescription}>Descripción</Text>
              <Text style={styles.colQty}>Cantidad</Text>
              <Text style={styles.colPrice}>Precio unit.</Text>
              <Text style={styles.colSubtotal}>Subtotal</Text>
            </View>
            {items.map((item) => (
              <View key={item.key} style={styles.tableRow}>
                <Text style={styles.colDescription}>{item.description}</Text>
                <Text style={styles.colQty}>
                  {item.quantity} {item.unit}
                </Text>
                <Text style={styles.colPrice}>{formatMoney(item.unitPrice, organization.currency)}</Text>
                <Text style={styles.colSubtotal}>{formatMoney(item.subtotal, organization.currency)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{formatMoney(Number(quote.subtotal), organization.currency)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>Descuento</Text>
              <Text>{formatMoney(Number(quote.discount_amount), organization.currency)}</Text>
            </View>
            <View style={styles.totalFinalRow}>
              <Text style={styles.totalFinalLabel}>Total</Text>
              <Text style={styles.totalFinalValue}>
                {formatMoney(Number(quote.total), organization.currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          {quote.valid_until && (
            <Text style={styles.footerText}>
              Válida hasta el {formatDateOnly(quote.valid_until)}.
            </Text>
          )}
          {quote.terms && <Text style={styles.footerText}>{quote.terms}</Text>}
          {quote.notes && <Text style={styles.footerText}>{quote.notes}</Text>}
        </View>
      </Page>
    </Document>
  );
}
