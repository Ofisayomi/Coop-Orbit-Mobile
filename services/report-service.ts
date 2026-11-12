import { jwtDecode } from 'jwt-decode';

import { getValidAccessToken } from './authService';
import { apiClient } from './http-client';

export type ReportScope = 'Organization' | 'Personal';

export interface ReportMonthlyPoint {
  month: string;
  label: string;
  credits: number;
  debits: number;
  net: number;
}

export interface ReportBreakdown {
  label: string;
  amount: number;
  count: number;
}

export interface ReportMember {
  memberId: string;
  memberName: string;
  credits: number;
  debits: number;
  net: number;
  transactionCount: number;
}

export interface ReportTransaction {
  id: string;
  referenceNo: string;
  description: string;
  transactionType: string;
  status: string;
  amount: number;
  isDebit: boolean;
  transactionDate: string;
  beneficiaryId?: string | null;
  beneficiaryName?: string | null;
}

export interface ReportSummary {
  scope: ReportScope;
  canViewOrganization: boolean;
  organizationId: string;
  memberId?: string | null;
  from: string;
  to: string;
  totalCredits: number;
  totalDebits: number;
  netMovement: number;
  transactionCount: number;
  totalSavingsBalance: number;
  memberCount: number;
  loanCount: number;
  activeLoanCount: number;
  totalLoansRequested: number;
  totalLoansOutstanding: number;
  paymentRequestCount: number;
  totalPaymentRequested: number;
  pendingPaymentAmount: number;
  monthlySeries: ReportMonthlyPoint[];
  transactionTypeBreakdown: ReportBreakdown[];
  accountBreakdown: ReportBreakdown[];
  memberBreakdown: ReportMember[];
  recentTransactions: ReportTransaction[];
}

export interface ReportQueryParams {
  from?: string;
  to?: string;
  /** Honoured only for Admin/Accountant; the API ignores it for other roles. */
  memberId?: string;
}

interface AccessTokenClaims {
  sub?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

export interface CurrentReportUser {
  userId: string | null;
  roles: string[];
  /** Only Admin and Accountant may see organization-wide reports. */
  canViewOrganization: boolean;
}

const ORGANIZATION_ROLES = ['Admin', 'Accountant'];

export async function getCurrentReportUser(): Promise<CurrentReportUser> {
  try {
    const token = await getValidAccessToken();
    const claims = jwtDecode<AccessTokenClaims>(token);
    // The API authorizes from realm roles only; mirror that exactly so the
    // toggle never promises an organization view the API will not grant.
    const roles = [...(claims.realm_access?.roles ?? [])];
    return {
      userId: claims.sub ?? null,
      roles,
      // API matches roles case-insensitively; mirror that here.
      canViewOrganization: roles.some((role) =>
        ORGANIZATION_ROLES.some((orgRole) => orgRole.toLowerCase() === role.toLowerCase()),
      ),
    };
  } catch {
    return { userId: null, roles: [], canViewOrganization: false };
  }
}

export const ReportService = {
  async getReportSummary(params: ReportQueryParams = {}): Promise<ReportSummary> {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.memberId) query.set('memberId', params.memberId);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get(`/reports/summary${suffix}`);
    if (!response.ok) {
      throw new Error((await response.text()) || 'Unable to load report');
    }
    return response.json() as Promise<ReportSummary>;
  },
};
