import { apiClient } from './http-client';

export interface AccountDto {
  id: string;
  accountType: string;
  accountDescription?: string | null;
  interestRate: number;
  isActive: boolean;
  accountName: string;
  balance: number;
}

export interface AccountBalanceDto {
  accountId: string;
  accountName: string;
  balance: number;
}

export interface LoanProductDto {
  loanId: string;
  loanName: string;
  loanDescription: string;
  interestRate: number;
  guarantorCount: number;
  processingFee: number;
  guarantorTypes: string[];
}

export interface GuarantorDto {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  membershipId?: string | null;
  membershipType?: string | null;
}

export interface MemberDto {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  membershipId?: string | null;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  membershipType?: string | null;
  role?: string | null;
  status?: string | null;
  gender?: string | null;
  occupation?: string | null;
  shares?: number | null;
  loanBalance?: number | null;
  totalSavings?: number | null;
}

export interface PaginatedMembersResponse {
  items: MemberDto[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalItems: number;
  nextCursor?: string | null;
}

export interface MemberAccountBalanceDto {
  accountId: string;
  accountName: string;
  accountType: string;
  balance: number;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error((await response.text()) || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export interface ActivityDto {
  activityType: string;
  dateCreated: string;
  details: string;
}

export interface AccountSummaryDto {
  name: string;
  balance: number;
  accountType: string;
}

export interface DashboardStatsDto {
  totalMember: number;
  activeLoans: number;
  totalSavings: number;
  totalShares: number;
  activities: ActivityDto[];
  accountSummaries: AccountSummaryDto[];
}

export interface LoanGuarantorRequestDto {
  id: string;
  memberId?: string | null;
  applicantName: string;
  loanAmount: number;
  loanName: string;
  comment?: string | null;
  createdDate: string;
  status: string;
}

export interface PaginatedGuarantorRequestsResponse {
  items: LoanGuarantorRequestDto[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalItems: number;
  nextCursor?: string | null;
}

export interface GuarantorInfo {
  guarantorName: string;
  status: string;
}

export interface LoanRequestDto {
  id: string;
  amount: number;
  comment?: string;
  status: string;
  created: string;
  loanName: string;
  applicantName: string;
}

export interface PaginatedLoanRequestsResponse {
  items: LoanRequestDto[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalItems: number;
  nextCursor?: string | null;
}

export interface LoanTransactionDto {
  transactionName: string;
  date: string;
  amount: number;
  status: string;
  balance: number;
}

export interface LoanDetailDto {
  applicantId?: string;
  applicantName: string;
  amount: number;
  interestRate: number;
  repaymentPeriod: number;
  monthlyRepayment: number;
  loanPurpose: string;
  totalInterest: number;
  loanName: string;
  status: string;
  membershipId: string;
  membershipType?: string;
  feePaymentStatus?: string;
  processingFee?: number;
  interestStrategy?: string;
  interestType?: string;
  loanDuration?: number;
  totalSavings?: number;
  guarantors: GuarantorInfo[];
  transactions?: LoanTransactionDto[];
}

export interface RepaymentScheduleDto {
  installmentNo: number;
  dueDate: string;
  principalExpected: number;
  interestExpected: number;
  totalExpected: number;
  amountPaid: number;
  balanceRemaining: number;
  status: number;
}

export interface UserSearchDto {
  id: string;
  firstName: string;
  lastName: string;
  membershipId?: string | null;
  email?: string | null;
}

export interface OrganizationDto {
  id: string;
  organizationName: string;
  organizationType: string;
}

export const AccountService = {
  async getAccounts(memberId?: string): Promise<AccountDto[]> {
    const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
    return readJson<AccountDto[]>(await apiClient.get(`/accounts${query}`));
  },

  async getPaymentAccounts(memberId?: string): Promise<AccountDto[]> {
    const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
    try {
      const response = await apiClient.get(`/accounts/payment${query}`);
      if (response.ok) {
        return readJson<AccountDto[]>(response);
      }
    } catch {
      // Fallback to getAccounts
    }
    return this.getAccounts(memberId);
  },

  async searchMembers(query: string): Promise<UserSearchDto[]> {
    if (!query.trim()) return [];
    try {
      const response = await apiClient.get(`/users/search?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        return readJson<UserSearchDto[]>(response);
      }
    } catch {
      // Return empty if fails
    }
    return [];
  },

  async createPaymentRequest(payload: {
    amount: number;
    requestAmounts: { accountId: string; amount: number }[];
    beneficiaryId?: string;
    receipts?: any[];
    transactionDate: string;
  }): Promise<string> {
    const response = await apiClient.post('/paymentrequests', {
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error((await response.text()) || 'Unable to submit payment request');
    return response.text();
  },

  async getGuarantorRequests(lastId?: string | null): Promise<PaginatedGuarantorRequestsResponse> {
    const query = lastId ? `?lastId=${encodeURIComponent(lastId)}` : '';
    const response = await apiClient.get(`/users/guarantor/requests${query}`);
    if (!response.ok) throw new Error('Unable to load guarantor requests');
    const data = await response.json();
    return {
      items: data.items || [],
      hasNextPage: Boolean(data.hasNextPage),
      hasPreviousPage: Boolean(data.hasPreviousPage),
      totalItems: data.totalItems ?? (data.items?.length || 0),
      nextCursor: data.nextCursor ?? null,
    };
  },

  async updateGuarantorRequest(requestId: string, status: number): Promise<string> {
    const response = await apiClient.patch(`/users/guarantor/${requestId}/status/${status}`);
    if (!response.ok) throw new Error((await response.text()) || 'Unable to update guarantor request');
    return response.text();
  },

  async getLoanRequests(lastId?: string | null): Promise<PaginatedLoanRequestsResponse> {
    const query = lastId ? `?lastId=${encodeURIComponent(lastId)}` : '';
    const response = await apiClient.get(`/accounts/loan-request${query}`);
    if (!response.ok) throw new Error('Unable to load loan requests');
    const data = await response.json();
    return {
      items: data.items || [],
      hasNextPage: Boolean(data.hasNextPage),
      hasPreviousPage: Boolean(data.hasPreviousPage),
      totalItems: data.totalItems ?? (data.items?.length || 0),
      nextCursor: data.nextCursor ?? null,
    };
  },

  async getLoanDetail(id: string): Promise<LoanDetailDto> {
    const response = await apiClient.get(`/loans/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Unable to load loan details');
    return response.json();
  },

  // Base URL already ends in `/api`, so this resolves to
  // GET /api/loans/repayment-schedule/{loanId}
  async getRepaymentSchedule(loanId: string): Promise<RepaymentScheduleDto[]> {
    const response = await apiClient.get(`/loans/repayment-schedule/${encodeURIComponent(loanId)}`);
    if (!response.ok) throw new Error('Unable to load repayment schedule');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getAccountBalance(accountId: string): Promise<AccountBalanceDto | null> {
    const response = await apiClient.get(`/transactions/${accountId}/balance`);
    if (response.status === 404) return null;
    return readJson<AccountBalanceDto>(response);
  },

  async getDashboardActivities(): Promise<DashboardStatsDto> {
    return readJson<DashboardStatsDto>(await apiClient.get('/users/activities'));
  },

  async getLoanProducts(): Promise<LoanProductDto[]> {
    return readJson<LoanProductDto[]>(await apiClient.get('/accounts/loan'));
  },

  async getMembers(params: { lastId?: string | null; search?: string } = {}): Promise<PaginatedMembersResponse> {
    const query = new URLSearchParams({ pageSize: '20' });
    if (params.lastId) query.set('lastId', params.lastId);
    if (params.search?.trim()) query.set('search', params.search.trim());
    const response = await apiClient.get(`/users?${query.toString()}`);
    if (!response.ok) throw new Error('Unable to load members');
    const data = await response.json();
    return {
      items: data.items || [],
      hasNextPage: Boolean(data.hasNextPage),
      hasPreviousPage: Boolean(data.hasPreviousPage),
      totalItems: data.totalItems ?? (data.items?.length || 0),
      nextCursor: data.nextCursor ?? null,
    };
  },

  async getMember(id: string): Promise<MemberDto> {
    const response = await apiClient.get(`/users/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error('Unable to load member details');
    return response.json() as Promise<MemberDto>;
  },

  async getMemberAccounts(id: string): Promise<MemberAccountBalanceDto[]> {
    const response = await apiClient.get(`/users/${encodeURIComponent(id)}/accounts`);
    if (!response.ok) throw new Error('Unable to load member accounts');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getGuarantors(guarantorTypes?: string[]): Promise<GuarantorDto[]> {
    const query = (guarantorTypes ?? [])
      .filter((type) => type != null && type !== '')
      .map((type) => `guarantorTypes=${encodeURIComponent(type)}`)
      .join('&');
    return readJson<GuarantorDto[]>(
      await apiClient.get(query ? `/users/guarantors?${query}` : '/users/guarantors')
    );
  },

  async requestLoan(payload: {
    loanId: string;
    amount: number;
    guarantors: string[];
    preferredStartDate: string;
    comment: string;
    duration: number;
  }): Promise<string> {
    const response = await apiClient.post('/accounts/loan-request', {
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error((await response.text()) || 'Unable to submit loan request');
    return response.text();
  },

  async getOrganizationInfo(): Promise<OrganizationDto | null> {
    const response = await apiClient.get(`/organizations`);
    if (response.status === 404) return null;
    return readJson<OrganizationDto>(response);
  }
};
