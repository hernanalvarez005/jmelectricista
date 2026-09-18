"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateJobStatusAction } from "@/app/app/trabajos/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function JobStatusSelect({
  jobId,
  statusId,
  statuses,
}: {
  jobId: string;
  statusId: string;
  statuses: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(newStatusId: string) {
    startTransition(async () => {
      const result = await updateJobStatusAction(jobId, newStatusId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Estado actualizado");
      router.refresh();
    });
  }

  return (
    <Select value={statusId} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
