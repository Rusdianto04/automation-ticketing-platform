import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getCookie } from "cookies-next";
import moment from "moment";
import TicketFilters from "@/shadcn/components/tickets/TicketFilters";

export default function ClosedIssues() {
  const router = useRouter();
  const token = getCookie("session");

  const [data, setData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  async function fetchTickets() {
    try {
      const response = await fetch(`/api/v1/tickets/completed`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setData(await response.json());
      } else {
        setData({ tickets: [] });
      }
    } catch {
      setData({ tickets: [] });
    }
  }

  async function fetchUsers() {
    try {
      const response = await fetch(`/api/v1/users/all`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setUsers(result.users || []);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchTickets(), fetchUsers()]);
      setLoading(false);
    }
    loadData();
  }, []);

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleAssigneeToggle = (assignee: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assignee) ? prev.filter((a) => a !== assignee) : [...prev, assignee]
    );
  };

  const handleClearFilters = () => {
    setSelectedStatuses([]);
    setSelectedAssignees([]);
  };

  const filteredTickets = data?.tickets && Array.isArray(data.tickets)
    ? data.tickets.filter((ticket: any) => {
        const statusMatch =
          selectedStatuses.length === 0 ||
          selectedStatuses.includes(ticket.isComplete ? "closed" : "open");
        const assigneeMatch =
          selectedAssignees.length === 0 ||
          (ticket.assignedTo
            ? selectedAssignees.includes(ticket.assignedTo.name)
            : selectedAssignees.includes("Unassigned"));
        return statusMatch && assigneeMatch;
      })
    : [];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 sm:p-8 w-full bg-background min-h-screen">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Closed Issues</h1>
          <TicketFilters
            selectedStatuses={selectedStatuses}
            selectedAssignees={selectedAssignees}
            users={users}
            onStatusToggle={handleStatusToggle}
            onAssigneeToggle={handleAssigneeToggle}
            onClearFilters={handleClearFilters}
          />
        </div>

        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border">
            <p className="text-muted-foreground text-lg">No closed tickets found</p>
          </div>
        ) : (
          <div className="bg-card shadow rounded-lg overflow-hidden border">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground">Title</th>
                    <th className="hidden px-3 py-3.5 text-left text-sm font-semibold text-foreground sm:table-cell">Status</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Created</th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {filteredTickets.map((ticket: any) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/issue/${ticket.id}`)}
                    >
                      <td className="py-4 pl-4 pr-3 text-sm font-medium text-foreground truncate max-w-[300px]">
                        {ticket.title}
                      </td>
                      <td className="hidden px-3 py-4 text-sm sm:table-cell">
                        <span className="inline-flex items-center gap-x-1.5 rounded-md bg-red-100 dark:bg-red-950 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300">
                          <svg className="h-1.5 w-1.5 fill-red-500" viewBox="0 0 6 6" aria-hidden="true">
                            <circle cx={3} cy={3} r={3} />
                          </svg>
                          Closed
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {moment(ticket.createdAt).format("DD/MM/YYYY")}
                      </td>
                      <td className="px-3 py-4 text-sm text-muted-foreground max-w-[200px]">
                        {ticket.engineers && ticket.engineers.length > 0
                          ? ticket.engineers.map((e: any) => e.name).join(", ")
                          : ticket.assignedTo ? ticket.assignedTo.name : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
