import { apiClient } from './httpClient';

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

export interface GuarantorInfo {
  guarantorName: string;
  status: string;
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
}

export interface UserSearchDto {
  id: string;
  firstName: string;
  lastName: string;
  membershipId?: string | null;
  email?: string | null;
}

export const AccountService = {
  async getAccounts(): Promise<AccountDto[]> {
    return readJson<AccountDto[]>(await apiClient.get('/accounts'));
  },

  async getPaymentAccounts(): Promise<AccountDto[]> {
    try {
      const response = await apiClient.get('/accounts/payment');
      if (response.ok) {
        return readJson<AccountDto[]>(response);
      }
    } catch {
      // Fallback to getAccounts
    }
    return this.getAccounts();
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

  async getGuarantorRequests(): Promise<LoanGuarantorRequestDto[]> {
    const response = await apiClient.get('/users/guarantor/requests');
    if (!response.ok) throw new Error('Unable to load guarantor requests');
    const data = await response.json();
    return data.items || [];
  },

  async updateGuarantorRequest(requestId: string, status: number): Promise<string> {
    const response = await apiClient.patch(`/users/guarantor/${requestId}/status/${status}`);
    if (!response.ok) throw new Error((await response.text()) || 'Unable to update guarantor request');
    return response.text();
  },

  async getLoanDetail(id: string): Promise<LoanDetailDto> {
    const response = await apiClient.get(`/loans/${id}`);
    if (!response.ok) throw new Error('Unable to load loan details');
    return response.json();
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

  async getGuarantors(): Promise<GuarantorDto[]> {
    return readJson<GuarantorDto[]>(await apiClient.get('/users/guarantors'));
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
};
