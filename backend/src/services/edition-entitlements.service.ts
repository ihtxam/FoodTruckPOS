import type { EditionFeatureKey } from "@/lib/edition-features";
import { hasEditionFeature } from "@/lib/edition-features";
import { EditionService } from "@/services/edition.service";

const cache = new Map<string, { at: number; features: EditionFeatureKey[] | null }>();
const TTL_MS = 30_000;

export class EditionEntitlementsService {
  static invalidate(merchantId: string) {
    cache.delete(merchantId);
  }

  static async getFeatures(merchantId: string): Promise<EditionFeatureKey[] | null> {
    const hit = cache.get(merchantId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.features;
    const features = await EditionService.getMerchantFeatures(merchantId);
    cache.set(merchantId, { at: Date.now(), features });
    return features;
  }

  static async require(
    merchantId: string,
    feature: EditionFeatureKey
  ): Promise<EditionFeatureKey[] | null> {
    const features = await this.getFeatures(merchantId);
    if (!hasEditionFeature(features, feature)) {
      const err = new Error(`Edition does not include feature: ${feature}`);
      (err as Error & { status: number }).status = 403;
      throw err;
    }
    return features;
  }
}
