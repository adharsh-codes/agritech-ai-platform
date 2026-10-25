
import { Product } from "@/types/marketplace";
import {
  AssistantShoppingKit,
  AssistantRecommendation,
} from "@/types/shoppingAssistant";
import { MarketplaceMatchingService } from "@/services/marketplaceMatchingService";

export class ShoppingKitGenerator {
  static generateKit(
    conceptualKit: {
      title: string;
      items: {
        productName: string;
        category: string;
        quantity: number;
        whyThisProduct: string;
        suitabilityScore: number;
      }[];
    },
    marketplaceProducts: Product[]
  ): AssistantShoppingKit {
    const recommendations: AssistantRecommendation[] = [];
    const usedProductIds = new Set<string>();

    for (const item of conceptualKit.items) {
      const keywords = (item.productName || "")
        .split(/[\s,/-]+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2);

      const matchedProduct =
        MarketplaceMatchingService.findOrganicProduct(
          keywords,
          item.category,
          marketplaceProducts,
          Array.from(usedProductIds)
        );

      if (matchedProduct) {
        if (matchedProduct.id) {
          usedProductIds.add(matchedProduct.id);
        }

        recommendations.push({
          productName: matchedProduct.productName,
          category: matchedProduct.category,
          quantity: item.quantity,
          whyThisProduct: item.whyThisProduct,
          suitabilityScore: item.suitabilityScore || 90,
          isAvailable: true,
          productId: matchedProduct.id,
          estimatedPrice:
            matchedProduct.price * item.quantity,
        });
      } else {
        recommendations.push({
          productName: item.productName,
          category: item.category,
          quantity: item.quantity,
          whyThisProduct: item.whyThisProduct,
          suitabilityScore: item.suitabilityScore || 80,
          isAvailable: false,
          estimatedPrice: 0,
        });
      }
    }

    const estimatedTotalCost = recommendations
      .filter((item) => item.isAvailable)
      .reduce(
        (total, item) => total + item.estimatedPrice,
        0
      );

    const estimatedMonthlyMaintenanceCost = Math.max(
      150,
      Math.round(estimatedTotalCost * 0.08)
    );

    return {
      title: conceptualKit.title || "Custom AI Garden Package",
      recommendations,
      estimatedTotalCost,
      estimatedMonthlyMaintenanceCost,
    };
  }
}
