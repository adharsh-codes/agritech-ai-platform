
import { Product } from "@/types/marketplace";

export class MarketplaceMatchingService {
  static findOrganicProduct(
    keywords: string[],
    category?: string,
    products?: Product[],
    excludedProductIds: string[] = []
  ): Product | null {
    if (!products || products.length === 0) {
      return null;
    }

    const pool = products.filter(
      (product) =>
        Boolean(product.id) &&
        product.approvalStatus === "approved" &&
        product.availability !== "out_of_stock" &&
        product.quantity > 0 &&
        !excludedProductIds.includes(product.id!)
    );

    if (pool.length === 0) {
      return null;
    }

    const normalizedKeywords = keywords
      .map((keyword) => keyword.toLowerCase().trim())
      .filter((keyword) => keyword.length > 2);

    const normalizedCategory = category?.toLowerCase().trim();

    let bestMatch: Product | null = null;
    let highestScore = 0;

    for (const product of pool) {
      const name = (product.productName || "").toLowerCase();
      const description = (product.description || "").toLowerCase();
      const subcategory = (product.subcategory || "").toLowerCase();
      const productCategory = (product.category || "").toLowerCase();

      let score = 0;

      for (const keyword of normalizedKeywords) {
        if (name.includes(keyword)) {
          score += 10;

          if (
            name.startsWith(keyword) ||
            name.includes(` ${keyword}`)
          ) {
            score += 5;
          }
        }

        if (subcategory.includes(keyword)) {
          score += 5;
        }

        if (description.includes(keyword)) {
          score += 2;
        }
      }

      if (
        normalizedCategory &&
        productCategory === normalizedCategory
      ) {
        score += 5;
      }

      if (product.organicCertified) {
        score += 1;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = product;
      }
    }

    return bestMatch;
  }
}
