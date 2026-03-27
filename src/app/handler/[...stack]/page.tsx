"use client";

import * as React from "react";
import { AuthView } from "@neondatabase/auth/react/ui";

export default function StackHandlerPage({
  params,
}: {
  params: Promise<{ stack: string[] }>;
}) {
  const { stack } = React.use(params);
  const path = stack?.[0] || "sign-in";
  return <AuthView pathname={path} />;
}
