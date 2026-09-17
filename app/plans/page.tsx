import type { Metadata } from "next";
import { Suspense } from "react";
import PlansView from "./PlansView";

export const metadata: Metadata = {
  title: "Planos & coins",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <PlansView />
    </Suspense>
  );
}
