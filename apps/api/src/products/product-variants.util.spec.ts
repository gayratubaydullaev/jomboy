import { BadRequestException } from '@nestjs/common';
import { validateOptionsAndVariants } from './product-variants.util';

describe('validateOptionsAndVariants', () => {
  it('accepts complete variant grid', () => {
    expect(() =>
      validateOptionsAndVariants(
        { Size: ['S', 'M'], Color: ['Red'] },
        [
          { options: { Size: 'S', Color: 'Red' } },
          { options: { Size: 'M', Color: 'Red' } },
        ],
      ),
    ).not.toThrow();
  });

  it('rejects duplicate variants', () => {
    expect(() =>
      validateOptionsAndVariants(
        { Size: ['S'] },
        [{ options: { Size: 'S' } }, { options: { Size: 'S' } }],
      ),
    ).toThrow(BadRequestException);
  });
});
