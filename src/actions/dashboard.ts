// dashboard.ts
import { Prisma, PrismaClient } from '@prisma/client';
import { LOG_ACTIONS, type LogAction } from '@/lib/log';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { getClerkUser } from '@/actions/user';

const prisma = new PrismaClient();

type Metric = {
  value: string;
  trend: number;
};

type DashboardMetrics = {
  totalNews: Metric;
  totalLikes: Metric;
  totalReaders: Metric;
  newComments: Metric;
};

type Activity = {
  id: string;
  user: {
    clerkId: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  activity: string;
  date: Date;
  description: string;
  metadata: Prisma.JsonValue;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  activities: Activity[];
};

export async function getDashboardData(): Promise<DashboardData> {
    const today = new Date();
    const startToday = startOfDay(today);
    const endToday = endOfDay(today);
    const startYesterday = startOfDay(addDays(today, -1));
    const endYesterday = endOfDay(addDays(today, -1));

    // Get logs and metrics data
    const [
      todayArticles,
      yesterdayArticles,
      recentActivities,
      todayNewComments,
      yesterdayNewComments,
      todayLikes,
      yesterdayLikes,
    ] = await Promise.all([
      // Count articles created today
      prisma.news.count({
        where: {
          createdAt: {
            gte: startToday,
            lte: endToday,
          },
        },
      }),
      // Count articles created yesterday
      prisma.news.count({
        where: {
          createdAt: {
            gte: startYesterday,
            lte: endYesterday,
          },
        },
      }),
      prisma.log.findMany({
        take: 20,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: true,
        },
      }),
      prisma.comment.count({
        where: {
          createdAt: {
            gte: startToday,
            lte: endToday,
          },
        },
      }),
      prisma.comment.count({
        where: {
          createdAt: {
            gte: startYesterday,
            lte: endYesterday,
          },
        },
      }),
      prisma.like.count({
        where: {
          createdAt: {
            gte: startToday,
            lte: endToday,
          },
        },
      }),
      prisma.like.count({
        where: {
          createdAt: {
            gte: startYesterday,
            lte: endYesterday,
          },
        },
      }),
    ]);

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    // Get total counts directly from respective tables
    const [totalArticles, totalLikes, totalReaders] = await Promise.all([
      // Get total articles count directly from news table
      prisma.news.count(),
      // Get total likes count
      prisma.like.count(),
      // Get total readers (counting users who have liked or bookmarked)
      prisma.userInteraction.count({
        where: {
          OR: [
            { likes: { some: {} } },  // Users who have liked
            { collections: { some: { bookmarks: { some: {} } } } }  // Users who have bookmarked
          ]
        }
      }),
    ]);

    // Calculate trends
    const articlesTrend = calculateTrend(todayArticles, yesterdayArticles);
    const commentsTrend = calculateTrend(todayNewComments, yesterdayNewComments);
    const likesTrend = calculateTrend(todayLikes, yesterdayLikes);

    // Format activities
    const activities: Activity[] = await Promise.all(
      recentActivities.map(async (log) => {
        try {
          const clerkUser = await getClerkUser(log.user.clerkId);

          return {
            id: log.id,
            user: {
              clerkId: log.user.clerkId,
              firstName: clerkUser?.firstName || null,
              lastName: clerkUser?.lastName || null,
              imageUrl: clerkUser?.imageUrl || null,
            },
            activity: formatLogAction(log.action as LogAction),
            date: log.createdAt,
            description: log.description,
            metadata: log.metadata
          };
        } catch (error) {
          console.error('[GET_ACTIVITY_USER] Error details:', {
            clerkId: log.user.clerkId,
            error: error instanceof Error ? error.message : error
          });

          return {
            id: log.id,
            user: {
              clerkId: log.user.clerkId,
              firstName: null,
              lastName: null,
              imageUrl: null
            },
            activity: formatLogAction(log.action as LogAction),
            date: log.createdAt,
            description: log.description,
            metadata: log.metadata
          };
        }
      })
    );

    return {
      metrics: {
        totalNews: {
          value: totalArticles.toString(),
          trend: articlesTrend,
        },
        totalLikes: {
          value: totalLikes.toString(),
          trend: likesTrend,
        },
        totalReaders: {
          value: totalReaders.toString(),
          trend: calculateTrend(todayArticles, yesterdayArticles),
        },
        newComments: {
          value: todayNewComments.toString(),
          trend: commentsTrend
        }
      },
      activities
    };
  }

function formatLogAction(action: LogAction): string {
  switch (action) {
    case LOG_ACTIONS.NEWS_CREATED:
      return 'Created a new article';
    case LOG_ACTIONS.NEWS_UPDATED:
      return 'Updated an article';
    case LOG_ACTIONS.NEWS_DELETED:
      return 'Deleted an article';
    case LOG_ACTIONS.COMMENT_ADDED:
      return 'Added a comment';
    case LOG_ACTIONS.NEWS_LIKED:
      return 'Liked an article';
    case LOG_ACTIONS.NEWS_UNLIKED:
      return 'Unliked an article';
    case LOG_ACTIONS.NEWS_BOOKMARKED:
      return 'Bookmarked an article';
    case LOG_ACTIONS.SECTION_ADDED:
      return 'Added a new section';
    case LOG_ACTIONS.SECTION_UPDATED:
      return 'Updated a section';
    case LOG_ACTIONS.SECTION_DELETED:
      return 'Deleted a section';
    case LOG_ACTIONS.SECTION_REORDERED:
      return 'Reordered sections';
    case LOG_ACTIONS.NEWS_UNBOOKMARKED:
      return 'Removed bookmark';
    case LOG_ACTIONS.COMMENT_UPDATED:
      return 'Updated a comment';
    case LOG_ACTIONS.COMMENT_DELETED:
      return 'Deleted a comment';
    case LOG_ACTIONS.COLLECTION_CREATED:
      return 'Created a collection';
    case LOG_ACTIONS.COLLECTION_UPDATED:
      return 'Updated collection';
    case LOG_ACTIONS.COLLECTION_DELETED:
      return 'Deleted collection';
    case LOG_ACTIONS.NEWS_ADDED_TO_COLLECTION:
      return 'Added article to collection';
    case LOG_ACTIONS.NEWS_REMOVED_FROM_COLLECTION:
      return 'Removed article from collection';
    case LOG_ACTIONS.CATEGORY_CREATED:
      return 'Created a category';
    case LOG_ACTIONS.CATEGORY_UPDATED:
      return 'Updated category';
    case LOG_ACTIONS.CATEGORY_DELETED:
      return 'Deleted category';
    case LOG_ACTIONS.SUBCATEGORY_CREATED:
      return 'Created a subcategory';
    case LOG_ACTIONS.SUBCATEGORY_UPDATED:
      return 'Updated subcategory';
    case LOG_ACTIONS.SUBCATEGORY_DELETED:
      return 'Deleted subcategory';
    case LOG_ACTIONS.USER_CREATED:
      return 'Created a new user';
    case LOG_ACTIONS.USER_UPDATED:
      return 'Updated user details';
    case LOG_ACTIONS.USER_ROLE_CHANGED:
      return 'Changed user role';
    case LOG_ACTIONS.USER_DELETED:
      return 'Deleted user';
    default:
      return (action as string).replace(/\./g, ' ').toLowerCase();
  }
}
