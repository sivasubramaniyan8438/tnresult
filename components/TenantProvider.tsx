"use client";
import { createContext, useContext } from "react";
import { type Tenant, getTenant, DEFAULT_TENANT_ID } from "@/lib/tenants";

const TenantContext = createContext<Tenant>(getTenant(DEFAULT_TENANT_ID));

export function TenantProvider({
  tenantId,
  children,
}: {
  tenantId: string | null;
  children: React.ReactNode;
}) {
  const tenant = getTenant(tenantId);
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

/** Returns the current tenant's branding (channel name, logo, accents). */
export function useTenant(): Tenant {
  return useContext(TenantContext);
}
