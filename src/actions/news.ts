'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import type { News } from '@/types';
import { Prisma } from '@prisma/client';
import { createLog, NEWS_ACTIONS } from '@/lib/log';

// Validation schemas for each content type
const SectionImageSchema = z.object({
    imageUrl: z.string().min(1).max(1000),
    alt: z.string().min(1).max(50),
    description: z.string().min(1).max(150),
});

const SectionTextSchema = z.object({
    text: z.string().min(1),
});

const SectionSchema = z.object({
    id: z.string().optional(),
    order: z.number().min(0),
    title: z.string().max(100).nullable(),
    isSeparator: z.boolean(),
    content: z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), data: SectionTextSchema }),
        z.object({ type: z.literal('image'), data: SectionImageSchema }),
    ]),
});

const NewsSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(200),
    thumbnailUrl: z.string().max(1000).optional(),
    subCategoryId: z.string().min(1),
    userId: z.string().min(1),
    sections: z.array(SectionSchema),
});

// Path generator utility
class PathGenerator {
    private readonly maxLength: number;
    private readonly separator: string;
    private existingPaths: Set<string>;

    constructor(existingPaths: string[] = [], maxLength = 100) {
        this.maxLength = maxLength;
        this.separator = '-';
        this.existingPaths = new Set(existingPaths);
    }

    private slugify(text: string): string {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_]+/g, this.separator)
            .replace(new RegExp(`${this.separator}+`, 'g'), this.separator)
            .replace(
                new RegExp(`^${this.separator}|${this.separator}$`, 'g'),
                ''
            );
    }

    private makeUnique(basePath: string): string {
        let path = basePath;
        let counter = 1;

        if (path.length > this.maxLength) {
            path = path.substring(0, this.maxLength - 3);
        }

        let finalPath = path;
        while (this.existingPaths.has(finalPath)) {
            finalPath = `${path}${this.separator}${counter}`;
            counter++;

            if (finalPath.length > this.maxLength) {
                const suffix = `${this.separator}${counter}`;
                path = path.substring(0, this.maxLength - suffix.length);
                finalPath = path + suffix;
            }
        }

        return finalPath;
    }

    generatePath(title: string): string {
        const slugged = this.slugify(title);
        const uniquePath = this.makeUnique(slugged);
        this.existingPaths.add(uniquePath);
        return uniquePath;
    }
}

async function getAllExistingPaths(): Promise<string[]> {
    const news = await prisma.news.findMany({ select: { path: true } });
    return news.map((n) => n.path);
}

function handleError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                throw new Error('A news with this path already exists');
            case 'P2025':
                throw new Error('News not found');
            case 'P2003':
                throw new Error('Referenced record not found');
            default:
                throw new Error(`Database error: ${error.code}`);
        }
    } else if (error instanceof z.ZodError) {
        throw new Error(`Validation error: ${error.errors[0].message}`);
    } else if (error instanceof Error) {
        throw new Error(error.message);
    } else {
        throw new Error('An unexpected error occurred');
    }
}

export async function updateSections(
    sections: z.infer<typeof SectionSchema>[]
) {
    const updatedSections = await Promise.all(
        sections.map(async (section) => {
            if (!section.id) {
                throw new Error('Section ID is required for updates');
            }

            const updatedSection = await prisma.section.update({
                where: { id: section.id },
                data: {
                    order: section.order,
                    title: section.title,
                    isSeparator: section.isSeparator,
                },
            });

            if (section.content.type === 'text') {
                await prisma.sectionText.updateMany({
                    where: { sectionId: section.id },
                    data: { text: section.content.data.text },
                });
            } else if (section.content.type === 'image') {
                await prisma.sectionImage.updateMany({
                    where: { sectionId: section.id },
                    data: {
                        imageUrl: section.content.data.imageUrl,
                        alt: section.content.data.alt,
                        description: section.content.data.description,
                    },
                });
            }

            return updatedSection;
        })
    );

    return updatedSections;
}

