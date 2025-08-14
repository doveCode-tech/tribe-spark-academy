import { LMSLayout } from "@/components/LMSLayout";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";

export default function Badges() {
  return (
    <LMSLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Award className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold">Badge System</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Available Badges</CardTitle>
          </CardHeader>
          <CardContent>
            <BadgeDisplay badges={[]} />
          </CardContent>
        </Card>
      </div>
    </LMSLayout>
  );
}