"use client";

import {
  DataTable,
  type ColumnDef,
} from "@tourism/ui/components/custom/data-table";
import { Badge } from "@tourism/ui/components/custom/badge-custom";

type Booking = {
  code: string;
  customer: string;
  tour: string;
  status: "PAID" | "PENDING" | "CANCELLED";
  amount: number;
};

const data: Booking[] = [
  { code: "BK-1042", customer: "Jane Doe", tour: "Ha Long Bay 2D1N", status: "PAID", amount: 378 },
  { code: "BK-1043", customer: "Minh Tran", tour: "Sapa Trekking", status: "PENDING", amount: 210 },
  { code: "BK-1044", customer: "Sarah Brown", tour: "Hoi An Lantern", status: "PAID", amount: 95 },
  { code: "BK-1045", customer: "Tom Lee", tour: "Mekong Delta", status: "CANCELLED", amount: 140 },
  { code: "BK-1046", customer: "Anna Pham", tour: "Phong Nha Caves", status: "PAID", amount: 320 },
  { code: "BK-1047", customer: "David Kim", tour: "Da Lat Highlands", status: "PENDING", amount: 180 },
  { code: "BK-1048", customer: "Lan Vo", tour: "Ha Long Bay 2D1N", status: "PAID", amount: 378 },
];

const statusVariant: Record<Booking["status"], "default" | "outline" | "destructive"> = {
  PAID: "default",
  PENDING: "outline",
  CANCELLED: "destructive",
};

const columns: ColumnDef<Booking>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "customer", header: "Customer" },
  { accessorKey: "tour", header: "Tour" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => `$${row.original.amount}`,
  },
];

export function DataTableDemo() {
  return <DataTable columns={columns} data={data} pageSize={5} />;
}
