"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, MessageSquare, Eye, Loader2, Calendar, LayoutGrid, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserComments } from '@/actions/comment';
import { getCurrentUserData, getClerkUser } from '@/actions/user';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface Comment {
  id: string;
  text: string;
  createdAt: Date;
  newsInteractionId: string;
  newsInteraction: {
    news: {
      path: string;
      title: string;
      subCategory: {
        path: string;
        category: {
          path: string;
          title: string;
        };
      };
    };
  };
}

interface EnrichedComment extends Comment {
  clerkUser: {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    email: string | null;
  } | null;
}

export default function CommentsPage() {
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timePeriod, setTimePeriod] = useState('all');
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const router = useRouter();

  const fetchComments = async () => {
    try {
      setLoading(true);
      const userComments = await getUserComments();
      const currentUser = await getCurrentUserData();

      if (!currentUser?.clerkId) {
        throw new Error('User not found');
      }

      const clerkUser = await getClerkUser(currentUser.clerkId);
      const enrichedComments = userComments.map(comment => ({
        ...comment,
        clerkUser
      }));

      setComments(enrichedComments);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, []);

  const getUserDisplayName = (comment: EnrichedComment) => {
    if (!comment.clerkUser) return 'Anonymous User';
    const fullName = `${comment.clerkUser.firstName || ''} ${comment.clerkUser.lastName || ''}`.trim();
    return fullName || comment.clerkUser.email || 'Anonymous User';
  };

  const filteredComments = comments.filter(comment => {
    const matchesSearch =
      comment.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.newsInteraction.news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.newsInteraction.news.subCategory.category.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserDisplayName(comment).toLowerCase().includes(searchTerm.toLowerCase());

    if (timePeriod === 'all') return matchesSearch;

    const commentDate = new Date(comment.createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - commentDate.getTime()) / (1000 * 3600 * 24);

    switch (timePeriod) {
      case 'today': return matchesSearch && daysDiff < 1;
      case 'week': return matchesSearch && daysDiff < 7;
      case 'month': return matchesSearch && daysDiff < 30;
      default: return matchesSearch;
    }
  });

  const stats = [
    {
      title: "Total Comments",
      value: comments.length,
      description: "All time",
      icon: MessageSquare
    },
    {
      title: "Recent Comments",
      value: comments.filter(c => (new Date().getTime() - new Date(c.createdAt).getTime()) / (1000 * 3600 * 24) < 7).length,
      description: "Last 7 days",
      icon: Calendar
    },
    {
      title: "Active Articles",
      value: new Set(comments.map(c => c.newsInteractionId)).size,
      description: "Articles with comments",
      icon: LayoutGrid
    }
  ];

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading likes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-16 pb-8 space-y-8 max-w-7xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Comments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your article comments
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index} className="border-border bg-card hover:bg-accent/5 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search in comments, articles, or categories..."
            className="pl-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[180px] bg-muted/50 border-input">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="inline-flex items-center gap-2 border-input text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchTerm('');
              setTimePeriod('all');
            }}
          >
            <Filter className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground w-48">User</TableHead>
              <TableHead className="text-muted-foreground">Comment</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Article</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Category</TableHead>
              <TableHead className="text-muted-foreground hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right text-muted-foreground w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredComments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <p className="text-muted-foreground">No comments found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredComments.map((comment) => (
                <TableRow key={comment.id} className="group">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={comment.clerkUser?.imageUrl || undefined}
                          alt={getUserDisplayName(comment)}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getUserDisplayName(comment).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">
                          {getUserDisplayName(comment)}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1 md:hidden">
                          {format(new Date(comment.createdAt), 'PPp')}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground line-clamp-2 group-hover:text-foreground transition-colors">
                      {comment.text}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm text-muted-foreground hover:text-foreground cursor-pointer line-clamp-1 transition-colors">
                      {comment.newsInteraction.news.title}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {comment.newsInteraction.news.subCategory.category.title}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <time className="text-sm text-muted-foreground" dateTime={comment.createdAt.toString()}>
                      {format(new Date(comment.createdAt), 'PPp')}
                    </time>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          disabled={loading}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem
                          className="cursor-pointer flex items-center gap-2 text-muted-foreground hover:text-foreground focus:text-foreground"
                          onClick={() => router.push(
                            `/${comment.newsInteraction.news.subCategory.category.path}/` +
                            `${comment.newsInteraction.news.subCategory.path}/` +
                            `${comment.newsInteraction.news.path}`
                          )}
                        >
                          <Eye className="h-4 w-4" />
                          View Article
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
