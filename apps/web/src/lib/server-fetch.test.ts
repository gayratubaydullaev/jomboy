import { describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './server-fetch';

describe('getApiBaseUrl', () => {
  it('uses first URL when comma-separated', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://a.example.com,http://b.example.com';
    expect(getApiBaseUrl()).toBe('http://a.example.com');
    process.env.NEXT_PUBLIC_API_URL = prev;
  });

  it('adds https when scheme missing', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'api.example.com';
    expect(getApiBaseUrl()).toBe('https://api.example.com');
    process.env.NEXT_PUBLIC_API_URL = prev;
  });

  it('strips trailing slash', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000/';
    expect(getApiBaseUrl()).toBe('http://localhost:4000');
    process.env.NEXT_PUBLIC_API_URL = prev;
  });
});
