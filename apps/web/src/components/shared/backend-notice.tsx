import { ServerOffIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BackendNoticeProps = {
  message: string;
  /** Set when the FastAPI server could not be reached at all. */
  unreachable?: boolean;
};

/** Consistent inline error for backend failures (uploads, outfits, try-on). */
export function BackendNotice({ message, unreachable }: BackendNoticeProps) {
  return (
    <Alert variant={unreachable ? "default" : "destructive"}>
      {unreachable ? <ServerOffIcon /> : <TriangleAlertIcon />}
      <AlertTitle>{unreachable ? "API not running" : "Something went wrong"}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
