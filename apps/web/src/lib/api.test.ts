import { describe, expect, it } from 'vitest';
import { ApiError } from './api';

describe('ApiError', () => {
  it('stores status and body', () => {
    const err = new ApiError(404, { message: 'Not found' });
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ message: 'Not found' });
    expect(err.name).toBe('ApiError');
  });
});
