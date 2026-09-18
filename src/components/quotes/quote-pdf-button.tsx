import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QuotePdfButton({ quoteId }: { quoteId: string }) {
  return (
    <Button variant="outline" asChild>
      <a href={`/api/quotes/${quoteId}/pdf`} target="_blank" rel="noopener noreferrer">
        <FileDown /> Ver PDF
      </a>
    </Button>
  );
}