export async function getNews(subCategoryId?: string): Promise<News[]> {
    try {
        const where = subCategoryId ? { subCategoryId } : undefined;
        const news = await prisma.news.findMany({
            where,
            include: {
                user: true,
                subCategory: {
                    include: {
                        category: true,
                    },
                },
                sections: {
                    include: {
                        sectionImages: true,
                        sectionTexts: true,
                    },
                    orderBy: {
                        order: 'asc',
                    },
                },
                newsInteractions: {
                    include: {
                        likes: true,
                        bookmarks: true,
                        comments: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return news as News[];
    } catch (error) {
        console.error('[GET_NEWS]', error);
        throw error;
    }
}

export async function getNewsById(id: string): Promise<News | null> {
    try {
        const news = await prisma.news.findUnique({
            where: { id },
            include: {
                user: true,
                subCategory: {
                    include: {
                        category: true,
                    },
                },
                sections: {
                    include: {
                        sectionImages: true,
                        sectionTexts: true,
                    },
                    orderBy: {
                        order: 'asc',
                    },
                },
                newsInteractions: {
                    include: {
                        likes: true,
                        bookmarks: true,
                        comments: true,
                    },
                },
            },
        });
        return news as News;
    } catch (error) {
        handleError(error);
    }
}

export async function createNews(
    data: z.infer<typeof NewsSchema>
): Promise<News> {
    try {
        const validation = NewsSchema.safeParse(data);
        if (!validation.success) {
            throw new z.ZodError(validation.error.errors);
        }

        const existingPaths = await getAllExistingPaths();
        const pathGenerator = new PathGenerator(existingPaths);
        const path = pathGenerator.generatePath(data.title);

        const { sections, ...newsData } = validation.data;

        // Menggunakan transaksi untuk memastikan semua operasi berhasil termasuk logging
        const news = await prisma.$transaction(async (tx) => {
            // Create news with basic data
            const createdNews = await tx.news.create({
                data: {
                    ...newsData,
                    path,
                    newsInteractions: {
                        create: {
                            popularityScore: 0,
                        },
                    },
                },
            });

            // Create sections with their content
            await Promise.all(
                sections.map(async (section) => {
                    const createdSection = await tx.section.create({
                        data: {
                            order: section.order,
                            title: section.title,
                            isSeparator: section.isSeparator,
                            newsId: createdNews.id,
                        },
                    });

                    if (section.content.type === 'text') {
                        await tx.sectionText.create({
                            data: {
                                text: section.content.data.text,
                                sectionId: createdSection.id,
                            },
                        });
                    } else if (section.content.type === 'image') {
                        await tx.sectionImage.create({
                            data: {
                                imageUrl: section.content.data.imageUrl,
                                alt: section.content.data.alt,
                                description: section.content.data.description,
                                sectionId: createdSection.id,
                            },
                        });
                    }
                })
            );

            // Create log entry
            await createLog(tx, {
                userId: newsData.userId,
                action: NEWS_ACTIONS.NEWS_CREATED,
                description: `Created news article: ${newsData.title}`,
                metadata: {
                    newsId: createdNews.id,
                    path: createdNews.path,
                    title: newsData.title,
                    sectionsCount: sections.length
                }
            });

            return createdNews;
        });

        // Fetch complete news with all relations
        const completeNews = await getNewsById(news.id);
        if (!completeNews) throw new Error('Failed to create news');

        revalidatePath('/news');
        return completeNews;
    } catch (error) {
        handleError(error);
    }
}

export async function updateNews(
    id: string,
    data: z.infer<typeof NewsSchema>
): Promise<News> {
    try {
        const validation = NewsSchema.safeParse(data);
        if (!validation.success) {
            throw new z.ZodError(validation.error.errors);
        }

        const existingPaths = await getAllExistingPaths();
        const currentNews = await prisma.news.findUnique({
            where: { id },
            select: { path: true, title: true },
        });

        const filteredPaths = existingPaths.filter(
            (p) => p !== currentNews?.path
        );
        const pathGenerator = new PathGenerator(filteredPaths);
        const path = pathGenerator.generatePath(data.title);

        const { sections, ...newsData } = validation.data;

        // Menggunakan transaksi untuk update dan logging
        await prisma.$transaction(async (tx) => {
            // Update news basic data
            const updatedNews = await tx.news.update({
                where: { id },
                data: {
                    ...newsData,
                    path,
                },
            });

            // Delete existing sections
            await tx.section.deleteMany({
                where: { newsId: id },
            });

            // Create new sections
            await Promise.all(
                sections.map(async (section) => {
                    const createdSection = await tx.section.create({
                        data: {
                            order: section.order,
                            title: section.title,
                            isSeparator: section.isSeparator,
                            newsId: updatedNews.id,
                        },
                    });

                    if (section.content.type === 'text') {
                        await tx.sectionText.create({
                            data: {
                                text: section.content.data.text,
                                sectionId: createdSection.id,
                            },
                        });
                    } else if (section.content.type === 'image') {
                        await tx.sectionImage.create({
                            data: {
                                imageUrl: section.content.data.imageUrl,
                                alt: section.content.data.alt,
                                description: section.content.data.description,
                                sectionId: createdSection.id,
                            },
                        });
                    }
                })
            );

            // Create log entry
            await createLog(tx, {
                userId: newsData.userId,
                action: NEWS_ACTIONS.NEWS_UPDATED,
                description: `Updated news article: ${data.title} (previously: ${currentNews?.title})`,
                metadata: {
                    newsId: id,
                    oldTitle: currentNews?.title,
                    newTitle: data.title,
                    oldPath: currentNews?.path,
                    newPath: path,
                    sectionsCount: sections.length
                }
            });
        });

        // Fetch and return updated news
        const updatedNews = await getNewsById(id);
        if (!updatedNews) throw new Error('Failed to update news');

        revalidatePath('/news');
        return updatedNews;
    } catch (error) {
        handleError(error);
    }
}

export async function deleteNews(id: string): Promise<News> {
    try {
        // Menggunakan transaksi untuk delete dan logging
        return await prisma.$transaction(async (tx) => {
            // Get news details before deletion
            const newsToDelete = await tx.news.findUnique({
                where: { id },
                select: {
                    title: true,
                    userId: true,
                    sections: true
                }
            });

            if (!newsToDelete) {
                throw new Error('News not found');
            }

            // Delete the news
            const deletedNews = await tx.news.delete({
                where: { id },
                include: {
                    user: true,
                    subCategory: {
                        include: {
                            category: true,
                        },
                    },
                    sections: {
                        include: {
                            sectionImages: true,
                            sectionTexts: true,
                        },
                    },
                    newsInteractions: {
                        include: {
                            likes: true,
                            bookmarks: true,
                            comments: true,
                        },
                    },
                },
            });

            // Create log entry
            await createLog(tx, {
                userId: newsToDelete.userId,
                action: NEWS_ACTIONS.NEWS_DELETED,
                description: `Deleted news article: ${newsToDelete.title}`,
                metadata: {
                    newsId: id,
                    title: newsToDelete.title,
                    sectionsCount: newsToDelete.sections.length
                }
            });

            return deletedNews as News;
        });

        revalidatePath('/news');
    } catch (error) {
        handleError(error);
    }
}
