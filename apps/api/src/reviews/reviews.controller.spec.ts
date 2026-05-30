import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  const reviewsService = {
    getForProduct: jest.fn(),
    canLeaveReview: jest.fn(),
    canLeaveReviewForUser: jest.fn(),
    create: jest.fn(),
    sellerReply: jest.fn(),
    setModerated: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: reviewsService },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();
    controller = module.get(ReviewsController);
    jest.clearAllMocks();
  });

  it('getForProduct is public and delegates to service', async () => {
    reviewsService.getForProduct.mockResolvedValue([]);
    const result = await controller.getForProduct('prod-1');
    expect(reviewsService.getForProduct).toHaveBeenCalledWith('prod-1');
    expect(result).toEqual([]);
  });

  it('canReview without token returns false via service', async () => {
    reviewsService.canLeaveReviewForUser.mockResolvedValue({
      canReview: false,
      purchaseCount: 0,
      reviewCount: 0,
    });
    const result = await controller.canReview('prod-1', { headers: {} } as never);
    expect(reviewsService.canLeaveReviewForUser).toHaveBeenCalledWith('prod-1', undefined);
    expect(result.canReview).toBe(false);
  });

  it('create delegates rating and comment', async () => {
    reviewsService.create.mockResolvedValue({ id: 'r1' });
    const result = await controller.create('prod-1', 'user-1', { rating: 5, comment: 'Great' });
    expect(reviewsService.create).toHaveBeenCalledWith('prod-1', 'user-1', 5, 'Great');
    expect(result).toEqual({ id: 'r1' });
  });
});
