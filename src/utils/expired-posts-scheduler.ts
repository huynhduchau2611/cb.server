import { Post } from '../model';
import { POST_STATUS } from '../const';

/**
 * Update expired posts status from APPROVED to EXPIRED
 * This function finds all approved posts that have exceeded their postDuration
 * and updates their status to EXPIRED
 */
export async function updateExpiredPosts(): Promise<{ expiredCount: number; totalChecked: number }> {
  try {
    const now = new Date();

    // Use aggregation pipeline to find expired posts efficiently
    const expiredPosts = await Post.aggregate([
      {
        $match: {
          status: POST_STATUS.APPROVED,
        },
      },
      {
        $lookup: {
          from: 'companies',
          localField: 'company',
          foreignField: '_id',
          as: 'companyInfo',
        },
      },
      {
        $unwind: {
          path: '$companyInfo',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'plans',
          localField: 'companyInfo.plan',
          foreignField: '_id',
          as: 'planInfo',
        },
      },
      {
        $addFields: {
          expirationDate: {
            $add: [
              '$createdAt',
              {
                $multiply: [
                  {
                    $ifNull: [{ $arrayElemAt: ['$planInfo.limit.postDuration', 0] }, 999999],
                  },
                  24 * 60 * 60 * 1000, // Convert days to milliseconds
                ],
              },
            ],
          },
        },
      },
      {
        $match: {
          expirationDate: { $lt: now },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ]);

    // Update all expired posts in one batch
    if (expiredPosts.length > 0) {
      const expiredPostIds = expiredPosts.map((post) => post._id);
      await Post.updateMany(
        {
          _id: { $in: expiredPostIds },
          status: POST_STATUS.APPROVED,
        },
        {
          $set: {
            status: POST_STATUS.EXPIRED,
          },
        }
      );
    }

    return {
      expiredCount: expiredPosts.length,
      totalChecked: expiredPosts.length,
    };
  } catch (error) {
    console.error('Update expired posts error:', error);
    return {
      expiredCount: 0,
      totalChecked: 0,
    };
  }
}

/**
 * Start scheduled job to update expired posts
 * Runs every hour by default
 */
export function startExpiredPostsScheduler(intervalHours: number = 1): NodeJS.Timeout {
  // Run immediately on start
  updateExpiredPosts().then((result) => {
    if (result.expiredCount > 0) {
      console.log(`✅ Updated ${result.expiredCount} expired post(s) on startup`);
    }
  });

  // Then run periodically
  const interval = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
  return setInterval(async () => {
    const result = await updateExpiredPosts();
    if (result.expiredCount > 0) {
      console.log(`✅ Updated ${result.expiredCount} expired post(s) status to EXPIRED`);
    }
  }, interval);
}

