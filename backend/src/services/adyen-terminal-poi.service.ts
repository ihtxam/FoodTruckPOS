import axios, { type AxiosError } from "axios";
import { randomUUID } from "crypto";
import { getDb, schema } from "@/db";
import { eq, and } from "drizzle-orm";

export type TerminalPoiResult =
  | { status: "approved"; reference: string | null }
  | { status: "cancelled"; message: string }
  | { status: "declined"; message: string }
  | { status: "error"; message: string };

type AdyenApiError = {
  errorCode?: string;
  detail?: string;
  requestId?: string;
  title?: string;
};

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

function cloudDeviceHost(live: boolean, region: string): string {
  if (!live) return "device-api-test.adyen.com";
  switch (region.toUpperCase()) {
    case "US":
      return "device-api-live-us.adyen.com";
    case "AU":
      return "device-api-live-au.adyen.com";
    case "APSE":
      return "device-api-live-apse.adyen.com";
    default:
      return "device-api-live.adyen.com";
  }
}

function cloudDeviceSyncUrl(
  live: boolean,
  region: string,
  merchantAccount: string,
  terminalId: string
): string {
  const host = cloudDeviceHost(live, region);
  return `https://${host}/v1/merchants/${encodePathSegment(merchantAccount)}/devices/${encodePathSegment(terminalId)}/sync`;
}

function legacySyncUrl(live: boolean): string {
  return live ? "https://terminal-api-live.adyen.com/sync" : "https://terminal-api-test.adyen.com/sync";
}

function generateServiceId(): string {
  return String(Date.now() % 10_000_000_000).padStart(10, "0");
}

function looksLikeClientKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.startsWith("live_") || trimmed.startsWith("test_") || trimmed.startsWith("pub_");
}

function parseAdyenApiError(body: string): AdyenApiError | null {
  if (!body) return null;
  try {
    const json = JSON.parse(body) as Record<string, unknown>;
    return {
      errorCode: typeof json.errorCode === "string" ? json.errorCode : undefined,
      detail:
        typeof json.detail === "string"
          ? json.detail
          : typeof json.message === "string"
            ? json.message
            : undefined,
      requestId: typeof json.requestId === "string" ? json.requestId : undefined,
      title: typeof json.title === "string" ? json.title : undefined,
    };
  } catch {
    return null;
  }
}

