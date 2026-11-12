import { apiClient } from './http-client';

export interface TransactionResponse {
  id: string;
  referenceNo: string;
  description?: string | null;
  transactionType: string;
  status: string;
  amount: number;
  transactionDate: string;
  beneficiaryId?: string | null;
  beneficiaryName?: string | null;
}

export interface PaginatedTransactionResponse {
  items: TransactionResponse[];
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  totalItems?: number;
  nextCursor?: string | null;
}

export interface TransactionQueryParams {
  lastId?: string | null;
  accountId?: string | null;
  includeOrganizationTransactions?: boolean;
  /** Honoured only for Admin/Accountant; the API ignores it for other roles. */
  memberId?: string | null;
  pageSize?: number;
}

export interface MemberSearchResult {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  membershipId?: string | null;
  emailAddress?: string | null;
}

export function memberDisplayName(member: MemberSearchResult): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  const base = name || member.userName || member.emailAddress || 'Unknown member';
  return member.membershipId ? `${base} (${member.membershipId})` : base;
}

export const TransactionService = {
  async getTransactions(params: TransactionQueryParams = {}): Promise<PaginatedTransactionResponse> {
    const query = new URLSearchParams({ pageSize: String(params.pageSize ?? 100) });
    if (params.lastId) query.set('lastId', params.lastId);
    if (params.accountId) query.set('accountId', params.accountId);
    if (params.includeOrganizationTransactions) query.set('includeOrganizationTransactions', 'true');
    if (params.memberId) query.set('memberId', params.memberId);

    const response = await apiClient.get(`/transactions?${query.toString()}`);
    if (!response.ok) throw new Error('Unable to load transactions');
    return response.json() as Promise<PaginatedTransactionResponse>;
  },

  /** Member lookup for the Admin/Accountant picker. Throws on failure so the UI can show a retry state. */
  async searchMembers(search: string): Promise<MemberSearchResult[]> {
    const trimmed = search.trim();
    if (trimmed.length < 2) return [];

    const response = await apiClient.get(`/users/search?search=${encodeURIComponent(trimmed)}`);
    if (!response.ok) throw new Error('Unable to search members');
    const data = (await response.json()) as MemberSearchResult[];
    return Array.isArray(data) ? data : [];
  },
};
