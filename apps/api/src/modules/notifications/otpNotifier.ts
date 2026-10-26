import { logger } from '../../config/logger.js';

/**
 * OTP delivery. In dev this is a stub that logs the code instead of calling the
 * WhatsApp/SMS providers. The adapter interface is what M2 wires to the real
 * WhatsApp Business API with an SMS fallback.
 */
export async function sendOtp(phone: string, code: string, purpose: string): Promise<void> {
  const masked = phone.replace(/(?<=\+91).(?=.{4})/g, '*');
  logger.info({ phone: masked, purpose, channel: 'whatsapp', code }, 'OTP dispatched (stub)');
}

export async function sendTemplateMessage(
  phone: string,
  templateKey: string,
  _variables: Record<string, string>,
): Promise<void> {
  logger.info(
    { phone: phone.replace(/(?<=\+91).(?=.{4})/g, '*'), templateKey },
    'Notification (stub)',
  );
}
