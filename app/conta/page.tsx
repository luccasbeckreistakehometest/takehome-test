import type { Metadata } from "next";
import { Suspense } from "react";
import AccountSettings from "./AccountSettings";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <AccountSettings />
    </Suspense>
  );
}
