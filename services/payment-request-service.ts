import { apiClient } from './http-client';
import type { PaymentRequestsDto } from '../app/payment-requests';

export interface RevertPaymentRequestPayload {
  note?: string;
  otp: string;
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

export const PaymentRequestService = {
  /** Fetch a single payment request with its split breakdown (mirrors the web detail page). */
  async getPaymentRequest(id: string): Promise<PaymentRequestsDto> {
    const response = await apiClient.get(`/paymentrequests/${id}`);
    if (!response.ok) throw await readErrorMessage('Unable to load payment request')(response);
    return response.json() as Promise<PaymentRequestsDto>;
  },

  /** Ask the backend to email a 1-minute revert OTP to the user that raised the request. */
  async requestRevertOtp(id: string): Promise<void> {
    const response = await apiClient.post(`/paymentrequests/${id}/revert-otp`, {});
    if (!response.ok) throw await readErrorMessage('Unable to send revert OTP')(response);
  },

  /** Submit the revert together with the OTP the initiator received. */
  async revertPaymentRequest(id: string, payload: RevertPaymentRequestPayload): Promise<void> {
    const response = await apiClient.patch(`/paymentrequests/${id}/revert`, {
      body: JSON.stringify({ note: payload.note ?? '', otp: payload.otp }),
    });
    if (!response.ok) throw await readErrorMessage('OTP validation failed')(response);
  },

  /** Cancel a pending payment request. */
  async cancelPaymentRequest(id: string, note = ''): Promise<void> {
    const response = await apiClient.patch(`/paymentrequests/${id}/cancel`, {
      body: JSON.stringify({ note }),
    });
    if (!response.ok) throw await readErrorMessage('Unable to cancel payment request')(response);
  },
};
