import { SetMetadata } from '@nestjs/common';

export const MODERATOR_PERMISSION_KEY = 'moderator_permission';

export type ModeratorPermissionKey =
  | 'canModerateProducts'
  | 'canModerateReviews'
  | 'canApproveSellerApplications'
  | 'canApproveShopUpdates'
  | 'canViewUsers'
  | 'canViewOrders'
  | 'canViewStats';

export const RequireModeratorPermission = (permission: ModeratorPermissionKey) =>
  SetMetadata(MODERATOR_PERMISSION_KEY, permission);
