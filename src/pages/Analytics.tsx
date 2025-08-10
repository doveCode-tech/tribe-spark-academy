import { LMSLayout } from "@/components/LMSLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, courses: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: usersData, error: usersError }, { data: coursesData, error: coursesError }] = await Promise.all([
          supabase.rpc('admin_list_users'),
          supabase.from('courses').select('*')
        ]);
        if (usersError) throw usersError;
        if (coursesError) throw coursesError;
        setStats({ users: usersData?.length || 0, courses: coursesData?.length || 0 });
      } catch (e) {
        console.error('Error loading analytics:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <LMSLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Key platform metrics</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? '—' : stats.users}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? '—' : stats.courses}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LMSLayout>
  );
}
