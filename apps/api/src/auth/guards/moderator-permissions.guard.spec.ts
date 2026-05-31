import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ModeratorPermissionsGuard } from './moderator-permissions.guard';
import { MODERATOR_PERMISSION_KEY } from '../decorators/require-moderator-permission.decorator';

function createContext(user: { role?: string; moderatorPermissions?: Record<string, boolean> } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('ModeratorPermissionsGuard', () => {
  let guard: ModeratorPermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ModeratorPermissionsGuard(reflector);
  });

  it('allows access when handler has no permission requirement', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows ADMIN regardless of permission flag', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canModerateProducts');
    expect(guard.canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('denies non-moderator roles', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canModerateProducts');
    expect(guard.canActivate(createContext({ role: UserRole.BUYER }))).toBe(false);
    expect(guard.canActivate(createContext({ role: UserRole.SELLER }))).toBe(false);
    expect(guard.canActivate(createContext(undefined))).toBe(false);
  });

  it('allows ADMIN_MODERATOR when permission is not explicitly denied', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canModerateProducts');
    expect(
      guard.canActivate(createContext({ role: UserRole.ADMIN_MODERATOR, moderatorPermissions: { canModerateProducts: true } })),
    ).toBe(true);
    expect(guard.canActivate(createContext({ role: UserRole.ADMIN_MODERATOR, moderatorPermissions: undefined }))).toBe(
      true,
    );
  });

  it('denies ADMIN_MODERATOR when permission is explicitly false', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canModerateProducts');
    expect(
      guard.canActivate(createContext({ role: UserRole.ADMIN_MODERATOR, moderatorPermissions: { canModerateProducts: false } })),
    ).toBe(false);
  });

  it('reads permission from reflector metadata key', () => {
    const spy = jest.spyOn(reflector, 'get').mockReturnValue('canViewOrders');
    guard.canActivate(createContext({ role: UserRole.ADMIN }));
    expect(spy).toHaveBeenCalledWith(MODERATOR_PERMISSION_KEY, expect.anything());
  });
});
