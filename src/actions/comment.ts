'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUserData } from '@/actions/user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const CommentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(500, 'Comment is too long'),
  newsId: z.string().min(1)
})

export async function addComment(data: z.infer<typeof CommentSchema>) {
    try {
      const validation = CommentSchema.safeParse(data)
      if (!validation.success) {
        throw new Error(validation.error.errors[0].message)
      }

      const user = await getCurrentUserData()
      if (!user) {
        throw new Error('Unauthorized')
      }

      // Start a transaction to handle all related updates
      await prisma.$transaction(async (tx) => {
        // Get the news interaction for this news
        const newsInteraction = await tx.newsInteraction.findFirst({
          where: { newsId: data.newsId }
        })

        if (!newsInteraction) {
          throw new Error('News interaction not found')
        }

        // Get user interaction
        const userInteraction = await tx.userInteraction.findFirst({
          where: { userId: user.id }
        })

        if (!userInteraction) {
          throw new Error('User interaction not found')
        }

        // Create the comment
        await tx.comment.create({
          data: {
            text: data.text,
            newsInteractionId: newsInteraction.id,
            userInteractionId: userInteraction.id
          }
        })

        // Increment popularity score for the news
        await tx.newsInteraction.update({
          where: { id: newsInteraction.id },
          data: {
            popularityScore: {
              increment: 2
            }
          }
        })

        // Increment contribution score for the user
        await tx.userInteraction.update({
          where: { id: userInteraction.id },
          data: {
            contributionScore: {
              increment: 2
            }
          }
        })
      })

      revalidatePath(`/news/${data.newsId}`)
      return { success: true }
    } catch (error) {
      console.error('[ADD_COMMENT]', error)
      throw error
    }
  }

  export async function deleteComment(commentId: string) {
    try {
      const user = await getCurrentUserData()
      if (!user) {
        throw new Error('Unauthorized')
      }

      // Get the comment with its relations
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          newsInteraction: {
            include: {
              news: true
            }
          },
          userInteraction: {
            include: {
              user: true
            }
          }
        }
      })

      if (!comment) {
        throw new Error('Comment not found')
      }

      // Verify ownership
      if (comment.userInteraction.user.id !== user.id) {
        throw new Error('Unauthorized')
      }

      // Start a transaction to handle both deletion and score updates
      await prisma.$transaction(async (tx) => {
        // Delete the comment
        await tx.comment.delete({
          where: { id: commentId }
        })

        // Decrement popularity score for the news
        await tx.newsInteraction.update({
          where: { id: comment.newsInteractionId },
          data: {
            popularityScore: {
              decrement: 2
            }
          }
        })

        // Decrement contribution score for the user
        await tx.userInteraction.update({
          where: { id: comment.userInteractionId },
          data: {
            contributionScore: {
              decrement: 2
            }
          }
        })
      })

      revalidatePath(`/news/${comment.newsInteraction.news.id}`)
      return { success: true }
    } catch (error) {
      console.error('[DELETE_COMMENT]', error)
      throw error
    }
  }

  export async function getNewsComments(newsId: string) {
    try {
      const newsInteraction = await prisma.newsInteraction.findFirst({
        where: { newsId },
        include: {
          comments: {
            include: {
              userInteraction: {
                include: {
                  user: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      })

      if (!newsInteraction) {
        return []
      }

      return newsInteraction.comments
    } catch (error) {
      console.error('[GET_NEWS_COMMENTS]', error)
      return []
    }
  }

export async function getUserComments() {
  try {
    const user = await getCurrentUserData()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const userWithComments = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userInteractions: {
          include: {
            comments: {
              include: {
                newsInteraction: {
                  include: {
                    news: {
                      include: {
                        subCategory: {
                          include: {
                            category: true
                          }
                        }
                      }
                    }
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        }
      }
    })

    if (!userWithComments?.userInteractions[0]) {
      return []
    }

    return userWithComments.userInteractions[0].comments
  } catch (error) {
    console.error('[GET_USER_COMMENTS]', error)
    throw new Error('Failed to fetch comments')
  }
}