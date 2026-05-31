/** REST path segments (prepend API base URL on the client). */
export const API_PATHS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    csrf: '/auth/csrf',
    me: '/auth/me',
  },
  products: {
    list: '/products',
    byId: (id: string) => `/products/${id}`,
    my: '/products/my',
    myById: (id: string) => `/products/my/${id}`,
    importTemplate: '/products/import-template',
    import: '/products/import',
  },
  categories: {
    list: '/categories',
    roots: '/categories?parentId=null',
    bySlug: (slug: string) => `/categories/slug/${slug}`,
  },
  cart: '/cart',
  favorites: '/favorites',
  orders: {
    my: '/orders/my',
    seller: '/orders/seller',
    byId: (id: string) => `/orders/${id}`,
  },
  reviews: {
    forProduct: (productId: string) => `/reviews/product/${productId}`,
  },
  settings: {
    public: '/settings/public',
    checkoutOptions: '/settings/checkout-options',
  },
  banners: '/banners',
  upload: {
    image: '/upload/image',
  },
  health: {
    live: '/health',
    ready: '/health/ready',
  },
} as const;