function formatHttpError(code: number, apiError: AdyenApiError | null, triedLegacy: boolean): string {
  if (apiError?.errorCode === "00_403") {
    return [
      "Adyen permission denied (00_403). Your Web service API key needs Cloud Device API / Terminal API roles.",
      triedLegacy
        ? "Legacy Terminal API also returned 00_403."
        : 'Enable "Use legacy Terminal API" in Settings ? Payments if your account is not on Cloud Device API yet.',
      apiError.detail,
      apiError.requestId ? `Request ID: ${apiError.requestId}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  const detail = [apiError?.errorCode && `Adyen error: ${apiError.errorCode}`, apiError?.detail, apiError?.requestId && `Request ID: ${apiError.requestId}`]
    .filter(Boolean)
    .join(" — ");
  if (detail) return detail;
  if (code === 401) return "Invalid Adyen API key.";
  if (code === 404) return "Terminal or merchant not found. Check merchant account and terminal POIID.";
  return `Adyen terminal request failed (HTTP ${code}).`;
}

function buildPaymentRequestBody(amount: number, currencyCode: string, saleId: string, poiId: string): string {
  const serviceId = generateServiceId();
  const transactionId = randomUUID().replace(/-/g, "").slice(0, 16);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
  const requestedAmount = Math.round(amount * 100) / 100;

  return JSON.stringify({
    SaleToPOIRequest: {
      MessageHeader: {
        ProtocolVersion: "3.0",
        MessageClass: "Service",
        MessageCategory: "Payment",
        MessageType: "Request",
        ServiceID: serviceId,
        SaleID: saleId,
        POIID: poiId.trim(),
      },
      PaymentRequest: {
        SaleData: {
          SaleTransactionID: {
            TransactionID: transactionId,
            TimeStamp: timestamp,
          },
          SaleToAcquirerData: "tenderOption=ReceiptHandler",
        },
        PaymentTransaction: {
          AmountsReq: {
            Currency: currencyCode.toUpperCase(),
            RequestedAmount: requestedAmount,
          },
        },
      },
    },
  });
}

function parsePaymentResponse(body: string): TerminalPoiResult {
  if (!body) return { status: "error", message: "Empty response from Adyen terminal." };

  try {
    const root = JSON.parse(body) as Record<string, unknown>;
    const paymentResponse = (root.SaleToPOIResponse as Record<string, unknown> | undefined)?.PaymentResponse as
      | Record<string, unknown>
      | undefined;
    if (!paymentResponse) {
      return { status: "error", message: "Unexpected Adyen response format." };
    }

    const responseNode = paymentResponse.Response as Record<string, unknown> | undefined;
    if (!responseNode) {
      return { status: "error", message: "Missing payment response from terminal." };
    }

    const result = String(responseNode.Result || "");
    const errorCondition = String(responseNode.ErrorCondition || "");
    const additionalResponse = String(responseNode.AdditionalResponse || "");

    if (result.toLowerCase() === "success") {
      const poiData = paymentResponse.POIData as Record<string, unknown> | undefined;
      const poiTx = poiData?.POITransactionID as Record<string, unknown> | undefined;
      const reference = poiTx?.TransactionID ? String(poiTx.TransactionID) : null;
      return { status: "approved", reference };
    }

    if (result.toLowerCase() === "failure" && errorCondition.toLowerCase() === "cancel") {
      return { status: "cancelled", message: "Payment cancelled on terminal." };
    }

    let message = "Terminal payment failed";
    if (errorCondition) message += `: ${errorCondition}`;
    if (additionalResponse) message += ` (${additionalResponse})`;
    return { status: "declined", message };
  } catch {
    return { status: "error", message: "Could not parse Adyen terminal response." };
  }
}

function shouldRetryLegacy(error: TerminalPoiResult): boolean {
  if (error.status !== "error") return false;
  const msg = error.message;
  return /HTTP 404|00_403|HTTP 403/i.test(msg);
}

async function postSync(
  apiKey: string,
  url: string,
  body: string,
  triedLegacy: boolean,
  signal?: AbortSignal
): Promise<TerminalPoiResult> {
  try {
    const response = await axios.post(url, body, {
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      timeout: 165_000,
      signal,
      validateStatus: () => true,
    });

    const responseBody = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

    if (response.status < 200 || response.status >= 300) {
      const apiError = parseAdyenApiError(responseBody);
      return { status: "error", message: formatHttpError(response.status, apiError, triedLegacy) };
    }

    return parsePaymentResponse(responseBody);
  } catch (error) {
    const ax = error as AxiosError;
    if (ax.code === "ERR_CANCELED" || ax.name === "CanceledError") {
      return { status: "cancelled", message: "Payment cancelled." };
    }
    return { status: "error", message: `Network error: ${ax.message || "Could not reach Adyen"}` };
  }
}

export class AdyenTerminalPoiService {
  static async resolveTerminalSettings(merchantId: string, terminalId?: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const apiKey = merchant.adyenApiKey?.trim();
    const merchantAccount = merchant.adyenMerchantAccount?.trim();
    const saleId = merchant.adyenClientId?.trim() || "ChaslayReborn";

    if (!apiKey) throw new Error("Adyen API key not configured");
    if (!merchantAccount) throw new Error("Adyen merchant account not configured");
    if (looksLikeClientKey(apiKey)) {
      throw new Error("This looks like an Adyen client key, not a Web service API key.");
    }

    let poiId = terminalId?.trim();
    if (!poiId) {
      const active = await db.query.paymentTerminals.findMany({
        where: and(eq(schema.paymentTerminals.merchantId, merchantId), eq(schema.paymentTerminals.status, "active")),
      });
      poiId = active[0]?.terminalId;
    } else {
      const row =
        (await db.query.paymentTerminals.findFirst({
          where: and(
            eq(schema.paymentTerminals.merchantId, merchantId),
            eq(schema.paymentTerminals.terminalId, poiId)
          ),
        })) ||
        (await db.query.paymentTerminals.findFirst({
          where: and(eq(schema.paymentTerminals.merchantId, merchantId), eq(schema.paymentTerminals.id, poiId)),
        }));
      if (row?.terminalId) poiId = row.terminalId;
    }

    if (!poiId) throw new Error("No payment terminal configured");

    return {
      apiKey,
      merchantAccount,
      saleId,
      poiId,
      live: !!merchant.adyenLiveEnvironment,
      region: merchant.adyenLiveRegion || "EU",
      useLegacy: !!merchant.adyenUseLegacyEndpoint,
    };
  }

  static async processTerminalPayment(
    merchantId: string,
    amount: number,
    options: {
      terminalId?: string;
      currency?: string;
      signal?: AbortSignal;
    } = {}
  ): Promise<TerminalPoiResult> {
    const settings = await this.resolveTerminalSettings(merchantId, options.terminalId);
    const currency = (options.currency || "CHF").toUpperCase();
    const body = buildPaymentRequestBody(amount, currency, settings.saleId, settings.poiId);

    if (settings.useLegacy) {
      return postSync(settings.apiKey, legacySyncUrl(settings.live), body, true, options.signal);
    }

    const cloudUrl = cloudDeviceSyncUrl(settings.live, settings.region, settings.merchantAccount, settings.poiId);
    const cloudResult = await postSync(settings.apiKey, cloudUrl, body, false, options.signal);

    if (cloudResult.status === "error" && shouldRetryLegacy(cloudResult)) {
      return postSync(settings.apiKey, legacySyncUrl(settings.live), body, true, options.signal);
    }

    return cloudResult;
  }
}
