import { randomUUID } from "node:crypto";
import type { schema } from "@/db";

type Merchant = typeof schema.merchants.$inferSelect;

/**
 * Adyen Tap to Pay (SoftPOS) backend helpers.
 *
 * Re-implemented in TypeScript for FoodTruckPOS from the proven Laravel
 * reference (SoftPosClient + TerminalApiClient::buildSaleRequest). Uses each
 * merchant's own Adyen credentials, so it is tenant-scoped like the rest of the
 * backend. No global Adyen state.
 */

interface SoftPosSession {
  installationId: string;
  sdkData: string;
  merchantAccount: string;
}

/** softposconfig base URL for the merchant's environment/region. */
function softPosBaseUrl(merchant: Merchant): string {
  if (!merchant.adyenLiveEnvironment) {
    return "https://softposconfig-test.adyen.com/softposconfig/v3";
  }
  switch ((merchant.adyenLiveRegion || "EU").toUpperCase()) {
    case "AU":
      return "https://softposconfig-live-au.adyen.com/softposconfig/v3";
    case "APSE":
      return "https://softposconfig-live-apse.adyen.com/softposconfig/v3";
    case "NEA":
      return "https://softposconfig-live-nea.adyen.com/softposconfig/v3";
    case "US":
      return "https://softposconfig-live-us.adyen.com/softposconfig/v3";
    default:
      return "https://softposconfig-live.adyen.com/softposconfig/v3";
  }
}

/**
 * Exchange a Mobile-SDK setupToken for sdkData + installationId via the Adyen
 * SoftPOS Configuration API (POST /softposconfig/v3/auth/certificate).
 */
export async function createSoftPosSession(
  merchant: Merchant,
  setupToken: string,
): Promise<SoftPosSession> {
  const apiKey = merchant.adyenApiKey;
  if (!apiKey) {
    throw new Error("No Adyen API key configured for this merchant account.");
  }
  const merchantAccount = merchant.adyenMerchantAccount;
  if (!merchantAccount) {
    throw new Error("No Adyen merchant account configured for this merchant.");
  }

  const url = `${softPosBaseUrl(merchant)}/auth/certificate`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ merchantAccount, setupToken }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Adyen SoftPOS session call failed (${response.status}): ${text}`);
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Adyen SoftPOS response was not valid JSON.");
  }

  const installationId = json.installationId as string | undefined;
  const sdkData = json.sdkData as string | undefined;
  if (!installationId || !sdkData) {
    throw new Error("Adyen SoftPOS response missing installationId or sdkData.");
  }

  return {
    installationId,
    sdkData,
    merchantAccount: (json.merchantAccount as string) ?? merchantAccount,
  };
}

interface SaleEnvelope {
  request: Record<string, unknown>;
  serviceId: string;
  saleId: string;
  transactionId: string;
}

/**
 * Build a SaleToPOIRequest (nexo Terminal API) envelope. The mobile SDK runs
 * the EMV kernel and submits this envelope itself; the backend only constructs
 * it (no Adyen call here). Result-status arrives later via the AUTHORISATION
 * webhook.
 */
export function buildSaleRequest(
  merchant: Merchant,
  installationId: string,
  amountMinor: number,
  currency: string,
  reference: string,
): SaleEnvelope {
  const serviceId = randomUUID().slice(0, 10);
  const saleId = `POS-${merchant.id}`;
  const transactionId = reference || `TX-${randomUUID()}`;

  const request = {
    SaleToPOIRequest: {
      MessageHeader: {
        MessageClass: "Service",
        MessageCategory: "Payment",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: saleId,
        POIID: installationId,
        ProtocolVersion: "3.0",
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: {
            TransactionID: transactionId,
            TimeStamp: new Date().toISOString(),
          },
          TokenRequestedType: "Customer",
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: currency,
            RequestedAmount: amountMinor / 100,
          },
        },
      },
    },
  };

  return { request, serviceId, saleId, transactionId };
}
