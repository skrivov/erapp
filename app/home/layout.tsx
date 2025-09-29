import type { ReactNode } from "react";
import { WizardNav } from "../../components/WizardNav";

export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <WizardNav />
      {children}
    </div>
  );
}
