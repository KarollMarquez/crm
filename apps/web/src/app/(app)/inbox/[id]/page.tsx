"use client";

import { useParams } from "next/navigation";
import { InboxView } from "@/components/inbox-view";

export default function InboxThreadPage() {
  const { id } = useParams<{ id: string }>();
  return <InboxView initialId={id} />;
}
