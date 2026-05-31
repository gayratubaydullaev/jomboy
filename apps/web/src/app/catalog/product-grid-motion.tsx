'use client';

import { motion } from 'framer-motion';
import { ProductCard, type ProductCardProduct } from '@/components/product/product-card';

export function ProductGridMotion({
  products,
  linkPrefix,
}: {
  products: ProductCardProduct[];
  linkPrefix?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: 0.1 },
        },
      }}
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 min-w-0"
    >
      {products.map((p, index) => (
        <motion.div
          key={p.id}
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 },
          }}
        >
          <ProductCard product={p} linkPrefix={linkPrefix} priority={index < 6} />
        </motion.div>
      ))}
    </motion.div>
  );
}
