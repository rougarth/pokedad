export interface BestBuyProduct {
  sku?: number | string;
  name?: string;
  salePrice?: number;
  regularPrice?: number;
  onlineAvailability?: boolean;
  inStoreAvailability?: boolean;
  orderable?: "Available" | "SoldOut" | "Preorder" | string;
  url?: string;
  addToCartUrl?: string;
  image?: string;
  thumbnailImage?: string;
  manufacturer?: string;
  type?: string;
}

export interface BestBuyProductsResponse {
  from?: number;
  to?: number;
  currentPage?: number;
  total?: number;
  totalPages?: number;
  queryTime?: string;
  products?: BestBuyProduct[];
}
