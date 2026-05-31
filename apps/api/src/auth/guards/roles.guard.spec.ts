import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function createContext(user: { role?: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ role: 'BUYER' }))).toBe(true);
  });

  it('allows access when user has one of required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.ADMIN_MODERATOR]);
    expect(guard.canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
    expect(guard.canActivate(createContext({ role: UserRole.ADMIN_MODERATOR }))).toBe(true);
  });

  it('denies access when user role is not allowed', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(createContext({ role: UserRole.BUYER }))).toBe(false);
    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('reads roles from reflector metadata key', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.SELLER]);
    guard.canActivate(createContext({ role: UserRole.SELLER }));
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
