import { apiClient } from './http-client';

export type SupportTicketCategory = 'LoanIssue' | 'SavingsOrDeposit' | 'AccountAccess' | 'General';
export type SupportTicketStatus = 'Open' | 'AwaitingMember' | 'Resolved';

export interface SupportAttachment {
  name: string;
  contentType: string;
  dataUrl: string;
}

export interface SupportTicketDto {
  id: string;
  ticketNumber: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  subject: string;
  memberId: string;
  memberName: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessageDto {
  id: string;
  senderId: string;
  senderName: string;
  isAdminReply: boolean;
  body: string;
  attachmentUrl?: string | null;
  createdAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketDto {
  messages: SupportMessageDto[];
}

export interface CreateSupportTicketResponse {
  id: string;
  ticketNumber: string;
}

function readErrorMessage(fallback: string) {
  return async (res: Response): Promise<Error> => {
    try {
      const text = await res.text();
      const cleaned = text.replace(/^"|"$/g, '').trim();
      return new Error(cleaned || fallback);
    } catch {
      return new Error(fallback);
    }
  };
}

export const SupportService = {
  async getTickets(status?: SupportTicketStatus | 'All'): Promise<SupportTicketDto[]> {
    const query = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : '';
    const response = await apiClient.get(`/support/tickets${query}`);
    if (!response.ok) throw await readErrorMessage('Unable to load support tickets')(response);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async getTicket(id: string): Promise<SupportTicketDetailDto> {
    const response = await apiClient.get(`/support/tickets/${encodeURIComponent(id)}`);
    if (!response.ok) throw await readErrorMessage('Unable to load support ticket')(response);
    return response.json() as Promise<SupportTicketDetailDto>;
  },

  async createTicket(payload: {
    category: SupportTicketCategory;
    subject: string;
    body: string;
    attachment?: SupportAttachment | null;
  }): Promise<CreateSupportTicketResponse> {
    const response = await apiClient.post('/support/tickets', {
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await readErrorMessage('Unable to create support ticket')(response);
    return response.json() as Promise<CreateSupportTicketResponse>;
  },

  async addMessage(
    id: string,
    payload: { body: string; attachment?: SupportAttachment | null; markAsResolved?: boolean }
  ): Promise<void> {
    const response = await apiClient.post(`/support/tickets/${encodeURIComponent(id)}/messages`, {
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw await readErrorMessage('Unable to send reply')(response);
  },
};
