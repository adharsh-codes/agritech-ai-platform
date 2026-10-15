"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  Upload,
  Brain,
  ShoppingCart,
} from "lucide-react";

const activities = [
  {
    icon: Upload,
    label: "Terrace Upload",
  },
  {
    icon: Brain,
    label: "Crop Advice",
  },
  {
    icon: ShoppingCart,
    label: "Order Placed",
  },
  {
    icon: CheckCircle2,
    label: "Hydroponics Check",
  },
] as const;

export default function RecentActivity() {
  return (
    <Card className="rounded-2xl shadow-md">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-6">Recent Activity</h2>

        <div className="space-y-5">
          {activities.map((activity, index) => {
            const Icon = activity.icon;

            return (
              <div key={index} className="flex items-center gap-4">
                <Icon className="text-green-600" size={22} />
                <p className="text-base font-semibold text-gray-800">{activity.label}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
