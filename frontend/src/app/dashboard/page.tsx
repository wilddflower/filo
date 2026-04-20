"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LeadDashboard } from "@/components/leads/LeadDashboard";

export default function DashboardPage() {
  return (
    <AppShell activePage="dashboard">
      <LeadDashboard />
    </AppShell>
  );
}
