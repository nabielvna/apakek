// app/admin/page.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { getDashboardData } from '@/actions/dashboard';

type DashboardData = {
    title: string;
    value: string;
    trend: number;
};

export default async function Page() {
    const data = await getDashboardData().catch(() => null);

    if (!data) {
        return (
            <div className="pt-16 space-y-4">
                <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
                <p>Failed to load dashboard data. Please try again later.</p>
            </div>
        );
    }

    const dashboardData: DashboardData[] = [
        {
            title: 'Total Artikel',
            value: data.metrics.totalNews.value,
            trend: data.metrics.totalNews.trend,
        },
        {
            title: 'Artikel Aktif',
            value: data.metrics.activeNews.value,
            trend: data.metrics.activeNews.trend,
        },
        {
            title: 'Total Pembaca',
            value: parseInt(data.metrics.totalReaders.value).toLocaleString(),
            trend: data.metrics.totalReaders.trend,
        },
        {
            title: 'Komentar Baru',
            value: data.metrics.newComments.value,
            trend: data.metrics.newComments.trend,
        },
    ];

    return (
        <div className="pt-16 space-y-4 md:space-y-6">
            <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                {dashboardData.map((data, index) => (
                    <Card key={index} className="overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                                {data.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="flex flex-col md:flex-row md:items-baseline md:space-x-4">
                                <div className="text-lg md:text-2xl font-bold">
                                    {data.value}
                                </div>
                                <span
                                    className={`inline-flex items-center text-xs md:text-sm font-medium mt-1 md:mt-0 ${
                                        data.trend >= 0
                                            ? 'text-green-600 dark:text-green-400'
                                            : 'text-red-600 dark:text-red-400'
                                    }`}
                                >
                                    {data.trend >= 0 ? (
                                        <ArrowUpIcon className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                                    ) : (
                                        <ArrowDownIcon className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                                    )}
                                    {Math.abs(data.trend).toFixed(1)}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="p-4 md:p-6">
                    <CardTitle className="text-lg md:text-xl">
                        Recent Activities
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                        <div className="hidden md:grid md:grid-cols-3 py-3 px-6 text-sm font-medium text-muted-foreground">
                            <div>User</div>
                            <div>Activity</div>
                            <div>Date</div>
                        </div>
                        {data.activities.map((activity) => (
                            <div
                                key={activity.id}
                                className="p-4 md:p-6 text-sm space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:items-center"
                            >
                                <div className="font-medium">
                                    {activity.user}
                                </div>
                                <div className="text-muted-foreground">
                                    {activity.activity}
                                </div>
                                <div className="text-muted-foreground text-xs md:text-sm">
                                    {new Date(activity.date).toLocaleDateString(
                                        'id-ID'
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
